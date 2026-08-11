/**
 * Formspree (or compatible) endpoint for in-popup banner reports.
 * Create a form at https://formspree.io, then set this in `.env`:
 *   VITE_BANNER_REPORT_ENDPOINT=https://formspree.io/f/yourFormId
 * Rebuild after changing it so the value is baked into the extension package.
 */
export const BANNER_REPORT_ENDPOINT = (
  (import.meta.env.VITE_BANNER_REPORT_ENDPOINT as string | undefined) ?? ''
).trim();

export function isBannerReportEndpointConfigured(): boolean {
  return /^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+\/?$/i.test(BANNER_REPORT_ENDPOINT);
}
