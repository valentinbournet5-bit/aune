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
