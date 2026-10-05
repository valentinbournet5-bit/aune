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
