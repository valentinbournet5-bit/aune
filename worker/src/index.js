// AUNE : API de comptes (lien magique) et de synchronisation.
// Secrets attendus : RESEND_API_KEY. Variables : APP_URL, MAIL_FROM. Base D1 : DB.
// Option de test uniquement : DEV_ECHO=1 renvoie le lien dans la réponse (ne jamais l'activer en production).

const MAGIC_TTL = 15 * 60e3;            // validité du lien : 15 min
const SESSION_TTL = 180 * 864e5;        // session : 180 jours
const MAX_LINKS_PER_HOUR = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const token = () => hex(crypto.getRandomValues(new Uint8Array(24)));

function cors(env, req) {
  const origin = new URL(env.APP_URL).origin;
  const o = req.headers.get('Origin');
  const h = { 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type', 'Access-Control-Max-Age': '86400' };
  if (o === origin || (env.DEV_ECHO === '1' && o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
const json = (env, req, body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors(env, req) } });

async function sendMail(env, to, link) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM, to: [to], subject: 'Votre lien de connexion AUNE',
      text: `Bonjour,\n\nPour vous connecter à AUNE, ouvrez ce lien (valable 15 minutes, utilisable une seule fois) :\n\n${link}\n\nSi vous n'avez rien demandé, ignorez ce message.`
    })
  });
  if (!r.ok) throw new Error('mail ' + r.status);
}

async function session(env, req) {
  const m = /^Bearer ([0-9a-f]{48})$/.exec(req.headers.get('Authorization') || '');
  if (!m) return null;
  const row = await env.DB.prepare('SELECT email, created FROM sessions WHERE hash=?').bind(await sha(m[1])).first();
  if (!row || Date.now() - row.created > SESSION_TTL) return null;
  return row.email;
}

async function readJson(req) { try { return await req.json(); } catch { return null; } }

export default {
  async fetch(req, env) {
    const url = new URL(req.url), path = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });
    const now = Date.now();

    // 1. Demande de lien : réponse identique que le compte existe ou non.
    if (path === '/api/login' && req.method === 'POST') {
      const b = await readJson(req);
      const email = String(b && b.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json(env, req, { error: 'email' }, 400);
      const n = await env.DB.prepare('SELECT COUNT(*) c FROM magic WHERE email=? AND created>?').bind(email, now - 3600e3).first();
      if (n.c >= MAX_LINKS_PER_HOUR) return json(env, req, { error: 'trop' }, 429);
      const t = token();
      await env.DB.prepare('DELETE FROM magic WHERE expires<?').bind(now).run();
      await env.DB.prepare('INSERT INTO magic(hash,email,expires,created) VALUES(?,?,?,?)').bind(await sha(t), email, now + MAGIC_TTL, now).run();
      const link = env.APP_URL.replace(/#.*$/, '') + '#/connexion/' + t;
      if (env.DEV_ECHO === '1') return json(env, req, { ok: true, link });
      try { await sendMail(env, email, link); } catch { return json(env, req, { error: 'mail' }, 502); }
      return json(env, req, { ok: true });
    }

    // 2. Échange du lien contre une session (lien à usage unique).
    if (path === '/api/verify' && req.method === 'POST') {
      const b = await readJson(req);
      const t = String(b && b.token || '');
      if (!/^[0-9a-f]{48}$/.test(t)) return json(env, req, { error: 'lien' }, 400);
      const h = await sha(t);
      const row = await env.DB.prepare('DELETE FROM magic WHERE hash=? RETURNING email, expires').bind(h).first();
      if (!row || row.expires < now) return json(env, req, { error: 'lien' }, 400);
      const s = token();
      await env.DB.prepare('INSERT INTO sessions(hash,email,created) VALUES(?,?,?)').bind(await sha(s), row.email, now).run();
      return json(env, req, { session: s, email: row.email });
    }

    const email = await session(env, req);
    if (!email) return json(env, req, { error: 'auth' }, 401);

    if (path === '/api/logout' && req.method === 'POST') {
      const s = req.headers.get('Authorization').slice(7);
      await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(await sha(s)).run();
      return json(env, req, { ok: true });
    }

    // 3. Données : un seul document par compte, avec numéro de révision.
    if (path === '/api/data' && req.method === 'GET') {
      const row = await env.DB.prepare('SELECT rev, json, updated FROM data WHERE email=?').bind(email).first();
      if (!row) return json(env, req, { rev: 0, data: null });
      return json(env, req, { rev: row.rev, data: JSON.parse(row.json), updated: row.updated });
    }

    if (path === '/api/data' && req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BYTES) return json(env, req, { error: 'taille' }, 413);
      let b; try { b = JSON.parse(text); } catch { b = null; }
      if (!b || !Number.isInteger(b.rev) || b.rev < 0 || !b.data || typeof b.data !== 'object' || !b.data.v) return json(env, req, { error: 'format' }, 400);
      const body = JSON.stringify(b.data);
      let ok;
      if (b.rev === 0) {
        const r = await env.DB.prepare('INSERT INTO data(email,rev,json,updated) VALUES(?,1,?,?) ON CONFLICT(email) DO NOTHING').bind(email, body, now).run();
        ok = r.meta.changes === 1;
      } else {
        const r = await env.DB.prepare('UPDATE data SET backup=json, json=?, rev=rev+1, updated=? WHERE email=? AND rev=?').bind(body, now, email, b.rev).run();
        ok = r.meta.changes === 1;
      }
      const cur = await env.DB.prepare('SELECT rev, json, updated FROM data WHERE email=?').bind(email).first();
      if (ok) return json(env, req, { rev: cur.rev, updated: cur.updated });
      return json(env, req, { error: 'conflit', rev: cur.rev, data: JSON.parse(cur.json), updated: cur.updated }, 409);
    }

    return json(env, req, { error: 'introuvable' }, 404);
  }
};
