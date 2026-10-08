import {existsSync, readFileSync} from 'node:fs';
import {resolve, join, basename} from 'node:path';
import yaml from 'js-yaml';

// Well-known paths inside the book repo
const BOOK_VARS    = 'config/template_variables.yml';
const BOOK_SUBNAV  = 'master_middleman/source/subnavs/_cf-subnav.erb';
const BOOK_CONFIG  = 'config.yml';
const DEFAULT_BOOK = '../docs-book-cloudfoundry';

/**
 * Resolve the book repo root.  Prefers CF_BOOK_DIR, falls back to the
 * sibling docs-book-cloudfoundry directory.
 */
function resolveBookDir() {
  const raw = process.env.CF_BOOK_DIR ?? DEFAULT_BOOK;
  const abs = resolve(process.cwd(), raw);
  if (!existsSync(abs)) {
    throw new Error(`Book repo not found at ${abs}. Set CF_BOOK_DIR.`);
  }
  return abs;
}

/**
 * Given a content repo path, look up its section slug in the book's
 * config.yml by matching the repository name suffix against CF_REPO's
 * basename, e.g. "docs-deploying-cf" → "deploying".
 */
function lookupSection(bookDir, repoBasename) {
  const configPath = join(bookDir, BOOK_CONFIG);
  if (!existsSync(configPath)) return null;
  const doc = yaml.load(readFileSync(configPath, 'utf8')) || {};
  for (const section of doc.sections ?? []) {
    const repoName = section?.repository?.name ?? '';
    // repoName is e.g. "cloudfoundry/docs-deploying-cf"
    if (repoName.split('/').pop() === repoBasename) {
      return section.directory ?? null;
    }
  }
  return null;
}

/**
 * Resolve all migration inputs from a single CF_REPO path.
 *
 * Priority order for each piece:
 *   1. Explicit env var (CF_CONCEPTS_DIR, CF_SECTION, etc.)
 *   2. Derived from CF_REPO + book config.yml lookup
 *   3. Hard-coded defaults (original behaviour)
 */
export function resolveAll() {
  const bookDir = resolveBookDir();

  // --- source repo ---
  let srcDir;
  if (process.env.CF_REPO) {
    srcDir = resolve(process.cwd(), process.env.CF_REPO);
    if (!existsSync(srcDir)) {
      throw new Error(`CF_REPO not found at ${srcDir}.`);
    }
  } else if (process.env.CF_CONCEPTS_DIR) {
    srcDir = resolve(process.cwd(), process.env.CF_CONCEPTS_DIR);
    if (!existsSync(srcDir)) {
      throw new Error(`CF_CONCEPTS_DIR not found at ${srcDir}.`);
    }
  } else {
    srcDir = resolve(process.cwd(), '../docs-cloudfoundry-concepts');
    if (!existsSync(srcDir)) {
      throw new Error(`Default source repo not found at ${srcDir}. Set CF_REPO.`);
    }
  }

  // --- section slug ---
  let section;
  if (process.env.CF_SECTION) {
    section = process.env.CF_SECTION;
  } else {
    const repoBasename = basename(srcDir);
    section = lookupSection(bookDir, repoBasename) ?? repoBasename;
  }

  // --- sidebar id ---
  const sidebarId = process.env.CF_SIDEBAR_ID ?? (section + 'Sidebar');

  // --- vars file ---
  const varsFile = process.env.CF_VARS_FILE
    ? resolve(process.cwd(), process.env.CF_VARS_FILE)
    : join(bookDir, BOOK_VARS);
  if (!existsSync(varsFile)) {
    throw new Error(`Vars file not found at ${varsFile}. Set CF_VARS_FILE.`);
  }

  // --- subnav file ---
  const subnavFile = process.env.CF_SUBNAV_FILE
    ? resolve(process.cwd(), process.env.CF_SUBNAV_FILE)
    : join(bookDir, BOOK_SUBNAV);
  if (!existsSync(subnavFile)) {
    throw new Error(`Subnav file not found at ${subnavFile}. Set CF_SUBNAV_FILE.`);
  }

  return {srcDir, section, sidebarId, varsFile, subnavFile, bookDir};
}

/** Derived output paths for a given section slug. */
export function resolvePaths(section) {
  return {
    outDocs:     join('docs', section),
    outPartials: join('docs', section, '_partials'),
    outImg:      join('static', 'img', section),
    outReport:   `migration-report-${section}.txt`,
  };
}

// ---------------------------------------------------------------------------
// Legacy named exports kept for backwards-compatibility with existing callers
// ---------------------------------------------------------------------------

export function resolveSection() {
  return process.env.CF_SECTION ?? 'concepts';
}

export function resolveSidebarId() {
  return process.env.CF_SIDEBAR_ID ?? 'conceptsSidebar';
}

export function resolveSource(name, cliArg) {
  const DEFAULTS = {
    concepts: '../docs-cloudfoundry-concepts',
    vars:     join(resolve(process.cwd(), DEFAULT_BOOK), BOOK_VARS),
    subnav:   join(resolve(process.cwd(), DEFAULT_BOOK), BOOK_SUBNAV),
  };
  const ENV = { concepts: 'CF_CONCEPTS_DIR', vars: 'CF_VARS_FILE', subnav: 'CF_SUBNAV_FILE' };
  const raw = cliArg || process.env[ENV[name]] || DEFAULTS[name];
  const abs = resolve(process.cwd(), raw);
  if (!existsSync(abs)) {
    throw new Error(`Source "${name}" not found at ${abs}. Pass a path arg or set ${ENV[name]}.`);
  }
  return abs;
}
