import {parse} from 'node-html-parser';

function liToNode(li) {
  const a = li.querySelector(':scope > a');
  const span = li.querySelector(':scope > span');
  const label = (a?.text || span?.text || '').trim();
  const href = a?.getAttribute('href') || null;
  const childUl = li.querySelector(':scope > ul');
  const children = childUl
    ? childUl.querySelectorAll(':scope > li').map(liToNode)
    : [];
  return {label, href, children};
}

export function extractConceptsItems(erbHtml) {
  const root = parse(erbHtml);
  for (const li of root.querySelectorAll('li')) {
    const a = li.querySelector(':scope > a');
    if (a && a.getAttribute('href') === '/concepts/index.html') {
      return [liToNode(li)];
    }
  }
  return [];
}

function hrefToId(href) {
  if (!href) return null;
  const m = href.match(/^\/concepts\/(.+?)\.html(?:#.*)?$/);
  return m ? `concepts/${m[1]}` : null;
}

export function toSidebarItems(nodes, {validId}) {
  const out = [];
  for (const n of nodes) {
    const id = hrefToId(n.href);
    const childItems = toSidebarItems(n.children, {validId});
    if (n.children.length) {
      if (childItems.length) {
        const category = {type: 'category', label: n.label, items: childItems};
        if (id && validId(id)) category.link = {type: 'doc', id};
        out.push(category);
      } else if (id && validId(id)) {
        out.push({type: 'doc', id});
      }
    } else if (id && validId(id)) {
      out.push({type: 'doc', id});
    }
  }
  return out;
}
