# Winamax LoL Pronos

Concours interne de pronostics League of Legends, **réservé aux collaborateurs Winamax**.
Tous les matchs des ligues majeures (**LCK, LPL, LEC, LCS**), un classement général et par ligue.

## Fonctionnalités

- **Accès restreint** : connexion par lien magique envoyé par email, uniquement pour les domaines autorisés (`@winamax.fr`, `@winamax.com` par défaut). Pas de mot de passe.
- **Pronos** sur chaque match : on choisit le score (2-0, 2-1, 1-2… selon le BO). Modifiable jusqu'au coup d'envoi, verrouillé côté serveur ensuite.
- **Barème** (`src/lib/scoring.ts`) :
  | | BO1 | BO3 | BO5 |
  |---|---|---|---|
  | Bon vainqueur | 10 | 10 | 10 |
  | Bonus score exact | – | +5 | +10 |
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
La synchro récupère J-14 → J+30, met à jour les matchs puis recalcule les points (idempotent).

- Manuel : bouton dans `/admin`, ou `npm run sync`.
- Automatique : `GET /api/cron/sync` avec l'en-tête `Authorization: Bearer $CRON_SECRET` (16 caractères minimum).
  Le workflow `.github/workflows/sync.yml` l'appelle toutes les 15 min dès que les secrets `APP_URL` et `CRON_SECRET` sont définis dans le dépôt.

Un match corrigé à la main dans l'admin n'est plus écrasé par la synchro.
Pour brancher une autre source (API officielle, PandaScore…), il suffit d'implémenter l'interface `MatchProvider` (`src/lib/providers/types.ts`).

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
