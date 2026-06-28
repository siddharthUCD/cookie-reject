import { ensureDefaultSettings } from '@/utils/storage';

export default defineBackground(() => {
  void ensureDefaultSettings();
});
