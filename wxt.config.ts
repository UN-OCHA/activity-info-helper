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
    optional_host_permissions: [
      "https://*/*",
      "http://*/*"
    ],
    browser_specific_settings: {
      gecko: {
        // @ts-ignore
        data_collection_permissions: {
          required: ['none']
        }
      }
    }
  },
});
