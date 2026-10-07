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
test('assembleMdx uses partialsDir for subdir files', () => {
  const out = assembleMdx({
    frontmatter: {title: 'Sub'}, body: '<Bar />',
    varsUsed: false, partialsUsed: [{component: 'Bar', file: 'Bar'}], isPartial: false,
    partialsDir: '../_partials',
  });
  assert.ok(out.includes("import Bar from '../_partials/Bar.mdx'"));
});
test('assembleMdx partial has no frontmatter', () => {
  const out = assembleMdx({frontmatter: {}, body: 'hi', varsUsed: false, partialsUsed: [], isPartial: true});
  assert.equal(out.startsWith('---'), false);
  assert.ok(out.includes('hi'));
});
