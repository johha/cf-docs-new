# CF Docs Docusaurus PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a demo-able Docusaurus site for CF documentation, migrating the `docs-cloudfoundry-concepts` content via a deterministic, re-runnable ERB→MDX script, with CF theming and working offline full-text search.

**Architecture:** A standard Docusaurus (classic preset) site in `cf-docs-new`. Three Node ESM generator scripts read the legacy sibling repos and emit site inputs: `gen-vars.mjs` (YAML → `src/data/vars.js`), `migrate.mjs` (`.html.md.erb` → `docs/concepts/**/*.mdx` + copied images + `migration-report.txt`), and `gen-sidebar.mjs` (legacy ERB subnav → `sidebars.js`). Templating survives as MDX referencing a single `vars` module (the rebrand point); partials become imported MDX components. Search is `@easyops-cn/docusaurus-search-local` (offline).

**Tech Stack:** Node.js v26 / npm 11, Docusaurus 3 (classic preset, MDX v3), `js-yaml` (YAML parse), `node-html-parser` (table/HTML classification), `@easyops-cn/docusaurus-search-local`. Scripts are `.mjs` ESM, no TypeScript, no build step for the scripts themselves.

**Spec:** `docs/superpowers/specs/2026-10-07-cf-docs-docusaurus-poc-design.md` — read it alongside this plan; the plan implements that spec.

## Global Constraints

- Target repo is `cf-docs-new`; legacy sources are sibling dirs. Default source paths (overridable via CLI arg or `CF_*` env var), resolved relative to repo root:
  - Concepts content: `../docs-cloudfoundry-concepts`
  - Variables YAML: `../docs-book-cloudfoundry/config/template_variables.yml`
  - Subnav ERB: `../docs-book-cloudfoundry/master_middleman/source/subnavs/_cf-subnav.erb`
- Every generator MUST validate its source path(s) up front and exit non-zero with a clear message if missing. Never write partial output on a missing source.
- Scripts are deterministic and re-runnable: running twice on unchanged input yields identical output. No network calls, no AI at runtime.
- Generated outputs (`src/data/vars.js`, `docs/concepts/**`, `sidebars.js`, `static/img/concepts/**`) are committed, but each is reproducible from its generator.
- Node ESM only (`.mjs`, `import`/`export`). Node v26 is the floor.
- Docusaurus config MUST set `onBrokenLinks: 'throw'`.
- Product string in output is "Cloud Foundry" (from `vars.app_runtime_abbr`); the migration MUST NOT hard-code it — it flows through `{vars.*}`.
- Git LFS is already enabled for `*.png|jpg|jpeg|gif|ico` (committed in `.gitattributes`); migrated images land under LFS automatically. Do not re-run `git lfs track`.
- CF palette: navy `#243640`, primary blue `#2185c5`, light blue `#a7cae1`.
- Docs mount under `docs/concepts/` to preserve the legacy `/concepts/...` URL prefix.

## Review Focus

Inputs/conditions the spec implies but that no single task's happy-path test exercises; each gets a pinned test in the owning task:

- **A `vars.X` reference with no matching key in the YAML** → must be logged to `migration-report.txt`, not silently emitted as a broken `{vars.X}`. (Task 4)
- **A `<table>` with block content in a cell (`<ul>`/`<pre>`/`<p>`) or `colspan`** → must be kept as HTML and logged with reason, NOT mangled into GFM. (Task 5)
- **An internal link already without `.html`, or an external `https://…` link** → `.html`-stripping must not corrupt it (no double-strip, external untouched). (Task 4)
- **A partial that is blank upstream (`overview_model`)** → must become a component that renders nothing, so the importing page still builds. (Task 6)
- **A missing source directory/file** → every generator exits non-zero with a clear message and writes no partial output. Covered once centrally by the `resolveSource` test, since all three generators resolve sources through it. (Task 2)

---

## Task 1: Docusaurus scaffold + dependencies + run scripts

**Files:**
- Create: `package.json`
- Create: `docusaurus.config.js`
- Create: `sidebars.js` (temporary placeholder; regenerated in Task 7)
- Create: `src/css/custom.css` (minimal; themed in Task 8)
- Create: `docs/intro.md` (temporary landing page so the site builds before migration)
- Create: `.gitignore`

**Interfaces:**
- Produces: a buildable Docusaurus site. Later tasks replace `sidebars.js`, add `docs/concepts/**`, `src/data/vars.js`, and theming.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "cf-docs-new",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "docusaurus": "docusaurus",
    "start": "docusaurus start",
    "build": "docusaurus build",
    "serve": "docusaurus serve",
    "clear": "docusaurus clear",
    "gen:vars": "node scripts/gen-vars.mjs",
    "gen:sidebar": "node scripts/gen-sidebar.mjs",
    "migrate": "node scripts/migrate.mjs",
    "gen:all": "npm run gen:vars && npm run migrate && npm run gen:sidebar"
  },
  "dependencies": {
    "@docusaurus/core": "^3.6.0",
    "@docusaurus/preset-classic": "^3.6.0",
    "@easyops-cn/docusaurus-search-local": "^0.46.0",
    "@mdx-js/react": "^3.0.0",
    "clsx": "^2.0.0",
    "prism-react-renderer": "^2.3.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@docusaurus/module-type-aliases": "^3.6.0",
    "js-yaml": "^4.1.0",
    "node-html-parser": "^6.1.13"
  },
  "engines": { "node": ">=20.0" }
}
```

- [ ] **Step 2: Create `docusaurus.config.js`**

```js
// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Cloud Foundry Documentation',
  tagline: 'Documentation to help you deploy and manage Cloud Foundry',
  favicon: 'img/favicon.ico',
  url: 'https://cloudfoundry.github.io',
  baseUrl: '/docs-next/',
  organizationName: 'cloudfoundry',
  projectName: 'docs-next',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  future: { v4: true },
  presets: [
    ['classic', /** @type {import('@docusaurus/preset-classic').Options} */ ({
      docs: { sidebarPath: './sidebars.js', routeBasePath: '/' },
      blog: false,
      theme: { customCss: './src/css/custom.css' },
    })],
  ],
  themes: [
    ['@easyops-cn/docusaurus-search-local',
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */ ({
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      })],
  ],
  themeConfig: /** @type {import('@docusaurus/preset-classic').ThemeConfig} */ ({
    navbar: {
      title: 'Cloud Foundry',
      logo: { alt: 'Cloud Foundry', src: 'img/logo_org.png' },
      items: [{ type: 'docSidebar', sidebarId: 'conceptsSidebar', position: 'left', label: 'Concepts' }],
    },
    footer: {
      style: 'dark',
      links: [{ title: 'Community', items: [{ label: 'Get Involved', href: 'https://www.cloudfoundry.org/community/' }] }],
      copyright: `Cloud Foundry Documentation`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  }),
};

export default config;
```

- [ ] **Step 3: Create temporary `sidebars.js` placeholder**

```js
// @ts-check
// Placeholder — regenerated by scripts/gen-sidebar.mjs in Task 7.
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = { conceptsSidebar: [{ type: 'autogenerated', dirName: '.' }] };
export default sidebars;
```

- [ ] **Step 4: Create `docs/intro.md` placeholder and minimal `src/css/custom.css`**

`docs/intro.md`:
```md
---
title: Cloud Foundry Documentation
slug: /
---

# Cloud Foundry Documentation

Placeholder landing page. Concepts content is generated by the migration script.
```

`src/css/custom.css`:
```css
/* CF theming applied in Task 8 */
```

- [ ] **Step 5: Create `.gitignore`**

```gitignore
/node_modules
/build
/.docusaurus
/.cache-loader
.DS_Store
migration-report.txt
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: completes, `node_modules/` present, lockfile written.

- [ ] **Step 7: Verify the site builds**

Run: `npm run build`
Expected: build succeeds, `build/index.html` exists, zero broken-link errors.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json docusaurus.config.js sidebars.js src/css/custom.css docs/intro.md .gitignore
git commit -m "chore: scaffold Docusaurus site with search + CF config"
```

---

## Task 2: `gen-vars.mjs` — template_variables.yml → src/data/vars.js

**Files:**
- Create: `scripts/lib/sources.mjs` (shared source-path resolution)
- Create: `scripts/gen-vars.mjs`
- Create: `scripts/fixtures/vars-sample.yml` (test fixture)
- Create: `src/data/vars.js` (generated output, committed)

**Interfaces:**
- `scripts/lib/sources.mjs` — Produces:
  - `resolveSource(name, cliArg)` → absolute path. `name` ∈ `'concepts'|'vars'|'subnav'`. Order: explicit `cliArg` → env var (`CF_CONCEPTS_DIR`/`CF_VARS_FILE`/`CF_SUBNAV_FILE`) → default sibling path. Throws `Error` with a clear message if the resolved path does not exist.
- `scripts/gen-vars.mjs` — Produces: `src/data/vars.js` exporting `export const vars = { ... }` with every scalar key from `template_variables.yml` under `template_variables:`. Non-string scalars are stringified; null/empty become `""`.

- [ ] **Step 1: Write `scripts/lib/sources.mjs`**

```js
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

const DEFAULTS = {
  concepts: '../docs-cloudfoundry-concepts',
  vars: '../docs-book-cloudfoundry/config/template_variables.yml',
  subnav: '../docs-book-cloudfoundry/master_middleman/source/subnavs/_cf-subnav.erb',
};
const ENV = { concepts: 'CF_CONCEPTS_DIR', vars: 'CF_VARS_FILE', subnav: 'CF_SUBNAV_FILE' };

export function resolveSource(name, cliArg) {
  const raw = cliArg || process.env[ENV[name]] || DEFAULTS[name];
  const abs = resolve(process.cwd(), raw);
  if (!existsSync(abs)) {
    throw new Error(`Source "${name}" not found at ${abs}. Pass a path arg or set ${ENV[name]}.`);
  }
  return abs;
}
```

- [ ] **Step 2: Write the fixture `scripts/fixtures/vars-sample.yml`**

```yaml
template_variables:
  app_runtime_abbr: Cloud Foundry
  platform_name: Cloud Foundry
  current_major_version: "10-0"
  empty_var:
  html_var: '<a href="https://x">link</a>'
```

- [ ] **Step 3: Write `scripts/gen-vars.mjs`**

```js
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import yaml from 'js-yaml';
import {resolveSource} from './lib/sources.mjs';

export function buildVars(yamlText) {
  const doc = yaml.load(yamlText) || {};
  const tv = doc.template_variables || {};
  const out = {};
  for (const [k, v] of Object.entries(tv)) {
    if (v === null || v === undefined) out[k] = '';
    else if (typeof v === 'object') continue; // skip nested structures (none expected as scalars)
    else out[k] = String(v);
  }
  return out;
}

function render(vars) {
  return `// GENERATED by scripts/gen-vars.mjs — do not edit by hand.\n` +
    `// This is the single rebrand point for downstream distributions.\n` +
    `export const vars = ${JSON.stringify(vars, null, 2)};\n` +
    `export default vars;\n`;
}

function main() {
  const src = resolveSource('vars', process.argv[2]);
  const vars = buildVars(readFileSync(src, 'utf8'));
  const outPath = 'src/data/vars.js';
  mkdirSync(dirname(outPath), {recursive: true});
  writeFileSync(outPath, render(vars));
  console.log(`Wrote ${outPath} with ${Object.keys(vars).length} variables.`);
}

// run only when executed directly
import {fileURLToPath} from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Write the failing test `scripts/tests/gen-vars.test.mjs`**

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildVars} from '../gen-vars.mjs';

test('buildVars maps scalars, empties, and html', () => {
  const vars = buildVars(readFileSync('scripts/fixtures/vars-sample.yml', 'utf8'));
  assert.equal(vars.app_runtime_abbr, 'Cloud Foundry');
  assert.equal(vars.current_major_version, '10-0');
  assert.equal(vars.empty_var, '');
  assert.ok(vars.html_var.includes('<a href'));
});

test('resolveSource throws on missing path', async () => {
  const {resolveSource} = await import('../lib/sources.mjs');
  assert.throws(() => resolveSource('vars', '/no/such/file.yml'), /not found/);
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/tests/gen-vars.test.mjs`
Expected: PASS (2 tests). (The import is from the already-written module; this test pins behavior and the missing-path Review-Focus case.)

- [ ] **Step 6: Generate the real vars file**

Run: `npm run gen:vars`
Expected: `Wrote src/data/vars.js with N variables.` (N > 100). Open the file; confirm `app_runtime_abbr: "Cloud Foundry"`.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/sources.mjs scripts/gen-vars.mjs scripts/fixtures/vars-sample.yml scripts/tests/gen-vars.test.mjs src/data/vars.js
git commit -m "feat: gen-vars.mjs generates vars module from template_variables.yml"
```

---

## Task 3: Migration helpers — pure transform functions (unit-tested)

**Files:**
- Create: `scripts/lib/transform.mjs`
- Create: `scripts/tests/transform.test.mjs`

**Interfaces:**
- `scripts/lib/transform.mjs` — Produces (all pure, string-in/string-out unless noted):
  - `toPascalCase(name)` → e.g. `'oss_roles_table'` → `'OssRolesTable'`.
  - `stripErbComments(text)` → removes `<%# ... %>` and `[//]: # (...)` lines.
  - `rewriteNoteBlocks(text)` → `<p class="note">…</p>` → `:::note\n…\n:::`; `warning` → `:::warning`. Inner HTML tags for the note title (`<span class="note__title">…</span>`) removed; inner text preserved.
  - `stripHeadingAnchors(text)` → `<a id='x'></a> Heading` on a heading line → heading text only.
  - `rewriteInternalLinks(text)` → in Markdown link targets, strip a trailing `.html` (and `.html#frag` → `#frag`) ONLY for non-`http(s)://`, non-`mailto:` targets. Leaves external URLs and already-clean links untouched.
  - `rewriteImagePaths(text)` → `](./images/x.png)` and `](images/x.png)` → `](./img/x.png)`; records nothing (copying handled in migrate).
  - `findVarRefs(text)` → array of distinct `vars.X` names referenced via `<%= vars.X %>`.
  - `rewriteVarRefs(text)` → `<%= vars.X %>` → `{vars.X}`.
  - `findPartialRefs(text)` → array of distinct partial names from `<%= partial 'name' %>` / `"name"`.
  - `rewritePartialRefs(text)` → `<%= partial 'name' %>` → `<Name />`.

- [ ] **Step 1: Write failing tests `scripts/tests/transform.test.mjs`**

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../lib/transform.mjs';

test('toPascalCase', () => {
  assert.equal(t.toPascalCase('oss_roles_table'), 'OssRolesTable');
  assert.equal(t.toPascalCase('max_in_flight_text'), 'MaxInFlightText');
});

test('stripErbComments removes erb and md comments', () => {
  const out = t.stripErbComments("a\n<%# hi %>\n[//]: # (x)\nb");
  assert.equal(out.includes('hi'), false);
  assert.equal(out.includes('[//]'), false);
  assert.ok(out.includes('a') && out.includes('b'));
});

test('rewriteNoteBlocks produces admonition', () => {
  const out = t.rewriteNoteBlocks('<p class="note"><span class="note__title"><strong>Note</strong></span> Hello</p>');
  assert.ok(out.includes(':::note'));
  assert.ok(out.includes('Hello'));
  assert.ok(out.trim().endsWith(':::'));
});

test('stripHeadingAnchors', () => {
  assert.equal(t.stripHeadingAnchors("## <a id='about'></a> About"), '## About');
});

test('rewriteInternalLinks strips .html only for internal', () => {
  assert.equal(t.rewriteInternalLinks('[a](./foo.html)'), '[a](./foo)');
  assert.equal(t.rewriteInternalLinks('[a](../x/foo.html#frag)'), '[a](../x/foo#frag)');
  assert.equal(t.rewriteInternalLinks('[a](https://x.org/y.html)'), '[a](https://x.org/y.html)');
  assert.equal(t.rewriteInternalLinks('[a](./foo)'), '[a](./foo)');
});

test('rewriteImagePaths', () => {
  assert.equal(t.rewriteImagePaths('![x](./images/a.png)'), '![x](./img/a.png)');
  assert.equal(t.rewriteImagePaths('![x](images/a.png)'), '![x](./img/a.png)');
});

test('findVarRefs / rewriteVarRefs', () => {
  const s = 'use <%= vars.app_runtime_abbr %> and <%= vars.platform_name %> and <%= vars.app_runtime_abbr %>';
  assert.deepEqual(t.findVarRefs(s).sort(), ['app_runtime_abbr', 'platform_name']);
  assert.equal(t.rewriteVarRefs('x <%= vars.foo %>'), 'x {vars.foo}');
});

test('findPartialRefs / rewritePartialRefs', () => {
  const s = `<%= partial 'oss_roles_table' %> <%= partial "default_asg_oss" %>`;
  assert.deepEqual(t.findPartialRefs(s).sort(), ['default_asg_oss', 'oss_roles_table']);
  assert.equal(t.rewritePartialRefs(`<%= partial 'x_y' %>`), '<XY />');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/tests/transform.test.mjs`
Expected: FAIL — `transform.mjs` has no exports yet.

- [ ] **Step 3: Implement `scripts/lib/transform.mjs`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/tests/transform.test.mjs`
Expected: PASS (all tests, including the external-link and already-clean-link Review-Focus cases).

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/transform.mjs scripts/tests/transform.test.mjs
git commit -m "feat: pure ERB->MDX transform helpers with unit tests"
```

---

## Task 4: Table classifier (`<table>` → GFM or kept HTML)

**Files:**
- Create: `scripts/lib/tables.mjs`
- Create: `scripts/tests/tables.test.mjs`

**Interfaces:**
- `scripts/lib/tables.mjs` — Produces:
  - `classifyTable(tableHtml)` → `{ simple: boolean, reason: string }`. `simple:false` with a reason string when any of: `colspan`/`rowspan` attr present, `<col` width present, or any `<td>`/`<th>` contains a block child (`ul,ol,pre,p,div,table`) or more than one block-level child. Uses `node-html-parser`.
  - `tableToGfm(tableHtml)` → GFM Markdown string. Reads `<thead>` first row as header; each `<tbody>` row as a data row; inline content preserved (keeps `<strong>`,`<code>`,`<a>` as-is), cells joined with ` | `, pipes inside cells escaped.
  - `rewriteTables(text)` → `{ text, keptHtml: Array<{reason}> }`. Replaces each simple `<table>…</table>` with GFM; leaves complex ones as-is and records a `{reason}` per kept table.

- [ ] **Step 1: Write failing tests `scripts/tests/tables.test.mjs`**

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyTable, tableToGfm, rewriteTables} from '../lib/tables.mjs';

const SIMPLE = `<table><thead><tr><th>A</th><th>B</th></tr></thead>` +
  `<tbody><tr><td>1</td><td><code>x</code></td></tr></tbody></table>`;
const COLSPAN = `<table><tbody><tr><td colspan="2">x</td></tr></tbody></table>`;
const BLOCKCELL = `<table><tbody><tr><td><ul><li>a</li></ul></td><td>b</td></tr></tbody></table>`;
const COLWIDTH = `<table><col width="25%"><thead><tr><th>A</th></tr></thead></table>`;

test('simple table classified simple', () => {
  assert.equal(classifyTable(SIMPLE).simple, true);
});
test('colspan kept html', () => {
  const r = classifyTable(COLSPAN);
  assert.equal(r.simple, false); assert.match(r.reason, /span/i);
});
test('block cell kept html', () => {
  const r = classifyTable(BLOCKCELL);
  assert.equal(r.simple, false); assert.match(r.reason, /ul|block/i);
});
test('col width kept html', () => {
  const r = classifyTable(COLWIDTH);
  assert.equal(r.simple, false); assert.match(r.reason, /col|width/i);
});
test('tableToGfm renders header + row', () => {
  const gfm = tableToGfm(SIMPLE);
  assert.match(gfm, /\| A \| B \|/);
  assert.match(gfm, /\| --- \| --- \|/);
  assert.match(gfm, /\| 1 \|/);
  assert.ok(gfm.includes('<code>x</code>'));
});
test('rewriteTables converts simple, keeps complex with reason', () => {
  const {text, keptHtml} = rewriteTables(`${SIMPLE}\n\n${BLOCKCELL}`);
  assert.ok(text.includes('| A | B |'));
  assert.ok(text.includes('<ul>'));
  assert.equal(keptHtml.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/tests/tables.test.mjs`
Expected: FAIL — `tables.mjs` not implemented.

- [ ] **Step 3: Implement `scripts/lib/tables.mjs`**

```js
import {parse} from 'node-html-parser';

const BLOCK = new Set(['ul', 'ol', 'pre', 'p', 'div', 'table', 'blockquote']);

export function classifyTable(tableHtml) {
  const root = parse(tableHtml);
  const table = root.querySelector('table');
  if (!table) return {simple: false, reason: 'unparseable table'};
  if (tableHtml.match(/\b(colspan|rowspan)=/i)) return {simple: false, reason: 'cell spanning (colspan/rowspan)'};
  if (table.querySelector('col') || /<col[\s>]/i.test(tableHtml)) return {simple: false, reason: 'explicit col width'};
  for (const cell of table.querySelectorAll('td,th')) {
    const blockChildren = cell.childNodes.filter(
      n => n.nodeType === 1 && BLOCK.has(n.rawTagName?.toLowerCase()));
    if (blockChildren.length >= 1) {
      return {simple: false, reason: `cell contains <${blockChildren[0].rawTagName.toLowerCase()}>`};
    }
  }
  return {simple: true, reason: ''};
}

function cellText(cell) {
  return cell.innerHTML.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

export function tableToGfm(tableHtml) {
  const table = parse(tableHtml).querySelector('table');
  const headRow = table.querySelector('thead tr') || table.querySelector('tr');
  const headers = headRow.querySelectorAll('th,td').map(cellText);
  const bodyRows = (table.querySelector('tbody') || table)
    .querySelectorAll('tr')
    .filter(tr => tr !== headRow);
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td,th').map(cellText);
    if (cells.length) lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

export function rewriteTables(text) {
  const keptHtml = [];
  const out = text.replace(/<table[\s\S]*?<\/table>/gi, (tbl) => {
    const {simple, reason} = classifyTable(tbl);
    if (simple) return '\n' + tableToGfm(tbl) + '\n';
    keptHtml.push({reason});
    return tbl;
  });
  return {text: out, keptHtml};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/tests/tables.test.mjs`
Expected: PASS — including the block-cell and colspan Review-Focus cases kept as HTML with reasons.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/tables.mjs scripts/tests/tables.test.mjs
git commit -m "feat: deterministic table classifier (GFM vs kept HTML)"
```

---

## Task 5: `migrate.mjs` — orchestrate conversion, images, report

**Files:**
- Create: `scripts/migrate.mjs`
- Create: `scripts/lib/mdx.mjs` (frontmatter + import-header assembly)
- Create: `scripts/tests/mdx.test.mjs`
- Produces (generated, committed): `docs/concepts/**/*.mdx`, `docs/concepts/_partials/*.mdx`, `static/img/concepts/**`, `migration-report.txt`

**Interfaces:**
- Consumes: all of `scripts/lib/transform.mjs`, `scripts/lib/tables.mjs`, `scripts/lib/sources.mjs`, and the generated `src/data/vars.js` (imported to know which var keys exist).
- `scripts/lib/mdx.mjs` — Produces:
  - `splitFrontmatter(text)` → `{ frontmatter: object, body: string }` (empty object if none).
  - `assembleMdx({frontmatter, body, varsUsed, partialsUsed, isPartial})` → final MDX string: YAML frontmatter (page only), then `import {vars}` if `varsUsed`, then partial imports, then body. For `isPartial`, wrap body as a default-exported component with no frontmatter.
- `scripts/migrate.mjs` — Produces: converts every non-partial `*.html.md.erb` under the concepts source into `docs/concepts/<same-path>.mdx`; every `_*.html.md.erb` into `docs/concepts/_partials/<Pascal>.mdx`; copies `images/**` → `static/img/concepts/**`; writes `migration-report.txt` summarizing kept-HTML tables, unknown vars, missing partials, per-file errors.

- [ ] **Step 1: Write failing tests `scripts/tests/mdx.test.mjs`**

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitFrontmatter, assembleMdx} from '../lib/mdx.mjs';

test('splitFrontmatter parses title', () => {
  const {frontmatter, body} = splitFrontmatter('---\ntitle: Hi\n---\n\nBody');
  assert.equal(frontmatter.title, 'Hi');
  assert.equal(body.trim(), 'Body');
});
test('splitFrontmatter handles none', () => {
  const {frontmatter, body} = splitFrontmatter('No frontmatter');
  assert.deepEqual(frontmatter, {});
  assert.equal(body, 'No frontmatter');
});
test('assembleMdx injects imports for page', () => {
  const out = assembleMdx({
    frontmatter: {title: 'T'}, body: 'Use {vars.x} and <Foo />',
    varsUsed: true, partialsUsed: [{component: 'Foo', file: 'Foo'}], isPartial: false,
  });
  assert.ok(out.startsWith('---'));
  assert.ok(out.includes("import {vars} from '@site/src/data/vars'"));
  assert.ok(out.includes("import Foo from './_partials/Foo.mdx'"));
  assert.ok(out.includes('title: T'));
});
test('assembleMdx partial has no frontmatter', () => {
  const out = assembleMdx({frontmatter: {}, body: 'hi', varsUsed: false, partialsUsed: [], isPartial: true});
  assert.equal(out.startsWith('---'), false);
  assert.ok(out.includes('hi'));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/tests/mdx.test.mjs`
Expected: FAIL — `mdx.mjs` not implemented.

- [ ] **Step 3: Implement `scripts/lib/mdx.mjs`**

```js
import yaml from 'js-yaml';

export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return {frontmatter: {}, body: text};
  return {frontmatter: yaml.load(m[1]) || {}, body: text.slice(m[0].length)};
}

export function assembleMdx({frontmatter, body, varsUsed, partialsUsed, isPartial}) {
  const imports = [];
  if (varsUsed) imports.push("import {vars} from '@site/src/data/vars';");
  for (const p of partialsUsed) imports.push(`import ${p.component} from './_partials/${p.file}.mdx';`);
  const importBlock = imports.length ? imports.join('\n') + '\n\n' : '';

  if (isPartial) {
    // Partial file is itself an MDX doc; importing .mdx yields its default export.
    return `${importBlock}${body.trim()}\n`;
  }
  const fmKeys = Object.keys(frontmatter);
  const fm = fmKeys.length ? `---\n${yaml.dump(frontmatter).trim()}\n---\n\n` : '';
  return `${fm}${importBlock}${body.trim()}\n`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/tests/mdx.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `scripts/migrate.mjs`**

```js
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
  return {body: tabled, varsUsed, partials, keptHtml};
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
      const mdx = assembleMdx({frontmatter, body, varsUsed: varsUsed.length > 0, partialsUsed, isPartial});

      let destPath;
      if (isPartial) {
        destPath = join(outPartials, t.toPascalCase(name.slice(1, -SRC_SUFFIX.length)) + '.mdx');
      } else {
        destPath = join(outDocs, rel.slice(0, -SRC_SUFFIX.length) + '.mdx');
      }
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
```

- [ ] **Step 6: Run the migration against the real source**

Run: `npm run gen:vars && npm run migrate`
Expected: console summary printed; `docs/concepts/**/*.mdx` created (including `architecture/` and `diego/` subdirs), `docs/concepts/_partials/*.mdx` created, `static/img/concepts/**` populated, `migration-report.txt` written.

- [ ] **Step 7: Sanity-check the report and one converted file**

Run: `cat migration-report.txt` and open `docs/concepts/overview.mdx`.
Expected: `overview.mdx` has `import {vars}`, uses `{vars.app_runtime_abbr}`, no `<%` left. Report's "Unknown vars" and "Errors" sections are empty or clearly explainable; "Missing partials" empty.

- [ ] **Step 8: Verify no ERB residue remains**

Run: `grep -rn "<%" docs/concepts || echo "CLEAN"`
Expected: `CLEAN` (no ERB tags survived conversion).

- [ ] **Step 9: Commit**

```bash
git add scripts/migrate.mjs scripts/lib/mdx.mjs scripts/tests/mdx.test.mjs docs/concepts static/img/concepts migration-report.txt
git commit -m "feat: migrate.mjs converts concepts ERB to MDX with report"
```

---

## Task 6: Partial components build correctly (incl. blank placeholder)

**Files:**
- Modify: `docs/concepts/_partials/*.mdx` (only if a partial fails to build — e.g. the blank `overview_model`)
- Verify: `docs/concepts/_partials/OverviewModel.mdx`

**Interfaces:**
- Consumes: Task 5 output.

- [ ] **Step 1: Confirm the blank partial produced a buildable component**

Run: `cat docs/concepts/_partials/OverviewModel.mdx`
Expected: file exists; body is effectively empty (upstream `_overview_model` is blank). An empty `.mdx` imported as a component must still be valid.

- [ ] **Step 2: If an empty partial breaks MDX import, make it render nothing explicitly**

If `OverviewModel.mdx` (or any blank partial) is empty, replace its content with an explicit empty fragment so the default export is defined:

```mdx
export const Empty = () => null;

<Empty />
```

(Only apply to partials whose source body is blank; non-blank partials keep their migrated content.)

- [ ] **Step 3: Build to confirm all partial imports resolve**

Run: `npm run build 2>&1 | tail -30`
Expected: no "module not found" / failed-import errors for `_partials/*`. (Broken *links* are addressed in Task 7; here we only care that imports resolve and MDX compiles.)

- [ ] **Step 4: Commit (only if a partial was edited)**

```bash
git add docs/concepts/_partials
git commit -m "fix: ensure blank partial renders as empty component"
```

---

## Task 7: `gen-sidebar.mjs` — legacy subnav → sidebars.js

**Files:**
- Create: `scripts/gen-sidebar.mjs`
- Create: `scripts/lib/subnav.mjs`
- Create: `scripts/tests/subnav.test.mjs`
- Modify (generated): `sidebars.js`

**Interfaces:**
- Consumes: subnav ERB via `resolveSource('subnav', …)`; the set of doc ids that actually exist under `docs/concepts/`.
- `scripts/lib/subnav.mjs` — Produces:
  - `extractConceptsItems(erbHtml)` → nested array of `{label, href, children}` for the "Cloud Foundry concepts" `<li>` subtree only.
  - `toSidebarItems(nodes, {validId})` → Docusaurus sidebar item array: `href` under `/concepts/` whose doc id passes `validId(id)` becomes `{type:'doc', id}`; nodes with children become `{type:'category', label, items}`; links outside `/concepts/` or with no valid doc are dropped. Empty categories are pruned.

- [ ] **Step 1: Write failing tests `scripts/tests/subnav.test.mjs`**

```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractConceptsItems, toSidebarItems} from '../lib/subnav.mjs';

const ERB = `
<ul>
 <li class="has_submenu"><a href="/concepts/index.html">Cloud Foundry concepts</a>
   <ul>
     <li><a href="/concepts/overview.html">Cloud Foundry overview</a></li>
     <li class="has_submenu"><a href="/concepts/security-index.html">Security and networking</a>
       <ul>
         <li><a href="/concepts/security.html">Cloud Foundry security</a></li>
         <li><a href="/devguide/deploy-apps/app-lifecycle.html">Out of scope</a></li>
       </ul>
     </li>
   </ul>
 </li>
</ul>`;

test('extractConceptsItems finds the concepts subtree', () => {
  const items = extractConceptsItems(ERB);
  assert.equal(items[0].label, 'Cloud Foundry concepts');
  assert.ok(items[0].children.length >= 2);
});

test('toSidebarItems keeps valid concepts docs, drops others', () => {
  const items = extractConceptsItems(ERB);
  const valid = new Set(['concepts/overview', 'concepts/security', 'concepts/security-index', 'concepts/index']);
  const sb = toSidebarItems(items, {validId: id => valid.has(id)});
  const json = JSON.stringify(sb);
  assert.ok(json.includes('concepts/overview'));
  assert.ok(json.includes('concepts/security'));
  assert.equal(json.includes('devguide'), false); // out-of-scope dropped
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/tests/subnav.test.mjs`
Expected: FAIL — `subnav.mjs` not implemented.

- [ ] **Step 3: Implement `scripts/lib/subnav.mjs`**

```js
import {parse} from 'node-html-parser';

function liToNode(li) {
  const a = li.querySelector(':scope > a');
  const span = li.querySelector(':scope > span');
  const label = (a?.text || span?.text || '').trim();
  const href = a?.getAttribute('href') || null;
  const childUl = li.querySelector(':scope > ul');
  const children = childUl
    ? childUl.querySelectorAll(':scope > li').map(liToNode)
    : [];
  return {label, href, children};
}

export function extractConceptsItems(erbHtml) {
  const root = parse(erbHtml);
  for (const li of root.querySelectorAll('li')) {
    const a = li.querySelector(':scope > a');
    if (a && a.getAttribute('href') === '/concepts/index.html') {
      return [liToNode(li)];
    }
  }
  return [];
}

function hrefToId(href) {
  if (!href) return null;
  const m = href.match(/^\/concepts\/(.+?)\.html(?:#.*)?$/);
  return m ? `concepts/${m[1]}` : null;
}

export function toSidebarItems(nodes, {validId}) {
  const out = [];
  for (const n of nodes) {
    const id = hrefToId(n.href);
    const childItems = toSidebarItems(n.children, {validId});
    if (n.children.length) {
      if (childItems.length) {
        const category = {type: 'category', label: n.label, items: childItems};
        if (id && validId(id)) category.link = {type: 'doc', id};
        out.push(category);
      } else if (id && validId(id)) {
        out.push({type: 'doc', id});
      }
    } else if (id && validId(id)) {
      out.push({type: 'doc', id});
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/tests/subnav.test.mjs`
Expected: PASS.

- [ ] **Step 5: Implement `scripts/gen-sidebar.mjs`**

```js
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveSource} from './lib/sources.mjs';
import {extractConceptsItems, toSidebarItems} from './lib/subnav.mjs';

function docIds(dir, base) {
  const ids = new Set();
  for (const name of readdirSync(dir)) {
    if (name === '_partials') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) for (const id of docIds(p, base)) ids.add(id);
    else if (extname(p) === '.mdx') {
      ids.add('concepts/' + relative(base, p).replace(/\.mdx$/, ''));
    }
  }
  return ids;
}

function main() {
  const subnav = resolveSource('subnav', process.argv[2]);
  const erb = readFileSync(subnav, 'utf8');
  const valid = docIds('docs/concepts', 'docs/concepts');
  const items = toSidebarItems(extractConceptsItems(erb), {validId: id => valid.has(id)});
  const sidebar = items.length ? items : [{type: 'autogenerated', dirName: '.'}];
  const content = `// @ts-check\n// GENERATED by scripts/gen-sidebar.mjs — do not edit by hand.\n` +
    `/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */\n` +
    `const sidebars = ${JSON.stringify({conceptsSidebar: sidebar}, null, 2)};\n` +
    `export default sidebars;\n`;
  writeFileSync('sidebars.js', content);
  console.log(`Wrote sidebars.js with ${sidebar.length} top-level items.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 6: Generate the sidebar**

Run: `npm run gen:sidebar`
Expected: `Wrote sidebars.js with N top-level items.` Open `sidebars.js`; confirm it references `concepts/overview`, `concepts/security`, etc., and contains no `devguide`/`deploying` ids.

- [ ] **Step 7: Remove the temporary landing page and point root at concepts index**

Delete `docs/intro.md` (the placeholder from Task 1). Ensure `docs/concepts/index.mdx` carries `slug: /` in its frontmatter so the site root resolves to the concepts index.

Run: `node -e "const fs=require('fs');let s=fs.readFileSync('docs/concepts/index.mdx','utf8');if(!/slug:\s*\//.test(s)){s=s.replace(/^---\n/,'---\nslug: /\n');fs.writeFileSync('docs/concepts/index.mdx',s)}console.log('ok')"`
Expected: `ok`; `docs/concepts/index.mdx` frontmatter now has `slug: /`.

```bash
rm -f docs/intro.md
```

- [ ] **Step 8: Build with the real sidebar**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds, zero broken-link errors. If broken links are reported, they are internal `.html` targets the transform missed or links to not-migrated pages — fix the transform or, for genuinely out-of-scope targets, confirm they're external. Re-run `npm run migrate` after any transform fix.

- [ ] **Step 9: Commit**

```bash
git add scripts/gen-sidebar.mjs scripts/lib/subnav.mjs scripts/tests/subnav.test.mjs sidebars.js docs/concepts
git rm --cached docs/intro.md 2>/dev/null; git add -A docs
git commit -m "feat: gen-sidebar.mjs builds sidebar from legacy subnav"
```

---

## Task 8: CF theming (palette, logo, favicon)

**Files:**
- Modify: `src/css/custom.css`
- Create: `static/img/logo_org.png`, `static/img/favicon.ico` (copied from legacy)

**Interfaces:**
- Consumes: `docusaurus.config.js` already references `img/logo_org.png` and `img/favicon.ico` (Task 1).

- [ ] **Step 1: Copy CF logo + favicon into `static/img/`**

```bash
mkdir -p static/img
cp ../docs-book-cloudfoundry/master_middleman/source/images/logo_org.png static/img/logo_org.png
cp ../docs-book-cloudfoundry/master_middleman/source/images/favicon.ico static/img/favicon.ico
```
Expected: both files exist under `static/img/` (PNG/ICO go through LFS per `.gitattributes`).

- [ ] **Step 2: Write CF palette into `src/css/custom.css`**

```css
/* Cloud Foundry theme — palette from legacy _book-vars.scss */
:root {
  --ifm-color-primary: #2185c5;
  --ifm-color-primary-dark: #1e78b1;
  --ifm-color-primary-darker: #1c71a7;
  --ifm-color-primary-darkest: #175d89;
  --ifm-color-primary-light: #3291cd;
  --ifm-color-primary-lighter: #4098d0;
  --ifm-color-primary-lightest: #63acd9;
  --ifm-code-font-size: 95%;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.1);
}

[data-theme='dark'] {
  --ifm-color-primary: #a7cae1;
  --ifm-color-primary-dark: #86b6d6;
  --ifm-color-primary-darker: #75adcf;
  --ifm-color-primary-darkest: #4a90bd;
  --ifm-color-primary-light: #c8dcec;
  --ifm-color-primary-lighter: #d9e5f1;
  --ifm-color-primary-lightest: #ffffff;
  --docusaurus-highlighted-code-line-bg: rgba(0, 0, 0, 0.3);
}

/* CF navy for navbar + dark footer */
.navbar { background-color: #243640; }
.navbar__title, .navbar__link { color: #ffffff; }
.footer--dark { --ifm-footer-background-color: #243640; }
```

- [ ] **Step 3: Build and visually confirm theming**

Run: `npm run build && npm run serve` then open the served URL.
Expected: navy navbar, blue links/accents, CF logo in navbar, favicon in the tab.

- [ ] **Step 4: Commit**

```bash
git add src/css/custom.css static/img/logo_org.png static/img/favicon.ico
git commit -m "feat: apply CF navy/blue theme, logo, and favicon"
```

---

## Task 9: GitHub Pages deploy workflow (committed artifact)

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `docusaurus.config.js` `url`/`baseUrl`/`organizationName`/`projectName` from Task 1.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run gen:all
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Lint the workflow YAML parses**

Run: `node -e "import('js-yaml').then(m=>{const fs=require('fs');m.default.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));console.log('valid yaml')})"`
Expected: `valid yaml`.

- [ ] **Step 3: Confirm config consistency**

Run: `grep -E "organizationName|projectName|baseUrl|url:" docusaurus.config.js`
Expected: `organizationName: 'cloudfoundry'`, `projectName: 'docs-next'`, `baseUrl: '/docs-next/'`, `url: 'https://cloudfoundry.github.io'` — consistent with a `cloudfoundry/docs-next` Pages deployment.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow (artifact for RFC demo)"
```

---

## Task 10: Full regeneration + end-to-end verification

**Files:** none created; this task runs the spec's verification checklist end to end.

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Clean regenerate everything from source**

Run: `npm run clear && npm run gen:all`
Expected: vars, docs/concepts, images, and sidebar all regenerate; summary printed; `migration-report.txt` refreshed.

- [ ] **Step 2: Run all unit tests**

Run: `node --test scripts/tests/`
Expected: all tests PASS.

- [ ] **Step 3: Production build with broken-link gate**

Run: `npm run build`
Expected: succeeds with **zero broken-link errors** (`onBrokenLinks: 'throw'`).

- [ ] **Step 4: Confirm sitemap generated**

Run: `test -f build/sitemap.xml && echo "sitemap ok"`
Expected: `sitemap ok`.

- [ ] **Step 5: Serve and run the spec's browser spot-checks**

Run: `npm run serve` and in the browser verify:
- `{vars.*}` render as "Cloud Foundry" (no literal braces anywhere).
- `:::note` admonitions render as styled callouts.
- Role/scale tables render; cross-check kept-HTML list in `migration-report.txt`.
- Images load (e.g. the overview comparison diagram).
- Sidebar order/nesting matches the legacy concepts subnav.
- **Search** returns concepts pages for "Diego", "roles", "security".
- CF palette + logo visibly applied.

- [ ] **Step 6: Write the demo README**

Create `README.md` documenting: what this is (RFC Phase-2 PoC), the one-command regeneration (`npm run gen:all`), how to run the demo (`npm run build && npm run serve`), the search-needs-prod-build caveat, and the rebrand point (`src/data/vars.js`).

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "docs: add demo README; finalize PoC regeneration"
```

---

## Notes for the executor

- **Cheaper-model-friendly tasks:** Tasks 5–8 (running the migration, fixing partials, generating the sidebar, theming) are mechanical and well-specified — good candidates for a cheaper model. Tasks 3, 4, 7 (pure transform/classifier/subnav logic with TDD) and Task 10 (final verification) benefit from a stronger model.
- **Re-run order after any transform change:** `npm run gen:vars` → `npm run migrate` → `npm run gen:sidebar` → `npm run build` (or just `npm run gen:all && npm run build`).
- `node-html-parser`'s `:scope >` selector support is relied upon in Tasks 4 and 7; if a selector misbehaves, fall back to manual `childNodes` filtering (as already done for block-cell detection in Task 4).
