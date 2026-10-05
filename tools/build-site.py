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
<nav class="links"><a href="./#fonctions">Fonctions</a><a href="./#installer">Installer</a><a href="./#tarifs">Tarifs</a><a href="./#faq">Questions</a><a class="btn primary sm" href="app/">Ouvrir l'appli</a></nav>
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
faq("Où sont mes données ?","Sur votre appareil, dans le navigateur. Si vous créez un compte, elles sont aussi synchronisées sur nos serveurs (Cloudflare) pour les retrouver sur vos autres appareils. Vous pouvez tout exporter à tout moment et supprimer votre compte en ligne depuis l'appli."),
faq("Que se passe-t-il à la fin de l'essai ou si je résilie ?","Vous repassez en plan Gratuit. Vos données ne sont jamais bloquées : elles restent sur votre appareil et exportables. Seules la synchronisation et les fonctions Pro s'arrêtent."),
faq("AUNE est-il prêt pour la facture électronique ?","AUNE produit des factures au format Factur-X (norme européenne EN 16931) pour vos clients professionnels. AUNE n'est pas une plateforme agréée : l'envoi à une plateforme agréée, obligatoire pour émettre à partir du 1er septembre 2027 pour les petites entreprises, est prévu."),
faq("Puis-je l'utiliser sans connexion internet ?","Oui. Sur un chantier sans réseau, tout fonctionne. La synchronisation se fait au retour du réseau."),
faq("AUNE remplace-t-il mon comptable ?","Non. AUNE vous aide à établir vos documents et à suivre votre activité, mais il ne remplace ni un conseil comptable, ni un conseil juridique ou fiscal. Vérifiez toujours les mentions et montants de vos documents."),
faq("Comment résilier ?","Dans l'appli : Réglages, « Gérer mon abonnement ». La résiliation est effective à la fin de la période déjà payée."),
faq("Une question, un problème ?",'Écrivez-nous à <a href="mailto:contact@aune.app">contact@aune.app</a>.')
])

SCRIPT_JS = r"""<script>
(function(){var els=document.querySelectorAll('.rv');
if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});els.forEach(function(el){io.observe(el)})}else{els.forEach(function(el){el.classList.add('in')})}
var hero=document.querySelector('.hero'),st=document.getElementById('sticky');
if(hero&&st&&'IntersectionObserver' in window){new IntersectionObserver(function(es){st.classList.toggle('on',!es[0].isIntersecting)},{threshold:0}).observe(hero)}})();
</script>
"""

INDEX = head("AUNE : devis, factures et chantiers pour artisans",
  "Devis, factures, chantiers et facture électronique pour artisans et auto-entrepreneurs. Sur téléphone et ordinateur, gratuit pour commencer.",
  '''<meta property="og:title" content="AUNE : le devis est fait avant de quitter le chantier">
<meta property="og:description" content="Devis, factures, chantiers et facture électronique pour artisans. Gratuit pour commencer.">
<meta property="og:image" content="img/desktop.webp"><meta property="og:type" content="website">
<script>document.documentElement.className="js";if(/^#\\/(connexion|abonnement|reglages|accueil|chantiers?|devis|factures|clients|planning)/.test(location.hash))location.replace("app/"+location.hash);</script>
''') + HEADER + f'''
<main>
<section class="hero"><div class="wrap">
<div>
<span class="kicker"><i>{ic('check')}</i>Prêt pour la facture électronique 2027</span>
<h1>Le <mark class="sky">devis</mark> est fait avant de quitter le <mark class="lilac">chantier</mark>.</h1>
<p class="lead">AUNE aide les artisans et auto-entrepreneurs à faire devis, factures et suivi de chantier en quelques clics. Sur téléphone comme sur ordinateur, même sans réseau.</p>
<div class="cta"><a class="btn primary" href="app/">Essayer gratuitement {ic('arrow')}</a><a class="btn" href="#tarifs">Voir les tarifs</a></div>
<p class="note">Sans carte bancaire, sans installation : l'appli s'ouvre dans le navigateur.</p>
</div>
<div class="stage">
<span class="blob a"></span><span class="blob b"></span><span class="blob c"></span>
<div class="browser"><div class="bar"><i></i><i></i><i></i></div><img src="img/desktop.webp" alt="Tableau de bord d'AUNE sur ordinateur : devis, factures, chantiers, sommes à encaisser" width="1400" height="887"></div>
<div class="phone p1"><img src="img/m-home.webp" alt="AUNE sur téléphone" width="640" height="1385"></div>
<div class="float f1"><span class="chip">{ic('euro')}</span><span><small>Facture payée</small><b>+ 2 400,00 €</b></span></div>
<div class="float f3"><span class="chip">{ic('doc')}</span><span><small>Devis accepté</small><b>20 200,00 €</b></span></div>
<div class="float f2"><span class="chip">{ic('chart')}</span><span><small>Plafond micro</small><b>15 %</b></span></div>
</div>
</div></section>

<section><div class="wrap">
<h2 class="rv">Trois gestes. <mark class="mint">C'est tout.</mark></h2>
<p class="sub rv">Pas de menus à rallonge : l'essentiel est sous le pouce, comme dans votre poche.</p>
<div class="gestes">
<div class="tile sky rv"><span class="plus">{ic('plus')}</span><span class="num">1</span><h3>Devis</h3><p>Préparez-le sur place, en quelques lignes. Vos prestations habituelles se remplissent toutes seules.</p></div>
<div class="tile mint rv"><span class="plus">{ic('plus')}</span><span class="num">2</span><h3>Facture</h3><p>Le devis accepté devient facture en un clic. Acompte, avoir et relance inclus.</p></div>
<div class="tile lilac rv"><span class="plus">{ic('plus')}</span><span class="num">3</span><h3>Chantier</h3><p>Corps de métier, planning, devis et factures réunis au même endroit.</p></div>
</div>
</div></section>

<section id="fonctions"><div class="wrap">
<h2 class="rv">Tout ce qu'il faut. <mark class="lemon">Rien de trop.</mark></h2>
<p class="sub rv">Pensé pour des gens qui n'ont pas le temps : peu de boutons, tout au bon endroit.</p>
<div class="bento">
<div class="b sky s3 rv"><span class="chip">{ic('doc')}</span><h3>Des documents qui font sérieux</h3><p>Devis et factures en PDF avec vos mentions légales, votre assurance et votre IBAN. Envoyés par WhatsApp, e-mail ou SMS en un geste.</p><img class="paper" src="img/facture.webp" alt="Exemple de facture générée par AUNE" width="900" height="633" loading="lazy"></div>
<div class="b lemon s3 rv"><span class="chip">{ic('shield')}</span><h3>Facture électronique Factur-X</h3><p>Un PDF lisible avec les données de la facture intégrées, pour vos clients professionnels. Prêt pour l'obligation de 2027.</p>
<div class="file">{ic('doc')}<span>FAC-2026-014-factur-x.pdf<small>PDF/A-3 · XML intégré · norme EN 16931</small></span></div>
<div class="badges"><span class="badge">Vérifié avec les outils officiels</span><span class="badge">Envoi à une plateforme agréée : bientôt</span></div></div>
<div class="b mint s2 rv"><span class="chip">{ic('chart')}</span><h3>Votre chiffre d'affaires</h3><p>Par mois et par trimestre, avec le plafond de la micro-entreprise.</p><div class="big">12 400 €</div><div class="bar2"><i style="width:15%"></i></div><p style="font-size:14px">15 % du plafond</p></div>
<div class="b coral s2 rv"><span class="chip">{ic('user')}</span><h3>Vos clients</h3><p>Le carnet se remplit tout seul.</p>
<div class="mini"><div class="row"><i class="av" style="background:var(--lilac)">DU</i><span>M. et Mme Dupont<small>06 12 34 56 78</small></span><em>1 500 €</em></div><div class="row"><i class="av" style="background:var(--sky)">BS</i><span>SARL Bati Sud<small>Pro · SIREN</small></span></div></div></div>
<div class="b lilac s2 rv"><span class="chip">{ic('site')}</span><h3>Vos chantiers</h3><p>Chaque corps de métier, son avancement.</p>
<div class="mini"><div class="row"><span>Maçonnerie<small>Terminé</small></span><em>✓</em></div><div class="row"><span>Électricité<small>En cours</small></span><div style="width:70px"><div class="bar2"><i style="width:60%"></i></div></div></div></div></div>
<div class="b white s3 rv"><span class="chip" style="background:var(--sky-s)">{ic('sync')}</span><h3>Sur tous vos appareils</h3><p>Connectez-vous par un lien reçu par e-mail, sans mot de passe. Vos données suivent sur téléphone et ordinateur.</p></div>
<div class="b ink s3 rv"><span class="chip">{ic('off')}</span><h3>Marche sans réseau</h3><p>Sur un chantier sans signal, tout fonctionne. La synchronisation se fait au retour du réseau.</p></div>
<div class="b white s2 rv"><span class="chip" style="background:var(--mint-s)">{ic('euro')}</span><h3>Acompte en un clic</h3><p>30 % du devis, la facture finale déduit tout.</p></div>
<div class="b white s2 rv"><span class="chip" style="background:var(--coral-s)">{ic('send')}</span><h3>Relances prêtes</h3><p>Un message poli, avec le montant et l'IBAN.</p></div>
<div class="b white s2 rv"><span class="chip" style="background:var(--lemon-s)">{ic('bolt')}</span><h3>Avoirs et verrouillage</h3><p>Une facture envoyée ne se modifie plus : on la corrige par un avoir.</p></div>
</div>
</div></section>

<section><div class="wrap">
<h2 class="rv">Pour <mark class="coral">tous les corps de métier</mark>.</h2>
<p class="sub rv">Maçon, plombier, électricien… chacun retrouve ses prestations et ses prix habituels.</p>
<div class="trades rv"><span>Maçonnerie</span><span>Plomberie</span><span>Électricité</span><span>Peinture</span><span>Carrelage</span><span>Charpente</span><span>Couverture</span><span>Menuiserie</span><span>Chauffage</span><span>Plâtrerie</span><span>Isolation</span><span>Terrassement</span><span>Paysage</span><span>Façade</span></div>
</div></section>

<section><div class="wrap">
<h2 class="rv">L'appli, <mark class="sky">en vrai</mark>.</h2>
<p class="sub rv">Des captures de l'application, pas des maquettes.</p>
</div>
<div class="wrap"><div class="shots rv">
<figure><div class="phone"><img src="img/m-devis.webp" alt="Un devis dans AUNE" width="640" height="1385" loading="lazy"></div><figcaption>Un devis clair<small>Quelques lignes, un total, un envoi</small></figcaption></figure>
<figure><div class="phone"><img src="img/m-fact.webp" alt="La liste des factures dans AUNE" width="640" height="1385" loading="lazy"></div><figcaption>Vos factures<small>Encaissées, en attente, en retard</small></figcaption></figure>
<figure><div class="phone"><img src="img/m-cli.webp" alt="Les clients dans AUNE" width="640" height="1385" loading="lazy"></div><figcaption>Vos clients<small>Tout ce qu'ils vous doivent</small></figcaption></figure>
<figure><div class="phone"><img src="img/m-ca.webp" alt="Le chiffre d'affaires dans AUNE" width="640" height="1385" loading="lazy"></div><figcaption>Votre chiffre d'affaires<small>Par trimestre, avec le plafond</small></figcaption></figure>
</div></div></section>

<section id="installer"><div class="wrap">
<h2 class="rv">Installez-la <mark class="mint">comme une appli</mark>.</h2>
<p class="sub rv">Pas de boutique d'applications : ouvrez AUNE dans votre navigateur et ajoutez-la à l'écran d'accueil. Elle s'ouvre ensuite en plein écran.</p>
<div class="steps3">
<div class="step rv"><span class="chip" style="background:var(--lilac-s)">{ic('phone')}</span><h3>iPhone</h3><ol><li>Ouvrez AUNE dans <b>Safari</b></li><li>Touchez <b>Partager</b></li><li><b>Sur l'écran d'accueil</b></li></ol></div>
<div class="step rv"><span class="chip" style="background:var(--mint-s)">{ic('phone')}</span><h3>Android</h3><ol><li>Ouvrez AUNE dans <b>Chrome</b></li><li>Touchez le menu <b>⋮</b></li><li><b>Installer l'application</b></li></ol></div>
<div class="step rv"><span class="chip" style="background:var(--sky-s)">{ic('laptop')}</span><h3>Ordinateur</h3><ol><li>Ouvrez AUNE dans <b>Chrome</b> ou <b>Edge</b></li><li>Cliquez sur l'icône d'installation dans la barre d'adresse</li></ol></div>
</div>
<p style="margin-top:28px"><a class="btn primary" href="app/">Ouvrir AUNE {ic('arrow')}</a></p>
</div></section>

<section id="tarifs"><div class="wrap">
<h2 class="rv">Gratuit pour commencer. <mark class="lemon">Pro</mark> quand il le faut.</h2>
<p class="sub rv">Vos devis et factures restent gratuits, sans limite. Le Pro ajoute la synchronisation, la facture électronique et le suivi du chiffre d'affaires.</p>
<div class="price">
<div class="plan rv"><h3>Gratuit</h3><div class="amt">0 €</div><p style="margin:0;color:var(--muted)">Sans compte, sur un appareil.</p>
<ul><li>Devis, factures et avoirs en PDF, sans limite</li><li>Clients, chantiers, planning</li><li>Acompte, relance, duplication</li><li>Sauvegarde par export</li><li class="no">Synchronisation entre appareils</li><li class="no">Facture électronique Factur-X</li><li class="no">Suivi du chiffre d'affaires</li></ul>
<a class="btn" href="app/">Commencer gratuitement</a></div>
<div class="plan pro rv"><span class="tag">30 jours offerts</span><h3>Pro</h3><div class="amt">9 € <small>/ mois</small></div><p style="margin:0;opacity:.8">ou <b>90 € par an</b> : 2 mois offerts</p>
<ul><li>Tout le plan Gratuit</li><li>Synchronisation téléphone et ordinateur</li><li>Facture électronique Factur-X</li><li>Suivi du chiffre d'affaires, plafond et livre des recettes</li><li>Essai de 30 jours, sans carte bancaire</li><li>Résiliation en un clic</li></ul>
<a class="btn primary" href="app/">Essayer 30 jours gratuitement</a></div>
</div>
<p class="legalnote">Prix nets : TVA non applicable, article 293 B du CGI. Paiement sécurisé par Stripe.</p>
</div></section>

<section id="faq"><div class="wrap">
<h2 class="rv">Questions fréquentes</h2><p class="sub"></p>
<div class="faq">
{FAQ_HTML}
</div>
</div></section>

<section style="padding-top:20px"><div class="wrap"><div class="final rv">
<h2>Prêt à gagner du temps ?</h2>
<p>Ouvrez AUNE, créez votre premier devis, et voyez si ça vous va. Gratuit, sans carte bancaire.</p>
<a class="btn white" href="app/">Ouvrir l'appli {ic('arrow')}</a>
</div></div></section>
</main>
<div class="sticky" id="sticky"><a class="btn primary" href="app/">Ouvrir l'appli {ic('arrow')}</a></div>
'''+SCRIPT_JS+f'''''' + FOOTER

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
