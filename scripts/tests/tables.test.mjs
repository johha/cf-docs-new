import {test} from 'node:test';
import assert from 'node:assert/strict';
import {classifyTable, tableToGfm, rewriteTables} from '../lib/tables.mjs';

const SIMPLE = `<table><thead><tr><th>A</th><th>B</th></tr></thead>` +
  `<tbody><tr><td>1</td><td><code>x</code></td></tr></tbody></table>`;
const COLSPAN = `<table><tbody><tr><td colspan="2">x</td></tr></tbody></table>`;
const BLOCKCELL = `<table><tbody><tr><td><ul><li>a</li></ul></td><td>b</td></tr></tbody></table>`;
const COLWIDTH = `<table><col width="25%"><thead><tr><th>A</th></tr></thead></table>`;

test('simple table classified simple', () => {
  assert.equal(classifyTable(SIMPLE).simple, true);
});
test('colspan kept html', () => {
  const r = classifyTable(COLSPAN);
  assert.equal(r.simple, false); assert.match(r.reason, /span/i);
});
test('block cell kept html', () => {
  const r = classifyTable(BLOCKCELL);
  assert.equal(r.simple, false); assert.match(r.reason, /ul|block/i);
});
test('col width kept html', () => {
  const r = classifyTable(COLWIDTH);
  assert.equal(r.simple, false); assert.match(r.reason, /col|width/i);
});
test('tableToGfm renders header + row', () => {
  const gfm = tableToGfm(SIMPLE);
  assert.match(gfm, /\| A \| B \|/);
  assert.match(gfm, /\| --- \| --- \|/);
  assert.match(gfm, /\| 1 \|/);
  assert.ok(gfm.includes('<code>x</code>'));
});
test('rewriteTables converts simple, keeps complex with reason', () => {
  const {text, keptHtml} = rewriteTables(`${SIMPLE}\n\n${BLOCKCELL}`);
  assert.ok(text.includes('| A | B |'));
  assert.ok(text.includes('<ul>'));
  assert.equal(keptHtml.length, 1);
});

test('tableToGfm self-closes br in cell innerHTML', () => {
  const tbl = `<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x<br>y</td></tr></tbody></table>`;
  const gfm = tableToGfm(tbl);
  assert.ok(gfm.includes('<br/>'), `expected <br/> in gfm, got: ${gfm}`);
  assert.ok(!gfm.includes('<br>'), `unexpected bare <br> in gfm`);
});
