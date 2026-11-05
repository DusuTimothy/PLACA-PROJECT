#!/usr/bin/env node

/**
 * Post-build metadata for the public site.
 *
 * There is no fixed public domain yet, so `public/index.html` ships relative
 * canonical and hreflang URLs. Those work on any host and never point search
 * engines at a domain that does not exist.
 *
 * When a domain is assigned, set SITE_URL at build time:
 *
 *   SITE_URL=https://placa.example.gov.ng npm run build
 *
 * This script then rewrites the marked tags to absolute URLs, writes
 * `dist/sitemap.xml`, and adds a Sitemap line to `dist/robots.txt`. Without
 * SITE_URL it exits without changing anything.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const indexPath = path.join(distDir, 'index.html');

if (!existsSync(indexPath)) {
  console.error('[site-meta] dist/index.html not found. Run `vite build` first.');
  process.exit(1);
}

const configured = (process.env.SITE_URL || '').trim();

if (!configured) {
  console.log(
    '[site-meta] SITE_URL is not set; keeping relative canonical URLs and skipping sitemap.xml.'
  );
  process.exit(0);
}

let siteUrl;
try {
  const parsed = new URL(configured);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('SITE_URL must start with http:// or https://');
  }
  siteUrl = parsed.href.replace(/\/+$/, '');
} catch (error) {
  console.error(`[site-meta] Invalid SITE_URL "${configured}": ${error.message}`);
  process.exit(1);
}

// Rewrite only tags that opt in with data-site-url. Nothing else in the page
// uses that attribute, so links inside the document are left alone.
let html = await readFile(indexPath, 'utf8');
html = html.replace(/<(?:link|meta)\b[^>]*data-site-url="[^"]*"[^>]*>/g, (tag) => {
  const relative = /data-site-url="([^"]*)"/.exec(tag)[1];
  const absolute = `${siteUrl}${relative}`;
  return tag.replace(/(href|content)="[^"]*"/, (_match, attribute) => {
    return `${attribute}="${absolute}"`;
  });
});
// og:url must be absolute, so it only exists in builds that know the domain.
if (!/property="og:url"/.test(html)) {
  html = html.replace(
    /<meta property="og:site_name" content="PLACA" \/>/,
    `<meta property="og:site_name" content="PLACA" />\n    <meta property="og:url" content="${siteUrl}/" />`
  );
}

await writeFile(indexPath, html);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${siteUrl}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/?lang=en" />
    <xhtml:link rel="alternate" hreflang="ha" href="${siteUrl}/?lang=ha" />
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
await writeFile(path.join(distDir, 'sitemap.xml'), sitemap);

const robotsPath = path.join(distDir, 'robots.txt');
if (existsSync(robotsPath)) {
  const robots = await readFile(robotsPath, 'utf8');
  if (!/^Sitemap:/m.test(robots)) {
    await writeFile(robotsPath, `${robots.trimEnd()}\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
  }
}

console.log(`[site-meta] Canonical URLs set to ${siteUrl} and sitemap.xml written.`);
