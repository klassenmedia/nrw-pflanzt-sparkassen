// Endgültige Adresse, auch wenn der Entwurf woanders (z. B. GitHub Pages) liegt.
export const PRODUCTION_BASE = 'https://www.nrw-pflanzt.de/projekte/sparkassen/';

const PRODUCTION = new URL(PRODUCTION_BASE);

// Wirft statt still eine fremde Adresse zu erzeugen, damit ein manipulierter Slug den Build stoppt.
export function productionUrl(pathname: string, base: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const relative = (pathname.startsWith(normalizedBase) ? pathname.slice(normalizedBase.length) : pathname).replace(/^[/\\]+/, '');
  const url = new URL(relative, PRODUCTION_BASE);
  if (url.origin !== PRODUCTION.origin || !url.pathname.startsWith(PRODUCTION.pathname)) {
    throw new Error(`Ungültiger Pfad für die Zieladresse: ${pathname}`);
  }
  return url.href;
}
