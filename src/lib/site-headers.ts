import { getStorage } from './storage';

export interface SiteHeaderRule {
  /** Hostname; also matches its subdomains. */
  host: string;
  headers: Record<string, string>;
  /** Captured from the page a stream was opened from; manual rules are never overwritten. */
  auto: boolean;
  updatedAt: number;
}

export const SITE_HEADERS_KEY = 'siteHeaders';
export const MAX_SITE_HEADER_RULES = 200;
/** Header rules use ids from here up; id 1 is the manifest redirect. */
export const HEADER_RULE_ID_BASE = 1000;

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const host = new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`).hostname;
    return HOSTNAME.test(host) ? host : null;
  } catch {
    return null;
  }
}

export const isValidHeaderName = (name: string) => HEADER_NAME.test(name);
export const isValidHeaderValue = (value: string) => !/[\r\n\0]/.test(value);

export function validateHeaders(headers: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (!isValidHeaderName(name)) errors.push(`Invalid header name: ${name || '(empty)'}`);
    if (!isValidHeaderValue(value)) errors.push(`Invalid value for ${name}`);
  }
  return errors;
}

/** Parses `Name: value` lines; blank lines are skipped. */
export function parseHeaderLines(text: string): {
  headers: Record<string, string>;
  errors: string[];
} {
  const headers: Record<string, string> = {};
  const errors: string[] = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const colon = line.indexOf(':');
    if (colon <= 0) {
      errors.push(`Line ${i + 1}: expected "Name: value"`);
      return;
    }
    headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  });
  return { headers, errors: [...errors, ...validateHeaders(headers)] };
}

export const formatHeaderLines = (headers: Record<string, string>) =>
  Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

function sanitizeRule(raw: unknown): SiteHeaderRule | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const host = typeof r.host === 'string' ? normalizeHost(r.host) : null;
  if (!host || !r.headers || typeof r.headers !== 'object') return null;
  const headers = Object.fromEntries(
    Object.entries(r.headers as Record<string, unknown>).filter(
      ([k, v]) => typeof v === 'string' && isValidHeaderName(k) && isValidHeaderValue(v),
    ),
  ) as Record<string, string>;
  if (!Object.keys(headers).length) return null;
  return {
    host,
    headers,
    auto: r.auto === true,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
}

export async function loadSiteHeaders(): Promise<SiteHeaderRule[]> {
  const raw = (await getStorage().get([SITE_HEADERS_KEY]))[SITE_HEADERS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeRule).filter((r): r is SiteHeaderRule => r !== null);
}

async function writeSiteHeaders(rules: SiteHeaderRule[]): Promise<void> {
  // Keep manual rules first, then the most recently used auto rules.
  const sorted = [...rules].sort(
    (a, b) => Number(a.auto) - Number(b.auto) || b.updatedAt - a.updatedAt,
  );
  await getStorage().set({ [SITE_HEADERS_KEY]: sorted.slice(0, MAX_SITE_HEADER_RULES) });
}

/** Returns false when an auto capture would overwrite a manual rule. */
export async function upsertSiteHeaders(
  hostInput: string,
  headers: Record<string, string>,
  auto = false,
): Promise<boolean> {
  const host = normalizeHost(hostInput);
  if (!host) throw new Error(`Invalid host: ${hostInput}`);
  const errors = validateHeaders(headers);
  if (errors.length) throw new Error(errors.join(', '));

  const rules = await loadSiteHeaders();
  const existing = rules.find((r) => r.host === host);
  if (auto && existing && !existing.auto) return false;

  const others = rules.filter((r) => r.host !== host);
  if (Object.keys(headers).length) {
    others.push({ host, headers, auto, updatedAt: Date.now() });
  }
  await writeSiteHeaders(others);
  return true;
}

export async function removeSiteHeaders(host: string): Promise<void> {
  await writeSiteHeaders((await loadSiteHeaders()).filter((r) => r.host !== host));
}

/** Referer/Origin a browser would send cross-origin from `pageUrl` (origin only, no path). */
export function headersFromPage(pageUrl: string | undefined): Record<string, string> | null {
  if (!pageUrl) return null;
  try {
    const { protocol, origin } = new URL(pageUrl);
    if (protocol !== 'http:' && protocol !== 'https:') return null;
    return { Referer: `${origin}/`, Origin: origin };
  } catch {
    return null;
  }
}

/** DNR rules that add the headers only to requests made by the extension's own pages. */
export function buildHeaderRules(
  rules: Pick<SiteHeaderRule, 'host' | 'headers'>[],
  extensionHost: string,
  idBase = HEADER_RULE_ID_BASE,
  priority = 1,
): chrome.declarativeNetRequest.Rule[] {
  return rules.map((rule, i) => ({
    id: idBase + i,
    priority,
    action: {
      type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: Object.entries(rule.headers).map(([header, value]) => ({
        header,
        operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
        value,
      })),
    },
    condition: {
      requestDomains: [rule.host],
      initiatorDomains: [extensionHost],
      resourceTypes: [
        'xmlhttprequest',
        'media',
        'other',
      ] as chrome.declarativeNetRequest.ResourceType[],
    },
  }));
}
