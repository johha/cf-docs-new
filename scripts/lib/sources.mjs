import {existsSync} from 'node:fs';
import {resolve, join} from 'node:path';

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

/** The docs subdirectory slug, e.g. "concepts" → docs/concepts, static/img/concepts */
export function resolveSection() {
  return process.env.CF_SECTION ?? 'concepts';
}

/** The sidebar key written into sidebars.js, e.g. "conceptsSidebar" */
export function resolveSidebarId() {
  return process.env.CF_SIDEBAR_ID ?? 'conceptsSidebar';
}

/** Derived output paths for a given section slug. */
export function resolvePaths(section) {
  const s = section ?? resolveSection();
  return {
    outDocs:     join('docs', s),
    outPartials: join('docs', s, '_partials'),
    outImg:      join('static', 'img', s),
    outReport:   `migration-report-${s}.txt`,
  };
}
