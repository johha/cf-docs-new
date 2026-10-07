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
