const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'warming-mats.json');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'mat-page.html');
const PROGRAMMATIC_PREFIX = 'programmatic';
const OUTPUT_DIR = path.join(__dirname, '..', PROGRAMMATIC_PREFIX);

const BASE_URL = 'https://www.warmingmat.shop';

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTemplate(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function get(obj, key) {
  if (!key || !obj) return undefined;
  return key.split('.').reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
      return acc[part];
    }
    return undefined;
  }, obj);
}

function render(template, data) {
  // Section handling for arrays
  template = template.replace(/{{#(\w+)}}([\s\S]*?){{\/(\w+)}}/g, (match, key, content, closing) => {
    if (key !== closing) return '';
    const value = get(data, key);
    if (!Array.isArray(value) || value.length === 0) {
      return '';
    }
    return value.map((item) => {
      if (item && typeof item === 'object') {
        return render(content, { ...data, ...item });
      }
      return render(content.replace(/{{\.}}/g, item), data);
    }).join('');
  });

  // Simple value replacements including dot notation
  return template.replace(/{{(\w+(?:\.\w+)*)}}/g, (match, key) => {
    const value = get(data, key);
    return value !== undefined && value !== null ? String(value) : '';
  });
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writePage(slug, content) {
  const dir = path.join(OUTPUT_DIR, slug);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), content, 'utf8');
}

function updateSitemap(urlPaths) {
  const urls = [
    {
      loc: `${BASE_URL}/`,
      priority: '1.0',
      changefreq: 'weekly'
    },
    ...urlPaths.map((pathSegment) => ({
      loc: `${BASE_URL}/${pathSegment}/`,
      priority: '0.7',
      changefreq: 'monthly'
    }))
  ];

  const today = new Date().toISOString().split('T')[0];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => {
      return `  <url>\n    <loc>${url.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${url.changefreq}</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`;
    }),
    '</urlset>'
  ].join('\n');

  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), xml, 'utf8');
}

function main() {
  const template = readTemplate(TEMPLATE_PATH);
  const pages = readJSON(DATA_PATH);

  const urlPaths = [];

  pages.forEach((page) => {
    const urlPath = `${PROGRAMMATIC_PREFIX}/${page.slug}`;
    const enriched = {
      ...page,
      secondaryKeywordsList: Array.isArray(page.secondaryKeywords) ? page.secondaryKeywords.join(', ') : '',
      urlPath,
    };
    const output = render(template, enriched);
    writePage(page.slug, output);
    urlPaths.push(urlPath);
  });

  updateSitemap(urlPaths);
  console.log(`Generated ${urlPaths.length} programmatic page(s) and updated sitemap.`);
}

main();
