"""Connexion IMAP : repère les dossiers (Spam, Corbeille, Envoyés) quelle que
soit la langue du compte, lit les mails et les déplace vers la corbeille."""

from __future__ import annotations

import email
import imaplib
import re
from dataclasses import dataclass
from datetime import date, timedelta
from email import policy
from email.message import Message
from email.utils import getaddresses, parseaddr

if "MOVE" not in imaplib.Commands:  # anciennes versions de Python
    imaplib.Commands["MOVE"] = ("SELECTED",)

# Domaine de l'adresse -> serveur IMAP
KNOWN_SERVERS = {
    "gmail.com": "imap.gmail.com",
    "googlemail.com": "imap.gmail.com",
    "yahoo.com": "imap.mail.yahoo.com",
    "yahoo.fr": "imap.mail.yahoo.com",
    "icloud.com": "imap.mail.me.com",
    "me.com": "imap.mail.me.com",
    "mac.com": "imap.mail.me.com",
    "orange.fr": "imap.orange.fr",
    "wanadoo.fr": "imap.orange.fr",
    "free.fr": "imap.free.fr",
    "sfr.fr": "imap.sfr.fr",
    "neuf.fr": "imap.sfr.fr",
    "laposte.net": "imap.laposte.net",
    "gmx.fr": "imap.gmx.net",
    "gmx.com": "imap.gmx.net",
    "aol.com": "imap.aol.com",
    "outlook.com": "outlook.office365.com",
    "hotmail.com": "outlook.office365.com",
    "hotmail.fr": "outlook.office365.com",
    "live.fr": "outlook.office365.com",
    "live.com": "outlook.office365.com",
}

# Noms de secours si le serveur n'annonce pas les attributs SPECIAL-USE
FALLBACK_NAMES = {
    "junk": ["[Gmail]/Spam", "Spam", "Junk", "Junk E-mail", "Courrier indésirable",
             "Bulk Mail", "QUARANTAINE", "INBOX.Spam", "INBOX.Junk"],
    "trash": ["[Gmail]/Trash", "[Gmail]/Corbeille", "Trash", "Corbeille",
              "Deleted Items", "Deleted Messages", "Éléments supprimés", "INBOX.Trash"],
    "sent": ["[Gmail]/Sent Mail", "[Gmail]/Messages envoy&AOk-s", "Sent",
             "Sent Messages", "Sent Items", "Envoy&AOk-s", "&AMk-l&AOk-ments envoy&AOk-s",
             "INBOX.Sent", "OUTBOX"],
}
SPECIAL_USE = {"junk": "\\junk", "trash": "\\trash", "sent": "\\sent"}

LIST_RE = re.compile(r'\((?P<flags>[^)]*)\)\s+(?P<delim>"[^"]*"|NIL)\s+(?P<name>.+)$')


def guess_server(address: str) -> str | None:
    return KNOWN_SERVERS.get(address.rsplit("@", 1)[-1].lower())


@dataclass
class MailItem:
    uid: bytes
    msg: Message
    flags: str

    @property
    def sender(self) -> str:
        return parseaddr(str(self.msg.get("From", "")))[1].lower()

    @property
    def subject(self) -> str:
        return str(self.msg.get("Subject", "") or "(sans sujet)").replace("\n", " ")

    @property
    def flagged(self) -> bool:
        return "\\flagged" in self.flags.lower()


class Mailbox:
    def __init__(self, server: str, address: str, password: str, port: int = 993):
        self.conn = imaplib.IMAP4_SSL(server, port)
        self.conn.login(address, password)
        self._folders = self._list_folders()

    # -- dossiers ----------------------------------------------------------
    def _list_folders(self) -> list[tuple[str, str]]:
        typ, data = self.conn.list()
        folders = []
        for raw in data or []:
            if not isinstance(raw, bytes):
                continue
            m = LIST_RE.match(raw.decode("utf-8", "replace"))
            if m:
                name = m.group("name").strip()
                if name.startswith('"') and name.endswith('"'):
                    name = name[1:-1]
                folders.append((m.group("flags").lower(), name))
        return folders

    def find_folder(self, kind: str) -> str | None:
        for flags, name in self._folders:
            if SPECIAL_USE[kind] in flags.split():
                return name
        names = {n.lower(): n for _, n in self._folders}
        for candidate in FALLBACK_NAMES[kind]:
            if candidate.lower() in names:
                return names[candidate.lower()]
        return None

    def select(self, folder: str, readonly: bool) -> int:
        typ, data = self.conn.select(f'"{folder}"', readonly=readonly)
        if typ != "OK":
            raise RuntimeError(f"Impossible d'ouvrir le dossier {folder}: {data}")
        return int(data[0] or 0)

    # -- lecture -----------------------------------------------------------
    def search(self, since_days: int | None) -> list[bytes]:
        if since_days:
            since = (date.today() - timedelta(days=since_days)).strftime("%d-%b-%Y")
            typ, data = self.conn.uid("SEARCH", None, "SINCE", since)
        else:
            typ, data = self.conn.uid("SEARCH", None, "ALL")
        return data[0].split() if typ == "OK" and data and data[0] else []

    def fetch(self, uids: list[bytes], max_bytes: int = 65536, batch: int = 50):
        """Lit les mails par paquets, sans les marquer comme lus (BODY.PEEK)."""
        for i in range(0, len(uids), batch):
            chunk = b",".join(uids[i:i + batch])
            flags = {}
            typ, data = self.conn.uid("FETCH", chunk, "(FLAGS)")
            for line in data or []:
                if isinstance(line, bytes):
                    mu = re.search(rb"UID (\d+)", line)
                    mf = re.search(rb"FLAGS \(([^)]*)\)", line)
                    if mu:
                        flags[mu.group(1)] = (mf.group(1) if mf else b"").decode()
            typ, data = self.conn.uid("FETCH", chunk, f"(BODY.PEEK[]<0.{max_bytes}>)")
            for part in data or []:
                if not isinstance(part, tuple):
                    continue
                mu = re.search(rb"UID (\d+)", part[0])
                if not mu:
                    continue
                try:
                    msg = email.message_from_bytes(part[1], policy=policy.compat32)
                except Exception:  # mail illisible : on l'ignore
                    continue
                yield MailItem(mu.group(1), msg, flags.get(mu.group(1), ""))

    def sent_contacts(self, limit: int = 1000) -> set[str]:
        """Adresses auxquelles tu as déjà écrit : elles ne seront jamais supprimées."""
        sent = self.find_folder("sent")
        if not sent:
            return set()
        try:
            self.select(sent, readonly=True)
        except RuntimeError:
            return set()
        uids = self.search(None)[-limit:]
        contacts: set[str] = set()
        for i in range(0, len(uids), 200):
            chunk = b",".join(uids[i:i + 200])
            typ, data = self.conn.uid("FETCH", chunk, "(BODY.PEEK[HEADER.FIELDS (TO CC)])")
            for part in data or []:
                if isinstance(part, tuple):
                    hdr = email.message_from_bytes(part[1])
                    values = [str(x) for x in hdr.get_all("To", []) + hdr.get_all("Cc", [])]
                    contacts.update(a.lower() for _, a in getaddresses(values) if "@" in a)
        return contacts

    # -- suppression -------------------------------------------------------
    def move_to_trash(self, uids: list[bytes], trash: str) -> int:
        if not uids:
            return 0
        moved = 0
        caps = {c.upper() for c in self.conn.capabilities}
        for i in range(0, len(uids), 100):
            chunk = b",".join(uids[i:i + 100])
            if "MOVE" in caps:
                typ, _ = self.conn.uid("MOVE", chunk, f'"{trash}"')
            else:
                typ, _ = self.conn.uid("COPY", chunk, f'"{trash}"')
                if typ == "OK":
                    self.conn.uid("STORE", chunk, "+FLAGS.SILENT", "(\\Deleted)")
                    self.conn.expunge()
            if typ == "OK":
                moved += len(uids[i:i + 100])
        return moved

    def close(self) -> None:
        try:
            self.conn.logout()
        except Exception:
            pass
