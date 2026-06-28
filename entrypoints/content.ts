import { startCookieRejector } from '@/cmp/runner';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  allFrames: true,
  main() {
    void startCookieRejector();
  },
});
