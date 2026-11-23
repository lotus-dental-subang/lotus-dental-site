// Builds the article pages from content/guides/*.md:
//   site/<slug>/index.html   one page per article (same address forever = good for Google)
//   site/blog/index.html     the list of all guides
//   site/sitemap.xml         home + guides list + every article
// The home page (site/index.html) is hand-built and never touched here.
// Run: npm run build   (Cloudflare runs this by itself after every publish)
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const SRC = path.join(ROOT, 'content', 'guides');
const C = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.json'), 'utf8'));

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
const day = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const iso = d => { if (d instanceof Date) return d.toISOString().slice(0, 10); return String(d || '').slice(0, 10); };
const cleanSlug = s => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
const abs = u => !u ? '' : /^https?:/.test(u) ? u : C.domain + (u.startsWith('/') ? u : '/' + u);

const WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.39 9.39 0 0 1-1.44-5.01c0-5.19 4.23-9.42 9.43-9.42a9.37 9.37 0 0 1 9.42 9.43c0 5.2-4.23 9.42-9.43 9.42zm8.02-17.44A11.27 11.27 0 0 0 12.05.75C5.8.75.71 5.84.71 12.09c0 2 .52 3.95 1.52 5.66L.62 23.62l6.01-1.58a11.32 11.32 0 0 0 5.42 1.38c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.33-8.02z"/></svg>';
const PHONE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>';
const waBtn = (label, msg, tag) => `<a class="btn" href="https://wa.me/${C.whatsapp}" data-wa="${esc(msg)}" data-tag="${esc(tag)}" target="_blank" rel="noopener">${esc(label)}<i>${WA_SVG}</i></a>`;

// ---- read articles (files with draft: true are skipped)
const guides = fs.readdirSync(SRC).filter(f => f.endsWith('.md')).map(f => {
  const { data, content } = matter(fs.readFileSync(path.join(SRC, f), 'utf8'));
  const slug = cleanSlug(data.slug || f.replace(/\.md$/, ''));
  const plain = content.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_>`]/g, '');
  const first = plain.split(/\n\s*\n/).map(x => x.trim()).find(x => x.length > 40) || '';
  const excerpt = first.length > 170 ? first.slice(0, 167).replace(/\s+\S*$/, '') + '…' : first;
  return { ...data, slug, date: iso(data.date), body: content, excerpt, file: f };
}).filter(g => !g.draft && g.title).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

// ---- markdown -> html, with Lotus rules for links and photos
function render(md, g) {
  const tag = 'Blog · ' + cap(g.topic || 'Guide');
  const msg = `Hi Lotus Dental, I read your guide and I'd like to ask about ${g.topic || 'a treatment'}.`;
  const renderer = new marked.Renderer();
  renderer.link = (href, title, text) => {
    if (href === 'whatsapp') return `<a href="https://wa.me/${C.whatsapp}" data-wa="${esc(msg)}" data-tag="${esc(tag)}" target="_blank" rel="noopener">${text}</a>`;
    const ext = /^https?:/.test(href) && !href.startsWith(C.domain);
    return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
  };
  renderer.image = (href, title, text) => `<img src="${esc(href)}" alt="${esc(text || g.title)}" loading="lazy" decoding="async">`;
  return marked.parse(md, { renderer, gfm: true });
}

const head = (title, desc, url, image, extra) => `<!doctype html>
<html lang="en-MY">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${C.staging ? '<!-- STAGING ONLY: set "staging": false in scripts/site.json at launch -->\n<meta name="robots" content="noindex, nofollow">\n' : ''}<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lotus Dental Clinic">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${abs(image || '/img/og.jpg')}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/guide.css">
${extra || ''}
</head>
<body>
<header class="mast">
  <a class="brand" href="/"><img src="/img/logo.png" alt="Lotus Dental Clinic logo" width="46" height="32"><span>Lotus Dental</span></a>
  <nav><a href="/">Home</a><a href="/#treatments">Treatments</a><a href="/blog/">Dental guides</a></nav>
  <a class="call" href="tel:${C.phone}" aria-label="Call Lotus Dental on ${C.phoneLabel}">${PHONE_SVG}<span>${C.phoneLabel}</span></a>
  ${waBtn('WhatsApp', "Hi Lotus Dental, I'd like to book an appointment.", 'Blog · Top menu')}
</header>`;

const foot = `<footer><div class="in">
  <div class="soc"><a href="${C.facebook}" target="_blank" rel="noopener">Facebook</a><a href="${C.instagram}" target="_blank" rel="noopener">Instagram</a><a href="${C.maps}" target="_blank" rel="noopener">Google Maps</a><a href="tel:${C.phone}">Call ${C.phoneLabel}</a></div>
  <p>© Lotus Dental Clinic · ${esc(C.address)} · ${esc(C.hours)}</p>
</div></footer>
<script>
document.querySelectorAll('[data-wa]').forEach(function (a) {
  a.href = 'https://wa.me/${C.whatsapp}?text=' + encodeURIComponent(a.dataset.wa + '\\n\\n(Web · ' + (a.dataset.tag || 'Blog') + ')');
});
</script>
</body>
</html>
`;

const card = g => `<a class="card" href="/${g.slug}/"><img src="${esc(g.image || '/img/og.jpg')}" alt="" loading="lazy" decoding="async"><div><small>${day(g.date)}</small><h3>${esc(g.title)}</h3><p>${esc(g.excerpt)}</p></div></a>`;

// ---- one page per article
let written = 0;
for (const g of guides) {
  const url = `${C.domain}/${g.slug}/`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: g.title, description: g.description, datePublished: g.date, image: abs(g.image || '/img/og.jpg'), mainEntityOfPage: url,
      author: { '@type': 'Organization', name: 'Lotus Dental Clinic' }, publisher: { '@type': 'Organization', name: 'Lotus Dental Clinic', logo: { '@type': 'ImageObject', url: abs('/img/logo.png') } } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: C.domain + '/' },
      { '@type': 'ListItem', position: 2, name: 'Dental guides', item: C.domain + '/blog/' },
      { '@type': 'ListItem', position: 3, name: g.title, item: url }] }] };
  const others = guides.filter(x => x.slug !== g.slug).slice(0, 3);
  const html = head(`${g.title} | Lotus Dental Subang Jaya`, g.description, url, g.image, `<script type="application/ld+json">${JSON.stringify(ld)}</script>`) + `
<main class="post">
  <div class="crumbs"><a href="/">Home</a> / <a href="/blog/">Dental guides</a></div>
  <div class="kick"><i class="pet"></i>Dental guide</div>
  <h1>${esc(g.title)}</h1>
  <div class="meta">By Lotus Dental Clinic, SS15 Subang Jaya · ${day(g.date)}</div>
  ${g.image ? `<div class="hero-img"><img src="${esc(g.image)}" alt="${esc(g.title)}" decoding="async"></div>` : ''}
  ${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
  <article class="body">
${render(g.body, g)}
  </article>
  <div class="cta">
    <div><h2>Questions about ${esc(g.topic || 'your teeth')}?</h2><p>Message us. Our dentists will reply and help you book a visit.</p></div>
    ${waBtn('Book on WhatsApp', `Hi Lotus Dental, I read your guide and I'd like to ask about ${g.topic || 'a treatment'}.`, 'Blog · ' + cap(g.topic || 'Guide'))}
  </div>
</main>
${others.length ? `<section class="related"><div class="kick"><i class="pet"></i>Keep reading</div><h2>More dental guides</h2><div class="cards">${others.map(card).join('')}</div></section>` : ''}
` + foot;
  fs.mkdirSync(path.join(SITE, g.slug), { recursive: true });
  fs.writeFileSync(path.join(SITE, g.slug, 'index.html'), html);
  written++;
}

// ---- the guides list
fs.mkdirSync(path.join(SITE, 'blog'), { recursive: true });
fs.writeFileSync(path.join(SITE, 'blog', 'index.html'),
  head('Dental guides | Lotus Dental Clinic, SS15 Subang Jaya', 'Simple guides about dental treatments and prices from Lotus Dental Clinic, a family dentist in SS15, Subang Jaya.', C.domain + '/blog/', '/img/og.jpg') + `
<main class="list">
  <div class="crumbs"><a href="/">Home</a> / Dental guides</div>
  <div class="kick"><i class="pet"></i>From our dentists</div>
  <h1>Dental guides</h1>
  <p class="intro">Simple answers about treatments, what to expect and what it costs. Questions? Message us on WhatsApp.</p>
  <div class="cards">${guides.map(card).join('')}</div>
</main>
` + foot);

// ---- sitemap
const urls = [{ loc: C.domain + '/', lastmod: new Date().toISOString().slice(0, 10) }, { loc: C.domain + '/blog/', lastmod: guides[0] ? guides[0].date : '' }]
  .concat(guides.map(g => ({ loc: `${C.domain}/${g.slug}/`, lastmod: g.updated ? iso(g.updated) : g.date })));
fs.writeFileSync(path.join(SITE, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n') + '\n</urlset>\n');

console.log(`built ${written} guide pages + /blog/ + sitemap (${urls.length} urls)${C.staging ? ' [staging: noindex on]' : ''}`);
