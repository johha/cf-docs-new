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
