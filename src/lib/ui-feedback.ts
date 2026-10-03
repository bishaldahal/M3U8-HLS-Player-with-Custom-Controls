import './ui-feedback.css';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

const TOAST_DURATION_MS = 4500;
const TOAST_ANIMATION_MS = 300;
const MAX_TOASTS = 3;
const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_PATHS: Record<ToastType, string> = {
  success:
    'M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM8 15L3 10L4.41 8.59L8 12.17L15.59 4.58L17 6L8 15Z',
  error:
    'M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z',
  warning: 'M1 17H19L10 2L1 17ZM11 14H9V12H11V14ZM11 10H9V6H11V10Z',
  info: 'M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z',
};

export function createIcon(type: ToastType, size = 20): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICON_PATHS[type]);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

export function createSpinner(size: 'small' | 'medium' | 'large' = 'medium'): HTMLElement {
  const spinner = document.createElement('div');
  spinner.className = `feedback-spinner feedback-spinner-${size}`;
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-label', 'Loading');
  for (let i = 0; i < 4; i++) {
    const bar = document.createElement('div');
    bar.className = 'feedback-spinner-bar';
    spinner.appendChild(bar);
  }
  return spinner;
}

class Toaster {
  private container: HTMLElement | null = null;
  private active = new Set<HTMLElement>();
  private queue: Array<{ message: string; type: ToastType; duration: number }> = [];

  private ensureContainer(): HTMLElement {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'feedback-toast-container';
      this.container.setAttribute('aria-live', 'polite');
      this.container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(message: string, type: ToastType = 'info', duration = TOAST_DURATION_MS): void {
    if (this.active.size >= MAX_TOASTS) {
      this.queue.push({ message, type, duration });
      return;
    }

    const toast = document.createElement('div');
    toast.className = `feedback-toast feedback-toast-${type}`;
    toast.setAttribute('role', 'status');

    const iconEl = document.createElement('span');
    iconEl.className = 'feedback-toast-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.appendChild(createIcon(type));

    const messageEl = document.createElement('span');
    messageEl.className = 'feedback-toast-message';
    messageEl.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'feedback-toast-close';
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.addEventListener('click', () => this.remove(toast));

    toast.append(iconEl, messageEl, closeBtn);
    this.ensureContainer().appendChild(toast);
    this.active.add(toast);

    requestAnimationFrame(() => toast.classList.add('feedback-toast-show'));
    if (duration > 0) setTimeout(() => this.remove(toast), duration);
  }

  private remove(toast: HTMLElement): void {
    if (!this.active.has(toast)) return;
    toast.classList.remove('feedback-toast-show');
    toast.classList.add('feedback-toast-hide');
    setTimeout(() => {
      toast.remove();
      this.active.delete(toast);
      const next = this.queue.shift();
      if (next) this.show(next.message, next.type, next.duration);
    }, TOAST_ANIMATION_MS);
  }
}

const toaster = new Toaster();

export const toast = {
  show: (message: string, type?: ToastType, duration?: number) =>
    toaster.show(message, type, duration),
  success: (message: string) => toaster.show(message, 'success'),
  error: (message: string) => toaster.show(message, 'error'),
  warning: (message: string) => toaster.show(message, 'warning'),
  info: (message: string) => toaster.show(message, 'info'),
};
