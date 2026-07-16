import type { HandlerResult } from '@/cmp/types';
import {
  GFC_BUTTON_SELECTORS,
  GFC_VENDOR_LINK_SELECTORS,
  MANAGE_OPTIONS_PATTERNS,
  TEXT_SELECTORS,
  VENDOR_PREFERENCES_PATTERNS,
} from '@/cmp/google-funding-choices/constants';
import {
  isDataPreferencesView,
  isGoogleFundingChoicesUi,
  isPreferencesView,
  isVendorPreferencesView,
  isWelcomeScreen,
} from '@/cmp/google-funding-choices/detect';
import {
  advanceScroll,
  hasReachedBottom,
  resetScrollState,
  scrollToBottom,
  syncScrollFromDom,
} from '@/cmp/google-funding-choices/scroll';
import {
  collectOnLegitimateInterestToggles,
  disableNextLegitimateInterestToggle,
  resetToggleState,
} from '@/cmp/google-funding-choices/toggles';
import {
  findByTextPatterns,
  getElementTextVariants,
  isVisible,
  queryAllIncludingShadow,
  wait,
} from '@/utils/dom';
import { SAVE_CHOICES_PATTERNS } from '@/utils/patterns';

let manageOptionsClicked = false;
let vendorPreferencesOpened = false;
let dataPrefsLiComplete = false;
let vendorLinkAttempts = 0;

export function isGfcFlowActive(): boolean {
  return manageOptionsClicked || vendorPreferencesOpened;
}

function resetGfcState(): void {
  manageOptionsClicked = false;
  vendorPreferencesOpened = false;
  dataPrefsLiComplete = false;
  vendorLinkAttempts = 0;
  resetScrollState();
  resetToggleState();
}

function isExternalNavigationLink(element: Element): boolean {
  if (!(element instanceof HTMLAnchorElement)) {
    return false;
  }

  const href = (element.getAttribute('href') ?? '').trim();
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return false;
  }

  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin || url.pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

function clickGfcControl(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
  selectors: string,
): boolean {
  const element = findByTextPatterns(root, patterns, selectors, {
    lenient: true,
  });

  if (!element || isExternalNavigationLink(element)) {
    return false;
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  element.click();
  return true;
}

function clickGfcButton(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
): boolean {
  return clickGfcControl(root, patterns, GFC_BUTTON_SELECTORS);
}

/**
 * Find the in-dialog "Vendor preferences" link.
 * Prefer the shortest leaf that exactly matches, so we don't click a huge parent.
 */
function findVendorPreferencesLink(
  root: Document | Element | ShadowRoot,
): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  for (const element of queryAllIncludingShadow(root, GFC_VENDOR_LINK_SELECTORS)) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    if (!isVisible(element, { lenient: true })) {
      continue;
    }

    if (isExternalNavigationLink(element)) {
      continue;
    }

    const texts = getElementTextVariants(element);
    const exact = texts.some((text) =>
      VENDOR_PREFERENCES_PATTERNS.some((pattern) => pattern.test(text)),
    );
    if (!exact) {
      continue;
    }

    // Skip large containers that merely contain the link text among other copy.
    const raw = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (raw.length > 60) {
      continue;
    }

    candidates.push(element);
  }

  if (candidates.length === 0) {
    // Fallback: any text node match via findByTextPatterns.
    const fallback = findByTextPatterns(root, VENDOR_PREFERENCES_PATTERNS, TEXT_SELECTORS, {
      lenient: true,
    });
    return fallback instanceof HTMLElement && !isExternalNavigationLink(fallback)
      ? fallback
      : null;
  }

  candidates.sort((a, b) => {
    const aLen = (a.textContent ?? '').length;
    const bLen = (b.textContent ?? '').length;
    return aLen - bLen;
  });

  return candidates[0] ?? null;
}

function clickVendorPreferences(root: Document | Element | ShadowRoot): boolean {
  const element = findVendorPreferencesLink(root);
  if (!element) {
    return false;
  }

  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  syncScrollFromDom(root);

  // Prefer clicking the element itself; if nested, also try a parent link/button.
  element.click();

  const clickable = element.closest('a, button, [role="button"], [role="link"]');
  if (clickable instanceof HTMLElement && clickable !== element) {
    clickable.click();
  }

  return true;
}

function clickConfirmChoices(root: Document | Element | ShadowRoot): boolean {
  if (clickGfcButton(root, SAVE_CHOICES_PATTERNS)) {
    return true;
  }

  return clickGfcControl(root, SAVE_CHOICES_PATTERNS, GFC_VENDOR_LINK_SELECTORS);
}

/**
 * Dedicated handler for Google Funding Choices / Privacy & Messaging
 * (sites like bosshunting.com.au). Isolated from the generic consent flow.
 *
 * Single top→bottom pass per panel. Never scrolls back to the top.
 * If Vendor preferences is missing at the end, Confirm choices closes the modal.
 */
export async function tryGoogleFundingChoices(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  if (!isGoogleFundingChoicesUi(root)) {
    resetGfcState();
    return { handled: false };
  }

  if (isWelcomeScreen(root, manageOptionsClicked)) {
    if (clickGfcButton(root, MANAGE_OPTIONS_PATTERNS)) {
      manageOptionsClicked = true;
      resetScrollState();
      dataPrefsLiComplete = false;
      vendorPreferencesOpened = false;
      vendorLinkAttempts = 0;
      await wait(400);
      return { handled: true, action: 'gfc-manage-options' };
    }

    return { handled: false };
  }

  if (!isPreferencesView(root, manageOptionsClicked)) {
    return { handled: true, action: 'gfc-waiting-for-panel' };
  }

  const inVendorView = isVendorPreferencesView(root);

  // --- Phase 1: Data preferences — one downward pass, uncheck ON LI toggles ---
  if (isDataPreferencesView(root) && !dataPrefsLiComplete) {
    const remaining = collectOnLegitimateInterestToggles(root, false);
    if (remaining.length > 0) {
      const disabled = await disableNextLegitimateInterestToggle(root, false);
      if (disabled > 0) {
        if (collectOnLegitimateInterestToggles(root, false).length === 0) {
          await scrollToBottom(root);
          dataPrefsLiComplete = true;
        } else {
          return { handled: true, action: 'gfc-li-disabled' };
        }
      } else {
        await advanceScroll(root);
        return { handled: true, action: 'gfc-scanning-li' };
      }
    } else if (!hasReachedBottom()) {
      const scrollDone = await advanceScroll(root);
      if (!scrollDone) {
        return { handled: true, action: 'gfc-scanning-li' };
      }
      dataPrefsLiComplete = true;
    } else {
      dataPrefsLiComplete = true;
    }
  }

  // --- Phase 2: Open Vendor preferences (must happen before Confirm) ---
  if (isDataPreferencesView(root) && dataPrefsLiComplete && !vendorPreferencesOpened) {
    await scrollToBottom(root);
    await wait(200);

    if (clickVendorPreferences(root)) {
      vendorPreferencesOpened = true;
      vendorLinkAttempts = 0;
      resetScrollState();
      await wait(500);
      return { handled: true, action: 'gfc-vendor-preferences' };
    }

    vendorLinkAttempts += 1;

    // Give the bottom of the list a few tries before falling back to Confirm.
    // The Vendor preferences link is often rendered just below the last purpose.
    if (vendorLinkAttempts < 5) {
      await scrollToBottom(root);
      return { handled: true, action: 'gfc-scanning-vendor-link' };
    }

    // No Vendor preferences link after retries — least-exploitative exit.
    if (clickConfirmChoices(root)) {
      resetGfcState();
      return { handled: true, action: 'gfc-confirm-choices' };
    }

    return { handled: true, action: 'gfc-waiting-confirm' };
  }

  // --- Phase 3: Vendor preferences — same single-pass unselect, then Confirm ---
  if (vendorPreferencesOpened || inVendorView) {
    if (!vendorPreferencesOpened) {
      vendorPreferencesOpened = true;
    }

    const remaining = collectOnLegitimateInterestToggles(root, true);
    if (remaining.length > 0) {
      const disabled = await disableNextLegitimateInterestToggle(root, true);
      if (disabled > 0) {
        return { handled: true, action: 'gfc-vendor-li-disabled' };
      }

      await advanceScroll(root);
      return { handled: true, action: 'gfc-scanning-vendor-li' };
    }

    if (!hasReachedBottom()) {
      const scrollDone = await advanceScroll(root);
      if (!scrollDone) {
        return { handled: true, action: 'gfc-scanning-vendor-li' };
      }
    }

    await scrollToBottom(root);

    if (clickConfirmChoices(root)) {
      resetGfcState();
      return { handled: true, action: 'gfc-confirm-choices' };
    }

    return { handled: true, action: 'gfc-waiting-confirm' };
  }

  return { handled: true, action: 'gfc-in-progress' };
}
