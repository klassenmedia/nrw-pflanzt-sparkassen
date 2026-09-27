import {
  plantedTrees,
  projektstand,
  STAND_OPTIONS,
  treesForProgress,
  type Step,
} from '../lib/projektstand.ts';
import type { IslandController, IslandStage } from './island.ts';

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
        const match = filter === 'alle' || tile.dataset.status === filter;
        tile.classList.toggle('is-dimmed', !match);
        if (match) shown += 1;
      });
      if (status) status.textContent = `${shown} von ${tiles.length} Regionen hervorgehoben`;
    });
  });
}

function initCopy() {
  const button = document.querySelector<HTMLButtonElement>('[data-copy]');
  const input = document.querySelector<HTMLInputElement>('#share-link');
  const status = document.querySelector<HTMLElement>('[data-copy-status]');
  if (!button || !input || !status) return;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Link kopiert.';
    } catch {
      input.select();
      status.textContent = 'Link markiert. Mit Strg+C bzw. ⌘+C kopieren.';
    }
  });
}

async function loadIsland(): Promise<IslandController | null> {
  const canvas = document.querySelector<HTMLCanvasElement>('.sk-island');
  if (!canvas) return null;
  const fallback = document.querySelector<HTMLElement>('.sk-island-fallback');
  try {
    const { mountIsland } = await import('./island.ts');
    const controller = mountIsland(canvas, {
      trees: Number(canvas.dataset.trees ?? 0),
      stage: Number(canvas.dataset.stage ?? 3) as IslandStage,
    });
    if (fallback) fallback.hidden = true;
    return controller;
  } catch (error) {
    console.warn('3D-Szene nicht verfügbar, zeige Ersatzgrafik.', error);
    canvas.hidden = true;
    return null;
  }
}

function applyProgress(progress: number, island: IslandController | null) {
  const trees = plantedTrees(progress);
  document.querySelectorAll<HTMLElement>('[data-progress-trees]').forEach((el) => {
    el.textContent = numberFormat.format(trees);
    el.dataset.count = String(trees);
  });
  document.querySelectorAll<HTMLElement>('[data-progress-bar]').forEach((el) => {
    el.style.setProperty('--sk-progress', `${progress}%`);
    el.setAttribute('aria-valuenow', String(progress));
  });
  island?.setTrees(treesForProgress(progress));
}

const CHECK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

function renderStep(step: Step): HTMLLIElement {
  const row = document.createElement('li');
  row.className = 'sk-srow';
  row.dataset.state = step.state;
  const dot = document.createElement('span');
  dot.className = 'sk-srow__dot';
  if (step.state === 'done') dot.innerHTML = CHECK_ICON;
  const text = document.createElement('span');
  text.className = 'sk-srow__text';
  const title = document.createElement('span');
  title.className = 'sk-srow__title';
  title.textContent = step.title;
  const detail = document.createElement('span');
  detail.className = 'sk-srow__detail';
  detail.textContent = step.detail;
  text.append(title, detail);
  const tag = document.createElement('span');
  tag.className = 'sk-srow__tag';
  tag.textContent = step.tag;
  row.append(dot, text, tag);
  return row;
}

function applyStand(stand: string, island: IslandController | null) {
  const view = projektstand(stand);
  document.querySelectorAll<HTMLElement>('[data-stand-text]').forEach((el) => {
    el.textContent = view.stand;
  });
  const list = document.querySelector<HTMLElement>('[data-steps]');
  list?.replaceChildren(...view.steps.map(renderStep));
  document.querySelectorAll<HTMLElement>('[data-show-media]').forEach((el) => {
    el.hidden = el.dataset.showMedia === 'yes' ? !view.hasMedia : view.hasMedia;
  });
  document.querySelectorAll<HTMLElement>('[data-show-planted]').forEach((el) => {
    el.hidden = !view.planted;
  });
  document.querySelectorAll<HTMLElement>('[data-media-label]').forEach((el) => {
    el.textContent = view.mediaLabel;
  });
  document.querySelectorAll<HTMLElement>('[data-hero-caption]').forEach((el) => {
    el.textContent = view.heroCaption;
  });
  island?.setStage(view.standIndex as IslandStage);
}

const SMALL_SCREEN_PX = 700;

function initDraftPanel(island: IslandController | null) {
  const panel = document.querySelector<HTMLDetailsElement>('[data-draft]');
  if (panel && window.innerWidth < SMALL_SCREEN_PX) panel.open = false;
  const range = document.querySelector<HTMLInputElement>('#draft-progress');
  const output = document.querySelector<HTMLOutputElement>('#draft-progress-value');
  range?.addEventListener('input', () => {
    const progress = Number(range.value);
    if (output) output.value = `${progress} %`;
    applyProgress(progress, island);
  });
  const select = document.querySelector<HTMLSelectElement>('#draft-stand');
  select?.addEventListener('change', () => {
    if ((STAND_OPTIONS as readonly string[]).includes(select.value)) applyStand(select.value, island);
  });
}

export async function initPage() {
  initTilt();
  initCounters();
  initFilters();
  initCopy();
  const island = await loadIsland();
  initDraftPanel(island);
}
