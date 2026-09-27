// Endgültige Adresse, auch wenn der Entwurf woanders (z. B. GitHub Pages) liegt.
export const PRODUCTION_BASE = 'https://www.nrw-pflanzt.de/projekte/sparkassen/';

export function productionUrl(pathname: string, base: string): string {
  const relative = pathname.startsWith(base) ? pathname.slice(base.length) : pathname.replace(/^\//, '');
  return new URL(relative, PRODUCTION_BASE).href;
}
