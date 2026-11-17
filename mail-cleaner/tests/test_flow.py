"""Test de bout en bout avec un faux serveur IMAP (aucun vrai compte utilisé)."""
import unittest
from email.message import EmailMessage
from unittest import mock

from mail_cleaner import cli


def raw(sender, subject, body):
    m = EmailMessage()
    m["From"], m["Subject"] = sender, subject
    m.set_content(body)
    return m.as_bytes()


class FakeIMAP:
    def __init__(self, *a):
        self.capabilities = ("IMAP4REV1", "MOVE")
        self.boxes = {
            "INBOX": {b"1": raw("Julie <julie@gmail.com>", "Salut", "On se voit demain ?"),
                      b"2": raw("Casino Royal <win@casino-royal.top>", "FREE SPINS",
                                "Bonus de bienvenue au casino, jackpot !")},
            "[Gmail]/Spam": {b"7": raw("x@spam.biz", "Promo", "achetez"),
                             b"8": raw("ami@free.fr", "Photos", "voici les photos")},
            "[Gmail]/Sent Mail": {b"3": b"To: ami@free.fr\r\n\r\n"},
            "[Gmail]/Trash": {},
        }
        self.cur = None
        self.moved = []

    def login(self, *a): return "OK", [b""]
    def authenticate(self, mech, cb):
        self.auth = (mech, cb(b""))
        return "OK", [b""]
    def logout(self): pass
    def list(self):
        return "OK", [b'(\\HasNoChildren) "/" "INBOX"',
                      b'(\\HasNoChildren \\Junk) "/" "[Gmail]/Spam"',
                      b'(\\HasNoChildren \\Sent) "/" "[Gmail]/Sent Mail"',
                      b'(\\HasNoChildren \\Trash) "/" "[Gmail]/Trash"']
    def select(self, name, readonly=False):
        self.cur = name.strip('"')
        return "OK", [str(len(self.boxes[self.cur])).encode()]
    def uid(self, cmd, *args):
        box = self.boxes[self.cur]
        if cmd == "SEARCH":
            return "OK", [b" ".join(box)]
        if cmd == "FETCH":
            ids = args[0].split(b",")
            if args[1] == "(FLAGS)":
                return "OK", [b"1 (UID %s FLAGS (\\Seen))" % i for i in ids]
            out = []
            for i in ids:
                out += [(b"1 (UID %s BODY[] {10}" % i, box[i]), b")"]
            return "OK", out
        if cmd == "MOVE":
            self.moved.append((self.cur, sorted(args[0].split(b","))))
            return "OK", [b""]
        raise AssertionError(cmd)


class FlowTest(unittest.TestCase):
    def run_cli(self, *argv):
        fake = FakeIMAP()
        with mock.patch("imaplib.IMAP4_SSL", return_value=fake), \
             mock.patch.dict("os.environ", {"MAIL_PASSWORD": "x"}), \
             mock.patch("builtins.print"):
            code = cli.main(["--email", "moi@gmail.com", "--whitelist", "/nonexistent", *argv])
        return code, fake

    def test_dry_run_touches_nothing(self):
        code, fake = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual(fake.moved, [])

    def test_apply(self):
        code, fake = self.run_cli("--apply", "--yes")
        self.assertEqual(code, 0)
        # spam vidé sauf le contact ami@free.fr, casino supprimé, Julie gardée
        self.assertEqual(fake.moved, [("[Gmail]/Spam", [b"7"]), ("INBOX", [b"2"])])

    def test_outlook_oauth(self):
        fake = FakeIMAP()
        fake.boxes["Junk"] = fake.boxes.pop("[Gmail]/Spam")
        fake.boxes["Deleted"] = fake.boxes.pop("[Gmail]/Trash")
        fake.boxes["Sent"] = fake.boxes.pop("[Gmail]/Sent Mail")
        fake.list = lambda: ("OK", [b'(\\HasNoChildren) "/" INBOX',
                                    b'(\\HasNoChildren \\Junk) "/" Junk',
                                    b'(\\HasNoChildren \\Sent) "/" Sent',
                                    b'(\\HasNoChildren \\Trash) "/" Deleted'])
        with mock.patch("imaplib.IMAP4_SSL", return_value=fake) as ssl, \
             mock.patch("mail_cleaner.cli.get_access_token", return_value="TOK"), \
             mock.patch("builtins.print"):
            code = cli.main(["--email", "moi@outlook.com", "--ms-client-id", "abc",
                             "--whitelist", "/nonexistent", "--apply", "--yes"])
        self.assertEqual(code, 0)
        ssl.assert_called_with("outlook.office365.com", 993)
        self.assertEqual(fake.auth, ("XOAUTH2", b"user=moi@outlook.com\x01auth=Bearer TOK\x01\x01"))
        self.assertEqual(fake.moved, [("Junk", [b"7"]), ("INBOX", [b"2"])])


if __name__ == "__main__":
    unittest.main()
