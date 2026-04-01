import {defineConfig} from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  srcDir: 'src',
  publicDir: 'src/assets',
  manifest: {
    name: "ActivityInfo Helper",
    description: "Perform ActivityInfo bulk database changes with ease",
    offline_enabled: false,
    permissions: ['webRequest', 'storage', 'unlimitedStorage', 'declarativeNetRequest'],
    host_permissions: [
      process.env.WXT_ACTIVITY_INFO_BASE_MATCHER ?? "https://3w.humanitarianaction.info/*",
    ]
  },
});
