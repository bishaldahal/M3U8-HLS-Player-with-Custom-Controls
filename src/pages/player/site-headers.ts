import { ext } from '../../lib/browser';
import { loadSiteHeaders, upsertSiteHeaders, validateHeaders } from '../../lib/site-headers';
import { createHeaderRow, readHeaderRows } from './drm';

let open = false;

export async function showSiteHeadersDialog(streamHost: string): Promise<void> {
  if (open) return;
  open = true;

  const template = document.getElementById('site-headers-template') as HTMLTemplateElement;
  const overlay = (template.content.firstElementChild as HTMLElement).cloneNode(
    true,
  ) as HTMLElement;
  const $ = <T extends HTMLElement>(sel: string) => overlay.querySelector(sel) as T;
  const rows = $<HTMLElement>('[data-drm-headers]');
  const errorEl = $<HTMLElement>('[data-drm-error]');
  $<HTMLElement>('[data-sh-host]').textContent = streamHost;

  const existing = (await loadSiteHeaders()).find((r) => r.host === streamHost);
  const pairs = Object.entries(existing?.headers ?? { Referer: '' });
  pairs.forEach(([k, v]) => rows.appendChild(createHeaderRow(k, v)));

  $<HTMLButtonElement>('[data-drm-add-header]').addEventListener('click', () =>
    rows.appendChild(createHeaderRow()),
  );
  rows.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches('[data-header-remove]')) return;
    const row = target.parentElement!;
    if (rows.children.length <= 1) row.querySelectorAll('input').forEach((i) => (i.value = ''));
    else row.remove();
  });

  const close = () => {
    overlay.remove();
    open = false;
  };
  $<HTMLButtonElement>('[data-sh-cancel]').addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });

  $<HTMLButtonElement>('[data-sh-save]').addEventListener('click', async () => {
    const headers = readHeaderRows(rows) ?? {};
    const errors = validateHeaders(headers);
    if (errors.length) {
      errorEl.hidden = false;
      errorEl.textContent = errors.join('\n');
      return;
    }
    try {
      await upsertSiteHeaders(streamHost, headers);
      await ext.runtime.sendMessage({ command: 'SYNC_SITE_HEADERS' });
      window.location.reload();
    } catch (error) {
      errorEl.hidden = false;
      errorEl.textContent = (error as Error).message;
    }
  });

  document.body.appendChild(overlay);
  setTimeout(() => rows.querySelector<HTMLInputElement>('[data-header-value]')?.focus(), 0);
}
