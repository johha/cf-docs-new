import {parse} from 'node-html-parser';

const BLOCK = new Set(['ul', 'ol', 'pre', 'p', 'div', 'table', 'blockquote']);

export function classifyTable(tableHtml) {
  const root = parse(tableHtml);
  const table = root.querySelector('table');
  if (!table) return {simple: false, reason: 'unparseable table'};
  if (tableHtml.match(/\b(colspan|rowspan)=/i)) return {simple: false, reason: 'cell spanning (colspan/rowspan)'};
  if (table.querySelector('col') || /<col[\s>]/i.test(tableHtml)) return {simple: false, reason: 'explicit col width'};
  for (const cell of table.querySelectorAll('td,th')) {
    const blockChildren = cell.childNodes.filter(
      n => n.nodeType === 1 && BLOCK.has(n.rawTagName?.toLowerCase()));
    if (blockChildren.length >= 1) {
      return {simple: false, reason: `cell contains <${blockChildren[0].rawTagName.toLowerCase()}>`};
    }
  }
  return {simple: true, reason: ''};
}

function cellText(cell) {
  return cell.innerHTML.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

export function tableToGfm(tableHtml) {
  const table = parse(tableHtml).querySelector('table');
  const headRow = table.querySelector('thead tr') || table.querySelector('tr');
  const headers = headRow.querySelectorAll('th,td').map(cellText);
  const bodyRows = (table.querySelector('tbody') || table)
    .querySelectorAll('tr')
    .filter(tr => tr !== headRow);
  const lines = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
  for (const tr of bodyRows) {
    const cells = tr.querySelectorAll('td,th').map(cellText);
    if (cells.length) lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

export function rewriteTables(text) {
  const keptHtml = [];
  const out = text.replace(/<table[\s\S]*?<\/table>/gi, (tbl) => {
    const {simple, reason} = classifyTable(tbl);
    if (simple) return '\n' + tableToGfm(tbl) + '\n';
    keptHtml.push({reason});
    return tbl;
  });
  return {text: out, keptHtml};
}
