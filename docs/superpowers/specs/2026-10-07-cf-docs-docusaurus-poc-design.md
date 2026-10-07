# CF Docs Modernization PoC — Design

- **Date:** 2026-10-07
- **Status:** Approved design (pending spec review)
- **Repo:** `cf-docs-new` (fresh, local-only)
- **Related:** `rfc-draft-cf-docs-modernization.md`

## Purpose

Stand up a working Docusaurus proof-of-concept for the Cloud Foundry
documentation, migrating the content of `docs-cloudfoundry-concepts` as a
representative subset. The PoC supports a meeting discussion of the
modernization RFC and must be demo-able: it should look recognizably like CF
docs, have working full-text search, and — critically — demonstrate a
**repeatable migration script** rather than hand-converted ("AI magic") output.

### Why this matters / success criteria

- A reviewer can run `npm start` and browse the migrated concepts docs.
- A reviewer can run a production build and use **working full-text search** —
  directly answering the RFC's "search is broken or disabled" pain point.
- The migration from ERB → MDX is done by a **deterministic, re-runnable
  script**, so it credibly represents the RFC's Phase-3 "migration script MAY
  be developed to automate conversion" path and could be pointed at the other
  ~12 doc repos later.
- **Templating survives the migration.** Downstream CF distributors (e.g.
  VMware/Tanzu) rebrand these docs by changing variable values. The migrated
  docs must keep a single, obvious rebrand point rather than inlining
  "Cloud Foundry" everywhere.
- Look & feel is *similar* to the current site (CF navy/blue palette, logo). It
  does not need to be pixel-identical.

## Scope

**In scope:** content of `docs-cloudfoundry-concepts` only (~30 content pages +
12 partials + images), Docusaurus scaffold, CF theming, offline full-text
search, migration/generation scripts, local dev + production build.

**Out of scope (YAGNI for a Phase-2 PoC):** doc versioning dropdown, Algolia,
the other ~12 doc repos, CI/CD and GitHub Pages deploy workflow, redirect rules,
i18n, `llms.txt`. These are explicitly RFC Phase 3/4 concerns.

## Source material (as surveyed)

- Legacy stack: Ruby/Middleman + Bookbinder. `config.yml` aggregates ~13 repos;
  `docs-cloudfoundry-concepts` mounts at URL prefix `/concepts/`.
- Content files: `*.html.md.erb`, including subdirs `architecture/` and `diego/`.
- ERB constructs actually used in concepts:
  - `<%= vars.X %>` — ~304 refs, ~95% are trivial strings (`app_runtime_abbr`,
    `platform_name`, `app_runtime_first`, `company_name`, `app_domain`). Some
    vars contain small HTML fragments.
  - `<%= partial 'name' %>` — 12 partials, invoked 1–2 per page. Mostly tables
    (roles, scale) and small snippets. A few are intentionally blank
    (commercial-book placeholders).
  - `<%# ... %>` ERB comments and `[//]: #` markdown comments.
  - Embedded HTML: `<p class="note">...</p>`, `<table>...</table>`.
  - `<a id='x'></a>` heading anchors; internal links use `.html`.
  - Frontmatter: `--- title: ... ---`.
- Variable source: `config/template_variables.yml` (in `docs-book-cloudfoundry`).
- Navigation source: `master_middleman/source/subnavs/_cf-subnav.erb`.
- Theme colors: `$navy #243640`, `$blue1 #2185c5`, `$blue2 #a7cae1`.
- Assets: CF logo (`logo_org.png` / `new_logo_org.png`), `favicon.ico`.
- Toolchain available: Node v26, npm 11.

## Architecture

```
cf-docs-new/
├── docusaurus.config.js      # site config, CF theming, navbar/footer, search theme
├── sidebars.js               # generated from legacy subnav (concepts subtree)
├── package.json
├── src/
│   ├── css/custom.css        # CF navy/blue palette mapped to Infima vars
│   └── data/vars.js          # template_variables.yml ported to JS — REBRAND POINT
├── docs/
│   └── concepts/             # migrated .mdx (mirrors source tree: architecture/, diego/)
│       └── _partials/        # 12 partials → MDX snippet components (underscore = not routed)
├── static/
│   └── img/concepts/         # copied images
└── scripts/
    ├── gen-vars.mjs          # template_variables.yml → src/data/vars.js
    ├── migrate.mjs           # ERB → MDX converter (the centerpiece)
    └── gen-sidebar.mjs       # _cf-subnav.erb → sidebars.js (concepts subtree only)
```

Docs live under `docs/concepts/` so the legacy `/concepts/...` URL prefix is
preserved and internal links map cleanly.

### Source location config

The three scripts read from the sibling legacy repos. Default paths (relative to
`cf-docs-new`):

- Concepts content: `../docs-cloudfoundry-concepts`
- Variables: `../docs-book-cloudfoundry/config/template_variables.yml`
- Subnav: `../docs-book-cloudfoundry/master_middleman/source/subnavs/_cf-subnav.erb`

Paths are overridable via CLI arg or env var so the scripts are not hard-wired to
one machine. Scripts fail loud (non-zero exit, clear message) if a source path is
missing.

## Templating & partials (Docusaurus-native)

Docusaurus has no built-in "variables" feature; the idiomatic pattern is MDX +
imported modules/components. This is the chosen mechanism.

- `src/data/vars.js` exports `export const vars = { app_runtime_abbr: "Cloud Foundry", ... }`,
  generated from `template_variables.yml` by `gen-vars.mjs`. **This is the single
  rebrand point.** A downstream distributor edits this one file.
- Migrated pages are `.mdx`. Each page that references a variable gets
  `import {vars} from '@site/src/data/vars';` injected at the top, and
  `<%= vars.X %>` becomes `{vars.X}`.
- Values are resolved at **build time**, so output HTML is static and remains
  SEO- and AI-crawler-friendly (an RFC goal).
- Partials become MDX components under `docs/concepts/_partials/`, imported where
  used. `<%= partial 'oss_roles_table' %>` → import `OssRolesTable` + `<OssRolesTable />`.
  Blank/placeholder partials become components that render nothing, so pages
  don't break.

## Migration script conversion rules (`scripts/migrate.mjs`)

Deterministic, re-runnable, no AI at runtime. Walks the concepts source tree and
emits `.mdx` into `docs/concepts/`.

| Legacy ERB | Becomes |
|---|---|
| `foo.html.md.erb` | `foo.mdx` (preserve subdir path) |
| `<%= vars.X %>` | `{vars.X}` (+ inject `import {vars}` once per file that uses it) |
| `<%= partial 'name' %>` | `<Name />` (+ inject import from `_partials/Name.mdx`) |
| `<%# ... %>` ERB comment | stripped |
| `[//]: # (...)` md comment | stripped |
| `<p class="note">...</p>` | `:::note` admonition |
| `<p class="warning">...</p>` | `:::warning` admonition |
| `<a id='x'></a> Heading` text | heading with anchor dropped (Docusaurus auto-slugs) |
| `](./foo.html)` / `](foo.html)` / `](../x/foo.html)` | same path with `.html` stripped |
| `](./images/x.png)` | `](./img/x.png)` (or static path), images copied accordingly |
| `<table>...</table>` | kept verbatim (valid in MDX) |
| frontmatter `title:` | preserved |

Partials themselves (`_name.html.md.erb`) are converted by the same rules into
`_partials/Name.mdx` wrapped as exported MDX components.

**Edge-case handling (visible, not silent):** any `vars.X` missing from the vars
module, any partial with no source, or any construct the script can't convert is
appended to `migration-report.txt`. This makes the "manual review pass per
section" the RFC describes an explicit, inspectable step rather than hidden
breakage.

## Sidebar generation (`scripts/gen-sidebar.mjs`)

Parses the **concepts subtree** of `_cf-subnav.erb` (the "General Information →
Cloud Foundry concepts" block and its nested `<ul>`s) into a Docusaurus
`sidebars.js` category/doc tree, preserving label text and nesting order. Links
pointing outside concepts (devguide, deploying, cf-cli, etc.) are dropped, since
only concepts is migrated for the PoC.

## Theming (`src/css/custom.css` + `docusaurus.config.js`)

- Map CF palette onto Infima: `--ifm-color-primary` family derived from
  `#2185c5`; navy `#243640` for navbar/footer where appropriate.
- Copy CF logo + favicon into `static/`; wire into navbar/config.
- Footer with a CF/community link (mirrors "Get Involved"). Kept lightweight.

## Search (offline full-text)

- Plugin: `@easyops-cn/docusaurus-search-local` — fully offline, build-time
  index, no Algolia account, no API keys, no network. Works on the GitHub Pages
  free tier the RFC targets.
- Configured in `docusaurus.config.js` `themes`, search box in the navbar.
- **Known behavior to note in the demo:** local search returns results against a
  **production build** (`npm run build` + `npm run serve`), not `npm start` dev
  mode. The demo checklist calls this out so search isn't mistaken for broken.
- Rejected alternative: Algolia DocSearch (RFC option 4) — requires an external
  account/approval and config; too much friction for a PoC and can't run offline.

## Data flow

```
template_variables.yml  --gen-vars.mjs-->   src/data/vars.js
*.html.md.erb (concepts) --migrate.mjs-->   docs/concepts/**/*.mdx  (+ migration-report.txt)
images/**               --migrate.mjs-->   static/img/concepts/**
_cf-subnav.erb          --gen-sidebar.mjs-> sidebars.js
                                            |
                                   npm start / npm run build (Docusaurus)
```

All three generators are independently repeatable.

## Error handling

- Generators validate source paths up front; exit non-zero with a clear message
  if missing.
- `migrate.mjs` uses per-file try/catch so one malformed file doesn't abort the
  batch; failures are recorded in the report and summarized at the end.
- Docusaurus configured with `onBrokenLinks: 'throw'` so broken internal links
  fail the build rather than shipping silently.

## Testing / verification checklist

Run before declaring the PoC done:

1. `npm install` succeeds.
2. `node scripts/gen-vars.mjs` produces `src/data/vars.js`.
3. `node scripts/migrate.mjs` produces `docs/concepts/**` and a
   `migration-report.txt`; review the report for unresolved items.
4. `node scripts/gen-sidebar.mjs` produces `sidebars.js`.
5. `npm run build` completes with **zero broken-link errors**.
6. `npm run serve` (prod build): spot-check in browser —
   - `{vars.*}` render as "Cloud Foundry" (not literal braces).
   - `:::note` admonitions render as styled callouts.
   - Role/scale tables render.
   - Images load.
   - Sidebar order/nesting matches the legacy concepts subnav.
   - **Search** returns concepts pages for queries like "Diego", "roles",
     "security".
7. CF palette + logo visibly applied.

## Open items / risks

- A few legacy HTML tables are large; they carry over verbatim and should render,
  but may want light manual cleanup for polish (acceptable for a PoC).
- Some `vars.*` contain HTML fragments; these render in MDX but are flagged in the
  report for a human to eyeball.
- One partial (`overview_model`) is intentionally blank upstream; it becomes an
  empty component by design.
