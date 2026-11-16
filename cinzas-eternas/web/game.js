'use strict';
/* =========================================================
   CINZAS ETERNAS — um soulslike 2D de fases infinitas
   ========================================================= */
(() => {
const cvs = document.getElementById('c'), ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1, SC = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  SC = Math.min(H / 430, W / 640);
}
window.addEventListener('resize', resize); resize();
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* ---------- utilidades ---------- */
const PI = Math.PI, TAU = PI * 2;
const R = Math.random, rnd = (a, b) => a + R() * (b - a), clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function angDiff(a, b) { let d = b - a; while (d > PI) d -= TAU; while (d < -PI) d += TAU; return d; }
function turnTo(a, b, s) { const d = angDiff(a, b); return a + clamp(d, -s, s); }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const pick = (arr, r = R) => arr[Math.floor(r() * arr.length)];

/* ---------- áudio sintetizado ---------- */
let AC = null, noiseBuf = null;
function initAudio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      const n = AC.sampleRate * 0.6; noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = R() * 2 - 1;
    } catch (e) { AC = null; }
  }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f0, f1, dur, type, vol) {
  if (!AC) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, vol, q) {
  if (!AC) return; const t = AC.currentTime, s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(AC.destination); s.start(t); s.stop(t + dur);
}
const SFX = {
  swing: () => noise(0.14, 2400, 0.22, 0.8), heavy: () => noise(0.3, 900, 0.35, 0.7),
  hit: () => { tone(180, 60, 0.14, 'square', 0.12); noise(0.1, 1300, 0.25); },
  hurt: () => { tone(240, 70, 0.3, 'sawtooth', 0.16); noise(0.15, 600, 0.2); },
  roll: () => noise(0.22, 450, 0.18, 0.5), heal: () => { tone(400, 900, 0.6, 'sine', 0.14); tone(600, 1200, 0.5, 'sine', 0.06); },
  soul: () => tone(880, 1400, 0.12, 'sine', 0.06), boom: () => { tone(90, 30, 0.6, 'sine', 0.4); noise(0.45, 200, 0.35, 0.5); },
  cast: () => tone(300, 760, 0.28, 'triangle', 0.08), shoot: () => noise(0.12, 3000, 0.1, 2),
  death: () => { tone(200, 40, 1.6, 'sawtooth', 0.2); tone(150, 30, 1.8, 'sine', 0.25); },
  roar: () => { tone(130, 55, 1.0, 'sawtooth', 0.22); noise(0.9, 300, 0.3, 0.4); },
  victory: () => { tone(220, 440, 1.3, 'triangle', 0.18); tone(330, 660, 1.5, 'sine', 0.1); },
  ui: () => tone(620, 480, 0.06, 'square', 0.05), gate: () => { tone(300, 600, 0.8, 'sine', 0.1); tone(450, 900, 0.9, 'sine', 0.06); },
  parry: () => { tone(1500, 900, 0.2, 'square', 0.1); },
  deflect: () => { tone(2100, 1400, 0.16, 'square', 0.12); tone(3100, 2500, 0.22, 'triangle', 0.08); noise(0.08, 5000, 0.25, 3); },
  block: () => { tone(420, 220, 0.12, 'square', 0.1); noise(0.1, 1600, 0.2, 1.5); },
  deathblow: () => { tone(90, 30, 0.9, 'sine', 0.45); noise(0.6, 700, 0.35, 0.6); tone(1400, 300, 0.45, 'sawtooth', 0.08); },
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }

/* ---------- salvamento ---------- */
const KEY = 'cinzas_eternas_v1';
function newSave() {
  return { v: 4, stage: 1, checkpoint: 1, souls: 0, lost: null, best: 1, deaths: 0, bosses: 0, started: false, cls: null,
    at: { vig: 10, end: 10, str: 10, dex: 10, int: 10 }, inv: { w: [], sh: [], ar: [], rg: [], it: {}, tit: 0 },
    eq: { w: 0, sh: -1, ar: -1, r1: -1, r2: -1 }, quick: null, picked: {} };
}
let S = newSave();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

/* ---------- dados do mundo ---------- */
/* ---------- reinos mitológicos ----------
   Cada reino = 3 fases (2 normais + 1 chefe). Os inimigos usam as mesmas IAs-base
   (hollow, hound, archer, knight, caster, brute) com nome e aparência do mito. */
const B_ = (name, epi, shape, o) => Object.assign({ name, epi, shape, r: 28, hp: 640, pref: 110, col: '#888', col2: '#f33', attacks: ['combo'], p2: ['roar'], minion: 'hollow', deco: {} }, o);
const REALMS = [
  { myth: 'Mitologia Grega', name: 'Labirinto de Creta', floor: '#1e1c19', tile: '#28251f', line: '#332f27', accent: '#e0c27a', obs: '#5a554b', obsTop: '#cfc6b0', obsKind: ['column', 'column', 'pillar'],
    skins: { hollow: { name: 'Hoplita Esqueleto', col: '#cfc6b0', deco: ['bones', 'helm'] }, hound: { name: 'Harpia', col: '#8a6a4a', deco: ['wings'] },
      archer: { post: 4, name: 'Sátiro Arqueiro', col: '#7a5a3a', deco: ['horns'] }, knight: { name: 'Guardião de Bronze', col: '#b08d57', deco: ['helm'] },
      caster: { post: 4, name: 'Lâmia', col: '#5a7a5a', deco: ['snakes'] }, brute: { name: 'Ciclope', col: '#9a8a76', deco: ['oneEye'] } },
    bosses: [
      B_('Minotauro', 'Senhor do Labirinto', 'beast', { r: 34, hp: 640, pref: 100, col: '#5e3b2a', col2: '#e04a3a', attacks: ['charge', 'combo', 'pounce', 'cleave'], p2: ['roar'], deco: { horns: 1 } }),
      B_('Medusa', 'O Olhar que Petrifica', 'witch', { r: 25, hp: 540, pref: 280, col: '#3f6b4a', col2: '#b8ff9a', attacks: ['beam', 'volley', 'teleport', 'spiral'], p2: ['summon'], deco: { snakes: 1 } }),
      B_('Hidra de Lerna', 'A de Muitas Cabeças', 'wyrm', { r: 30, hp: 780, pref: 170, col: '#2f5a4a', col2: '#c9ff5a', attacks: ['breath', 'volley', 'sweep', 'spikes'], p2: ['meteor'], minion: 'hound', deco: { heads: 5 } }),
      B_('Cérbero', 'Cão de Guarda do Submundo', 'beast', { r: 36, hp: 700, pref: 110, col: '#2a2226', col2: '#ff6a2a', attacks: ['pounce', 'breath', 'sweep', 'charge'], p2: ['roar'], minion: 'hound', deco: { heads: 3, flame: 1 } }),
    ] },
  { myth: 'Mitologia Nórdica', name: 'Helheim Congelado', floor: '#1f2429', tile: '#283039', line: '#323b45', accent: '#bfe3ff', obs: '#3d4752', obsTop: '#8fa3b5', obsKind: ['rune', 'rune', 'pillar'],
    skins: { hollow: { name: 'Draugr', col: '#7d8a8a', deco: ['bones'] }, hound: { name: 'Lobo Warg', col: '#5d5f66', deco: [] },
      archer: { name: 'Arqueiro Draugr', col: '#6a7a78', deco: ['bones'] }, knight: { name: 'Einherjar Caído', col: '#8a929c', deco: ['helm', 'horns'] },
      caster: { name: 'Völva Sombria', col: '#4a4f7a', deco: ['hood'] }, brute: { name: 'Jötunn de Gelo', col: '#8fb6d8', deco: ['oneEye'] } },
    bosses: [
      B_('Fenrir', 'O Lobo Acorrentado', 'beast', { r: 36, hp: 680, pref: 100, col: '#4a4c55', col2: '#ffd166', attacks: ['pounce', 'charge', 'sweep', 'combo'], p2: ['roar'], minion: 'hound', deco: { chains: 1 } }),
      B_('Surtr', 'O Gigante de Muspelheim', 'golem', { r: 44, hp: 960, pref: 130, col: '#4a2a1a', col2: '#ff8c3a', attacks: ['slam', 'shockwave', 'meteor', 'breath'], p2: ['spikes'], deco: { flame: 1, horns: 1 } }),
      B_('Jörmungandr', 'A Serpente do Mundo', 'wyrm', { r: 34, hp: 820, pref: 170, col: '#2f4f5f', col2: '#7fffd4', attacks: ['charge', 'sweep', 'volley', 'spikes'], p2: ['breath'], minion: 'hound', deco: {} }),
    ] },
  { myth: 'Mitologia Egípcia', name: 'Duat, o Mundo dos Mortos', floor: '#2a2217', tile: '#33291b', line: '#3d3120', accent: '#ffd36b', obs: '#7a6440', obsTop: '#d9b36a', obsKind: ['obelisk', 'obelisk', 'pillar'],
    skins: { hollow: { name: 'Múmia', col: '#cbbf9a', deco: ['wraps'] }, hound: { name: 'Chacal do Deserto', col: '#a07a4a', deco: ['ears'] },
      archer: { name: 'Arqueiro Mumificado', col: '#b8a77e', deco: ['wraps'] }, knight: { name: 'Guarda da Tumba', col: '#3a5a7a', deco: ['nemes'] },
      caster: { name: 'Sacerdote Amaldiçoado', col: '#6a4a2a', deco: ['nemes'] }, brute: { name: 'Escorpião Gigante', col: '#5a3a1a', deco: ['pincers'] } },
    bosses: [
      B_('Apep', 'A Serpente do Caos', 'wyrm', { r: 32, hp: 800, pref: 170, col: '#3a2a4a', col2: '#c77dff', attacks: ['breath', 'charge', 'spikes', 'spiral'], p2: ['meteor'], minion: 'hound', deco: {} }),
      B_('Ammit', 'A Devoradora de Corações', 'beast', { r: 34, hp: 700, pref: 100, col: '#4a6a3a', col2: '#ffd36b', attacks: ['pounce', 'combo', 'sweep', 'roar'], p2: ['charge'], minion: 'hound', deco: { mane: 1 } }),
      B_('Esfinge', 'Guardiã dos Enigmas', 'golem', { r: 42, hp: 900, pref: 140, col: '#b08d57', col2: '#7fd4ff', attacks: ['beam', 'slam', 'meteor', 'shockwave'], p2: ['summon'], deco: { nemes: 1 } }),
    ] },
  { myth: 'Mitologia Japonesa', name: 'Yomi, a Terra das Trevas', floor: '#18141a', tile: '#211b24', line: '#2b232f', accent: '#ff5a6a', obs: '#3a3238', obsTop: '#8a7a80', obsKind: ['lantern', 'lantern', 'pillar'],
    skins: { hollow: { name: 'Gaki Faminto', col: '#8a9a8a', deco: ['ghost'] }, hound: { name: 'Kitsune Selvagem', col: '#d0803a', deco: ['ears', 'tails'] },
      archer: { name: 'Tengu Arqueiro', col: '#a03a2a', deco: ['beak', 'wings'] }, knight: { name: 'Samurai Amaldiçoado', col: '#5a2a2a', deco: ['kabuto'] },
      caster: { name: 'Onmyōji Corrompido', col: '#3a3a5a', deco: ['hood'] }, brute: { name: 'Oni', col: '#b03a3a', deco: ['horns'] } },
    bosses: [
      B_('Yamata no Orochi', 'A Serpente de Oito Cabeças', 'wyrm', { r: 34, hp: 840, pref: 170, col: '#3a2a2a', col2: '#ff5a3a', attacks: ['breath', 'volley', 'sweep', 'charge'], p2: ['spikes'], minion: 'hound', deco: { heads: 7 } }),
      B_('Gashadokuro', 'O Esqueleto Colossal', 'golem', { r: 46, hp: 980, pref: 130, col: '#d8d0c0', col2: '#7fd4ff', attacks: ['slam', 'sweep', 'spikes', 'shockwave'], p2: ['summon'], deco: { skull: 1 } }),
      B_('Kyūbi no Kitsune', 'A Raposa de Nove Caudas', 'witch', { r: 26, hp: 580, pref: 260, col: '#e8a04a', col2: '#9fe3ff', attacks: ['teleport', 'spiral', 'meteor', 'volley'], p2: ['dashslash'], minion: 'hound', deco: { tails: 9, ears: 1 } }),
    ] },
  { myth: 'Mitologia Asteca', name: 'Mictlān, a Terra dos Mortos', floor: '#1d1a14', tile: '#27231a', line: '#312b20', accent: '#3fd1a0', obs: '#4a4436', obsTop: '#8a7a5a', obsKind: ['stepped', 'stepped', 'pillar'],
    skins: { hollow: { name: 'Guerreiro Jaguar Morto', col: '#c89a3a', deco: ['bones', 'spots'] }, hound: { name: 'Ahuizotl', col: '#3a4a5a', deco: [] },
      archer: { name: 'Atirador de Atlatl', col: '#8a5a3a', deco: ['feathers'] }, knight: { name: 'Guerreiro Águia Caído', col: '#6a5040', deco: ['wings', 'feathers'] },
      caster: { name: 'Tzitzimitl', col: '#2a2a3a', deco: ['skull'] }, brute: { name: 'Guardião de Obsidiana', col: '#2a2a2e', deco: ['oneEye'] } },
    bosses: [
      B_('Cipactli', 'O Crocodilo Primordial', 'beast', { r: 38, hp: 760, pref: 110, col: '#3a5a3a', col2: '#3fd1a0', attacks: ['charge', 'pounce', 'sweep', 'combo'], p2: ['spikes'], minion: 'hound', deco: { jaws: 1 } }),
      B_('Rainha Tzitzimitl', 'Devoradora de Estrelas', 'witch', { r: 26, hp: 580, pref: 280, col: '#1f1f2e', col2: '#ffe08a', attacks: ['meteor', 'spiral', 'teleport', 'summon'], p2: ['beam'], deco: { skull: 1, wings: 1 } }),
      B_('Guardião do Mictlān', 'Senhor dos Nove Rios', 'knight', { r: 30, hp: 700, pref: 100, col: '#d8d0c0', col2: '#3fd1a0', attacks: ['combo', 'leap', 'cleave', 'spikes'], p2: ['shockwave'], deco: { skull: 1, feathers: 1 } }),
    ] },
  { myth: 'Folclore Brasileiro', name: 'Mata Encantada', floor: '#111a10', tile: '#172416', line: '#1e2f1c', accent: '#ff7a2a', obs: '#3a2a1a', obsTop: '#2f5a2a', obsKind: ['tree', 'tree', 'tree', 'pillar'],
    skins: { hollow: { name: 'Corpo-Seco', col: '#7a6a4a', deco: ['bones'] }, hound: { name: 'Mula sem Cabeça', col: '#4a3020', deco: ['headless'] },
      archer: { name: 'Caçador Assombrado', col: '#4a5a3a', deco: ['hat'] }, knight: { name: 'Capelobo', col: '#4a3a3a', deco: ['snout'] },
      caster: { name: 'Saci', col: '#3a2a20', deco: ['redcap'] }, brute: { name: 'Lobisomem', col: '#5a4a3a', deco: ['ears'] } },
    bosses: [
      B_('Boitatá', 'A Cobra de Fogo', 'wyrm', { r: 32, hp: 800, pref: 170, col: '#ff6a1a', col2: '#fff1a0', attacks: ['breath', 'charge', 'sweep', 'spiral'], p2: ['meteor'], minion: 'hound', deco: { flame: 1 } }),
      B_('Mapinguari', 'O Gigante da Floresta', 'golem', { r: 44, hp: 960, pref: 120, col: '#4a3a2a', col2: '#ff4a3a', attacks: ['slam', 'roar', 'sweep', 'leap'], p2: ['shockwave'], deco: { oneEye: 1, bellyMouth: 1 } }),
      B_('Cuca', 'A Bruxa-Jacaré', 'witch', { r: 26, hp: 600, pref: 260, col: '#3a6a2a', col2: '#d6ff6a', attacks: ['volley', 'meteor', 'summon', 'spiral'], p2: ['teleport'], deco: { jaws: 1 } }),
      B_('Curupira', 'Guardião da Mata', 'duelist', { r: 22, hp: 540, pref: 110, col: '#3a6a3a', col2: '#ff6a1a', attacks: ['dashslash', 'teleport', 'combo', 'spikes'], p2: ['meteor'], minion: 'hound', deco: { flame: 1 } }),
    ] },
  { myth: 'Demonologia e Inferno', name: 'Círculos do Inferno', floor: '#1f0e0e', tile: '#2a1414', line: '#361a1a', accent: '#ff3a2a', obs: '#2a1414', obsTop: '#5a2a22', obsKind: ['brazier', 'pillar', 'brazier'],
    skins: { hollow: { name: 'Condenado', col: '#7a5a5a', deco: [] }, hound: { name: 'Diabrete', col: '#a03a2a', deco: ['horns', 'wings'] },
      archer: { name: 'Demônio Arqueiro', col: '#6a2a2a', deco: ['horns'] }, knight: { name: 'Cavaleiro Infernal', col: '#3a2a2a', deco: ['helm', 'horns'] },
      caster: { name: 'Feiticeiro Infernal', col: '#5a1a3a', deco: ['hood'] }, brute: { name: 'Demônio de Fogo', col: '#a0401a', deco: ['horns', 'flame'] } },
    bosses: [
      B_('Anjo Caído', 'O Arauto Banido', 'knight', { r: 28, hp: 680, pref: 100, col: '#cfc6b0', col2: '#ffd166', attacks: ['combo', 'leap', 'beam', 'charge'], p2: ['meteor'], deco: { wings: 1, halo: 1 } }),
      B_('Leviatã', 'A Serpente dos Abismos', 'wyrm', { r: 36, hp: 860, pref: 180, col: '#1f3a5a', col2: '#6ad1ff', attacks: ['charge', 'breath', 'sweep', 'volley'], p2: ['spikes'], minion: 'hound', deco: {} }),
      B_('Beemote', 'A Besta Primordial', 'golem', { r: 46, hp: 1000, pref: 120, col: '#4a2a1a', col2: '#ff5a2a', attacks: ['slam', 'charge', 'shockwave', 'roar'], p2: ['meteor'], deco: { horns: 1 } }),
    ] },
  { myth: 'Mitologia Eslava', name: 'Floresta de Nav', floor: '#161818', tile: '#1d2120', line: '#252a29', accent: '#b0a0ff', obs: '#d8d4c8', obsTop: '#2a3a2a', obsKind: ['birch', 'birch', 'tree'],
    skins: { hollow: { name: 'Upyr', col: '#9a9aa0', deco: ['fangs'] }, hound: { name: 'Volkolak', col: '#4a4a50', deco: ['ears'] },
      archer: { name: 'Arqueiro Morto', col: '#6a6a5a', deco: ['bones'] }, knight: { name: 'Bogatyr Caído', col: '#7a7a8a', deco: ['helm'] },
      caster: { name: 'Rusalka', col: '#6aa0a0', deco: ['ghost'] }, brute: { name: 'Leshy', col: '#4a5a3a', deco: ['horns'] } },
    bosses: [
      B_('Koschei', 'O Imortal', 'knight', { r: 28, hp: 700, pref: 100, col: '#5a5a6a', col2: '#9fffb0', attacks: ['combo', 'charge', 'summon', 'leap'], p2: ['shockwave'], deco: { skull: 1, crown: 1 } }),
      B_('Baba Yaga', 'A Senhora da Cabana', 'witch', { r: 25, hp: 600, pref: 270, col: '#4a3a2a', col2: '#b0a0ff', attacks: ['meteor', 'volley', 'teleport', 'spikes'], p2: ['summon'], deco: {} }),
      B_('Zmei Gorynych', 'O Dragão de Três Cabeças', 'wyrm', { r: 34, hp: 840, pref: 170, col: '#2f4a2f', col2: '#ffae3a', attacks: ['breath', 'charge', 'meteor', 'sweep'], p2: ['volley'], minion: 'hound', deco: { heads: 3, wings: 1 } }),
    ] },
];
const BIOMES = REALMS;
const realmOf = n => REALMS[Math.floor((n - 1) / 3) % REALMS.length];
const ETYPES = {
  hollow: { post: 5, name: 'Morto-vivo', r: 13, hp: 42, spd: 72, dmg: 14, range: 34, wind: 0.55, cd: 1.4, col: '#8a8070', souls: 15, kind: 'melee' },
  hound: { post: 4, name: 'Cão Pútrido', r: 11, hp: 28, spd: 155, dmg: 11, range: 120, wind: 0.42, cd: 1.3, col: '#6e4b36', souls: 18, kind: 'lunge' },
  archer: { name: 'Arqueiro', r: 12, hp: 30, spd: 62, dmg: 12, range: 330, wind: 0.8, cd: 2.2, col: '#5a7060', souls: 20, kind: 'ranged' },
  knight: { post: 9, name: 'Cavaleiro Oco', r: 16, hp: 115, spd: 56, dmg: 24, range: 46, wind: 0.8, cd: 1.8, col: '#707a88', souls: 45, kind: 'melee', poise: true },
  caster: { name: 'Clérigo Profano', r: 12, hp: 36, spd: 52, dmg: 17, range: 280, wind: 0.9, cd: 3.0, col: '#7a4a8a', souls: 35, kind: 'caster' },
  brute: { post: 12, name: 'Bruto', r: 20, hp: 170, spd: 48, dmg: 30, range: 58, wind: 1.0, cd: 2.2, col: '#7d5a4a', souls: 70, kind: 'slam', poise: true },
};

/* =========================================================
   SISTEMAS DE RPG: armas, escudos, armaduras, anéis, itens,
   classes, atributos, carga de equipamento, loot.
   ========================================================= */
const STAT_NAMES = { vig: 'Vigor', end: 'Fôlego', str: 'Força', dex: 'Destreza', int: 'Intelecto' };
const STAT_SHORT = { vig: 'VIG', end: 'FOL', str: 'FOR', dex: 'DES', int: 'INT' };
const LET = { S: 1.4, A: 1.1, B: 0.8, C: 0.55, D: 0.3, E: 0.15 };
const LETREQ = { S: 18, A: 16, B: 13, C: 11, D: 9, E: 8 };
const ELEM = {
  fogo: { name: 'Fogo', col: '#ff8c3a', rgb: '255,140,58' }, gelo: { name: 'Gelo', col: '#9fe3ff', rgb: '159,227,255' },
  raio: { name: 'Raio', col: '#fff27a', rgb: '255,242,122' }, veneno: { name: 'Veneno', col: '#8aff6a', rgb: '138,255,106' },
  sangue: { name: 'Sangue', col: '#ff3a4a', rgb: '255,58,74' },
};
/* Tipos de arma = conjuntos de movimentos. l = leve, h = forte. */
const WT = {
  sword: { name: 'Espada', combo: 3, l: { dur: 0.40, h0: 0.10, h1: 0.21, range: 60, arc: 2.0, st: 17, lunge: 120, mul: 1, post: 1 }, h: { dur: 0.82, h0: 0.38, h1: 0.52, range: 76, arc: 2.5, st: 32, lunge: 95, mul: 2.1, post: 3.5 }, tip: 'Equilibrada. Combo de 3 golpes.' },
  dagger: { name: 'Adaga', combo: 4, back: 3.5, l: { dur: 0.26, h0: 0.06, h1: 0.14, range: 44, arc: 1.6, st: 11, lunge: 150, mul: 1, post: 0.6 }, h: { dur: 0.55, h0: 0.16, h1: 0.32, range: 52, arc: 1.3, st: 22, dash: 330, mul: 1.9, post: 1.6 }, tip: 'Muito rápida. Forte = investida. Ataques pelas costas devastadores.' },
  great: { name: 'Espadão', combo: 2, l: { dur: 0.75, h0: 0.34, h1: 0.50, range: 90, arc: 2.8, st: 28, lunge: 60, mul: 1, post: 3 }, h: { dur: 1.15, h0: 0.62, h1: 0.80, range: 98, arc: 3.4, st: 44, lunge: 50, mul: 1.8, post: 6.5 }, tip: 'Lento e pesado. Golpes largos que quebram postura.' },
  axe: { name: 'Machado', combo: 3, l: { dur: 0.55, h0: 0.22, h1: 0.34, range: 66, arc: 2.2, st: 22, lunge: 90, mul: 1, post: 2 }, h: { dur: 0.95, h0: 0.35, h1: 0.62, range: 76, arc: TAU, st: 38, mul: 1.7, post: 4, spin: true }, tip: 'Forte = giro de 360°.' },
  spear: { name: 'Lança', combo: 3, l: { dur: 0.42, h0: 0.12, h1: 0.22, range: 100, arc: 0.55, st: 16, lunge: 90, mul: 1, post: 1.2, thrust: true }, h: { dur: 0.8, h0: 0.28, h1: 0.5, range: 112, arc: 0.6, st: 30, dash: 300, mul: 2.0, post: 3, thrust: true }, tip: 'Estocadas de longo alcance. Forte = investida.' },
  hammer: { name: 'Maça', combo: 2, l: { dur: 0.6, h0: 0.26, h1: 0.38, range: 62, arc: 1.9, st: 22, lunge: 80, mul: 1, post: 3.2 }, h: { dur: 1.1, h0: 0.6, h1: 0.72, aoe: 95, st: 42, mul: 1.9, post: 7 }, tip: 'Esmaga a postura. Forte = impacto em área.' },
  katana: { name: 'Katana', combo: 3, l: { dur: 0.32, h0: 0.08, h1: 0.18, range: 66, arc: 2.1, st: 14, lunge: 140, mul: 1, post: 0.9 }, h: { dur: 0.72, h0: 0.28, h1: 0.46, range: 72, arc: 2.2, st: 28, dash: 380, mul: 2.2, post: 3 }, tip: 'Rápida e precisa. Forte = corte iaijutsu atravessando.' },
  bow: { name: 'Arco', combo: 1, ranged: true, l: { dur: 0.45, h0: 0.2, h1: 0.21, st: 12, mul: 1, post: 0.6, proj: { spd: 560, r: 4, arrow: true } }, h: { dur: 0.95, h0: 0.62, h1: 0.63, st: 26, mul: 1.6, post: 2, proj: { spd: 720, r: 5, arrow: true, pierce: true, count: 3 } }, tip: 'À distância. Forte = 3 flechas perfurantes.' },
  staff: { name: 'Catalisador', combo: 1, ranged: true, magic: true, l: { dur: 0.5, h0: 0.22, h1: 0.23, st: 8, mp: 7, mul: 1, post: 0.6, proj: { spd: 430, r: 6, homing: true, col: '#9fd8ff' } }, h: { dur: 1.0, h0: 0.55, h1: 0.56, st: 16, mp: 22, mul: 2.6, post: 4, proj: { spd: 250, r: 13, boom: 80, col: '#c79bff' } }, tip: 'Magia: gasta mana. Leve = flecha de alma teleguiada. Forte = grande orbe explosivo.' },
};
const W_ = (name, type, base, sc, wt, o) => Object.assign({ name, type, base, sc, wt, el: null, elAmt: 0, realm: -1, desc: '' }, o || {});
const WEAPONS = {
  espada_curta: W_('Espada Curta', 'sword', 15, { str: 'D', dex: 'C' }, 3),
  espada_longa: W_('Espada Longa', 'sword', 17, { str: 'C', dex: 'C' }, 4),
  adaga: W_('Adaga', 'dagger', 10, { dex: 'B' }, 1.5),
  espadao: W_('Espadão', 'great', 27, { str: 'B', dex: 'D' }, 10),
  machado: W_('Machado de Batalha', 'axe', 19, { str: 'C' }, 5),
  lanca: W_('Lança', 'spear', 16, { str: 'D', dex: 'C' }, 5),
  maca: W_('Maça', 'hammer', 20, { str: 'B' }, 6),
  katana: W_('Uchigatana', 'katana', 16, { dex: 'B' }, 5, { el: 'sangue', elAmt: 28 }),
  arco: W_('Arco Curto', 'bow', 12, { dex: 'B' }, 2),
  arco_longo: W_('Arco Longo', 'bow', 15, { dex: 'B', str: 'E' }, 4),
  cajado: W_('Cajado de Feiticeiro', 'staff', 15, { int: 'A' }, 3),
  // armas dos reinos (achadas em fases ou deixadas por inimigos)
  xiphos: W_('Xiphos', 'sword', 17, { dex: 'C', str: 'D' }, 3, { realm: 0 }),
  dory: W_('Dory de Hoplita', 'spear', 19, { str: 'C', dex: 'D' }, 6, { realm: 0 }),
  machado_barbado: W_('Machado Barbado', 'axe', 21, { str: 'B' }, 6, { realm: 1 }),
  seax: W_('Seax', 'dagger', 12, { dex: 'B' }, 2, { realm: 1, el: 'gelo', elAmt: 20 }),
  khopesh: W_('Khopesh', 'sword', 18, { str: 'C', dex: 'C' }, 4, { realm: 2 }),
  cetro_was: W_('Cetro Was', 'staff', 17, { int: 'A' }, 3, { realm: 2 }),
  naginata: W_('Naginata', 'spear', 18, { dex: 'B' }, 6, { realm: 3, el: 'sangue', elAmt: 22 }),
  odachi: W_('Ōdachi', 'great', 26, { dex: 'B', str: 'C' }, 9, { realm: 3 }),
  macuahuitl: W_('Macuahuitl', 'sword', 19, { str: 'C', dex: 'C' }, 5, { realm: 4, el: 'sangue', elAmt: 32 }),
  tepoztopilli: W_('Tepoztopilli', 'spear', 18, { str: 'C', dex: 'C' }, 6, { realm: 4 }),
  facao: W_('Facão', 'sword', 17, { dex: 'B' }, 3, { realm: 5 }),
  borduna: W_('Borduna', 'hammer', 22, { str: 'B' }, 6, { realm: 5 }),
  tridente: W_('Tridente Infernal', 'spear', 20, { str: 'C', dex: 'C' }, 6, { realm: 6, el: 'fogo', elAmt: 25 }),
  estrela_manha: W_('Estrela da Manhã', 'hammer', 23, { str: 'B' }, 7, { realm: 6, el: 'sangue', elAmt: 20 }),
  machado_eslavo: W_('Machado Eslavo', 'axe', 21, { str: 'C', dex: 'D' }, 5, { realm: 7 }),
  shashka: W_('Shashka', 'katana', 17, { dex: 'B' }, 4, { realm: 7 }),
};
/* Armas únicas dos chefes (como as armas de alma de Dark Souls). */
const BOSS_W = {
  'Minotauro': ['machado_minotauro', 'Machado Labríntico', 'axe', 30, { str: 'A' }, null, 0, 'O machado de dois gumes do senhor do labirinto.'],
  'Medusa': ['arco_gorgona', 'Arco da Górgona', 'bow', 22, { dex: 'A' }, 'gelo', 40, 'Flechas que endurecem a carne como pedra.'],
  'Hidra de Lerna': ['lanca_hidra', 'Lança de Lerna', 'spear', 24, { dex: 'B', str: 'C' }, 'veneno', 42, 'Embebida no sangue venenoso da Hidra.'],
  'Cérbero': ['presas_cerbero', 'Presas de Cérbero', 'dagger', 18, { dex: 'A' }, 'fogo', 36, 'Três presas, três chamas.'],
  'Fenrir': ['presa_fenrir', 'Presa de Fenrir', 'katana', 24, { dex: 'A' }, 'sangue', 36, 'A presa do lobo que devorará o mundo.'],
  'Surtr': ['espada_surtr', 'Espada de Surtr', 'great', 38, { str: 'A' }, 'fogo', 40, 'A lâmina que incendiará os nove mundos.'],
  'Jörmungandr': ['lamina_jormungandr', 'Lâmina da Serpente do Mundo', 'sword', 25, { dex: 'B', str: 'B' }, 'veneno', 45, 'Forjada de uma escama do oceano vivo.'],
  'Apep': ['cajado_apep', 'Cajado do Caos', 'staff', 24, { int: 'S' }, 'veneno', 30, 'A escuridão que tenta engolir o sol.'],
  'Ammit': ['garras_ammit', 'Garras de Ammit', 'dagger', 19, { dex: 'A', str: 'D' }, 'sangue', 40, 'Devoram corações indignos.'],
  'Esfinge': ['martelo_esfinge', 'Martelo do Enigma', 'hammer', 32, { str: 'A', int: 'C' }, 'raio', 35, 'Quem não responde é esmagado.'],
  'Yamata no Orochi': ['kusanagi', 'Kusanagi', 'katana', 27, { dex: 'S' }, 'raio', 26, 'A espada encontrada na cauda da serpente.'],
  'Gashadokuro': ['odachi_ossos', 'Ōdachi de Ossos', 'great', 34, { str: 'B', dex: 'B' }, 'gelo', 30, 'Ossos dos que morreram de fome.'],
  'Kyūbi no Kitsune': ['cajado_kitsune', 'Cajado de Kitsune-bi', 'staff', 25, { int: 'S' }, 'fogo', 35, 'Fogo-fátuo das nove caudas.'],
  'Cipactli': ['mandibula_cipactli', 'Mandíbula de Cipactli', 'axe', 29, { str: 'A' }, 'sangue', 30, 'Cada dente é uma boca faminta.'],
  'Rainha Tzitzimitl': ['arco_estrelas', 'Arco Devorador de Estrelas', 'bow', 22, { dex: 'A', int: 'C' }, 'raio', 30, 'Dispara estrelas cadentes.'],
  'Guardião do Mictlān': ['lanca_mictlan', 'Lança dos Nove Rios', 'spear', 26, { str: 'B', dex: 'B' }, 'gelo', 35, 'Fria como o caminho dos mortos.'],
  'Boitatá': ['lamina_boitata', 'Lâmina do Boitatá', 'sword', 26, { dex: 'B', int: 'C' }, 'fogo', 45, 'Arde como a cobra de fogo da mata.'],
  'Mapinguari': ['clava_mapinguari', 'Clava do Mapinguari', 'hammer', 35, { str: 'S' }, null, 0, 'Brutalidade pura da floresta.'],
  'Cuca': ['cajado_cuca', 'Cajado da Cuca', 'staff', 25, { int: 'A' }, 'veneno', 40, 'Mexe o caldeirão de feitiços.'],
  'Curupira': ['facao_curupira', 'Facão do Curupira', 'katana', 25, { dex: 'A' }, 'fogo', 30, 'Pune quem fere a mata.'],
  'Anjo Caído': ['espada_arauto', 'Espada do Arauto Banido', 'great', 36, { str: 'B', dex: 'B' }, 'raio', 35, 'Ainda brilha com a luz perdida.'],
  'Leviatã': ['tridente_leviata', 'Tridente do Leviatã', 'spear', 27, { str: 'B', dex: 'B' }, 'gelo', 35, 'Traz o frio das profundezas.'],
  'Beemote': ['chifre_beemote', 'Chifre do Beemote', 'hammer', 38, { str: 'S' }, 'fogo', 25, 'Um chifre usado como clava.'],
  'Koschei': ['agulha_koschei', 'Agulha de Koschei', 'dagger', 21, { dex: 'S' }, 'sangue', 45, 'A agulha onde a morte se escondia.'],
  'Baba Yaga': ['pilao_yaga', 'Pilão de Baba Yaga', 'hammer', 31, { str: 'B', int: 'B' }, 'gelo', 30, 'Ela voava sentada nele.'],
  'Zmei Gorynych': ['espada_zmei', 'Espada-Dragão', 'sword', 27, { str: 'B', dex: 'B' }, 'fogo', 35, 'Três cabeças, três chamas.'],
};
for (const k in BOSS_W) { const [id, name, type, base, sc, el, elAmt, desc] = BOSS_W[k]; WEAPONS[id] = W_(name, type, base, sc, WT[type].ranged ? 3 : type === 'great' || type === 'hammer' ? 9 : 5, { el, elAmt, desc, boss: k }); }
const SHIELDS = {
  escudo_madeira: { name: 'Escudo de Madeira', abs: 0.82, stab: 0.45, wt: 3, parry: 0 },
  broquel: { name: 'Broquel', abs: 0.65, stab: 0.3, wt: 1.5, parry: 0.06 },
  escudo_torre: { name: 'Escudo de Torre', abs: 1, stab: 0.88, wt: 13, parry: -0.05 },
  aspis: { name: 'Aspis de Bronze', abs: 0.92, stab: 0.66, wt: 6, parry: 0, realm: 0 },
  escudo_viking: { name: 'Escudo Redondo Viking', abs: 0.88, stab: 0.56, wt: 4, parry: 0.02, realm: 1 },
  escudo_escaravelho: { name: 'Escudo do Escaravelho', abs: 0.86, stab: 0.5, wt: 3, parry: 0.03, realm: 2 },
  tessen: { name: 'Leque de Ferro', abs: 0.6, stab: 0.35, wt: 1, parry: 0.09, realm: 3 },
  chimalli: { name: 'Chimalli', abs: 0.85, stab: 0.52, wt: 3, parry: 0.02, realm: 4 },
  casco_jabuti: { name: 'Casco de Jabuti', abs: 0.93, stab: 0.62, wt: 5, parry: 0, realm: 5 },
  escudo_infernal: { name: 'Escudo Infernal', abs: 0.95, stab: 0.72, wt: 8, parry: 0, realm: 6 },
  escudo_bogatyr: { name: 'Escudo de Bogatyr', abs: 0.94, stab: 0.68, wt: 7, parry: 0, realm: 7 },
};
const ARMORS = {
  trapos: { name: 'Trapos', def: 0.02, wt: 1, col: '#4a4040' },
  couro: { name: 'Armadura de Couro', def: 0.1, wt: 4, col: '#6a4a2a' },
  malha: { name: 'Cota de Malha', def: 0.17, wt: 8, col: '#7a7a80' },
  cavaleiro: { name: 'Armadura de Cavaleiro', def: 0.25, wt: 14, col: '#9aa0a8', post: 15 },
  placas: { name: 'Placas Pesadas', def: 0.33, wt: 21, col: '#5a5f68', post: 35 },
  manto_feit: { name: 'Manto de Feiticeiro', def: 0.06, wt: 2, col: '#3a2a5a', perk: 'mp' },
  hoplita: { name: 'Couraça de Hoplita', def: 0.2, wt: 10, col: '#b08d57', realm: 0, post: 10 },
  draugr: { name: 'Cota de Draugr', def: 0.22, wt: 12, col: '#5d6a6a', realm: 1, post: 10 },
  linho: { name: 'Linho Real', def: 0.08, wt: 2, col: '#e0d4b0', realm: 2, perk: 'st' },
  samurai: { name: 'Ō-yoroi', def: 0.22, wt: 10, col: '#7a2a2a', realm: 3, post: 15 },
  plumas: { name: 'Manto de Plumas', def: 0.12, wt: 4, col: '#2a8a6a', realm: 4, perk: 'st' },
  gibao: { name: 'Gibão de Couro', def: 0.13, wt: 5, col: '#8a6a3a', realm: 5, perk: 'st' },
  infernal: { name: 'Armadura Infernal', def: 0.3, wt: 18, col: '#3a1a1a', realm: 6, post: 25 },
  bogatyr: { name: 'Armadura de Bogatyr', def: 0.27, wt: 15, col: '#7a7a8a', realm: 7, post: 20 },
};
const PERKS = { mp: 'Mana se recupera 2x mais rápido', st: 'Estamina se recupera 25% mais rápido' };
const RINGS = {
  anel_carvalho: { name: 'Anel do Carvalho', desc: '+15% de vida máxima.' },
  anel_aco: { name: 'Anel de Aço', desc: 'Reduz em 15% o dano recebido.' },
  anel_pena: { name: 'Pena Verde', desc: '+40% de recuperação de estamina.' },
  anel_lobo: { name: 'Anel do Lobo', desc: '+30% de postura máxima.' },
  anel_sangue: { name: 'Anel do Sangue', desc: 'Recupera vida igual a 4% do dano causado.' },
  anel_cobica: { name: 'Serpente da Cobiça', desc: '+30% de almas, mas -10% de defesa.' },
  anel_guerreiro: { name: 'Anel do Guerreiro', desc: '+12% de dano.' },
  anel_aparo: { name: 'Anel do Aparo', desc: 'Janela de aparo perfeito maior.' },
  anel_brasa: { name: 'Anel da Brasa', desc: 'Frascos curam 30% a mais.' },
  anel_gigante: { name: 'Anel do Gigante', desc: '+30% de carga de equipamento.' },
  anel_sabio: { name: 'Anel do Sábio', desc: 'Mana 2x mais rápida e +15% de dano mágico.' },
  anel_sombra: { name: 'Anel da Sombra', desc: 'Ataques pelas costas causam +50% de dano.' },
  anel_estrela: { name: 'Anel Estelar', desc: '+1 frasco de Brasa.' },
};
const ITEMS = {
  bomba: { name: 'Bomba de Fogo', short: 'Bomba', desc: 'Arremessa uma bomba que explode em chamas.' },
  faca: { name: 'Faca de Arremesso', short: 'Faca', desc: 'Lança uma faca rápida no alvo.' },
  resina_fogo: { name: 'Resina de Fogo', short: 'R.Fogo', desc: 'Sua arma causa dano de fogo por 60s.' },
  resina_raio: { name: 'Resina de Raio', short: 'R.Raio', desc: 'Sua arma causa dano de raio por 60s.' },
  resina_gelo: { name: 'Resina de Gelo', short: 'R.Gelo', desc: 'Sua arma causa dano de gelo por 60s.' },
  erva: { name: 'Erva Verde', short: 'Erva', desc: 'Estamina se recupera muito mais rápido por 45s.' },
  cristal: { name: 'Cristal de Mana', short: 'Cristal', desc: 'Restaura 60 de mana.' },
  alma_p: { name: 'Alma de Soldado', short: 'Alma', desc: 'Consuma para ganhar 200 almas.' },
  alma_g: { name: 'Alma de Herói', short: 'Alma+', desc: 'Consuma para ganhar 1500 almas.' },
  osso: { name: 'Osso do Retorno', short: 'Osso', desc: 'Volta para a fogueira sem perder almas. O capítulo recomeça.' },
};
const CLASSES = [
  { id: 'guerreiro', name: 'Guerreiro', desc: 'Equilibrado. Espada longa e escudo de madeira.', at: { vig: 12, end: 11, str: 13, dex: 12, int: 8 }, w: ['espada_longa'], sh: ['escudo_madeira'], ar: ['couro'], it: { bomba: 2 } },
  { id: 'cavaleiro', name: 'Cavaleiro', desc: 'Muita vida e armadura de placas. Lento, mas resistente.', at: { vig: 15, end: 12, str: 12, dex: 10, int: 7 }, w: ['espada_curta'], sh: ['escudo_madeira'], ar: ['cavaleiro'], it: {} },
  { id: 'barbaro', name: 'Bárbaro', desc: 'Força bruta. Machado de batalha e nada de escudo.', at: { vig: 13, end: 11, str: 15, dex: 9, int: 7 }, w: ['machado'], ar: ['couro'], it: { bomba: 3 } },
  { id: 'ladino', name: 'Ladino', desc: 'Ágil e letal pelas costas. Adaga, arco e broquel.', at: { vig: 10, end: 12, str: 9, dex: 15, int: 9 }, w: ['adaga', 'arco'], sh: ['broquel'], ar: ['couro'], it: { faca: 10 } },
  { id: 'samurai', name: 'Samurai', desc: 'Mestre da katana e do aparo.', at: { vig: 11, end: 12, str: 10, dex: 15, int: 7 }, w: ['katana'], ar: ['malha'], rg: ['anel_aparo'], it: {} },
  { id: 'cacador', name: 'Caçador', desc: 'Arco longo para distância e lança para perto.', at: { vig: 11, end: 12, str: 11, dex: 14, int: 7 }, w: ['arco_longo', 'lanca'], ar: ['couro'], it: { faca: 5 } },
  { id: 'feiticeiro', name: 'Feiticeiro', desc: 'Magia à distância com o cajado. Frágil de perto.', at: { vig: 9, end: 10, str: 8, dex: 10, int: 17 }, w: ['cajado', 'adaga'], ar: ['manto_feit'], it: { cristal: 3 } },
];

/* ---------- salvamento (com migração de saves antigos) ---------- */
function giveKit(s, c) {
  for (const id of c.w) s.inv.w.push({ id, up: 0 });
  for (const id of (c.sh || [])) s.inv.sh.push(id);
  for (const id of (c.ar || [])) s.inv.ar.push(id);
  for (const id of (c.rg || [])) s.inv.rg.push(id);
  for (const k in (c.it || {})) s.inv.it[k] = (s.inv.it[k] || 0) + c.it[k];
  s.eq = { w: 0, sh: s.inv.sh.length ? 0 : -1, ar: s.inv.ar.length ? 0 : -1, r1: s.inv.rg.length ? 0 : -1, r2: -1 };
}
function migrate(j) {
  const s = Object.assign(newSave(), j);
  if (!j.v || j.v < 4) {
    s.at = { vig: 10 + (j.vit || 0), end: 10 + (j.end || 0), str: 10 + (j.str || 0), dex: 10, int: 10 };
    s.inv = newSave().inv; giveKit(s, CLASSES[0]); s.cls = 'guerreiro'; s.v = 4;
  }
  if (!s.inv.w.length) s.inv.w.push({ id: 'espada_curta', up: 0 });
  return s;
}
try { const j = JSON.parse(localStorage.getItem(KEY)); if (j) S = migrate(j); } catch (e) { }

/* ---------- atributos derivados ---------- */
const ringHas = id => [S.eq.r1, S.eq.r2].some(i => i >= 0 && S.inv.rg[i] === id);
const curW = () => S.inv.w[S.eq.w] || S.inv.w[0];
const curWD = () => WEAPONS[curW().id];
const curSh = () => S.eq.sh >= 0 ? SHIELDS[S.inv.sh[S.eq.sh]] : null;
const curAr = () => S.eq.ar >= 0 ? ARMORS[S.inv.ar[S.eq.ar]] : null;
const maxHp = () => Math.round((40 + S.at.vig * 7 + Math.max(0, S.at.vig - 10) * 7) * (ringHas('anel_carvalho') ? 1.15 : 1));
const maxSt = () => 50 + S.at.end * 5 + Math.max(0, S.at.end - 10) * 5;
const maxMp = () => 30 + S.at.int * 5;
const maxLoad = () => (30 + S.at.end * 2) * (ringHas('anel_gigante') ? 1.3 : 1);
const maxPost = () => (60 + S.at.end * 2 + S.at.vig * 1.5 + ((curAr() || {}).post || 0)) * (ringHas('anel_lobo') ? 1.3 : 1);
const flaskMax = () => Math.min(3 + Math.floor(S.bosses / 2), 8) + (ringHas('anel_estrela') ? 1 : 0);
const level = () => S.at.vig + S.at.end + S.at.str + S.at.dex + S.at.int - 40;
const lvlCost = () => Math.round(25 * Math.pow(Math.max(1, level() - 8), 1.45) + 50);
const defense = () => clamp(((curAr() || {}).def || 0) + (ringHas('anel_aco') ? 0.15 : 0) - (ringHas('anel_cobica') ? 0.1 : 0), 0, 0.6);
function curLoad() {
  let l = curWD().wt; const sh = curSh(), ar = curAr();
  if (sh) l += sh.wt; if (ar) l += ar.wt; return l;
}
const LOADN = ['Leve', 'Médio', 'Pesado', 'Sobrecarregado'];
function loadClass() { const r = curLoad() / maxLoad(); return r <= 0.3 ? 0 : r <= 0.7 ? 1 : r <= 1 ? 2 : 3; }
const ROLLP = [{ dur: 0.4, spd: 440, if1: 0.36, mv: 1.06 }, { dur: 0.44, spd: 400, if1: 0.34, mv: 1 }, { dur: 0.56, spd: 300, if1: 0.27, mv: 0.88 }, { dur: 0.72, spd: 170, if1: 0.15, mv: 0.62 }];
function wReq(d) { const r = {}; for (const k in d.sc) r[k] = LETREQ[d.sc[k]]; return r; }
function reqOk(d) { const r = wReq(d); for (const k in r) if (S.at[k] < r[k]) return false; return true; }
function weaponAR(wi) {
  const d = WEAPONS[wi.id]; let sc = 0;
  for (const k in d.sc) sc += LET[d.sc[k]] * clamp((S.at[k] - 10) / 40, 0, 1.5);
  let v = d.base * (1 + 0.08 * wi.up) * (1 + sc);
  if (!reqOk(d)) v *= 0.6;
  if (ringHas('anel_guerreiro')) v *= 1.12;
  if (d.type === 'staff' && ringHas('anel_sabio')) v *= 1.15;
  return v;
}
function parryWin() { return 0.2 + ((curSh() || {}).parry || 0) + (ringHas('anel_aparo') ? 0.05 : 0); }
function curEl() {
  if (P && P.buff && P.buff.t > 0) return { k: P.buff.k, amt: 34 };
  const d = curWD(); return d.el ? { k: d.el, amt: d.elAmt } : null;
}
function scText(d) { return Object.keys(d.sc).map(k => STAT_SHORT[k] + ' ' + d.sc[k]).join(' · ') || '—'; }

/* ---------- inventário e loot ---------- */
let notices = [];
function notice(t, col) { notices.push({ t, col: col || '#e8d9b0', life: 3.5 }); if (notices.length > 4) notices.shift(); }
function itemName(kind, id) {
  return kind === 'w' ? WEAPONS[id].name : kind === 'sh' ? SHIELDS[id].name : kind === 'ar' ? ARMORS[id].name : kind === 'rg' ? RINGS[id].name : kind === 'tit' ? 'Fragmento de Titanita' : ITEMS[id].name;
}
function owns(kind, id) { return kind === 'w' ? S.inv.w.some(w => w.id === id) : kind === 'sh' ? S.inv.sh.includes(id) : kind === 'ar' ? S.inv.ar.includes(id) : kind === 'rg' ? S.inv.rg.includes(id) : false; }
function addItem(kind, id, n) {
  n = n || 1;
  if (['w', 'sh', 'ar', 'rg'].includes(kind) && owns(kind, id)) { S.inv.tit += 2; notice(`${itemName(kind, id)} (repetido) → 2 Titanitas`, '#9fd8ff'); persist(); return; }
  if (kind === 'w') S.inv.w.push({ id, up: 0 });
  else if (kind === 'sh') S.inv.sh.push(id);
  else if (kind === 'ar') S.inv.ar.push(id);
  else if (kind === 'rg') S.inv.rg.push(id);
  else if (kind === 'tit') S.inv.tit += n;
  else S.inv.it[id] = (S.inv.it[id] || 0) + n;
  const rare = ['w', 'sh', 'ar', 'rg'].includes(kind);
  notice('Obtido: ' + itemName(kind, id) + (n > 1 ? ' x' + n : ''), rare ? '#ffd166' : '#e8d9b0');
  if (rare) sfx('gate');
  persist();
}
function wpick(list, r) { let t = 0; for (const x of list) t += x[1]; let v = (r || R)() * t; for (const x of list) { v -= x[1]; if (v <= 0) return x[0]; } return list[0][0]; }
const CONSUMABLE_DROPS = [['tit', 34], ['bomba', 12], ['faca', 14], ['alma_p', 14], ['erva', 8], ['cristal', 7], ['resina_fogo', 4], ['resina_raio', 3], ['resina_gelo', 3], ['osso', 2]];
function realmGear(ri) {
  const out = [];
  for (const k in WEAPONS) if (WEAPONS[k].realm === ri) out.push(['w', k]);
  for (const k in SHIELDS) if (SHIELDS[k].realm === ri) out.push(['sh', k]);
  for (const k in ARMORS) if (ARMORS[k].realm === ri) out.push(['ar', k]);
  return out;
}
function randomLoot(rng, ri, rich) {
  const r = rng();
  if (r < (rich ? 0.3 : 0.04)) { const g = realmGear(ri).filter(x => !owns(x[0], x[1])); if (g.length) { const x = pick(g, rng); return { kind: x[0], id: x[1], n: 1 }; } }
  if (rich && r < 0.4) { const rg = Object.keys(RINGS).filter(k => !owns('rg', k)); if (rg.length) return { kind: 'rg', id: pick(rg, rng), n: 1 }; }
  const id = wpick(CONSUMABLE_DROPS, rng);
  return id === 'tit' ? { kind: 'tit', id: 'tit', n: rich ? 2 : 1 } : { kind: 'it', id, n: rich ? 2 + Math.floor(rng() * 2) : 1 };
}
function dropLoot(x, y, item) { world.loot.push({ x, y, item, ph: R() * TAU }); }
function realmIndex(n) { return Math.floor((n - 1) / 3) % REALMS.length; }

/* ---------- estado ---------- */
let state = 'menu', P = null, world = null;
let enemies = [], bosses = [], projs = [], hazards = [], parts = [], floats = [];
let cam = { x: 0, y: 0 }, shake = 0, hitstop = 0, flash = 0, banner = null, msg = null, lockT = null;
let stageT = 0, deadT = 0, victoryT = 0, gtime = 0, bonfireFrom = 'death', confirmNew = 0, menuPage = 'main';
let uiButtons = [];

/* ---------- entrada ---------- */
const keys = {};
window.addEventListener('keydown', e => {
  initAudio();
  if (!keys[e.code]) {
    keys[e.code] = true;
    const m = { KeyJ: 'atk', KeyZ: 'atk', KeyK: 'heavy', KeyX: 'heavy', Space: 'roll', KeyL: 'roll', ShiftLeft: 'roll', KeyE: 'heal', KeyH: 'heal', KeyQ: 'lock', Tab: 'lock', KeyI: 'guard', KeyC: 'guard', ShiftRight: 'guard', KeyR: 'item', KeyF: 'cycle', KeyB: 'inv', Escape: 'pause', KeyP: 'pause' };
    if (m[e.code]) act(m[e.code]);
    if (e.code === 'Enter' && uiButtons.length) { uiButtons[0].fn(); }
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const btnHeld = {};
function ctrlButtons() {
  const s = clamp(H / 420, 0.8, 1.2);
  return [
    { id: 'atk', label: 'ATAQUE', x: W - 88 * s, y: H - 86 * s, r: 44 * s },
    { id: 'guard', label: 'DEFESA', x: W - 200 * s, y: H - 150 * s, r: 38 * s },
    { id: 'roll', label: 'ROLAR', x: W - 200 * s, y: H - 52 * s, r: 33 * s },
    { id: 'heavy', label: 'FORTE', x: W - 78 * s, y: H - 196 * s, r: 33 * s },
    { id: 'heal', label: 'CURA', x: W - 172 * s, y: H - 246 * s, r: 26 * s },
    { id: 'lock', label: 'MIRA', x: W - 52 * s, y: H - 284 * s, r: 24 * s },
    { id: 'item', label: 'ITEM', x: W - 296 * s, y: H - 56 * s, r: 28 * s },
    { id: 'cycle', label: '⇄', x: W - 296 * s, y: H - 118 * s, r: 19 * s },
  ];
}
function pointerDown(id, x, y) {
  initAudio();
  if (state !== 'play') {
    for (const b of uiButtons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { sfx('ui'); b.fn(); return; }
    return;
  }
  if (P && P.dead) { if (deadT > 2.2) { goBonfire('death'); } return; }
  if (x > W - 64 && y < 56) { togglePause(); return; }
  for (const b of ctrlButtons()) if (hyp(x - b.x, y - b.y) < b.r * 1.25) { btnHeld[b.id] = id; act(b.id); return; }
  if (x < W * 0.55 && joy.id === null) { joy.id = id; joy.ox = x; joy.oy = y; joy.x = x; joy.y = y; }
}
function pointerMove(id, x, y) { if (joy.id === id) { joy.x = x; joy.y = y; } }
function pointerUp(id) { if (joy.id === id) joy.id = null; for (const k in btnHeld) if (btnHeld[k] === id) delete btnHeld[k]; }
cvs.addEventListener('touchstart', e => { e.preventDefault(); for (const t of e.changedTouches) pointerDown(t.identifier, t.clientX, t.clientY); }, { passive: false });
cvs.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) pointerMove(t.identifier, t.clientX, t.clientY); }, { passive: false });
cvs.addEventListener('touchend', e => { e.preventDefault(); for (const t of e.changedTouches) pointerUp(t.identifier); }, { passive: false });
cvs.addEventListener('touchcancel', e => { for (const t of e.changedTouches) pointerUp(t.identifier); });
let mouseDown = false;
cvs.addEventListener('mousedown', e => { mouseDown = true; pointerDown('m', e.clientX, e.clientY); });
window.addEventListener('mousemove', e => { if (mouseDown) pointerMove('m', e.clientX, e.clientY); });
window.addEventListener('mouseup', () => { mouseDown = false; pointerUp('m'); });

function act(n) {
  if (n === 'pause') { if (state === 'inv') { closeInv(); return; } if (state === 'play' || state === 'pause') togglePause(); return; }
  if (n === 'inv' && state === 'inv') { closeInv(); return; }
  if (state !== 'play' || !P || P.dead) return;
  if (n === 'lock') { toggleLock(); return; }
  if (n === 'cycle') { cycleItem(); return; }
  if (n === 'inv') { openInv('play'); return; }
  P.buf = { n, t: 0.3 };
}
function togglePause() { if (state === 'play') { if (!P.dead && victoryT <= 0) state = 'pause'; } else if (state === 'pause') state = 'play'; }
function moveInput() {
  let mx = 0, my = 0;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (keys.KeyW || keys.ArrowUp) my -= 1; if (keys.KeyS || keys.ArrowDown) my += 1;
  if (joy.id !== null) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = hyp(dx, dy), m = 55;
    if (d > 6) { mx = dx / Math.max(d, m); my = dy / Math.max(d, m); }
  }
  const l = hyp(mx, my); if (l > 1) { mx /= l; my /= l; }
  return [mx, my];
}

/* ---------- geração de fases ---------- */
function newPlayer() {
  return { x: 0, y: 0, r: 13, hp: maxHp(), st: maxSt(), face: -PI / 2, act: null, iframe: 0, stDelay: 0, flasks: flaskMax(), mp: maxMp(), buff: null, erva: 0, buf: null, dead: false, post: 0, postT: 0, lastGuard: -9, stag: 0, kvx: 0, vky: 0, kvy: 0, hpTrail: maxHp() };
}
function buildStage(n) {
  const rng = mulberry32(n * 7919 + 13);
  const isBoss = n % 3 === 0;
    const w = isBoss ? 1150 : 1250 + Math.min(n * 45, 950), h = isBoss ? 980 : 1000 + Math.min(n * 35, 700);
  world = { n, w, h, isBoss, biome: realmOf(n), obs: [], exit: { x: w / 2, y: 56, r: 40 }, open: false, stain: null, decals: [], loot: [] };
  enemies = []; bosses = []; projs = []; hazards = []; floats = []; parts = parts.filter(p => p.type === 'ember');
  lockT = null; stageT = 0; victoryT = 0;
  if (isBoss) {
    const cx = w / 2, cy = h / 2 - 20;
    for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; world.obs.push({ x: cx + cos(a) * 330, y: cy + sin(a) * 260, r: 32, kind: world.biome.obsKind[0], ph: i }); }
  } else {
    const cnt = Math.min(6 + Math.floor(n / 2), 22); let tries = 0;
    while (world.obs.length < cnt && tries++ < 600) {
      const r = 22 + rng() * 42, x = 80 + rng() * (w - 160), y = 150 + rng() * (h - 320);
      if (hyp(x - w / 2, y - (h - 90)) < 170 || hyp(x - w / 2, y - 56) < 130) continue;
      if (world.obs.some(o => hyp(o.x - x, o.y - y) < o.r + r + 75)) continue;
      world.obs.push({ x, y, r, kind: pick(world.biome.obsKind, rng), ph: rng() * TAU });
    }
    const cntE = Math.min(3 + Math.floor(n * 0.85), 18);
    const pool = ['hollow', 'hollow', 'hollow'];
    if (n >= 2) pool.push('hound', 'archer'); if (n >= 4) pool.push('knight', 'hollow'); if (n >= 5) pool.push('caster', 'hound');
    if (n >= 7) pool.push('brute', 'knight', 'archer'); if (n >= 11) pool.push('brute', 'caster');
    for (let i = 0; i < cntE; i++) {
      const type = pick(pool, rng); let x, y, ok = false, t2 = 0;
      while (!ok && t2++ < 80) { x = 60 + rng() * (w - 120); y = 90 + rng() * (h - 380); ok = !world.obs.some(o => hyp(o.x - x, o.y - y) < o.r + 30); }
      const en = makeEnemy(type, x, y, n); enemies.push(en); moveEnt(en, 0, 0);
    }
    const spots = 1 + (rng() < 0.55 ? 1 : 0);
    for (let i = 0; i < spots; i++) {
      let x, y, ok = false, t2 = 0;
      while (!ok && t2++ < 80) { x = 80 + rng() * (w - 160); y = 100 + rng() * (h - 300); ok = !world.obs.some(o => hyp(o.x - x, o.y - y) < o.r + 30); }
      const item = randomLoot(rng, realmIndex(n), true), key = n + ':' + i;
      if (!S.picked[key]) world.loot.push({ x, y, item, ph: rng() * TAU, spot: key });
    }
  }
  for (let i = 0; i < 40; i++) world.decals.push({ x: rng() * w, y: rng() * h, r: 4 + rng() * 14, a: rng() * TAU, k: Math.floor(rng() * 3) });
  if (isBoss) bosses = makeBosses(n, rng);
  if (S.lost && S.lost.stage === n) world.stain = { x: S.lost.x, y: S.lost.y, amount: S.lost.amount };
  if (!P) P = newPlayer();
  P.x = w / 2; P.y = h - 90; P.face = -PI / 2; P.act = null; P.stag = 0; P.buf = null;
  cam.x = P.x - W / SC / 2; cam.y = P.y - H / SC / 2;
  banner = { text: isBoss ? `Fase ${n} · Covil do Chefe` : `Fase ${n}`, sub: `${world.biome.name} — ${world.biome.myth}`, t: 3.2, col: '#e8d9b0' };
  if (n === 1) msg = { text: 'Toque DEFESA no instante do golpe dourado para APARAR', t: 5, col: '#ffd166' };
  S.stage = n; S.started = true; S.best = Math.max(S.best, n); persist();
}
function skinOf(type) {
  const sk = (world && world.biome.skins[type]) || { name: ETYPES[type].name, col: ETYPES[type].col, deco: [] };
  const deco = {}; for (const k of sk.deco) deco[k] = k === 'tails' ? 2 : 1;
  return { name: sk.name, col: sk.col, deco };
}
function makeEnemy(type, x, y, n, minion) {
  const d = ETYPES[type], hf = 1 + (n - 1) * 0.13, df = 1 + (n - 1) * 0.07;
  return { type, d, x, y, r: d.r, hp: d.hp * hf, mhp: d.hp * hf, dmg: d.dmg * df, spd: d.spd * (1 + Math.min(n * 0.01, 0.3)),
    st: 'idle', t: 0, cd: rnd(0.3, 1.2), face: R() * TAU, stag: 0, aggro: !!minion, souls: minion ? 5 : Math.round(d.souls * (1 + (n - 1) * 0.3)),
    flash: 0, minion: !!minion, wob: R() * TAU, broken: 0, post: 0, mpost: d.post * (1 + (n - 1) * 0.04), postT: 0, ...skinOf(type) };
}

/* ---------- chefes ---------- */
const ALL_ATK = ['combo', 'cleave', 'charge', 'slam', 'shockwave', 'leap', 'volley', 'spiral', 'meteor', 'teleport', 'summon', 'sweep', 'pounce', 'roar', 'spikes', 'breath', 'beam', 'dashslash'];
const ATK_NAME_DESC = {};
const HUES = [['#a9b0b8', '#5b2a2a'], ['#7b3fa0', '#d6a2ff'], ['#b84a3a', '#ffd27a'], ['#3a6b8f', '#9fe3ff'], ['#4a4a4a', '#ff3a5c'], ['#c9b26b', '#fff1b8'], ['#2f5a3a', '#b3ff8a']];
const PREFIX = ['Renascido', 'Ancestral', 'Profano', 'Eterno', 'Corrompido', 'Primevo'];
function makeBosses(n, rng) {
  const idx = n / 3 - 1, cycle = Math.floor(idx / REALMS.length), realm = realmOf(n);
  const arch = realm.bosses[cycle % realm.bosses.length];
  const repeat = cycle >= realm.bosses.length;
  const mods = [];
  if (cycle >= 1) {
    const pool = ['colossal', 'veloz', 'ardente', 'sombrio', 'gemeos'];
    const k = Math.min((rng() < 0.6 ? 1 : 0) + (cycle >= 2 && rng() < 0.5 ? 1 : 0) + (cycle >= 3 ? 1 : 0), 3);
    while (mods.length < k) { const m = pick(pool, rng); if (!mods.includes(m)) mods.push(m); }
  } else if (idx >= 4 && rng() < 0.35) mods.push(pick(['ardente', 'veloz'], rng));
  const attacks = arch.attacks.slice(), p2 = arch.p2.slice();
  if (cycle >= 2) { let a; do { a = pick(ALL_ATK, rng); } while (attacks.includes(a) || p2.includes(a)); p2.push(a); }
  if (cycle >= 3) { let a; do { a = pick(ALL_ATK, rng); } while (attacks.includes(a) || p2.includes(a)); attacks.push(a); }
  if (mods.includes('sombrio') && !attacks.includes('teleport')) attacks.push('teleport');
  const title = (repeat ? pick(PREFIX, rng) + ' ' : '') + arch.name;
  const hue = repeat ? pick(HUES, rng) : [arch.col, arch.col2];
  const twins = mods.includes('gemeos');
  const hf = 1 + (n - 1) * 0.17, df = 1 + (n - 1) * 0.075;
  const list = [], count = twins ? 2 : 1;
  for (let i = 0; i < count; i++) {
    let r = arch.r, hp = arch.hp * hf, sp = 1;
    if (mods.includes('colossal')) { r *= 1.4; hp *= 1.5; sp *= 0.88; }
    if (mods.includes('veloz')) sp *= 1.28;
    if (twins) { hp *= 0.62; r *= 0.85; }
    const b = {
      isBoss: true, arch, shape: arch.shape, deco: arch.deco, title, name: title + (twins ? (i ? ' II' : ' I') : ''), epi: arch.epi,
      x: world.w / 2 + (twins ? (i ? 140 : -140) : 0), y: world.h / 3, r, hp, mhp: hp, dmg: 22 * df, sp, spd: 95,
      attacks: attacks.slice(), p2atk: p2, p2: false, act: null, idle: 1.4 + i * 0.7, face: PI / 2, post: 0, mpost: 22 + n * 0.35, postT: 0,
      broken: 0, flash: 0, awake: false, mods, col: i ? shadeHex(hue[0], -25) : hue[0], col2: hue[1], air: false, alpha: 1, strafe: R() < 0.5 ? 1 : -1,
      souls: Math.round(380 * (1 + (n - 1) * 0.35) / count), segs: [], last: null, minionType: arch.minion, glow: 0, wob: 0,
    };
    for (let k = 0; k < 7; k++) b.segs.push({ x: b.x, y: b.y - k * 10 });
    list.push(b);
  }
  return list;
}
function shadeHex(h, a) {
  const n = parseInt(h.slice(1), 16); const c = v => clamp(v + a, 0, 255);
  return '#' + ((1 << 24) + (c(n >> 16) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255)).toString(16).slice(1);
}
const MODNAME = { colossal: 'Colossal', veloz: 'Veloz', ardente: 'Ardente', sombrio: 'Sombrio', gemeos: 'Gêmeos' };

/* ---------- física ---------- */
function moveEnt(e, dx, dy) {
  e.x += dx; e.y += dy; let col = false;
  for (const o of world.obs) {
    const ddx = e.x - o.x, ddy = e.y - o.y, d = hyp(ddx, ddy), m = o.r + e.r;
    if (d < m && d > 0.001) { e.x = o.x + ddx / d * m; e.y = o.y + ddy / d * m; col = true; }
  }
  const pad = 22;
  if (e.x < pad + e.r) { e.x = pad + e.r; col = true; } if (e.x > world.w - pad - e.r) { e.x = world.w - pad - e.r; col = true; }
  if (e.y < pad + e.r) { e.y = pad + e.r; col = true; } if (e.y > world.h - pad - e.r) { e.y = world.h - pad - e.r; col = true; }
  return col;
}
function separate() {
  const all = enemies.concat(bosses.filter(b => !b.air));
  for (const e of all) {
    const dx = P.x - e.x, dy = P.y - e.y, d = hyp(dx, dy), m = P.r + e.r;
    if (d < m && d > 0.01 && !P.dead) {
      const push = m - d;
      if (e.isBoss || (e.d && e.d.poise)) moveEnt(P, dx / d * push, dy / d * push);
      else { moveEnt(P, dx / d * push * 0.6, dy / d * push * 0.6); moveEnt(e, -dx / d * push * 0.4, -dy / d * push * 0.4); }
    }
  }
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), m = a.r + b.r;
    if (d < m && d > 0.01) { const p = (m - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
  }
}

/* ---------- perigos (ataques telegrafados) ---------- */
function addHaz(o) {
  const blk = !o.tick && !o.unblock && (o.shape === 'cone' || o.shape === 'rect');
  const h = Object.assign({ t: 0, delay: 0.5, active: 0.1, dmg: 10, col: blk ? '255,190,60' : '255,60,40', blk, owner: null, hit: false, fired: false, kb: 170, tk: 0 }, o);
  hazards.push(h); return h;
}
function hazHits(h, x, y, r) {
  switch (h.shape) {
    case 'circle': return hyp(x - h.x, y - h.y) < h.r + r;
    case 'ring': { const d = hyp(x - h.x, y - h.y); return d + r > h.r0 && d - r < h.r1; }
    case 'cone': {
      const d = hyp(x - h.x, y - h.y); if (d > h.range + r) return false; if (d < r + 6) return true;
      return Math.abs(angDiff(h.ang, atan2(y - h.y, x - h.x))) < h.arc / 2 + Math.asin(Math.min(1, r / d));
    }
    case 'rect': {
      const c = cos(h.ang), s = sin(h.ang), lx = (x - h.x) * c + (y - h.y) * s, ly = -(x - h.x) * s + (y - h.y) * c;
      return lx > -r && lx < h.len + r && Math.abs(ly) < h.wid / 2 + r;
    }
  }
  return false;
}
function cancelHaz(owner) { hazards = hazards.filter(h => h.owner !== owner || h.t >= h.delay); }
function updHaz(dt) {
  for (const h of hazards) {
    h.t += dt;
    if (h.t >= h.delay) {
      if (!h.fired) {
        h.fired = true;
        if (h.boom) { shake = Math.max(shake, h.boom); sfx('boom'); burst(h.x, h.y, 14, h.fx || '#c9a96e', 220, 'dust'); }
        if (h.onFire) h.onFire(h);
      }
      const at = h.t - h.delay;
      if (at <= h.active && !P.dead) {
        if (h.tick) { h.tk -= dt; if (h.tk <= 0 && hazHits(h, P.x, P.y, P.r)) { if (hurtPlayer(h.dmg, h.x, h.y, 40, true)) h.tk = h.tick; } }
        else if (!h.hit && hazHits(h, P.x, P.y, P.r)) { if (hurtPlayer(h.dmg, h.owner && h.owner.hp > 0 && h.shape !== 'rect' ? h.owner.x : h.x, h.owner && h.owner.hp > 0 && h.shape !== 'rect' ? h.owner.y : h.y, h.kb, false, { block: h.blk, owner: h.owner })) h.hit = true; }
      }
    }
  }
  hazards = hazards.filter(h => h.t < h.delay + h.active + 0.18);
}

/* ---------- projéteis ---------- */
function shoot(x, y, ang, spd, o) {
  projs.push(Object.assign({ x, y, vx: cos(ang) * spd, vy: sin(ang) * spd, r: 7, dmg: 12, life: 4, col: '#c77dff', trail: [] }, o));
}
function updProj(dt) {
  for (const p of projs) {
    p.trail.push(p.x, p.y); if (p.trail.length > 10) p.trail.splice(0, 2);
    if (p.friendly) { updFriendly(p, dt); continue; }
    if (p.accel) { p.vx *= 1 + p.accel * dt; p.vy *= 1 + p.accel * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < 0 || p.y < 0 || p.x > world.w || p.y > world.h) p.life = 0;
    if (!p.ghost) for (const o of world.obs) if (hyp(p.x - o.x, p.y - o.y) < o.r + p.r) { p.life = 0; burst(p.x, p.y, 5, p.col, 90, 'spark'); }
    if (p.life > 0 && !P.dead && hyp(p.x - P.x, p.y - P.y) < p.r + P.r) {
      if (hurtPlayer(p.dmg, p.x - p.vx, p.y - p.vy, 110, false, { block: true, owner: null })) { p.life = 0; burst(p.x, p.y, 8, p.col, 120, 'spark'); }
    }
  }
  projs = projs.filter(p => p.life > 0);
}

/* ---------- partículas ---------- */
function burst(x, y, n, col, spd, type) {
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, s = R() * spd;
    parts.push({ x, y, vx: cos(a) * s, vy: sin(a) * s, life: rnd(0.3, 0.7), ml: 0.7, col, sz: rnd(1.5, 3.5), type: type || 'spark' });
  }
}
function soulsTo(x, y, n) { for (let i = 0; i < n; i++) { const a = R() * TAU, s = rnd(40, 160); parts.push({ x, y, vx: cos(a) * s, vy: sin(a) * s, life: 2.5, ml: 2.5, col: '#9fe7c9', sz: rnd(2, 3.5), type: 'soul', d: rnd(0.2, 0.5) }); } }
function updParts(dt) {
  for (const p of parts) {
    p.life -= dt;
    if (p.type === 'soul' && P) {
      p.d -= dt;
      if (p.d <= 0) { const dx = P.x - p.x, dy = P.y - p.y, d = hyp(dx, dy); p.vx += dx / d * 1400 * dt; p.vy += dy / d * 1400 * dt; p.vx *= 0.92; p.vy *= 0.92; if (d < 14) { p.life = 0; if (R() < 0.3) sfx('soul'); } }
    } else if (p.type === 'ember') { p.vx += sin(gtime * 2 + p.sz * 9) * 6 * dt; }
    else { p.vx *= 0.9; p.vy *= 0.9; }
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  parts = parts.filter(p => p.life > 0);
  if (parts.length > 900) parts.splice(0, parts.length - 900);
}
function floatTxt(x, y, txt, col, sz) { floats.push({ x, y, txt, col, life: 1, sz: sz || 13 }); }

/* ---------- jogador ---------- */
function invuln(p) { return p.iframe > 0 || (p.act && p.act.type === 'roll' && p.act.t > 0.02 && p.act.t < p.act.if1); }
const STATS = { deflects: 0, blocks: 0, deathblows: 0, guardBreaks: 0 };
function guardResult(dmg, sx, sy, owner) {
  const g = P.act;
  if (!g || g.type !== 'guard') return null;
  if (Math.abs(angDiff(P.face, atan2(sy - P.y, sx - P.x))) > 1.9) return null;
  const mx = (P.x + sx) / 2, my = (P.y + sy) / 2, ax = P.x + cos(P.face) * 14, ay = P.y + sin(P.face) * 14;
  if (g.t <= g.win) {
    // APARO PERFEITO
    STATS.deflects++; sfx('deflect'); hitstop = Math.max(hitstop, 0.07); shake = Math.max(shake, 4);
    burst(ax, ay, 16, '#ffd166', 260, 'spark'); burst(ax, ay, 6, '#ffffff', 160, 'spark');
    floatTxt(ax, ay - 16, 'APARADO', '#ffd166', 12);
    P.post += dmg * 0.18; P.postT = 0.6; g.deflected = true; P.lastGuard = -9;
    if (owner && owner.hp > 0) {
      addPosture(owner, owner.isBoss ? 3 + dmg * 0.04 : 3.2);
      if (!owner.isBoss && owner.broken <= 0) { owner.stag = owner.d.poise ? 0.3 : 0.55; owner.st = 'idle'; cancelHaz(owner); }
    }
  } else {
    // BLOQUEIO
    STATS.blocks++; sfx('block'); shake = Math.max(shake, 3);
    burst(ax, ay, 8, '#d8d8e8', 140, 'spark');
    const sh = curSh() || { abs: 0.55, stab: 0.2 };
    const chip = Math.round(dmg * (1 - sh.abs)); P.hp -= chip; if (chip > 0) floatTxt(P.x, P.y - 20, '-' + chip, '#ff9b9b', 11);
    P.post += dmg * (1.25 - sh.stab); P.postT = 1.0;
    const a = atan2(P.y - sy, P.x - sx); moveEnt(P, cos(a) * 8, sin(a) * 8);
    if (P.hp <= 0) { die(); return true; }
  }
  if (P.post >= maxPost()) {
    STATS.guardBreaks++; P.post = maxPost() * 0.35; P.act = null; P.stag = 1.1; P.kvx = 0; P.kvy = 0;
    msg = { text: 'Sua postura foi quebrada!', t: 1.6, col: '#ff6b6b' }; sfx('hurt'); flash = 0.25; shake = 10;
    burst(P.x, P.y, 20, '#ffd166', 200, 'spark');
  }
  P.iframe = Math.max(P.iframe, 0.08);
  return true;
}
function addPosture(e, v) {
  if (e.broken > 0) return;
  e.post += v; e.postT = 1.6;
  if (e.post >= e.mpost) {
    e.post = e.mpost; e.broken = e.isBoss ? 3.0 : 2.6; cancelHaz(e);
    if (e.isBoss) { e.act = null; e.air = false; e.alpha = 1; } else { e.st = 'idle'; e.stag = 0; }
    msg = { text: 'POSTURA QUEBRADA — GOLPE FATAL!', t: 1.8, col: '#ff4a4a' }; sfx('parry');
    burst(e.x, e.y, 24, '#ffd166', 220, 'spark');
  }
}
function hurtPlayer(dmg, sx, sy, kb, noStag, src) {
  if (P.dead || invuln(P)) return false;
  dmg *= 1 - defense();
  if (src && src.block) { const g = guardResult(dmg, sx, sy, src.owner); if (g) return true; }
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg; P.iframe = noStag ? 0.18 : 0.5; flash = 0.35; shake = Math.max(shake, noStag ? 3 : 9);
  floatTxt(P.x, P.y - 20, '-' + dmg, '#ff6b6b', 14); burst(P.x, P.y, 10, '#b3202a', 160, 'spark');
  if (!noStag) {
    sfx('hurt'); P.stag = 0.3; if (P.act && P.act.type !== 'roll') P.act = null;
    const a = atan2(P.y - sy, P.x - sx); P.kvx = cos(a) * (kb || 160); P.kvy = sin(a) * (kb || 160);
  }
  if (P.hp <= 0) die();
  return true;
}
function die() {
  P.hp = 0; P.dead = true; P.act = null; deadT = 0; sfx('death'); shake = 12;
  burst(P.x, P.y, 40, '#7a0f16', 200, 'spark');
  S.deaths++;
  S.lost = S.souls > 0 ? { stage: world.n, x: P.x, y: P.y, amount: S.souls } : S.lost;
  S.souls = 0; S.stage = S.checkpoint; persist();
}
function nearestTarget(range, maxAng) {
  let best = null, bd = range;
  for (const e of enemies.concat(bosses)) {
    if (e.air || e.hp <= 0) continue;
    const d = hyp(e.x - P.x, e.y - P.y) - e.r;
    if (maxAng !== undefined && Math.abs(angDiff(P.face, atan2(e.y - P.y, e.x - P.x))) > maxAng) continue;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function toggleLock() {
  if (lockT) { lockT = null; return; }
  lockT = nearestTarget(520); if (lockT) sfx('ui');
}
const guardHeld = () => !!(keys.KeyI || keys.KeyC || keys.ShiftRight || btnHeld.guard !== undefined);
function startAct(n, mx, my) {
  const p = P, ml = hyp(mx, my);
  const aim = () => {
    if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
    else if (ml > 0.25) p.face = atan2(my, mx);
    else { const t = nearestTarget(150); if (t) p.face = atan2(t.y - p.y, t.x - p.x); }
  };
  if (n === 'atk' || n === 'heavy') {
    if (p.st <= 0) return false;
    const heavy = n === 'heavy', wi = curW(), wd = WEAPONS[wi.id], tp = WT[wd.type], mv = heavy ? tp.h : tp.l;
    if (mv.mp && p.mp < mv.mp) { msg = { text: 'Mana insuficiente', t: 1.2, col: '#9fd8ff' }; return true; }
    if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
    else if (ml > 0.25) p.face = atan2(my, mx);
    else { const t = nearestTarget(tp.ranged ? 520 : 150); if (t) p.face = atan2(t.y - p.y, t.x - p.x); }
    const combo = heavy ? 0 : (p.combo || 0) % tp.combo;
    p.act = { type: heavy ? 'heavy' : 'atk', t: 0, dur: mv.dur, h0: mv.h0, h1: mv.h1, range: mv.range || 0, arc: mv.arc || 0, aoe: mv.aoe, spin: mv.spin, dash: mv.dash,
      lunge: mv.lunge || 0, thrust: mv.thrust, proj: mv.proj, dmg: weaponAR(wi) * mv.mul, poise: mv.post, hit: new Set(), combo, wtype: wd.type, el: curEl(), back: tp.back || 2.2 };
    if (!heavy && tp.combo > 1 && combo === tp.combo - 1) { p.act.dmg *= 1.3; p.act.poise *= 1.5; p.act.range += 6; }
    p.st -= mv.st; if (mv.mp) p.mp -= mv.mp; p.stDelay = 0.55;
    p.combo = heavy ? 0 : (combo + 1) % tp.combo;
    return true;
  }
  if (n === 'item') {
    const id = quickItem(); if (!id) { msg = { text: 'Nenhum item no atalho', t: 1.2 }; return true; }
    p.act = { type: 'item', t: 0, dur: 0.55, id, done: false }; return true;
  }
  if (n === 'roll') {
    if (p.st <= 0) return false;
    let dx = mx, dy = my;
    if (ml < 0.2) { dx = cos(p.face); dy = sin(p.face); } else { dx /= ml; dy /= ml; }
    const rp = ROLLP[loadClass()];
    p.act = { type: 'roll', t: 0, dur: rp.dur, spd: rp.spd, if1: rp.if1, dx, dy }; p.st -= 22; p.stDelay = 0.55; p.combo = 0; sfx('roll');
    return true;
  }
  if (n === 'guard') {
    const spam = gtime - p.lastGuard < 0.55;
    p.act = { type: 'guard', t: 0, win: spam ? 0.09 : parryWin(), dur: 1e9 }; p.lastGuard = gtime; p.combo = 0;
    if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
    else if (ml > 0.25) p.face = atan2(my, mx);
    else { const t = nearestTarget(220); if (t) p.face = atan2(t.y - p.y, t.x - p.x); }
    return true;
  }
  if (n === 'heal') {
    if (p.flasks <= 0) { msg = { text: 'Sem frascos de Brasa', t: 1.5 }; return true; }
    if (p.hp >= maxHp()) { msg = { text: 'Vida cheia', t: 1 }; return true; }
    p.flasks--; p.act = { type: 'heal', t: 0, dur: 1.0, done: false };
    return true;
  }
  return true;
}
function updPlayer(dt) {
  const p = P; if (p.dead) return;
  p.iframe -= dt; p.stDelay -= dt;
  const LC = loadClass(), AR_ = curAr() || {};
  if (p.buff && p.buff.t > 0) { p.buff.t -= dt; if (p.buff.t <= 0) p.buff = null; }
  if (p.erva > 0) p.erva -= dt;
  const stR = 62 * (ringHas('anel_pena') ? 1.4 : 1) * (p.erva > 0 ? 1.8 : 1) * (AR_.perk === 'st' ? 1.25 : 1) * [1, 1, 0.85, 0.7][LC];
  if (p.stDelay <= 0 && (!p.act || p.act.type === 'heal' || p.act.type === 'item')) p.st = Math.min(maxSt(), p.st + stR * dt);
  p.mp = Math.min(maxMp(), p.mp + 1.5 * (AR_.perk === 'mp' ? 2 : 1) * (ringHas('anel_sabio') ? 2 : 1) * dt);
  p.hpTrail += (p.hp - p.hpTrail) * Math.min(1, dt * 2.5);
  p.postT -= dt; if (p.postT <= 0) p.post = Math.max(0, p.post - (p.act && p.act.type === 'guard' ? 34 : 20) * (0.4 + 0.6 * p.hp / maxHp()) * dt);
  if (p.buf) { p.buf.t -= dt; if (p.buf.t <= 0) p.buf = null; }
  const [mx, my] = moveInput(), ml = hyp(mx, my);
  if (lockT && (lockT.hp <= 0 || hyp(lockT.x - p.x, lockT.y - p.y) > 650 || (!enemies.includes(lockT) && !bosses.includes(lockT)))) lockT = null;
  if (p.stag > 0) { p.stag -= dt; moveEnt(p, p.kvx * dt, p.kvy * dt); p.kvx *= 0.88; p.kvy *= 0.88; return; }
  const a = p.act;
  if (a) {
    a.t += dt;
    if (a.type === 'atk' || a.type === 'heavy') {
      if (a.dash && a.t >= a.h0 - 0.06 && a.t <= a.h1) moveEnt(p, cos(p.face) * a.dash * dt, sin(p.face) * a.dash * dt);
      else if (a.lunge && a.t < a.h1) moveEnt(p, cos(p.face) * a.lunge * dt, sin(p.face) * a.lunge * dt);
      if (a.t >= a.h0 && !a.sw) {
        a.sw = true; sfx(a.proj ? (WT[a.wtype].magic ? 'cast' : 'shoot') : a.type === 'atk' ? 'swing' : 'heavy');
        if (a.proj) firePlayerProj(a);
        if (a.aoe) aoeSlam(a);
      }
      if (!a.proj && !a.aoe && a.t >= a.h0 && a.t <= a.h1 + 0.02) doHits(a);
      if (p.buf && a.t > a.h1 + 0.03) {
        if (p.buf.n === 'roll' || p.buf.n === 'guard' || (p.buf.n === 'atk' && a.type === 'atk' && a.t > a.h1 + 0.06) || (p.buf.n === 'heavy' && a.t > a.dur - 0.15)) { p.act = null; }
      }
    } else if (a.type === 'roll') {
      const k = 1 - a.t / a.dur; moveEnt(p, a.dx * a.spd * (0.35 + 0.65 * k) * dt, a.dy * a.spd * (0.35 + 0.65 * k) * dt);
      if (R() < 0.5) parts.push({ x: p.x + rnd(-6, 6), y: p.y + rnd(-6, 6), vx: 0, vy: 0, life: 0.4, ml: 0.4, col: 'rgba(200,190,170,0.5)', sz: rnd(3, 6), type: 'dust' });
      if (p.buf && p.buf.n !== 'roll' && a.t > a.dur - 0.08) p.act = null;
    } else if (a.type === 'guard') {
      moveEnt(p, mx * 70 * dt, my * 70 * dt);
      if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
      else { const t = nearestTarget(220); if (t) p.face = turnTo(p.face, atan2(t.y - p.y, t.x - p.x), 10 * dt); else if (ml > 0.1) p.face = atan2(my, mx); }
      if (p.buf && p.buf.n !== 'guard') p.act = null;
      else if (!guardHeld() && a.t > a.win) p.act = null;
      else if (p.buf && p.buf.n === 'guard') { p.buf = null; startAct('guard', mx, my); }
    } else if (a.type === 'item') {
      moveEnt(p, mx * 60 * dt, my * 60 * dt);
      if (a.t >= 0.28 && !a.done) { a.done = true; useItem(a.id); if (state !== 'play' || P !== p) return; }
    } else if (a.type === 'heal') {
      moveEnt(p, mx * 55 * dt, my * 55 * dt);
      if (a.t >= 0.55 && !a.done) { a.done = true; p.hp = Math.min(maxHp(), p.hp + maxHp() * 0.42 * (ringHas('anel_brasa') ? 1.3 : 1)); sfx('heal'); burst(p.x, p.y, 22, '#ffb347', 90, 'spark'); floatTxt(p.x, p.y - 24, 'Brasa', '#ffb347'); }
    }
    if (p.act && p.act.t >= p.act.dur) p.act = null;
  }
  if (!p.act) {
    if (p.buf) { const b = p.buf; p.buf = null; startAct(b.n, mx, my); if (p.act && p.act.type !== 'atk') p.combo = 0; }
  }
  if (!p.act) {
    if (p.combo && !p.buf) p.comboT = (p.comboT || 0) + dt; else p.comboT = 0;
    if (p.comboT > 0.45) p.combo = 0;
    moveEnt(p, mx * 155 * ROLLP[LC].mv * dt, my * 155 * ROLLP[LC].mv * dt);
    if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
    else if (ml > 0.1) p.face = atan2(my, mx);
    p.walk = (p.walk || 0) + ml * dt * 10;
  }
}
function doHits(a) {
  const p = P;
  for (const e of enemies.concat(bosses)) {
    if (a.hit.has(e) || e.air || e.hp <= 0 || e.alpha < 0.5) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
    if (d > a.range + e.r) continue;
    if (d > e.r + p.r + 4 && Math.abs(angDiff(p.face, atan2(dy, dx))) > a.arc / 2 + Math.asin(Math.min(1, e.r / d))) continue;
    a.hit.add(e);
    let mult = 1;
    if (!e.isBoss && e.broken <= 0 && e.st !== 'wind' && Math.abs(angDiff(e.face, atan2(dy, dx))) < 0.85) mult = a.back * (ringHas('anel_sombra') ? 1.5 : 1);
    damageEnemy(e, a.dmg * mult, a.poise * (mult > 1 ? 2 : 1), a.type === 'heavy', a.el, mult > 1);
  }
}
function damageEnemy(e, dmg, poise, heavy, el, back) {
  const a = atan2(e.y - P.y, e.x - P.x);
  e.aggro = true; if (e.isBoss && !e.awake) wakeBosses();
  if (e.broken > 0) {
    // GOLPE FATAL
    STATS.deathblows++; sfx('deathblow'); hitstop = 0.18; shake = 16; flash = 0;
    burst(e.x, e.y, 40, '#c0101a', 300, 'spark'); burst(e.x, e.y, 20, '#ffd166', 200, 'spark');
    const dd = e.isBoss ? Math.round(Math.max(e.mhp * 0.3, dmg * 3)) : Math.ceil(e.hp);
    e.hp -= dd; e.flash = 0.25; e.broken = 0; e.post = 0;
    floatTxt(e.x, e.y - e.r - 14, 'GOLPE FATAL  ' + dd, '#ff4a4a', 18);
    if (e.hp <= 0) kill(e);
    return;
  }
  let crit = !!back;
  if (e.stag > 0.35 && !e.isBoss && !back) { dmg *= 1.4; crit = true; }
  if (el) { if (el.k === 'fogo' || el.k === 'raio') dmg *= 1.1; dmg += applyEl(e, el); }
  dmg = Math.round(dmg * rnd(0.92, 1.08));
  e.hp -= dmg; e.flash = 0.12;
  if (ringHas('anel_sangue')) P.hp = Math.min(maxHp(), P.hp + dmg * 0.04);
  if (back) { floatTxt(e.x, e.y - e.r - 20, 'PELAS COSTAS!', '#ffd166', 14); sfx('deathblow'); burst(e.x, e.y, 20, '#c0101a', 220, 'spark'); }
  floatTxt(e.x + rnd(-8, 8), e.y - e.r - 6, (crit ? '✦' : '') + dmg, crit ? '#ffd166' : el ? ELEM[el.k].col : '#f2e9d8', crit ? 17 : 13);
  burst(e.x - cos(a) * e.r * 0.5, e.y - sin(a) * e.r * 0.5, heavy ? 14 : 8, e.isBoss ? e.col2 : '#e8d9b0', heavy ? 240 : 170, 'spark');
  sfx('hit'); hitstop = back ? 0.14 : heavy ? 0.075 : 0.04; shake = Math.max(shake, heavy ? 6 : 3);
  if (e.hp > 0) addPosture(e, poise * (e.isBoss ? 0.7 : 0.8));
  if (!e.isBoss && e.broken <= 0 && (!e.d.poise || heavy)) {
    e.stag = heavy ? 0.65 : 0.32; e.st = 'idle'; cancelHaz(e);
    moveEnt(e, cos(a) * (heavy ? 22 : 10), sin(a) * (heavy ? 22 : 10));
  }
  if (e.hp <= 0) kill(e);
}
/* ---------- armas à distância, área, elementos, itens ---------- */
function firePlayerProj(a) {
  const pr = a.proj, n = pr.count || 1, p = P;
  let ang = p.face; const t = lockT || nearestTarget(520, 0.9);
  if (t) ang = atan2(t.y - p.y, t.x - p.x);
  p.face = ang;
  for (let i = 0; i < n; i++) {
    const aa = ang + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
    projs.push({ friendly: true, x: p.x + cos(aa) * 16, y: p.y + sin(aa) * 16, vx: cos(aa) * pr.spd, vy: sin(aa) * pr.spd, r: pr.r, dmg: a.dmg, post: a.poise, el: a.el,
      life: 1.6, col: pr.col || (a.el ? ELEM[a.el.k].col : '#e8dcc8'), arrow: pr.arrow, pierce: pr.pierce, homing: pr.homing, boom: pr.boom, hitSet: new Set(), trail: [] });
  }
}
function aoeHit(x, y, r, dmg, post, el) {
  for (const e of enemies.concat(bosses)) {
    if (e.air || e.hp <= 0 || e.alpha < 0.5) continue;
    if (hyp(e.x - x, e.y - y) < r + e.r) damageEnemy(e, dmg, post, true, el);
  }
  parts.push({ type: 'ring', x, y, r, life: 0.35, ml: 0.35, col: el ? ELEM[el.k].col : '#e8d9b0', sz: 0, vx: 0, vy: 0 });
  burst(x, y, 18, el ? ELEM[el.k].col : '#c9a96e', 200, 'dust');
}
function aoeSlam(a) {
  const x = P.x + cos(P.face) * 40, y = P.y + sin(P.face) * 40;
  shake = Math.max(shake, 10); sfx('boom'); aoeHit(x, y, a.aoe, a.dmg, a.poise, a.el);
}
function explode(p) {
  if (p.exploded) return; p.exploded = true; p.life = 0;
  shake = Math.max(shake, 6); sfx('boom'); aoeHit(p.x, p.y, p.boom, p.dmg, p.post, p.el);
  burst(p.x, p.y, 24, p.col, 240, 'fire');
}
function updFriendly(p, dt) {
  if (p.homing) {
    let best = null, bd = 340;
    for (const e of enemies.concat(bosses)) { if (e.air || e.hp <= 0) continue; const d = hyp(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    if (best) { const sp = hyp(p.vx, p.vy), a0 = atan2(p.vy, p.vx), a1 = turnTo(a0, atan2(best.y - p.y, best.x - p.x), 5 * dt); p.vx = cos(a1) * sp; p.vy = sin(a1) * sp; }
  }
  p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
  if (p.x < 0 || p.y < 0 || p.x > world.w || p.y > world.h) p.life = 0;
  if (!p.ghost) for (const o of world.obs) if (hyp(p.x - o.x, p.y - o.y) < o.r + p.r) { p.life = 0; burst(p.x, p.y, 5, p.col, 90, 'spark'); }
  if (p.life > 0) for (const e of enemies.concat(bosses)) {
    if (p.hitSet.has(e) || e.air || e.hp <= 0 || e.alpha < 0.5) continue;
    if (hyp(e.x - p.x, e.y - p.y) < e.r + p.r) {
      p.hitSet.add(e);
      if (p.boom) { explode(p); break; }
      damageEnemy(e, p.dmg, p.post, false, p.el);
      if (!p.pierce) { p.life = 0; break; }
    }
  }
  if (p.life <= 0 && p.boom) explode(p);
}
function applyEl(e, el) {
  e.sb = e.sb || {}; e.sb[el.k] = (e.sb[el.k] || 0) + el.amt * (e.isBoss ? 0.55 : 1);
  if (e.sb[el.k] < 100) return 0;
  e.sb[el.k] = 0; const E = ELEM[el.k]; let extra = 0, t = '';
  if (el.k === 'fogo') { e.burn = 4; t = 'Em chamas!'; }
  else if (el.k === 'gelo') { e.frozen = 3.5; t = 'Congelado!'; }
  else if (el.k === 'veneno') { e.poison = 10; t = 'Envenenado!'; }
  else if (el.k === 'raio') { extra = e.mhp * (e.isBoss ? 0.04 : 0.15); t = 'Eletrocutado!'; addPosture(e, 4); }
  else if (el.k === 'sangue') { extra = e.mhp * (e.isBoss ? 0.07 : 0.22); t = 'Sangramento!'; burst(e.x, e.y, 26, E.col, 220, 'spark'); }
  floatTxt(e.x, e.y - e.r - 24, t, E.col, 13); burst(e.x, e.y, 12, E.col, 160, 'spark');
  return extra;
}
function statusTick(e, dt) {
  let m = 1;
  if (e.sb) for (const k in e.sb) e.sb[k] = Math.max(0, e.sb[k] - 8 * dt);
  if (e.burn > 0) { e.burn -= dt; e.hp -= e.mhp * (e.isBoss ? 0.008 : 0.05) * dt; if (R() < 0.5) parts.push({ x: e.x + rnd(-e.r, e.r) * 0.7, y: e.y + rnd(-e.r, e.r) * 0.5, vx: 0, vy: -50, life: 0.5, ml: 0.5, col: R() < 0.5 ? '#ff8c3a' : '#ffd166', sz: rnd(2, 5), type: 'fire' }); }
  if (e.poison > 0) { e.poison -= dt; e.hp -= e.mhp * (e.isBoss ? 0.005 : 0.025) * dt; if (R() < 0.15) parts.push({ x: e.x + rnd(-e.r, e.r) * 0.7, y: e.y, vx: 0, vy: -30, life: 0.7, ml: 0.7, col: '#8aff6a', sz: rnd(2, 3.5), type: 'dust' }); }
  if (e.frozen > 0) { e.frozen -= dt; m = 0.5; }
  if (e.hp <= 0 && (enemies.includes(e) || bosses.includes(e))) kill(e);
  return m;
}
function bossRewards(e) {
  const bw = BOSS_W[e.arch.name];
  if (bw) addItem('w', bw[0]);
  addItem('tit', 'tit', 3 + Math.floor(world.n / 12));
  addItem('it', 'alma_g', 1);
  if (R() < 0.6) { const rg = Object.keys(RINGS).filter(k => !owns('rg', k)); if (rg.length) addItem('rg', pick(rg)); }
}
function quickList() { return Object.keys(ITEMS).filter(k => (S.inv.it[k] || 0) > 0); }
function quickItem() { const l = quickList(); if (!l.includes(S.quick)) S.quick = l[0] || null; return S.quick; }
function cycleItem() { const l = quickList(); if (!l.length) return; const i = l.indexOf(S.quick); S.quick = l[(i + 1) % l.length]; sfx('ui'); }
function throwAt(spd) {
  const t = lockT || nearestTarget(320); let ang = P.face, d = 170;
  if (t) { ang = atan2(t.y - P.y, t.x - P.x); d = hyp(t.x - P.x, t.y - P.y); }
  P.face = ang; return [ang, d];
}
function useItem(id) {
  if (!(S.inv.it[id] > 0)) return;
  S.inv.it[id]--; const sc = 1 + (world.n - 1) * 0.08;
  if (id === 'bomba') { const [a, d] = throwAt(); projs.push({ friendly: true, x: P.x, y: P.y, vx: cos(a) * 330, vy: sin(a) * 330, r: 6, dmg: 45 * sc, post: 3, el: { k: 'fogo', amt: 60 }, life: Math.max(0.15, d / 330), col: '#ff8c3a', boom: 72, bomb: true, ghost: true, hitSet: new Set(), trail: [] }); sfx('roll'); }
  else if (id === 'faca') { const [a] = throwAt(); projs.push({ friendly: true, x: P.x, y: P.y, vx: cos(a) * 650, vy: sin(a) * 650, r: 4, dmg: (14 + S.at.dex * 0.6) * sc, post: 0.5, el: null, life: 0.8, col: '#d8d8e8', arrow: true, hitSet: new Set(), trail: [] }); sfx('shoot'); }
  else if (id.startsWith('resina_')) { const k = id.slice(7); P.buff = { k, t: 60 }; msg = { text: `Arma imbuída: ${ELEM[k].name}`, t: 2, col: ELEM[k].col }; sfx('cast'); }
  else if (id === 'erva') { P.erva = 45; msg = { text: 'Fôlego renovado', t: 1.5, col: '#8aff6a' }; sfx('heal'); }
  else if (id === 'cristal') { P.mp = Math.min(maxMp(), P.mp + 60); sfx('heal'); burst(P.x, P.y, 16, '#9fd8ff', 90, 'spark'); }
  else if (id === 'alma_p' || id === 'alma_g') { const v = id === 'alma_p' ? 200 : 1500; S.souls += v; soulsTo(P.x, P.y, 12); floatTxt(P.x, P.y - 24, '+' + v + ' almas', '#9fe7c9', 14); sfx('soul'); }
  else if (id === 'osso') { S.stage = S.checkpoint; persist(); goBonfire('osso'); }
  persist();
}
function postureRegen(e, dt) {
  e.postT -= dt;
  if (e.postT <= 0 && e.post > 0) e.post = Math.max(0, e.post - e.mpost * (e.isBoss ? 0.06 : 0.12) * (0.25 + 0.75 * e.hp / e.mhp) * dt);
}
function kill(e) {
  e.hp = 0;
  if (e.isBoss) {
    bosses = bosses.filter(b => b !== e); cancelHaz(e);
    burst(e.x, e.y, 70, e.col2, 320, 'spark'); burst(e.x, e.y, 30, '#000', 160, 'dust'); shake = 18; hitstop = 0.25;
    const sv = Math.round(e.souls * (ringHas('anel_cobica') ? 1.3 : 1));
    soulsTo(e.x, e.y, 40); S.souls += sv; floatTxt(e.x, e.y - 30, '+' + sv + ' almas', '#9fe7c9', 16);
    if (bosses.length === 0) {
      for (const m of enemies) burst(m.x, m.y, 10, '#555', 100, 'dust');
      enemies = []; hazards = []; projs = [];
      S.bosses++; S.checkpoint = world.n + 1; S.stage = world.n + 1; S.best = Math.max(S.best, world.n + 1); persist();
      bossRewards(e);
      victoryT = 4.5; sfx('victory');
      banner = { text: 'GRANDE INIMIGO ABATIDO', sub: e.title + ', ' + e.epi, t: 4.5, col: '#ffd166' };
    }
  } else {
    enemies = enemies.filter(x => x !== e); cancelHaz(e);
    burst(e.x, e.y, 18, e.col, 160, 'dust'); soulsTo(e.x, e.y, e.minion ? 2 : 6);
    const sv = Math.round(e.souls * (ringHas('anel_cobica') ? 1.3 : 1));
    S.souls += sv; floatTxt(e.x, e.y - 18, '+' + sv, '#9fe7c9', 12);
    if (!e.minion && R() < (e.d.poise ? 0.35 : 0.14)) dropLoot(e.x, e.y, randomLoot(R, realmIndex(world.n), false));
    if (!world.isBoss && enemies.length === 0 && !world.open) {
      world.open = true; sfx('gate'); msg = { text: 'Uma passagem se abriu ao norte', t: 3, col: '#9fe7c9' };
    }
  }
  if (lockT === e) lockT = nearestTarget(420);
}

/* ---------- IA dos inimigos ---------- */
function updEnemy(e, dt) {
  e.flash = Math.max(0, e.flash - dt); e.wob += dt * 3;
  const dx = P.x - e.x, dy = P.y - e.y, d = hyp(dx, dy), a = atan2(dy, dx), D = e.d;
  if (!e.aggro) { if (d < 340 || e.hp < e.mhp) e.aggro = true; else return; }
  postureRegen(e, dt);
  if (e.broken > 0) { e.broken -= dt; if (e.broken <= 0) e.post = e.mpost * 0.5; return; }
  if (e.stag > 0) { e.stag -= dt; return; }
  if (P.dead) { e.st = 'idle'; return; }
  e.cd -= dt;
  if (e.st === 'idle') {
    if (D.kind === 'ranged' || D.kind === 'caster') {
      e.face = turnTo(e.face, a, 5 * dt);
      let mv = 0; if (d > D.range * 0.85) mv = 1; else if (d < 150) mv = -0.8;
      moveEnt(e, cos(a) * e.spd * mv * dt, sin(a) * e.spd * mv * dt);
      if (d < D.range && e.cd <= 0) {
        e.st = 'wind'; e.t = D.wind; e.face = a;
        if (D.kind === 'caster') { sfx('cast'); addHaz({ shape: 'circle', x: P.x, y: P.y, r: 52, delay: D.wind + 0.55, dmg: e.dmg, owner: e, col: '190,80,255', boom: 3, fx: '#c77dff' }); }
      }
    } else {
      e.face = turnTo(e.face, a, 6 * dt);
      const reach = D.kind === 'lunge' ? D.range : D.range * 0.8;
      if (d > reach) moveEnt(e, cos(a) * e.spd * dt, sin(a) * e.spd * dt);
      else if (D.kind === 'lunge') moveEnt(e, cos(a + PI / 2) * e.spd * 0.4 * dt, sin(a + PI / 2) * e.spd * 0.4 * dt);
      if (d < D.range + P.r && e.cd <= 0) {
        e.st = 'wind'; e.t = D.wind; e.face = a;
        if (D.kind === 'melee') addHaz({ shape: 'cone', x: e.x, y: e.y, ang: a, range: D.range + 20, arc: 1.5, delay: D.wind, dmg: e.dmg, owner: e });
        if (D.kind === 'slam') addHaz({ shape: 'circle', x: e.x + cos(a) * 30, y: e.y + sin(a) * 30, r: 62, delay: D.wind, dmg: e.dmg, owner: e, boom: 6 });
        if (D.kind === 'lunge') addHaz({ shape: 'rect', x: e.x, y: e.y, ang: a, len: 150, wid: 26, delay: D.wind, active: 0.24, dmg: e.dmg, owner: e });
      }
    }
  } else if (e.st === 'wind') {
    e.t -= dt;
    if (D.kind === 'ranged') e.face = turnTo(e.face, a, 2.5 * dt);
    if (e.t <= 0) {
      if (D.kind === 'ranged') { sfx('shoot'); shoot(e.x + cos(e.face) * 14, e.y + sin(e.face) * 14, e.face, 320, { dmg: e.dmg, col: '#d9c27a', r: 5, arrow: true }); }
      if (D.kind === 'lunge') { e.st = 'lunge'; e.t = 0.24; return; }
      e.st = 'rec'; e.t = 0.45; e.cd = D.cd * rnd(0.8, 1.2);
    }
  } else if (e.st === 'lunge') {
    e.t -= dt; moveEnt(e, cos(e.face) * 610 * dt, sin(e.face) * 610 * dt);
    if (e.t <= 0) { e.st = 'rec'; e.t = 0.5; e.cd = D.cd * rnd(0.8, 1.2); }
  } else if (e.st === 'rec') { e.t -= dt; if (e.t <= 0) e.st = 'idle'; }
}

/* ---------- IA dos chefes ---------- */
function wakeBosses() {
  if (bosses.some(b => b.awake)) { bosses.forEach(b => b.awake = true); return; }
  bosses.forEach(b => b.awake = true); sfx('roar'); shake = 10;
  const b = bosses[0];
  const mods = b.mods.length ? ' · ' + b.mods.map(m => MODNAME[m]).join(' · ') : '';
  banner = { text: bosses.length > 1 ? `${b.title} (Gêmeos)` : b.name, sub: b.epi + mods, t: 3.5, col: '#e8d9b0', boss: true };
}
const T = (b, x) => x / b.sp;
function aimB(b) { b.face = atan2(P.y - b.y, P.x - b.x); }
function ev(A, t, f) { A.ev.push([t, f]); }
const ATK = {
  combo: { rng: [0, 150], f(b, A) {
    const n = b.p2 ? 4 : 3, g = 0.62;
    for (let i = 0; i < n; i++) ev(A, T(b, i * g), () => {
      aimB(b); A.mv = { vx: cos(b.face) * 150 * b.sp, vy: sin(b.face) * 150 * b.sp, until: A.t + T(b, 0.18) };
      addHaz({ shape: 'cone', x: b.x + cos(b.face) * 20, y: b.y + sin(b.face) * 20, ang: b.face, range: b.r + 72, arc: 1.9, delay: T(b, 0.5), dmg: b.dmg, owner: b });
    });
    A.end = T(b, n * g + 0.45);
  } },
  cleave: { rng: [0, 160], f(b, A) {
    aimB(b); b.glow = 1;
    addHaz({ shape: 'cone', x: b.x, y: b.y, ang: b.face, range: b.r + 105, arc: 2.9, delay: T(b, 0.85), dmg: b.dmg * 1.45, owner: b, boom: 8 });
    A.end = T(b, 1.5);
  } },
  charge: { rng: [140, 800], f(b, A) {
    aimB(b); const ang = b.face, len = 500, dur = T(b, 0.42);
    addHaz({ shape: 'rect', x: b.x, y: b.y, ang, len, wid: b.r * 2 + 6, delay: T(b, 0.8), active: dur, dmg: b.dmg * 1.2, owner: b, kb: 260 });
    ev(A, T(b, 0.8), () => { sfx('roll'); A.mv = { vx: cos(ang) * len / dur, vy: sin(ang) * len / dur, until: A.t + dur, dust: true }; });
    A.end = T(b, 1.6);
  } },
  slam: { rng: [0, 180], f(b, A) {
    b.glow = 1;
    addHaz({ shape: 'circle', x: b.x, y: b.y, r: b.r + 110, delay: T(b, 0.95), dmg: b.dmg * 1.3, owner: b, boom: 12 });
    A.end = T(b, 1.6);
  } },
  shockwave: { rng: [0, 450], f(b, A) {
    b.glow = 1; const waves = b.p2 ? 2 : 1;
    addHaz({ shape: 'circle', x: b.x, y: b.y, r: b.r + 60, delay: T(b, 0.8), dmg: b.dmg, owner: b, boom: 10 });
    for (let w = 0; w < waves; w++) ev(A, T(b, 0.8 + w * 0.5), () => {
      const n = 20, off = R() * TAU;
      for (let i = 0; i < n; i++) { if (i % 7 === 0) continue; shoot(b.x, b.y, off + i * TAU / n, 210, { dmg: b.dmg * 0.7, col: b.col2, r: 9 }); }
    });
    A.end = T(b, 1.9);
  } },
  leap: { rng: [160, 900], f(b, A) {
    let tx, ty;
    ev(A, T(b, 0.3), () => {
      b.air = true; tx = P.x; ty = P.y; A.tx = tx; A.ty = ty; sfx('roll');
      addHaz({ shape: 'circle', x: tx, y: ty, r: 115, delay: T(b, 0.95), dmg: b.dmg * 1.4, owner: b, boom: 14 });
    });
    ev(A, T(b, 1.25), () => {
      b.air = false; b.x = A.tx; b.y = A.ty; moveEnt(b, 0, 0);
      if (b.p2) for (let i = 0; i < 10; i++) shoot(b.x, b.y, i * TAU / 10, 190, { dmg: b.dmg * 0.6, col: b.col2, r: 8 });
    });
    A.end = T(b, 2.0);
  } },
  volley: { rng: [90, 700], f(b, A) {
    b.glow = 1; const k = b.p2 ? 7 : 5;
    for (let s = 0; s < 3; s++) ev(A, T(b, 0.55 + s * 0.35), () => {
      aimB(b); sfx('cast');
      for (let i = 0; i < k; i++) shoot(b.x + cos(b.face) * b.r, b.y + sin(b.face) * b.r, b.face + (i - (k - 1) / 2) * 0.2 + (s % 2) * 0.1, 250, { dmg: b.dmg * 0.65, col: b.col2, r: 8 });
    });
    A.end = T(b, 1.7);
  } },
  spiral: { rng: [0, 650], f(b, A) {
    b.glow = 1; const arms = b.p2 ? 4 : 3; let ang = R() * TAU;
    for (let t = 0.4; t < 2.6; t += 0.11) ev(A, T(b, t), () => {
      ang += 0.32; for (let i = 0; i < arms; i++) shoot(b.x, b.y, ang + i * TAU / arms, 165, { dmg: b.dmg * 0.55, col: b.col2, r: 7 });
    });
    A.end = T(b, 2.9);
  } },
  meteor: { rng: [0, 1000], f(b, A) {
    b.glow = 1;
    ev(A, T(b, 0.35), () => {
      sfx('cast'); const n = b.p2 ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, r = i === 0 ? 0 : rnd(50, 190);
        addHaz({ shape: 'circle', x: P.x + cos(a) * r, y: P.y + sin(a) * r, r: 58, delay: T(b, 1.0 + i * 0.13), dmg: b.dmg * 1.1, owner: b, boom: 5, col: '255,120,30', fx: '#ff8c3a', meteor: true });
      }
    });
    A.end = T(b, 2.1);
  } },
  teleport: { rng: [0, 1000], f(b, A) {
    A.fade = true;
    ev(A, T(b, 0.45), () => {
      burst(b.x, b.y, 20, b.col2, 140, 'dust');
      const ang = P.face + PI + rnd(-0.6, 0.6); b.x = P.x + cos(ang) * 85; b.y = P.y + sin(ang) * 85; moveEnt(b, 0, 0);
      burst(b.x, b.y, 20, b.col2, 140, 'dust'); A.fade = false; b.alpha = 1; aimB(b);
      addHaz({ shape: 'cone', x: b.x, y: b.y, ang: b.face, range: b.r + 80, arc: 2.3, delay: T(b, 0.5), dmg: b.dmg * 1.1, owner: b });
    });
    A.end = T(b, 1.35);
  } },
  summon: { rng: [0, 1000], f(b, A) {
    if (enemies.length >= 5) { ATK.volley.f(b, A); return; }
    b.glow = 1;
    ev(A, T(b, 0.75), () => {
      sfx('cast'); const n = b.p2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, x = clamp(b.x + cos(a) * 90, 60, world.w - 60), y = clamp(b.y + sin(a) * 90, 60, world.h - 60);
        const m = makeEnemy(b.minionType, x, y, Math.max(1, world.n - 2), true); enemies.push(m); moveEnt(m, 0, 0); burst(x, y, 14, b.col2, 120, 'dust');
      }
    });
    A.end = T(b, 1.4);
  } },
  sweep: { rng: [0, 280], f(b, A) {
    b.glow = 1;
    addHaz({ shape: 'ring', x: b.x, y: b.y, r0: b.r + 42, r1: b.r + 235, delay: T(b, 1.05), dmg: b.dmg * 1.2, owner: b, boom: 8 });
    A.end = T(b, 1.7);
  } },
  pounce: { rng: [80, 520], f(b, A) {
    const n = b.p2 ? 4 : 3;
    for (let i = 0; i < n; i++) ev(A, T(b, i * 0.66), () => {
      aimB(b); const ang = b.face, len = 230, dur = T(b, 0.16);
      addHaz({ shape: 'rect', x: b.x, y: b.y, ang, len, wid: b.r * 1.7, delay: T(b, 0.4), active: dur, dmg: b.dmg, owner: b });
      ev(A, A.t + T(b, 0.4), () => { A.mv = { vx: cos(ang) * len / dur, vy: sin(ang) * len / dur, until: A.t + dur, dust: true }; });
      A.ev.sort((x, y) => x[0] - y[0]);
    });
    A.end = T(b, n * 0.66 + 0.5);
  } },
  roar: { rng: [0, 260], f(b, A) {
    b.glow = 1;
    ev(A, T(b, 0.1), () => sfx('roar'));
    addHaz({ shape: 'circle', x: b.x, y: b.y, r: 195, delay: T(b, 0.65), dmg: b.dmg * 0.6, owner: b, kb: 420, boom: 10 });
    A.end = T(b, 1.3);
  } },
  spikes: { rng: [60, 750], f(b, A) {
    aimB(b); const lines = b.p2 ? 3 : 1, base = b.face;
    for (let l = 0; l < lines; l++) {
      const ang = base + (l - (lines - 1) / 2) * 0.38;
      for (let i = 0; i < 10; i++) addHaz({ shape: 'circle', x: b.x + cos(ang) * (b.r + 30 + i * 48), y: b.y + sin(ang) * (b.r + 30 + i * 48), r: 30, delay: T(b, 0.6 + i * 0.07), dmg: b.dmg, owner: b, col: '230,230,255', spike: true });
    }
    A.end = T(b, 1.8);
  } },
  breath: { rng: [0, 340], f(b, A) {
    aimB(b); b.glow = 1;
    const h = addHaz({ shape: 'cone', x: b.x, y: b.y, ang: b.face, range: 320, arc: 0.95, delay: T(b, 0.75), active: 1.3, tick: 0.2, dmg: b.dmg * 0.38, owner: b, col: '255,140,30', breath: true });
    A.breath = h;
    A.end = T(b, 0.75) + 1.5;
  } },
  beam: { rng: [100, 1000], f(b, A) {
    aimB(b); b.glow = 1; const n = b.p2 ? 3 : 1;
    for (let i = 0; i < n; i++) addHaz({ shape: 'rect', x: b.x, y: b.y, ang: b.face + (i - (n - 1) / 2) * 0.55, len: 1000, wid: 34, delay: T(b, 0.95), active: 0.45, tick: 0.15, dmg: b.dmg * 0.5, owner: b, col: '255,60,80', beam: true });
    A.end = T(b, 1.7);
  } },
  dashslash: { rng: [60, 650], f(b, A) {
    const n = b.p2 ? 4 : 3;
    for (let i = 0; i < n; i++) ev(A, T(b, i * 0.56), () => {
      aimB(b); const ang = b.face, len = 300, dur = T(b, 0.14);
      addHaz({ shape: 'rect', x: b.x, y: b.y, ang, len, wid: 44, delay: T(b, 0.34), active: dur, dmg: b.dmg, owner: b });
      ev(A, A.t + T(b, 0.34), () => { sfx('swing'); A.mv = { vx: cos(ang) * len / dur, vy: sin(ang) * len / dur, until: A.t + dur }; });
      A.ev.sort((x, y) => x[0] - y[0]);
    });
    A.end = T(b, n * 0.56 + 0.5);
  } },
};
function updBoss(b, dt) {
  b.flash = Math.max(0, b.flash - dt); b.wob += dt; b.glow = Math.max(0, b.glow - dt * 0.6);
  // segmentos (serpe)
  let px = b.x, py = b.y;
  for (const s of b.segs) { const dx = s.x - px, dy = s.y - py, d = hyp(dx, dy), m = b.r * 0.55; if (d > m) { s.x = px + dx / d * m; s.y = py + dy / d * m; } px = s.x; py = s.y; }
  const dx = P.x - b.x, dy = P.y - b.y, d = hyp(dx, dy), a = atan2(dy, dx);
  if (!b.awake) { if (d < 420 || b.hp < b.mhp) wakeBosses(); else return; }
  postureRegen(b, dt);
  if (b.broken > 0) { b.broken -= dt; if (b.broken <= 0) b.post = b.mpost * 0.4; return; }
  if (!b.p2 && b.hp < b.mhp * 0.5) {
    b.p2 = true; b.sp *= 1.2; b.attacks = b.attacks.concat(b.p2atk); b.act = null; b.air = false; b.alpha = 1; cancelHaz(b);
    sfx('roar'); shake = 14; msg = { text: `${b.title} desperta sua fúria`, t: 2.4, col: '#ff6b6b' };
    addHaz({ shape: 'circle', x: b.x, y: b.y, r: 150, delay: 0.5, dmg: b.dmg * 0.4, owner: b, kb: 380, boom: 8 });
    b.idle = 1.0; return;
  }
  if (P.dead) return;
  const A = b.act;
  if (A) {
    A.t += dt;
    while (A.ev.length && A.ev[0][0] <= A.t) A.ev.shift()[1]();
    if (A.mv && A.t < A.mv.until) { moveEnt(b, A.mv.vx * dt, A.mv.vy * dt); if (A.mv.dust && R() < 0.6) parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, ml: 0.5, col: 'rgba(180,170,150,0.5)', sz: rnd(5, 10), type: 'dust' }); }
    if (A.fade) b.alpha = Math.max(0, b.alpha - dt * 3);
    if (A.breath && A.t > T(b, 0.75)) { const h = A.breath; for (let i = 0; i < 3; i++) { const aa = h.ang + rnd(-h.arc / 2, h.arc / 2), s = rnd(200, 380); parts.push({ x: b.x + cos(h.ang) * b.r, y: b.y + sin(h.ang) * b.r, vx: cos(aa) * s, vy: sin(aa) * s, life: 0.8, ml: 0.8, col: R() < 0.5 ? '#ff8c3a' : '#ffd166', sz: rnd(3, 7), type: 'fire' }); } }
    if (A.t >= A.end) {
      if (b.mods.includes('ardente')) addHaz({ shape: 'circle', x: b.x, y: b.y, r: 70, delay: 0.4, active: 3.5, tick: 0.3, dmg: b.dmg * 0.25, owner: null, col: '255,110,20', fire: true });
      b.act = null; b.alpha = 1; b.air = false; b.idle = rnd(0.45, 1.0) / b.sp;
    }
    return;
  }
  b.face = turnTo(b.face, a, 4 * dt);
  const pref = b.arch.pref;
  let mv = d > pref + 30 ? 1 : d < pref - 60 ? -0.7 : 0;
  if (R() < dt * 0.4) b.strafe *= -1;
  moveEnt(b, (cos(a) * mv + cos(a + PI / 2) * b.strafe * 0.45) * b.spd * b.sp * dt, (sin(a) * mv + sin(a + PI / 2) * b.strafe * 0.45) * b.spd * b.sp * dt);
  b.idle -= dt;
  if (b.idle <= 0) {
    let cands = b.attacks.filter(n => d >= ATK[n].rng[0] && d <= ATK[n].rng[1] && n !== b.last);
    if (!cands.length && b.idle > -1.2) return;
    if (!cands.length) cands = b.attacks.slice();
    const name = pick(cands);
    b.last = name; b.act = { name, t: 0, ev: [], end: 1, mv: null };
    ATK[name].f(b, b.act); b.act.ev.sort((x, y) => x[0] - y[0]);
  }
}

/* ---------- loop de jogo ---------- */
function updGame(dt) {
  stageT += dt;
  updPlayer(dt);
  if (state !== 'play') return;
  for (const e of enemies.slice()) { const m = statusTick(e, dt); if (e.hp > 0) updEnemy(e, dt * m); }
  for (const b of bosses.slice()) { const m = statusTick(b, dt); if (b.hp > 0) updBoss(b, dt * m); }
  if (state !== 'play') return;
  for (const l of world.loot) if (!l.taken && !P.dead && hyp(P.x - l.x, P.y - l.y) < 26) {
    l.taken = true; if (l.spot) S.picked[l.spot] = 1; addItem(l.item.kind, l.item.id, l.item.n);
  }
  world.loot = world.loot.filter(l => !l.taken);
  updProj(dt); updHaz(dt);
  if (!P.dead) separate();
  if (world.stain && !P.dead && hyp(P.x - world.stain.x, P.y - world.stain.y) < 28) {
    S.souls += world.stain.amount; floatTxt(P.x, P.y - 30, `+${world.stain.amount} almas recuperadas`, '#9fe7c9', 15);
    soulsTo(world.stain.x, world.stain.y, 20); sfx('heal'); world.stain = null; S.lost = null; persist();
  }
  if (world.open && !P.dead && hyp(P.x - world.exit.x, P.y - world.exit.y) < world.exit.r) { sfx('gate'); buildStage(world.n + 1); return; }
  if (victoryT > 0) { victoryT -= dt; if (victoryT <= 0) goBonfire('victory'); }
  if (P.dead) deadT += dt;
}
function goBonfire(from) {
  bonfireFrom = from; state = 'bonfire'; ui.bpage = 'main';
  P = newPlayer(); persist();
}
function respawnFromBonfire() { P = newPlayer(); buildStage(S.stage); state = 'play'; }

function update(dt) {
  gtime += dt;
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  for (const f of floats) { f.life -= dt; f.y -= 28 * dt; }
  for (const n of notices) n.life -= dt; notices = notices.filter(n => n.life > 0);
  floats = floats.filter(f => f.life > 0);
  flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt * 30);
  if (R() < dt * 14) {
    const vx = state === 'play' ? cam.x : 0, vy = state === 'play' ? cam.y : 0, vw = state === 'play' ? W / SC : W, vh = state === 'play' ? H / SC : H;
    parts.push({ x: vx + R() * vw, y: vy + vh + 10, vx: rnd(-10, 10), vy: rnd(-40, -15), life: rnd(4, 8), ml: 8, col: R() < 0.7 ? '#ff9a3c' : '#ffd166', sz: rnd(1, 2.4), type: 'ember', ui: state !== 'play' });
  }
  if (state === 'play') {
    if (hitstop > 0) { hitstop -= dt; updParts(dt * 0.2); return; }
    updParts(dt); updGame(dt);
    const tx = P.x - W / SC / 2, ty = P.y - H / SC / 2 - 10;
    cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);
    const vw = W / SC, vh = H / SC;
    cam.x = world.w < vw ? (world.w - vw) / 2 : clamp(cam.x, -20, world.w - vw + 20);
    cam.y = world.h < vh ? (world.h - vh) / 2 : clamp(cam.y, -20, world.h - vh + 20);
  } else updParts(dt);
}

/* =========================================================
   RENDERIZAÇÃO
   ========================================================= */
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
function drawFloor() {
  const B = world.biome, ts = 64, vw = W / SC, vh = H / SC;
  ctx.fillStyle = '#050406'; ctx.fillRect(cam.x - 50, cam.y - 50, vw + 100, vh + 100);
  ctx.fillStyle = B.floor; ctx.fillRect(0, 0, world.w, world.h);
  const x0 = Math.max(0, Math.floor(cam.x / ts)), y0 = Math.max(0, Math.floor(cam.y / ts));
  const x1 = Math.min(Math.ceil(world.w / ts), Math.ceil((cam.x + vw) / ts) + 1), y1 = Math.min(Math.ceil(world.h / ts), Math.ceil((cam.y + vh) / ts) + 1);
  for (let ix = x0; ix < x1; ix++) for (let iy = y0; iy < y1; iy++) {
    const hv = hash2(ix + world.n * 101, iy);
    if (hv < 0.45) { ctx.fillStyle = B.tile; ctx.globalAlpha = 0.4 + hv; ctx.fillRect(ix * ts + 1, iy * ts + 1, ts - 2, ts - 2); }
    if (hv > 0.88) { ctx.strokeStyle = B.line; ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.beginPath(); const cx = ix * ts + 10 + hv * 30, cy = iy * ts + 12; ctx.moveTo(cx, cy); ctx.lineTo(cx + 12, cy + 18); ctx.lineTo(cx + 6, cy + 34); ctx.lineTo(cx + 18, cy + 46); ctx.stroke(); }
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = B.line; ctx.lineWidth = 1; ctx.beginPath();
  for (let ix = x0; ix <= x1; ix++) { ctx.moveTo(ix * ts, Math.max(0, y0 * ts)); ctx.lineTo(ix * ts, Math.min(world.h, y1 * ts)); }
  for (let iy = y0; iy <= y1; iy++) { ctx.moveTo(Math.max(0, x0 * ts), iy * ts); ctx.lineTo(Math.min(world.w, x1 * ts), iy * ts); }
  ctx.stroke();
  for (const d of world.decals) {
    if (d.x < cam.x - 30 || d.x > cam.x + vw + 30 || d.y < cam.y - 30 || d.y > cam.y + vh + 30) continue;
    ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.a);
    if (d.k === 0) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 0, d.r * 1.6, d.r, 0, 0, TAU); ctx.fill(); }
    else if (d.k === 1) { ctx.strokeStyle = 'rgba(220,210,190,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-d.r, 0); ctx.lineTo(d.r, 0); ctx.moveTo(-d.r * 0.6, -3); ctx.lineTo(-d.r * 0.9, 3); ctx.stroke(); circle(d.r, 0, 3); ctx.fillStyle = 'rgba(220,210,190,0.18)'; ctx.fill(); }
    else { ctx.fillStyle = B.accent; ctx.globalAlpha = 0.07; circle(0, 0, d.r); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  // paredes
  ctx.fillStyle = '#0b090c'; const wt = 22;
  ctx.fillRect(-60, -60, world.w + 120, 60 + wt); ctx.fillRect(-60, world.h - wt, world.w + 120, 80);
  ctx.fillRect(-60, -60, 60 + wt, world.h + 120); ctx.fillRect(world.w - wt, -60, 80, world.h + 120);
  ctx.strokeStyle = B.obsTop; ctx.lineWidth = 3; ctx.strokeRect(wt, wt, world.w - wt * 2, world.h - wt * 2);
}
function drawObs() {
  const B = world.biome;
  for (const o of world.obs) {
    const x = o.x, y = o.y, r = o.r;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 8, r * 1.05, r * 0.85, 0, 0, TAU); ctx.fill();
    switch (o.kind) {
      case 'column': {
        ctx.fillStyle = shadeHex(B.obsTop, -50); circle(x, y, r); ctx.fill();
        ctx.fillStyle = B.obsTop; circle(x, y, r * 0.84); ctx.fill();
        ctx.strokeStyle = shadeHex(B.obsTop, -40); ctx.lineWidth = 1.5;
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(x + cos(a) * r * 0.5, y + sin(a) * r * 0.5); ctx.lineTo(x + cos(a) * r * 0.82, y + sin(a) * r * 0.82); ctx.stroke(); }
        ctx.fillStyle = shadeHex(B.obsTop, 20); circle(x - r * 0.15, y - r * 0.15, r * 0.4); ctx.fill();
        break;
      }
      case 'rune': {
        ctx.fillStyle = B.obs; ctx.beginPath(); ctx.ellipse(x, y, r * 0.75, r, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = B.obsTop; ctx.beginPath(); ctx.ellipse(x - 2, y - 3, r * 0.62, r * 0.86, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = B.accent; ctx.globalAlpha = 0.55 + 0.35 * sin(gtime * 2 + o.ph); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(x - 2, y - r * 0.6); ctx.lineTo(x - 2, y + r * 0.5); ctx.moveTo(x - 2, y - r * 0.35); ctx.lineTo(x + r * 0.3, y - r * 0.05); ctx.moveTo(x - 2, y + r * 0.05); ctx.lineTo(x - r * 0.3, y - r * 0.25); ctx.stroke(); ctx.globalAlpha = 1;
        break;
      }
      case 'obelisk': {
        const s = r * 0.85; ctx.fillStyle = B.obs; ctx.fillRect(x - s, y - s, s * 2, s * 2);
        ctx.fillStyle = B.obsTop; ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x, y); ctx.fill();
        ctx.fillStyle = shadeHex(B.obsTop, -25); ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x - s, y + s); ctx.lineTo(x, y); ctx.fill();
        ctx.fillStyle = shadeHex(B.obs, -20); ctx.beginPath(); ctx.moveTo(x + s, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x, y); ctx.fill();
        ctx.fillStyle = '#ffe08a'; circle(x, y, r * 0.16); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 3; i++) { ctx.fillRect(x + s * 0.35, y - s * 0.5 + i * s * 0.4, s * 0.25, s * 0.12); }
        break;
      }
      case 'lantern': {
        const s = r * 0.7; ctx.fillStyle = B.obs; ctx.fillRect(x - s, y - s, s * 2, s * 2);
        ctx.save(); ctx.translate(x, y); ctx.rotate(PI / 4); ctx.fillStyle = B.obsTop; ctx.fillRect(-s * 1.05, -s * 1.05, s * 2.1, s * 2.1); ctx.restore();
        const g = ctx.createRadialGradient(x, y, 1, x, y, r * 1.6); g.addColorStop(0, `rgba(255,170,90,${0.55 + 0.15 * sin(gtime * 5 + o.ph)})`); g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g; circle(x, y, r * 1.6); ctx.fill(); ctx.fillStyle = '#ffd08a'; circle(x, y, r * 0.2); ctx.fill();
        break;
      }
      case 'stepped': {
        for (let i = 0; i < 4; i++) { const s = r * (1 - i * 0.22); ctx.fillStyle = shadeHex(B.obsTop, -40 + i * 15); ctx.fillRect(x - s, y - s, s * 2, s * 2); }
        ctx.fillStyle = B.accent; ctx.globalAlpha = 0.7; ctx.fillRect(x - r * 0.15, y - r * 0.15, r * 0.3, r * 0.3); ctx.globalAlpha = 1;
        break;
      }
      case 'tree': {
        ctx.fillStyle = B.obs; circle(x, y, r * 0.5); ctx.fill();
        for (let i = 0; i < 5; i++) { const a = o.ph + i * TAU / 5; ctx.fillStyle = shadeHex(B.obsTop, -15 + (i % 2) * 12); circle(x + cos(a) * r * 0.45, y + sin(a) * r * 0.45 - 4, r * 0.7); ctx.fill(); }
        ctx.fillStyle = shadeHex(B.obsTop, 15); circle(x - r * 0.15, y - r * 0.25, r * 0.55); ctx.fill();
        break;
      }
      case 'birch': {
        ctx.fillStyle = B.obs; circle(x, y, r * 0.55); ctx.fill();
        ctx.fillStyle = '#222'; for (let i = 0; i < 4; i++) { const a = o.ph + i * 1.7; ctx.fillRect(x + cos(a) * r * 0.25 - 4, y + sin(a) * r * 0.25, 8, 2.5); }
        ctx.fillStyle = B.obsTop; ctx.globalAlpha = 0.85; for (let i = 0; i < 4; i++) { const a = o.ph + i * TAU / 4; circle(x + cos(a) * r * 0.6, y + sin(a) * r * 0.6, r * 0.45); ctx.fill(); } ctx.globalAlpha = 1;
        break;
      }
      case 'brazier': {
        ctx.fillStyle = '#1a0c0c'; circle(x, y, r); ctx.fill(); ctx.fillStyle = B.obsTop; circle(x, y, r * 0.8); ctx.fill(); ctx.fillStyle = '#2a0a0a'; circle(x, y, r * 0.6); ctx.fill();
        for (let i = 0; i < 7; i++) { const t = (gtime * 1.5 + i / 7 + o.ph) % 1, fx = x + sin(i * 5 + gtime * 4) * r * 0.3 * (1 - t), fy = y - t * r * 1.2, fr = r * (0.45 - t * 0.35);
          ctx.fillStyle = t < 0.35 ? 'rgba(255,230,150,0.85)' : 'rgba(255,90,30,0.6)'; circle(fx, fy, Math.max(1, fr)); ctx.fill(); }
        break;
      }
      default: {
        ctx.fillStyle = B.obs; circle(x, y, r); ctx.fill();
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
        g.addColorStop(0, B.obsTop); g.addColorStop(1, B.obs); ctx.fillStyle = g; circle(x, y, r * 0.86); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; circle(x, y, r * 0.6); ctx.stroke();
      }
    }
  }
}
/* Adornos mitológicos (chifres, asas, cabeças extras...). (hx,hy,hr)=cabeça; r=corpo; f=direção. */
function drawDeco(D, layer, f, hx, hy, hr, r, accent, isBoss) {
  if (!D) return;
  const fx = cos(f), fy = sin(f), px = -fy, py = fx, lw = Math.max(2, r * 0.12);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (layer === 'back') {
    if (D.wings) {
      const flap = sin(gtime * 8 + r) * 0.25;
      for (const s of [1, -1]) {
        const bx = -fx * r * 0.2, by = -fy * r * 0.2, a = f + PI + s * (1.0 + flap), L = r * (isBoss ? 2.2 : 1.6);
        ctx.fillStyle = isBoss && D.halo ? 'rgba(235,230,215,0.85)' : 'rgba(40,25,30,0.85)';
        ctx.beginPath(); ctx.moveTo(bx + px * s * r * 0.4, by + py * s * r * 0.4); ctx.lineTo(bx + cos(a) * L, by + sin(a) * L);
        ctx.lineTo(bx + cos(a + s * 0.5) * L * 0.75, by + sin(a + s * 0.5) * L * 0.75); ctx.lineTo(bx + cos(a + s * 0.9) * L * 0.6, by + sin(a + s * 0.9) * L * 0.6); ctx.closePath(); ctx.fill();
      }
    }
    if (D.tails) {
      const n = D.tails;
      for (let i = 0; i < n; i++) {
        const a = f + PI + (n > 1 ? (i - (n - 1) / 2) * (1.6 / Math.max(1, n - 1)) : 0) + sin(gtime * 3 + i) * 0.12, L = r * (isBoss ? 1.9 : 1.5);
        ctx.strokeStyle = shadeHex(accent, -30); ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.moveTo(-fx * r * 0.4, -fy * r * 0.4);
        ctx.quadraticCurveTo(cos(a - 0.3) * L * 0.6, sin(a - 0.3) * L * 0.6, cos(a) * L, sin(a) * L); ctx.stroke();
        ctx.fillStyle = '#fff6e0'; circle(cos(a) * L, sin(a) * L, lw * 1.3); ctx.fill();
      }
    }
    if (D.chains) {
      ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 2;
      for (const s of [1, -1]) for (let i = 0; i < 5; i++) { const t = i * 0.3 + 0.5, cx = -fx * r * t * 1.4 + px * s * r * (0.5 + sin(gtime * 4 + i) * 0.1), cy = -fy * r * t * 1.4 + py * s * r * (0.5 + sin(gtime * 4 + i) * 0.1); ctx.beginPath(); ctx.ellipse(cx, cy, 5, 3, f + i, 0, TAU); ctx.stroke(); }
    }
    if (D.heads) {
      const n = D.heads;
      for (let i = 0; i < n; i++) {
        const a = f + (i - (n - 1) / 2) * (2.4 / Math.max(1, n)) + sin(gtime * 2.5 + i * 1.7) * 0.12, L = r * (1.25 + 0.15 * sin(gtime * 3 + i));
        const x = cos(a) * L, y = sin(a) * L;
        ctx.strokeStyle = shadeHex(accent, -10); ctx.lineWidth = r * 0.32; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(cos(a + 0.4) * L * 0.5, sin(a + 0.4) * L * 0.5, x, y); ctx.stroke();
        ctx.fillStyle = accent; circle(x, y, r * 0.3); ctx.fill();
        eyes(x, y, a, r * 0.3, isBoss ? '#ffd166' : '#ff3b2f');
      }
    }
    if (D.pincers) {
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = lw * 1.6;
      ctx.beginPath(); ctx.moveTo(-fx * r * 0.8, -fy * r * 0.8); ctx.quadraticCurveTo(-fx * r * 1.8, -fy * r * 1.8, -fx * r * 1.2 + px * r * 0.6, -fy * r * 1.2 + py * r * 0.6); ctx.stroke();
      ctx.fillStyle = '#ff5a3a'; circle(-fx * r * 1.2 + px * r * 0.6, -fy * r * 1.2 + py * r * 0.6, lw); ctx.fill();
    }
    return;
  }
  // camada da frente
  if (D.mane) { ctx.fillStyle = '#7a4a1a'; for (let i = 0; i < 10; i++) { const a = i * TAU / 10; circle(hx + cos(a) * hr * 0.95, hy + sin(a) * hr * 0.95, hr * 0.35); ctx.fill(); } }
  if (D.jaws || D.snout) {
    const L = hr * (D.jaws ? 1.6 : 1.0); ctx.fillStyle = D.jaws ? shadeHex(accent, -10) : '#5a4a3a';
    ctx.beginPath(); ctx.moveTo(hx + px * hr * 0.5, hy + py * hr * 0.5); ctx.lineTo(hx + fx * (hr + L) + px * hr * 0.2, hy + fy * (hr + L) + py * hr * 0.2);
    ctx.lineTo(hx + fx * (hr + L) - px * hr * 0.2, hy + fy * (hr + L) - py * hr * 0.2); ctx.lineTo(hx - px * hr * 0.5, hy - py * hr * 0.5); ctx.fill();
    if (D.jaws) { ctx.fillStyle = '#f5f0e0'; for (let i = 1; i < 5; i++) for (const s of [1, -1]) { const t = hr + L * i / 5; circle(hx + fx * t + px * s * hr * 0.35 * (1 - i / 6), hy + fy * t + py * s * hr * 0.35 * (1 - i / 6), 1.6); ctx.fill(); } }
  }
  if (D.beak) { ctx.fillStyle = '#e0a020'; ctx.beginPath(); ctx.moveTo(hx + px * hr * 0.4, hy + py * hr * 0.4); ctx.lineTo(hx + fx * hr * 1.9, hy + fy * hr * 1.9); ctx.lineTo(hx - px * hr * 0.4, hy - py * hr * 0.4); ctx.fill(); }
  if (D.helm || D.kabuto) { ctx.fillStyle = D.kabuto ? '#2a2020' : '#8a7a5a'; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.05, f + PI / 2, f + PI * 1.5); ctx.fill(); ctx.strokeStyle = D.kabuto ? '#2a2020' : '#b03a2a'; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(hx + fx * hr * 0.3, hy + fy * hr * 0.3); ctx.lineTo(hx - fx * hr * 1.3, hy - fy * hr * 1.3); ctx.stroke(); }
  if (D.kabuto) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(hx + px * hr, hy + py * hr); ctx.quadraticCurveTo(hx + fx * hr * 1.4, hy + fy * hr * 1.4, hx - px * hr, hy - py * hr); ctx.stroke(); }
  if (D.hood) { ctx.fillStyle = 'rgba(15,10,20,0.9)'; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.1, f + PI * 0.45, f + PI * 1.55); ctx.lineTo(hx + fx * hr * 0.2, hy + fy * hr * 0.2); ctx.fill(); }
  if (D.nemes) { for (const s of [1, -1]) { ctx.fillStyle = '#d9b36a'; ctx.beginPath(); ctx.moveTo(hx + px * s * hr * 0.6, hy + py * s * hr * 0.6); ctx.lineTo(hx + px * s * hr * 1.3 - fx * hr * 0.9, hy + py * s * hr * 1.3 - fy * hr * 0.9); ctx.lineTo(hx - fx * hr * 0.6, hy - fy * hr * 0.6); ctx.fill(); ctx.strokeStyle = '#2a4a8a'; ctx.lineWidth = 1.5; ctx.stroke(); } }
  if (D.feathers) { const cols = ['#e04a3a', '#3fd1a0', '#ffd166', '#3a8ad1', '#e04a3a']; for (let i = 0; i < 5; i++) { const a = f + PI + (i - 2) * 0.35; ctx.strokeStyle = cols[i]; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + cos(a) * hr * 2.2, hy + sin(a) * hr * 2.2); ctx.stroke(); } }
  if (D.skull) {
    ctx.fillStyle = '#ece6d6'; circle(hx, hy, hr * 0.95); ctx.fill();
    ctx.fillStyle = '#111'; for (const s of [1, -1]) { circle(hx + fx * hr * 0.35 + px * s * hr * 0.35, hy + fy * hr * 0.35 + py * s * hr * 0.35, hr * 0.24); ctx.fill(); }
    ctx.fillStyle = accent; for (const s of [1, -1]) { circle(hx + fx * hr * 0.35 + px * s * hr * 0.35, hy + fy * hr * 0.35 + py * s * hr * 0.35, hr * 0.08); ctx.fill(); }
  }
  if (D.oneEye) { ctx.fillStyle = '#f5f0e0'; circle(hx + fx * hr * 0.4, hy + fy * hr * 0.4, hr * 0.45); ctx.fill(); ctx.fillStyle = '#c0392b'; circle(hx + fx * hr * 0.55, hy + fy * hr * 0.55, hr * 0.22); ctx.fill(); }
  if (D.bellyMouth) { ctx.fillStyle = '#1a0a0a'; ctx.beginPath(); ctx.ellipse(-fx * r * 0.1, -fy * r * 0.1, r * 0.35, r * 0.18, f + PI / 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#eee'; for (let i = -2; i <= 2; i++) { circle(-fx * r * 0.1 + px * i * r * 0.1, -fy * r * 0.1 + py * i * r * 0.1, 1.8); ctx.fill(); } }
  if (D.horns) for (const s of [1, -1]) {
    ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = lw * 1.3; ctx.beginPath();
    const bx = hx + px * s * hr * 0.7, by = hy + py * s * hr * 0.7;
    ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + px * s * hr * 0.9, by + py * s * hr * 0.9, bx + px * s * hr * 0.8 + fx * hr * 0.9, by + py * s * hr * 0.8 + fy * hr * 0.9); ctx.stroke();
  }
  if (D.ears) for (const s of [1, -1]) { ctx.fillStyle = shadeHex(accent, -20); ctx.beginPath(); const bx = hx + px * s * hr * 0.6, by = hy + py * s * hr * 0.6; ctx.moveTo(bx - fx * hr * 0.3, by - fy * hr * 0.3); ctx.lineTo(bx + px * s * hr * 0.6 - fx * hr * 0.4, by + py * s * hr * 0.6 - fy * hr * 0.4); ctx.lineTo(bx + fx * hr * 0.3, by + fy * hr * 0.3); ctx.fill(); }
  if (D.snakes) for (let i = 0; i < 7; i++) {
    const a = f + PI + (i - 3) * 0.45, w = sin(gtime * 6 + i) * 0.35; ctx.strokeStyle = i % 2 ? '#4a8a3a' : '#6aaa4a'; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(hx + cos(a) * hr * 0.6, hy + sin(a) * hr * 0.6); ctx.quadraticCurveTo(hx + cos(a + w) * hr * 1.4, hy + sin(a + w) * hr * 1.4, hx + cos(a - w) * hr * 2.0, hy + sin(a - w) * hr * 2.0); ctx.stroke();
  }
  if (D.redcap) { ctx.fillStyle = '#d0201a'; ctx.beginPath(); ctx.arc(hx - fx * hr * 0.2, hy - fy * hr * 0.2, hr * 0.85, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx - fx * hr * 0.6 + px * hr * 0.4, hy - fy * hr * 0.6 + py * hr * 0.4); ctx.lineTo(hx - fx * hr * 1.8, hy - fy * hr * 1.8); ctx.lineTo(hx - fx * hr * 0.6 - px * hr * 0.4, hy - fy * hr * 0.6 - py * hr * 0.4); ctx.fill(); }
  if (D.hat) { ctx.fillStyle = 'rgba(60,40,25,0.95)'; circle(hx, hy, hr * 1.4); ctx.fill(); ctx.fillStyle = '#2a1a10'; circle(hx, hy, hr * 0.8); ctx.fill(); }
  if (D.wraps) { ctx.strokeStyle = 'rgba(240,230,200,0.75)'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-r * 0.8, i * r * 0.3 - r * 0.2); ctx.lineTo(r * 0.8, i * r * 0.3 + r * 0.2); ctx.stroke(); } }
  if (D.bones) { ctx.strokeStyle = 'rgba(245,240,225,0.8)'; ctx.lineWidth = 1.6; for (let i = -1; i <= 1; i++) { const cx = -fx * r * 0.35 + px * i * r * 0.28, cy = -fy * r * 0.35 + py * i * r * 0.28; ctx.beginPath(); ctx.moveTo(cx - fx * r * 0.25, cy - fy * r * 0.25); ctx.lineTo(cx + fx * r * 0.25, cy + fy * r * 0.25); ctx.stroke(); } }
  if (D.spots) { ctx.fillStyle = 'rgba(30,20,10,0.7)'; for (let i = 0; i < 6; i++) { circle(cos(i * 2.3) * r * 0.5, sin(i * 2.3) * r * 0.5, 2); ctx.fill(); } }
  if (D.fangs) { ctx.fillStyle = '#fff'; for (const s of [1, -1]) { const bx = hx + fx * hr * 0.9 + px * s * hr * 0.2, by = hy + fy * hr * 0.9 + py * s * hr * 0.2; ctx.beginPath(); ctx.moveTo(bx - px * 2, by - py * 2); ctx.lineTo(bx + fx * 5, by + fy * 5); ctx.lineTo(bx + px * 2, by + py * 2); ctx.fill(); } }
  if (D.crown) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = i * TAU / 10, rr = hr * (i % 2 ? 0.75 : 1.05); i ? ctx.lineTo(hx + cos(a) * rr, hy + sin(a) * rr - 3) : ctx.moveTo(hx + cos(a) * rr, hy + sin(a) * rr - 3); } ctx.closePath(); ctx.lineWidth = 2; ctx.strokeStyle = '#ffd166'; ctx.stroke(); }
  if (D.halo) { ctx.strokeStyle = `rgba(255,209,102,${0.6 + 0.3 * sin(gtime * 3)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(hx, hy - hr * 1.6, hr * 0.9, hr * 0.35, 0, 0.3, PI * 1.6); ctx.stroke(); }
  if (D.headless || D.flame) {
    const cx = D.headless ? hx : 0, cy = D.headless ? hy : 0, rr = D.headless ? hr : r * 0.9;
    for (let i = 0; i < 6; i++) { const t = (gtime * 2 + i / 6) % 1; ctx.fillStyle = t < 0.4 ? 'rgba(255,230,140,0.7)' : 'rgba(255,100,30,0.45)'; circle(cx + sin(i * 4 + gtime * 5) * rr * 0.4, cy - t * rr * 1.6, Math.max(1, rr * (0.6 - t * 0.5))); ctx.fill(); }
  }
  if (D.ghost) { ctx.strokeStyle = 'rgba(200,230,255,0.35)'; ctx.lineWidth = r * 0.5; ctx.beginPath(); ctx.moveTo(-fx * r * 0.5, -fy * r * 0.5); ctx.quadraticCurveTo(-fx * r * 1.2 + px * sin(gtime * 4) * r * 0.5, -fy * r * 1.2 + py * sin(gtime * 4) * r * 0.5, -fx * r * 1.8, -fy * r * 1.8); ctx.stroke(); }
}
function drawExit() {
  const e = world.exit, B = world.biome;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = '#0b090c'; ctx.fillRect(-60, -40, 120, 30);
  ctx.fillStyle = B.obs; ctx.fillRect(-62, -34, 18, 60); ctx.fillRect(44, -34, 18, 60); ctx.fillRect(-62, -40, 124, 14);
  if (world.open) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 52); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(160,240,210,0.55)'); g.addColorStop(1, 'rgba(160,240,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 44, 30 + sin(gtime * 3) * 3, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(180,255,220,${0.4 - i * 0.1})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 20 + ((gtime * 20 + i * 12) % 36), 12 + ((gtime * 14 + i * 8) % 22), 0, 0, TAU); ctx.stroke(); }
  } else {
    ctx.fillStyle = 'rgba(200,200,220,0.12)'; ctx.fillRect(-44, -26, 88, 50);
    ctx.strokeStyle = 'rgba(120,110,130,0.7)'; ctx.lineWidth = 3; for (let i = -36; i <= 36; i += 12) { ctx.beginPath(); ctx.moveTo(i, -26); ctx.lineTo(i, 24); ctx.stroke(); }
  }
  ctx.restore();
}
function hazPath(h, k) {
  ctx.beginPath();
  if (h.shape === 'circle') ctx.arc(h.x, h.y, Math.max(0.1, h.r * k), 0, TAU);
  else if (h.shape === 'ring') { ctx.arc(h.x, h.y, h.r1 * (k < 1 ? (h.r0 / h.r1 + (1 - h.r0 / h.r1) * k) : 1), 0, TAU); ctx.arc(h.x, h.y, h.r0, 0, TAU, true); }
  else if (h.shape === 'cone') { ctx.moveTo(h.x, h.y); ctx.arc(h.x, h.y, Math.max(0.1, h.range * k), h.ang - h.arc / 2, h.ang + h.arc / 2); ctx.closePath(); }
  else if (h.shape === 'rect') { const c = cos(h.ang), s = sin(h.ang), w2 = h.wid / 2, L = h.len * k; ctx.moveTo(h.x - s * w2, h.y + c * w2); ctx.lineTo(h.x + c * L - s * w2, h.y + s * L + c * w2); ctx.lineTo(h.x + c * L + s * w2, h.y + s * L - c * w2); ctx.lineTo(h.x + s * w2, h.y - c * w2); ctx.closePath(); }
}
function drawHaz() {
  for (const h of hazards) {
    const c = h.col;
    if (h.t < h.delay) {
      const p = h.t / h.delay;
      hazPath(h, 1); ctx.fillStyle = `rgba(${c},${0.08 + 0.12 * p})`; ctx.fill();
      ctx.strokeStyle = `rgba(${c},${0.35 + 0.4 * p})`; ctx.lineWidth = 1.5; ctx.stroke();
      hazPath(h, p); ctx.fillStyle = `rgba(${c},${0.12 + 0.18 * p})`; ctx.fill();
      if (h.meteor) { const off = (1 - p) * 300; ctx.fillStyle = '#ffb347'; circle(h.x + off * 0.4, h.y - off, 8 + 6 * p); ctx.fill(); ctx.fillStyle = 'rgba(255,140,40,0.3)'; circle(h.x + off * 0.4, h.y - off, 16 + 8 * p); ctx.fill(); }
    } else {
      const at = h.t - h.delay, life = h.active + 0.18, fade = 1 - at / life;
      if (h.breath || h.fire) { hazPath(h, 1); ctx.fillStyle = `rgba(${c},${0.18 * fade + 0.1})`; ctx.fill(); if (h.fire && R() < 0.4) parts.push({ x: h.x + rnd(-h.r, h.r) * 0.8, y: h.y + rnd(-h.r, h.r) * 0.8, vx: 0, vy: -40, life: 0.6, ml: 0.6, col: '#ff8c3a', sz: rnd(2, 5), type: 'fire' }); continue; }
      if (h.beam) { hazPath(h, 1); ctx.fillStyle = `rgba(255,220,230,${0.8 * fade})`; ctx.fill(); ctx.save(); ctx.shadowColor = '#ff3a5c'; ctx.shadowBlur = 20; ctx.fill(); ctx.restore(); continue; }
      if (h.spike) {
        ctx.fillStyle = `rgba(230,230,245,${fade})`;
        for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + h.x, r = h.r * 0.8; ctx.beginPath(); ctx.moveTo(h.x + cos(a) * r * 0.3, h.y + sin(a) * r * 0.3); ctx.lineTo(h.x + cos(a) * r, h.y + sin(a) * r - 14); ctx.lineTo(h.x + cos(a + 0.5) * r * 0.3, h.y + sin(a + 0.5) * r * 0.3); ctx.fill(); }
        continue;
      }
      hazPath(h, 1); ctx.fillStyle = `rgba(255,${h.shape === 'cone' ? 240 : 200},${h.shape === 'cone' ? 220 : 160},${0.55 * fade})`; ctx.fill();
    }
  }
}
function eyes(x, y, face, r, col) {
  ctx.fillStyle = col; const ex = cos(face) * r * 0.55, ey = sin(face) * r * 0.55, px = -sin(face) * r * 0.3, py = cos(face) * r * 0.3;
  circle(x + ex + px, y + ey + py, Math.max(1.5, r * 0.14)); ctx.fill(); circle(x + ex - px, y + ey - py, Math.max(1.5, r * 0.14)); ctx.fill();
}
function drawEnemy(e) {
  const D = e.d, wind = e.st === 'wind', fl = e.flash > 0;
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(2, e.r * 0.7, e.r * 1.1, e.r * 0.5, 0, 0, TAU); ctx.fill();
  if (wind) { ctx.fillStyle = `rgba(255,60,40,${0.25 + 0.2 * sin(gtime * 30)})`; circle(0, 0, e.r + 7); ctx.fill(); }
  const body = fl ? '#fff' : e.col, dark = shadeHex(e.col, -35), DC = e.deco;
  if (DC.ghost) ctx.globalAlpha = 0.7;
  const f = e.face, bob = sin(e.wob * 2) * 1.2;
  if (e.type === 'hound') {
    drawDeco(DC, 'back', f, cos(f) * e.r * 0.9, sin(f) * e.r * 0.9, e.r * 0.55, e.r, e.col, false);
    ctx.rotate(f); ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-4, 0, e.r * 1.4, e.r * 0.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-2, 0, e.r * 1.2, e.r * 0.65, 0, 0, TAU); ctx.fill();
    if (!DC.headless) { circle(e.r * 0.9, 0, e.r * 0.55); ctx.fill(); } ctx.rotate(-f);
    if (!DC.headless) eyes(cos(f) * e.r * 0.5, sin(f) * e.r * 0.5, f, e.r * 0.7, wind ? '#ff3b2f' : '#ffcc66');
    drawDeco(DC, 'front', f, cos(f) * e.r * 0.9, sin(f) * e.r * 0.9, e.r * 0.55, e.r, e.col, false);
  } else {
    ctx.translate(0, bob);
    drawDeco(DC, 'back', f, cos(f) * e.r * 0.3, sin(f) * e.r * 0.3, e.r * 0.6, e.r, e.col, false);
    ctx.fillStyle = dark; circle(0, 0, e.r); ctx.fill();
    ctx.fillStyle = body; circle(0, -1, e.r * 0.82); ctx.fill();
    ctx.strokeStyle = fl ? '#fff' : '#cfc6b4'; ctx.lineWidth = e.type === 'knight' || e.type === 'brute' ? 4 : 2.5; ctx.lineCap = 'round';
    const wa = f + (wind ? -1.1 : 0.5);
    if (e.type === 'archer') { ctx.strokeStyle = '#a3865a'; ctx.beginPath(); ctx.arc(cos(f) * e.r * 0.6, sin(f) * e.r * 0.6, e.r * 0.9, f - 1.2, f + 1.2); ctx.stroke(); }
    else if (e.type === 'caster') { ctx.fillStyle = wind ? '#e0a0ff' : '#9b59b6'; circle(cos(f + 0.6) * e.r * 1.2, sin(f + 0.6) * e.r * 1.2, 4 + (wind ? 3 * sin(gtime * 20) : 0)); ctx.fill(); }
    else if (e.type === 'brute') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cos(wa) * e.r * 2.2, sin(wa) * e.r * 2.2); ctx.stroke(); ctx.fillStyle = '#555'; circle(cos(wa) * e.r * 2.2, sin(wa) * e.r * 2.2, 8); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(cos(wa) * e.r * 0.5, sin(wa) * e.r * 0.5); ctx.lineTo(cos(wa) * e.r * 2.1, sin(wa) * e.r * 2.1); ctx.stroke(); }
    if (e.type === 'knight') { ctx.fillStyle = '#4a5260'; ctx.beginPath(); ctx.arc(cos(f - 1.1) * e.r * 0.8, sin(f - 1.1) * e.r * 0.8, e.r * 0.55, 0, TAU); ctx.fill(); ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = 2; ctx.stroke(); }
    drawDeco(DC, 'front', f, cos(f) * e.r * 0.3, sin(f) * e.r * 0.3, e.r * 0.6, e.r, e.col, false);
    if (!DC.oneEye && !DC.skull && !DC.hat) eyes(0, -1, f, e.r, wind ? '#ff3b2f' : (e.minion ? '#9effa8' : '#ffcc66'));
    else if (wind) { ctx.fillStyle = '#ff3b2f'; circle(cos(f) * e.r * 0.5, sin(f) * e.r * 0.5, 2.5); ctx.fill(); }
  }
  ctx.restore();
  if (e.hp < e.mhp) {
    const w = e.r * 2.4; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = '#b3202a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * Math.max(0, e.hp / e.mhp), 4);
  }
  if (e.frozen > 0) { ctx.fillStyle = 'rgba(159,227,255,0.35)'; circle(e.x, e.y, e.r + 3); ctx.fill(); }
  if (e.broken > 0) deathMark(e.x, e.y - e.r - 14, 7);
  else if (e.post > 0.3) postBar(e.x, e.y - e.r - 6, e.r * 2.4, e.post / e.mpost);
  if (e.stag > 0.3 && e.broken <= 0) { ctx.fillStyle = '#ffd166'; for (let i = 0; i < 3; i++) { const a = gtime * 6 + i * 2.1; circle(e.x + cos(a) * e.r, e.y - e.r - 4 + sin(a) * 3, 2); ctx.fill(); } }
}
function drawBoss(b) {
  if (b.air) {
    const A = b.act, k = A ? clamp((A.t - T(b, 0.3)) / T(b, 0.95), 0, 1) : 0;
    if (A && A.tx !== undefined) { ctx.fillStyle = `rgba(0,0,0,${0.2 + 0.4 * k})`; ctx.beginPath(); ctx.ellipse(A.tx, A.ty, b.r * (0.6 + 0.6 * k), b.r * (0.35 + 0.35 * k), 0, 0, TAU); ctx.fill(); }
    return;
  }
  ctx.save(); ctx.globalAlpha = b.alpha;
  const r = b.r, f = b.face, fl = b.flash > 0, body = fl ? '#ffffff' : b.col, c2 = b.col2, dark = shadeHex(b.col, -40);
  if (b.shape === 'wyrm') {
    for (let i = b.segs.length - 1; i >= 0; i--) { const s = b.segs[i], rr = r * (0.85 - i * 0.08); ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(s.x + 4, s.y + 6, rr); ctx.fill(); ctx.fillStyle = i % 2 ? dark : body; circle(s.x, s.y, rr); ctx.fill(); ctx.fillStyle = c2; circle(s.x, s.y, rr * 0.25); ctx.fill(); }
  }
  if (b.shape === 'spider') {
    ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const side = i < 4 ? 1 : -1, k = (i % 4), a = f + side * (0.7 + k * 0.45), st = sin(b.wob * 10 + i) * 0.15; ctx.beginPath(); ctx.moveTo(b.x, b.y); const kx = b.x + cos(a + st) * r * 1.4, ky = b.y + sin(a + st) * r * 1.4; ctx.lineTo(kx, ky - 10); ctx.lineTo(b.x + cos(a + st) * r * 2.1, b.y + sin(a + st) * r * 2.1); ctx.stroke(); }
  }
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(4, r * 0.75, r * 1.2, r * 0.55, 0, 0, TAU); ctx.fill();
  if (b.p2 || b.glow > 0) { const g = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2); g.addColorStop(0, `rgba(255,60,40,${0.25 + b.glow * 0.3})`); g.addColorStop(1, 'rgba(255,60,40,0)'); ctx.fillStyle = g; circle(0, 0, r * 2.2); ctx.fill(); }
  const bob = sin(b.wob * 3) * 2, D = b.deco || {};
  const HP = { knight: [0.25, -2, 0.45], duelist: [0.25, -2, 0.45], witch: [0, 0, 0.42], beast: [0.85, 0, 0.55], spider: [0.85, 0, 0.55], golem: [0.35, -4, 0.45], wyrm: [0.6, 0, 0.6], eye: [0, 0, 1] }[b.shape] || [0, 0, 0.5];
  let hx = cos(f) * r * HP[0], hy = sin(f) * r * HP[0] + bob + HP[1], hr = r * HP[2];
  if (b.shape === 'witch') { hx = 0; hy = -r * 0.35 + bob; }
  drawDeco(D, 'back', f, hx, hy, hr, r, b.col, true);
  switch (b.shape) {
    case 'knight': case 'duelist': {
      ctx.fillStyle = shadeHex(c2, -60); ctx.beginPath(); ctx.ellipse(-cos(f) * r * 0.5, -sin(f) * r * 0.5 + bob, r * 1.05, r * 0.9, f, 0, TAU); ctx.fill();
      ctx.fillStyle = dark; circle(0, bob, r); ctx.fill(); ctx.fillStyle = body; circle(0, bob - 2, r * 0.82); ctx.fill();
      ctx.fillStyle = shadeHex(b.col, 30); circle(cos(f) * r * 0.25, sin(f) * r * 0.25 + bob - 2, r * 0.45); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cos(f) * r * 0.5 - sin(f) * r * 0.25, sin(f) * r * 0.5 + cos(f) * r * 0.25 + bob - 2); ctx.lineTo(cos(f) * r * 0.5 + sin(f) * r * 0.25, sin(f) * r * 0.5 - cos(f) * r * 0.25 + bob - 2); ctx.stroke();
      ctx.lineCap = 'round';
      const blades = b.shape === 'duelist' ? [f + 0.9, f - 0.9] : [f + 0.6];
      for (const wa of blades) { ctx.strokeStyle = fl ? '#fff' : c2; ctx.lineWidth = b.shape === 'duelist' ? 3 : 6; ctx.beginPath(); ctx.moveTo(cos(wa) * r * 0.7, sin(wa) * r * 0.7); ctx.lineTo(cos(wa) * r * 2.4, sin(wa) * r * 2.4); ctx.stroke(); }
      break;
    }
    case 'witch': {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(0, -r * 1.3 + bob); ctx.lineTo(r * 1.05, r * 0.9); ctx.lineTo(-r * 1.05, r * 0.9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(0, -r * 1.1 + bob); ctx.lineTo(r * 0.8, r * 0.8); ctx.lineTo(-r * 0.8, r * 0.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#111'; circle(0, -r * 0.35 + bob, r * 0.42); ctx.fill(); eyes(0, -r * 0.35 + bob, f, r * 0.42, c2);
      if (!D.snakes && !D.skull && !D.ears && !D.jaws) { ctx.fillStyle = '#0d0b10'; ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.55 + bob); ctx.lineTo(r * 0.9, -r * 0.55 + bob); ctx.lineTo(r * 0.1, -r * 2.0 + bob); ctx.closePath(); ctx.fill(); }
      for (let i = 0; i < 3; i++) { const a = b.wob * 2 + i * TAU / 3; ctx.fillStyle = c2; ctx.globalAlpha = b.alpha * 0.85; circle(cos(a) * r * 1.6, sin(a) * r * 1.0 + bob, 5 + b.glow * 4); ctx.fill(); ctx.globalAlpha = b.alpha; }
      break;
    }
    case 'beast': case 'spider': {
      ctx.rotate(f);
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(-r * 0.3, 0, r * 1.3, r * 0.95, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(-r * 0.25, 0, r * 1.1, r * 0.8, 0, 0, TAU); ctx.fill();
      if (b.shape === 'beast') { ctx.fillStyle = c2; for (let i = 0; i < 5; i++) { const x = -r * 1.0 + i * r * 0.38; ctx.beginPath(); ctx.moveTo(x - 6, -r * 0.2); ctx.lineTo(x, -r * 0.9 - (i % 2) * 5); ctx.lineTo(x + 6, -r * 0.2); ctx.fill(); } }
      else { ctx.fillStyle = c2; ctx.globalAlpha = b.alpha * 0.6; ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.lineTo(-r * 0.4, -r * 0.4); ctx.lineTo(0, 0); ctx.lineTo(-r * 0.4, r * 0.4); ctx.closePath(); ctx.fill(); ctx.globalAlpha = b.alpha; }
      ctx.fillStyle = body; circle(r * 0.85, 0, r * 0.55); ctx.fill();
      ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 1.0, -r * 0.4); ctx.quadraticCurveTo(r * 1.4, -r * 0.8, r * 1.7, -r * 0.5); ctx.moveTo(r * 1.0, r * 0.4); ctx.quadraticCurveTo(r * 1.4, r * 0.8, r * 1.7, r * 0.5); ctx.stroke();
      ctx.fillStyle = c2; circle(r * 1.1, -r * 0.18, 3.5); ctx.fill(); circle(r * 1.1, r * 0.18, 3.5); ctx.fill();
      if (b.shape === 'spider') { circle(r * 1.2, -r * 0.05, 2.5); ctx.fill(); circle(r * 1.2, r * 0.05, 2.5); ctx.fill(); }
      ctx.rotate(-f); break;
    }
    case 'golem': {
      ctx.fillStyle = dark; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9, rr = r * (0.9 + hash2(i, 7) * 0.25); i ? ctx.lineTo(cos(a) * rr, sin(a) * rr + bob) : ctx.moveTo(cos(a) * rr, sin(a) * rr + bob); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = body; ctx.beginPath();
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + 0.2, rr = r * (0.7 + hash2(i, 3) * 0.2); i ? ctx.lineTo(cos(a) * rr, sin(a) * rr + bob - 3) : ctx.moveTo(cos(a) * rr, sin(a) * rr + bob - 3); } ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c2; ctx.lineWidth = 2.5; ctx.globalAlpha = b.alpha * (0.6 + 0.4 * sin(gtime * 4)); ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.2); ctx.lineTo(0, r * 0.1); ctx.lineTo(r * 0.3, -r * 0.3); ctx.moveTo(0, r * 0.1); ctx.lineTo(r * 0.05, r * 0.5); ctx.stroke(); ctx.globalAlpha = b.alpha;
      for (const s of [1, -1]) { ctx.fillStyle = dark; circle(cos(f + s * 1.3) * r * 1.15, sin(f + s * 1.3) * r * 1.15 + bob, r * 0.42); ctx.fill(); }
      if (!D.skull && !D.oneEye) eyes(0, bob - 4, f, r * 0.8, c2); break;
    }
    case 'wyrm': {
      ctx.fillStyle = dark; circle(0, 0, r); ctx.fill(); ctx.fillStyle = body; circle(0, -2, r * 0.85); ctx.fill();
      ctx.rotate(f); ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.6); ctx.lineTo(r * 1.6, -r * 0.2); ctx.lineTo(r * 1.6, r * 0.2); ctx.lineTo(r * 0.5, r * 0.6); ctx.fill();
      ctx.fillStyle = '#e8dcc8'; for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(-r * 0.2, s * r * 0.6); ctx.lineTo(-r * 0.9, s * r * 1.1); ctx.lineTo(-r * 0.1, s * r * 0.35); ctx.fill(); }
      ctx.rotate(-f); eyes(0, -2, f, r, c2); break;
    }
    case 'eye': {
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + sin(b.wob * 2 + i) * 0.2; ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cos(a) * r * 0.8, sin(a) * r * 0.8); ctx.quadraticCurveTo(cos(a + 0.4) * r * 1.5, sin(a + 0.4) * r * 1.5, cos(a + sin(b.wob * 3 + i) * 0.5) * r * 2.0, sin(a + sin(b.wob * 3 + i) * 0.5) * r * 2.0); ctx.stroke(); }
      ctx.fillStyle = fl ? '#fff' : '#efe6dc'; circle(0, bob, r); ctx.fill(); ctx.strokeStyle = '#b07a7a'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i * 1.1; ctx.beginPath(); ctx.moveTo(cos(a) * r, sin(a) * r + bob); ctx.lineTo(cos(a + 0.3) * r * 0.6, sin(a + 0.3) * r * 0.6 + bob); ctx.stroke(); }
      const ix = cos(f) * r * 0.4, iy = sin(f) * r * 0.4 + bob; ctx.fillStyle = c2; circle(ix, iy, r * 0.45); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ix, iy, r * 0.12, r * 0.3 * (b.glow > 0 ? 0.5 : 1), f, 0, TAU); ctx.fill();
      break;
    }
  }
  drawDeco(D, 'front', f, hx, hy, hr, r, b.col, true);
  if (b.frozen > 0) { ctx.fillStyle = 'rgba(159,227,255,0.3)'; circle(0, 0, r + 4); ctx.fill(); }
  if (b.broken > 0) deathMark(0, -r - 16, 11);
  ctx.restore();
}
function drawWeapon(type, wa, push, el, pull) {
  const c = cos(wa), s = sin(wa), px = -s, py = c;
  const L = { sword: 30, dagger: 20, great: 44, axe: 32, spear: 50, hammer: 32, katana: 36, bow: 0, staff: 36 }[type];
  const b0 = 8 + push, b1 = b0 + L;
  ctx.lineCap = 'round';
  if (el) { ctx.strokeStyle = `rgba(${ELEM[el.k].rgb},${0.35 + 0.15 * sin(gtime * 12)})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(c * (b0 + 6), s * (b0 + 6)); ctx.lineTo(c * (b1 || 20), s * (b1 || 20)); ctx.stroke(); }
  if (type === 'bow') {
    const bx = c * 6, by = s * 6;
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, 15, wa - 1.25, wa + 1.25); ctx.stroke();
    const e1x = bx + cos(wa - 1.25) * 15, e1y = by + sin(wa - 1.25) * 15, e2x = bx + cos(wa + 1.25) * 15, e2y = by + sin(wa + 1.25) * 15, mx = bx + c * (4 - pull * 10), my = by + s * (4 - pull * 10);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(e1x, e1y); ctx.lineTo(mx, my); ctx.lineTo(e2x, e2y); ctx.stroke();
    if (pull > 0) { ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + c * 22, my + s * 22); ctx.stroke(); }
    return;
  }
  if (type === 'staff') {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-c * 8, -s * 8); ctx.lineTo(c * b1, s * b1); ctx.stroke();
    ctx.fillStyle = el ? ELEM[el.k].col : '#9fd8ff'; ctx.globalAlpha = 0.35; circle(c * b1, s * b1, 8); ctx.fill(); ctx.globalAlpha = 1; circle(c * b1, s * b1, 4); ctx.fill();
    return;
  }
  if (type === 'spear') {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c * (b0 - 14), s * (b0 - 14)); ctx.lineTo(c * b1, s * b1); ctx.stroke();
    ctx.fillStyle = '#d8d8e8'; ctx.beginPath(); ctx.moveTo(c * (b1 + 10), s * (b1 + 10)); ctx.lineTo(c * b1 + px * 4, s * b1 + py * 4); ctx.lineTo(c * b1 - px * 4, s * b1 - py * 4); ctx.fill();
    return;
  }
  const blade = '#d8d8e8';
  if (type === 'katana') { ctx.strokeStyle = blade; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c * b0, s * b0); ctx.quadraticCurveTo(c * (b0 + L / 2) + px * 3, s * (b0 + L / 2) + py * 3, c * b1, s * b1); ctx.stroke(); }
  else if (type === 'axe' || type === 'hammer') {
    ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c * b0, s * b0); ctx.lineTo(c * b1, s * b1); ctx.stroke();
    ctx.fillStyle = '#b8b8c8';
    if (type === 'axe') { ctx.beginPath(); ctx.moveTo(c * (b1 - 10) + px * 2, s * (b1 - 10) + py * 2); ctx.quadraticCurveTo(c * (b1 - 4) + px * 14, s * (b1 - 4) + py * 14, c * (b1 + 2) + px * 2, s * (b1 + 2) + py * 2); ctx.fill(); }
    else { ctx.save(); ctx.translate(c * b1, s * b1); ctx.rotate(wa); ctx.fillRect(-6, -8, 12, 16); ctx.restore(); }
  } else {
    ctx.strokeStyle = blade; ctx.lineWidth = type === 'great' ? 5 : type === 'dagger' ? 2.5 : 3; ctx.beginPath(); ctx.moveTo(c * b0, s * b0); ctx.lineTo(c * b1, s * b1); ctx.stroke();
  }
  if (type !== 'axe' && type !== 'hammer') { ctx.strokeStyle = '#7a6a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(c * b0 - px * 4, s * b0 - py * 4); ctx.lineTo(c * b0 + px * 4, s * b0 + py * 4); ctx.stroke(); }
}
function drawLoot() {
  for (const l of world.loot) {
    const rare = ['w', 'sh', 'ar', 'rg'].includes(l.item.kind) || l.spot, k = 0.8 + 0.2 * sin(gtime * 4 + l.ph);
    const g = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, (rare ? 22 : 14) * k);
    g.addColorStop(0, rare ? 'rgba(255,240,190,0.95)' : 'rgba(240,240,255,0.9)'); g.addColorStop(0.35, rare ? 'rgba(255,200,90,0.5)' : 'rgba(200,210,255,0.4)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = g; circle(l.x, l.y, (rare ? 22 : 14) * k); ctx.fill();
    if (R() < (rare ? 0.25 : 0.1)) parts.push({ x: l.x + rnd(-6, 6), y: l.y, vx: 0, vy: -26, life: 0.9, ml: 0.9, col: rare ? '#ffd166' : '#e8e8ff', sz: 1.8, type: 'spark' });
  }
}
function deathMark(x, y, s) {
  const p = 1 + 0.15 * sin(gtime * 10);
  ctx.save(); ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(x, y, 1, x, y, s * 2.4 * p); g.addColorStop(0, 'rgba(255,40,40,0.9)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = g; circle(x, y, s * 2.4 * p); ctx.fill();
  ctx.fillStyle = '#d0101a'; circle(x, y, s * p); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; circle(x, y, s * p); ctx.stroke();
  ctx.restore();
}
function postBar(x, y, w, k) {
  k = clamp(k, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 4);
  ctx.fillStyle = k > 0.75 ? '#ff8a3a' : '#ffd166'; ctx.fillRect(x - w / 2 * k, y, w * k, 2);
}
function drawPlayer() {
  const p = P; if (p.dead && deadT > 0.6) return;
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.dead) ctx.globalAlpha = 1 - deadT / 0.6;
  const a = p.act, f = p.face;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(2, 10, 15, 7, 0, 0, TAU); ctx.fill();
  if (p.iframe > 0 && !a && Math.floor(gtime * 20) % 2 === 0) ctx.globalAlpha = 0.5;
  if (a && a.type === 'roll') {
    const k = a.t / a.dur; ctx.rotate(atan2(a.dy, a.dx)); ctx.scale(1.15, 0.8);
    ctx.fillStyle = '#2a2c3a'; circle(0, 0, p.r); ctx.fill(); ctx.strokeStyle = '#6d6a80'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, k * 12, k * 12 + 4); ctx.stroke();
    ctx.restore(); return;
  }
  const ARm = curAr(), SH = curSh(), WD = curWD(), body = ARm ? ARm.col : '#2a2c3a';
  // capa
  ctx.fillStyle = '#3b1e24'; ctx.beginPath(); ctx.ellipse(-cos(f) * 7, -sin(f) * 7, 14, 12, f, 0, TAU); ctx.fill();
  ctx.fillStyle = shadeHex(body, -25); circle(0, 0, p.r); ctx.fill();
  ctx.fillStyle = body; circle(cos(f) * 2, sin(f) * 2 - 1, p.r * 0.75); ctx.fill();
  ctx.fillStyle = ARm && ARm.def > 0.2 ? '#9aa0a8' : '#8f8a99'; circle(cos(f) * 5, sin(f) * 5 - 1, 5.5); ctx.fill();
  ctx.fillStyle = '#ffb347'; circle(cos(f) * 8 - sin(f) * 2, sin(f) * 8 + cos(f) * 2 - 1, 1.3); ctx.fill(); circle(cos(f) * 8 + sin(f) * 2, sin(f) * 8 - cos(f) * 2 - 1, 1.3); ctx.fill();
  // escudo
  if (SH) {
    const sa = f - 1.2, big = SH.wt > 10 ? 9.5 : SH.wt < 2 ? 5 : 6.5;
    ctx.fillStyle = SH.abs > 0.9 ? '#8a7448' : '#5c4a32'; circle(cos(sa) * 12, sin(sa) * 12, big); ctx.fill(); ctx.strokeStyle = '#c0a870'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // arma
  const wt = WD.type, ranged = WT[wt].ranged;
  let wa = f + 0.9, push = 0;
  if (ranged) wa = f + (a && (a.type === 'atk' || a.type === 'heavy') ? 0 : 0.5);
  if (a && (a.type === 'atk' || a.type === 'heavy') && !ranged) {
    const dir = a.type === 'atk' && a.combo % 2 === 1 ? -1 : 1, k = clamp((a.t - a.h0) / (a.h1 - a.h0), 0, 1);
    if (a.thrust) { wa = f; push = a.t < a.h0 ? -6 * (a.t / a.h0) : a.t <= a.h1 + 0.05 ? 14 * sin(k * PI) + 4 : 0; }
    else if (a.spin) { wa = a.t < a.h0 ? f + 1.2 * (a.t / a.h0) : f + 1.2 + TAU * k; }
    else if (a.aoe) { wa = a.t < a.h0 ? f + PI * 0.9 * (a.t / a.h0) : f; }
    else {
      if (a.t < a.h0) wa = f + dir * (a.arc / 2 + 0.3) * (a.t / a.h0);
      else if (a.t <= a.h1) wa = f + dir * (a.arc / 2 - a.arc * k);
      else wa = f - dir * a.arc / 2;
    }
    if (!a.thrust && !a.aoe && a.t >= a.h0 && a.t <= a.h1 + 0.08) {
      ctx.fillStyle = a.el ? `rgba(${ELEM[a.el.k].rgb},0.35)` : a.type === 'heavy' ? 'rgba(255,210,140,0.35)' : 'rgba(230,230,255,0.3)';
      ctx.beginPath(); const s0 = a.spin ? f : f + dir * a.arc / 2, s1 = a.spin ? f + TAU * k : f + dir * (a.arc / 2 - a.arc * k);
      ctx.arc(0, 0, a.range, Math.min(s0, s1), Math.max(s0, s1)); ctx.arc(0, 0, a.range * 0.45, Math.max(s0, s1), Math.min(s0, s1), true); ctx.fill();
    }
    if (a.thrust && a.t >= a.h0 && a.t <= a.h1) { ctx.strokeStyle = 'rgba(230,230,255,0.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cos(f) * 20, sin(f) * 20); ctx.lineTo(cos(f) * a.range, sin(f) * a.range); ctx.stroke(); }
  }
  if (a && a.type === 'guard') wa = f - 0.15;
  if (a && (a.type === 'heal' || a.type === 'item')) { if (a.type === 'heal') { ctx.fillStyle = `rgba(255,179,71,${0.3 + 0.3 * sin(gtime * 20)})`; circle(0, 0, 22); ctx.fill(); } wa = f + 1.6; }
  const pull = a && ranged && wt === 'bow' && a.t < a.h0 ? a.t / a.h0 : 0;
  drawWeapon(wt, wa, push, curEl(), pull);
  if (a && a.type === 'guard') {
    const perfect = a.t <= a.win;
    ctx.strokeStyle = perfect ? 'rgba(255,230,140,0.95)' : 'rgba(200,210,230,0.7)'; ctx.lineWidth = perfect ? 4 : 3;
    ctx.beginPath(); ctx.arc(0, 0, 21, f - 1.0, f + 1.0); ctx.stroke();
  }
  ctx.restore();
  if (!p.dead && p.post > 1) postBar(p.x, p.y - 26, 40, p.post / maxPost());
}
function drawProj() {
  for (const p of projs) {
    ctx.strokeStyle = p.col; ctx.globalAlpha = 0.35; ctx.lineWidth = p.r; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < p.trail.length; i += 2) i ? ctx.lineTo(p.trail[i], p.trail[i + 1]) : ctx.moveTo(p.trail[i], p.trail[i + 1]);
    ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.globalAlpha = 1;
    if (p.bomb) { ctx.fillStyle = '#2a2020'; circle(p.x, p.y, 6); ctx.fill(); ctx.fillStyle = R() < 0.5 ? '#ffd166' : '#ff8c3a'; circle(p.x + 3, p.y - 5, 2.5); ctx.fill(); continue; }
    if (p.arrow) { const a = atan2(p.vy, p.vx); ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - cos(a) * 12, p.y - sin(a) * 12); ctx.lineTo(p.x + cos(a) * 4, p.y + sin(a) * 4); ctx.stroke(); }
    else { ctx.fillStyle = p.col; circle(p.x, p.y, p.r); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(p.x, p.y, p.r * 0.45); ctx.fill(); }
  }
}
function drawParts(ui) {
  for (const p of parts) {
    if (!!p.ui !== ui) continue;
    const k = p.life / p.ml;
    if (p.type === 'ring') { ctx.globalAlpha = k; ctx.strokeStyle = p.col; ctx.lineWidth = 4 * k + 1; circle(p.x, p.y, p.r * (1.15 - 0.4 * k)); ctx.stroke(); continue; }
    if (p.type === 'dust') { ctx.globalAlpha = k * 0.6; ctx.fillStyle = p.col; circle(p.x, p.y, p.sz * (2 - k)); ctx.fill(); }
    else if (p.type === 'soul') { ctx.globalAlpha = 0.9; ctx.fillStyle = p.col; circle(p.x, p.y, p.sz); ctx.fill(); ctx.globalAlpha = 0.25; circle(p.x, p.y, p.sz * 2.5); ctx.fill(); }
    else if (p.type === 'ember') { ctx.globalAlpha = Math.min(1, k * 2) * 0.8; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
    else if (p.type === 'fire') { ctx.globalAlpha = k * 0.8; ctx.fillStyle = p.col; circle(p.x, p.y, p.sz * (0.5 + k)); ctx.fill(); }
    else { ctx.globalAlpha = k; ctx.fillStyle = p.col; ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
  }
  ctx.globalAlpha = 1;
}
function drawStain() {
  const s = world.stain; if (!s) return;
  const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26 + sin(gtime * 4) * 4);
  g.addColorStop(0, 'rgba(200,255,230,0.95)'); g.addColorStop(0.4, 'rgba(90,220,170,0.5)'); g.addColorStop(1, 'rgba(90,220,170,0)');
  ctx.fillStyle = g; circle(s.x, s.y, 32); ctx.fill();
  if (R() < 0.2) parts.push({ x: s.x + rnd(-8, 8), y: s.y, vx: 0, vy: -30, life: 1, ml: 1, col: '#9fe7c9', sz: 2, type: 'spark' });
}

/* ---------- HUD ---------- */
function txt(s, x, y, size, col, align, font, alpha) {
  ctx.font = `${font || ''} ${size}px Georgia, 'Times New Roman', serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(s, x + 1.5, y + 1.5); ctx.fillStyle = col; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
}
function bar(x, y, w, h, v, trail, col, bg) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg || '#1a1214'; ctx.fillRect(x, y, w, h);
  if (trail !== null) { ctx.fillStyle = '#e8d9b0'; ctx.fillRect(x, y, w * clamp(trail, 0, 1), h); }
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(v, 0, 1), h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, w * clamp(v, 0, 1), h * 0.4);
}
function soulIcon(x, y, s) { ctx.fillStyle = '#9fe7c9'; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x + s, y, x, y + s); ctx.quadraticCurveTo(x - s, y, x, y - s); ctx.fill(); ctx.globalAlpha = 0.3; circle(x, y, s * 1.6); ctx.fill(); ctx.globalAlpha = 1; }
function drawHUD() {
  const sx = 16 + (W > 900 ? 10 : 0), sy = 14;
  const hw = Math.min(150 + (S.at.vig - 10) * 9, W * 0.38), sw = Math.min(130 + (S.at.end - 10) * 8, W * 0.34), mw = Math.min(90 + (S.at.int - 8) * 8, W * 0.3);
  bar(sx, sy, hw, 11, P.hp / maxHp(), P.hpTrail / maxHp(), '#a3202a');
  bar(sx, sy + 17, sw, 7, P.st / maxSt(), null, '#3e8e4e');
  bar(sx, sy + 29, mw, 4, P.mp / maxMp(), null, '#3a6ad1');
  // frascos
  for (let i = 0; i < flaskMax(); i++) {
    const x = sx + 8 + i * 17, y = sy + 50, full = i < P.flasks;
    ctx.fillStyle = full ? '#ff9a3c' : '#2a2224'; ctx.beginPath(); ctx.moveTo(x - 3, y - 9); ctx.lineTo(x + 3, y - 9); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x + 6, y + 2); ctx.arc(x, y + 3, 6, 0.2, PI - 0.2); ctx.lineTo(x - 3, y - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6b5a40'; ctx.lineWidth = 1; ctx.stroke();
  }
  // arma, item e efeitos
  const wi = curW(); let hy = sy + 70;
  txt(`${curWD().name}${wi.up ? ' +' + wi.up : ''}`, sx, hy, 11, '#cfc3a6'); hy += 15;
  const q = quickItem();
  if (!TOUCH) { txt(q ? `Item: ${ITEMS[q].name} x${S.inv.it[q]}  (R usar · F trocar)` : 'Sem itens', sx, hy, 11, '#a3957a'); hy += 15; }
  if (P.buff) { txt(`${ELEM[P.buff.k].name} na arma ${Math.ceil(P.buff.t)}s`, sx, hy, 11, ELEM[P.buff.k].col); hy += 15; }
  if (P.erva > 0) { txt(`Erva Verde ${Math.ceil(P.erva)}s`, sx, hy, 11, '#8aff6a'); hy += 15; }
  notices.forEach((n, i) => txt(n.t, sx, H * 0.42 + i * 20, 13, n.col, 'left', '', clamp(n.life, 0, 1)));
  // almas
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W - 170, 12, 100, 26);
  soulIcon(W - 156, 25, 7); txt(String(S.souls), W - 76, 25, 15, '#e8f5ee', 'right');
  // pause
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(W - 52, 10, 38, 30); ctx.fillStyle = '#d6cbb0'; ctx.fillRect(W - 41, 17, 5, 16); ctx.fillRect(W - 30, 17, 5, 16);
  txt(world.isBoss ? `Fase ${world.n} · Chefe` : `Fase ${world.n}`, W / 2, 20, 13, '#b8ad94', 'center');
  if (!world.isBoss) txt(world.open ? 'Siga para o portal ao norte' : `Inimigos: ${enemies.length}`, W / 2, 38, 11, world.open ? '#9fe7c9' : '#8a826f', 'center');
  // chefes
  const bl = bosses.filter(b => b.awake);
  bl.forEach((b, i) => {
    const bw = TOUCH ? Math.min(W * 0.4, 420) : Math.min(W * 0.62, 560), bx = (W - bw) / 2, by = TOUCH ? 62 + i * 34 : H - 34 - (bl.length - 1 - i) * 36;
    txt(b.name + (b.p2 ? ' ✦' : ''), bx, by - 11, 13, '#e8d9b0');
    bar(bx, by, bw, 9, b.hp / b.mhp, null, b.p2 ? '#c0392b' : '#8e1b22');
    { const k = clamp(b.post / b.mpost, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx + bw * 0.2, by + 12, bw * 0.6, 5); ctx.fillStyle = b.broken > 0 ? '#ff4a4a' : k > 0.75 ? '#ff8a3a' : '#ffd166'; ctx.fillRect(bx + bw / 2 - bw * 0.3 * k, by + 13, bw * 0.6 * k, 3); }
  });
  // alvo travado
  if (lockT) {
    const x = (lockT.x - cam.x) * SC, y = (lockT.y - cam.y) * SC, r = (lockT.r + 8) * SC;
    ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const a = gtime * 1.5 + i * PI / 2; ctx.beginPath(); ctx.arc(x, y, r, a, a + 0.6); ctx.stroke(); }
    ctx.fillStyle = '#fff'; circle(x, y, 2.5); ctx.fill();
    if (!lockT.isBoss) txt(lockT.name, x, y - r - 10, 12, '#e8d9b0', 'center');
  }
}
function drawControls() {
  if (!TOUCH) {
    txt('WASD mover · J ataque · K forte · I defesa · Espaço rolar · E curar · R item · F trocar · B inventário · Q mira', W / 2, H - 12, 11, 'rgba(200,190,170,0.55)', 'center');
    return;
  }
  if (joy.id !== null) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; circle(joy.ox, joy.oy, 55); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = hyp(dx, dy), k = d > 55 ? 55 / d : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; circle(joy.ox + dx * k, joy.oy + dy * k, 24); ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; circle(110, H - 100, 50); ctx.stroke();
    txt('mover', 110, H - 100, 11, 'rgba(255,255,255,0.25)', 'center');
  }
  for (const b of ctrlButtons()) {
    const held = btnHeld[b.id] !== undefined;
    ctx.fillStyle = held ? 'rgba(255,220,160,0.35)' : 'rgba(20,16,18,0.45)'; circle(b.x, b.y, b.r); ctx.fill();
    ctx.strokeStyle = b.id === 'lock' && lockT ? 'rgba(255,209,102,0.9)' : 'rgba(232,217,176,0.45)'; ctx.lineWidth = 2; ctx.stroke();
    let label = b.label; if (b.id === 'heal') label = `CURA ${P.flasks}`;
    if (b.id === 'item') { const q = quickItem(); label = q ? `${ITEMS[q].short} ${S.inv.it[q]}` : '—'; }
    txt(label, b.x, b.y, Math.max(9, b.r * 0.32), 'rgba(240,230,210,0.85)', 'center');
  }
}
function drawBanner() {
  if (!banner) return;
  const b = banner, a = Math.min(1, b.t, (b.boss ? 3.5 : 4.5) - b.t + 0.2);
  const y = b.boss ? H * 0.72 : H * 0.32;
  ctx.globalAlpha = clamp(a, 0, 1) * 0.6; ctx.fillStyle = '#000'; ctx.fillRect(0, y - 34, W, 70); ctx.globalAlpha = 1;
  txt(b.text, W / 2, y - 6, Math.min(34, W / 18), b.col, 'center', '', clamp(a, 0, 1));
  if (b.sub) txt(b.sub, W / 2, y + 22, 14, '#b8ad94', 'center', 'italic', clamp(a, 0, 1));
}

function button(x, y, w, h, label, fn, opt) {
  opt = opt || {};
  uiButtons.push({ x, y, w, h, fn });
  ctx.fillStyle = opt.dim ? 'rgba(40,34,30,0.4)' : 'rgba(30,22,20,0.7)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = opt.dim ? 'rgba(120,110,90,0.4)' : (opt.hot ? '#ffd166' : 'rgba(232,217,176,0.6)'); ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  txt(label, x + w / 2, y + h / 2 + 1, opt.size || 16, opt.dim ? '#6f665a' : (opt.hot ? '#ffd166' : '#e8d9b0'), 'center');
}
function drawFire(cx, cy, s) {
  ctx.fillStyle = '#2a2018'; ctx.fillRect(cx - 30 * s, cy + 6 * s, 60 * s, 10 * s);
  ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(cx - 28 * s, cy + 12 * s); ctx.lineTo(cx + 26 * s, cy + 2 * s); ctx.moveTo(cx + 28 * s, cy + 12 * s); ctx.lineTo(cx - 26 * s, cy + 2 * s); ctx.stroke();
  ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(cx + 4 * s, cy + 10 * s); ctx.lineTo(cx - 6 * s, cy - 50 * s); ctx.stroke();
  for (let i = 0; i < 14; i++) {
    const t = (gtime * 1.6 + i / 14) % 1, x = cx + sin(i * 7.3 + gtime * 3) * 14 * s * (1 - t), y = cy - t * 70 * s, r = (16 - t * 14) * s;
    ctx.fillStyle = t < 0.3 ? 'rgba(255,240,180,0.8)' : t < 0.6 ? 'rgba(255,150,40,0.6)' : 'rgba(200,60,20,0.4)'; circle(x, y, Math.max(1, r)); ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, cy - 20 * s, 5, cx, cy - 20 * s, 180 * s); g.addColorStop(0, 'rgba(255,150,50,0.25)'); g.addColorStop(1, 'rgba(255,150,50,0)'); ctx.fillStyle = g; circle(cx, cy - 20 * s, 180 * s); ctx.fill();
}
/* ---------- interface: menus, inventário, fogueira ---------- */
let ui = { tab: 'w', sel: 0, page: 0, bpage: 'main', invFrom: 'pause', cls: 0, shopSel: 0, shopPage: 0, smSel: 0, smPage: 0 };
function panel(x, y, w, h) { ctx.fillStyle = 'rgba(18,14,16,0.82)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(232,217,176,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
function wrapTxt(s, x, y, maxW, size, col, lh, font) {
  ctx.font = `${font || ''} ${size}px Georgia, serif`; const words = s.split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { txt(line, x, y, size, col, 'left', font); y += lh; line = w; } else line = t; }
  if (line) { txt(line, x, y, size, col, 'left', font); y += lh; }
  return y;
}
function listUI(x, y, w, rowH, rows, sel, page, perPage, onSel, onPage) {
  const pages = Math.max(1, Math.ceil(rows.length / perPage)); page = clamp(page, 0, pages - 1);
  if (!rows.length) txt('(vazio)', x + 10, y + 16, 13, '#6f665a');
  for (let i = 0; i < perPage; i++) {
    const idx = page * perPage + i; if (idx >= rows.length) break;
    const r = rows[idx], yy = y + i * rowH, on = idx === sel;
    ctx.fillStyle = on ? 'rgba(255,209,102,0.16)' : 'rgba(255,255,255,0.035)'; ctx.fillRect(x, yy, w, rowH - 3);
    if (on) { ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, yy + 0.5, w - 1, rowH - 4); }
    uiButtons.push({ x, y: yy, w, h: rowH - 3, fn: () => onSel(idx) });
    const two = !!r.sub;
    txt(r.label, x + 10, yy + (two ? rowH * 0.34 : rowH * 0.47), 13.5, r.col || '#e8d9b0');
    if (two) txt(r.sub, x + 10, yy + rowH * 0.7, 10.5, r.scol || '#a3957a');
    if (r.right) txt(r.right, x + w - 8, yy + rowH * 0.47, 12.5, r.rcol || '#e8d9b0', 'right');
    if (r.eq) { ctx.fillStyle = '#ffd166'; ctx.fillRect(x, yy, 3, rowH - 3); }
  }
  if (pages > 1) {
    const by = y + perPage * rowH + 2, bw = (w - 60) / 2;
    button(x, by, bw, 26, '▲', () => onPage(Math.max(0, page - 1)), { size: 13, dim: page === 0 });
    txt(`${page + 1}/${pages}`, x + w / 2, by + 13, 12, '#a3957a', 'center');
    button(x + w - bw, by, bw, 26, '▼', () => onPage(Math.min(pages - 1, page + 1)), { size: 13, dim: page >= pages - 1 });
  }
}
/* Descrição detalhada de qualquer item. */
function itemDetails(kind, id, x, y, w, up) {
  const L = (t, c, z) => { y = wrapTxt(t, x, y, w, z || 12.5, c || '#cfc3a6', (z || 12.5) + 5); };
  if (kind === 'w') {
    const d = WEAPONS[id], wi = { id, up: up || 0 }, req = wReq(d);
    txt(d.name + (up ? ' +' + up : ''), x, y, 17, d.boss ? '#ffd166' : '#e8d9b0'); y += 24;
    L(`${WT[d.type].name}   ·   Peso ${d.wt}`, '#a3957a');
    L(`Ataque: ${Math.round(weaponAR(wi))}`, reqOk(d) ? '#e8f5ee' : '#ff8a80', 14);
    L(`Escala: ${scText(d)}`);
    const rs = Object.keys(req).map(k => `${STAT_SHORT[k]} ${req[k]}`).join('  ');
    L(`Requisitos: ${rs || '—'}${reqOk(d) ? '' : '  (não atendidos: -40% dano)'}`, reqOk(d) ? '#cfc3a6' : '#ff8a80');
    if (d.el) L(`Elemento: ${ELEM[d.el].name}`, ELEM[d.el].col);
    L(WT[d.type].tip, '#a3957a', 11.5);
    if (d.desc) L(d.desc, '#bfb08a', 11.5);
  } else if (kind === 'sh') {
    const d = SHIELDS[id]; txt(d.name, x, y, 17, '#e8d9b0'); y += 24;
    L(`Absorção: ${Math.round(d.abs * 100)}%   ·   Estabilidade: ${Math.round(d.stab * 100)}`);
    L(`Peso ${d.wt}   ·   Aparo: ${d.parry > 0 ? '+' : ''}${Math.round(d.parry * 1000)}ms`, '#a3957a');
    L('Escudos reduzem o dano e a postura perdida ao bloquear. Escudos leves facilitam aparar.', '#a3957a', 11.5);
  } else if (kind === 'ar') {
    const d = ARMORS[id]; txt(d.name, x, y, 17, '#e8d9b0'); y += 24;
    L(`Defesa: ${Math.round(d.def * 100)}%   ·   Peso ${d.wt}`);
    if (d.post) L(`Postura: +${d.post}`);
    if (d.perk) L(PERKS[d.perk], '#9fe7c9');
    L('Armaduras pesadas protegem mais, mas deixam o rolamento lento.', '#a3957a', 11.5);
  } else if (kind === 'rg') {
    const d = RINGS[id]; txt(d.name, x, y, 17, '#e8d9b0'); y += 24; L(d.desc);
  } else if (kind === 'it') {
    const d = ITEMS[id]; txt(d.name, x, y, 17, '#e8d9b0'); y += 24; L(d.desc); L(`Você tem: ${S.inv.it[id] || 0}`, '#a3957a');
  } else if (kind === 'tit') {
    txt('Fragmento de Titanita', x, y, 17, '#9fd8ff'); y += 24; L('Material do ferreiro, usado para reforçar armas.'); L(`Você tem: ${S.inv.tit}`, '#a3957a');
  }
  return y;
}
function loadLine(x, y) {
  const lc = loadClass();
  txt(`Carga ${curLoad().toFixed(1)} / ${maxLoad().toFixed(0)}  (${LOADN[lc]})`, x, y, 12, ['#9fe7c9', '#e8d9b0', '#ffb347', '#ff6b6b'][lc]);
}
function openInv(from) {
  ui.invFrom = from; ui.sel = 0; ui.page = 0; state = 'inv';
}
function closeInv() {
  if (P) { P.hp = Math.min(P.hp, maxHp()); P.st = Math.min(P.st, maxSt()); P.mp = Math.min(P.mp, maxMp()); }
  persist(); state = ui.invFrom === 'bonfire' ? 'bonfire' : ui.invFrom === 'play' ? 'play' : 'pause';
}
function invRows(tab) {
  if (tab === 'w') return S.inv.w.map((wi, i) => { const d = WEAPONS[wi.id]; return { label: d.name + (wi.up ? ' +' + wi.up : ''), sub: `${WT[d.type].name} · Ataque ${Math.round(weaponAR(wi))}${d.el ? ' · ' + ELEM[d.el].name : ''}`, eq: i === S.eq.w, col: d.boss ? '#ffd166' : null }; });
  if (tab === 'sh') return S.inv.sh.map((id, i) => ({ label: SHIELDS[id].name, sub: `Absorção ${Math.round(SHIELDS[id].abs * 100)}% · Peso ${SHIELDS[id].wt}`, eq: i === S.eq.sh }));
  if (tab === 'ar') return S.inv.ar.map((id, i) => ({ label: ARMORS[id].name, sub: `Defesa ${Math.round(ARMORS[id].def * 100)}% · Peso ${ARMORS[id].wt}`, eq: i === S.eq.ar }));
  if (tab === 'rg') return S.inv.rg.map((id, i) => ({ label: RINGS[id].name, sub: RINGS[id].desc, eq: i === S.eq.r1 || i === S.eq.r2, right: i === S.eq.r1 ? 'I' : i === S.eq.r2 ? 'II' : '' }));
  if (tab === 'it') { const r = Object.keys(ITEMS).filter(k => S.inv.it[k] > 0).map(k => ({ label: ITEMS[k].name, right: 'x' + S.inv.it[k], eq: S.quick === k, id: k })); if (S.inv.tit) r.push({ label: 'Fragmento de Titanita', right: 'x' + S.inv.tit, col: '#9fd8ff', id: 'tit' }); return r; }
  return [];
}
function drawInv() {
  ctx.fillStyle = '#0a080b'; ctx.fillRect(0, 0, W, H); drawParts(true);
  const tabs = [['w', 'Armas'], ['sh', 'Escudos'], ['ar', 'Armaduras'], ['rg', 'Anéis'], ['it', 'Itens'], ['st', 'Status']];
  const tw = Math.min(104, (W - 24) / 6 - 4);
  tabs.forEach(([k, n], i) => button(12 + i * (tw + 4), 8, tw, 30, n, () => { ui.tab = k; ui.sel = 0; ui.page = 0; }, { size: 12.5, hot: ui.tab === k }));
  const lx = 12, ly = 48, lw = Math.min(W * 0.44, 420), rowH = 38, perPage = Math.max(3, Math.floor((H - ly - 84) / rowH));
  const rx = lx + lw + 14, rw = W - rx - 12;
  button(W - 112, H - 40, 100, 32, 'Voltar', closeInv, { size: 14 });
  loadLine(lx, H - 24);
  soulIcon(rx + 8, H - 24, 6); txt(String(S.souls), rx + 20, H - 24, 13, '#e8f5ee');
  if (ui.tab === 'st') { drawStatusPanel(lx, ly, W - 24); return; }
  const rows = invRows(ui.tab);
  ui.sel = clamp(ui.sel, 0, Math.max(0, rows.length - 1));
  listUI(lx, ly, lw, rowH, rows, ui.sel, ui.page, perPage, i => { ui.sel = i; }, pg => { ui.page = pg; });
  panel(rx - 4, ly, rw + 4, H - ly - 50);
  if (!rows.length) return;
  const i = ui.sel, dx = rx + 8, dw = rw - 16; let y = ly + 18;
  const by = H - 92, bw = Math.min(150, (dw - 8) / 2);
  if (ui.tab === 'w') {
    const wi = S.inv.w[i]; y = itemDetails('w', wi.id, dx, y, dw, wi.up);
    if (i !== S.eq.w) button(dx, by, bw, 34, 'Equipar', () => { S.eq.w = i; P && (P.combo = 0); sfx('block'); if (!reqOk(WEAPONS[wi.id])) notice('Requisitos não atendidos: dano reduzido', '#ff8a80'); persist(); }, { hot: true, size: 14 });
    else txt('Equipada', dx, by + 17, 14, '#ffd166');
  } else if (ui.tab === 'sh' || ui.tab === 'ar') {
    const id = S.inv[ui.tab][i]; y = itemDetails(ui.tab, id, dx, y, dw);
    const on = S.eq[ui.tab] === i;
    button(dx, by, bw, 34, on ? 'Remover' : 'Equipar', () => { S.eq[ui.tab] = on ? -1 : i; sfx('block'); persist(); }, { hot: !on, size: 14 });
  } else if (ui.tab === 'rg') {
    const id = S.inv.rg[i]; y = itemDetails('rg', id, dx, y, dw);
    const in1 = S.eq.r1 === i, in2 = S.eq.r2 === i;
    if (in1 || in2) button(dx, by, bw, 34, 'Remover', () => { if (in1) S.eq.r1 = -1; if (in2) S.eq.r2 = -1; persist(); }, { size: 14 });
    else {
      button(dx, by, bw, 34, 'Espaço I', () => { S.eq.r1 = i; sfx('block'); persist(); }, { hot: true, size: 14 });
      button(dx + bw + 8, by, bw, 34, 'Espaço II', () => { S.eq.r2 = i; sfx('block'); persist(); }, { hot: true, size: 14 });
    }
  } else if (ui.tab === 'it') {
    const r = rows[i];
    if (r.id === 'tit') { itemDetails('tit', 'tit', dx, y, dw); return; }
    itemDetails('it', r.id, dx, y, dw);
    button(dx, by, bw, 34, S.quick === r.id ? 'No atalho' : 'Pôr no atalho', () => { S.quick = r.id; sfx('ui'); }, { hot: S.quick !== r.id, size: 13 });
    if (r.id === 'alma_p' || r.id === 'alma_g') button(dx + bw + 8, by, bw, 34, 'Consumir', () => { const v = r.id === 'alma_p' ? 200 : 1500; S.inv.it[r.id]--; S.souls += v; sfx('soul'); notice(`+${v} almas`, '#9fe7c9'); persist(); }, { size: 13 });
  }
}
function drawStatusPanel(x, y, w) {
  panel(x, y, w, H - y - 50);
  const c1 = x + 14, c2 = x + w * 0.5; let y1 = y + 20, y2 = y + 20;
  const cls = CLASSES.find(c => c.id === S.cls);
  txt(`Nível ${level()}  ·  ${cls ? cls.name : ''}`, c1, y1, 17, '#e8d9b0'); y1 += 28;
  for (const k of ['vig', 'end', 'str', 'dex', 'int']) { txt(STAT_NAMES[k], c1, y1, 14, '#cfc3a6'); txt(String(S.at[k]), c1 + 150, y1, 14, '#e8f5ee', 'right'); y1 += 22; }
  const wi = curW();
  const lines = [['Vida', Math.round(maxHp())], ['Estamina', Math.round(maxSt())], ['Mana', Math.round(maxMp())], ['Defesa', Math.round(defense() * 100) + '%'],
    ['Postura', Math.round(maxPost())], ['Ataque (' + curWD().name + ')', Math.round(weaponAR(wi))], ['Janela de aparo', Math.round(parryWin() * 1000) + ' ms'],
    ['Frascos de Brasa', flaskMax()], ['Chefes abatidos', S.bosses], ['Mortes', S.deaths]];
  for (const [a, b] of lines) { txt(a, c2, y2, 13, '#cfc3a6'); txt(String(b), x + w - 16, y2, 13, '#e8f5ee', 'right'); y2 += 20; }
}
/* ---------- fogueira ---------- */
function drawBonfire() {
  ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
  drawParts(true);
  if (ui.bpage === 'level') return drawLevelUp();
  if (ui.bpage === 'smith') return drawSmith();
  if (ui.bpage === 'shop') return drawShop();
  const fx = W * 0.25, fy = H * 0.66, s = Math.min(1.4, H / 380);
  drawFire(fx, fy, s);
  txt(bonfireFrom === 'death' ? 'Você retornou à fogueira' : bonfireFrom === 'osso' ? 'O osso te trouxe de volta' : 'Fogueira acesa', fx, H * 0.12, Math.min(24, W / 30), '#e8d9b0', 'center');
  const RN = realmOf(S.stage);
  txt(`Próxima: Fase ${S.stage}`, fx, H * 0.12 + 26, 13, '#a3957a', 'center', 'italic');
  txt(`${RN.name}`, fx, H * 0.12 + 46, 13, '#ffd166', 'center');
  txt(RN.myth, fx, H * 0.12 + 64, 12, '#a3957a', 'center', 'italic');
  if (S.lost) txt(`Almas perdidas na Fase ${S.lost.stage}: ${S.lost.amount}`, fx, H * 0.92, 12, '#9fe7c9', 'center');
  const px = W * 0.5, pw = Math.min(W * 0.46, 400); let y = Math.max(10, H * 0.05);
  panel(px - 10, y - 4, pw + 20, H - 2 * y + 8);
  txt(`Nível ${level()}`, px + 4, y + 16, 19, '#e8d9b0');
  soulIcon(px + pw - 100, y + 16, 7); txt(String(S.souls), px + pw - 4, y + 16, 16, '#e8f5ee', 'right');
  y += 38;
  const bh = Math.min(38, (H - y - 20) / 6 - 6);
  const items = [
    ['Subir de Nível', () => { ui.bpage = 'level'; }, S.souls >= lvlCost()],
    ['Inventário', () => openInv('bonfire')],
    ['Ferreiro', () => { ui.bpage = 'smith'; ui.smSel = S.eq.w; ui.smPage = 0; }, S.inv.tit > 0],
    ['Mercadora', () => { ui.bpage = 'shop'; ui.shopSel = 0; ui.shopPage = 0; }],
  ];
  for (const [l, fn, hot] of items) { button(px, y, pw, bh, l, fn, { size: 15, hot: !!hot }); y += bh + 6; }
  button(px, y, pw, bh, `Prosseguir — Fase ${S.stage}`, respawnFromBonfire, { hot: true, size: 15 }); y += bh + 6;
  button(px, y, pw, bh * 0.85, 'Menu principal', () => { state = 'menu'; menuPage = 'main'; }, { size: 12 });
}
function drawLevelUp() {
  const px = Math.max(12, (W - 560) / 2), pw = Math.min(560, W - 24); let y = 12;
  panel(px - 6, 6, pw + 12, H - 12);
  txt(`Nível ${level()}`, px + 6, y + 14, 19, '#e8d9b0');
  soulIcon(px + pw - 110, y + 14, 7); txt(String(S.souls), px + pw - 8, y + 14, 16, '#e8f5ee', 'right');
  y += 34; const cost = lvlCost(), can = S.souls >= cost;
  txt(`Custo: ${cost} almas   ·   Ataque atual: ${Math.round(weaponAR(curW()))} (${curWD().name})`, px + 6, y, 12.5, can ? '#9fe7c9' : '#8a826f');
  y += 16;
  const rows = [
    ['vig', `Vida ${maxHp()}`], ['end', `Estamina ${maxSt()} · Carga ${maxLoad().toFixed(0)}`], ['str', 'Dano de armas pesadas · requisitos'],
    ['dex', 'Dano de armas ágeis, arcos e katanas'], ['int', `Mana ${maxMp()} · dano mágico`],
  ];
  const rh = Math.min(48, (H - y - 56) / 5);
  for (const [k, desc] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px, y, pw, rh - 5);
    txt(`${STAT_NAMES[k]}`, px + 10, y + rh * 0.32, 15, '#e8d9b0'); txt(String(S.at[k]), px + 170, y + rh * 0.32, 15, '#e8f5ee', 'right');
    txt(desc, px + 10, y + rh * 0.68, 11, '#a3957a');
    button(px + pw - 52, y + 3, 46, rh - 11, '+', () => { if (S.souls >= lvlCost()) { S.souls -= lvlCost(); S.at[k]++; persist(); sfx('heal'); } }, { dim: !can, size: 20 });
    y += rh;
  }
  button(px, H - 46, 140, 34, 'Voltar', () => { ui.bpage = 'main'; }, { size: 14 });
}
function smithCost(up) { return { tit: up + 1, souls: 150 * (up + 1) }; }
function drawSmith() {
  const lx = 12, ly = 44, lw = Math.min(W * 0.44, 400), rowH = 38, perPage = Math.max(3, Math.floor((H - ly - 84) / rowH)), rx = lx + lw + 14, rw = W - rx - 12;
  txt('Ferreiro', 14, 22, 19, '#e8d9b0');
  txt(`Titanita: ${S.inv.tit}`, W / 2, 22, 13, '#9fd8ff', 'center'); soulIcon(W - 120, 22, 6); txt(String(S.souls), W - 14, 22, 14, '#e8f5ee', 'right');
  const rows = S.inv.w.map((wi, i) => ({ label: WEAPONS[wi.id].name + (wi.up ? ' +' + wi.up : ''), sub: `Ataque ${Math.round(weaponAR(wi))}`, eq: i === S.eq.w }));
  ui.smSel = clamp(ui.smSel, 0, rows.length - 1);
  listUI(lx, ly, lw, rowH, rows, ui.smSel, ui.smPage, perPage, i => { ui.smSel = i; }, pg => { ui.smPage = pg; });
  panel(rx - 4, ly, rw + 4, H - ly - 50);
  const wi = S.inv.w[ui.smSel], dx = rx + 8; let y = ly + 18;
  y = itemDetails('w', wi.id, dx, y, rw - 16, wi.up);
  if (wi.up >= 10) { txt('Reforço máximo (+10)', dx, H - 76, 14, '#ffd166'); }
  else {
    const c = smithCost(wi.up), ok = S.inv.tit >= c.tit && S.souls >= c.souls;
    const nx = Math.round(weaponAR({ id: wi.id, up: wi.up + 1 }));
    txt(`+${wi.up} → +${wi.up + 1}:  Ataque ${Math.round(weaponAR(wi))} → ${nx}`, dx, H - 112, 13, '#9fe7c9');
    txt(`Custo: ${c.tit} Titanita · ${c.souls} almas`, dx, H - 94, 12.5, ok ? '#cfc3a6' : '#ff8a80');
    button(dx, H - 80, Math.min(170, rw - 16), 32, 'Reforçar', () => { if (S.inv.tit >= c.tit && S.souls >= c.souls) { S.inv.tit -= c.tit; S.souls -= c.souls; wi.up++; persist(); sfx('deflect'); notice(`${WEAPONS[wi.id].name} +${wi.up}`, '#ffd166'); } }, { hot: ok, dim: !ok, size: 14 });
  }
  button(W - 112, H - 40, 100, 32, 'Voltar', () => { ui.bpage = 'main'; }, { size: 14 });
}
const SHOP = [
  ['it', 'bomba', 120], ['it', 'faca', 40], ['it', 'erva', 220], ['it', 'cristal', 200], ['it', 'resina_fogo', 300], ['it', 'resina_raio', 300], ['it', 'resina_gelo', 300], ['it', 'osso', 150], ['tit', 'tit', 450],
  ['w', 'adaga', 600], ['w', 'lanca', 900], ['w', 'machado', 1000], ['w', 'maca', 1200], ['w', 'arco', 900], ['w', 'cajado', 1500], ['w', 'espada_longa', 700],
  ['w', 'espadao', 2200, 1], ['w', 'katana', 2500, 1], ['w', 'arco_longo', 1800, 1],
  ['sh', 'escudo_madeira', 300], ['sh', 'broquel', 600], ['sh', 'escudo_torre', 3000, 2],
  ['ar', 'couro', 500], ['ar', 'malha', 1400], ['ar', 'manto_feit', 1200], ['ar', 'cavaleiro', 3000, 1], ['ar', 'placas', 5000, 3],
  ['rg', 'anel_pena', 2500, 1], ['rg', 'anel_carvalho', 3000, 1], ['rg', 'anel_aco', 3000, 2], ['rg', 'anel_gigante', 2500, 2], ['rg', 'anel_brasa', 4000, 3], ['rg', 'anel_cobica', 3500, 3], ['rg', 'anel_sabio', 3500, 2],
];
function shopStock() { return SHOP.filter(e => (e[3] || 0) <= S.bosses && !owns(e[0], e[1])); }
function drawShop() {
  const lx = 12, ly = 44, lw = Math.min(W * 0.44, 400), rowH = 34, perPage = Math.max(3, Math.floor((H - ly - 84) / rowH)), rx = lx + lw + 14, rw = W - rx - 12;
  txt('Mercadora de Cinzas', 14, 22, 19, '#e8d9b0'); soulIcon(W - 120, 22, 6); txt(String(S.souls), W - 14, 22, 14, '#e8f5ee', 'right');
  const st = shopStock();
  const rows = st.map(e => ({ label: itemName(e[0], e[1]), right: String(e[2]), rcol: S.souls >= e[2] ? '#9fe7c9' : '#8a5a5a', col: ['w', 'sh', 'ar', 'rg'].includes(e[0]) ? '#ffd166' : null }));
  ui.shopSel = clamp(ui.shopSel, 0, Math.max(0, rows.length - 1));
  listUI(lx, ly, lw, rowH, rows, ui.shopSel, ui.shopPage, perPage, i => { ui.shopSel = i; }, pg => { ui.shopPage = pg; });
  panel(rx - 4, ly, rw + 4, H - ly - 50);
  if (st.length) {
    const e = st[ui.shopSel], dx = rx + 8;
    itemDetails(e[0], e[1], dx, ly + 18, rw - 16);
    const ok = S.souls >= e[2];
    button(dx, H - 92, Math.min(190, rw - 16), 34, `Comprar · ${e[2]}`, () => { if (S.souls >= e[2]) { S.souls -= e[2]; addItem(e[0], e[1], 1); sfx('soul'); } }, { hot: ok, dim: !ok, size: 14 });
  }
  if (S.bosses < 3) txt('Derrote chefes para a mercadora trazer mais mercadorias.', lx, H - 24, 11.5, '#7d7262');
  button(W - 112, H - 40, 100, 32, 'Voltar', () => { ui.bpage = 'main'; }, { size: 14 });
}
/* ---------- menu principal e criação de personagem ---------- */
function drawMenu() {
  ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.9, 10, W / 2, H * 0.9, H); g.addColorStop(0, 'rgba(120,40,10,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawParts(true);
  if (menuPage === 'help') { drawHelp(); return; }
  if (menuPage === 'class') { drawClassSelect(); return; }
  const ts = Math.min(56, W / 13);
  txt('CINZAS ETERNAS', W / 2, H * 0.2, ts, '#e8d9b0', 'center', 'bold');
  txt('um soulslike pelas mitologias do mundo', W / 2, H * 0.2 + ts * 0.85, Math.max(13, ts * 0.32), '#a3957a', 'center', 'italic');
  const bw = Math.min(300, W * 0.6), bh = 44, bx = (W - bw) / 2; let by = H * 0.43;
  if (S.started) { button(bx, by, bw, bh, `Continuar — Fase ${S.stage}`, () => { P = newPlayer(); buildStage(S.stage); state = 'play'; }, { hot: true }); by += bh + 12; }
  button(bx, by, bw, bh, confirmNew > 0 ? 'Apagar progresso? Toque de novo' : 'Novo Jogo', () => {
    if (S.started && confirmNew <= 0) { confirmNew = 3; return; }
    confirmNew = 0; menuPage = 'class'; ui.cls = 0;
  }, { hot: !S.started }); by += bh + 12;
  button(bx, by, bw, bh, 'Como Jogar', () => { menuPage = 'help'; });
  if (S.started) txt(`Recorde: Fase ${S.best}   ·   Chefes abatidos: ${S.bosses}   ·   Mortes: ${S.deaths}`, W / 2, H - 22, 12, '#7d7262', 'center');
}
function drawClassSelect() {
  txt('Escolha sua origem', W / 2, 24, 20, '#e8d9b0', 'center');
  const lx = 12, ly = 46, lw = Math.min(W * 0.36, 300), rowH = Math.min(40, (H - ly - 16) / CLASSES.length), rx = lx + lw + 14, rw = W - rx - 12;
  listUI(lx, ly, lw, rowH, CLASSES.map(c => ({ label: c.name, right: 'Nv ' + (Object.values(c.at).reduce((a, b) => a + b, 0) - 40) })), ui.cls, 0, CLASSES.length, i => { ui.cls = i; }, () => { });
  const c = CLASSES[ui.cls]; panel(rx - 4, ly, rw + 4, H - ly - 10);
  const dx = rx + 10; let y = ly + 20;
  txt(c.name, dx, y, 19, '#ffd166'); y += 24;
  y = wrapTxt(c.desc, dx, y, rw - 20, 13, '#cfc3a6', 18) + 4;
  const cols = Math.min(5, Math.floor((rw - 20) / 74));
  ['vig', 'end', 'str', 'dex', 'int'].forEach((k, i) => { const cx = dx + (i % cols) * 76, cy = y + Math.floor(i / cols) * 20; txt(`${STAT_SHORT[k]} ${c.at[k]}`, cx, cy, 13, '#e8f5ee'); });
  y += 20 * Math.ceil(5 / cols) + 8;
  const eq = [...c.w.map(id => WEAPONS[id].name), ...(c.sh || []).map(id => SHIELDS[id].name), ...(c.ar || []).map(id => ARMORS[id].name), ...(c.rg || []).map(id => RINGS[id].name), ...Object.keys(c.it || {}).map(k => `${ITEMS[k].name} x${c.it[k]}`)];
  y = wrapTxt('Equipamento: ' + eq.join(', '), dx, y, rw - 20, 12, '#a3957a', 17);
  button(dx, H - 58, Math.min(180, rw / 2 - 10), 38, 'Começar', () => {
    S = newSave(); S.cls = c.id; S.at = Object.assign({}, c.at); giveKit(S, c); persist();
    P = newPlayer(); buildStage(1); state = 'play'; menuPage = 'main';
  }, { hot: true, size: 16 });
  button(rx + rw - Math.min(120, rw / 2 - 10), H - 58, Math.min(120, rw / 2 - 10), 38, 'Voltar', () => { menuPage = 'main'; }, { size: 14 });
}
function drawHelp() {
  const lines = [
    ['COMO JOGAR', '#e8d9b0', 26],
    ['Esquerda da tela: mover. ATAQUE / FORTE dependem da arma: cada tipo tem golpes próprios.', '#cfc3a6', 14],
    ['ROLAR: invencível durante o rolamento. Armadura pesada deixa o rolamento lento.', '#cfc3a6', 14],
    ['DEFESA: toque no instante do golpe DOURADO para aparar; segure para bloquear. VERMELHO (危): role.', '#ffd166', 14],
    ['Aparar quebra a POSTURA do inimigo: ponto vermelho = GOLPE FATAL. Ataque pelas costas = crítico.', '#ff8a80', 14],
    ['ITEM usa o item do atalho (⇄ troca): bombas, facas, resinas elementais, ervas, cristais de mana.', '#cfc3a6', 14],
    ['9 tipos de arma: espada, adaga, espadão, machado, lança, maça, katana, arco e cajado mágico.', '#ffd166', 14],
    ['Elementos: Fogo queima, Gelo congela, Raio eletrocuta, Veneno corrói, Sangue causa hemorragia.', '#cfc3a6', 14],
    ['Pegue os brilhos dourados no chão: armas, armaduras, escudos e anéis de cada mitologia.', '#ffd166', 14],
    ['Cada chefe deixa uma arma lendária única. Na fogueira: nível, inventário, ferreiro e mercadora.', '#cfc3a6', 14],
    ['Ao morrer você perde as almas, mas pode recuperá-las no local da morte.', '#9fe7c9', 14],
  ];
  const lh = Math.min(27, (H - 110) / lines.length); let y = Math.max(24, H * 0.06); const sc = Math.min(1, W / 900, lh / 20);
  for (const [s, c, z] of lines) { txt(s, W / 2, y, z * (z > 20 ? Math.min(1, lh / 22) : sc), c, 'center'); y += z > 20 ? lh * 1.4 : lh; }
  const bw = 200; button((W - bw) / 2, Math.min(y + 10, H - 60), bw, 42, 'Voltar', () => { menuPage = 'main'; });
}
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSADO', W / 2, H * 0.2, 32, '#e8d9b0', 'center');
  txt(`Fase ${world.n} — ${world.biome.name}`, W / 2, H * 0.2 + 32, 14, '#a3957a', 'center', 'italic');
  const bw = Math.min(280, W * 0.6), bx = (W - bw) / 2, bh = 40; let y = H * 0.36;
  button(bx, y, bw, bh, 'Retomar', () => { state = 'play'; }, { hot: true }); y += bh + 10;
  button(bx, y, bw, bh, 'Inventário', () => openInv('pause')); y += bh + 10;
  button(bx, y, bw, bh, 'Sair para o menu', () => { persist(); state = 'menu'; menuPage = 'main'; }); y += bh + 14;
  txt('Ao sair, a fase atual recomeça do início.', W / 2, y, 12, '#7d7262', 'center');
}
function drawDead() {
  const a = clamp((deadT - 0.4) / 1.2, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`; ctx.fillRect(0, H / 2 - 50, W, 100);
  txt('VOCÊ MORREU', W / 2, H / 2, Math.min(64, W / 10), '#9e1b22', 'center', '', a);
  if (deadT > 2.2) txt(TOUCH ? 'toque para continuar' : 'clique ou pressione Enter', W / 2, H / 2 + 62, 13, '#a3957a', 'center', 'italic', 0.5 + 0.5 * sin(gtime * 3));
  if (deadT > 2.2) uiButtons.push({ x: 0, y: 0, w: W, h: H, fn: () => goBonfire('death') });
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  uiButtons = [];
  if (confirmNew > 0) confirmNew -= 1 / 60;
  if (state === 'menu') { drawMenu(); return; }
  if (state === 'bonfire') { drawBonfire(); return; }
  if (state === 'inv') { drawInv(); return; }
  // mundo
  const sx = (R() - 0.5) * shake, sy = (R() - 0.5) * shake;
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (-cam.x * SC + sx), DPR * (-cam.y * SC + sy));
  drawFloor(); if (!world.isBoss) drawExit(); drawStain(); drawLoot(); drawObs(); drawHaz();
  const ents = [...enemies.map(e => [e.y, () => drawEnemy(e)]), ...bosses.map(b => [b.y, () => drawBoss(b)]), [P.y, drawPlayer]];
  ents.sort((a, b) => a[0] - b[0]); for (const e of ents) e[1]();
  drawProj(); drawParts(false);
  const peril = new Set();
  for (const h of hazards) if (!h.blk && h.owner && h.owner.hp > 0 && h.t < h.delay && !h.owner.air) peril.add(h.owner);
  for (const o of peril) {
    const y = o.y - o.r - (o.isBoss ? 34 : 22), k = 0.85 + 0.15 * sin(gtime * 14);
    ctx.fillStyle = 'rgba(160,0,10,0.85)'; circle(o.x, y, 11 * k); ctx.fill(); ctx.strokeStyle = '#ffb0a0'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `bold ${Math.round(13 * k)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('危', o.x, y + 1);
  }
  for (const f of floats) { ctx.globalAlpha = clamp(f.life * 1.5, 0, 1); ctx.font = `bold ${f.sz}px Georgia, serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(f.txt, f.x + 1, f.y + 1); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;
  // luz/vinheta
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const px = (P.x - cam.x) * SC, py = (P.y - cam.y) * SC;
  const vg = ctx.createRadialGradient(px, py, H * 0.25, px, py, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.68)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (flash > 0) { ctx.fillStyle = `rgba(160,0,10,${flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  drawHUD(); drawBanner();
  if (msg) txt(msg.text, W / 2, H * 0.2, 15, msg.col || '#e8d9b0', 'center', 'italic', clamp(msg.t, 0, 1));
  if (!P.dead) drawControls();
  if (P.dead) drawDead();
  if (state === 'pause') drawPauseOverlay();
}

/* ---------- integração Android ---------- */
window.androidBack = () => {
  if (state === 'play') { if (P && P.dead) return 'ok'; togglePause(); return 'ok'; }
  if (state === 'pause') { state = 'play'; return 'ok'; }
  if (state === 'inv') { closeInv(); return 'ok'; }
  if (state === 'bonfire') { if (ui.bpage !== 'main') ui.bpage = 'main'; else { state = 'menu'; menuPage = 'main'; } return 'ok'; }
  if (state === 'menu' && menuPage !== 'main') { menuPage = 'main'; return 'ok'; }
  return 'exit';
};
window.androidPause = () => { if (state === 'play' && P && !P.dead && victoryT <= 0) state = 'pause'; persist(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) window.androidPause(); });

/* depuração (testes automatizados) */
window.__game = { get state() { return state; }, get S() { return S; }, get P() { return P; }, get bosses() { return bosses; }, get enemies() { return enemies; }, get world() { return world; },
  start(n) { P = newPlayer(); buildStage(n); state = 'play'; }, get ui() { return ui; }, setState(v) { state = v; }, CLASSES, WEAPONS, addItem, giveKit, newSave, setS(v) { S = v; }, get notices() { return notices; }, get loot() { return world.loot; }, god() { P.hp = 1e9; }, ATK, STATS, get hazards() { return hazards; }, get projs() { return projs; },
  step(n, fn) { for (let i = 0; i < n; i++) { if (fn) fn(); update(1 / 60); } draw(); }, act, keys };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try { update(dt); draw(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
