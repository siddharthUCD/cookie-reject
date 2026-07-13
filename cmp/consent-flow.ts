import type { HandlerResult } from '@/cmp/types';
import {
  clickSaveChoices,
  disableLegitimateInterestToggles,
  expandConsentAccordions,
  findConsentRoot,
  hasConsentUi,
  isPreferencesPanelOpen,
  rejectAllIfVisible,
} from '@/cmp/preferences-flow';
import { wait } from '@/utils/dom';

export async function runOrderedConsentFlow(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  if (!hasConsentUi(root)) {
    return { handled: false };
  }

  const consentRoot = findConsentRoot(root) ?? root;

  if (rejectAllIfVisible(consentRoot)) {
    await wait(300);
    await clickSaveChoices(consentRoot);
    return { handled: true, action: 'reject-all' };
  }

  // Only process LI when a preference panel is already open — never open links or new tabs
  if (isPreferencesPanelOpen(root)) {
    await expandConsentAccordions(consentRoot);
    await disableLegitimateInterestToggles(consentRoot);

    if (rejectAllIfVisible(consentRoot)) {
      await wait(300);
      await clickSaveChoices(consentRoot);
      return { handled: true, action: 'li-then-reject' };
    }
  }

  return { handled: false };
}
