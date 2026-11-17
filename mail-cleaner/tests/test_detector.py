import unittest
from email.message import EmailMessage

from mail_cleaner.cli import is_trusted
from mail_cleaner.detector import analyze


def make(sender, subject, body, html=None, auth=None, reply_to=None):
    m = EmailMessage()
    m["From"] = sender
    m["To"] = "moi@gmail.com"
    m["Subject"] = subject
    if auth:
        m["Authentication-Results"] = auth
    if reply_to:
        m["Reply-To"] = reply_to
    m.set_content(body)
    if html:
        m.add_alternative(html, subtype="html")
    return m


PASS = "mx.google.com; dkim=pass header.i=@x; spf=pass; dmarc=pass header.from=x"
FAIL = "mx.google.com; dkim=fail; spf=fail; dmarc=fail (p=REJECT) header.from=paypal.com"


class JunkTests(unittest.TestCase):
    def test_paypal_phishing(self):
        v = analyze(make(
            '"PayPal Service" <secure@paypal-verif.xyz>',
            "Votre compte a été suspendu",
            "Activité inhabituelle détectée. Vérifiez votre compte sous 24h.",
            html='<a href="http://185.22.1.4/login">https://www.paypal.com</a>',
        ))
        self.assertTrue(v.is_junk, v.reasons)
        self.assertIn("phishing", v.categories)

    def test_spoofed_sender_dmarc_fail(self):
        v = analyze(make("PayPal <service@paypal.com>", "Facture", "Voir la pièce jointe.", auth=FAIL))
        self.assertTrue(v.is_junk, v.reasons)

    def test_casino(self):
        v = analyze(make(
            "Lucky Club <promo@lucky-club.top>",
            "🎰 200 FREE SPINS + bonus de bienvenue !!!",
            "Rejoignez notre casino en ligne, jackpot garanti.",
        ))
        self.assertTrue(v.is_junk, v.reasons)
        self.assertIn("casino", v.categories)

    def test_colis_scam(self):
        v = analyze(make(
            "Colissimo <noreply@suivi-livraison-fr.com>",
            "Votre colis est en attente",
            "Des frais de livraison de 1,99€ sont à régler. Cliquez ici pour payer.",
        ))
        self.assertTrue(v.is_junk, v.reasons)

    def test_lottery_scam(self):
        v = analyze(make(
            "Mr Johnson <johnson.lawyer@gmail.com>",
            "Félicitations vous avez gagné",
            "Vous avez gagné à la loterie internationale. Envoyez vos frais par Western Union.",
            reply_to="claims@yahoo.com",
        ))
        self.assertTrue(v.is_junk, v.reasons)


class LegitTests(unittest.TestCase):
    def test_friend(self):
        v = analyze(make("Julie <julie.martin@gmail.com>", "Resto samedi ?",
                         "Salut, ça te dit un resto samedi soir ?", auth=PASS))
        self.assertFalse(v.is_junk, v.reasons)

    def test_real_amazon(self):
        v = analyze(make("Amazon.fr <confirmation-commande@amazon.fr>",
                         "Votre commande a été expédiée",
                         "Votre colis arrivera jeudi. Suivre votre colis sur amazon.fr.",
                         auth=PASS))
        self.assertFalse(v.is_junk, v.reasons)

    def test_newsletter(self):
        v = analyze(make("Le Monde <newsletter@lemonde.fr>", "La matinale du jour",
                         "Les principales informations de ce mardi.", auth=PASS))
        self.assertFalse(v.is_junk, v.reasons)

    def test_word_boundaries(self):
        # "slots" dans "timeslots", "caf" dans "café" ne doivent pas déclencher
        v = analyze(make("Café du coin <contact@cafeducoin.fr>", "Nouveaux timeslots",
                         "Réservez vos créneaux (timeslots) au café.", auth=PASS))
        self.assertFalse(v.is_junk, v.reasons)


class TrustTests(unittest.TestCase):
    def test_whitelist(self):
        wl = {"mabanque.fr", "@ecole.fr", "maman@gmail.com"}
        self.assertTrue(is_trusted("info@news.mabanque.fr", wl, set()))
        self.assertTrue(is_trusted("prof@ecole.fr", wl, set()))
        self.assertTrue(is_trusted("maman@gmail.com", wl, set()))
        self.assertFalse(is_trusted("inconnu@gmail.com", wl, set()))
        self.assertTrue(is_trusted("ami@free.fr", set(), {"ami@free.fr"}))


if __name__ == "__main__":
    unittest.main()
