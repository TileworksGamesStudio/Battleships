/**
 * BATTLESHIP // TACTICAL NAVAL COMMAND ENGINE
 * Authentic Classic Rules, Dynamic Canvas FX, Procedural Synthesizer,
 * One-Handed Thumb Ergonomics & Social Mission Debriefs.
 */
(() => {
  'use strict';

  // --- Classic Rules & Ship Manifest ---
  const GRID_SIZE = 10;
  const COLS = ['A','B','C','D','E','F','G','H','I','J'];
  const SHIPS = [
    { id: 'carrier',    name: 'Carrier',    size: 5, detail: 'runway' },
    { id: 'battleship', name: 'Battleship', size: 4, detail: 'turret' },
    { id: 'cruiser',    name: 'Cruiser',    size: 3, detail: 'turret' },
    { id: 'submarine',  name: 'Submarine',  size: 3, detail: 'sub' },
    { id: 'destroyer',  name: 'Destroyer',  size: 2, detail: 'torpedo' },
  ];

  // --- Procedural Sound Engine (100% Synthesized, Zero External Audio) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = localStorage.getItem('btl_sound') !== 'false';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.setValueAtTime(0.3, this.ctx.currentTime);

        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
        compressor.knee.setValueAtTime(12, this.ctx.currentTime);
        compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
        compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(type) {
      if (!this.enabled) return;
      try {
        this.init();
        const t = this.ctx.currentTime;

        if (type === 'tap') {
          // Tactical micro-click
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.master);
          osc.frequency.setValueAtTime(1400, t);
          osc.frequency.exponentialRampToValueAtTime(120, t + 0.025);
          g.gain.setValueAtTime(0.12, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
          osc.start(t); osc.stop(t + 0.025);
        }
        else if (type === 'sonar') {
          // Resonant naval sonar ping with decaying echo
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.master);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(784, t);
          osc.frequency.exponentialRampToValueAtTime(770, t + 0.9);
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
          osc.start(t); osc.stop(t + 0.9);

          // Subtle echo reverberation
          const echo = this.ctx.createOscillator();
          const echoG = this.ctx.createGain();
          echo.connect(echoG); echoG.connect(this.master);
          echo.type = 'sine';
          echo.frequency.setValueAtTime(770, t + 0.22);
          echoG.gain.setValueAtTime(0.08, t + 0.22);
          echoG.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
          echo.start(t + 0.22); echo.stop(t + 1.1);
        }
        else if (type === 'launch') {
          // Missile / artillery tracer whoosh
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.master);
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(120, t);
          osc.frequency.exponentialRampToValueAtTime(750, t + 0.2);
          g.gain.setValueAtTime(0.08, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.start(t); osc.stop(t + 0.22);
        }
        else if (type === 'hit') {
          // Sub-bass detonation thump + shaped explosive noise
          const osc = this.ctx.createOscillator();
          const oscG = this.ctx.createGain();
          osc.connect(oscG); oscG.connect(this.master);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(140, t);
          osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);
          oscG.gain.setValueAtTime(0.5, t);
          oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t); osc.stop(t + 0.35);

          // Explosive noise burst
          const bufferSize = this.ctx.sampleRate * 0.28;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, t);
          filter.frequency.exponentialRampToValueAtTime(80, t + 0.28);

          const noiseG = this.ctx.createGain();
          noiseG.gain.setValueAtTime(0.35, t);
          noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

          noise.connect(filter); filter.connect(noiseG); noiseG.connect(this.master);
          noise.start(t);
        }
        else if (type === 'miss') {
          // Water geyser splash + cavitation
          const bufferSize = this.ctx.sampleRate * 0.18;
          const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

          const noise = this.ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1600, t);
          filter.frequency.exponentialRampToValueAtTime(450, t + 0.18);
          filter.Q.value = 3;

          const noiseG = this.ctx.createGain();
          noiseG.gain.setValueAtTime(0.2, t);
          noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

          noise.connect(filter); filter.connect(noiseG); noiseG.connect(this.master);
          noise.start(t);
        }
        else if (type === 'sunk') {
          // Heavy dual naval klaxon + hull rupture rumble
          [340, 270].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g); g.connect(this.master);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, t + idx * 0.15);
            g.gain.setValueAtTime(0.25, t + idx * 0.15);
            g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.15 + 0.25);
            osc.start(t + idx * 0.15); osc.stop(t + idx * 0.15 + 0.25);
          });
        }
        else if (type === 'win') {
          // Triumphant 5-note victory arpeggio fanfare
          const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
          notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g); g.connect(this.master);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + i * 0.09);
            g.gain.setValueAtTime(0.18, t + i * 0.09);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.45);
            osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.45);
          });
        }
      } catch (_) {}
    }
  }

  const sfx = new SoundEngine();

  function triggerHaptic(pattern = 15) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }

  // --- Dynamic High-Performance Particle Engine (Canvas Overlay) ---
  class CanvasFXEngine {
    constructor(canvasEl) {
      this.canvas = canvasEl;
      this.ctx = canvasEl.getContext('2d');
      this.particles = [];
      this.projectiles = [];
      this.shockwaves = [];
      this.ripples = [];
      this.animating = false;
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      this.scale = dpr;
    }

    startLoop() {
      if (!this.animating) {
        this.animating = true;
        requestAnimationFrame(() => this.loop());
      }
    }

    fireProjectile(startX, startY, targetX, targetY, onImpact) {
      this.projectiles.push({
        x: startX,
        y: startY,
        startX, startY, targetX, targetY,
        progress: 0,
        speed: 0.07,
        onImpact
      });
      this.startLoop();
    }

    explode(x, y) {
      // Expanding fiery shockwave
      this.shockwaves.push({ x, y, radius: 2, maxRadius: 36, alpha: 0.9 });

      // Shrapnel particles
      const count = 38;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5.5 + 1.5;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3.5 + 1.5,
          color: Math.random() < 0.4 ? '#ffffff' : (Math.random() < 0.7 ? '#ff8800' : '#ff2244'),
          alpha: 1,
          decay: Math.random() * 0.025 + 0.02
        });
      }
      this.startLoop();
    }

    splash(x, y) {
      // Expanding water ripples
      this.ripples.push({ x, y, rx: 4, ry: 2, maxR: 24, alpha: 0.8 });

      // Water droplets geyser
      const count = 22;
      for (let i = 0; i < count; i++) {
        const vx = (Math.random() - 0.5) * 3.5;
        const vy = -(Math.random() * 4.5 + 2.5);
        this.particles.push({
          x, y,
          vx, vy,
          gravity: 0.24,
          size: Math.random() * 2.5 + 1,
          color: Math.random() < 0.5 ? '#00f0ff' : '#ffffff',
          alpha: 0.9,
          decay: 0.032
        });
      }
      this.startLoop();
    }

    loop() {
      this.ctx.save();
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width / this.scale, this.canvas.height / this.scale);

      // 1. Update & Render Projectile Tracers
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        p.progress += p.speed;
        p.x = p.startX + (p.targetX - p.startX) * p.progress;
        p.y = p.startY + (p.targetY - p.startY) * p.progress;

        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 8;
        this.ctx.fill();

        if (p.progress >= 1) {
          p.onImpact(p.targetX, p.targetY);
          this.projectiles.splice(i, 1);
        }
      }

      // 2. Shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const s = this.shockwaves[i];
        s.radius += 2.2;
        s.alpha -= 0.055;
        if (s.alpha <= 0 || s.radius >= s.maxRadius) {
          this.shockwaves.splice(i, 1);
          continue;
        }
        this.ctx.beginPath();
        this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(255, 100, 30, ${s.alpha})`;
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();
      }

      // 3. Water Ripples
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.rx += 1.3;
        r.ry += 0.65;
        r.alpha -= 0.038;
        if (r.alpha <= 0) {
          this.ripples.splice(i, 1);
          continue;
        }
        this.ctx.beginPath();
        this.ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(0, 240, 255, ${r.alpha})`;
        this.ctx.lineWidth = 1.8;
        this.ctx.stroke();
      }

      // 4. Debris & Water Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.gravity) pt.vy += pt.gravity;
        pt.alpha -= pt.decay;

        if (pt.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }

        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        this.ctx.fillStyle = pt.color;
        this.ctx.globalAlpha = Math.max(0, pt.alpha);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      }

      this.ctx.restore();

      if (this.projectiles.length > 0 || this.shockwaves.length > 0 || this.ripples.length > 0 || this.particles.length > 0) {
        requestAnimationFrame(() => this.loop());
      } else {
        this.animating = false;
      }
    }
  }

  // --- Fleet Model ---
  function createFleet() {
    return {
      grid: Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null)),
      ships: SHIPS.map(s => ({
        ...s,
        placed: false,
        cells: [],
        hits: 0,
        sunk: false
      }))
    };
  }

  // --- State Engine ---
  const state = {
    phase: 'setup',       // 'setup' | 'playing' | 'over'
    turn: 'player',       // 'player' | 'enemy' | 'resolving'
    orientation: 'h',     // 'h' | 'v'
    selectedShipIndex: 0,
    player: createFleet(),
    enemy: createFleet(),
    stats: {
      playerShots: 0,
      playerHits: 0,
      turns: 0,
    },
    ai: {
      targetQueue: [],
      activeHits: [],
      lastHitShipId: null
    }
  };

  // --- DOM References ---
  const $ = (id) => document.getElementById(id);
  const dom = {
    battleground: $('battleground'),
    fxCanvas: $('fxCanvas'),
    commsText: $('commsText'),
    radarBeacon: $('radarBeacon'),
    sonarBtn: $('sonarBtn'),
    soundToggle: $('soundToggle'),
    soundOnIcon: $('soundOnIcon'),
    soundOffIcon: $('soundOffIcon'),

    enemyCard: $('enemyCard'),
    playerCard: $('playerCard'),
    enemyGrid: $('enemyGrid'),
    playerGrid: $('playerGrid'),
    enemyAxisX: $('enemyAxisX'),
    enemyAxisY: $('enemyAxisY'),
    playerAxisX: $('playerAxisX'),
    playerAxisY: $('playerAxisY'),
    enemyFleetPills: $('enemyFleetPills'),
    playerFleetPills: $('playerFleetPills'),
    enemyFleetCount: $('enemyFleetCount'),
    playerFleetCount: $('playerFleetCount'),
    defenseAlertPing: $('defenseAlertPing'),

    setupControls: $('setupControls'),
    battleControls: $('battleControls'),
    shipDock: $('shipDock'),
    rotateBtn: $('rotateBtn'),
    orientationLabel: $('orientationLabel'),
    randomBtn: $('randomBtn'),
    startBattleBtn: $('startBattleBtn'),

    theaterTabs: $('theaterTabs'),
    tabEnemy: $('tabEnemy'),
    tabPlayer: $('tabPlayer'),
    shotsVal: $('shotsVal'),
    accuracyVal: $('accuracyVal'),
    sunkVal: $('sunkVal'),
    restartBtn: $('restartBtn'),

    gameModal: $('gameModal'),
    modalRankBadge: $('modalRankBadge'),
    modalTitle: $('modalTitle'),
    modalDesc: $('modalDesc'),
    modalTurns: $('modalTurns'),
    modalAccuracy: $('modalAccuracy'),
    modalSurvivors: $('modalSurvivors'),
    sharePreviewGrid: $('sharePreviewGrid'),
    shareReportBtn: $('shareReportBtn'),
    playAgainBtn: $('playAgainBtn'),
    toast: $('toastNotification'),
  };

  let fxEngine = null;

  // --- Mathematics & Coordinate Helpers ---
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

  function getShipCoordinates(r, c, size, orientation) {
    const coords = [];
    for (let i = 0; i < size; i++) {
      coords.push({
        r: orientation === 'v' ? r + i : r,
        c: orientation === 'h' ? c + i : c,
        index: i
      });
    }
    return coords;
  }

  function canPlaceShip(fleet, r, c, size, orientation, excludeShipId = null) {
    const coords = getShipCoordinates(r, c, size, orientation);
    for (const pt of coords) {
      if (!inBounds(pt.r, pt.c)) return false;
      const cell = fleet.grid[pt.r][pt.c];
      if (cell && cell.shipId !== excludeShipId) return false;
    }
    return true;
  }

  function placeShip(fleet, ship, r, c, orientation) {
    if (ship.placed) removeShip(fleet, ship);

    const coords = getShipCoordinates(r, c, ship.size, orientation);
    coords.forEach(pt => {
      fleet.grid[pt.r][pt.c] = {
        shipId: ship.id,
        part: pt.index === 0 ? 'bow' : (pt.index === ship.size - 1 ? 'stern' : 'mid'),
        orient: orientation,
        hit: false
      };
    });

    ship.cells = coords;
    ship.orientation = orientation;
    ship.placed = true;
  }

  function removeShip(fleet, ship) {
    if (!ship.placed) return;
    ship.cells.forEach(pt => {
      fleet.grid[pt.r][pt.c] = null;
    });
    ship.cells = [];
    ship.placed = false;
  }

  function autoPlaceAll(fleet) {
    fleet.ships.forEach(s => removeShip(fleet, s));
    fleet.ships.forEach(ship => {
      let placed = false;
      let safety = 0;
      while (!placed && safety < 1200) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        if (canPlaceShip(fleet, r, c, ship.size, ori)) {
          placeShip(fleet, ship, r, c, ori);
          placed = true;
        }
        safety++;
      }
    });
  }

  // --- Grid DOM Construction ---
  function buildCoordinates() {
    [dom.enemyAxisX, dom.playerAxisX].forEach(el => {
      el.innerHTML = '';
      COLS.forEach(c => {
        const span = document.createElement('span');
        span.textContent = c;
        el.appendChild(span);
      });
    });

    [dom.enemyAxisY, dom.playerAxisY].forEach(el => {
      el.innerHTML = '';
      for (let i = 1; i <= GRID_SIZE; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        el.appendChild(span);
      }
    });
  }

  function buildGridCells(container, clickHandler, isPlayer = false) {
    container.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener('click', () => clickHandler(r, c, cell));

        if (isPlayer) {
          cell.addEventListener('pointerenter', () => previewPlacement(r, c));
        }

        container.appendChild(cell);
      }
    }

    if (isPlayer) {
      container.addEventListener('pointerleave', clearPreview);
    }
  }

  // --- Setup Dock UI ---
  function renderShipDock() {
    dom.shipDock.innerHTML = '';
    state.player.ships.forEach((ship, idx) => {
      const item = document.createElement('button');
      item.className = 'dock-ship-item' +
        (idx === state.selectedShipIndex ? ' active' : '') +
        (ship.placed ? ' placed' : '');
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-selected', idx === state.selectedShipIndex);

      const name = document.createElement('span');
      name.className = 'dock-ship-name';
      name.textContent = `${ship.name.toUpperCase()} (${ship.size})`;

      const pips = document.createElement('div');
      pips.className = 'dock-pips';
      for (let i = 0; i < ship.size; i++) {
        const pip = document.createElement('span');
        pip.className = 'dock-pip';
        pips.appendChild(pip);
      }

      item.appendChild(name);
      item.appendChild(pips);

      item.addEventListener('click', () => {
        state.selectedShipIndex = idx;
        sfx.play('tap');
        triggerHaptic(15);
        render();
      });

      dom.shipDock.appendChild(item);
    });
  }

  // --- Setup Mode: Placement & Previews ---
  function previewPlacement(r, c) {
    if (state.phase !== 'setup') return;
    clearPreview();

    const ship = state.player.ships[state.selectedShipIndex];
    if (!ship) return;

    const coords = getShipCoordinates(r, c, ship.size, state.orientation);
    const valid = canPlaceShip(state.player, r, c, ship.size, state.orientation, ship.id);

    coords.forEach(pt => {
      if (inBounds(pt.r, pt.c)) {
        const cellEl = dom.playerGrid.children[pt.r * GRID_SIZE + pt.c];
        cellEl.classList.add(valid ? 'valid-preview' : 'invalid-preview');
      }
    });
  }

  function clearPreview() {
    const list = dom.playerGrid.querySelectorAll('.valid-preview, .invalid-preview');
    list.forEach(el => el.classList.remove('valid-preview', 'invalid-preview'));
  }

  function onPlayerGridCellClick(r, c) {
    if (state.phase !== 'setup') return;

    const currentCell = state.player.grid[r][c];
    if (currentCell) {
      // Pick up existing ship to reposition
      const ship = state.player.ships.find(s => s.id === currentCell.shipId);
      if (ship) {
        removeShip(state.player, ship);
        state.selectedShipIndex = state.player.ships.indexOf(ship);
        sfx.play('tap');
        triggerHaptic(20);
        render();
        previewPlacement(r, c);
        return;
      }
    }

    const ship = state.player.ships[state.selectedShipIndex];
    if (!ship) return;

    if (canPlaceShip(state.player, r, c, ship.size, state.orientation, ship.id)) {
      placeShip(state.player, ship, r, c, state.orientation);
      sfx.play('tap');
      triggerHaptic(20);

      // Select next unplaced ship automatically
      const nextUnplaced = state.player.ships.findIndex(s => !s.placed);
      if (nextUnplaced !== -1) {
        state.selectedShipIndex = nextUnplaced;
      }

      clearPreview();
      render();
    } else {
      triggerHaptic([30, 20, 30]);
    }
  }

  // --- Battle: Target Firing & Resolution ---
  function getCellCenter(cellEl) {
    const bgRect = dom.battleground.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    return {
      x: cellRect.left + cellRect.width / 2 - bgRect.left,
      y: cellRect.top + cellRect.height / 2 - bgRect.top
    };
  }

  function onEnemyGridCellClick(r, c, cellEl) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;

    const targetCell = state.enemy.grid[r][c];
    if (targetCell && (targetCell.state === 'hit' || targetCell.state === 'miss')) {
      sfx.play('tap');
      return; // Already engaged
    }

    // Lock turn while projectile animation resolves
    state.turn = 'resolving';
    state.stats.playerShots++;

    const pos = getCellCenter(cellEl);
    const startX = pos.x + (Math.random() - 0.5) * 60;
    const startY = -40;

    sfx.play('launch');

    fxEngine.fireProjectile(startX, startY, pos.x, pos.y, () => {
      // Impact Resolution
      if (targetCell && targetCell.shipId) {
        targetCell.state = 'hit';
        const ship = state.enemy.ships.find(s => s.id === targetCell.shipId);
        ship.hits++;
        state.stats.playerHits++;

        fxEngine.explode(pos.x, pos.y);
        dom.battleground.classList.add('screen-shake-sm');
        setTimeout(() => dom.battleground.classList.remove('screen-shake-sm'), 300);

        if (ship.hits >= ship.size) {
          ship.sunk = true;
          sfx.play('sunk');
          triggerHaptic([50, 40, 90]);
          dom.commsText.textContent = `CRITICAL // HOSTILE ${ship.name.toUpperCase()} SUNK!`;
          cascadeShipExplosion(ship, dom.enemyGrid);
        } else {
          sfx.play('hit');
          triggerHaptic([30, 20, 40]);
          dom.commsText.textContent = `DIRECT HIT // SECTOR ${COLS[c]}-${r + 1} CONFIRMED!`;
        }
      } else {
        state.enemy.grid[r][c] = { state: 'miss' };
        fxEngine.splash(pos.x, pos.y);
        sfx.play('miss');
        triggerHaptic(15);
        dom.commsText.textContent = `SPLASH // NO IMPACT AT ${COLS[c]}-${r + 1}.`;
      }

      render();

      if (checkEndGame()) return;

      // Hostile Turn Handoff
      state.turn = 'enemy';
      dom.commsText.textContent = 'HOSTILE TARGET ACQUISITION IN PROGRESS...';
      setTimeout(executeAITurn, 650);
    });
  }

  function cascadeShipExplosion(ship, gridEl) {
    ship.cells.forEach((pt, i) => {
      setTimeout(() => {
        const cell = gridEl.children[pt.r * GRID_SIZE + pt.c];
        if (cell) {
          const pos = getCellCenter(cell);
          fxEngine.explode(pos.x, pos.y);
        }
      }, i * 85);
    });
  }

  // --- High-Performance Naval AI (Hunt & Target Strategy) ---
  function executeAITurn() {
    if (state.phase !== 'playing') return;

    let target = null;

    // 1. Target Mode: Continue tracking damaged unsunk ship
    while (state.ai.targetQueue.length > 0) {
      const cand = state.ai.targetQueue.shift();
      const cell = state.player.grid[cand.r][cand.c];
      if (!cell || (cell.state !== 'hit' && cell.state !== 'miss')) {
        target = cand;
        break;
      }
    }

    // 2. Hunt Mode: Strategic parity checkerboard search
    if (!target) {
      const candidates = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = state.player.grid[r][c];
          const untouched = !cell || (cell.state !== 'hit' && cell.state !== 'miss');
          if (untouched && (r + c) % 2 === 0) {
            candidates.push({ r, c });
          }
        }
      }

      if (candidates.length > 0) {
        target = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        // Fallback to remaining untouched coordinates
        const anyUntouched = [];
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const cell = state.player.grid[r][c];
            if (!cell || (cell.state !== 'hit' && cell.state !== 'miss')) {
              anyUntouched.push({ r, c });
            }
          }
        }
        target = anyUntouched[Math.floor(Math.random() * anyUntouched.length)];
      }
    }

    if (!target) return;

    const cell = state.player.grid[target.r][target.c];
    const isHit = cell && cell.shipId;

    if (isHit) {
      cell.state = 'hit';
      const ship = state.player.ships.find(s => s.id === cell.shipId);
      ship.hits++;
      state.ai.activeHits.push(target);

      sfx.play('hit');
      triggerHaptic([40, 25, 50]);

      // Flash friendly fleet tab notification
      dom.defenseAlertPing.classList.remove('hidden');

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        dom.commsText.textContent = `ALERT // YOUR ${ship.name.toUpperCase()} HAS BEEN SUNK!`;
        // Clear active hits for sunken ship
        state.ai.activeHits = state.ai.activeHits.filter(
          h => !ship.cells.some(c => c.r === h.r && c.c === h.c)
        );
      } else {
        dom.commsText.textContent = `WARNING // HOSTILE HIT ON YOUR FLEET AT ${COLS[target.c]}-${target.r + 1}!`;

        // If multiple hits on same ship, determine axis line
        if (state.ai.activeHits.length >= 2) {
          const rSet = new Set(state.ai.activeHits.map(h => h.r));
          const cSet = new Set(state.ai.activeHits.map(h => h.c));

          if (rSet.size === 1) { // Horizontal line
            const row = [...rSet][0];
            const cols = state.ai.activeHits.map(h => h.c);
            const minC = Math.min(...cols);
            const maxC = Math.max(...cols);
            [minC - 1, maxC + 1].forEach(c => {
              if (inBounds(row, c)) state.ai.targetQueue.unshift({ r: row, c });
            });
          } else if (cSet.size === 1) { // Vertical line
            const col = [...cSet][0];
            const rows = state.ai.activeHits.map(h => h.r);
            const minR = Math.min(...rows);
            const maxR = Math.max(...rows);
            [minR - 1, maxR + 1].forEach(r => {
              if (inBounds(r, col)) state.ai.targetQueue.unshift({ r, c: col });
            });
          }
        }

        // Add orthogonal neighbors
        const neighbors = [
          { r: target.r - 1, c: target.c },
          { r: target.r + 1, c: target.c },
          { r: target.r, c: target.c - 1 },
          { r: target.r, c: target.c + 1 }
        ];

        neighbors.forEach(n => {
          if (inBounds(n.r, n.c)) {
            const nCell = state.player.grid[n.r][n.c];
            const unhit = !nCell || (nCell.state !== 'hit' && nCell.state !== 'miss');
            if (unhit) state.ai.targetQueue.push(n);
          }
        });
      }
    } else {
      state.player.grid[target.r][target.c] = { state: 'miss' };
      sfx.play('miss');
      dom.commsText.textContent = `DEFENSE INTACT // HOSTILE SALVO MISSED SECTOR ${COLS[target.c]}-${target.r + 1}.`;
    }

    state.stats.turns++;
    render();

    if (checkEndGame()) return;

    state.turn = 'player';
  }

  // --- End Game & Debriefing ---
  function checkEndGame() {
    const enemyAllSunk = state.enemy.ships.every(s => s.sunk);
    const playerAllSunk = state.player.ships.every(s => s.sunk);

    if (enemyAllSunk || playerAllSunk) {
      state.phase = 'over';

      const victory = enemyAllSunk;
      const shots = state.stats.playerShots;
      const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
      const survivors = state.player.ships.filter(s => !s.sunk).length;

      let rank = '★☆☆☆☆ SEAMAN RECRUIT';
      if (victory) {
        if (shots <= 34) rank = '★★★★★ FLEET ADMIRAL';
        else if (shots <= 45) rank = '★★★★☆ VICE ADMIRAL';
        else if (shots <= 55) rank = '★★★☆☆ COMMODORE';
        else rank = '★★☆☆☆ COMMANDER';
        sfx.play('win');
      } else {
        sfx.play('sunk');
      }

      dom.modalRankBadge.textContent = rank;
      dom.modalTitle.textContent = victory ? 'VICTORY' : 'DEFEAT';
      dom.modalDesc.textContent = victory
        ? 'All hostile vessels neutralized. Sector dominance secured.'
        : 'Friendly fleet suffered catastrophic losses. Mission failed.';

      dom.modalTurns.textContent = state.stats.turns;
      dom.modalAccuracy.textContent = `${acc}%`;
      dom.modalSurvivors.textContent = `${survivors}/5`;

      // Build social emoji mission preview
      const previewRows = [];
      state.enemy.ships.forEach(s => {
        previewRows.push(s.sunk ? '🟥' : '🟦');
      });
      dom.sharePreviewGrid.textContent = `FLEET STATUS: ${previewRows.join(' ')}`;

      dom.gameModal.classList.remove('hidden');
      return true;
    }
    return false;
  }

  // --- Render Matrix & HUD ---
  function renderGrid(container, fleet, hideShips = false) {
    const cells = container.children;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const cellEl = cells[idx];
        const data = fleet.grid[r][c];

        cellEl.className = 'cell';
        cellEl.innerHTML = '';
        cellEl.removeAttribute('data-orient');
        cellEl.removeAttribute('data-part');

        if (data) {
          if (data.state === 'miss') {
            cellEl.classList.add('miss');
          } else if (data.state === 'hit') {
            const ship = fleet.ships.find(s => s.id === data.shipId);
            cellEl.classList.add(ship && ship.sunk ? 'sunk' : 'hit');
          }

          // Render realistic ship anatomy (friendly or when enemy ship is sunk)
          const ship = fleet.ships.find(s => s.id === data.shipId);
          const showShip = !hideShips || (ship && ship.sunk);

          if (showShip && data.shipId) {
            cellEl.setAttribute('data-orient', data.orient);
            cellEl.setAttribute('data-part', data.part);

            const hull = document.createElement('div');
            hull.className = 'ship-hull';

            // Internal deck detail icon
            if (ship.detail === 'turret' && data.part === 'mid') {
              const turret = document.createElement('div');
              turret.className = 'hull-turret';
              hull.appendChild(turret);
            } else if (ship.detail === 'runway') {
              const stripe = document.createElement('div');
              stripe.className = 'hull-carrier-stripe';
              hull.appendChild(stripe);
            } else if (ship.detail === 'sub' && data.part === 'mid') {
              const tower = document.createElement('div');
              tower.className = 'hull-sub-tower';
              hull.appendChild(tower);
            }

            cellEl.appendChild(hull);
          }
        }
      }
    }
  }

  function renderIndicators() {
    const populatePips = (fleet, container) => {
      container.innerHTML = '';
      fleet.ships.forEach(s => {
        const pip = document.createElement('div');
        pip.className = 'pip' + (s.sunk ? ' sunk' : '');
        pip.title = `${s.name} (${s.size})`;
        container.appendChild(pip);
      });
    };

    populatePips(state.player, dom.playerFleetPills);
    populatePips(state.enemy, dom.enemyFleetPills);

    const pAlive = state.player.ships.filter(s => !s.sunk).length;
    const eAlive = state.enemy.ships.filter(s => !s.sunk).length;

    dom.playerFleetCount.textContent = pAlive;
    dom.enemyFleetCount.textContent = eAlive;
    dom.sunkVal.textContent = `${5 - eAlive}/5`;
  }

  function render() {
    renderGrid(dom.playerGrid, state.player, false);
    renderGrid(dom.enemyGrid, state.enemy, true);
    renderIndicators();

    // Stats
    const shots = state.stats.playerShots;
    const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
    dom.shotsVal.textContent = shots;
    dom.accuracyVal.textContent = `${acc}%`;

    // Deck Phase Toggle
    if (state.phase === 'setup') {
      dom.setupControls.classList.remove('hidden');
      dom.battleControls.classList.add('hidden');
      renderShipDock();

      const allPlaced = state.player.ships.every(s => s.placed);
      dom.startBattleBtn.disabled = !allPlaced;
    } else {
      dom.setupControls.classList.add('hidden');
      dom.battleControls.classList.remove('hidden');
    }
  }

  // --- Mobile Single-View Thumb Switcher ---
  function switchView(view) {
    if (view === 'enemy') {
      dom.tabEnemy.classList.add('active');
      dom.tabPlayer.classList.remove('active');
      dom.enemyCard.classList.add('active');
      dom.playerCard.classList.remove('active');
    } else {
      dom.tabPlayer.classList.add('active');
      dom.tabEnemy.classList.remove('active');
      dom.playerCard.classList.add('active');
      dom.enemyCard.classList.remove('active');
      dom.defenseAlertPing.classList.add('hidden');
    }
    if (fxEngine) fxEngine.resize();
  }

  // --- Social Mission Debrief Sharing ---
  function shareReport() {
    const shots = state.stats.playerShots;
    const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
    const survivors = state.player.ships.filter(s => !s.sunk).length;
    const rank = dom.modalRankBadge.textContent;

    const shareText = [
      '⚓ BATTLESHIP // COMMAND MISSION DEBRIEF ⚓',
      `Rank: ${rank}`,
      `Salvoes: ${state.stats.turns} | Accuracy: ${acc}%`,
      `Survivors: ${survivors}/5 Warships`,
      'Sector Status: SECURED',
      'Play Tactical Battleship!'
    ].join('\n');

    if (navigator.share) {
      navigator.share({
        title: 'Battleship Mission Debrief',
        text: shareText
      }).catch(() => copyToClipboard(shareText));
    } else {
      copyToClipboard(shareText);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('MISSION REPORT COPIED TO CLIPBOARD');
    }).catch(() => {
      showToast('READY FOR SCREENSHOT');
    });
  }

  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.remove('hidden');
    setTimeout(() => dom.toast.classList.add('hidden'), 2200);
  }

  // --- Reset & Campaign Initializer ---
  function resetGame() {
    state.phase = 'setup';
    state.turn = 'player';
    state.selectedShipIndex = 0;
    state.orientation = 'h';
    state.stats = { playerShots: 0, playerHits: 0, turns: 0 };
    state.ai = { targetQueue: [], activeHits: [], lastHitShipId: null };
    state.player = createFleet();
    state.enemy = createFleet();

    dom.gameModal.classList.add('hidden');
    dom.defenseAlertPing.classList.add('hidden');
    dom.orientationLabel.textContent = 'ROT (H)';
    dom.commsText.textContent = 'FLEET DEPLOYMENT // DRAG OR TAP TO POSITION VESSELS';

    // Auto-deploy hostile fleet secretly
    autoPlaceAll(state.enemy);

    switchView('player');
    render();
  }

  // --- Event Wiring ---
  function wireEvents() {
    // Theater Tabs
    dom.tabEnemy.addEventListener('click', () => { sfx.play('tap'); switchView('enemy'); });
    dom.tabPlayer.addEventListener('click', () => { sfx.play('tap'); switchView('player'); });

    // Rotate Ship
    dom.rotateBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.orientationLabel.textContent = `ROT (${state.orientation.toUpperCase()})`;
      sfx.play('tap');
      triggerHaptic(15);
    });

    // Auto Scramble
    dom.randomBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      autoPlaceAll(state.player);
      sfx.play('tap');
      triggerHaptic([20, 20, 30]);
      render();
    });

    // Engage Battle
    dom.startBattleBtn.addEventListener('click', () => {
      if (!state.player.ships.every(s => s.placed)) return;
      state.phase = 'playing';
      sfx.play('sonar');
      triggerHaptic(35);
      dom.commsText.textContent = 'BATTLE ENGAGED // ACQUIRE HOSTILE RADAR TARGETS';
      switchView('enemy');
      render();
    });

    // Sonar Ping Button
    dom.sonarBtn.addEventListener('click', () => {
      sfx.play('sonar');
      triggerHaptic(25);
    });

    // Rematch & Abort
    dom.restartBtn.addEventListener('click', () => {
      sfx.play('tap');
      resetGame();
    });

    dom.playAgainBtn.addEventListener('click', () => {
      sfx.play('tap');
      resetGame();
    });

    // Social Share
    dom.shareReportBtn.addEventListener('click', () => {
      sfx.play('tap');
      shareReport();
    });

    // Audio Mute Toggle
    dom.soundToggle.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('btl_sound', sfx.enabled);
      dom.soundOnIcon.classList.toggle('hidden', !sfx.enabled);
      dom.soundOffIcon.classList.toggle('hidden', sfx.enabled);
      if (sfx.enabled) sfx.play('tap');
    });

    // Audio Context Initializer on First User Interaction
    const unlockAudio = () => {
      sfx.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
  }

  // --- Initializer ---
  function init() {
    fxEngine = new CanvasFXEngine(dom.fxCanvas);
    buildCoordinates();
    buildGridCells(dom.enemyGrid, onEnemyGridCellClick, false);
    buildGridCells(dom.playerGrid, onPlayerGridCellClick, true);

    dom.soundOnIcon.classList.toggle('hidden', !sfx.enabled);
    dom.soundOffIcon.classList.toggle('hidden', sfx.enabled);

    wireEvents();
    resetGame();
  }

  document.addEventListener('DOMContentLoaded', init);
})();