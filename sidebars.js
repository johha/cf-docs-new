// @ts-check
// Mirrors the structure of _cf-subnav.erb from docs-book-cloudfoundry.
// Stub sections (not yet migrated) link to their placeholder index page.
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */

export default {
  mainSidebar: [
    // ── General Information ──────────────────────────────────────────────
    {
      type: 'html',
      value: '<strong>General Information</strong>',
      defaultStyle: true,
    },
    { type: 'doc', id: 'concepts/contribute', label: 'Contribute to Cloud Foundry documentation' },
    {
      type: 'category',
      label: 'Cloud Foundry concepts',
      link: { type: 'doc', id: 'concepts/index' },
      items: [
        { type: 'doc', id: 'concepts/overview' },
        {
          type: 'category',
          label: 'Security and networking',
          link: { type: 'doc', id: 'concepts/security-index' },
          items: [
            { type: 'doc', id: 'concepts/security' },
            { type: 'doc', id: 'concepts/container-security' },
            { type: 'doc', id: 'concepts/understand-cf-networking' },
            { type: 'doc', id: 'concepts/identity-aware-routing' },
            { type: 'doc', id: 'concepts/roles' },
            { type: 'doc', id: 'concepts/managing-roles' },
            { type: 'doc', id: 'concepts/orgs-and-spaces' },
            { type: 'doc', id: 'concepts/asg' },
            { type: 'doc', id: 'concepts/diego/ssh-conceptual' },
          ],
        },
        {
          type: 'category',
          label: 'High availability',
          link: { type: 'doc', id: 'concepts/ha-index' },
          items: [
            { type: 'doc', id: 'concepts/high-availability' },
            { type: 'doc', id: 'concepts/maintaining-high-availability' },
          ],
        },
        {
          type: 'category',
          label: 'How Cloud Foundry manages apps',
          link: { type: 'doc', id: 'concepts/apps-index' },
          items: [
            { type: 'doc', id: 'concepts/how-applications-are-staged' },
            { type: 'doc', id: 'concepts/diego/diego-auction' },
          ],
        },
        {
          type: 'category',
          label: 'Cloud Foundry components',
          link: { type: 'doc', id: 'concepts/architecture/index' },
          items: [
            { type: 'doc', id: 'concepts/diego/diego-architecture' },
            { type: 'doc', id: 'concepts/cf-routing-architecture' },
            { type: 'doc', id: 'concepts/architecture/cloud-controller' },
            { type: 'doc', id: 'concepts/cc-blobstore' },
            { type: 'doc', id: 'concepts/architecture/uaa' },
            { type: 'doc', id: 'concepts/architecture/garden' },
            { type: 'doc', id: 'concepts/grootfs-disk' },
            { type: 'doc', id: 'concepts/http-routing' },
          ],
        },
      ],
    },
    {
      type: 'category',
      label: '🚧 Cloud Foundry Command Line Interface (cf CLI)',
      link: { type: 'doc', id: 'cf-cli/index' },
      items: [],
    },

    // ── Information for Operators ────────────────────────────────────────
    {
      type: 'html',
      value: '<strong>Information for Operators</strong>',
      defaultStyle: true,
    },
    {
      type: 'category',
      label: '🚧 Deploying Cloud Foundry',
      link: { type: 'doc', id: 'deploying/index' },
      items: [
        { type: 'doc', id: 'deploying/cf-release-eol', label: 'cf-release End of Life' },
      ],
    },
    {
      type: 'category',
      label: '🚧 Administering Cloud Foundry',
      link: { type: 'doc', id: 'adminguide/index' },
      items: [
        { type: 'doc', id: 'adminguide/troubleshooting_slow_requests', label: 'Troubleshooting slow requests' },
      ],
    },
    {
      type: 'category',
      label: '🚧 Running and Troubleshooting Cloud Foundry',
      link: { type: 'doc', id: 'running/index' },
      items: [],
    },
    {
      type: 'category',
      label: '🚧 Logging and metrics in Cloud Foundry',
      link: { type: 'doc', id: 'loggregator/index' },
      items: [],
    },
    {
      type: 'category',
      label: '🚧 BOSH Backup and Restore (BBR)',
      link: { type: 'doc', id: 'bbr/index' },
      items: [],
    },

    // ── Information for Developers ───────────────────────────────────────
    {
      type: 'html',
      value: '<strong>Information for Developers</strong>',
      defaultStyle: true,
    },
    {
      type: 'category',
      label: '🚧 Developing and managing apps',
      link: { type: 'doc', id: 'devguide/index' },
      items: [],
    },
    {
      type: 'category',
      label: '🚧 Cloud Foundry Buildpacks',
      link: { type: 'doc', id: 'buildpacks/index' },
      items: [],
    },

    // ── Information for Managed Service Authors ──────────────────────────
    {
      type: 'html',
      value: '<strong>Information for Managed Service Authors</strong>',
      defaultStyle: true,
    },
    {
      type: 'category',
      label: '🚧 Services in Cloud Foundry',
      link: { type: 'doc', id: 'services/index' },
      items: [
        {
          type: 'category',
          label: '🚧 CredHub',
          link: { type: 'doc', id: 'credhub/index' },
          items: [],
        },
      ],
    },

    // ── User Account and Authentication ──────────────────────────────────
    {
      type: 'html',
      value: '<strong>User Account and Authentication</strong>',
      defaultStyle: true,
    },
    {
      type: 'category',
      label: '🚧 User Account and Authentication (UAA)',
      link: { type: 'doc', id: 'uaa/index' },
      items: [],
    },

    // ── API Reference ─────────────────────────────────────────────────────
    {
      type: 'html',
      value: '<strong>API Reference</strong>',
      defaultStyle: true,
    },
    {
      type: 'link',
      label: 'UAA API',
      href: 'https://docs.cloudfoundry.org/api/uaa/index.html',
    },
    {
      type: 'link',
      label: 'CAPI V2',
      href: 'https://v2-apidocs.cloudfoundry.org',
    },
    {
      type: 'link',
      label: 'CAPI V3',
      href: 'https://v3-apidocs.cloudfoundry.org/index.html',
    },
  ],
};
