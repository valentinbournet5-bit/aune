// AUNE : API de comptes (lien magique ou Google) et de synchronisation.
// Secrets : RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Variables : APP_URL, MAIL_FROM, STRIPE_PRICE_MONTH, STRIPE_PRICE_YEAR, FEEDBACK_TO (facultatif). Base D1 : DB.
// Formules : gratuit (appli locale) et Pro (synchronisation, Factur-X, suivi du CA) : 30 jours d'essai à la création du compte, puis abonnement Stripe.
// Les données ne sont jamais bloquées : un compte non Pro peut toujours LIRE ses données en ligne, seule l'écriture (synchronisation) est réservée au Pro.
// Option de test uniquement : DEV_ECHO=1 renvoie le lien dans la réponse (ne jamais l'activer en production).

const MAGIC_TTL = 15 * 60e3;            // validité du lien : 15 min
const SESSION_TTL = 180 * 864e5;        // session : 180 jours
const MAX_LINKS_PER_HOUR = 5;
const MAX_BYTES = 2 * 1024 * 1024;
const TRIAL_MS = 30 * 864e5;           // essai Pro : 30 jours
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const GOOGLE_CLIENT_ID = '137550705473-tp916he0pcssvu9h3e14o5ab3k5di856.apps.googleusercontent.com'; // identifiant public (pas un secret)
const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';

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


/* ---------- Connexion Google : on vérifie la signature du jeton de Google, jamais de mot de passe ---------- */
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));
let jwksCache = null, jwksAt = 0;
async function googleKeys(env) {
  if (jwksCache && Date.now() - jwksAt < 3600e3) return jwksCache;
  const r = await fetch(env.GOOGLE_JWKS_URL || GOOGLE_JWKS);
  if (!r.ok) throw new Error('jwks');
  jwksCache = (await r.json()).keys || []; jwksAt = Date.now();
  return jwksCache;
}
async function googleEmail(env, idToken, now) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64u(parts[0])));
    if (head.alg !== 'RS256') return null;
    let jwk = (await googleKeys(env)).find(k => k.kid === head.kid);
    if (!jwk) { jwksCache = null; jwk = (await googleKeys(env)).find(k => k.kid === head.kid); }
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(parts[2]), enc.encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const c = JSON.parse(new TextDecoder().decode(b64u(parts[1])));
    if (c.aud !== (env.GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID)) return null;
    if (c.iss !== 'https://accounts.google.com' && c.iss !== 'accounts.google.com') return null;
    if (!(c.exp * 1000 > now)) return null;
    if (c.email_verified !== true && c.email_verified !== 'true') return null;
    const email = String(c.email || '').trim().toLowerCase();
    return EMAIL_RE.test(email) ? email : null;
  } catch { return null; }
}


/* ---------- Compteurs anonymes (audience) ---------- */
const HIT_EVENTS = ['site', 'app', 'first_doc', 'devis', 'facture', 'install'];
const HIT_SOURCES = ['tiktok', 'instagram', 'facebook', 'linkedin', 'youtube', 'whatsapp', 'mail', 'google', 'autre'];
async function bump(env, name, now) {
  try {
    await env.DB.prepare('INSERT INTO stats(day,name,n) VALUES(?,?,1) ON CONFLICT(day,name) DO UPDATE SET n=n+1').bind(new Date(now).toISOString().slice(0, 10), name).run();
  } catch { /* table absente : la mesure est facultative */ }
}

/* ---------- Comptes et formules ---------- */
async function account(env, email, now) {
  let a = await env.DB.prepare('SELECT * FROM accounts WHERE email=?').bind(email).first();
  if (!a) {
    await env.DB.prepare('INSERT OR IGNORE INTO accounts(email,created,trial_end) VALUES(?,?,?)').bind(email, now, now + TRIAL_MS).run();
    a = await env.DB.prepare('SELECT * FROM accounts WHERE email=?').bind(email).first();
  }
  return a;
}
function planOf(a, now) {
  const subOk = a.stripe_sub && ['active', 'trialing', 'past_due'].includes(a.sub_status) && (!a.sub_end || a.sub_end > now);
  if (subOk) return { plan: 'pro', source: 'subscription', until: a.sub_end || null, interval: a.interval || null, cancel: !!a.cancel, status: a.sub_status };
  if (a.trial_end > now) return { plan: 'pro', source: 'trial', until: a.trial_end };
  return { plan: 'free', source: a.stripe_sub ? 'ended' : 'trial_over', until: a.trial_end };
}
const stripeBase = env => env.STRIPE_API || 'https://api.stripe.com';
async function stripe(env, path, form) {
  const r = await fetch(stripeBase(env) + path, { method: 'POST', headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  let j = {}; try { j = await r.json(); } catch { /* réponse vide */ }
  return { ok: r.ok, j };
}
async function verifyStripe(env, raw, header) {
  if (!env.STRIPE_WEBHOOK_SECRET) return false;
  let t = '', sigs = [];
  for (const part of String(header || '').split(',')) { const [k, v] = part.split('='); if (k === 't') t = v; else if (k === 'v1' && v) sigs.push(v); }
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - +t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(env.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + raw)));
  return sigs.some(sg => sg.length === mac.length && [...sg].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mac.charCodeAt(i)), 0) === 0);
}
async function applySubscription(env, sub, now) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const end = sub.current_period_end || (item && item.current_period_end) || null;
  const interval = (item && item.price && item.price.recurring && item.price.recurring.interval) || (sub.plan && sub.plan.interval) || null;
  let row = sub.customer ? await env.DB.prepare('SELECT email FROM accounts WHERE stripe_customer=?').bind(sub.customer).first() : null;
  const email = row ? row.email : String(sub.metadata && sub.metadata.email || '').toLowerCase();
  if (!email) return;
  // Un événement Stripe tardif ne doit pas recréer un compte supprimé.
  if (!(await env.DB.prepare('SELECT 1 x FROM accounts WHERE email=?').bind(email).first())) return;
  await env.DB.prepare('UPDATE accounts SET stripe_customer=COALESCE(?,stripe_customer), stripe_sub=?, sub_status=?, sub_end=?, interval=?, cancel=? WHERE email=?')
    .bind(sub.customer || null, sub.id, sub.status === 'canceled' ? 'canceled' : sub.status, end ? end * 1000 : null, interval, (sub.cancel_at_period_end || (sub.cancel_at && sub.cancel_at * 1000 > now) || (sub.cancellation_details && sub.cancellation_details.reason === 'cancellation_requested' && sub.status !== 'canceled')) ? 1 : 0, email).run();
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
      await account(env, row.email, now);
      const s = token();
      await env.DB.prepare('INSERT INTO sessions(hash,email,created) VALUES(?,?,?)').bind(await sha(s), row.email, now).run();
      return json(env, req, { session: s, email: row.email });
    }

    // 2 bis. Connexion avec Google : le jeton est vérifié (signature, public, expiration, adresse vérifiée).
    if (path === '/api/google' && req.method === 'POST') {
      const b = await readJson(req);
      const email = await googleEmail(env, b && b.credential, now);
      if (!email) return json(env, req, { error: 'google' }, 400);
      await account(env, email, now);
      const s = token();
      await env.DB.prepare('INSERT INTO sessions(hash,email,created) VALUES(?,?,?)').bind(await sha(s), email, now).run();
      return json(env, req, { session: s, email });
    }

    // Mesure d'audience anonyme : de simples compteurs par jour (aucun cookie, aucun identifiant, aucune adresse IP conservée).
    if (path === '/api/hit' && req.method === 'POST') {
      const b = await readJson(req), e = String(b && b.e || ''), src = String(b && b.s || '').toLowerCase();
      if (HIT_EVENTS.includes(e) && req.headers.get('Origin') === new URL(env.APP_URL).origin) {
        await bump(env, e, now);
        if (HIT_SOURCES.includes(src)) await bump(env, e + ':' + src, now); // provenance du lien (?s=tiktok…)
      }
      return new Response(null, { status: 204, headers: cors(env, req) });
    }

    // Avis des utilisateurs : envoyé par e-mail à l'adresse de contact (plafond de 30 par jour contre les abus).
    if (path === '/api/feedback' && req.method === 'POST') {
      const b = await readJson(req);
      const msg = String(b && b.message || '').trim().slice(0, 3000), from = String(b && b.email || '').trim().slice(0, 200);
      if (msg.length < 3 || b.website) return json(env, req, { error: 'message' }, 400);
      if (req.headers.get('Origin') !== new URL(env.APP_URL).origin) return json(env, req, { error: 'origine' }, 403);
      const day = new Date(now).toISOString().slice(0, 10);
      try {
        const c = await env.DB.prepare('SELECT n FROM stats WHERE day=? AND name=?').bind(day, 'feedback_sent').first();
        if (c && c.n >= 30) return json(env, req, { error: 'trop' }, 429);
      } catch { /* table absente : on laisse passer */ }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: env.MAIL_FROM, to: [env.FEEDBACK_TO || 'contact@aune.app'], subject: 'Avis AUNE',
          ...(EMAIL_RE.test(from) ? { reply_to: from } : {}),
          text: `${msg}\n\n---\nE-mail laissé : ${from || '(aucun)'}\nPage : ${String(b.page || '').slice(0, 100)}\nAppareil : ${String(b.ua || '').slice(0, 160)}`
        })
      });
      if (!r.ok) return json(env, req, { error: 'mail' }, 502);
      await bump(env, 'feedback_sent', now);
      return json(env, req, { ok: true });
    }

    // Webhook Stripe : authentifié par la signature, pas par une session.
    if (path === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = await req.text();
      if (!(await verifyStripe(env, raw, req.headers.get('Stripe-Signature')))) return json(env, req, { error: 'signature' }, 400);
      let ev; try { ev = JSON.parse(raw); } catch { return json(env, req, { error: 'format' }, 400); }
      const o = ev.data && ev.data.object || {};
      if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') {
        const mail = String(o.client_reference_id || o.customer_email || '').toLowerCase();
        if (mail) { await account(env, mail, now); await env.DB.prepare('UPDATE accounts SET stripe_customer=?, stripe_sub=COALESCE(?,stripe_sub) WHERE email=?').bind(o.customer || null, o.subscription || null, mail).run(); }
      } else if (/^customer\.subscription\.(created|updated|deleted)$/.test(ev.type)) {
        await applySubscription(env, ev.type.endsWith('deleted') ? { ...o, status: 'canceled' } : o, now);
      }
      return json(env, req, { received: true });
    }

    const email = await session(env, req);
    if (!email) return json(env, req, { error: 'auth' }, 401);

    if (path === '/api/logout' && req.method === 'POST') {
      const s = req.headers.get('Authorization').slice(7);
      await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(await sha(s)).run();
      return json(env, req, { ok: true });
    }

    if (path === '/api/me' && req.method === 'GET') {
      const a = await account(env, email, now);
      return json(env, req, { email, ...planOf(a, now), canBuy: !!(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTH && env.STRIPE_PRICE_YEAR), hasCustomer: !!a.stripe_customer });
    }

    if (path === '/api/checkout' && req.method === 'POST') {
      const b = await readJson(req), interval = b && b.interval === 'year' ? 'year' : 'month';
      const price = interval === 'year' ? env.STRIPE_PRICE_YEAR : env.STRIPE_PRICE_MONTH;
      if (!env.STRIPE_SECRET_KEY || !price) return json(env, req, { error: 'paiement' }, 503);
      const a = await account(env, email, now), pl = planOf(a, now);
      if (pl.source === 'subscription') return json(env, req, { error: 'deja' }, 409);
      const back = env.APP_URL.replace(/#.*$/, '');
      const f = new URLSearchParams({ mode: 'subscription', 'line_items[0][price]': price, 'line_items[0][quantity]': '1', success_url: back + '#/abonnement', cancel_url: back + '#/reglages',
        client_reference_id: email, 'subscription_data[metadata][email]': email, allow_promotion_codes: 'true', locale: 'fr' });
      if (a.stripe_customer) f.set('customer', a.stripe_customer); else f.set('customer_email', email);
      // L'abonnement garde le reste de l'essai : le premier prélèvement n'a lieu qu'à la fin des 30 jours.
      if (a.trial_end - now > 3 * 864e5) f.set('subscription_data[trial_end]', String(Math.floor(a.trial_end / 1000)));
      const r = await stripe(env, '/v1/checkout/sessions', f);
      if (!r.ok || !r.j.url) return json(env, req, { error: 'paiement' }, 502);
      return json(env, req, { url: r.j.url });
    }

    if (path === '/api/portal' && req.method === 'POST') {
      const a = await account(env, email, now);
      if (!env.STRIPE_SECRET_KEY || !a.stripe_customer) return json(env, req, { error: 'paiement' }, 404);
      const r = await stripe(env, '/v1/billing_portal/sessions', new URLSearchParams({ customer: a.stripe_customer, return_url: env.APP_URL.replace(/#.*$/, '') + '#/reglages' }));
      if (!r.ok || !r.j.url) return json(env, req, { error: 'paiement' }, 502);
      return json(env, req, { url: r.j.url });
    }

    // Droit à l'effacement : supprime le compte et toutes les données en ligne (les données locales de l'appareil restent).
    // Un abonnement en cours (non résilié) doit d'abord être résilié pour ne pas continuer à être facturé.
    if (path === '/api/account/delete' && req.method === 'POST') {
      const a = await account(env, email, now);
      const live = a.stripe_sub && ['active', 'trialing', 'past_due'].includes(a.sub_status) && (!a.sub_end || a.sub_end > now);
      if (live && !a.cancel) return json(env, req, { error: 'abonnement' }, 409);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM data WHERE email=?').bind(email),
        env.DB.prepare('DELETE FROM sessions WHERE email=?').bind(email),
        env.DB.prepare('DELETE FROM magic WHERE email=?').bind(email),
        env.DB.prepare('DELETE FROM accounts WHERE email=?').bind(email)
      ]);
      return json(env, req, { ok: true });
    }

    // 3. Données : un seul document par compte, avec numéro de révision.
    if (path === '/api/data' && req.method === 'GET') {
      const row = await env.DB.prepare('SELECT rev, json, updated FROM data WHERE email=?').bind(email).first();
      if (!row) return json(env, req, { rev: 0, data: null });
      return json(env, req, { rev: row.rev, data: JSON.parse(row.json), updated: row.updated });
    }

    if (path === '/api/data' && req.method === 'PUT') {
      if (planOf(await account(env, email, now), now).plan !== 'pro') return json(env, req, { error: 'pro' }, 402);
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
