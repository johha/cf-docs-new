import yaml from 'js-yaml';

export function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return {frontmatter: {}, body: text};
  return {frontmatter: yaml.load(m[1]) || {}, body: text.slice(m[0].length)};
}

export function assembleMdx({frontmatter, body, varsUsed, htmlUsed, partialsUsed, isPartial, partialsDir = './_partials'}) {
  const imports = [];
  if (varsUsed) imports.push("import {vars} from '@site/src/data/vars';");
  if (htmlUsed) imports.push("import Html from '@site/src/components/Html';");
  for (const p of partialsUsed) imports.push(`import ${p.component} from '${partialsDir}/${p.file}.mdx';`);
  const importBlock = imports.length ? imports.join('\n') + '\n\n' : '';

  if (isPartial) {
    // Partial file is itself an MDX doc; importing .mdx yields its default export.
    return `${importBlock}${body.trim()}\n`;
  }
  const fmKeys = Object.keys(frontmatter);
  const fm = fmKeys.length ? `---\n${yaml.dump(frontmatter).trim()}\n---\n\n` : '';
  return `${fm}${importBlock}${body.trim()}\n`;
}
