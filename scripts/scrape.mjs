import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {htmlToMdx, docPathFromUrl} from './lib/scrape.mjs';

// Usage: npm run scrape -- <https://docs.cloudfoundry.org/path/page.html> [...more urls]
// Writes docs/<url path>.mdx and downloads images to static/img/<section>/.

async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

async function scrapeOne(pageUrl) {
  const hasDoc = p => existsSync(join('docs', `${p}.mdx`));
  const html = await (await fetchOk(pageUrl)).text();
  const {mdx, title, images} = htmlToMdx(html, {pageUrl, hasDoc});

  const dest = join('docs', `${docPathFromUrl(pageUrl)}.mdx`);
  mkdirSync(dirname(dest), {recursive: true});
  writeFileSync(dest, mdx);

  for (const [src, sitePath] of images) {
    const file = join('static', sitePath);
    mkdirSync(dirname(file), {recursive: true});
    writeFileSync(file, Buffer.from(await (await fetchOk(src)).arrayBuffer()));
  }
  console.log(`"${title}" -> ${dest} (${images.size} image${images.size === 1 ? '' : 's'})`);
}

async function main() {
  const urls = process.argv.slice(2);
  if (!urls.length) {
    console.error('Usage: npm run scrape -- <https://docs.cloudfoundry.org/...html> [...]');
    process.exit(1);
  }
  for (const u of urls) {
    if (new URL(u).hostname !== 'docs.cloudfoundry.org') throw new Error(`Not a docs.cloudfoundry.org URL: ${u}`);
    await scrapeOne(u);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
