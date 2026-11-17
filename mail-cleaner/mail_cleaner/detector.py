"""Détection des mails indésirables : phishing, casino, arnaques, contenu adulte.

Chaque règle ajoute des points à un score. Au-delà du seuil, le mail est
considéré comme indésirable. Les règles sont volontairement lisibles pour
pouvoir être ajustées facilement.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from email.message import Message
from email.utils import getaddresses, parseaddr
from html import unescape

DEFAULT_THRESHOLD = 6

# --------------------------------------------------------------------------
# Listes de mots-clés (écrites sans accents : le texte est normalisé avant)
# --------------------------------------------------------------------------

CASINO_KEYWORDS = [
    "casino", "free spins", "tours gratuits", "spins gratuits", "jackpot",
    "machines a sous", "machine a sous", "slots", "paris sportifs",
    "pari sportif", "betting", "roulette", "blackjack", "poker en ligne",
    "online poker", "bonus de bienvenue", "welcome bonus", "bonus sans depot",
    "no deposit bonus", "cashback casino", "mise gratuite", "free bet",
    "pari gratuit", "gagnez gros", "big win",
]

PHISHING_PHRASES = [
    "votre compte a ete suspendu", "votre compte sera suspendu",
    "compte bloque", "compte temporairement", "verifiez votre compte",
    "verifier votre compte", "verify your account", "confirm your identity",
    "confirmez votre identite", "mettre a jour vos informations",
    "mettez a jour vos informations", "update your payment",
    "mise a jour de vos coordonnees", "unusual activity", "activite inhabituelle",
    "activite suspecte", "suspicious activity", "colis en attente",
    "votre colis est en attente", "frais de livraison", "frais de douane",
    "your package", "remboursement en attente", "vous avez droit a un remboursement",
    "carte vitale", "amende impayee", "avis de contravention",
    "your password expires", "votre mot de passe expire",
    "action requise", "action required", "dernier avertissement",
    "final notice", "sous 24h", "within 24 hours", "cliquez ici pour",
    "click here to", "votre abonnement a expire", "paiement refuse",
    "payment declined", "renouveler votre abonnement",
]

SCAM_PHRASES = [
    "vous avez gagne", "you have won", "you've won", "felicitations vous",
    "congratulations you", "loterie", "lottery", "heritage", "inheritance",
    "beneficiaire", "beneficiary", "western union", "moneygram",
    "carte cadeau", "gift card", "investissement crypto", "crypto investment",
    "doublez votre", "double your", "revenu passif", "passive income",
    "gagnez de l'argent", "make money fast", "travail a domicile",
    "work from home", "100% garanti", "100% guaranteed", "offre exclusive reservee",
    "selectionne pour", "you have been selected", "iphone gratuit",
    "free iphone", "reclamer votre prix", "claim your prize", "bitcoin",
    "trading automatique", "millionnaire",
]

ADULT_KEYWORDS = [
    "viagra", "cialis", "rencontres coquines", "rencontre coquine",
    "sexy singles", "hot singles", "femmes celibataires pres de chez vous",
    "plan cul", "webcam sexy", "xxx", "porn", "erection",
]

# Marques souvent usurpées -> domaines légitimes
BRANDS = {
    "paypal": ["paypal.com", "paypal.fr"],
    "amazon": ["amazon.com", "amazon.fr", "amazon.de", "amazonses.com", "amazon.co.uk"],
    "netflix": ["netflix.com"],
    "apple": ["apple.com", "icloud.com", "me.com"],
    "icloud": ["apple.com", "icloud.com"],
    "microsoft": ["microsoft.com", "outlook.com", "live.com", "office.com", "microsoftonline.com"],
    "outlook": ["microsoft.com", "outlook.com"],
    "google": ["google.com", "gmail.com", "youtube.com"],
    "ameli": ["ameli.fr", "assurance-maladie.fr"],
    "assurance maladie": ["ameli.fr", "assurance-maladie.fr"],
    "impots": ["impots.gouv.fr", "dgfip.finances.gouv.fr"],
    "dgfip": ["impots.gouv.fr", "dgfip.finances.gouv.fr"],
    "antai": ["antai.gouv.fr"],
    "caf": ["caf.fr"],
    "la poste": ["laposte.fr", "laposte.net", "lapostemobile.fr"],
    "colissimo": ["laposte.fr", "colissimo.fr"],
    "chronopost": ["chronopost.fr"],
    "dhl": ["dhl.com", "dhl.fr", "dhl.de"],
    "ups": ["ups.com"],
    "fedex": ["fedex.com"],
    "credit agricole": ["credit-agricole.fr", "ca-paris.fr", "credit-agricole.com"],
    "bnp": ["bnpparibas.com", "bnpparibas.fr", "mabanque.bnpparibas"],
    "societe generale": ["societegenerale.fr", "societegenerale.com"],
    "lcl": ["lcl.fr"],
    "boursorama": ["boursorama.com", "boursorama.fr"],
    "caisse d'epargne": ["caisse-epargne.fr"],
    "banque populaire": ["banquepopulaire.fr"],
    "orange": ["orange.fr", "orange.com"],
    "sfr": ["sfr.fr", "sfr.com"],
    "free mobile": ["free.fr", "free-mobile.fr"],
    "bouygues": ["bouyguestelecom.fr", "bouygues.com"],
    "edf": ["edf.fr", "edf.com"],
    "engie": ["engie.fr", "engie.com"],
    "france travail": ["francetravail.fr", "pole-emploi.fr"],
    "vinted": ["vinted.fr", "vinted.com"],
    "leboncoin": ["leboncoin.fr"],
    "facebook": ["facebook.com", "facebookmail.com", "meta.com"],
    "instagram": ["instagram.com", "facebookmail.com", "mail.instagram.com"],
    "whatsapp": ["whatsapp.com"],
    "dropbox": ["dropbox.com", "dropboxmail.com"],
    "docusign": ["docusign.com", "docusign.net"],
}

SUSPICIOUS_TLDS = {
    "xyz", "top", "click", "loan", "work", "gq", "tk", "ml", "cf", "ga",
    "icu", "buzz", "rest", "cam", "monster", "quest", "sbs", "cfd", "bond",
    "zip", "mov", "country", "kim", "men", "date", "win", "bid", "racing",
    "review", "stream", "download", "party", "trade", "science", "cyou",
}

URL_SHORTENERS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
    "cutt.ly", "rebrand.ly", "shorturl.at", "rb.gy", "tiny.cc", "s.id",
}

FREEMAIL_DOMAINS = {
    "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com",
    "hotmail.fr", "live.com", "live.fr", "yahoo.com", "yahoo.fr", "aol.com",
    "icloud.com", "gmx.com", "gmx.fr", "laposte.net", "orange.fr", "free.fr",
    "sfr.fr", "proton.me", "protonmail.com", "mail.com", "yandex.ru",
}

URL_RE = re.compile(r"https?://[^\s\"'<>]+", re.I)
HREF_RE = re.compile(r"<a\b[^>]*href=[\"']?([^\"' >]+)[^>]*>(.*?)</a>", re.I | re.S)
TAG_RE = re.compile(r"<[^>]+>")
IP_HOST_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
EMAIL_IN_TEXT_RE = re.compile(r"[\w.+-]+@([\w-]+\.)+[\w-]+")
DOMAIN_IN_TEXT_RE = re.compile(r"\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b", re.I)


# --------------------------------------------------------------------------
# Utilitaires
# --------------------------------------------------------------------------

def normalize(text: str) -> str:
    """Minuscules, sans accents, espaces compactés."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.replace("’", "'")
    return re.sub(r"\s+", " ", text.lower())


def domain_of(address: str) -> str:
    address = (address or "").strip().lower()
    return address.rsplit("@", 1)[-1] if "@" in address else ""


def host_of(url: str) -> str:
    m = re.match(r"https?://([^/:?#]+)", url, re.I)
    return m.group(1).lower() if m else ""


def belongs_to(domain: str, parents: list[str] | set[str]) -> bool:
    """`mail.paypal.com` appartient à `paypal.com`."""
    domain = domain.lower().rstrip(".")
    return any(domain == p or domain.endswith("." + p) for p in parents)


def registrable(domain: str) -> str:
    """Approximation du domaine principal (ex: news.amazon.fr -> amazon.fr)."""
    parts = domain.lower().strip(".").split(".")
    if len(parts) >= 3 and parts[-2] in {"co", "com", "gouv", "org", "net", "ac"}:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def _has_phrase(text: str, phrase: str) -> bool:
    # Frontières de mots pour éviter "slots" dans "timeslots", "caf" dans "cafe"...
    return re.search(r"(?<![a-z0-9])" + re.escape(phrase) + r"(?![a-z0-9])", text) is not None


def _count_hits(text: str, phrases: list[str]) -> list[str]:
    return [p for p in phrases if _has_phrase(text, p)]


def extract_text(msg: Message) -> tuple[str, str]:
    """Retourne (texte brut, html brut) d'un message, en tolérant les mails tronqués."""
    plain, html = [], []
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        ctype = part.get_content_type()
        if ctype not in ("text/plain", "text/html"):
            continue
        try:
            payload = part.get_payload(decode=True) or b""
            charset = part.get_content_charset() or "utf-8"
            content = payload.decode(charset, errors="replace")
        except (LookupError, ValueError, AssertionError):
            continue
        (html if ctype == "text/html" else plain).append(content)
    html_str = "\n".join(html)
    text = "\n".join(plain)
    if not text and html_str:
        text = unescape(TAG_RE.sub(" ", html_str))
    return text, html_str


# --------------------------------------------------------------------------
# Analyse
# --------------------------------------------------------------------------

@dataclass
class Verdict:
    score: int = 0
    reasons: list[str] = field(default_factory=list)
    categories: set[str] = field(default_factory=set)
    threshold: int = DEFAULT_THRESHOLD

    def add(self, points: int, reason: str, category: str | None = None) -> None:
        self.score += points
        self.reasons.append(f"{points:+d} {reason}")
        if category and points > 0:
            self.categories.add(category)

    @property
    def is_junk(self) -> bool:
        return self.score >= self.threshold

    @property
    def label(self) -> str:
        order = ["phishing", "usurpation", "casino", "arnaque", "adulte", "suspect"]
        cats = [c for c in order if c in self.categories]
        return ", ".join(cats) if cats else "suspect"


def parse_auth_results(msg: Message) -> dict[str, str]:
    """Lit le premier en-tête Authentication-Results (ajouté par TON fournisseur)."""
    header = msg.get("Authentication-Results")
    if not header:
        return {}
    header = str(header).lower()
    results = {}
    for mech in ("spf", "dkim", "dmarc"):
        m = re.search(rf"\b{mech}=(\w+)", header)
        if m:
            results[mech] = m.group(1)
    m = re.search(r"header\.from=([\w.-]+)", header)
    if m:
        results["from_domain"] = m.group(1)
    return results


def analyze(msg: Message, threshold: int = DEFAULT_THRESHOLD) -> Verdict:
    v = Verdict(threshold=threshold)

    display_name, from_addr = parseaddr(str(msg.get("From", "")))
    from_domain = domain_of(from_addr)
    subject = str(msg.get("Subject", "") or "")
    text, html = extract_text(msg)

    n_subject = normalize(subject)
    n_name = normalize(display_name)
    n_all = normalize(f"{subject}\n{text}")[:50000]

    # ---- Authentification de l'expéditeur (SPF / DKIM / DMARC) ----------
    auth = parse_auth_results(msg)
    if auth.get("dmarc") == "fail":
        v.add(4, "DMARC en échec (expéditeur probablement falsifié)", "usurpation")
    if auth.get("spf") == "fail":
        v.add(3, "SPF en échec", "usurpation")
    elif auth.get("spf") == "softfail":
        v.add(1, "SPF douteux (softfail)")
    if auth.get("dkim") == "fail":
        v.add(2, "Signature DKIM invalide", "usurpation")
    if auth.get("dkim") == "pass" and auth.get("dmarc") == "pass":
        v.add(-3, "Expéditeur authentifié (DKIM + DMARC ok)")

    # ---- Usurpation de marque -------------------------------------------
    for brand, domains in BRANDS.items():
        if _has_phrase(n_name, brand) or (
            len(brand) > 3 and _has_phrase(n_subject, brand) and _has_phrase(n_all, brand)
            and _count_hits(n_all, PHISHING_PHRASES)
        ):
            if from_domain and not belongs_to(from_domain, domains):
                v.add(5, f"Se fait passer pour « {brand} » mais écrit depuis {from_domain}", "phishing")
            break

    # Nom affiché contenant une autre adresse/domaine que l'expéditeur réel
    m = EMAIL_IN_TEXT_RE.search(display_name)
    if m and domain_of(m.group(0)) != from_domain:
        v.add(3, "Le nom affiché contient une autre adresse que l'expéditeur réel", "usurpation")

    # Reply-To vers un autre domaine
    reply_to = [a for _, a in getaddresses([str(x) for x in msg.get_all("Reply-To", [])])]
    for addr in reply_to:
        rdom = domain_of(addr)
        if rdom and from_domain and registrable(rdom) != registrable(from_domain):
            pts = 3 if rdom in FREEMAIL_DOMAINS else 1
            v.add(pts, f"Les réponses partent vers un autre domaine ({rdom})")
            break

    # Domaine d'expédition à extension douteuse
    tld = from_domain.rsplit(".", 1)[-1] if from_domain else ""
    if tld in SUSPICIOUS_TLDS:
        v.add(2, f"Extension de domaine souvent utilisée par les spammeurs (.{tld})")

    # ---- Contenu ---------------------------------------------------------
    casino = _count_hits(n_all, CASINO_KEYWORDS)
    if len(casino) >= 2:
        v.add(6, f"Casino / jeux d'argent ({', '.join(casino[:4])})", "casino")
    elif casino:
        v.add(3, f"Mot-clé casino ({casino[0]})", "casino")

    phishing = _count_hits(n_all, PHISHING_PHRASES)
    if phishing:
        v.add(min(2 * len(phishing), 6), f"Formules typiques de phishing ({', '.join(phishing[:3])})", "phishing")

    scam = _count_hits(n_all, SCAM_PHRASES)
    if scam:
        v.add(min(2 * len(scam), 6), f"Formules d'arnaque ({', '.join(scam[:3])})", "arnaque")

    adult = _count_hits(n_all, ADULT_KEYWORDS)
    if adult:
        v.add(4 if len(adult) == 1 else 6, f"Contenu adulte ({', '.join(adult[:3])})", "adulte")

    # ---- Liens -----------------------------------------------------------
    urls = URL_RE.findall(html or text)
    hosts = {host_of(u) for u in urls}
    if any(IP_HOST_RE.match(h) for h in hosts):
        v.add(3, "Lien vers une adresse IP brute", "phishing")
    if hosts & URL_SHORTENERS:
        v.add(1, "Lien raccourci (destination masquée)")
    if any(h.rsplit(".", 1)[-1] in SUSPICIOUS_TLDS for h in hosts if "." in h):
        v.add(1, "Lien vers un domaine à extension douteuse")

    for href, anchor in HREF_RE.findall(html)[:200]:
        anchor_txt = unescape(TAG_RE.sub("", anchor)).strip().lower()
        shown = DOMAIN_IN_TEXT_RE.search(anchor_txt)
        real = host_of(href)
        if shown and real and "." in shown.group(1) and anchor_txt.startswith(("http", "www", shown.group(1))):
            if registrable(shown.group(1)) != registrable(real):
                v.add(3, f"Lien trompeur : affiche {shown.group(1)} mais mène à {real}", "phishing")
                break

    # ---- Forme du sujet --------------------------------------------------
    letters = [c for c in subject if c.isalpha()]
    if len(letters) >= 12 and sum(c.isupper() for c in letters) / len(letters) > 0.8:
        v.add(1, "Sujet entièrement en majuscules")
    if subject.count("!") >= 3 or any(e in subject for e in "💰🎰🎁🤑💸🔥🎉"):
        v.add(1, "Sujet racoleur (!!!, émojis argent)")

    return v
