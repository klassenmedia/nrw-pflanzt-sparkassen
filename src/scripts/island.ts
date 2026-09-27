import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';

// Bühne der Insel: 0 = Fläche in Planung … 3 = Pflanztag erfolgt. Die Übersicht nutzt immer 3.
export type IslandStage = 0 | 1 | 2 | 3;

export interface IslandController {
  setTrees(count: number): void;
  setStage(stage: IslandStage): void;
}

const ISLAND_RADIUS = 3.2;
const PLANT_RADIUS = 2.55;
const MAX_TREES = 26;
const ROTATION_SPEED = 0.0022;
const GROW_SPEED = 0.06;
const STAGGER_FRAMES = 4;

const LEAF_COLORS = ['#3f7a23', '#5c9a36', '#2c5a16', '#7fb24a', '#4b8a2a'];

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function treeSpots(count: number): Array<[number, number]> {
  const random = seededRandom(7);
  const spots: Array<[number, number]> = [];
  let guard = 0;
  while (spots.length < count && guard < 4000) {
    guard += 1;
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * PLANT_RADIUS;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const nearSign = Math.hypot(x - 1.9, z - 1.2) < 0.7;
    const crowded = spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 0.62);
    if (!crowded && !nearSign) spots.push([x, z]);
  }
  return spots;
}

function flat(color: string) {
  return new MeshStandardMaterial({ color: new Color(color), flatShading: true, roughness: 0.85 });
}

function buildTree(index: number): Group {
  const tree = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.06, 0.1, 0.55, 6), flat('#6b4226'));
  trunk.position.y = 0.27;
  trunk.castShadow = true;
  tree.add(trunk);
  const leaf = flat(LEAF_COLORS[index % LEAF_COLORS.length]);
  // Mischwald: abwechselnd Nadel- und Laubbaum.
  if (index % 3 === 0) {
    const crown = new Mesh(new IcosahedronGeometry(0.42, 0), leaf);
    crown.position.y = 0.85;
    crown.castShadow = true;
    tree.add(crown);
  } else {
    for (let tier = 0; tier < 3; tier += 1) {
      const cone = new Mesh(new ConeGeometry(0.42 - tier * 0.1, 0.55, 7), leaf);
      cone.position.y = 0.62 + tier * 0.3;
      cone.castShadow = true;
      tree.add(cone);
    }
  }
  tree.rotation.y = index * 1.7;
  tree.scale.setScalar(0.0001);
  return tree;
}

function buildIsland(): Group {
  const island = new Group();
  const grass = new Mesh(new CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.94, 0.45, 10), flat('#4f8f2c'));
  grass.receiveShadow = true;
  island.add(grass);
  const soil = new Mesh(new CylinderGeometry(ISLAND_RADIUS * 0.94, 1.3, 1.9, 10), flat('#7a4a2a'));
  soil.position.y = -1.17;
  island.add(soil);
  const rock = new Mesh(new ConeGeometry(1.3, 1.4, 10), flat('#5a3a24'));
  rock.position.y = -2.8;
  rock.rotation.x = Math.PI;
  island.add(rock);
  return island;
}

function buildSign(): Group {
  const sign = new Group();
  for (const x of [-0.32, 0.32]) {
    const post = new Mesh(new BoxGeometry(0.06, 0.8, 0.06), flat('#e9e2e2'));
    post.position.set(x, 0.4, 0);
    sign.add(post);
  }
  const board = new Mesh(new BoxGeometry(0.9, 0.5, 0.05), flat('#ffffff'));
  board.position.y = 0.78;
  board.castShadow = true;
  sign.add(board);
  const stripe = new Mesh(new BoxGeometry(0.9, 0.14, 0.06), flat('#ff0000'));
  stripe.position.y = 0.96;
  sign.add(stripe);
  sign.position.set(1.9, 0.22, 1.2);
  sign.rotation.y = -0.6;
  sign.scale.setScalar(0.0001);
  return sign;
}

function buildStakes(): Group {
  const stakes = new Group();
  const corners: Array<[number, number]> = [
    [-1.6, -1.2],
    [1.4, -1.4],
    [1.5, 1.3],
    [-1.5, 1.4],
  ];
  for (const [x, z] of corners) {
    const stake = new Mesh(new BoxGeometry(0.07, 0.5, 0.07), flat('#f3ece4'));
    stake.position.set(x, 0.47, z);
    const tip = new Mesh(new BoxGeometry(0.08, 0.1, 0.08), flat('#ff0000'));
    tip.position.set(x, 0.74, z);
    stakes.add(stake, tip);
  }
  stakes.scale.setScalar(0.0001);
  return stakes;
}

function buildPollen(): Points {
  const random = seededRandom(3);
  const positions: number[] = [];
  for (let i = 0; i < 40; i += 1) {
    positions.push((random() - 0.5) * 9, random() * 5 - 1, (random() - 0.5) * 9);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return new Points(geometry, new PointsMaterial({ color: '#fff4e8', size: 0.06, transparent: true, opacity: 0.75 }));
}

function approach(current: number, target: number): number {
  const next = current + (target - current) * GROW_SPEED;
  return Math.abs(next - target) < 0.002 ? target : next;
}

export function mountIsland(canvas: HTMLCanvasElement, initial: { trees: number; stage: IslandStage }): IslandController {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 4.6, 12.8);
  camera.lookAt(0, -0.7, 0);

  scene.add(new HemisphereLight('#ffe9df', '#6a0d0d', 1.6));
  scene.add(new AmbientLight('#ffffff', 0.35));
  const sun = new DirectionalLight('#fff6ea', 2.4);
  sun.position.set(5, 9, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  scene.add(sun);

  const world = new Group();
  world.rotation.x = 0.08;
  world.position.y = 0.4;
  scene.add(world);
  world.add(buildIsland());

  const surface = new Group();
  surface.position.y = 0.22;
  world.add(surface);

  const trees = treeSpots(MAX_TREES).map(([x, z], i) => {
    const tree = buildTree(i);
    tree.position.set(x, 0, z);
    surface.add(tree);
    return tree;
  });
  const sign = buildSign();
  world.add(sign);
  const stakes = buildStakes();
  surface.add(stakes);
  const pollen = buildPollen();
  scene.add(pollen);

  let treeCount = initial.trees;
  let stage = initial.stage;
  // Unsichtbar geladen (Hintergrund-Tab, Vorschaubild): sofort Endzustand statt Wachstum.
  const automated = navigator.webdriver || /HeadlessChrome|bot|crawler|preview/i.test(navigator.userAgent);
  let snap = reduceMotion || automated || document.visibilityState !== 'visible';
  let pointerTilt = 0;
  let frame = 0;
  let running = false;
  let visible = true;

  function targetScale(i: number): number {
    if (stage < 2 || i >= treeCount) return 0.0001;
    const base = 0.75 + ((i * 37) % 30) / 100;
    return stage === 2 ? base * 0.32 : base;
  }

  function step(): boolean {
    let moving = false;
    trees.forEach((tree, i) => {
      if (frame < i * STAGGER_FRAMES && !snap) return;
      const target = targetScale(i);
      const next = snap ? target : approach(tree.scale.x, target);
      if (next !== tree.scale.x) moving = true;
      tree.scale.setScalar(next);
    });
    const signTarget = stage >= 3 ? 1 : 0.0001;
    const stakeTarget = stage >= 1 && stage < 3 ? 1 : 0.0001;
    for (const [object, target] of [
      [sign, signTarget],
      [stakes, stakeTarget],
    ] as const) {
      const next = snap ? target : approach(object.scale.x, target);
      if (next !== object.scale.x) moving = true;
      object.scale.setScalar(next);
    }
    snap = reduceMotion;
    return moving;
  }

  function render() {
    const moving = step();
    if (!reduceMotion) {
      world.rotation.y += ROTATION_SPEED;
      world.rotation.x += (0.08 + pointerTilt - world.rotation.x) * 0.05;
      pollen.rotation.y -= ROTATION_SPEED * 0.6;
      pollen.position.y = Math.sin(frame / 120) * 0.15;
    }
    renderer.render(scene, camera);
    frame += 1;
    return moving;
  }

  function loop() {
    if (!visible) {
      running = false;
      return;
    }
    const moving = render();
    if (reduceMotion && !moving) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
    if (!running) render();
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && document.visibilityState === 'visible';
    if (visible) start();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    if (visible) start();
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointerTilt = ((event.clientY - rect.top) / rect.height - 0.5) * 0.25;
  });
  canvas.addEventListener('pointerleave', () => {
    pointerTilt = 0;
  });

  if (snap) step();
  resize();
  start();

  function update() {
    if (visible) {
      start();
      return;
    }
    snap = true;
    render();
  }

  return {
    setTrees(count) {
      treeCount = Math.max(0, Math.min(MAX_TREES, Math.round(count)));
      update();
    },
    setStage(next) {
      stage = next;
      update();
    },
  };
}
