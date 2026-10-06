#!/usr/bin/env python3
"""Génère les pages du site vitrine (site/*.html) avec l'en-tête, le pied de page et l'accueil.
Les pages légales (mentions-legales, cgu, confidentialite) gardent leur texte : seul l'habillage est regénéré.
Usage : python3 tools/build-site.py"""
import os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')

ICONS = {
 'home': '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 'site': '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
 'doc': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
 'inv': '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 'plus': '<path d="M12 5v14M5 12h14"/>',
 'sync': '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3M5 4v4h4M19 20v-4h-4"/>',
 'off': '<path d="M3 3l18 18M8.5 6.7A6 6 0 0 1 18 11a4 4 0 0 1 2.5 6.9M6 18a4 4 0 0 1-.9-7.9"/>',
 'chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 'shield': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 'send': '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
 'bolt': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 'check': '<path d="M5 12l5 5 9-10"/>',
 'phone': '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
 'laptop': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
 'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
 'euro': '<path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h9M4 14h9"/>',
}
SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ''.join(
    f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items()) + '</svg>'
def ic(n, extra=''): return f'<svg class="ic" {extra} aria-hidden="true"><use href="#i-{n}"/></svg>'

MARK = ('<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="17" fill="#bba3ff"/>'
        '<path d="M16 46 L32 16 L48 46" fill="none" stroke="#232733" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M18 53h28" stroke="#fff" stroke-width="4" stroke-dasharray="2 5"/></svg>')

def head(title, desc, extra=''):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#f8f7f3">
<link rel="icon" href="app/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
{extra}</head>
<body>
{SPRITE}
'''

HEADER = f'''<header class="top" id="top"><div class="wrap">
<a class="logo" href="./">{MARK}AUNE</a>
<nav class="links"><a href="./#fonctions">Fonctions</a><a href="./#tarifs">Tarifs</a><a href="./#faq">Questions</a><a class="btn primary sm" href="app/">Ouvrir l'appli</a></nav>
</div></header>
'''

FOOTER = '''<footer><div class="wrap">
<span>© AUNE</span><a href="mentions-legales.html">Mentions légales</a><a href="cgu.html">Conditions d'utilisation et de vente</a><a href="confidentialite.html">Confidentialité</a><a href="mailto:contact@aune.app">Contact</a>
<span class="sp">Fait pour les artisans, en France.</span>
</div></footer>
<script>document.addEventListener('scroll',function(){var h=document.getElementById('top');if(h)h.classList.toggle('stuck',scrollY>8)},{passive:true});</script>
</body></html>
'''

def faq(q, a): return f'<details><summary>{q}</summary><p>{a}</p></details>'

FAQ_HTML = "\n".join([
faq("Où sont mes données ?","Sur votre appareil. Avec un compte, elles sont aussi synchronisées en ligne. Vous pouvez tout exporter ou supprimer à tout moment."),
faq("Et la facture électronique ?","AUNE produit des factures Factur-X pour vos clients professionnels. L'envoi à une plateforme agréée (obligatoire en 2027) est à venir."),
faq("Ça marche sans internet ?","Oui. Tout fonctionne sans réseau, et se synchronise au retour du signal."),
faq("Mes factures sont-elles conformes ?","AUNE ajoute les mentions obligatoires, numérote vos factures sans trou et verrouille une facture émise. Pour la corriger, on émet un avoir, comme la loi l'impose."),
faq("Mes données sont-elles en sécurité ?","Elles restent sur votre appareil. Avec un compte, la copie en ligne est transmise en HTTPS, protégée par votre lien de connexion personnel, et vous pouvez la supprimer en un clic."),
faq("Pour qui est AUNE ?","Pour les artisans, auto-entrepreneurs et indépendants : bâtiment, services, conseil, création. Vous choisissez le vocabulaire : projet, chantier ou dossier."),
faq("Comment résilier ?","En un clic, dans l'appli. Vos données restent à vous."),
])

SCRIPT_JS = r"""<script>
(function(){var els=document.querySelectorAll('.rv');
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(el){io.observe(el)})}else{els.forEach(function(el){el.classList.add('in')})}
var hero=document.querySelector('.bh'),st=document.getElementById('sticky');
if(hero&&st&&'IntersectionObserver' in window){new IntersectionObserver(function(es){st.classList.toggle('on',!es[0].isIntersecting)},{threshold:0}).observe(hero)}})();
</script>
"""

INDEX = head("AUNE : devis, factures et chantiers pour artisans",
  "Devis, factures, chantiers et facture électronique pour artisans et auto-entrepreneurs. Sur téléphone et ordinateur, gratuit pour commencer.",
  '''<meta property="og:title" content="AUNE : le devis est fait sur place, la facture en un clic">
<meta property="og:description" content="Devis, factures, chantiers et facture électronique pour artisans. Gratuit pour commencer.">
<meta property="og:image" content="img/desktop.webp"><meta property="og:type" content="website">
<script>document.documentElement.className="js";if(/^#\\/(connexion|abonnement|reglages|accueil|chantiers?|devis|factures|clients|planning)/.test(location.hash))location.replace("app/"+location.hash);</script>
''') + HEADER + f'''
<main>
<section class="bh"><div class="wrap">
<span class="kicker an" style="--d:0"><i>{ic('check')}</i>Factur-X inclus, envoi aux plateformes agréées bientôt</span>
<h1 class="an" style="--d:1">Le devis est fait <mark>sur place</mark>.<br>La&nbsp;facture, <mark>en un clic</mark>.</h1>
<p class="lead an" style="--d:2">Devis, factures et projets. Sur téléphone et ordinateur, même sans réseau.</p>
<div class="cta an" style="--d:3"><a class="btn primary" href="app/">Essayer gratuitement {ic('arrow')}</a><a class="btn white" href="#tarifs">Voir les tarifs</a></div>
<div class="bstage">
<div class="bphone"><img src="img/m-home.webp" alt="AUNE sur téléphone" width="640" height="1385"></div>
<div class="float g1"><span class="chip">{ic('euro')}</span><span><small>Facture payée</small><b>+ 2 400,00 €</b></span></div>
<div class="float g2"><span class="chip">{ic('doc')}</span><span><small>Devis accepté</small><b>20 200,00 €</b></span></div>
</div>
</div></section>

<div class="wrap" id="fonctions"><div class="bands">
<div class="band sky rv"><div><span class="num">1</span><h2>Devis</h2><p>Sur place, en quelques lignes.</p></div><div class="shot"><img src="img/m-devis.webp" alt="Un devis dans AUNE" width="640" height="1385" loading="lazy"></div></div>
<div class="band mint rev rv"><div><span class="num">2</span><h2>Facture</h2><p>Le devis accepté devient facture. Factur-X inclus.</p></div><img class="sheet" src="img/facture.webp" alt="Une facture générée par AUNE" width="900" height="633" loading="lazy"></div>
<div class="band lemon rv"><div><span class="num">3</span><h2>Projet</h2><p>Tous vos projets au même endroit.</p></div><div class="shot"><img src="img/m-chan.webp" alt="Les projets dans AUNE" width="640" height="1385" loading="lazy"></div></div>
</div>
<div class="trades rv"><span>Facture électronique</span><span>Chiffre d'affaires</span><span>Tous vos appareils</span><span>Sans réseau</span></div>
</div>

<section id="installer"><div class="wrap">
<h2 class="rv">Installez-la <mark class="lilac">comme une appli</mark>.</h2>
<div class="steps3" style="margin-top:28px">
<div class="step rv"><span class="chip" style="background:var(--lilac-s)">{ic('phone')}</span><h3>iPhone</h3><p>Safari, <b>Partager</b>, puis <b>Sur l'écran d'accueil</b>.</p></div>
<div class="step rv"><span class="chip" style="background:var(--mint-s)">{ic('phone')}</span><h3>Android</h3><p>Chrome, menu <b>⋮</b>, puis <b>Installer l'application</b>.</p></div>
<div class="step rv"><span class="chip" style="background:var(--sky-s)">{ic('laptop')}</span><h3>Ordinateur</h3><p>Chrome ou Edge, <b>icône d'installation</b> dans la barre d'adresse.</p></div>
</div>
</div></section>

<section id="tarifs" style="padding-top:20px"><div class="wrap">
<h2 class="rv">Gratuit pour commencer. <mark class="lemon">Pro</mark> si besoin.</h2>
<div class="price" style="margin-top:30px">
<div class="plan rv"><h3>Gratuit</h3><div class="amt">0 €</div>
<ul><li>Devis, factures, avoirs</li><li>Clients, projets, planning</li><li class="no">Synchronisation</li><li class="no">Factur-X et chiffre d'affaires</li></ul>
<a class="btn" href="app/">Commencer</a></div>
<div class="plan pro rv"><span class="tag">30 jours offerts</span><h3>Pro</h3><div class="amt">9 € <small>/ mois</small></div><p style="margin:0;opacity:.8">ou 90 € par an</p>
<ul><li><b>Tout le plan Gratuit, plus :</b></li><li>Synchronisation téléphone et ordinateur</li><li>Factur-X et chiffre d'affaires</li></ul>
<a class="btn primary" href="app/">Essayer 30 jours</a></div>
</div>
<p class="legalnote">Sans carte bancaire pour l'essai. TVA non applicable, art. 293 B du CGI.</p>
</div></section>

<section id="faq" style="padding-top:20px"><div class="wrap">
<h2 class="rv">Questions</h2><p class="sub"></p>
<div class="faq">
{FAQ_HTML}
</div>
</div></section>

<section style="padding-top:10px"><div class="wrap"><div class="bfinal rv">
<h2>Prêt à gagner <mark>du temps</mark> ?</h2>
<a class="btn white" href="app/">Ouvrir l'appli {ic('arrow')}</a>
</div></div></section>
</main>
<div class="sticky" id="sticky"><a class="btn primary" href="app/">Ouvrir l'appli {ic('arrow')}</a></div>
'''+SCRIPT_JS+FOOTER

open(os.path.join(ROOT, 'index.html'), 'w').write(INDEX)

# pages légales : on garde le texte, on regénère l'habillage
for fn, title in [('mentions-legales.html', 'Mentions légales'), ('cgu.html', "Conditions d'utilisation et de vente"), ('confidentialite.html', 'Politique de confidentialité')]:
    p = os.path.join(ROOT, fn)
    m = re.search(r'<main class="wrap legal">(.*)</main>', open(p).read(), re.S)
    if not m: raise SystemExit('contenu introuvable dans ' + fn)
    page = head(title + ' · AUNE', title) + HEADER + '<main class="wrap legal">' + m.group(1) + '</main>\n' + FOOTER
    open(p, 'w').write(page)

page404 = head('Page introuvable · AUNE', 'Page introuvable', '<base href="/">\n') + HEADER + (
    '<main class="wrap legal"><h1>Page introuvable</h1><p>Cette page n\'existe pas ou a été déplacée.</p>'
    '<p><a class="btn primary" href="./">Retour à l\'accueil</a> <a class="btn" href="app/">Ouvrir l\'appli</a></p></main>\n') + FOOTER
open(os.path.join(ROOT, '404.html'), 'w').write(page404)
print('site régénéré')
