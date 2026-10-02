// Firefox exposes the promise-based `browser` namespace; Chromium MV3 `chrome` is promise-based too.
export const ext: typeof chrome =
  (globalThis as unknown as { browser?: typeof chrome }).browser ?? globalThis.chrome;

export function isChromiumBrowser(userAgent = navigator.userAgent): boolean {
  return /(Chrome|Chromium|Edg|OPR|Brave)/i.test(userAgent) && !/Firefox/i.test(userAgent);
}
