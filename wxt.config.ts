import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Cookie Reject',
    description:
      'Automatically rejects optional cookies and legitimate interest options on EU consent popups.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['<all_urls>'],
    browser_specific_settings: {
      gecko: {
        id: 'cookie-reject@example.com',
        strict_min_version: '109.0',
      },
    },
  },
});
