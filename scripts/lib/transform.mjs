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
  return text.replace(/<p class="(note[^"]*|warning)">([\s\S]*?)<\/p>/g, (_, cls, inner) => {
    let kind = 'note';
    if (cls === 'warning') kind = 'warning';
    else if (/\bimportant\b/.test(cls)) kind = 'info';
    else if (/\bcaution\b/.test(cls)) kind = 'caution';
    const body = inner
      .replace(/<span class="note__title">[\s\S]*?<\/span>/g, '')
      .replace(/<strong>\s*(Note|Warning|Important|Caution)\s*<\/strong>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    return `\n:::${kind}\n${body}\n:::\n`;
  });
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
  // Match any image path that contains at least one `images/` segment (local paths only).
  // Use a greedy non-capturing group to consume prefix `images/` repetitions, landing after the LAST one.
  // Skip external URLs (https?://).
  return text.replace(/\]\((?:[^)]*images\/)+([^)]+)\)/g, (m, rest) => {
    if (/^https?:\/\//.test(m.slice(2))) return m;
    return `](/img/concepts/${rest})`;
  });
}

export function normalizeVoidTags(text) {
  // Convert void HTML tags to self-closing for JSX/MDX compatibility.
  return text
    .replace(/<br\s*>/gi, '<br/>')
    .replace(/<hr\s*>/gi, '<hr/>')
    .replace(/<col(\s[^>]*)>/gi, '<col$1/>')
    .replace(/<img(\s[^>]*)>/gi, (m, attrs) => {
      // Only add / if not already self-closed
      if (attrs.trim().endsWith('/')) return m;
      return `<img${attrs}/>`;
    });
}

export function repairHtml(text) {
  // 1. Close unclosed <li> before the next <li>, </ul>, or </ol>.
  //    HTML5 permits optional </li>, but MDX (JSX) requires it.
  text = text.replace(/<li>([\s\S]*?)(?=<li>|<\/ul>|<\/ol>)/g, (m, content) => {
    if (content.includes('</li>')) return m; // already explicitly closed
    return '<li>' + content + '</li>';
  });

  // 2. Close unclosed <ul> before </td>.
  //    Kept-HTML tables sometimes have <ul>...<li>..</li></td> with no </ul>.
  text = text.replace(/<ul>([\s\S]*?)<\/td>/g, (m, inner) => {
    if (inner.includes('</ul>')) return m;
    return '<ul>' + inner + '</ul></td>';
  });

  // 3a. Move text from same line as <td> to next line when followed by <ul>.
  //     MDX (JSX) fails when <td> has inline text + block-level <ul> starting on same td-open line.
  //     Fix: move text after <td> to a new line, making it a flow paragraph the parser handles.
  text = text.replace(/<td>([^<\n][^\n]*)\n(\s*<ul)/g, (_, textContent, rest) => {
    return '<td>\n  ' + textContent.trim() + '\n' + rest;
  });

  // 3b. Same pattern when text is already on line after <td> — no change needed there
  //     (MDX handles <td>\n  text\n  <ul> correctly).

  // 4. Escape CLI placeholder angle-brackets like <APP-GUID/ in double-tab-indented
  //    code blocks inside list items (Markdown indented code inside lists).
  text = text.replace(/^(\t{2,}[^\n`]*)<([A-Z][A-Z0-9-]+)\//gm, (_, prefix, name) => {
    return prefix + '&lt;' + name + '/';
  });

  return text;
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
