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
};
function sfx(n) { try { SFX[n] && SFX[n](); } catch (e) { } }

/* ---------- salvamento ---------- */
const KEY = 'cinzas_eternas_v1';
function newSave() { return { stage: 1, checkpoint: 1, souls: 0, vit: 0, end: 0, str: 0, lost: null, best: 1, deaths: 0, bosses: 0, started: false }; }
let S = newSave();
try { const j = JSON.parse(localStorage.getItem(KEY)); if (j) S = Object.assign(newSave(), j); } catch (e) { }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
const maxHp = () => 100 + S.vit * 14, maxSt = () => 100 + S.end * 10;
const lightDmg = () => 14 + S.str * 3, heavyDmg = () => 32 + S.str * 6.5;
const flaskMax = () => Math.min(3 + Math.floor(S.bosses / 2), 8);
const level = () => 1 + S.vit + S.end + S.str, lvlCost = () => Math.round(60 * Math.pow(level(), 1.4));

/* ---------- dados do mundo ---------- */
/* ---------- reinos mitológicos ----------
   Cada reino = 3 fases (2 normais + 1 chefe). Os inimigos usam as mesmas IAs-base
   (hollow, hound, archer, knight, caster, brute) com nome e aparência do mito. */
const B_ = (name, epi, shape, o) => Object.assign({ name, epi, shape, r: 28, hp: 640, pref: 110, col: '#888', col2: '#f33', attacks: ['combo'], p2: ['roar'], minion: 'hollow', deco: {} }, o);
const REALMS = [
  { myth: 'Mitologia Grega', name: 'Labirinto de Creta', floor: '#1e1c19', tile: '#28251f', line: '#332f27', accent: '#e0c27a', obs: '#5a554b', obsTop: '#cfc6b0', obsKind: ['column', 'column', 'pillar'],
    skins: { hollow: { name: 'Hoplita Esqueleto', col: '#cfc6b0', deco: ['bones', 'helm'] }, hound: { name: 'Harpia', col: '#8a6a4a', deco: ['wings'] },
      archer: { name: 'Sátiro Arqueiro', col: '#7a5a3a', deco: ['horns'] }, knight: { name: 'Guardião de Bronze', col: '#b08d57', deco: ['helm'] },
      caster: { name: 'Lâmia', col: '#5a7a5a', deco: ['snakes'] }, brute: { name: 'Ciclope', col: '#9a8a76', deco: ['oneEye'] } },
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
  hollow: { name: 'Morto-vivo', r: 13, hp: 42, spd: 72, dmg: 14, range: 34, wind: 0.55, cd: 1.4, col: '#8a8070', souls: 15, kind: 'melee' },
  hound: { name: 'Cão Pútrido', r: 11, hp: 28, spd: 155, dmg: 11, range: 120, wind: 0.42, cd: 1.3, col: '#6e4b36', souls: 18, kind: 'lunge' },
  archer: { name: 'Arqueiro', r: 12, hp: 30, spd: 62, dmg: 12, range: 330, wind: 0.8, cd: 2.2, col: '#5a7060', souls: 20, kind: 'ranged' },
  knight: { name: 'Cavaleiro Oco', r: 16, hp: 115, spd: 56, dmg: 24, range: 46, wind: 0.8, cd: 1.8, col: '#707a88', souls: 45, kind: 'melee', poise: true },
  caster: { name: 'Clérigo Profano', r: 12, hp: 36, spd: 52, dmg: 17, range: 280, wind: 0.9, cd: 3.0, col: '#7a4a8a', souls: 35, kind: 'caster' },
  brute: { name: 'Bruto', r: 20, hp: 170, spd: 48, dmg: 30, range: 58, wind: 1.0, cd: 2.2, col: '#7d5a4a', souls: 70, kind: 'slam', poise: true },
};

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
    const m = { KeyJ: 'atk', KeyZ: 'atk', KeyK: 'heavy', KeyX: 'heavy', Space: 'roll', KeyL: 'roll', ShiftLeft: 'roll', KeyE: 'heal', KeyH: 'heal', KeyQ: 'lock', Tab: 'lock', Escape: 'pause', KeyP: 'pause' };
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
    { id: 'roll', label: 'ROLAR', x: W - 196 * s, y: H - 60 * s, r: 37 * s },
    { id: 'heavy', label: 'FORTE', x: W - 78 * s, y: H - 196 * s, r: 33 * s },
    { id: 'heal', label: 'CURA', x: W - 180 * s, y: H - 166 * s, r: 30 * s },
    { id: 'lock', label: 'MIRA', x: W - 52 * s, y: H - 284 * s, r: 25 * s },
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
  if (n === 'pause') { if (state === 'play' || state === 'pause') togglePause(); return; }
  if (state !== 'play' || !P || P.dead) return;
  if (n === 'lock') { toggleLock(); return; }
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
  return { x: 0, y: 0, r: 13, hp: maxHp(), st: maxSt(), face: -PI / 2, act: null, iframe: 0, stDelay: 0, flasks: flaskMax(), buf: null, dead: false, stag: 0, kvx: 0, vky: 0, kvy: 0, hpTrail: maxHp() };
}
function buildStage(n) {
  const rng = mulberry32(n * 7919 + 13);
  const isBoss = n % 3 === 0;
    const w = isBoss ? 1150 : 1250 + Math.min(n * 45, 950), h = isBoss ? 980 : 1000 + Math.min(n * 35, 700);
  world = { n, w, h, isBoss, biome: realmOf(n), obs: [], exit: { x: w / 2, y: 56, r: 40 }, open: false, stain: null, decals: [] };
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
  }
  for (let i = 0; i < 40; i++) world.decals.push({ x: rng() * w, y: rng() * h, r: 4 + rng() * 14, a: rng() * TAU, k: Math.floor(rng() * 3) });
  if (isBoss) bosses = makeBosses(n, rng);
  if (S.lost && S.lost.stage === n) world.stain = { x: S.lost.x, y: S.lost.y, amount: S.lost.amount };
  if (!P) P = newPlayer();
  P.x = w / 2; P.y = h - 90; P.face = -PI / 2; P.act = null; P.stag = 0; P.buf = null;
  cam.x = P.x - W / SC / 2; cam.y = P.y - H / SC / 2;
  banner = { text: isBoss ? `Fase ${n} · Covil do Chefe` : `Fase ${n}`, sub: `${world.biome.name} — ${world.biome.myth}`, t: 3.2, col: '#e8d9b0' };
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
    st: 'idle', t: 0, cd: rnd(0.3, 1.2), face: PI / 2, stag: 0, aggro: !!minion, souls: minion ? 5 : Math.round(d.souls * (1 + (n - 1) * 0.3)),
    flash: 0, minion: !!minion, wob: R() * TAU, broken: 0, ...skinOf(type) };
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
      attacks: attacks.slice(), p2atk: p2, p2: false, act: null, idle: 1.4 + i * 0.7, face: PI / 2, poise: 14 + n * 0.3, mpoise: 14 + n * 0.3,
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
  const h = Object.assign({ t: 0, delay: 0.5, active: 0.1, dmg: 10, col: '255,60,40', owner: null, hit: false, fired: false, kb: 170, tk: 0 }, o);
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
        else if (!h.hit && hazHits(h, P.x, P.y, P.r)) { if (hurtPlayer(h.dmg, h.x, h.y, h.kb)) h.hit = true; }
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
    if (p.accel) { p.vx *= 1 + p.accel * dt; p.vy *= 1 + p.accel * dt; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (p.x < 0 || p.y < 0 || p.x > world.w || p.y > world.h) p.life = 0;
    if (!p.ghost) for (const o of world.obs) if (hyp(p.x - o.x, p.y - o.y) < o.r + p.r) { p.life = 0; burst(p.x, p.y, 5, p.col, 90, 'spark'); }
    if (p.life > 0 && !P.dead && hyp(p.x - P.x, p.y - P.y) < p.r + P.r) {
      if (hurtPlayer(p.dmg, p.x - p.vx, p.y - p.vy, 110)) { p.life = 0; burst(p.x, p.y, 8, p.col, 120, 'spark'); }
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
function invuln(p) { return p.iframe > 0 || (p.act && p.act.type === 'roll' && p.act.t > 0.02 && p.act.t < 0.34); }
function hurtPlayer(dmg, sx, sy, kb, noStag) {
  if (P.dead || invuln(P)) return false;
  dmg = Math.round(dmg);
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
function startAct(n, mx, my) {
  const p = P, ml = hyp(mx, my);
  const aim = () => {
    if (lockT) p.face = atan2(lockT.y - p.y, lockT.x - p.x);
    else if (ml > 0.25) p.face = atan2(my, mx);
    else { const t = nearestTarget(150); if (t) p.face = atan2(t.y - p.y, t.x - p.x); }
  };
  if (n === 'atk' || n === 'heavy') {
    if (p.st <= 0) return false;
    aim();
    const heavy = n === 'heavy';
    p.act = heavy
      ? { type: 'heavy', t: 0, dur: 0.82, h0: 0.38, h1: 0.52, range: 76, arc: 2.5, dmg: heavyDmg(), poise: 3.5, hit: new Set(), combo: 0 }
      : { type: 'atk', t: 0, dur: 0.4, h0: 0.1, h1: 0.21, range: 60, arc: 2.0, dmg: lightDmg(), poise: 1, hit: new Set(), combo: p.combo || 0 };
    if (!heavy && p.act.combo === 2) { p.act.dmg *= 1.35; p.act.range += 8; p.act.poise = 2; }
    p.st -= heavy ? 32 : 17; p.stDelay = 0.55;
    p.combo = heavy ? 0 : (p.act.combo + 1) % 3;
    return true;
  }
  if (n === 'roll') {
    if (p.st <= 0) return false;
    let dx = mx, dy = my;
    if (ml < 0.2) { dx = cos(p.face); dy = sin(p.face); } else { dx /= ml; dy /= ml; }
    p.act = { type: 'roll', t: 0, dur: 0.44, dx, dy }; p.st -= 22; p.stDelay = 0.55; p.combo = 0; sfx('roll');
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
  if (p.stDelay <= 0 && (!p.act || p.act.type === 'heal')) p.st = Math.min(maxSt(), p.st + 62 * dt);
  p.hpTrail += (p.hp - p.hpTrail) * Math.min(1, dt * 2.5);
  if (p.buf) { p.buf.t -= dt; if (p.buf.t <= 0) p.buf = null; }
  const [mx, my] = moveInput(), ml = hyp(mx, my);
  if (lockT && (lockT.hp <= 0 || hyp(lockT.x - p.x, lockT.y - p.y) > 650 || (!enemies.includes(lockT) && !bosses.includes(lockT)))) lockT = null;
  if (p.stag > 0) { p.stag -= dt; moveEnt(p, p.kvx * dt, p.kvy * dt); p.kvx *= 0.88; p.kvy *= 0.88; return; }
  const a = p.act;
  if (a) {
    a.t += dt;
    if (a.type === 'atk' || a.type === 'heavy') {
      if (a.t < a.h1) { const l = a.type === 'atk' ? 120 : 95; moveEnt(p, cos(p.face) * l * dt, sin(p.face) * l * dt); }
      if (a.t >= a.h0 && !a.sw) { a.sw = true; sfx(a.type === 'atk' ? 'swing' : 'heavy'); }
      if (a.t >= a.h0 && a.t <= a.h1 + 0.02) doHits(a);
      if (p.buf && a.t > a.h1 + 0.03) {
        if (p.buf.n === 'roll' || (p.buf.n === 'atk' && a.type === 'atk' && a.t > a.h1 + 0.06) || (p.buf.n === 'heavy' && a.t > a.dur - 0.15)) { p.act = null; }
      }
    } else if (a.type === 'roll') {
      const k = 1 - a.t / a.dur; moveEnt(p, a.dx * 400 * (0.35 + 0.65 * k) * dt, a.dy * 400 * (0.35 + 0.65 * k) * dt);
      if (R() < 0.5) parts.push({ x: p.x + rnd(-6, 6), y: p.y + rnd(-6, 6), vx: 0, vy: 0, life: 0.4, ml: 0.4, col: 'rgba(200,190,170,0.5)', sz: rnd(3, 6), type: 'dust' });
      if (p.buf && p.buf.n !== 'roll' && a.t > a.dur - 0.08) p.act = null;
    } else if (a.type === 'heal') {
      moveEnt(p, mx * 55 * dt, my * 55 * dt);
      if (a.t >= 0.55 && !a.done) { a.done = true; p.hp = Math.min(maxHp(), p.hp + maxHp() * 0.42); sfx('heal'); burst(p.x, p.y, 22, '#ffb347', 90, 'spark'); floatTxt(p.x, p.y - 24, 'Brasa', '#ffb347'); }
    }
    if (p.act && p.act.t >= p.act.dur) p.act = null;
  }
  if (!p.act) {
    if (p.buf) { const b = p.buf; p.buf = null; startAct(b.n, mx, my); if (p.act && p.act.type !== 'atk') p.combo = 0; }
  }
  if (!p.act) {
    if (p.combo && !p.buf) p.comboT = (p.comboT || 0) + dt; else p.comboT = 0;
    if (p.comboT > 0.45) p.combo = 0;
    moveEnt(p, mx * 155 * dt, my * 155 * dt);
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
    a.hit.add(e); damageEnemy(e, a.dmg, a.poise, a.type === 'heavy');
  }
}
function damageEnemy(e, dmg, poise, heavy) {
  let crit = false;
  if (e.broken > 0 || (e.stag > 0.35 && !e.isBoss)) { dmg *= e.isBoss ? 1.8 : 1.4; crit = true; }
  dmg = Math.round(dmg * rnd(0.92, 1.08));
  e.hp -= dmg; e.flash = 0.12; e.aggro = true; if (e.isBoss && !e.awake) wakeBosses();
  floatTxt(e.x + rnd(-8, 8), e.y - e.r - 6, (crit ? '✦' : '') + dmg, crit ? '#ffd166' : '#f2e9d8', crit ? 17 : 13);
  const a = atan2(e.y - P.y, e.x - P.x);
  burst(e.x - cos(a) * e.r * 0.5, e.y - sin(a) * e.r * 0.5, heavy ? 14 : 8, e.isBoss ? e.col2 : '#e8d9b0', heavy ? 240 : 170, 'spark');
  sfx('hit'); hitstop = heavy ? 0.075 : 0.04; shake = Math.max(shake, heavy ? 6 : 3);
  if (e.isBoss) {
    e.poise -= poise;
    if (e.poise <= 0 && e.broken <= 0) {
      e.broken = 2.4; e.act = null; e.air = false; e.alpha = 1; cancelHaz(e); e.poise = e.mpoise;
      msg = { text: 'POSTURA QUEBRADA — ataque!', t: 1.8, col: '#ffd166' }; sfx('parry');
    }
  } else {
    if (!e.d.poise || heavy) {
      e.stag = heavy ? 0.65 : 0.32; e.st = 'idle'; cancelHaz(e);
      moveEnt(e, cos(a) * (heavy ? 22 : 10), sin(a) * (heavy ? 22 : 10));
    }
  }
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.hp = 0;
  if (e.isBoss) {
    bosses = bosses.filter(b => b !== e); cancelHaz(e);
    burst(e.x, e.y, 70, e.col2, 320, 'spark'); burst(e.x, e.y, 30, '#000', 160, 'dust'); shake = 18; hitstop = 0.25;
    soulsTo(e.x, e.y, 40); S.souls += e.souls; floatTxt(e.x, e.y - 30, '+' + e.souls + ' almas', '#9fe7c9', 16);
    if (bosses.length === 0) {
      for (const m of enemies) burst(m.x, m.y, 10, '#555', 100, 'dust');
      enemies = []; hazards = []; projs = [];
      S.bosses++; S.checkpoint = world.n + 1; S.stage = world.n + 1; S.best = Math.max(S.best, world.n + 1); persist();
      victoryT = 4.5; sfx('victory');
      banner = { text: 'GRANDE INIMIGO ABATIDO', sub: e.title + ', ' + e.epi, t: 4.5, col: '#ffd166' };
    }
  } else {
    enemies = enemies.filter(x => x !== e); cancelHaz(e);
    burst(e.x, e.y, 18, e.col, 160, 'dust'); soulsTo(e.x, e.y, e.minion ? 2 : 6);
    S.souls += e.souls; floatTxt(e.x, e.y - 18, '+' + e.souls, '#9fe7c9', 12);
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
  if (b.broken > 0) { b.broken -= dt; return; }
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
  for (const e of enemies.slice()) updEnemy(e, dt);
  for (const b of bosses.slice()) updBoss(b, dt);
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
  bonfireFrom = from; state = 'bonfire';
  P = newPlayer(); persist();
}
function respawnFromBonfire() { P = newPlayer(); buildStage(S.stage); state = 'play'; }

function update(dt) {
  gtime += dt;
  if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
  if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
  for (const f of floats) { f.life -= dt; f.y -= 28 * dt; }
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
  if (e.stag > 0.3) { ctx.fillStyle = '#ffd166'; for (let i = 0; i < 3; i++) { const a = gtime * 6 + i * 2.1; circle(e.x + cos(a) * e.r, e.y - e.r - 4 + sin(a) * 3, 2); ctx.fill(); } }
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
  if (b.broken > 0) { ctx.fillStyle = '#ffd166'; for (let i = 0; i < 4; i++) { const a = gtime * 5 + i * TAU / 4; circle(cos(a) * r, -r - 8 + sin(a) * 4, 3.5); ctx.fill(); } }
  ctx.restore();
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
  // capa
  ctx.fillStyle = '#3b1e24'; ctx.beginPath(); ctx.ellipse(-cos(f) * 7, -sin(f) * 7, 14, 12, f, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a2c3a'; circle(0, 0, p.r); ctx.fill();
  ctx.fillStyle = '#4a4d63'; circle(cos(f) * 2, sin(f) * 2 - 1, p.r * 0.75); ctx.fill();
  ctx.fillStyle = '#8f8a99'; circle(cos(f) * 5, sin(f) * 5 - 1, 5.5); ctx.fill();
  ctx.fillStyle = '#ffb347'; circle(cos(f) * 8 - sin(f) * 2, sin(f) * 8 + cos(f) * 2 - 1, 1.3); ctx.fill(); circle(cos(f) * 8 + sin(f) * 2, sin(f) * 8 - cos(f) * 2 - 1, 1.3); ctx.fill();
  // escudo
  const sa = f - 1.2; ctx.fillStyle = '#5c4a32'; circle(cos(sa) * 12, sin(sa) * 12, 6.5); ctx.fill(); ctx.strokeStyle = '#a08a5a'; ctx.lineWidth = 1.5; ctx.stroke();
  // espada
  let wa = f + 0.9, len = 30;
  if (a && (a.type === 'atk' || a.type === 'heavy')) {
    const dir = a.type === 'atk' && a.combo === 1 ? -1 : 1;
    if (a.t < a.h0) wa = f + dir * (a.arc / 2 + 0.3) * (a.t / a.h0);
    else if (a.t <= a.h1) { const k = (a.t - a.h0) / (a.h1 - a.h0); wa = f + dir * (a.arc / 2 - a.arc * k); }
    else wa = f - dir * a.arc / 2;
    if (a.type === 'heavy') len = 36;
    if (a.t >= a.h0 && a.t <= a.h1 + 0.08) {
      const k = clamp((a.t - a.h0) / (a.h1 - a.h0), 0, 1);
      ctx.fillStyle = a.type === 'heavy' ? 'rgba(255,210,140,0.35)' : 'rgba(230,230,255,0.3)';
      ctx.beginPath(); const s0 = f + dir * a.arc / 2, s1 = f + dir * (a.arc / 2 - a.arc * k);
      ctx.arc(0, 0, a.range, Math.min(s0, s1), Math.max(s0, s1)); ctx.arc(0, 0, a.range * 0.45, Math.max(s0, s1), Math.min(s0, s1), true); ctx.fill();
    }
  }
  if (a && a.type === 'heal') { ctx.fillStyle = `rgba(255,179,71,${0.3 + 0.3 * sin(gtime * 20)})`; circle(0, 0, 22); ctx.fill(); wa = f + 1.6; }
  ctx.strokeStyle = '#d8d8e8'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cos(wa) * 8, sin(wa) * 8); ctx.lineTo(cos(wa) * len, sin(wa) * len); ctx.stroke();
  ctx.strokeStyle = '#7a6a4a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cos(wa) * 8 - sin(wa) * 4, sin(wa) * 8 + cos(wa) * 4); ctx.lineTo(cos(wa) * 8 + sin(wa) * 4, sin(wa) * 8 - cos(wa) * 4); ctx.stroke();
  ctx.restore();
}
function drawProj() {
  for (const p of projs) {
    ctx.strokeStyle = p.col; ctx.globalAlpha = 0.35; ctx.lineWidth = p.r; ctx.lineCap = 'round'; ctx.beginPath();
    for (let i = 0; i < p.trail.length; i += 2) i ? ctx.lineTo(p.trail[i], p.trail[i + 1]) : ctx.moveTo(p.trail[i], p.trail[i + 1]);
    ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.globalAlpha = 1;
    if (p.arrow) { const a = atan2(p.vy, p.vx); ctx.strokeStyle = '#e8dcc8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - cos(a) * 12, p.y - sin(a) * 12); ctx.lineTo(p.x + cos(a) * 4, p.y + sin(a) * 4); ctx.stroke(); }
    else { ctx.fillStyle = p.col; circle(p.x, p.y, p.r); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(p.x, p.y, p.r * 0.45); ctx.fill(); }
  }
}
function drawParts(ui) {
  for (const p of parts) {
    if (!!p.ui !== ui) continue;
    const k = p.life / p.ml;
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
  const hw = Math.min(150 + S.vit * 9, W * 0.38), sw = Math.min(130 + S.end * 8, W * 0.34);
  bar(sx, sy, hw, 11, P.hp / maxHp(), P.hpTrail / maxHp(), '#a3202a');
  bar(sx, sy + 17, sw, 7, P.st / maxSt(), null, '#3e8e4e');
  // frascos
  for (let i = 0; i < flaskMax(); i++) {
    const x = sx + 8 + i * 17, y = sy + 42, full = i < P.flasks;
    ctx.fillStyle = full ? '#ff9a3c' : '#2a2224'; ctx.beginPath(); ctx.moveTo(x - 3, y - 9); ctx.lineTo(x + 3, y - 9); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x + 6, y + 2); ctx.arc(x, y + 3, 6, 0.2, PI - 0.2); ctx.lineTo(x - 3, y - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6b5a40'; ctx.lineWidth = 1; ctx.stroke();
  }
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
    ctx.fillStyle = '#ffd166'; ctx.fillRect(bx, by + 11, bw * clamp(1 - b.poise / b.mpoise, 0, 1), 2);
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
    txt('WASD mover · J ataque · K forte · Espaço rolar · E curar · Q mira · Esc pausa', W / 2, H - 12, 11, 'rgba(200,190,170,0.55)', 'center');
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
function drawMenu() {
  ctx.fillStyle = '#07060a'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.9, 10, W / 2, H * 0.9, H); g.addColorStop(0, 'rgba(120,40,10,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawParts(true);
  if (menuPage === 'help') { drawHelp(); return; }
  const ts = Math.min(56, W / 13);
  txt('CINZAS ETERNAS', W / 2, H * 0.2, ts, '#e8d9b0', 'center', 'bold');
  txt('um soulslike pelas mitologias do mundo', W / 2, H * 0.2 + ts * 0.85, Math.max(13, ts * 0.32), '#a3957a', 'center', 'italic');
  const bw = Math.min(300, W * 0.6), bh = 44, bx = (W - bw) / 2; let by = H * 0.43;
  if (S.started) { button(bx, by, bw, bh, `Continuar — Fase ${S.stage}`, () => { P = newPlayer(); buildStage(S.stage); state = 'play'; }, { hot: true }); by += bh + 12; }
  button(bx, by, bw, bh, confirmNew > 0 ? 'Apagar progresso? Toque de novo' : 'Novo Jogo', () => {
    if (S.started && confirmNew <= 0) { confirmNew = 3; return; }
    S = newSave(); persist(); P = newPlayer(); buildStage(1); state = 'play'; confirmNew = 0;
  }, { hot: !S.started }); by += bh + 12;
  button(bx, by, bw, bh, 'Como Jogar', () => { menuPage = 'help'; });
  if (S.started) txt(`Recorde: Fase ${S.best}   ·   Chefes abatidos: ${S.bosses}   ·   Mortes: ${S.deaths}`, W / 2, H - 22, 12, '#7d7262', 'center');
}
function drawHelp() {
  const lines = [
    ['COMO JOGAR', '#e8d9b0', 26],
    ['Lado esquerdo da tela: arraste para mover.', '#cfc3a6', 14],
    ['ATAQUE: golpe rápido (combo de 3). FORTE: golpe pesado que quebra postura.', '#cfc3a6', 14],
    ['ROLAR: esquiva com invencibilidade — role ATRAVÉS dos ataques. CURA: bebe um frasco de Brasa.', '#cfc3a6', 14],
    ['MIRA: trava o alvo mais próximo. Tudo consome estamina (barra verde).', '#cfc3a6', 14],
    ['Áreas vermelhas mostram onde o golpe vai cair — saia ou role antes de encher.', '#ff8a80', 14],
    ['Viaje por 8 reinos míticos: Grego, Nórdico, Egípcio, Japonês, Asteca, Folclore Brasileiro, Inferno e Eslavo.', '#ffd166', 14],
    ['Cada reino tem 3 fases e termina num chefe lendário. Derrote todos os inimigos para abrir o portal.', '#cfc3a6', 14],
    ['Chefes mudam de fase com 50% de vida. Quebre a postura (barra amarela) para dano crítico.', '#cfc3a6', 14],
    ['Ao morrer você perde as almas, mas pode recuperá-las no local da morte.', '#9fe7c9', 14],
    ['Na fogueira, gaste almas em Vigor, Fôlego e Força. As fases são infinitas.', '#cfc3a6', 14],
  ];
  let y = H * 0.12; const sc = Math.min(1, W / 900);
  for (const [s, c, z] of lines) { txt(s, W / 2, y, z * (z > 20 ? 1 : sc), c, 'center'); y += z > 20 ? 40 : 27; }
  const bw = 200; button((W - bw) / 2, Math.min(y + 10, H - 60), bw, 42, 'Voltar', () => { menuPage = 'main'; });
}
function drawBonfire() {
  ctx.fillStyle = '#08060a'; ctx.fillRect(0, 0, W, H);
  drawParts(true);
  const fx = W * 0.25, fy = H * 0.62, s = Math.min(1.4, H / 380);
  drawFire(fx, fy, s);
  txt(bonfireFrom === 'death' ? 'Você retornou à fogueira' : 'Fogueira acesa', fx, H * 0.14, Math.min(24, W / 30), '#e8d9b0', 'center');
  const RN = realmOf(S.stage);
  txt(`Próxima: Fase ${S.stage}`, fx, H * 0.14 + 26, 13, '#a3957a', 'center', 'italic');
  txt(`${RN.name}`, fx, H * 0.14 + 46, 13, '#ffd166', 'center');
  txt(RN.myth, fx, H * 0.14 + 64, 12, '#a3957a', 'center', 'italic');
  if (S.lost) txt(`Almas perdidas na Fase ${S.lost.stage}: ${S.lost.amount}`, fx, H * 0.88, 13, '#9fe7c9', 'center');
  const px = W * 0.5, pw = Math.min(W * 0.46, 420); let y = H * 0.1;
  ctx.fillStyle = 'rgba(20,16,18,0.7)'; ctx.fillRect(px - 10, y - 10, pw + 20, H * 0.82);
  txt(`Nível ${level()}`, px + 6, y + 10, 20, '#e8d9b0');
  soulIcon(px + pw - 110, y + 10, 7); txt(String(S.souls), px + pw - 6, y + 10, 17, '#e8f5ee', 'right');
  y += 36; const cost = lvlCost(), can = S.souls >= cost;
  txt(`Custo para subir de nível: ${cost} almas`, px + 6, y, 13, can ? '#9fe7c9' : '#8a826f');
  y += 22;
  const rows = [
    ['vit', 'Vigor', `Vida ${maxHp()}`, `+14 vida`],
    ['end', 'Fôlego', `Estamina ${maxSt()}`, `+10 estamina`],
    ['str', 'Força', `Dano ${Math.round(lightDmg())} / ${Math.round(heavyDmg())}`, `+3 / +6.5 dano`],
  ];
  const rh = Math.min(52, H * 0.11);
  for (const [k, name, desc, plus] of rows) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(px, y, pw, rh - 6);
    txt(`${name}  ${S[k]}`, px + 10, y + rh * 0.3, 16, '#e8d9b0');
    txt(desc + '   (' + plus + ')', px + 10, y + rh * 0.62, 11, '#a3957a');
    button(px + pw - 54, y + 4, 48, rh - 14, '+', () => { if (S.souls >= lvlCost()) { S.souls -= lvlCost(); S[k]++; persist(); sfx('heal'); } }, { dim: !can, size: 22 });
    y += rh;
  }
  y += 4;
  txt(`Frascos de Brasa: ${flaskMax()}   ·   Chefes abatidos: ${S.bosses}`, px + 6, y + 6, 12, '#a3957a');
  y += 22;
  const bh = Math.min(44, H * 0.1);
  button(px, y, pw, bh, `Prosseguir — Fase ${S.stage}`, respawnFromBonfire, { hot: true }); y += bh + 8;
  button(px, y, pw, bh * 0.8, 'Menu principal', () => { state = 'menu'; menuPage = 'main'; }, { size: 13 });
}
function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSADO', W / 2, H * 0.28, 32, '#e8d9b0', 'center');
  txt(`Fase ${world.n} — ${world.biome.name}`, W / 2, H * 0.28 + 32, 14, '#a3957a', 'center', 'italic');
  const bw = Math.min(280, W * 0.6), bx = (W - bw) / 2;
  button(bx, H * 0.45, bw, 44, 'Retomar', () => { state = 'play'; }, { hot: true });
  button(bx, H * 0.45 + 56, bw, 44, 'Sair para o menu', () => { persist(); state = 'menu'; menuPage = 'main'; });
  txt('Ao sair, a fase atual recomeça do início.', W / 2, H * 0.45 + 122, 12, '#7d7262', 'center');
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
  // mundo
  const sx = (R() - 0.5) * shake, sy = (R() - 0.5) * shake;
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (-cam.x * SC + sx), DPR * (-cam.y * SC + sy));
  drawFloor(); if (!world.isBoss) drawExit(); drawStain(); drawObs(); drawHaz();
  const ents = [...enemies.map(e => [e.y, () => drawEnemy(e)]), ...bosses.map(b => [b.y, () => drawBoss(b)]), [P.y, drawPlayer]];
  ents.sort((a, b) => a[0] - b[0]); for (const e of ents) e[1]();
  drawProj(); drawParts(false);
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
  if (state === 'bonfire') { state = 'menu'; menuPage = 'main'; return 'ok'; }
  if (state === 'menu' && menuPage === 'help') { menuPage = 'main'; return 'ok'; }
  return 'exit';
};
window.androidPause = () => { if (state === 'play' && P && !P.dead && victoryT <= 0) state = 'pause'; persist(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) window.androidPause(); });

/* depuração (testes automatizados) */
window.__game = { get state() { return state; }, get S() { return S; }, get P() { return P; }, get bosses() { return bosses; }, get enemies() { return enemies; }, get world() { return world; },
  start(n) { P = newPlayer(); buildStage(n); state = 'play'; }, god() { P.hp = 1e9; }, ATK,
  step(n, fn) { for (let i = 0; i < n; i++) { if (fn) fn(); update(1 / 60); } draw(); }, act, keys };

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  try { update(dt); draw(); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
