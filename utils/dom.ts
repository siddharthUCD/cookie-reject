export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getElementTextVariants(element: Element): string[] {
  const variants = [
    element.getAttribute('aria-label'),
    element.getAttribute('title'),
    element.getAttribute('value'),
    element.getAttribute('data-label'),
    element.getAttribute('data-testid'),
    element.textContent,
  ];

  return [...new Set(variants.filter(Boolean).map((value) => normalizeText(value!)))];
}

export function getElementText(element: Element): string {
  const variants = getElementTextVariants(element);
  return variants[0] ?? '';
}

export function elementMatchesPatterns(
  element: Element,
  patterns: RegExp[],
  options: { exclude?: RegExp[] } = {},
): boolean {
  const texts = getElementTextVariants(element);

  return texts.some((text) => {
    if (options.exclude?.some((pattern) => pattern.test(text))) {
      return false;
    }

    return patterns.some((pattern) => pattern.test(text));
  });
}

export function isInConsentUi(element: Element): boolean {
  return !!element.closest(
    [
      '#onetrust-banner-sdk',
      '#onetrust-consent-sdk',
      '#onetrust-pc-sdk',
      '[id*="cookie" i]',
      '[class*="cookie-banner" i]',
      '[class*="consent-banner" i]',
      '[class*="cookie-notice" i]',
      '[aria-modal="true"]',
    ].join(', '),
  );
}

export function isVisible(element: Element, options: { lenient?: boolean } = {}): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  if (options.lenient || isInConsentUi(element)) {
    return true;
  }

  if (Number.parseFloat(style.opacity) === 0) {
    return false;
  }

  return true;
}

export function findClickTarget(element: Element): HTMLElement | null {
  if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) {
    return element;
  }

  if (element instanceof HTMLInputElement) {
    return element;
  }

  if (element.getAttribute('role') === 'button') {
    return element as HTMLElement;
  }

  const closest = element.closest(
    'button, a, [role="button"], [tabindex="0"], label, [onclick]',
  );

  return (closest as HTMLElement | null) ?? (element as HTMLElement);
}

export function clickElement(element: Element): boolean {
  const target = findClickTarget(element);

  if (!target || !isVisible(target, { lenient: isInConsentUi(target) })) {
    return false;
  }

  target.scrollIntoView({ block: 'center', inline: 'center' });

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
  return true;
}

export function queryAllIncludingShadow(
  root: Document | Element | ShadowRoot,
  selector: string,
): Element[] {
  const results: Element[] = [];

  const collect = (node: Document | Element | ShadowRoot) => {
    if (node instanceof Document || node instanceof ShadowRoot) {
      results.push(...node.querySelectorAll(selector));
      node.querySelectorAll('*').forEach((child) => {
        if (child.shadowRoot) {
          collect(child.shadowRoot);
        }
      });
      return;
    }

    if (node.matches(selector)) {
      results.push(node);
    }

    results.push(...node.querySelectorAll(selector));
    node.querySelectorAll('*').forEach((child) => {
      if (child.shadowRoot) {
        collect(child.shadowRoot);
      }
    });
  };

  collect(root);
  return results;
}

export function findFirstVisible(
  root: Document | Element | ShadowRoot,
  selectors: string[],
  options: { lenient?: boolean } = {},
): Element | null {
  for (const selector of selectors) {
    for (const element of queryAllIncludingShadow(root, selector)) {
      if (isVisible(element, options)) {
        return element;
      }
    }
  }

  return null;
}

export function findByTextPatterns(
  root: Document | Element | ShadowRoot,
  patterns: RegExp[],
  selectors = [
    'button',
    'a',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    '[class*="decline" i]',
    '[id*="decline" i]',
    '[data-action*="decline" i]',
    '[data-testid*="decline" i]',
    '[aria-label*="decline" i]',
    '[class*="reject" i]',
    '[id*="reject" i]',
    '[data-action*="reject" i]',
    '[data-testid*="reject" i]',
    '[aria-label*="reject" i]',
  ].join(', '),
  options: { exclude?: RegExp[]; lenient?: boolean } = {},
): Element | null {
  for (const element of queryAllIncludingShadow(root, selectors)) {
    const visible = isVisible(element, {
      lenient: options.lenient || isInConsentUi(element),
    });

    if (!visible) {
      continue;
    }

    if (elementMatchesPatterns(element, patterns, options)) {
      return element;
    }
  }

  return null;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
