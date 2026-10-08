// Test de fumée de l'appli : routes, débordements, boutons en double, données anciennes, parcours devis.
// Lancer : node tests/smoke.mjs   (variable CHROMIUM = chemin de chromium si besoin)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const types = {'.html':'text/html','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv = http.createServer((q, r) => {
  let f = path.join(root, q.url.split('?')[0]);
  if (f.endsWith('/')) f += 'index.html';
  fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, {'content-type': types[path.extname(f)] || 'application/octet-stream'}), r.end(d)));
});
await new Promise(ok => srv.listen(0, ok));
const base = `http://localhost:${srv.address().port}/index.html`;
const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--no-proxy-server']});

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('✗', m); } };
const ROUTES = ['accueil', 'chantiers', 'planning', 'devis', 'factures', 'clients', 'reglages', 'projets', 'parametres'];
const WIDTHS = [390, 860, 1280, 1440];

async function page(w, seed) {
  const ctx = await browser.newContext({viewport: {width: w, height: 800}, serviceWorkers: 'block'});
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.accept());
  await p.addInitScript(s => { try { localStorage.setItem('aune.start', '1'); if (s) localStorage.setItem('aune.v1', s); } catch (e) {} }, seed || null);
  return p;
}
async function visit(p, h) {
  await p.goto(base + '#/' + h);
  await p.reload();
  await p.waitForSelector('#main > *');
  return p.evaluate(() => ({
    h1: (document.querySelector('#main h1, #main .empty b') || {}).textContent || '',
    primaries: document.querySelectorAll('#main .btn.primary').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1
  }));
}

// 1. Appli vide : toutes les routes, toutes les largeurs
for (const w of WIDTHS) {
  const p = await page(w);
  for (const h of ROUTES) {
    const r = await visit(p, h);
    ok(r.h1, `${w}px #/${h} : pas de titre`);
    ok(!r.overflow, `${w}px #/${h} : défilement horizontal`);
    ok(r.primaries <= 1, `${w}px #/${h} : ${r.primaries} boutons principaux (doublon)`);
  }
  const nf = await visit(p, 'zzz');
  ok(/introuvable/i.test(nf.h1), `${w}px route inconnue : « ${nf.h1} » au lieu de « Page introuvable »`);
  ok((await visit(p, 'projets')).h1 === (await visit(p, 'chantiers')).h1, `${w}px #/projets ≠ #/chantiers`);
  ok(!p.errs.length, `${w}px erreurs JS : ${p.errs.join(' | ')}`);
  await p.context().close();
}

// 2. Anciennes données : un localStorage minimal de l'ancienne version doit s'ouvrir sans erreur
{
  const old = JSON.stringify({v: 1, chantiers: [{id: 'c1', name: 'Ancien chantier', client: 'M. Test', status: 'en cours'}], docs: [], lots: [], tasks: [], settings: {name: 'Ma société'}});
  const p = await page(390, old);
  for (const h of ROUTES) { const r = await visit(p, h); ok(r.h1, `anciennes données #/${h} : page vide`); }
  ok(!p.errs.length, `anciennes données, erreurs JS : ${p.errs.join(' | ')}`);
  await p.context().close();
}

// 3. Exemple rempli + parcours devis, toutes largeurs
for (const w of WIDTHS) {
  const p = await page(w);
  await p.goto(base + '#/accueil');
  await p.waitForSelector('[data-a=demo]');
  await p.click('[data-a=demo]');
  await p.waitForTimeout(300);
  for (const h of ROUTES) {
    const r = await visit(p, h);
    ok(r.h1, `${w}px exemple #/${h} : page vide`);
    ok(!r.overflow, `${w}px exemple #/${h} : défilement horizontal`);
  }
  await p.goto(base + '#/devis'); await p.reload();
  await p.click('#main [data-a=newDoc]');
  await p.waitForTimeout(300);
  ok(/#\/devis\/.+/.test(p.url()), `${w}px création de devis : adresse ${p.url()}`);
  ok(await p.evaluate(() => !!document.querySelector('#main .editor')), `${w}px éditeur de devis absent`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${w}px éditeur : défilement horizontal`);
  ok(!p.errs.length, `${w}px exemple, erreurs JS : ${p.errs.join(' | ')}`);
  await p.context().close();
}

await browser.close(); srv.close();
console.log(fails ? `\n${fails} échec(s)` : '✓ Tous les tests passent');
process.exit(fails ? 1 : 0);
