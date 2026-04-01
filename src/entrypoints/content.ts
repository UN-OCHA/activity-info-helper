export default defineContentScript({
  matches: [import.meta.env.WXT_ACTIVITY_INFO_BASE_MATCHER],
  main() {
    console.log('Hello content.');
  },
});
