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
  // Convert `## <a id='foo'></a> Heading text` → `## Heading text {#foo}`
  // Preserves the id so in-page anchor links still resolve.
  return text.replace(
    /^(#{1,6})\s*<a id=['"]([^'"]+)['"]><\/a>\s*(.*?)\s*$/gm,
    (_, hashes, id, rest) => `${hashes} ${rest} {#${id}}`
  );
}

// Out-of-scope CF doc sections not present in this PoC.
const OUT_OF_SCOPE = new Set([
  'devguide', 'adminguide', 'cf-cli', 'deploying', 'services',
  'buildpacks', 'loggregator', 'uaa', 'running', 'bbr', 'credhub',
]);

export function rewriteInternalLinks(text) {
  return text.replace(/\]\(([^)]+)\)/g, (m, target) => {
    // Leave absolute URLs, mailto, and anchor-only links unchanged.
    if (/^(https?:|mailto:|#)/i.test(target)) return m;

    // Separate path from anchor.
    const hashIdx = target.indexOf('#');
    const path = hashIdx === -1 ? target : target.slice(0, hashIdx);
    const anchor = hashIdx === -1 ? '' : target.slice(hashIdx);

    // Absolute path links like /uaa/uaa-deploy.html — check first segment.
    if (path.startsWith('/')) {
      const absPath = path.slice(1); // strip leading /
      const firstSeg = absPath.split('/')[0];
      if (OUT_OF_SCOPE.has(firstSeg)) {
        const noExt = absPath.replace(/\.html$/i, '');
        return `](https://docs.cloudfoundry.org/${noExt}.html${anchor})`;
      }
    }

    // Relative links: strip leading ../ and ./ to find the first real path segment.
    const stripped = path.replace(/^(\.\.?\/)+/, '');
    const firstSeg = stripped.split('/')[0];

    if (OUT_OF_SCOPE.has(firstSeg)) {
      // Externalize: reconstruct without leading ../ prefix; keep .html (add if not there).
      const noExt = stripped.replace(/\.html$/i, '');
      return `](https://docs.cloudfoundry.org/${noExt}.html${anchor})`;
    }

    // In-scope link: strip .html extension, then fix Docusaurus index routing.
    let fixed = path.replace(/\.html$/i, '');

    // Docusaurus routes `foo/index.mdx` as `foo/`, so `/index` in path would 404.
    // Replace trailing /index with / and bare `index` (whole path) with ./ .
    fixed = fixed.replace(/\/index$/, '/');
    if (fixed === 'index') fixed = './';
    // `index#anchor` pattern (bare index with no preceding slash)
    fixed = fixed.replace(/^index$/, './');

    return `](${fixed}${anchor})`;
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
