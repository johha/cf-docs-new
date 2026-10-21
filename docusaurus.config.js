// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Cloud Foundry Documentation',
  tagline: 'Documentation to help you deploy and manage Cloud Foundry',
  favicon: 'img/favicon.ico',
  url: 'https://johha.github.io',
  baseUrl: '/cf-docs-new/',
  organizationName: 'johha',
  projectName: 'cf-docs-new',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  clientModules: ['./src/clientModules/tableLabels.js'],
  presets: [
    ['classic', /** @type {import('@docusaurus/preset-classic').Options} */ ({
      // exclude the SDD spec/plan markdown under docs/superpowers from doc routes
      docs: {
        sidebarPath: './sidebars.js',
        routeBasePath: '/',
        exclude: ['superpowers/**', '**/_partials/**', '**/subnav-index.*', '**/archive/**', '**/common/**', '**/cf-deployment/**'],
      },
      blog: false,
      theme: { customCss: './src/css/custom.css' },
    })],
  ],
  themes: [
    ['@easyops-cn/docusaurus-search-local',
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */ ({
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      })],
  ],
  themeConfig: /** @type {import('@docusaurus/preset-classic').ThemeConfig} */ ({
    announcementBar: {
      id: 'poc_banner',
      content: 'This is a <strong>proof-of-concept</strong> for the <a href="https://github.com/cloudfoundry/community/pull/1642">CF Documentation Modernization RFC</a>. It is not the official CF documentation.',
      backgroundColor: '#fff3cd',
      textColor: '#664d03',
      isCloseable: false,
    },
    // Keep the right-hand table of contents short: top-level sections only.
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    // Left sidebar: a hide toggle (bottom) + collapsible categories (both native).
    docs: {
      sidebar: { hideable: true, autoCollapseCategories: true },
    },
    navbar: {
      title: 'Documentation',
      // Official current Cloud Foundry logo (wordmark + mark) from cloudfoundry.org.
      logo: { alt: 'Cloud Foundry', src: 'img/cf-logo-vertical.png' },
      items: [],
    },
    footer: {
      style: 'dark',
      links: [{ title: 'Community', items: [{ label: 'Get Involved', href: 'https://www.cloudfoundry.org/community/' }] }],
      copyright: `Cloud Foundry Documentation © ${new Date().getFullYear()} Cloud Foundry Foundation. All Rights Reserved.`,
    },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  }),
};

export default config;
