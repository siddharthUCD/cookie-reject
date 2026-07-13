import type { HandlerResult } from '@/cmp/types';
import {
  clickElement,
  findByTextPatterns,
  getElementTextVariants,
  isVisible,
  queryAllIncludingShadow,
  wait,
} from '@/utils/dom';
import { SAVE_CHOICES_PATTERNS } from '@/utils/patterns';

const CLICKABLE_SELECTORS =
  'button, a, [role="button"], input[type="button"], input[type="submit"]';
const TEXT_SELECTORS = 'h1,h2,h3,h4,span,div,p,label,button,a,li';

const MANAGE_OPTIONS_PATTERNS = [/^manage options$/i, /^manage preferences$/i];
const VENDOR_PREFERENCES_PATTERNS = [/^vendor preferences$/i, /^vendors preferences$/i];
const DATA_PREFERENCES_PATTERNS = [/^data preferences$/i];
const LEGITIMATE_INTEREST_LABEL = /\blegitimate interest\b/i;
const WELCOME_PATTERNS = [
  /this site asks for consent to use your data/i,
  /asks for consent to use your data/i,
];

const TOGGLE_SELECTORS = [
  '[role="checkbox"]',
  'button[role="switch"]',
  '[role="switch"]',
  'input[type="checkbox"]',
  'button[aria-checked]',
  'button[aria-pressed]',
  '[class*="switch" i]',
  '[class*="toggle" i]',
].join(', ');

let manageOptionsClicked = false;
let vendorPreferencesOpened = false;
let scrollContainer: HTMLElement | null = null;
let scrollAtBottom = false;
const clickedLiToggles = new WeakSet<Element>();

export function isGfcFlowActive(): boolean {
  return manageOptionsClicked || vendorPreferencesOpened;
}

function resetGfcState(): void {
  manageOptionsClicked = false;
  vendorPreferencesOpened = false;
  scrollContainer = null;
  scrollAtBottom = false;
}

function documentHasText(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
): boolean {
  for (const element of queryAllIncludingShadow(root, TEXT_SELECTORS)) {
    if (!isVisible(element, { lenient: true })) {
      continue;
    }

    const texts = getElementTextVariants(element);
    if (texts.some((text) => patterns.some((pattern) => pattern.test(text)))) {
      return true;
    }
  }

  return false;
}

function isGoogleFundingChoicesUi(root: Document | Element | ShadowRoot): boolean {
  if (documentHasText(root, MANAGE_OPTIONS_PATTERNS)) {
    return true;
  }

  if (documentHasText(root, DATA_PREFERENCES_PATTERNS)) {
    return true;
  }

  if (documentHasText(root, VENDOR_PREFERENCES_PATTERNS)) {
    return true;
  }

  return documentHasText(root, WELCOME_PATTERNS);
}

function isDataPreferencesView(root: Document | Element | ShadowRoot): boolean {
  if (documentHasText(root, DATA_PREFERENCES_PATTERNS)) {
    return true;
  }

  return (
    documentHasText(root, [LEGITIMATE_INTEREST_LABEL]) &&
    documentHasText(root, SAVE_CHOICES_PATTERNS) &&
    !documentHasText(root, VENDOR_PREFERENCES_PATTERNS)
  );
}

function isVendorPreferencesView(root: Document | Element | ShadowRoot): boolean {
  return documentHasText(root, VENDOR_PREFERENCES_PATTERNS);
}

function isPreferencesView(root: Document | Element | ShadowRoot): boolean {
  return (
    isDataPreferencesView(root) ||
    isVendorPreferencesView(root) ||
    manageOptionsClicked
  );
}

function isWelcomeScreen(root: Document | Element | ShadowRoot): boolean {
  if (isPreferencesView(root) || manageOptionsClicked) {
    return false;
  }

  return documentHasText(root, MANAGE_OPTIONS_PATTERNS);
}

function clickByText(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
): boolean {
  const element = findByTextPatterns(root, patterns, CLICKABLE_SELECTORS, {
    lenient: true,
  });
  return element ? clickElement(element) : false;
}

function hasVendorPreferencesLink(root: Document | Element | ShadowRoot): boolean {
  return !!findByTextPatterns(root, VENDOR_PREFERENCES_PATTERNS, CLICKABLE_SELECTORS, {
    lenient: true,
  });
}

function isScrollable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const allowsScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
  return allowsScroll && element.scrollHeight > element.clientHeight + 8;
}

function findBestScrollContainer(root: Document | Element | ShadowRoot): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const element of queryAllIncludingShadow(root, 'div, section, main, [role="dialog"]')) {
    if (!(element instanceof HTMLElement) || !isVisible(element, { lenient: true })) {
      continue;
    }

    if (!isScrollable(element)) {
      continue;
    }

    const text = element.textContent ?? '';
    const liCount = (text.match(/legitimate interest/gi) ?? []).length;
    const score = liCount * 1000 + element.scrollHeight;
    if (score > bestScore) {
      bestScore = score;
      best = element;
    }
  }

  return best;
}

async function scrollPreferencesPanel(
  root: Document | Element | ShadowRoot,
): Promise<boolean> {
  if (!scrollContainer || !document.contains(scrollContainer)) {
    scrollContainer = findBestScrollContainer(root);
    scrollAtBottom = false;
  }

  if (!scrollContainer) {
    return false;
  }

  const step = Math.max(scrollContainer.clientHeight * 0.65, 160);
  const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;

  if (scrollContainer.scrollTop < maxScroll - 4) {
    scrollContainer.scrollTop = Math.min(scrollContainer.scrollTop + step, maxScroll);
    await wait(200);
    return false;
  }

  scrollAtBottom = true;
  return true;
}

function isToggleOn(element: Element): boolean {
  if (clickedLiToggles.has(element)) {
    return false;
  }

  if (element instanceof HTMLInputElement) {
    return element.checked;
  }

  const ariaChecked = element.getAttribute('aria-checked');
  if (ariaChecked === 'true') {
    return true;
  }

  if (ariaChecked === 'false') {
    return false;
  }

  if (element.getAttribute('aria-pressed') === 'true') {
    return true;
  }

  if (element.getAttribute('data-state') === 'on') {
    return true;
  }

  const className = element.getAttribute('class') ?? '';
  return /\b(active|checked|enabled|on|selected)\b/i.test(className);
}

function isLegitimateInterestRowText(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return LEGITIMATE_INTEREST_LABEL.test(normalized) && !/^consent\b/i.test(normalized);
}

function findLegitimateInterestLabels(root: Document | Element | ShadowRoot): Element[] {
  const labels: Element[] = [];
  const seen = new Set<Element>();

  for (const element of queryAllIncludingShadow(root, 'span, div, label, p, li, button')) {
    if (!isVisible(element, { lenient: true })) {
      continue;
    }

    const texts = getElementTextVariants(element);
    const isLiLabel = texts.some(
      (text) => LEGITIMATE_INTEREST_LABEL.test(text) && text.length <= 140,
    );

    if (!isLiLabel) {
      continue;
    }

    if (seen.has(element)) {
      continue;
    }

    seen.add(element);
    labels.push(element);
  }

  return labels;
}

function findToggleForLegitimateInterestLabel(label: Element): Element | null {
  let current: Element | null = label;

  for (let depth = 0; depth < 10 && current; depth += 1) {
    const rowText = (current.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!isLegitimateInterestRowText(rowText) || rowText.length > 320) {
      current = current.parentElement;
      continue;
    }

    for (const toggle of current.querySelectorAll(TOGGLE_SELECTORS)) {
      if (clickedLiToggles.has(toggle)) {
        continue;
      }

      const toggleRow = toggle.closest('div, li, tr, section, label') ?? toggle.parentElement;
      const toggleRowText = (toggleRow?.textContent ?? '').replace(/\s+/g, ' ').trim();

      if (!isLegitimateInterestRowText(toggleRowText)) {
        continue;
      }

      if (isToggleOn(toggle)) {
        return toggle;
      }
    }

    current = current.parentElement;
  }

  return null;
}

function findNextLegitimateInterestToggle(
  root: Document | Element | ShadowRoot,
  inVendorView: boolean,
): Element | null {
  if (!inVendorView) {
    for (const label of findLegitimateInterestLabels(root)) {
      const toggle = findToggleForLegitimateInterestLabel(label);
      if (toggle) {
        return toggle;
      }
    }
  }

  for (const toggle of queryAllIncludingShadow(root, TOGGLE_SELECTORS)) {
    if (!isVisible(toggle, { lenient: true }) || clickedLiToggles.has(toggle)) {
      continue;
    }

    const rowText = (
      toggle.closest('div, li, tr, section, article, label') ?? toggle.parentElement
    )?.textContent ?? '';

    if (!inVendorView) {
      if (!isLegitimateInterestRowText(rowText)) {
        continue;
      }
    } else if (/consent/i.test(rowText) && !LEGITIMATE_INTEREST_LABEL.test(rowText)) {
      continue;
    }

    if (isToggleOn(toggle)) {
      return toggle;
    }
  }

  return null;
}

async function disableNextLegitimateInterestToggle(
  root: Document | Element | ShadowRoot,
  inVendorView: boolean,
): Promise<number> {
  let toggle = findNextLegitimateInterestToggle(root, inVendorView);

  if (!toggle) {
    await scrollPreferencesPanel(root);
    toggle = findNextLegitimateInterestToggle(root, inVendorView);
  }

  if (!toggle || !clickElement(toggle)) {
    return 0;
  }

  clickedLiToggles.add(toggle);
  return 1;
}

function hasUncheckedLegitimateInterest(
  root: Document | Element | ShadowRoot,
  inVendorView: boolean,
): boolean {
  return findNextLegitimateInterestToggle(root, inVendorView) !== null;
}

export async function tryGoogleFundingChoices(
  root: Document | Element | ShadowRoot = document,
): Promise<HandlerResult> {
  if (!isGoogleFundingChoicesUi(root)) {
    resetGfcState();
    return { handled: false };
  }

  if (isWelcomeScreen(root)) {
    if (clickByText(root, MANAGE_OPTIONS_PATTERNS)) {
      manageOptionsClicked = true;
      scrollContainer = null;
      scrollAtBottom = false;
      return { handled: true, action: 'gfc-manage-options' };
    }

    return { handled: false };
  }

  if (!isPreferencesView(root)) {
    return { handled: true, action: 'gfc-waiting-for-panel' };
  }

  const inVendorView = isVendorPreferencesView(root);

  if (hasUncheckedLegitimateInterest(root, inVendorView)) {
    const liDisabled = await disableNextLegitimateInterestToggle(root, inVendorView);
    if (liDisabled > 0) {
      return { handled: true, action: 'gfc-li-disabled' };
    }

    await scrollPreferencesPanel(root);
    return { handled: true, action: 'gfc-scanning-li' };
  }

  if (!scrollAtBottom) {
    await scrollPreferencesPanel(root);
    if (hasUncheckedLegitimateInterest(root, inVendorView)) {
      return { handled: true, action: 'gfc-scanning-li' };
    }
  }

  if (isDataPreferencesView(root) && !vendorPreferencesOpened) {
    if (hasVendorPreferencesLink(root) && clickByText(root, VENDOR_PREFERENCES_PATTERNS)) {
      vendorPreferencesOpened = true;
      scrollContainer = null;
      scrollAtBottom = false;
      return { handled: true, action: 'gfc-vendor-preferences' };
    }

    return { handled: true, action: 'gfc-data-prefs-done' };
  }

  if (
    (vendorPreferencesOpened || isVendorPreferencesView(root)) &&
    clickByText(root, SAVE_CHOICES_PATTERNS)
  ) {
    resetGfcState();
    return { handled: true, action: 'gfc-confirm-choices' };
  }

  return { handled: true, action: 'gfc-in-progress' };
}
