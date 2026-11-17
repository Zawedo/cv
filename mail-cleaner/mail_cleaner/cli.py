"""Mail Cleaner : supprime les spams, le phishing, les mails de casino et les arnaques.

Usage rapide :
    python -m mail_cleaner                # simulation : rien n'est supprimé
    python -m mail_cleaner --apply        # supprime (vers la corbeille) après confirmation
"""

from __future__ import annotations

import argparse
import csv
import getpass
import imaplib
import os
import sys
from pathlib import Path

from .detector import DEFAULT_THRESHOLD, analyze, belongs_to, domain_of
from .imap_client import Mailbox, guess_server


def load_list(path: Path) -> set[str]:
    if not path.exists():
        return set()
    entries = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.split("#", 1)[0].strip().lower()
        if line:
            entries.add(line)
    return entries


def is_trusted(sender: str, whitelist: set[str], contacts: set[str]) -> bool:
    if not sender:
        return False
    if sender in whitelist or sender in contacts:
        return True
    domains = {e.lstrip("@") for e in whitelist if "@" not in e or e.startswith("@")}
    return belongs_to(domain_of(sender), domains)


def short(text: str, n: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        prog="mail-cleaner",
        description="Supprime les mails indésirables : spam, phishing, casino, arnaques.",
    )
    p.add_argument("--email", default=os.environ.get("MAIL_ADDRESS"), help="ton adresse mail")
    p.add_argument("--server", default=os.environ.get("MAIL_IMAP_SERVER"),
                   help="serveur IMAP (deviné automatiquement pour Gmail, Yahoo, Orange, Free…)")
    p.add_argument("--port", type=int, default=993)
    p.add_argument("--apply", action="store_true",
                   help="supprime vraiment (sinon simulation)")
    p.add_argument("--yes", "-y", action="store_true",
                   help="ne pas demander de confirmation (pour une exécution automatique)")
    p.add_argument("--days", type=int, default=90,
                   help="analyse la boîte de réception sur N jours (0 = tout ; défaut 90)")
    p.add_argument("--threshold", type=int, default=DEFAULT_THRESHOLD,
                   help=f"score à partir duquel un mail est supprimé (défaut {DEFAULT_THRESHOLD} ; "
                        "plus haut = plus prudent)")
    p.add_argument("--skip-spam-folder", action="store_true",
                   help="ne pas vider le dossier Spam / Indésirables")
    p.add_argument("--skip-inbox", action="store_true",
                   help="ne pas analyser la boîte de réception")
    p.add_argument("--whitelist", type=Path, default=Path("whitelist.txt"),
                   help="fichier d'expéditeurs/domaines à ne jamais supprimer")
    p.add_argument("--blacklist", type=Path, default=Path("blacklist.txt"),
                   help="fichier d'expéditeurs/domaines à toujours supprimer")
    p.add_argument("--report", type=Path, help="enregistre le rapport en CSV")
    p.add_argument("--verbose", "-v", action="store_true", help="affiche le détail des scores")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    print("🧹 Mail Cleaner — nettoyage des mails indésirables\n")
    address = args.email or input("Adresse mail : ").strip()
    server = args.server or guess_server(address)
    if not server:
        server = input("Serveur IMAP (ex. imap.monfournisseur.fr) : ").strip()
    password = os.environ.get("MAIL_PASSWORD") or getpass.getpass(
        "Mot de passe d'application (rien ne s'affiche, c'est normal) : ")

    try:
        box = Mailbox(server, address, password, args.port)
    except imaplib.IMAP4.error as e:
        print(f"\n❌ Connexion refusée : {e}")
        print("   Pour Gmail, il faut un « mot de passe d'application » (voir README), "
              "pas ton mot de passe habituel.")
        return 2
    except OSError as e:
        print(f"\n❌ Impossible de joindre {server}:{args.port} — {e}")
        return 2

    whitelist = load_list(args.whitelist)
    blacklist = load_list(args.blacklist)
    trash = box.find_folder("trash")
    junk = box.find_folder("junk")
    if not trash:
        print("❌ Dossier Corbeille introuvable : arrêt par sécurité.")
        return 3

    print(f"✅ Connecté à {address}")
    print("   Lecture de tes mails envoyés pour protéger tes vrais contacts…")
    contacts = box.sent_contacts()
    contacts.discard(address.lower())
    print(f"   {len(contacts)} contacts protégés, {len(whitelist)} entrées en liste blanche.\n")

    rows: list[dict] = []        # pour le rapport
    plan: dict[str, list] = {}   # dossier -> uids à supprimer

    # 1) Dossier Spam : tout part, sauf les expéditeurs de confiance
    if junk and not args.skip_spam_folder:
        n = box.select(junk, readonly=not args.apply)
        print(f"📂 {junk} : {n} mail(s)")
        uids = box.search(None)
        selected = []
        for item in box.fetch(uids):
            if is_trusted(item.sender, whitelist, contacts):
                print(f"   ⚠️  Gardé (contact de confiance, sûrement un faux positif) : "
                      f"{item.sender} — {short(item.subject, 50)}")
                continue
            selected.append(item.uid)
            rows.append({"dossier": junk, "expediteur": item.sender, "sujet": item.subject,
                         "score": "", "categorie": "dossier spam", "raisons": ""})
        plan[junk] = selected
    elif not junk and not args.skip_spam_folder:
        print("ℹ️  Aucun dossier Spam trouvé.")

    # 2) Boîte de réception : analyse mail par mail
    if not args.skip_inbox:
        n = box.select("INBOX", readonly=not args.apply)
        uids = box.search(args.days or None)
        period = f"{args.days} derniers jours" if args.days else "tout l'historique"
        print(f"\n📥 Boîte de réception : analyse de {len(uids)} mail(s) ({period})…")
        selected = []
        for idx, item in enumerate(box.fetch(uids), 1):
            if idx % 200 == 0:
                print(f"   … {idx}/{len(uids)}")
            if item.flagged or is_trusted(item.sender, whitelist, contacts):
                continue
            sender_dom = domain_of(item.sender)
            if item.sender in blacklist or belongs_to(sender_dom, {b.lstrip("@") for b in blacklist}):
                selected.append(item.uid)
                rows.append({"dossier": "INBOX", "expediteur": item.sender, "sujet": item.subject,
                             "score": "", "categorie": "liste noire", "raisons": ""})
                continue
            verdict = analyze(item.msg, args.threshold)
            if verdict.is_junk:
                selected.append(item.uid)
                rows.append({"dossier": "INBOX", "expediteur": item.sender, "sujet": item.subject,
                             "score": verdict.score, "categorie": verdict.label,
                             "raisons": " | ".join(verdict.reasons)})
                print(f"   🚫 [{verdict.label}] score {verdict.score} — "
                      f"{short(item.sender, 35)} — {short(item.subject, 60)}")
                if args.verbose:
                    for r in verdict.reasons:
                        print(f"        {r}")
        plan["INBOX"] = selected

    total = sum(len(v) for v in plan.values())
    print(f"\n📊 Résultat : {total} mail(s) indésirable(s) détecté(s)")
    for folder, uids in plan.items():
        print(f"   - {folder} : {len(uids)}")

    if args.report:
        with args.report.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=["dossier", "expediteur", "sujet", "score",
                                              "categorie", "raisons"], delimiter=";")
            w.writeheader()
            w.writerows(rows)
        print(f"   Rapport enregistré : {args.report}")

    if not total:
        print("\n✨ Rien à nettoyer.")
        box.close()
        return 0

    if not args.apply:
        print("\n🔍 Simulation uniquement : aucun mail n'a été touché.")
        print("   Relance avec --apply pour les envoyer à la corbeille.")
        box.close()
        return 0

    if not args.yes:
        answer = input(f"\nEnvoyer ces {total} mails à la corbeille ({trash}) ? [o/N] ")
        if answer.strip().lower() not in ("o", "oui", "y", "yes"):
            print("Annulé, rien n'a été supprimé.")
            box.close()
            return 0

    moved = 0
    for folder, uids in plan.items():
        if uids:
            box.select(folder, readonly=False)
            moved += box.move_to_trash(uids, trash)
    print(f"\n🗑️  {moved} mail(s) envoyé(s) à la corbeille. "
          "Ils restent récupérables (30 jours sur Gmail).")
    box.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
