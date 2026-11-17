"""Connexion Microsoft (Outlook.com, Hotmail, Live) par OAuth2, sans dépendance.

Utilise le « device code flow » : l'outil affiche un code, tu te connectes sur
le site de Microsoft dans ton navigateur, et l'outil reçoit un jeton d'accès à
ta boîte mail. Ton mot de passe ne passe jamais par l'outil.

Le jeton de renouvellement est gardé dans ~/.mail-cleaner/ (lisible par toi
seul) pour ne pas avoir à te reconnecter à chaque fois.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

IMAP_SCOPE = "https://outlook.office.com/IMAP.AccessAsUser.All offline_access"
OUTLOOK_DOMAINS = {"outlook.com", "outlook.fr", "hotmail.com", "hotmail.fr",
                   "live.com", "live.fr", "msn.com", "passport.com"}
TOKEN_DIR = Path(os.environ.get("MAIL_CLEANER_HOME", Path.home() / ".mail-cleaner"))


class AuthError(Exception):
    pass


def is_outlook(address: str) -> bool:
    return address.rsplit("@", 1)[-1].lower() in OUTLOOK_DOMAINS


def _post(url: str, data: dict) -> dict:
    body = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return json.load(e)
        except ValueError:
            raise AuthError(f"Erreur HTTP {e.code} de Microsoft") from e


def _token_file(address: str) -> Path:
    return TOKEN_DIR / f"outlook-{address.lower()}.json"


def _save(address: str, data: dict) -> None:
    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(TOKEN_DIR, 0o700)
    except OSError:
        pass
    path = _token_file(address)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump({"refresh_token": data["refresh_token"]}, f)


def forget(address: str) -> bool:
    path = _token_file(address)
    if path.exists():
        path.unlink()
        return True
    return False


def get_access_token(address: str, client_id: str, tenant: str = "consumers",
                     interactive: bool = True) -> str:
    base = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0"

    # 1) Jeton déjà enregistré ?
    path = _token_file(address)
    if path.exists():
        try:
            refresh = json.loads(path.read_text())["refresh_token"]
        except (ValueError, KeyError):
            refresh = None
        if refresh:
            res = _post(f"{base}/token", {
                "client_id": client_id, "grant_type": "refresh_token",
                "refresh_token": refresh, "scope": IMAP_SCOPE,
            })
            if "access_token" in res:
                if "refresh_token" in res:
                    _save(address, res)
                return res["access_token"]

    if not interactive:
        raise AuthError("Connexion Microsoft expirée : relance une fois l'outil à la main "
                        "pour te reconnecter.")

    # 2) Nouvelle connexion via le navigateur
    res = _post(f"{base}/devicecode", {"client_id": client_id, "scope": IMAP_SCOPE})
    if "device_code" not in res:
        raise AuthError(res.get("error_description") or str(res))
    print("\n🔐 Connexion à ton compte Microsoft")
    print(f"   1. Ouvre {res['verification_uri']} dans ton navigateur")
    print(f"   2. Saisis le code : {res['user_code']}")
    print(f"   3. Connecte-toi avec {address} et accepte l'accès à tes mails\n")
    print("   En attente de ta connexion…")

    interval = int(res.get("interval", 5))
    deadline = time.time() + int(res.get("expires_in", 900))
    while time.time() < deadline:
        time.sleep(interval)
        tok = _post(f"{base}/token", {
            "client_id": client_id, "device_code": res["device_code"],
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        })
        if "access_token" in tok:
            if "refresh_token" in tok:
                _save(address, tok)
            print("   ✅ Connecté à Microsoft\n")
            return tok["access_token"]
        err = tok.get("error")
        if err == "authorization_pending":
            continue
        if err == "slow_down":
            interval += 5
            continue
        raise AuthError(tok.get("error_description") or err or str(tok))
    raise AuthError("Délai de connexion dépassé, relance l'outil.")


def xoauth2(address: str, token: str):
    """Fonction pour imaplib.authenticate('XOAUTH2', ...)."""
    return lambda _: f"user={address}\x01auth=Bearer {token}\x01\x01".encode()
