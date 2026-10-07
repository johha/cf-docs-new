export function toPascalCase(name) {
  return name.split(/[_-]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

export function stripErbComments(text) {
  return text
    .replace(/<%#[\s\S]*?%>/g, '')
    .replace(/^\[\/\/\]: # \(.*\)\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

export function rewriteNoteBlocks(text) {
  const convert = (cls, kind) =>
    text => text.replace(
      new RegExp(`<p class="${cls}">([\\s\\S]*?)</p>`, 'g'),
      (_, inner) => {
        const body = inner
          .replace(/<span class="note__title">[\s\S]*?<\/span>/g, '')
          .replace(/<strong>\s*(Note|Warning|Important)\s*<\/strong>/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim();
        return `\n:::${kind}\n${body}\n:::\n`;
      });
  let out = convert('note', 'note')(text);
  out = convert('warning', 'warning')(out);
  return out;
}

export function stripHeadingAnchors(text) {
  return text.replace(/^(#{1,6})\s*<a id=['"][^'"]*['"]><\/a>\s*/gm, '$1 ');
}

export function rewriteInternalLinks(text) {
  return text.replace(/\]\(([^)]+)\)/g, (m, target) => {
    if (/^(https?:|mailto:|#)/i.test(target)) return m;
    const fixed = target.replace(/\.html(#.*)?$/i, '$1');
    return `](${fixed})`;
  });
}

export function rewriteImagePaths(text) {
  return text.replace(/\]\(\.?\/?images\//g, '](./img/');
}

export function findVarRefs(text) {
  const set = new Set();
  for (const m of text.matchAll(/<%=\s*vars\.([a-zA-Z0-9_]+)\s*%>/g)) set.add(m[1]);
  return [...set];
}

export function rewriteVarRefs(text) {
  return text.replace(/<%=\s*vars\.([a-zA-Z0-9_]+)\s*%>/g, '{vars.$1}');
}

export function findPartialRefs(text) {
  const set = new Set();
  for (const m of text.matchAll(/<%=\s*partial\s+['"]([^'"]+)['"]\s*%>/g)) set.add(m[1]);
  return [...set];
}

export function rewritePartialRefs(text) {
  return text.replace(/<%=\s*partial\s+['"]([^'"]+)['"]\s*%>/g,
    (_, name) => `<${toPascalCase(name)} />`);
}
