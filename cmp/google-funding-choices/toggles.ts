import {
  FALLBACK_TOGGLE_SELECTOR,
  GFC_LI_LABEL_SELECTORS,
  GFC_LI_TOGGLE_SELECTORS,
  LEGITIMATE_INTEREST_LABEL,
  LI_ROW_PATTERN,
  CONSENT_ROW_PATTERN,
} from '@/cmp/google-funding-choices/constants';
import { advanceScroll, syncScrollFromDom } from '@/cmp/google-funding-choices/scroll';
import { isVisible, queryAllIncludingShadow, wait } from '@/utils/dom';

const clickedLiToggles = new WeakSet<Element>();

export function resetToggleState(): void {
  // WeakSet has no clear(); new page navigations drop old elements naturally.
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function textMatchesLiRow(text: string): boolean {
  const normalized = normalizeText(text);
  return LI_ROW_PATTERN.test(normalized) && normalized.length <= 120;
}

function textMatchesConsentRow(text: string): boolean {
  const normalized = normalizeText(text);
  return CONSENT_ROW_PATTERN.test(normalized) && normalized.length <= 120;
}

function getLabelElementById(
  root: Document | Element | ShadowRoot,
  id: string,
): Element | null {
  if (root instanceof Document) {
    return root.getElementById(id);
  }

  if (root instanceof ShadowRoot) {
    return root.getElementById(id) ?? root.querySelector(`#${CSS.escape(id)}`);
  }

  const inRoot = root.querySelector(`#${CSS.escape(id)}`);
  if (inRoot) {
    return inRoot;
  }

  return document.getElementById(id);
}

function getToggleLabelText(toggle: Element, root: Document | Element | ShadowRoot): string {
  const ariaLabel = normalizeText(toggle.getAttribute('aria-label') ?? '');
  if (textMatchesLiRow(ariaLabel) || textMatchesConsentRow(ariaLabel)) {
    return ariaLabel;
  }

  const labelledBy = toggle.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelText = labelledBy
      .split(/\s+/)
      .map((id) => getLabelElementById(root, id))
      .filter(Boolean)
      .map((element) => normalizeText(element!.textContent ?? ''))
      .join(' ');

    if (labelText) {
      return labelText;
    }
  }

  for (let depth = 0, current: Element | null = toggle; depth < 8 && current; depth += 1) {
    const text = normalizeText(current.textContent ?? '');
    if (text.length > 0 && text.length <= 120) {
      if (
        textMatchesLiRow(text) ||
        textMatchesConsentRow(text) ||
        LEGITIMATE_INTEREST_LABEL.test(text)
      ) {
        return text;
      }
    }

    current = current.parentElement;
  }

  return '';
}

function isConsentOnlyRow(text: string): boolean {
  const normalized = normalizeText(text);
  return textMatchesConsentRow(normalized) && !LEGITIMATE_INTEREST_LABEL.test(normalized);
}

function isLiLabelElement(element: Element): boolean {
  if (
    element.matches(GFC_LI_LABEL_SELECTORS) ||
    element.closest('.fc-legitimate-interest-preference-container')
  ) {
    return LEGITIMATE_INTEREST_LABEL.test(normalizeText(element.textContent ?? ''));
  }

  const text = normalizeText(element.textContent ?? '');
  if (!LI_ROW_PATTERN.test(text)) {
    return false;
  }

  if (textMatchesConsentRow(text) && !LEGITIMATE_INTEREST_LABEL.test(text)) {
    return false;
  }

  for (const child of element.children) {
    const childText = normalizeText(child.textContent ?? '');
    if (LI_ROW_PATTERN.test(childText) && childText.length <= text.length) {
      return false;
    }
  }

  return text.length <= 160;
}

function isGfcLegitimateInterestInput(toggle: Element): boolean {
  if (!(toggle instanceof HTMLInputElement) || toggle.type !== 'checkbox') {
    return false;
  }

  if (toggle.classList.contains('fc-preference-legitimate-interest')) {
    return true;
  }

  return !!toggle.closest('.fc-legitimate-interest-preference-container');
}

function isGfcConsentInput(toggle: Element): boolean {
  if (!(toggle instanceof HTMLInputElement) || toggle.type !== 'checkbox') {
    return false;
  }

  if (toggle.classList.contains('fc-preference-consent')) {
    return true;
  }

  return !!toggle.closest('.fc-consent-preference-container');
}

function isToggleOn(toggle: Element, labelText = ''): boolean {
  if (clickedLiToggles.has(toggle)) {
    return false;
  }

  if (toggle instanceof HTMLInputElement && toggle.type === 'checkbox') {
    return toggle.checked;
  }

  const ariaPressed = toggle.getAttribute('aria-pressed');
  if (ariaPressed === 'true') {
    return true;
  }

  if (ariaPressed === 'false') {
    return false;
  }

  const ariaChecked = toggle.getAttribute('aria-checked');
  if (ariaChecked === 'true') {
    return true;
  }

  if (ariaChecked === 'false') {
    return false;
  }

  if (isGfcConsentInput(toggle) || textMatchesConsentRow(labelText)) {
    return false;
  }

  if (
    isGfcLegitimateInterestInput(toggle) ||
    textMatchesLiRow(labelText) ||
    LEGITIMATE_INTEREST_LABEL.test(labelText)
  ) {
    return true;
  }

  return false;
}

function findToggleNearLabel(
  label: Element,
  root: Document | Element | ShadowRoot = document,
): Element | null {
  const gfcContainer = label.closest('.fc-legitimate-interest-preference-container');
  if (gfcContainer) {
    const gfcInput = gfcContainer.querySelector(
      'input[type="checkbox"].fc-preference-legitimate-interest',
    );
    if (gfcInput) {
      return gfcInput;
    }

    const containerInput = gfcContainer.querySelector('input[type="checkbox"]');
    if (containerInput) {
      return containerInput;
    }
  }

  const labelId = label.id;
  if (labelId) {
    for (const toggle of queryAllIncludingShadow(root, FALLBACK_TOGGLE_SELECTOR)) {
      const labelledBy = toggle.getAttribute('aria-labelledby') ?? '';
      if (labelledBy.split(/\s+/).includes(labelId)) {
        return toggle;
      }
    }
  }

  for (const toggle of queryAllIncludingShadow(root, FALLBACK_TOGGLE_SELECTOR)) {
    const labelText = getToggleLabelText(toggle, root);
    if (!LI_ROW_PATTERN.test(labelText) && !isGfcLegitimateInterestInput(toggle)) {
      continue;
    }

    if (label.contains(toggle) || toggle.contains(label)) {
      return toggle;
    }

    const labelTextContent = normalizeText(label.textContent ?? '');
    if (labelTextContent && labelText.includes(labelTextContent)) {
      const labelRect = label.getBoundingClientRect();
      const toggleRect = toggle.getBoundingClientRect();
      if (Math.abs(toggleRect.top - labelRect.top) <= 24) {
        return toggle;
      }
    }
  }

  let node: Element | null = label;

  for (let depth = 0; depth < 8 && node; depth += 1) {
    const parentRow: Element | null = node.parentElement;
    if (!parentRow) {
      break;
    }

    const rowToggles = [...parentRow.querySelectorAll(FALLBACK_TOGGLE_SELECTOR)].filter(
      (candidate) => !label.contains(candidate) && !isGfcConsentInput(candidate),
    );
    if (rowToggles.length === 1) {
      return rowToggles[0] ?? null;
    }

    if (rowToggles.length > 1) {
      const labelRect = label.getBoundingClientRect();
      let best: Element | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const candidate of rowToggles) {
        const toggleRect = candidate.getBoundingClientRect();
        const distance = Math.abs(toggleRect.top - labelRect.top);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
      }

      return best;
    }

    for (const sibling of parentRow.children) {
      if (sibling === node || sibling.contains(node)) {
        continue;
      }

      if (sibling.matches(FALLBACK_TOGGLE_SELECTOR) && !isGfcConsentInput(sibling)) {
        return sibling;
      }

      const siblingToggle = sibling.querySelector(FALLBACK_TOGGLE_SELECTOR);
      if (siblingToggle && !isGfcConsentInput(siblingToggle)) {
        return siblingToggle;
      }
    }

    node = parentRow;
  }

  return null;
}

function findPurposeCards(root: Document | Element | ShadowRoot): Element[] {
  const candidates: Element[] = [];

  for (const element of queryAllIncludingShadow(root, 'div, section, article, li')) {
    const text = normalizeText(element.textContent ?? '');
    if (!text.includes('View details')) {
      continue;
    }

    if (!/consent\s*\(\s*\d+\s*vendors?\s*\)/i.test(text)) {
      continue;
    }

    if (!LEGITIMATE_INTEREST_LABEL.test(text)) {
      continue;
    }

    if (text.length > 900) {
      continue;
    }

    candidates.push(element);
  }

  return candidates.filter(
    (card) => !candidates.some((other) => other !== card && card.contains(other)),
  );
}

function findLiToggleInCard(card: Element, root: Document | Element | ShadowRoot): Element | null {
  for (const input of card.querySelectorAll(
    'input[type="checkbox"].fc-preference-legitimate-interest',
  )) {
    if (isToggleOn(input)) {
      return input;
    }
  }

  for (const label of card.querySelectorAll('span, div, p, label, li')) {
    if (!isLiLabelElement(label)) {
      continue;
    }

    const toggle = findToggleNearLabel(label, root);
    if (toggle) {
      return toggle;
    }
  }

  const toggles = [...card.querySelectorAll(FALLBACK_TOGGLE_SELECTOR)].filter(
    (toggle) => !isGfcConsentInput(toggle),
  );
  if (toggles.length >= 2) {
    return toggles[toggles.length - 1] ?? null;
  }

  return null;
}

function collectGfcLegitimateInterestInputs(
  root: Document | Element | ShadowRoot,
): Element[] {
  const toggles: Element[] = [];
  const seen = new Set<Element>();

  for (const selector of GFC_LI_TOGGLE_SELECTORS) {
    for (const toggle of queryAllIncludingShadow(root, selector)) {
      if (seen.has(toggle) || clickedLiToggles.has(toggle)) {
        continue;
      }

      if (!isToggleOn(toggle)) {
        continue;
      }

      seen.add(toggle);
      toggles.push(toggle);
    }
  }

  return toggles;
}

export function collectOnLegitimateInterestToggles(
  root: Document | Element | ShadowRoot,
  inVendorView: boolean,
): Element[] {
  const toggles: Element[] = [];
  const seen = new Set<Element>();

  const addToggle = (toggle: Element | null): void => {
    if (!toggle || seen.has(toggle) || clickedLiToggles.has(toggle)) {
      return;
    }

    if (isGfcConsentInput(toggle)) {
      return;
    }

    const labelText = getToggleLabelText(toggle, root);
    const rowText =
      labelText ||
      normalizeText(
        (toggle.closest('div, li, tr, section, label') ?? toggle.parentElement)?.textContent ??
          '',
      );

    if (inVendorView) {
      if (isConsentOnlyRow(rowText) || textMatchesConsentRow(rowText)) {
        return;
      }
    } else if (
      !isGfcLegitimateInterestInput(toggle) &&
      !LEGITIMATE_INTEREST_LABEL.test(rowText) &&
      !LI_ROW_PATTERN.test(rowText)
    ) {
      return;
    }

    if (!isToggleOn(toggle, rowText)) {
      return;
    }

    seen.add(toggle);
    toggles.push(toggle);
  };

  for (const toggle of collectGfcLegitimateInterestInputs(root)) {
    addToggle(toggle);
  }

  if (!inVendorView) {
    for (const card of findPurposeCards(root)) {
      addToggle(findLiToggleInCard(card, root));
    }

    for (const label of queryAllIncludingShadow(root, 'span, div, label, p, li')) {
      if (!isLiLabelElement(label)) {
        continue;
      }

      addToggle(findToggleNearLabel(label, root));
    }
  }

  for (const toggle of queryAllIncludingShadow(root, FALLBACK_TOGGLE_SELECTOR)) {
    addToggle(toggle);
  }

  return toggles;
}

function dispatchPointerClick(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const x = rect.width > 0 ? rect.left + rect.width / 2 : 0;
  const y = rect.height > 0 ? rect.top + rect.height / 2 : 0;

  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup', 'click'] as const) {
    element.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        view: window,
      }),
    );
  }

  element.click();
}

function forceUncheckInput(input: HTMLInputElement): void {
  if (!input.checked) {
    return;
  }

  input.checked = false;
  input.removeAttribute('checked');
  input.setAttribute('aria-pressed', 'false');
  input.setAttribute('aria-checked', 'false');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function getGfcToggleClickTarget(toggle: HTMLElement): HTMLElement {
  const sliderEl = toggle.parentElement?.querySelector('.fc-slider-el');
  if (sliderEl instanceof HTMLElement) {
    return sliderEl;
  }

  const slider = toggle.closest('.fc-preference-slider');
  if (slider instanceof HTMLElement) {
    return slider;
  }

  const label =
    (toggle.id
      ? toggle.ownerDocument.querySelector(`label[for="${CSS.escape(toggle.id)}"]`)
      : null) ??
    toggle.closest(
      'label.fc-legitimate-interest-preference-container, label.fc-preference-slider-container, label',
    );

  if (label instanceof HTMLElement) {
    return label;
  }

  return toggle;
}

function clickGfcToggle(toggle: Element): boolean {
  if (!(toggle instanceof HTMLElement)) {
    return false;
  }

  const clickTarget = getGfcToggleClickTarget(toggle);
  clickTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  syncScrollFromDom();

  // Click the visible slider/label once. Clicking both label and input
  // toggles twice and leaves the control ON.
  dispatchPointerClick(clickTarget);

  if (toggle instanceof HTMLInputElement && toggle.checked) {
    forceUncheckInput(toggle);
  }

  if (!(toggle instanceof HTMLInputElement)) {
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('aria-checked', 'false');
  }

  syncScrollFromDom();
  return true;
}

export function hasVisibleLiLabels(root: Document | Element | ShadowRoot): boolean {
  if (collectGfcLegitimateInterestInputs(root).length > 0) {
    return true;
  }

  for (const label of queryAllIncludingShadow(root, 'span, div, label, p, li')) {
    if (!isVisible(label, { lenient: true })) {
      continue;
    }

    if (isLiLabelElement(label)) {
      return true;
    }
  }

  return false;
}

/** Scroll to and uncheck the next ON legitimate-interest toggle. */
export async function disableNextLegitimateInterestToggle(
  root: Document | Element | ShadowRoot,
  inVendorView: boolean,
): Promise<number> {
  let toggles = collectOnLegitimateInterestToggles(root, inVendorView);

  if (toggles.length === 0) {
    await advanceScroll(root);
    toggles = collectOnLegitimateInterestToggles(root, inVendorView);
  }

  const toggle = toggles[0];
  if (!toggle || !clickGfcToggle(toggle)) {
    return 0;
  }

  syncScrollFromDom(root);
  await wait(250);

  if (toggle instanceof HTMLInputElement && toggle.checked) {
    forceUncheckInput(toggle);
    await wait(100);
  }

  const labelText = getToggleLabelText(toggle, root);
  if (isToggleOn(toggle, labelText)) {
    clickedLiToggles.add(toggle);
    return 0;
  }

  clickedLiToggles.add(toggle);
  return 1;
}
