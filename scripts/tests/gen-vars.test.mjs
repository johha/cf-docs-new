import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildVars, buildHtmlVars} from '../gen-vars.mjs';

test('buildVars maps scalars, empties, and html', () => {
  const vars = buildVars(readFileSync('scripts/fixtures/vars-sample.yml', 'utf8'));
  assert.equal(vars.app_runtime_abbr, 'Cloud Foundry');
  assert.equal(vars.current_major_version, '10-0');
  assert.equal(vars.empty_var, '');
  assert.ok(vars.html_var.includes('<a href'));
});

test('buildHtmlVars flags HTML values and skips plain strings', () => {
  const vars = buildVars(readFileSync('scripts/fixtures/vars-sample.yml', 'utf8'));
  const htmlVars = buildHtmlVars(vars);
  assert.equal(htmlVars.html_var, true, 'html_var should be flagged as HTML');
  assert.ok(!htmlVars.app_runtime_abbr, 'app_runtime_abbr should NOT be flagged (plain text)');
  assert.ok(!htmlVars.empty_var, 'empty_var should NOT be flagged');
  assert.ok(!htmlVars.current_major_version, 'current_major_version should NOT be flagged');
});

test('resolveSource throws on missing path', async () => {
  const {resolveSource} = await import('../lib/sources.mjs');
  assert.throws(() => resolveSource('vars', '/no/such/file.yml'), /not found/);
});
