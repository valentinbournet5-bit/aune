-- Base D1 d'AUNE : comptes (lien magique), sessions et données.
CREATE TABLE IF NOT EXISTS magic (
  hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS magic_email ON magic(email, created);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY, email TEXT NOT NULL, created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_email ON sessions(email);
CREATE TABLE IF NOT EXISTS data (
  email TEXT PRIMARY KEY, rev INTEGER NOT NULL, json TEXT NOT NULL, backup TEXT, updated INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  email TEXT PRIMARY KEY, created INTEGER NOT NULL, trial_end INTEGER NOT NULL,
  stripe_customer TEXT, stripe_sub TEXT, sub_status TEXT, sub_end INTEGER, interval TEXT, cancel INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS accounts_customer ON accounts(stripe_customer);

-- Compteurs anonymes par jour (visites, premiers documents, installations) : aucun identifiant, aucun cookie.
CREATE TABLE IF NOT EXISTS stats (
  day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, name)
);
