import type { HandlerResult } from '@/cmp/types';
import {
  GFC_BUTTON_SELECTORS,
  MANAGE_OPTIONS_PATTERNS,
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
  continueScrollingDown,
  resetScrollState,
  scrollToBottom,
} from '@/cmp/google-funding-choices/scroll';
import {
  disableLegitimateInterestToggles,
  hasVisibleLiLabels,
  resetToggleState,
} from '@/cmp/google-funding-choices/toggles';
import {
  findByTextPatterns,
  isVisible,
  queryAllIncludingShadow,
} from '@/utils/dom';
import { SAVE_CHOICES_PATTERNS } from '@/utils/patterns';

const VENDOR_LINK_TEXT = /^vendor\s*preferences?$/i;

let manageOptionsClicked = false;
let vendorPreferencesOpened = false;
let dataPrefsLiComplete = false;
let vendorLinkAttempts = 0;
let vendorPhaseAttempts = 0;
let vendorSawLiToggles = false;
let locationAtFlowStart = '';

export function isGfcFlowActive(): boolean {
  return manageOptionsClicked || vendorPreferencesOpened;
}

function resetGfcState(): void {
  manageOptionsClicked = false;
  vendorPreferencesOpened = false;
  dataPrefsLiComplete = false;
  vendorLinkAttempts = 0;
  vendorPhaseAttempts = 0;
  vendorSawLiToggles = false;
  locationAtFlowStart = '';
  resetScrollState();
  resetToggleState();
}

function beginVendorPhase(): void {
  vendorPreferencesOpened = true;
  vendorLinkAttempts = 0;
  vendorPhaseAttempts = 0;
  vendorSawLiToggles = false;
  resetScrollState();
}

function normalizeRaw(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function locationLeftSite(): boolean {
  const href = window.location.href;
  if (href.startsWith('about:') || href.startsWith('chrome:') || href.startsWith('chrome-error:')) {
    return true;
  }

  if (locationAtFlowStart && href !== locationAtFlowStart) {
    // Path change away from the article is a failed navigation gesture.
    try {
      const start = new URL(locationAtFlowStart);
      const now = new URL(href);
      if (start.origin !== now.origin) {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

function isInsideGfcDialog(element: Element): boolean {
  return !!element.closest(
    [
      '.fc-dialog',
      '.fc-consent-root',
      '[class*="fc-dialog"]',
      '[class*="fc-consent"]',
      '[aria-modal="true"]',
      '[role="dialog"]',
    ].join(', '),
  );
}

function clickGfcControl(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
  selectors: string,
): boolean {
  const element = findByTextPatterns(root, patterns, selectors, {
    lenient: true,
  });

  if (!element || !(element instanceof HTMLElement)) {
    return false;
  }

  // Never activate navigable anchors for any GFC control.
  if (element instanceof HTMLAnchorElement) {
    const href = (element.getAttribute('href') ?? '').trim();
    if (href && href !== '#' && !href.startsWith('#') && !href.toLowerCase().startsWith('javascript:')) {
      return false;
    }
  }

  activateInDialog(element);
  return true;
}

function clickGfcButton(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
): boolean {
  return clickGfcControl(root, patterns, GFC_BUTTON_SELECTORS);
}

function elementLooksLikeVendorLink(element: Element): boolean {
  const raw = normalizeRaw(element.textContent ?? '');
  if (!VENDOR_LINK_TEXT.test(raw) || raw.length > 40) {
    return false;
  }

  if (/legitimate interest|consent\s*\(/i.test(raw)) {
    return false;
  }

  return true;
}

/**
 * Locate the bottom-of-list "Vendor preferences" control inside the FC dialog.
 */
function findVendorPreferencesLink(
  root: Document | Element | ShadowRoot,
): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  const searchRoot: Node =
    root instanceof Document || root instanceof ShadowRoot ? root : root;

  const walker = document.createTreeWalker(searchRoot, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = normalizeRaw(node.textContent ?? '');
    if (VENDOR_LINK_TEXT.test(value)) {
      const parent = node.parentElement;
      if (
        parent instanceof HTMLElement &&
        elementLooksLikeVendorLink(parent) &&
        isInsideGfcDialog(parent)
      ) {
        candidates.push(parent);
      }
    }
    node = walker.nextNode();
  }

  for (const element of queryAllIncludingShadow(
    root,
    'button, [role="button"], [role="link"], span, div, p, li',
  )) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    if (!isVisible(element, { lenient: true })) {
      continue;
    }

    if (!isInsideGfcDialog(element) || !elementLooksLikeVendorLink(element)) {
      continue;
    }

    // Prefer non-anchor nodes; anchors are last resort and clicked with nav blocked.
    candidates.push(element);
  }

  if (candidates.length === 0) {
    return null;
  }

  const unique = [...new Set(candidates)];
  unique.sort((a, b) => {
    const aAnchor = a.closest('a') ? 1 : 0;
    const bAnchor = b.closest('a') ? 1 : 0;
    if (aAnchor !== bAnchor) {
      return aAnchor - bAnchor;
    }

    const aButton = a.closest('button, [role="button"]') ? 0 : 1;
    const bButton = b.closest('button, [role="button"]') ? 0 : 1;
    if (aButton !== bButton) {
      return aButton - bButton;
    }

    return normalizeRaw(a.textContent ?? '').length - normalizeRaw(b.textContent ?? '').length;
  });

  return unique[0] ?? null;
}

function pageMentionsVendorPreferences(root: Document | Element | ShadowRoot): boolean {
  return !!findVendorPreferencesLink(root);
}

/**
 * Fire in-dialog activation while blocking any anchor navigation default
 * (this was sending the tab to about:blank).
 */
function activateInDialog(element: HTMLElement): void {
  element.scrollIntoView({ block: 'center', inline: 'nearest' });

  const blockAnchorNavigation = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest('a');
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    // Always cancel navigation defaults during our synthetic gesture.
    event.preventDefault();
  };

  document.addEventListener('click', blockAnchorNavigation, true);
  document.addEventListener('auxclick', blockAnchorNavigation, true);

  try {
    const button = element.closest('button, [role="button"]');
    const target =
      button instanceof HTMLElement && isInsideGfcDialog(button) ? button : element;

    // Never call HTMLAnchorElement.click() — it follows href even when we
    // try to preventDefault in some browser paths.
    if (target instanceof HTMLAnchorElement) {
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click'] as const) {
        target.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }
    } else {
      for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click'] as const) {
        target.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      }
      target.click();
    }
  } finally {
    document.removeEventListener('click', blockAnchorNavigation, true);
    document.removeEventListener('auxclick', blockAnchorNavigation, true);
  }
}

function openVendorPreferences(root: Document | Element | ShadowRoot): boolean {
  const element = findVendorPreferencesLink(root);
  if (!element) {
    return false;
  }

  const hrefBefore = window.location.href;
  activateInDialog(element);

  if (locationLeftSite() || window.location.href !== hrefBefore) {
    console.warn('[Cookie Reject] Blocked vendor-preferences navigation to', window.location.href);
    return false;
  }

  // Strict success: must be on the Vendor preferences panel, not merely
  // "Data preferences disappeared" (that also happens on about:blank).
  return isVendorPreferencesView(root);
}

function clickConfirmChoices(root: Document | Element | ShadowRoot): boolean {
  if (clickGfcButton(root, SAVE_CHOICES_PATTERNS)) {
    return true;
  }

  // Broader fallback: GFC sometimes puts Confirm on a footer control that is
  // not matched by the primary button selector set alone.
  const confirmSelectors = [
    GFC_BUTTON_SELECTORS,
    '.fc-footer-buttons-wrapper button',
    '.fc-footer button',
    '[class*="fc-cta" i]',
    '[class*="confirm" i]',
    'button',
    '[role="button"]',
  ].join(', ');

  if (clickGfcControl(root, SAVE_CHOICES_PATTERNS, confirmSelectors)) {
    return true;
  }

  // Last resort: walk text nodes for an exact "Confirm choices" label.
  const walker = document.createTreeWalker(
    root instanceof Document || root instanceof ShadowRoot ? root : root,
    NodeFilter.SHOW_TEXT,
  );

  let node = walker.nextNode();
  while (node) {
    const value = normalizeRaw(node.textContent ?? '');
    if (SAVE_CHOICES_PATTERNS.some((pattern) => pattern.test(value))) {
      const parent = node.parentElement;
      if (parent instanceof HTMLElement && isInsideGfcDialog(parent)) {
        const clickable =
          parent.closest('button, [role="button"], .fc-button, a') ?? parent;
        if (clickable instanceof HTMLElement) {
          activateInDialog(clickable);
          return true;
        }
      }
    }
    node = walker.nextNode();
  }

  return false;
}

/**
 * Dedicated handler for Google Funding Choices / Privacy & Messaging
 * (sites like bosshunting.com.au). Isolated from the generic consent flow.
 *
 * After LI toggles are off, keep scrolling until Vendor preferences opens.
 * Confirm choices is never used on Data preferences while that link exists.
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
      locationAtFlowStart = window.location.href;
      resetScrollState();
      dataPrefsLiComplete = false;
      vendorPreferencesOpened = false;
      vendorLinkAttempts = 0;
      return { handled: true, action: 'gfc-manage-options' };
    }

    return { handled: false };
  }

  if (!isPreferencesView(root, manageOptionsClicked)) {
    return { handled: true, action: 'gfc-waiting-for-panel' };
  }

  const inVendorView = isVendorPreferencesView(root);

  // --- Phase 1: Data preferences — snapshot all ON LI toggles, uncheck in one go ---
  if (isDataPreferencesView(root) && !dataPrefsLiComplete) {
    const disabled = disableLegitimateInterestToggles(root, false);
    if (disabled > 0) {
      dataPrefsLiComplete = true;
      continueScrollingDown();
      return { handled: true, action: 'gfc-li-disabled' };
    }

    // Panel may still be mounting — retry on the next scan if LI UI is visible.
    if (hasVisibleLiLabels(root)) {
      return { handled: true, action: 'gfc-scanning-li' };
    }

    dataPrefsLiComplete = true;
    continueScrollingDown();
  }

  // --- Phase 2: Scroll to and open Vendor preferences (never Confirm while link exists) ---
  if (isDataPreferencesView(root) && dataPrefsLiComplete && !vendorPreferencesOpened) {
    if (openVendorPreferences(root)) {
      beginVendorPhase();
      return { handled: true, action: 'gfc-vendor-preferences' };
    }

    vendorLinkAttempts += 1;
    continueScrollingDown();
    const atBottom = advanceScroll(root);
    scrollToBottom(root);

    if (openVendorPreferences(root)) {
      beginVendorPhase();
      return { handled: true, action: 'gfc-vendor-preferences' };
    }

    // Keep hunting whenever the Vendor preferences link/text is present.
    if (pageMentionsVendorPreferences(root) || !atBottom || vendorLinkAttempts < 25) {
      return { handled: true, action: 'gfc-scanning-vendor-link' };
    }

    // Only Confirm on Data preferences when Vendor preferences truly is not offered.
    if (clickConfirmChoices(root)) {
      resetGfcState();
      return { handled: true, action: 'gfc-confirm-choices' };
    }

    return { handled: true, action: 'gfc-waiting-confirm' };
  }

  // --- Phase 3: Vendor preferences — unselect LI, then Confirm ---
  if (vendorPreferencesOpened || inVendorView) {
    // Still on Data preferences means the vendor click did not navigate — recover.
    // Once we have already processed vendor LI, never abandon Confirm for a
    // back-link false positive ("Data preferences" text on the vendor panel).
    if (
      isDataPreferencesView(root) &&
      !inVendorView &&
      !vendorSawLiToggles &&
      vendorPhaseAttempts < 3
    ) {
      vendorPreferencesOpened = false;
      continueScrollingDown();
      return { handled: true, action: 'gfc-scanning-vendor-link' };
    }

    if (!vendorPreferencesOpened) {
      beginVendorPhase();
    }

    vendorPhaseAttempts += 1;

    if (!vendorSawLiToggles) {
      const disabled = disableLegitimateInterestToggles(root, true);
      if (disabled > 0) {
        vendorSawLiToggles = true;
      } else if (vendorPhaseAttempts < 2) {
        // One short remount retry only — then Confirm immediately.
        return { handled: true, action: 'gfc-scanning-vendor-li' };
      } else {
        vendorSawLiToggles = true;
      }
    }

    // Confirm as soon as vendor LI are done — no second full-panel scan.
    if (clickConfirmChoices(root)) {
      resetGfcState();
      return { handled: true, action: 'gfc-confirm-choices' };
    }

    return { handled: true, action: 'gfc-waiting-confirm' };
  }

  return { handled: true, action: 'gfc-in-progress' };
}
