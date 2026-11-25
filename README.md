# Winamax LoL Pronos

Concours interne de pronostics League of Legends, **réservé aux collaborateurs Winamax**.
Tous les matchs des ligues majeures (**LCK, LPL, LEC, LCS**) et des tournois internationaux (**MSI, Worlds**), les tableaux des phases finales, un classement général et par compétition.

## Fonctionnalités

- **Accès restreint** : connexion par lien magique envoyé par email, uniquement pour les domaines autorisés (`@winamax.fr`, `@winamax.com` par défaut). Pas de mot de passe.
- **Pronos** sur chaque match : on choisit le score (2-0, 2-1, 1-2… selon le BO). Modifiable jusqu'au coup d'envoi, verrouillé côté serveur ensuite.
- **Barème** (`src/lib/scoring.ts`) :
  | | BO1 | BO3 | BO5 |
  |---|---|---|---|
  | Bon vainqueur | 10 | 10 | 10 |
  | Bonus score exact | – | +5 | +10 |
- **Tableaux MSI / Worlds** (`src/lib/bracket.ts`) : avant le premier match de la phase finale, chacun remplit tout le tableau (élimination directe à 8 pour les Worlds, double élimination à 8 pour le MSI). Changer un vainqueur efface les choix qui en dépendaient. Points par bon vainqueur : 10 aux premiers tours, 20 pour les finales intermédiaires (demies des Worlds, finales gagnants/perdants du MSI), 40 pour le champion (max 120 aux Worlds, 190 au MSI). Inclus dans le classement général et dans les onglets MSI / Worlds.
- **Logos des équipes** récupérés depuis Leaguepedia pendant la synchro et servis par `/api/logo` (Leaguepedia bloque l'affichage direct depuis un autre site). Monogramme en repli.
- **Bonus contre la majorité** (`src/lib/scoring.ts`) : si ton vainqueur est le bon et que 35 % ou moins des joueurs l'avaient choisi, tes points du match sont multipliés par 1,5 ; sous 20 %, par 2 (à partir de 5 pronos sur le match, arrondi à l'entier). La répartition est figée au coup d'envoi ; avant, la carte indique le bonus possible « pour l'instant ». Pas de bonus sur les tableaux.
- **Rappels Slack** (`src/lib/reminders.ts`, `src/lib/reminders-run.ts`) :
  - en message privé (bot) : environ 1 h avant un match non pronostiqué, 3 h avant la fermeture d'un tableau incomplet. Seulement les joueurs actifs ces 30 derniers jours, désactivable dans le profil. Le compte Slack est retrouvé via l'email Winamax ;
  - sur une chaîne : programme du jour à 9 h (Paris), classement du lundi avec le coup d'outsider de la semaine, ouverture des tableaux MSI / Worlds ;
  - chaque rappel est tracé (`ReminderLog`) et n'est jamais envoyé deux fois.
- **Classements par période** (`src/lib/periods.ts`) : général, par mois et par split, combinables avec le filtre par ligue, avec navigation vers les périodes passées. Splits (heure de Paris) : Split 1 du 1er janvier, Split 2 du 1er avril (MSI inclus), Split 3 du 21 juillet, Worlds du 1er octobre — à ajuster dans `SPLITS` si le calendrier change. Les points des tableaux comptent dans la période où le tableau a fermé.
- **Pronos des autres** : visibles sur la carte d'un match une fois commencé, et sur la page de chaque joueur (`/joueurs/[id]`, accessible depuis le classement). Les pronos des matchs à venir restent secrets.
- **Badges** (`src/lib/badges.ts`) : 15 badges calculés à partir de l'activité (participation, séries, scores exacts, bonus outsider, ligues, tableaux, champion du mois, podium de split), avec progression pour ceux pas encore obtenus.
- **Tendance de la communauté** (% par équipe), visible une fois qu'on a pronostiqué, pour ne pas influencer.
- **Classement** général et par ligue, avec podium. Départage : points, puis scores exacts, puis bons vainqueurs.
- **Mes pronos** : historique et statistiques personnelles.
- **Admin** (emails dans `ADMIN_EMAILS`) : synchro manuelle, ajout de matchs, correction de résultats (recalcul automatique des points).

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind · Prisma (SQLite en local).

## Démarrer en local

```bash
npm install
cp .env.example .env        # puis ajuster si besoin
npx prisma db push          # crée la base SQLite
npm run db:seed             # optionnel : 8 joueurs et 48 matchs de démo
npm run dev
```

Sans `SMTP_URL`, le lien de connexion s'affiche dans la console et sur la page de login (dev uniquement).
Ajoute ton email dans `ADMIN_EMAILS` pour accéder à `/admin`.

Tests : `npm test` (barème, mapping des données).

## Données des matchs

Le calendrier et les résultats viennent de l'API publique **Leaguepedia** (`src/lib/providers/leaguepedia.ts`, sans clé).
La synchro récupère J-14 → J+30 et, dans l'ordre :
1. met à jour les matchs (qualifications et promotions exclues, play-in des Worlds inclus) et recalcule les points ;
2. construit les tableaux MSI / Worlds dès que les 8 équipes du premier tour sont connues (verrouillage au premier match), puis les résultats ;
3. récupère les logos manquants.

Testé sur les vraies données 2026 : 325 matchs, tableaux MSI 2026 (champion Hanwha Life Esports) et Worlds 2026 (champion Bilibili Gaming), 47 logos sur 49.

- Manuel : bouton dans `/admin`, ou `npm run sync`.
- Rappels : `GET /api/cron/reminders`, même authentification, toutes les 15 min après la synchro.
- Automatique : `GET /api/cron/sync` avec l'en-tête `Authorization: Bearer $CRON_SECRET` (16 caractères minimum).
  Le workflow `.github/workflows/sync.yml` l'appelle toutes les 15 min dès que les secrets `APP_URL` et `CRON_SECRET` sont définis dans le dépôt.

Un match corrigé à la main dans l'admin n'est plus écrasé par la synchro.

Hébergeurs à autoriser si le serveur a un pare-feu sortant : `lol.fandom.com` (API) et `static.wikia.nocookie.net` (logos).
Pour brancher une autre source (API officielle, PandaScore…), il suffit d'implémenter l'interface `MatchProvider` (`src/lib/providers/types.ts`).

## Brancher Slack

1. Créer une app Slack dans l'espace Winamax (api.slack.com/apps), ajouter les scopes bot `chat:write`, `users:read`, `users:read.email`, l'installer, et copier le jeton `xoxb-…` dans `SLACK_BOT_TOKEN`.
2. Pour la chaîne : activer « Incoming Webhooks », créer un webhook vers la chaîne choisie et le mettre dans `SLACK_WEBHOOK_URL` (ou inviter le bot dans la chaîne et renseigner `SLACK_CHANNEL_ID`).
3. Sans configuration Slack, les rappels ne font rien et l'interrupteur du profil n'apparaît pas.

## Mise en production

1. **Base** : remplacer `provider = "sqlite"` par `"postgresql"` dans `prisma/schema.prisma` et pointer `DATABASE_URL` vers la base (Neon, Supabase, RDS…).
2. **Variables** : `APP_URL`, `ALLOWED_EMAIL_DOMAINS`, `ADMIN_EMAILS`, `CRON_SECRET`, `SMTP_URL` (obligatoire en prod), `MAIL_FROM`.
3. **Déploiement** : Vercel ou tout hébergeur Node (`npm run build && npm start`).
4. **Synchro** : configurer les secrets GitHub du workflow, ou le cron de l'hébergeur.

## Sécurité

- Domaine email vérifié strictement (un `@winamax.fr.evil.com` est refusé).
- Jetons de connexion et de session stockés hachés (SHA-256), lien à usage unique valable 15 min, consommé par POST (résiste au pré-clic des antivirus mail).
- Limite de 5 demandes de lien par email / 10 min.
- Cookies `httpOnly`, `sameSite=lax`, `secure` en prod. Site non indexé.

> Jeu gratuit, sans mise ni gain d'argent. Identité visuelle inspirée de la DA Winamax : à valider avec l'équipe brand (logo officiel, typographies).
