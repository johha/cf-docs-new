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
