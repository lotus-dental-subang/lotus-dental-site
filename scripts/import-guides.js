// ONE-TIME: turn the 9 existing guide pages (site/<slug>/index.html) into editable article files
// (content/guides/<slug>.md). After this, the article files are the source; scripts/build.js makes the pages.
// Run: npm run import-guides
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const TurndownService = require('turndown');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'content', 'guides');
fs.mkdirSync(OUT, { recursive: true });

const SLUGS = ['braces-price-in-selangor', 'dental-implants-in-malaysia', 'filling-teeth-price-in-malaysia',
  'invisalign-malaysia', 'myobrace-malaysia', 'root-canal-treatment-price-in-malaysia',
  'teeth-scaling-price-in-malaysia', 'teeth-whitening-price-in-malaysia', 'wisdom-tooth-extraction-cost-in-malaysia'];

const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;|&#039;|&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = s => unescape(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*', codeBlockStyle: 'fenced' });
td.addRule('figure', { filter: 'figure', replacement: (content) => '\n\n' + content.trim() + '\n\n' });

let n = 0;
for (const slug of SLUGS) {
  const s = fs.readFileSync(path.join(SITE, slug, 'index.html'), 'utf8');
  const pick = (re) => { const m = s.match(re); return m ? m[1] : ''; };
  const title = strip(pick(/<main class="post">[\s\S]*?<h1>([\s\S]*?)<\/h1>/));
  const description = unescape(pick(/<meta name="description" content="([^"]*)"/));
  const date = pick(/"datePublished": "([^"]+)"/);
  const image = pick(/<div class="hero-img">\s*<img src="([^"]+)"/);
  const note = strip(pick(/<p class="note">([\s\S]*?)<\/p>/));
  const topic = strip(pick(/<div class="cta">\s*<div><h2>Questions about ([^<?]*)\?/));
  let body = s.slice(s.indexOf('<article class="body">') + '<article class="body">'.length, s.indexOf('</article>'));
  body = body
    .replace(/<(h[2-4])>\s*<strong>([\s\S]*?)<\/strong>\s*<\/\1>/g, '<$1>$2</$1>')            // headings: no bold inside
    .replace(/<a [^>]*data-wa="[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '<a href="whatsapp">$1</a>')     // WhatsApp links -> placeholder
    .replace(/\s(loading|decoding|target|rel)="[^"]*"/g, '');
  const md = td.turndown(body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
  const fm = { title, description, date, image, topic, note };
  fs.writeFileSync(path.join(OUT, slug + '.md'), matter.stringify(md, fm));
  n++;
  console.log('imported', slug, '|', title, '|', date, '| topic:', topic, '| words:', md.split(/\s+/).length);
}
console.log(n + ' guides written to content/guides/');
