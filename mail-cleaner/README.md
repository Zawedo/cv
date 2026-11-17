# 🧹 Mail Cleaner

Supprime automatiquement les mails **indésirables** de ta boîte mail : spam, **phishing**, **casino / paris**, arnaques (loterie, faux colis, faux remboursements…), contenu adulte.

- Marche avec **Gmail**, Yahoo, iCloud, Orange, Free, SFR, La Poste, GMX… (tout fournisseur IMAP)
- **Rien à installer** à part Python 3.9 ou plus récent (aucune dépendance)
- **Sans danger par défaut** : la première fois, l'outil montre seulement ce qu'il supprimerait
- Les mails vont à la **corbeille**, ils restent récupérables (30 jours sur Gmail)
- Tes vrais contacts sont protégés : **toute personne à qui tu as déjà écrit n'est jamais supprimée**, de même que les mails **suivis** (étoile ⭐ ou drapeau)
- Tes identifiants ne sont **jamais enregistrés** : la connexion se fait directement entre ton ordinateur et ton fournisseur

## Ce qu'il fait

1. **Vide le dossier Spam / Indésirables** (en gardant les mails de tes contacts, qui sont sûrement des faux positifs).
2. **Analyse ta boîte de réception** et calcule un score pour chaque mail :

| Signal | Exemples |
|---|---|
| Expéditeur falsifié | échec SPF / DKIM / DMARC |
| Usurpation de marque | « PayPal » qui écrit depuis `paypal-verif.xyz`, faux Ameli, Impôts, Colissimo, banques… |
| Phishing | « votre compte a été suspendu », « vérifiez votre compte », « frais de livraison »… |
| Liens piégés | lien qui affiche `paypal.com` mais mène ailleurs, lien vers une adresse IP |
| Casino / paris | free spins, bonus de bienvenue, jackpot, machines à sous… |
| Arnaques | loterie, héritage, Western Union, cartes cadeaux, crypto miracle… |
| Adulte | viagra, rencontres coquines… |

À partir d'un score de **6**, le mail est considéré comme indésirable.

## Installation

1. Installe Python : https://www.python.org/downloads/ (sous Windows, coche « Add Python to PATH »).
2. Télécharge ce dossier `mail-cleaner`.
3. Ouvre un terminal dans ce dossier.

## Étape obligatoire pour Gmail : le mot de passe d'application

Gmail refuse ton mot de passe habituel pour ce type d'outil. Il faut un **mot de passe d'application** :

1. Active la **validation en deux étapes** : https://myaccount.google.com/security
2. Crée un mot de passe d'application : https://myaccount.google.com/apppasswords (nomme-le « Mail Cleaner »)
3. Google affiche 16 lettres : c'est ce mot de passe que tu donneras à l'outil.
4. Vérifie qu'IMAP est actif : Gmail → ⚙️ → Voir tous les paramètres → Transfert et POP/IMAP → **Activer IMAP**.

Tu peux supprimer ce mot de passe d'application à tout moment pour couper l'accès.

> **Yahoo / iCloud / Orange / Free** : même principe. Crée un « mot de passe d'application » dans les paramètres de sécurité de ton compte.
> **Outlook / Hotmail** : Microsoft n'accepte plus la connexion par mot de passe en IMAP, donc l'outil ne fonctionne pas avec ces comptes pour l'instant.

## Utilisation

```bash
# 1) Simulation : affiche ce qui serait supprimé, ne touche à rien
python -m mail_cleaner

# 2) Suppression réelle (vers la corbeille), avec confirmation
python -m mail_cleaner --apply
```

L'outil demande ton adresse et ton mot de passe d'application. Le serveur IMAP est trouvé tout seul pour les fournisseurs courants.

### Options utiles

| Option | Effet |
|---|---|
| `--days 365` | analyse la boîte de réception sur 1 an (défaut : 90 jours, `0` = tout) |
| `--threshold 8` | plus prudent (moins de suppressions) ; `5` = plus strict |
| `-v` | montre pourquoi chaque mail est jugé indésirable |
| `--report rapport.csv` | enregistre la liste dans un fichier (ouvrable dans Excel) |
| `--skip-spam-folder` | ne vide pas le dossier Spam |
| `--skip-inbox` | vide seulement le dossier Spam |
| `--yes` | pas de confirmation (pour une exécution automatique) |

### Listes blanche et noire

- Copie `whitelist.example.txt` en `whitelist.txt` : expéditeurs ou domaines à **ne jamais** supprimer.
- Copie `blacklist.example.txt` en `blacklist.txt` : expéditeurs ou domaines à **toujours** supprimer.

## Lancer le nettoyage automatiquement chaque jour

Garde les identifiants dans des variables d'environnement (`MAIL_ADDRESS`, `MAIL_PASSWORD`).

**Mac / Linux** (`crontab -e`), tous les jours à 8 h :

```
0 8 * * * cd /chemin/vers/mail-cleaner && MAIL_ADDRESS=toi@gmail.com MAIL_PASSWORD=xxxx python3 -m mail_cleaner --apply --yes --days 7
```

**Windows** : Planificateur de tâches → Créer une tâche de base → programme `python`, arguments `-m mail_cleaner --apply --yes --days 7`, dossier de départ `mail-cleaner`.

## Partager l'outil

Chaque personne utilise **son propre** mot de passe d'application : il suffit de lui envoyer le dossier `mail-cleaner` (ou le lien du dépôt). Aucun serveur, aucun compte à créer, aucune donnée ne passe par un tiers.

## Tests

```bash
python -m unittest discover -s tests
```
