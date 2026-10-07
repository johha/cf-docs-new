import {readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync} from 'node:fs';
import {join, relative, dirname, basename, extname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolveSource} from './lib/sources.mjs';
import * as t from './lib/transform.mjs';
import {rewriteTables} from './lib/tables.mjs';
import {splitFrontmatter, assembleMdx} from './lib/mdx.mjs';

const SRC_SUFFIX = '.html.md.erb';

function walk(dir, filterExt) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { if (name !== '.git') out.push(...walk(p, filterExt)); }
    else if (filterExt(p)) out.push(p);
  }
  return out;
}

function convertBody(raw) {
  let text = raw;
  text = t.stripErbComments(text);
  const varsUsed = t.findVarRefs(text);
  const partials = t.findPartialRefs(text);
  text = t.rewriteVarRefs(text);
  text = t.rewritePartialRefs(text);
  text = t.rewriteNoteBlocks(text);
  text = t.stripHeadingAnchors(text);
  text = t.rewriteInternalLinks(text);
  text = t.rewriteImagePaths(text);
  const {text: tabled, keptHtml} = rewriteTables(text);
  const normalized = t.normalizeVoidTags(tabled);
  const repaired = t.repairHtml(normalized);
  return {body: repaired, varsUsed, partials, keptHtml};
}

async function main() {
  const srcRoot = resolveSource('concepts', process.argv[2]);
  const varKeys = new Set(Object.keys(
    (await import(pathToFileURL(join(process.cwd(), 'src/data/vars.js')).href)).vars));

  const outDocs = 'docs/concepts';
  const outPartials = join(outDocs, '_partials');
  const outImg = 'static/img/concepts';
  rmSync(outDocs, {recursive: true, force: true});
  mkdirSync(outPartials, {recursive: true});
  mkdirSync(outImg, {recursive: true});

  const report = {kept: [], unknownVars: new Set(), missingPartials: new Set(), errors: [], files: 0};
  const erbs = walk(srcRoot, p => p.endsWith(SRC_SUFFIX));

  // index of available partial source names (without leading _)
  const partialSources = new Set(
    erbs.filter(p => basename(p).startsWith('_'))
        .map(p => basename(p).slice(1, -SRC_SUFFIX.length)));

  for (const file of erbs) {
    try {
      const rel = relative(srcRoot, file);
      const name = basename(file);
      const isPartial = name.startsWith('_');
      const raw = readFileSync(file, 'utf8');
      const {frontmatter, body: rawBody} = splitFrontmatter(raw);
      const {body, varsUsed, partials, keptHtml} = convertBody(rawBody);

      for (const v of varsUsed) if (!varKeys.has(v)) report.unknownVars.add(v);
      for (const pr of partials) if (!partialSources.has(pr)) report.missingPartials.add(pr);
      for (const k of keptHtml) report.kept.push({file: rel, reason: k.reason});

      const partialsUsed = partials.map(pr => ({component: t.toPascalCase(pr), file: t.toPascalCase(pr)}));

      let destPath;
      if (isPartial) {
        destPath = join(outPartials, t.toPascalCase(name.slice(1, -SRC_SUFFIX.length)) + '.mdx');
      } else {
        destPath = join(outDocs, rel.slice(0, -SRC_SUFFIX.length) + '.mdx');
      }

      // Compute relative path from this file's directory to the _partials dir.
      // normalize to forward slashes; ensure it starts with ./ or ../
      let partialsDir = relative(dirname(destPath), outPartials).replace(/\\/g, '/');
      if (!partialsDir.startsWith('.')) partialsDir = './' + partialsDir;

      const mdx = assembleMdx({frontmatter, body, varsUsed: varsUsed.length > 0, partialsUsed, isPartial, partialsDir});
      mkdirSync(dirname(destPath), {recursive: true});
      writeFileSync(destPath, mdx);
      report.files++;
    } catch (e) {
      report.errors.push({file: relative(srcRoot, file), message: e.message});
    }
  }

  // copy images
  const imgSrc = join(srcRoot, 'images');
  try {
    for (const img of walk(imgSrc, () => true)) {
      const rel = relative(imgSrc, img);
      const dest = join(outImg, rel);
      mkdirSync(dirname(dest), {recursive: true});
      copyFileSync(img, dest);
    }
  } catch { /* no images dir */ }

  const lines = [];
  lines.push(`# Migration report`);
  lines.push(`Files converted: ${report.files}`);
  lines.push(`\n## Tables kept as HTML (${report.kept.length})`);
  for (const k of report.kept) lines.push(`- ${k.file}: ${k.reason}`);
  lines.push(`\n## Unknown vars (${report.unknownVars.size})`);
  for (const v of report.unknownVars) lines.push(`- vars.${v}`);
  lines.push(`\n## Missing partials (${report.missingPartials.size})`);
  for (const p of report.missingPartials) lines.push(`- ${p}`);
  lines.push(`\n## Errors (${report.errors.length})`);
  for (const e of report.errors) lines.push(`- ${e.file}: ${e.message}`);
  writeFileSync('migration-report.txt', lines.join('\n') + '\n');
  console.log(`Converted ${report.files} files. Kept ${report.kept.length} HTML tables, ` +
    `${report.unknownVars.size} unknown vars, ${report.errors.length} errors. See migration-report.txt.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
