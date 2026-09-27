import { statusForStand, type Stand, type Status } from '../lib/projektstand.ts';

// Entwurfsdaten. Aufbau entspricht dem späteren WordPress-Beitragstyp „Region“ (Feld `stand`).
export interface Region {
  nr: number;
  slug: string;
  name: string;
  kommune: string;
  stand: Stand;
  status: Status;
}

const BEISPIEL_STAENDE: Stand[] = [
  'Pflanztag erfolgt',
  'Schulaktionstag erfolgt',
  'Fläche in Planung',
  'Schulaktionstag erfolgt',
  'Pflanztag erfolgt',
  'Fläche gefunden',
  'Fläche in Planung',
  'Schulaktionstag erfolgt',
  'Pflanztag erfolgt',
];

const REGION_COUNT = 27;

export const regionen: Region[] = Array.from({ length: REGION_COUNT }, (_, i) => {
  const nr = i + 1;
  const code = String(nr).padStart(2, '0');
  const stand = BEISPIEL_STAENDE[nr % BEISPIEL_STAENDE.length];
  return {
    nr,
    slug: `sparkasse-${code}`,
    name: `Sparkasse [Name ${code}]`,
    kommune: '[Kommune]',
    stand,
    status: statusForStand(stand),
  };
});

export const fortschrittBeispiel = 38;
