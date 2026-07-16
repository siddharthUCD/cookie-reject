import { LEGITIMATE_INTEREST_LABEL } from '@/cmp/google-funding-choices/constants';
import { isVisible, queryAllIncludingShadow, wait } from '@/utils/dom';

let scrollContainer: HTMLElement | null = null;
let scrollOffset = 0;
let reachedBottom = false;

export function resetScrollState(): void {
  scrollContainer = null;
  scrollOffset = 0;
  reachedBottom = false;
}

function isScrollable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const allowsScroll =
    overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
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
    const liCount = (text.match(LEGITIMATE_INTEREST_LABEL) ?? []).length;
    const score = liCount * 1000 + element.scrollHeight;
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
  }

  return scrollContainer;
}

/**
 * Keep the tracked offset in sync with the real scroll position.
 * Toggle scrollIntoView can move the panel ahead of scrollOffset; without this
 * the next advance would jump backward and look like scrolling stopped.
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

  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  if (container.scrollTop >= maxScroll - 2) {
    reachedBottom = true;
    scrollOffset = maxScroll + 1;
  }
}

/**
 * Advance one step downward through the preferences panel.
 * Single pass only — never scrolls upward.
 * Returns true when the bottom has been reached.
 */
export async function advanceScroll(root: Document | Element | ShadowRoot): Promise<boolean> {
  if (reachedBottom) {
    return true;
  }

  const container = ensureScrollContainer(root);
  if (!container) {
    reachedBottom = true;
    return true;
  }

  syncScrollFromDom(root);

  const step = Math.max(container.clientHeight * 0.4, 90);
  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  const nextTop = Math.min(Math.max(scrollOffset, container.scrollTop) + step, maxScroll);

  // Never move the panel upward.
  container.scrollTop = Math.max(container.scrollTop, nextTop);
  scrollOffset = container.scrollTop;

  if (container.scrollTop >= maxScroll - 2) {
    reachedBottom = true;
    scrollOffset = maxScroll + 1;
    await wait(200);
    return true;
  }

  await wait(350);
  return false;
}

/** Jump to the end of the preferences panel (never goes back up). */
export async function scrollToBottom(root: Document | Element | ShadowRoot): Promise<void> {
  const container = ensureScrollContainer(root);
  if (!container) {
    reachedBottom = true;
    return;
  }

  const maxScroll = Math.max(container.scrollHeight - container.clientHeight, 0);
  container.scrollTop = Math.max(container.scrollTop, maxScroll);
  scrollOffset = maxScroll + 1;
  reachedBottom = true;
  await wait(350);
}

export function hasReachedBottom(): boolean {
  return reachedBottom;
}
