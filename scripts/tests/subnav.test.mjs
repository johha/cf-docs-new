import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractConceptsItems, toSidebarItems} from '../lib/subnav.mjs';

const ERB = `
<ul>
 <li class="has_submenu"><a href="/concepts/index.html">Cloud Foundry concepts</a>
   <ul>
     <li><a href="/concepts/overview.html">Cloud Foundry overview</a></li>
     <li class="has_submenu"><a href="/concepts/security-index.html">Security and networking</a>
       <ul>
         <li><a href="/concepts/security.html">Cloud Foundry security</a></li>
         <li><a href="/devguide/deploy-apps/app-lifecycle.html">Out of scope</a></li>
       </ul>
     </li>
   </ul>
 </li>
</ul>`;

test('extractConceptsItems finds the concepts subtree', () => {
  const items = extractConceptsItems(ERB);
  assert.equal(items[0].label, 'Cloud Foundry concepts');
  assert.ok(items[0].children.length >= 2);
});

test('toSidebarItems keeps valid concepts docs, drops others', () => {
  const items = extractConceptsItems(ERB);
  const valid = new Set(['concepts/overview', 'concepts/security', 'concepts/security-index', 'concepts/index']);
  const sb = toSidebarItems(items, {validId: id => valid.has(id)});
  const json = JSON.stringify(sb);
  assert.ok(json.includes('concepts/overview'));
  assert.ok(json.includes('concepts/security'));
  assert.equal(json.includes('devguide'), false); // out-of-scope dropped
});
