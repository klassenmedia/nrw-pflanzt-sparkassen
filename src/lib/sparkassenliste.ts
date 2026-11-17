import { normalisiert } from './kennzahlen.ts';

// Die 27 Sparkassen im Rheinland (Liste des Rheinischen Sparkassen- und Giroverbands, April 2026).
// Reihenfolge = alphabetisch nach Ort = Nummer auf der Seite (Protokoll vom 11.11.2026).
// Nur Namen stehen hier; Ansprechpartner und Baumziele aus der Verbandsliste gehören nicht ins öffentliche Repo.
export interface SparkasseRheinland {
  name: string;
  // Schreibweisen aus Guidos Tabelle, kleingeschrieben.
  aliase: readonly string[];
}

const eine = (name: string, ...aliase: string[]): SparkasseRheinland => ({ name, aliase: [normalisiert(name), ...aliase] });

export const SPARKASSEN_RHEINLAND: readonly SparkasseRheinland[] = [
  eine('Sparkasse Aachen', 'aachen'),
  eine('Sparkasse Duisburg', 'duisburg'),
  eine('Sparkasse Düren', 'düren'),
  eine('Kreissparkasse Düsseldorf', 'düsseldorf, kreissparkasse', 'ksk düsseldorf'),
  eine('Stadtsparkasse Düsseldorf', 'düsseldorf', 'sparkasse düsseldorf', 'düsseldorf, stadtsparkasse', 'ssk düsseldorf'),
  eine('Sparkasse Essen', 'essen'),
  eine('Kreissparkasse Euskirchen', 'euskirchen, kreissparkasse', 'ksk euskirchen'),
  eine('Sparkasse Gummersbach', 'gummersbach'),
  eine('Stadt-Sparkasse Haan', 'sparkasse haan', 'haan'),
  eine('Kreissparkasse Heinsberg', 'heinsberg, kreissparkasse', 'ksk heinsberg'),
  eine('Sparkasse Hilden-Ratingen-Velbert', 'hilden-ratingen-velbert'),
  eine('Kreissparkasse Köln', 'köln, kreissparkasse', 'ksk köln'),
  eine('Sparkasse KölnBonn', 'kölnbonn'),
  eine('Sparkasse Krefeld', 'krefeld'),
  eine('Stadt-Sparkasse Langenfeld', 'sparkasse langenfeld', 'langenfeld'),
  eine('Sparkasse Leverkusen', 'leverkusen'),
  eine('Stadtsparkasse Mönchengladbach', 'sparkasse mönchengladbach', 'mönchengladbach'),
  eine('Sparkasse Mülheim an der Ruhr', 'mülheim an der ruhr', 'mülheim'),
  eine('Sparkasse Neuss', 'neuss'),
  eine('Sparkasse am Niederrhein', 'am niederrhein'),
  eine('Stadtsparkasse Oberhausen', 'sparkasse oberhausen', 'oberhausen'),
  eine('Stadtsparkasse Remscheid', 'sparkasse remscheid', 'remscheid'),
  eine('Niederrheinische Sparkasse RheinLippe', 'rheinlippe', 'nispa', 'niederrheinische sparkasse rheinlippe (nispa)'),
  eine('Sparkasse Rhein-Maas', 'rhein-maas'),
  eine('Stadt-Sparkasse Solingen', 'stadtsparkasse solingen', 'sparkasse solingen', 'solingen'),
  eine('Stadtsparkasse Wermelskirchen', 'sparkasse wermelskirchen', 'wermelskirchen'),
  eine('Stadtsparkasse Wuppertal', 'sparkasse wuppertal', 'wuppertal'),
];

const NACH_ALIAS = new Map<string, SparkasseRheinland>();
for (const s of SPARKASSEN_RHEINLAND) {
  for (const alias of s.aliase) {
    // Doppelter Alias hieße: eine Zeile käme still bei der falschen Sparkasse an.
    if (NACH_ALIAS.has(alias)) throw new Error(`Alias „${alias}“ gehört zu zwei Sparkassen.`);
    NACH_ALIAS.set(alias, s);
  }
}

export function sparkasseNachName(roh: string): SparkasseRheinland | undefined {
  return NACH_ALIAS.get(normalisiert(roh));
}

// Kurzformen, hinter denen eine Annahme steckt; der Import meldet sie, damit jemand hinsieht.
const ANNAHMEN: ReadonlyMap<string, string> = new Map([
  ['düsseldorf', 'Stadtsparkasse Düsseldorf'],
  ['sparkasse düsseldorf', 'Stadtsparkasse Düsseldorf'],
]);

export function sparkasseHinweis(roh: string): string | undefined {
  const ziel = ANNAHMEN.get(normalisiert(roh));
  return ziel ? `„${normalisiert(roh)}“ wird als ${ziel} gelesen (bei Kreissparkasse Düsseldorf bitte so ausschreiben)` : undefined;
}

export interface Kachel<T> {
  nr: number;
  sparkasse: string;
  // Fehlt bei Sparkassen, die noch in keiner Zeile der Tabelle stehen.
  eintrag?: T;
}

// Sortiert nach Sparkasse (Reihenfolge der Liste), dann nach Ort. Eine Nummer je Sparkasse.
export function gruppiereKacheln<T extends { sparkasse: string; kommune: string }>(eintraege: readonly T[]): Kachel<T>[] {
  const nachSparkasse = new Map<string, T[]>();
  for (const e of eintraege) {
    const treffer = sparkasseNachName(e.sparkasse);
    if (!treffer) throw new Error(`Sparkasse „${e.sparkasse}“ (${e.kommune}) steht nicht in der Liste der 27 Sparkassen im Rheinland.`);
    nachSparkasse.set(treffer.name, [...(nachSparkasse.get(treffer.name) ?? []), e]);
  }
  return SPARKASSEN_RHEINLAND.flatMap((s, i) => {
    const zeilen = [...(nachSparkasse.get(s.name) ?? [])].sort((a, b) => a.kommune.localeCompare(b.kommune, 'de'));
    return zeilen.length ? zeilen.map((eintrag) => ({ nr: i + 1, sparkasse: s.name, eintrag })) : [{ nr: i + 1, sparkasse: s.name }];
  });
}
