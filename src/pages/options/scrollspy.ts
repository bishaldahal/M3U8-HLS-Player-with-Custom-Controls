// Highlights the sidenav link for whichever section is currently in view.
export function setupScrollSpy(): void {
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.sidenav a[href^="#"]')) {
    links.set(link.hash.slice(1), link);
  }

  const sections = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  if (sections.length === 0) return;

  const nav = document.querySelector<HTMLElement>('.sidenav');

  const setCurrent = (id: string) => {
    for (const [linkId, link] of links) {
      const isCurrent = linkId === id;
      link.classList.toggle('current', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    // On narrow screens the nav is a horizontal strip, so keep the active tab visible.
    const link = links.get(id);
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    nav.scrollTo({ left, behavior: 'smooth' });
  };

  const visible = new Set<string>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      // The lowest visible section wins: its heading has just crossed the topbar.
      let last: HTMLElement | undefined;
      for (const section of sections) {
        if (visible.has(section.id)) last = section;
      }
      if (last) setCurrent(last.id);
    },
    // Offsets for the sticky topbar so a section counts as current once it reaches it.
    { rootMargin: '-96px 0px -55% 0px' },
  );
  sections.forEach((section) => observer.observe(section));
  setCurrent(sections[0].id);
}
