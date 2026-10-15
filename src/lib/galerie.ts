// Fotos für das Laufband zwischen „Was uns verbindet“ und dem Zähler (Andreas, 15.10.2026).
// Die Dateien liegen in src/assets/galerie/ und stehen NICHT im öffentlichen Repo (Kinderfotos).
// Nur Dateien aus dieser Liste erscheinen, in dieser Reihenfolge; fehlt eine, fällt sie weg.
export interface GalerieEintrag {
  datei: string;
  alt: string;
}

export const GALERIE: readonly GalerieEintrag[] = [
  { datei: 'schulaktionstag-klasse.webp', alt: 'Schulaktionstag: ROBIN GUT erzählt einer Schulklasse vom Wald' },
  { datei: '2026-03-26-pflanzen-reihe.webp', alt: 'Kinder pflanzen in einer langen Reihe junge Bäume' },
  { datei: '2026-04-15-gruppenbild.webp', alt: 'Gruppenbild mit Schülerinnen, Schülern und Gästen in der Aula' },
  { datei: '2026-03-26-pflanzen.webp', alt: 'Kinder setzen mit einer Betreuerin einen jungen Baum' },
  { datei: '2026-06-18-lohmar.webp', alt: 'Schulaktionstag in Lohmar: die ganze Schule winkt von der Bühne' },
  { datei: '2026-06-22-pflanzen.webp', alt: 'Ein Mädchen drückt die Erde um einen frisch gepflanzten Baum fest' },
  { datei: '2026-07-06-partnerschaft.webp', alt: 'Start der Partnerschaft: 50.000 Bäume fürs Rheinland' },
  { datei: '2026-07-06-moenchengladbach.webp', alt: 'Schulaktionstag in Mönchengladbach: Kinder zeigen ihre Plakate' },
  { datei: 'schulaktionstag-kreis.webp', alt: 'Kinder sitzen im Kreis und hören zu' },
  { datei: '2026-09-15-xanten.webp', alt: 'Scheckübergabe mit der Sparkasse am Niederrhein in Xanten' },
  { datei: '2026-09-16-krefeld-aula.webp', alt: 'Schulaktionstag in Krefeld: volle Aula mit der Sparkasse Krefeld' },
  { datei: '2026-09-16-krefeld.webp', alt: 'Scheckübergabe mit der Sparkasse Krefeld' },
  { datei: '2026-10-13-bergneustadt-halle.webp', alt: 'Schulaktionstag in Bergneustadt: Kinder in der Turnhalle' },
  { datei: '2026-10-13-robin.webp', alt: 'Buchstaben ROBIN an der Wäscheleine in der Turnhalle' },
  { datei: '2026-10-13-bergneustadt-gruppe.webp', alt: 'ROBIN GUT zeigt drei Schülerinnen Luftbilder der Pflanzfläche' },
  { datei: '2026-10-13-bergneustadt-scheck.webp', alt: 'Scheckübergabe mit der Sparkasse Gummersbach und zwei Schülerinnen' },
];

export function galerieBilder<T>(vorhanden: Record<string, T>, liste: readonly GalerieEintrag[] = GALERIE): { bild: T; alt: string }[] {
  const nachName = new Map(Object.entries(vorhanden).map(([pfad, bild]) => [pfad.split('/').pop() ?? pfad, bild]));
  return liste.flatMap((e) => {
    if (!e.alt.trim()) throw new Error(`Galerie: Alternativtext für ${e.datei} fehlt.`);
    const bild = nachName.get(e.datei);
    return bild === undefined ? [] : [{ bild, alt: e.alt }];
  });
}
