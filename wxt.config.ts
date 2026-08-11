import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Cookie Monster',
    description:
      'Automatically rejects optional cookies and legitimate interest options on EU consent popups.',
    version: '0.2.4',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['<all_urls>', 'https://formspree.io/*'],
    browser_specific_settings: {
      gecko: {
        id: 'cookie-monster@example.com',
        strict_min_version: '109.0',
      },
    },
  },
});
