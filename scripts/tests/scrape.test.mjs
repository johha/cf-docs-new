import {test} from 'node:test';
import assert from 'node:assert/strict';
import {htmlToMdx, resolveHref, classifyOutcome, docPathFromUrl} from '../lib/scrape.mjs';

const URL_ = 'https://docs.cloudfoundry.org/adminguide/page.html';
const wrap = body => `<html><body><main id="js-content"><h1>My Title</h1>${body}</main></body></html>`;
const conv = body => htmlToMdx(wrap(body), {pageUrl: URL_, hasDoc: p => p === 'concepts/overview'});

test('docPathFromUrl strips host and .html', () => {
  assert.equal(docPathFromUrl(URL_), 'adminguide/page');
});
test('title goes to frontmatter, h1 removed from body', () => {
  const {mdx} = conv('<p>Hi</p>');
  assert.match(mdx, /^---\ntitle: "My Title"\n---\n\nHi\n$/);
});
test('heading keeps inner anchor id', () => {
  assert.match(conv('<h2 id="x"><a id="cause"></a> Find it</h2>').mdx, /## Find it \{#cause\}/);
});
test('links: local doc becomes route, other docs absolute, anchors untouched', () => {
  const h = p => p === 'concepts/overview';
  assert.equal(resolveHref('/concepts/overview.html#a', URL_, h), '/concepts/overview#a');
  assert.equal(resolveHref('/loggregator/x.html', URL_, h), 'https://docs.cloudfoundry.org/loggregator/x.html');
  assert.equal(resolveHref('#top', URL_, h), '#top');
  assert.equal(resolveHref('http://example.com/', URL_, h), 'http://example.com/');
});
test('pre becomes fenced block with inner tags stripped', () => {
  const {mdx} = conv('<pre class="highlight plaintext"><code>time curl -v X\n</code></pre>');
  assert.match(mdx, /```\ntime curl -v X\n```/);
});
test('MDX-unsafe text is escaped, inline code is not', () => {
  const {mdx} = conv('<p>a {b} &lt;c&gt; <code>{d}</code></p>');
  assert.match(mdx, /a \\\{b\\\} &lt;c&gt; `\{d\}`/);
});
test('images are collected and rewritten', () => {
  const r = conv('<p><img src="images/a.png" alt="A"/></p>');
  assert.match(r.mdx, /!\[A\]\(\/img\/adminguide\/a\.png\)/);
  assert.equal([...r.images.keys()][0], 'https://docs.cloudfoundry.org/adminguide/images/a.png');
});
test('nested lists keep indentation', () => {
  const {mdx} = conv('<ul><li>a<ul><li>b</li></ul></li></ul>');
  assert.match(mdx, /- a\n  - b/);
});
test('outcome classification', () => {
  assert.equal(classifyOutcome('The output shows latency.'), 'bad');
  assert.equal(classifyOutcome('The output does not show latency.'), 'ok');
  assert.equal(classifyOutcome('The output does not show a log line.'), '');
  assert.equal(classifyOutcome('latency within x but not in y'), '');
});
test('tables: wrapper, outcome marker, pipes escaped, width attrs dropped', () => {
  const {mdx} = conv('<table><thead><tr><th>Result</th><th>Action</th></tr></thead>' +
    '<tr><td width="25%">Output shows latency.</td><td>a | b</td></tr></table>');
  assert.match(mdx, /<div className="cf-table">/);
  assert.match(mdx, /\| --- \| --- \|/);
  assert.match(mdx, /cf-r--bad" \/>Output shows latency\. \| a \\\| b \|/);
  assert.ok(!mdx.includes('width'));
});

test('unclosed <p> before <pre> is closed; stray p tags inside pre dropped', () => {
  const {mdx} = conv('<p>For example:\n<pre class="terminal">\n$ cf logs a</p>\n\n<p>line2\n</pre>\nAfter</p>');
  assert.match(mdx, /For example:\n\n```\n\$ cf logs a\n\nline2\n```\n\nAfter/);
});
