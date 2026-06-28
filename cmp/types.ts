export interface HandlerResult {
  handled: boolean;
  action?: string;
}

export type CmpHandler = (
  root: Document | Element | ShadowRoot,
) => Promise<HandlerResult> | HandlerResult;
