export const STAND_OPTIONS = [
  'Fläche in Planung',
  'Fläche gefunden',
  'Schulaktionstag erfolgt',
  'Pflanztag erfolgt',
] as const;

export type Stand = (typeof STAND_OPTIONS)[number];
export type Status = 'geplant' | 'aktion' | 'gepflanzt';
export type StepState = 'done' | 'running' | 'open';

export const TREE_GOAL = 50_000;
const MIN_ISLAND_TREES = 3;
const MAX_ISLAND_TREES = 26;

export const STATUS_LABEL: Record<Status, string> = {
  geplant: 'In Planung',
  aktion: 'Aktionstag erfolgt',
  gepflanzt: 'Gepflanzt',
};

export const FILTERS: ReadonlyArray<{ value: 'alle' | Status; label: string }> = [
  { value: 'alle', label: 'Alle' },
  { value: 'geplant', label: 'In Planung' },
  { value: 'aktion', label: 'Aktionstag' },
  { value: 'gepflanzt', label: 'Gepflanzt' },
];

export interface Step {
  title: string;
  detail: string;
  state: StepState;
  tag: string;
}

export interface ProjektstandView {
  standIndex: number;
  stand: Stand;
  steps: Step[];
  hasMedia: boolean;
  planted: boolean;
  mediaLabel: string;
  heroCaption: string;
}

// Unbekannte Werte landen bewusst auf Stufe 0, damit nie ein Fortschritt behauptet wird.
export function standIndex(stand: unknown): number {
  const index = STAND_OPTIONS.indexOf(stand as Stand);
  return index < 0 ? 0 : index;
}

export function statusForStand(stand: unknown): Status {
  const index = standIndex(stand);
  if (index >= 3) return 'gepflanzt';
  if (index === 2) return 'aktion';
  return 'geplant';
}

const STEP_TEXTS = [
  { title: 'Pflanzfläche', yes: '[Ort], mit Forstamt [Name]', no: 'Wird mit Kommune und Forst gesucht' },
  { title: 'Schulaktionstag', yes: '[Datum] · [Schule], mit der Sparkasse vor Ort', no: 'Geplant für [Datum]' },
  { title: 'Pflanztag', yes: '[Datum] · [Anzahl] Bäume, Partnerschild gesetzt', no: 'Geplant für [Datum]' },
  { title: 'Pflege (3 Jahre)', yes: 'Läuft bis [Jahr]', no: 'Beginnt nach dem Pflanztag' },
];

const TAG_FOR_STATE: Record<StepState, string> = { done: 'Ja', running: 'Läuft', open: 'Noch offen' };

export function projektstand(stand: unknown): ProjektstandView {
  const index = standIndex(stand);
  const steps = STEP_TEXTS.map((text, i): Step => {
    const isCare = i === 3;
    const state: StepState = isCare ? (index >= 3 ? 'running' : 'open') : index >= i + 1 ? 'done' : 'open';
    return { title: text.title, detail: state === 'open' ? text.no : text.yes, state, tag: TAG_FOR_STATE[state] };
  });
  const hasMedia = index >= 2;
  return {
    standIndex: index,
    stand: STAND_OPTIONS[index],
    steps,
    hasMedia,
    planted: index >= 3,
    mediaLabel: index >= 3 ? 'Pflanztag' : 'Schulaktionstag',
    heroCaption: hasMedia
      ? 'Titelfoto: die Klasse mit dem Sparkassen-Team auf der Fläche'
      : 'Platzhalterbild der Kommune, bis das erste Aktionstag-Foto da ist',
  };
}

export function filterRegionen<T extends { status: Status }>(list: readonly T[], filter: string) {
  const known = FILTERS.some((f) => f.value === filter);
  return list.map((r) => ({ ...r, shown: !known || filter === 'alle' || r.status === filter }));
}

function clampPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, progress));
}

export function plantedTrees(progress: number): number {
  return Math.round((TREE_GOAL * clampPercent(progress)) / 100);
}

export function treesForProgress(progress: number): number {
  return Math.round(MIN_ISLAND_TREES + ((MAX_ISLAND_TREES - MIN_ISLAND_TREES) * clampPercent(progress)) / 100);
}
