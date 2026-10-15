// Fotos für das Laufband zwischen „Was uns verbindet“ und dem Zähler (Andreas, 15.10.2026).
// Die Dateien liegen in src/assets/galerie/ und stehen NICHT im öffentlichen Repo (Kinderfotos).
// Nur Dateien aus dieser Liste erscheinen, in dieser Reihenfolge; fehlt eine, fällt sie weg.
export interface GalerieEintrag {
  datei: string;
  // Sparkasse im Bild: Sparkassen- und Kinderfotos wechseln sich ab (RSGV-Rückmeldung 15.10.2026).
  sparkasse: boolean;
  alt: string;
}

export const GALERIE: readonly GalerieEintrag[] = [
  { datei: '2026-07-06-partnerschaft.webp', sparkasse: true, alt: 'Start der Partnerschaft: 50.000 Bäume fürs Rheinland' },
  { datei: '2026-03-26-pflanzen-reihe.webp', sparkasse: false, alt: 'Kinder pflanzen in einer langen Reihe junge Bäume' },
  { datei: '2026-09-15-xanten.webp', sparkasse: true, alt: 'Scheckübergabe mit der Sparkasse am Niederrhein in Xanten' },
  { datei: 'schulaktionstag-klasse.webp', sparkasse: false, alt: 'Schulaktionstag: ROBIN GUT erzählt einer Schulklasse vom Wald' },
  { datei: '2026-09-16-krefeld.webp', sparkasse: true, alt: 'Scheckübergabe mit der Sparkasse Krefeld' },
  { datei: '2026-06-22-pflanzen.webp', sparkasse: false, alt: 'Ein Mädchen drückt die Erde um einen frisch gepflanzten Baum fest' },
  { datei: '2026-10-13-bergneustadt-sparkasse.webp', sparkasse: true, alt: 'Scheckübergabe mit der Sparkasse Gummersbach in der Turnhalle' },
  { datei: '2026-06-18-lohmar.webp', sparkasse: false, alt: 'Schulaktionstag in Lohmar: die ganze Schule winkt von der Bühne' },
  { datei: '2026-07-06-moenchengladbach.webp', sparkasse: true, alt: 'Schulaktionstag in Mönchengladbach: Kinder zeigen ihre Plakate' },
  { datei: '2026-03-26-pflanzen.webp', sparkasse: false, alt: 'Kinder setzen mit einer Betreuerin einen jungen Baum' },
  { datei: '2026-09-15-xanten-buehne.webp', sparkasse: true, alt: 'Schulaktionstag in Xanten: Sparkasse am Niederrhein und ROBIN GUT mit dem Scheck auf der Bühne' },
  { datei: 'schulaktionstag-kreis.webp', sparkasse: false, alt: 'Kinder sitzen im Kreis und hören zu' },
  { datei: '2026-09-16-krefeld-aula.webp', sparkasse: true, alt: 'Schulaktionstag in Krefeld: volle Aula mit der Sparkasse Krefeld' },
  { datei: '2026-10-13-robin.webp', sparkasse: false, alt: 'Buchstaben ROBIN an der Wäscheleine in der Turnhalle' },
  { datei: '2026-04-15-gruppenbild.webp', sparkasse: true, alt: 'Gruppenbild mit Schülerinnen, Schülern und Gästen in der Aula' },
  { datei: '2026-10-13-bergneustadt-halle.webp', sparkasse: false, alt: 'Schulaktionstag in Bergneustadt: Kinder in der Turnhalle' },
  { datei: '2026-10-13-bergneustadt-scheck.webp', sparkasse: true, alt: 'Scheckübergabe mit der Sparkasse Gummersbach und zwei Schülerinnen' },
  { datei: '2026-10-13-bergneustadt-gruppe.webp', sparkasse: false, alt: 'ROBIN GUT zeigt drei Schülerinnen Luftbilder der Pflanzfläche' },
];

// Vite gibt jede Datei im Ordner aus, auch ungelistete; darum bricht der Build bei fremden Dateien ab.
export function fremdeDateien(pfade: readonly string[], liste: readonly GalerieEintrag[] = GALERIE): string[] {
  const erlaubt = new Set(liste.map((e) => e.datei));
  return pfade.map((p) => p.split('/').pop() ?? p).filter((name) => !erlaubt.has(name));
}

export function galerieBilder<T>(vorhanden: Record<string, T>, liste: readonly GalerieEintrag[] = GALERIE): { bild: T; alt: string }[] {
  const nachName = new Map(Object.entries(vorhanden).map(([pfad, bild]) => [pfad.split('/').pop() ?? pfad, bild]));
  return liste.flatMap((e) => {
    if (!e.alt.trim()) throw new Error(`Galerie: Alternativtext für ${e.datei} fehlt.`);
    const bild = nachName.get(e.datei);
    return bild === undefined ? [] : [{ bild, alt: e.alt }];
  });
}
