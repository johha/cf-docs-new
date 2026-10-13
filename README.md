# Cloud Foundry Docs — Docusaurus PoC

> **This is a proof-of-concept** for [RFC: CF Documentation Modernization](https://github.com/cloudfoundry/community/pull/1642). It is not the official CF documentation.
> Live site: **https://johha.github.io/cf-docs-new/**

This repository is an RFC Phase-2 proof-of-concept demonstrating migration of
[docs-cloudfoundry-concepts](https://github.com/cloudfoundry/docs-cloudfoundry-concepts)
from the legacy ERB/book pipeline to [Docusaurus 3](https://docusaurus.io/).

All 41 source files are migrated automatically from the sibling repo. The
sidebar, variable definitions, and MDX output are fully regenerated from source
on every run — no hand-edited docs.

## One-command regeneration

```bash
npm run gen:all
```

This runs three steps in order:
1. `gen:vars` — reads `docs-book-cloudfoundry` configuration and writes `src/data/vars.js`
2. `migrate` — converts all `.html.md.erb` files from `docs-cloudfoundry-concepts` to MDX under `docs/concepts/`
3. `gen:sidebar` — parses the legacy subnav and writes `sidebars.js`

The sibling repositories must be checked out next to this one:
- `../docs-cloudfoundry-concepts`
- `../docs-book-cloudfoundry`

## Running the demo

Node 24 is required (Node 26 triggers a build-time incompatibility).

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
npm install
npm run build
npm run serve
```

Open `http://localhost:3000/docs-next/` in a browser.

**Search caveat:** Local search (`@easyops-cn/docusaurus-search-local`) only
works in a production build served via `npm run serve`. It does NOT work with
the dev server (`npm start`). Always use `npm run build && npm run serve` to
test search.

## Single rebrand point

All product-name variables are defined in `src/data/vars.js` (auto-generated
from `docs-book-cloudfoundry`). To rebrand, update the upstream config and
re-run `npm run gen:vars`, or edit `src/data/vars.js` directly for a quick
local test.

## Known limitations

These are accepted limitations of this PoC; they require source-repo fixes to
resolve fully:

**5 broken anchors (source bugs):**
- `concepts/diego/diego-architecture#bbs` — anchor missing in source
- `concepts/asg#unbinding-asgs` — anchor missing in source
- `concepts/contribute#github-pr` — anchor missing in source
- `concepts/contribute#github-issue` — anchor missing in source
- `concepts/architecture/uaa#scopes` — anchor missing in source

These produce build warnings but do not fail the build (`onBrokenAnchors` is
not set to `throw`).

**9 commercial-only variables render empty:**
Variables such as `vars.garden_runc` and `vars.ops_manager` exist only in
the commercial/PCF product book, not in the OSS `docs-book-cloudfoundry`.
Affected pages render those slots as empty strings. The 9 affected vars
(`garden_runc`, `asg_note`, `vm_note`, `best_practices_link`, `external_lb`,
`pcf_pools`, `ops_manager`, `compliance_links`, `app_svc_links`) are also
listed in `migration-report.txt`.

**11 HTML tables kept as-is:**
Tables with colspan attributes, explicit column widths, or block-level cell
content cannot be mechanically converted to GitHub-Flavored Markdown without
data loss. They remain as raw HTML in the MDX source and render correctly in
the browser. The full list is in `migration-report.txt`.

**Meta-description vars not resolved:**
Docusaurus generates `<meta name="description">` from the first paragraph of
each page. Because variable substitution uses JSX expressions, the SSR pass
cannot resolve them, so meta descriptions may contain literal `{vars.*}`
placeholders. The visible page body renders correctly.
