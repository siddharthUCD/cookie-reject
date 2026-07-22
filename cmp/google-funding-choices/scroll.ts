import { LEGITIMATE_INTEREST_LABEL } from '@/cmp/google-funding-choices/constants';
import { isVisible, queryAllIncludingShadow } from '@/utils/dom';

let scrollContainer: HTMLElement | null = null;
let scrollOffset = 0;
let reachedBottom = false;
let lastSeenScrollHeight = 0;
let stableBottomHits = 0;

export function resetScrollState(): void {
  scrollContainer = null;
  scrollOffset = 0;
  reachedBottom = false;
  lastSeenScrollHeight = 0;
  stableBottomHits = 0;
}

/** Allow further downward scrolling after LI toggles (Vendor prefs may sit below). */
export function continueScrollingDown(): void {
  reachedBottom = false;
  stableBottomHits = 0;
}

function isScrollable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const allowsScroll =
    overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
  return allowsScroll && element.scrollHeight > element.clientHeight + 8;
}

/**
 * Prefer the innermost scrollable panel that contains legitimate-interest
 * controls. Outer dialogs often also report as scrollable but setting their
 * scrollTop does not move the purpose list.
 */
function findBestScrollContainer(root: Document | Element | ShadowRoot): HTMLElement | null {
  const candidates: HTMLElement[] = [];

  for (const element of queryAllIncludingShadow(root, 'div, section, main, [role="dialog"]')) {
    if (!(element instanceof HTMLElement) || !isVisible(element, { lenient: true })) {
      continue;
    }

    if (!isScrollable(element)) {
      continue;
    }

    const text = element.textContent ?? '';
    const liCount = (text.match(LEGITIMATE_INTEREST_LABEL) ?? []).length;
    if (liCount === 0) {
      continue;
    }

    candidates.push(element);
  }

  if (candidates.length === 0) {
    return null;
  }

  // Innermost first: a container that is not an ancestor of another candidate.
  const inner = candidates.filter(
    (candidate) => !candidates.some((other) => other !== candidate && candidate.contains(other)),
  );

  let best: HTMLElement | null = null;
  let bestScore = -1;

  for (const element of inner.length > 0 ? inner : candidates) {
    const text = element.textContent ?? '';
    const liCount = (text.match(LEGITIMATE_INTEREST_LABEL) ?? []).length;
    const hasSliders = element.querySelectorAll(
      '.fc-preference-slider, .fc-preference-legitimate-interest, input[type="checkbox"]',
    ).length;
    // Prefer more LI content and interactive sliders; smaller clientHeight wins ties
    // (more specific panel).
    const score = liCount * 10_000 + hasSliders * 100 - element.clientHeight;
    if (score > bestScore) {
      bestScore = score;
      best = element;
    }
  }

  return best;
}

function ensureScrollContainer(root: Document | Element | ShadowRoot): HTMLElement | null {
  if (!scrollContainer || !document.contains(scrollContainer)) {
    scrollContainer = findBestScrollContainer(root);
    scrollOffset = 0;
    reachedBottom = false;
    lastSeenScrollHeight = 0;
    stableBottomHits = 0;
  }

  return scrollContainer;
}

/**
 * Keep the tracked offset in sync with the real scroll position.
 * Never mark bottom solely from toggle scrollIntoView — content below the last
 * LI toggle (Vendor preferences) must still be reachable.
 */
export function syncScrollFromDom(root?: Document | Element | ShadowRoot): void {
  const container =
    scrollContainer && document.contains(scrollContainer)
      ? scrollContainer
      : root
        ? ensureScrollContainer(root)
        : null;

  if (!container) {
    return;
  }

  scrollOffset = Math.max(scrollOffset, container.scrollTop);
}

/**
 * Advance one step downward through the preferences panel.
 * Single pass only — never scrolls upward.
 * Returns true when the bottom has been reached and scrollHeight is stable.
 */
export function advanceScroll(root: Document | Element | ShadowRoot): boolean {
  if (reachedBottom) {
    return true;
  }

  const container = ensureScrollContainer(root);
  if (!container) {
    return false;
  }

  syncScrollFromDom(root);

  const step = Math.max(container.clientHeight * 0.55, 120);
  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  const nextTop = Math.min(Math.max(scrollOffset, container.scrollTop) + step, maxScroll);

  container.scrollTop = Math.max(container.scrollTop, nextTop);
  scrollOffset = container.scrollTop;

  // Lazy/virtualized lists grow as you scroll — only finish when height stabilizes.
  if (container.scrollTop >= maxScroll - 2) {
    if (container.scrollHeight <= lastSeenScrollHeight + 2) {
      stableBottomHits += 1;
    } else {
      stableBottomHits = 0;
      lastSeenScrollHeight = container.scrollHeight;
      container.scrollTop = container.scrollHeight;
      scrollOffset = container.scrollTop;
      return false;
    }

    if (stableBottomHits >= 2) {
      reachedBottom = true;
      scrollOffset = maxScroll + 1;
      return true;
    }

    lastSeenScrollHeight = container.scrollHeight;
    return false;
  }

  lastSeenScrollHeight = Math.max(lastSeenScrollHeight, container.scrollHeight);
  return false;
}

/** Jump to the end; may need repeat calls if content loads lazily. */
export function scrollToBottom(root: Document | Element | ShadowRoot): void {
  const container = ensureScrollContainer(root);
  if (!container) {
    return;
  }

  const previousHeight = container.scrollHeight;
  container.scrollTop = Math.max(container.scrollTop, container.scrollHeight);
  scrollOffset = container.scrollTop;

  // If more content appeared, stay marked as not-finished.
  if (container.scrollHeight > previousHeight + 8) {
    reachedBottom = false;
    stableBottomHits = 0;
    lastSeenScrollHeight = container.scrollHeight;
    container.scrollTop = container.scrollHeight;
    scrollOffset = container.scrollTop;
    return;
  }

  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  if (container.scrollTop >= maxScroll - 2) {
    stableBottomHits += 1;
    if (stableBottomHits >= 2) {
      reachedBottom = true;
      scrollOffset = maxScroll + 1;
    }
  }
}

export function hasReachedBottom(): boolean {
  return reachedBottom;
}

export function getScrollContainer(root: Document | Element | ShadowRoot): HTMLElement | null {
  return ensureScrollContainer(root);
}
