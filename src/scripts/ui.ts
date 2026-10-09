import { heuteIso, naechsterTermin, parseKandidaten, terminText } from '../lib/kennzahlen.ts';
import type { IslandStage } from './island.ts';

const TILT_MAX_DEG = 7;
const COUNT_UP_MS = 1400;
const numberFormat = new Intl.NumberFormat('de-DE');

const prefersMotion = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initTilt() {
  if (!prefersMotion() || !window.matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll<HTMLElement>('.sk-tilt').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.style.setProperty('--ry', `${(x - 0.5) * TILT_MAX_DEG * 2}deg`);
      card.style.setProperty('--rx', `${(0.5 - y) * TILT_MAX_DEG * 2}deg`);
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.classList.add('is-tilting');
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.classList.remove('is-tilting');
    });
  });
}

function countUp(element: HTMLElement, target: number) {
  if (!prefersMotion()) {
    element.textContent = numberFormat.format(target);
    return;
  }
  const started = performance.now();
  const tick = (now: number) => {
    const progress = Math.min(1, (now - started) / COUNT_UP_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = numberFormat.format(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Zählt nur hoch, wenn der Zähler erst später ins Bild scrollt; beim Laden steht der Endwert.
function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const element = entry.target as HTMLElement;
      observer.unobserve(element);
      if (element.getBoundingClientRect().top > window.innerHeight * 0.5) {
        countUp(element, Number(element.dataset.count));
      }
    }
  });
  counters.forEach((counter) => {
    if (counter.getBoundingClientRect().top > window.innerHeight) observer.observe(counter);
  });
}

function initFilters() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
  const tiles = document.querySelectorAll<HTMLElement>('.sk-tile');
  const status = document.querySelector<HTMLElement>('[data-filter-status]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter ?? 'alle';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      let shown = 0;
      tiles.forEach((tile) => {
        const match = filter === 'alle' || (tile.dataset.filterTags ?? '').split(' ').includes(filter);
        tile.classList.toggle('is-dimmed', !match);
        if (match) shown += 1;
      });
      if (status) status.textContent = `${shown} von ${tiles.length} Sparkassen hervorgehoben`;
    });
  });
}


async function loadIsland(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>('.sk-island');
  if (!canvas) return;
  const fallback = document.querySelector<HTMLElement>('.sk-island-fallback');
  try {
    const { mountIsland } = await import('./island.ts');
    mountIsland(canvas, {
      trees: Number(canvas.dataset.trees ?? 0),
      stage: Number(canvas.dataset.stage ?? 3) as IslandStage,
    });
    if (fallback) fallback.hidden = true;
  } catch (error) {
    console.warn('3D-Szene nicht verfügbar, zeige Ersatzgrafik.', error);
    canvas.hidden = true;
  }
}

// Der Build kennt nur sein eigenes Datum; hier wird mit dem echten Heute neu gewählt.
function initTermine() {
  const heute = heuteIso(new Date());
  document.querySelectorAll<HTMLElement>('[data-termin]').forEach((box) => {
    const kandidaten = parseKandidaten(box.dataset.kandidaten);
    if (!kandidaten) {
      console.warn('Termindaten nicht lesbar, zeige Stand des Builds.');
      return;
    }
    const termin = naechsterTermin(kandidaten, heute);
    const text = box.querySelector<HTMLElement>('[data-termin-text]');
    if (text) text.textContent = termin ? terminText(termin) : '';
    box.hidden = !termin;
  });
}

// Hover und Fokus halten per CSS an; Antippen schaltet um, damit es auch auf dem Handy geht.
function initMarquee() {
  const marquee = document.querySelector<HTMLElement>('.sk-marquee');
  marquee?.addEventListener('click', () => marquee.classList.toggle('is-paused'));
}

export async function initPage() {
  initTilt();
  initMarquee();
  initTermine();
  initCounters();
  initFilters();
  await loadIsland();
}
