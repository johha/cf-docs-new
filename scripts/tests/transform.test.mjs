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

test('rewriteNoteBlocks handles compound classes', () => {
  const imp = t.rewriteNoteBlocks('<p class="note important">Important text</p>');
  assert.ok(imp.includes(':::info'), `expected :::info, got: ${imp}`);
  const cau = t.rewriteNoteBlocks('<p class="note caution">Caution text</p>');
  assert.ok(cau.includes(':::caution'), `expected :::caution, got: ${cau}`);
  const warn = t.rewriteNoteBlocks('<p class="warning">Warning text</p>');
  assert.ok(warn.includes(':::warning'), `expected :::warning, got: ${warn}`);
});

test('stripHeadingAnchors converts to Docusaurus {#id} syntax', () => {
  assert.equal(t.stripHeadingAnchors("## <a id='about'></a> About"), '## About {#about}');
  assert.equal(t.stripHeadingAnchors('## <a id="staging-running"></a> Staging and running ASGs'), '## Staging and running ASGs {#staging-running}');
  assert.equal(t.stripHeadingAnchors('#### <a id="deep"></a> Deep heading'), '#### Deep heading {#deep}');
  // Heading with no anchor is unchanged
  assert.equal(t.stripHeadingAnchors('## No anchor here'), '## No anchor here');
});

test('rewriteInternalLinks strips .html only for internal', () => {
  assert.equal(t.rewriteInternalLinks('[a](./foo.html)'), '[a](./foo)');
  assert.equal(t.rewriteInternalLinks('[a](./foo.html#frag)'), '[a](./foo#frag)');
  assert.equal(t.rewriteInternalLinks('[a](https://x.org/y.html)'), '[a](https://x.org/y.html)');
  assert.equal(t.rewriteInternalLinks('[a](./foo)'), '[a](./foo)');
});

test('rewriteInternalLinks externalizes out-of-scope sections', () => {
  assert.equal(
    t.rewriteInternalLinks('[x](../devguide/deploy-apps/app-lifecycle.html)'),
    '[x](https://docs.cloudfoundry.org/devguide/deploy-apps/app-lifecycle.html)'
  );
  assert.equal(
    t.rewriteInternalLinks('[x](../../devguide/deploy-apps/streaming-logs.html#frag)'),
    '[x](https://docs.cloudfoundry.org/devguide/deploy-apps/streaming-logs.html#frag)'
  );
  // no .html in source (already stripped by prior run — source always has .html but test robustness)
  assert.equal(
    t.rewriteInternalLinks('[x](/uaa/uaa-deploy.html)'),
    '[x](https://docs.cloudfoundry.org/uaa/uaa-deploy.html)'
  );
  // concepts-internal link is NOT externalized
  assert.equal(
    t.rewriteInternalLinks('[x](../concepts/architecture/index.html#blob)'),
    '[x](../concepts/architecture/#blob)'
  );
});

test('rewriteInternalLinks fixes index routes', () => {
  assert.equal(t.rewriteInternalLinks('[x](architecture/index#routing)'), '[x](architecture/#routing)');
  assert.equal(t.rewriteInternalLinks('[x](./architecture/index#bbs)'), '[x](./architecture/#bbs)');
  assert.equal(t.rewriteInternalLinks('[x](index#diego-cell)'), '[x](./#diego-cell)');
  assert.equal(t.rewriteInternalLinks('[x](architecture/index)'), '[x](architecture/)');
});

test('rewriteImagePaths absolute url for all image path forms', () => {
  assert.equal(t.rewriteImagePaths('![x](./images/a.png)'), '![x](/img/concepts/a.png)');
  assert.equal(t.rewriteImagePaths('![x](images/a.png)'), '![x](/img/concepts/a.png)');
  assert.equal(t.rewriteImagePaths('![x](../images/diego/b.png)'), '![x](/img/concepts/diego/b.png)');
  assert.equal(t.rewriteImagePaths('![x](./images/../../images/c.png)'), '![x](/img/concepts/c.png)');
});

test('findVarRefs / rewriteVarRefs plain (no htmlVars)', () => {
  const s = 'use <%= vars.app_runtime_abbr %> and <%= vars.platform_name %> and <%= vars.app_runtime_abbr %>';
  assert.deepEqual(t.findVarRefs(s).sort(), ['app_runtime_abbr', 'platform_name']);
  assert.equal(t.rewriteVarRefs('x <%= vars.foo %>'), 'x {vars.foo}');
});

test('rewriteVarRefs with htmlVars emits <Html> for HTML keys', () => {
  const htmlVars = {admin_role: true, credhub_link: true};
  assert.equal(
    t.rewriteVarRefs('<%= vars.admin_role %>', htmlVars),
    '<Html html={vars.admin_role} />'
  );
  assert.equal(
    t.rewriteVarRefs('<%= vars.platform_name %>', htmlVars),
    '{vars.platform_name}'
  );
  assert.equal(
    t.rewriteVarRefs('<%= vars.credhub_link %> and <%= vars.platform_name %>', htmlVars),
    '<Html html={vars.credhub_link} /> and {vars.platform_name}'
  );
});

test('findPartialRefs / rewritePartialRefs', () => {
  const s = `<%= partial 'oss_roles_table' %> <%= partial "default_asg_oss" %>`;
  assert.deepEqual(t.findPartialRefs(s).sort(), ['default_asg_oss', 'oss_roles_table']);
  assert.equal(t.rewritePartialRefs(`<%= partial 'x_y' %>`), '<XY />');
});

test('normalizeVoidTags self-closes br, hr, col, img', () => {
  assert.equal(t.normalizeVoidTags('<br>'), '<br/>');
  assert.equal(t.normalizeVoidTags('<hr>'), '<hr/>');
  assert.equal(t.normalizeVoidTags('<col width="50%">'), '<col width="50%"/>');
  assert.equal(t.normalizeVoidTags('<img src="x.png">'), '<img src="x.png"/>');
  // Already self-closed → unchanged
  assert.equal(t.normalizeVoidTags('<br/>'), '<br/>');
});

test('repairHtml closes unclosed <li>', () => {
  const input = '<ol><li>A\n<li>B</li>\n</ol>';
  const out = t.repairHtml(input);
  assert.ok(out.includes('<li>A\n</li><li>B</li>'), `got: ${out}`);
});

test('repairHtml closes unclosed <ul> before </td>', () => {
  const input = '<td><ul><li>a</li><li>b</li></td>';
  const out = t.repairHtml(input);
  assert.ok(out.includes('</ul></td>'), `got: ${out}`);
});

test('repairHtml wraps text+ul in td with <p>', () => {
  const input = '<td>Some text:\n  <ul>\n    <li>item</li>\n  </ul>\n</td>';
  const out = t.repairHtml(input);
  // text moved to next line so MDX can parse it as flow content
  assert.ok(out.includes('<td>\n  Some text:'), `got: ${out}`);
  assert.ok(!out.includes('<td>Some text:'), `got: ${out}`);
});

test('repairHtml escapes CLI placeholder <UPPER-CASE/ in double-tab lines', () => {
  const input = '\t\tcf curl /v3/apps/<APP-GUID/processes';
  const out = t.repairHtml(input);
  assert.ok(out.includes('&lt;APP-GUID/'), `got: ${out}`);
});
