# AUNE : API de synchronisation (Cloudflare Worker)

Comptes par lien magique (e-mail) + un document de données par compte (base D1).
Gratuit pour démarrer. Aucune donnée n'est stockée en clair pour les liens et sessions (seulement leur empreinte SHA-256).

## Mise en ligne (une seule fois)

Sur votre ordinateur, avec Node.js installé, dans le dossier `worker/` :

1. `npm i -g wrangler` puis `wrangler login` (ouvre le navigateur pour se connecter à Cloudflare).
2. `wrangler d1 create aune` : copiez le `database_id` affiché dans `wrangler.toml` (ligne `database_id`).
3. `wrangler d1 execute aune --remote --file=schema.sql`
4. Créez un compte gratuit sur resend.com, puis une clé d'API (« API Keys »). Puis :
   `wrangler secret put RESEND_API_KEY` (collez la clé).
5. `wrangler deploy` : l'adresse du Worker s'affiche (`https://aune-api.XXXX.workers.dev`).
6. Dans `index.html`, mettez cette adresse dans `const API='...'` (ligne « Synchronisation en ligne »), puis fusionnez dans `main`.

## E-mails

- **Test** : avec `MAIL_FROM = onboarding@resend.dev`, Resend n'envoie qu'à l'adresse e-mail de votre propre compte Resend.
- **Vrais utilisateurs** : ajoutez et vérifiez un domaine dans Resend, puis mettez une adresse de ce domaine dans `MAIL_FROM`.

## Sécurité

- Lien magique : 15 min, une seule utilisation. 5 demandes par heure et par e-mail.
- Session : 180 jours, révocable (« Se déconnecter »).
- Le Worker ne répond au navigateur que depuis `APP_URL` (CORS).
- Une copie de la version précédente est gardée à chaque mise à jour (colonne `backup`).
- Ne jamais activer `DEV_ECHO` en production (il renvoie le lien dans la réponse).

## Formules (gratuit / Pro) et paiement Stripe

- Gratuit : appli locale, sans compte. Pro (9 €/mois ou 90 €/an) : synchronisation, Factur-X, suivi du CA.
- Essai Pro de 30 jours à la création du compte. Les données ne sont jamais bloquées : un compte non Pro peut toujours les lire.
- Mise à jour de la base (une seule fois) : exécuter `worker/schema.sql` dans la console D1 (la table `accounts` est ajoutée, le reste existe déjà).
- Stripe : créer deux prix récurrents (9 €/mois et 90 €/an) ; variables `STRIPE_PRICE_MONTH` et `STRIPE_PRICE_YEAR` (texte) ;
  secrets `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`. Webhook Stripe : `https://<worker>/api/stripe/webhook`,
  événements `checkout.session.completed` et `customer.subscription.created / updated / deleted`.
- Tester d'abord en mode test de Stripe (carte 4242 4242 4242 4242), puis passer en mode live.

## Passage sur le domaine aune.app

1. GitHub : Settings > Pages > Custom domain = `aune.app` (puis cocher « Enforce HTTPS » quand c'est disponible).
2. DNS (Cloudflare) : enregistrements pour `aune.app` : 4 enregistrements A vers 185.199.108.153, 185.199.109.153,
   185.199.110.153, 185.199.111.153 (nuage gris « DNS only ») et un CNAME `www` vers `valentinbournet5-bit.github.io`.
3. Worker : changer la variable `APP_URL` en `https://aune.app/app/` puis déployer. Le serveur n'accepte que cette origine (CORS) :
   tant que `APP_URL` n'est pas changée, l'appli sur aune.app ne peut pas se synchroniser.
4. Les données locales sont propres à chaque adresse : avant la bascule, se connecter et synchroniser sur l'ancien appareil,
   puis se reconnecter sur aune.app (ou exporter / importer un fichier).
5. Stripe : le retour de paiement utilise `APP_URL` (rien d'autre à changer).

## Connexion avec Google

- Bouton « Continuer avec Google » : l'appli reçoit un jeton de Google, le Worker (`POST /api/google`) vérifie sa signature avec les clés publiques de Google, l'audience (identifiant client), l'émetteur, l'expiration et `email_verified`, puis ouvre une session pour cette adresse. Même compte que le lien magique (clé : e-mail).
- Identifiant client (public) : constante `GOOGLE_CLIENT_ID` dans `src/index.js` (surchargeable par une variable `GOOGLE_CLIENT_ID`). Aucun secret n'est nécessaire.
- Console Google Cloud : client OAuth « Application Web », origine JavaScript autorisée `https://aune.app`, écran de consentement publié en production.

## Avis et mesure d'audience

- `POST /api/feedback` : un avis envoyé depuis l'appli (« Donner mon avis ») arrive par e-mail à `contact@aune.app` (variable facultative `FEEDBACK_TO`), via Resend. Plafond de 30 avis par jour, origine contrôlée, champ piège anti-robot.
- `POST /api/hit` : compteurs anonymes par jour (`site`, `app`, `first_doc`, `devis`, `facture`, `install`). Aucun cookie, aucun identifiant, aucune adresse IP conservée ; ignoré si le navigateur envoie « Ne pas me suivre ».
- Table à créer une fois dans la console D1 : `CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, name));`
- Lire les chiffres (console D1) :
  - par jour : `SELECT day, name, n FROM stats ORDER BY day DESC, name;`
  - totaux : `SELECT name, SUM(n) AS total FROM stats GROUP BY name;`
  - comptes créés : `SELECT COUNT(*) FROM accounts;`
