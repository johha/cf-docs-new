import {parse} from 'node-html-parser';
import {noteKindFromClass} from './transform.mjs';

const HOST = 'docs.cloudfoundry.org';
const SKIP_CLASSES = ['js-quick-links', 'quick-links', 'to-top'];
const SKIP_IDS = new Set(['modified-date', 'repo-link', 'top']);

// --- URL helpers -----------------------------------------------------------

export function docPathFromUrl(pageUrl) {
  const p = new URL(pageUrl).pathname.replace(/\.html$/i, '').replace(/^\/+|\/+$/g, '');
  return p || 'index';
}

/**
 * Rewrite an href found on `pageUrl`. Links to pages that exist in this site
 * (`hasDoc(docPath)`) become site routes; everything else becomes an absolute
 * docs.cloudfoundry.org URL so `onBrokenLinks: 'throw'` never trips.
 */
export function resolveHref(href, pageUrl, hasDoc) {
  if (!href || /^(mailto:|tel:)/i.test(href)) return href;
  if (href.startsWith('#')) return href;
  let url;
  try { url = new URL(href, pageUrl); } catch { return href; }
  if (url.hostname !== HOST) return url.href;
  const docPath = docPathFromUrl(url.href);
  if (hasDoc(docPath)) {
    const route = docPath.replace(/(^|\/)index$/, '$1');
    return '/' + route + url.hash;
  }
  return url.href;
}

// --- Inline conversion -----------------------------------------------------

function escapeText(s) {
  return s.replace(/\\/g, '\\\\').replace(/([{}])/g, '\\$1').replace(/</g, '&lt;');
}

function inlineCode(s) {
  const t = s.replace(/\s+/g, ' ');
  const fence = t.includes('`') ? '``' : '`';
  return `${fence}${t}${fence}`;
}

function inline(node, ctx) {
  if (node.nodeType === 3) return escapeText(node.rawText.replace(/\s+/g, ' '));
  if (node.nodeType !== 1) return '';
  const tag = node.rawTagName.toLowerCase();
  const kids = () => node.childNodes.map(n => inline(n, ctx)).join('');
  switch (tag) {
    case 'code': return inlineCode(node.text);
    case 'strong': case 'b': { const k = kids().trim(); return k ? `**${k}**` : ''; }
    case 'em': case 'i': { const k = kids().trim(); return k ? `*${k}*` : ''; }
    case 'br': return '<br/>';
    case 'a': {
      if (node.getAttribute('id') && !node.getAttribute('href')) return '';
      const href = resolveHref(node.getAttribute('href'), ctx.pageUrl, ctx.hasDoc);
      const text = kids().trim();
      return href ? `[${text}](${href})` : text;
    }
    case 'img': return image(node, ctx);
    case 'span': case 'small': case 'sup': case 'sub': return kids();
    default: return kids();
  }
}

function image(node, ctx) {
  const src = node.getAttribute('src');
  const alt = (node.getAttribute('alt') || '').replace(/\s+/g, ' ').replace(/[\[\]]/g, '');
  const abs = new URL(src, ctx.pageUrl).href;
  const file = decodeURIComponent(new URL(abs).pathname.split('/').pop());
  const section = docPathFromUrl(ctx.pageUrl).split('/')[0];
  const sitePath = `/img/${section}/${file}`;
  ctx.images.set(abs, sitePath);
  return `![${alt}](${sitePath})`;
}

// --- Tables ----------------------------------------------------------------

/** Row accent for the result column: 'bad' (latency found), 'ok' (none), or ''. */
export function classifyOutcome(text) {
  if (!/latency/i.test(text)) return '';
  if (/\bbut not\b/i.test(text)) return '';
  if (/\b(does not|doesn't|no)\b[^.]*latency/i.test(text)) return 'ok';
  if (/\bshows?\b[^.]*latency/i.test(text)) return 'bad';
  return '';
}

function cellMd(cell, ctx) {
  const parts = [];
  for (const n of cell.childNodes) {
    const tag = n.nodeType === 1 ? n.rawTagName.toLowerCase() : '';
    if (tag === 'ul' || tag === 'ol') {
      n.querySelectorAll('li').forEach((li, i) =>
        parts.push(`${tag === 'ol' ? `${i + 1}.` : '•'} ${inlineChildren(li, ctx)}`));
    } else if (tag === 'p') {
      parts.push(inlineChildren(n, ctx));
    } else {
      parts.push(inline(n, ctx));
    }
  }
  const joined = parts.join(parts.length > 1 && cell.querySelector('ul,ol,p') ? '<br/>' : '');
  return joined.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

function inlineChildren(node, ctx) {
  return node.childNodes.map(n => inline(n, ctx)).join('').trim();
}

function table(node, ctx) {
  const rows = node.querySelectorAll('tr');
  if (!rows.length) return '';
  const headRow = node.querySelector('thead tr') || rows[0];
  const headers = headRow.querySelectorAll('th,td').map(c => cellMd(c, ctx));
  const body = rows.filter(r => r !== headRow);
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const tr of body) {
    const cells = tr.querySelectorAll('td,th').map(c => cellMd(c, ctx));
    if (!cells.length) continue;
    const mark = classifyOutcome(tr.querySelector('td,th').text);
    if (mark) cells[0] = `<span className="cf-r cf-r--${mark}" />${cells[0]}`;
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return `<div className="cf-table">\n\n${lines.join('\n')}\n\n</div>`;
}

// --- Block conversion ------------------------------------------------------

function codeBlock(node) {
  // node-html-parser keeps <pre> contents as raw text, so re-parse to drop inner tags.
  const text = parse(node.innerHTML.replace(/<\/?p>/g, '')).text.replace(/^\n+|\s+$/g, '');
  const m = (node.getAttribute('class') || '').match(/highlight\s+(\w+)/);
  const lang = m && m[1] !== 'plaintext' ? m[1] : '';
  const fence = text.includes('```') ? '````' : '```';
  return `${fence}${lang}\n${text}\n${fence}`;
}

const LI_BLOCKS = new Set(['ul', 'ol', 'p', 'pre', 'table', 'div', 'blockquote', 'hr']);

function indentLines(text, indent) {
  return text.split('\n').map(l => (l ? indent + l : l)).join('\n');
}

function list(node, ctx) {
  const ordered = node.rawTagName.toLowerCase() === 'ol';
  const items = node.childNodes.filter(n => n.nodeType === 1 && n.rawTagName.toLowerCase() === 'li');
  return items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const indent = ' '.repeat(marker.length);
    const chunks = [];
    let run = [];
    const flush = () => { const t = run.join('').replace(/\s+/g, ' ').trim(); if (t) chunks.push(t); run = []; };
    for (const n of li.childNodes) {
      const tag = n.nodeType === 1 ? n.rawTagName.toLowerCase() : '';
      if (LI_BLOCKS.has(tag)) {
        flush();
        const md = blocks([n], ctx);
        if (md) chunks.push(md);
      } else run.push(inline(n, ctx));
    }
    flush();
    const [first = '', ...rest] = chunks;
    // Tight when every follow-up chunk is a nested list; otherwise separate with a blank line.
    const body = rest.reduce((acc, c) => acc + (/^(- |\d+\. )/.test(c) ? '\n' : '\n\n') + c, first);
    return marker + indentLines(body, indent).slice(indent.length);
  }).join('\n');
}

function blocks(nodes, ctx) {
  const out = [];
  for (const n of nodes) {
    if (n.nodeType === 3) {
      const t = n.rawText.trim();
      if (t) out.push(escapeText(t));
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = n.rawTagName.toLowerCase();
    const cls = n.getAttribute('class') || '';
    if (SKIP_IDS.has(n.getAttribute('id')) || SKIP_CLASSES.some(c => cls.split(/\s+/).includes(c))) continue;
    if (tag === 'a' && n.getAttribute('id') && !n.getAttribute('href')) continue;
    if (/^h[1-6]$/.test(tag)) { out.push(heading(n, ctx)); continue; }
    switch (tag) {
      case 'p': {
        const kind = noteKindFromClass(cls);
        const text = inlineChildren(n, ctx)
          .replace(/^\*\*(Note|Warning|Important|Caution):?\*\*:?\s*/i, '');
        if (kind) out.push(`:::${kind}\n${text}\n:::`);
        else if (text) out.push(text);
        break;
      }
      case 'ul': case 'ol': out.push(list(n, ctx)); break;
      case 'pre': out.push(codeBlock(n)); break;
      case 'table': out.push(table(n, ctx)); break;
      case 'hr': out.push('---'); break;
      case 'blockquote': out.push(blocks(n.childNodes, ctx).split('\n').map(l => `> ${l}`).join('\n')); break;
      case 'div': case 'section': case 'article': { const b = blocks(n.childNodes, ctx); if (b) out.push(b); break; }
      case 'script': case 'style': break;
      default: { const t = inline(n, ctx).trim(); if (t) out.push(t); }
    }
  }
  return out.join('\n\n');
}

function heading(node, ctx) {
  const level = Number(node.rawTagName[1]);
  // Legacy pages hide the anchor other links point at in `<a id="x"></a>`.
  const anchor = node.querySelector('a[id]')?.getAttribute('id') || node.getAttribute('id');
  const text = node.childNodes.map(n => inline(n, ctx)).join('').replace(/\s+/g, ' ').trim();
  return `${'#'.repeat(level)} ${text}${anchor ? ` {#${anchor}}` : ''}`;
}

// --- Page ------------------------------------------------------------------

// Browsers implicitly end an unclosed <p> at a block element; node-html-parser
// does not, so legacy pages with `<p>text<pre>` or `<p>text<table>` mis-nest.
export function closeOpenParagraphs(html) {
  return html.replace(/(<p(?:\s[^>]*)?>(?:(?!<\/p>|<p[\s>])[\s\S])*?)(?=<(?:pre|table|ul|ol|div)[\s>])/gi, '$1</p>');
}

/**
 * Convert a rendered docs.cloudfoundry.org page into MDX.
 * Returns {mdx, title, images} where images maps absolute image URLs to the
 * site path they were rewritten to.
 */
export function htmlToMdx(html, {pageUrl, hasDoc = () => false}) {
  const root = parse(closeOpenParagraphs(html));
  const main = root.querySelector('main#js-content') || root.querySelector('main') || root.querySelector('body');
  if (!main) throw new Error('No <main> content found');
  const h1 = main.querySelector('h1');
  const title = (h1?.text || root.querySelector('title')?.text || '').replace(/\s+/g, ' ').trim();
  h1?.remove();
  const ctx = {pageUrl, hasDoc, images: new Map()};
  const body = blocks(main.childNodes, ctx);
  const esc = title.replace(/"/g, '\\"');
  return {mdx: `---\ntitle: "${esc}"\n---\n\n${body}\n`, title, images: ctx.images};
}
