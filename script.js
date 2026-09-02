/* ==========================================================================
   BATTLESHIP: Aegis Modern Naval Combat
   Architecture: Synthesizer, FX Canvas, Probability AI, Gameplay State
   ========================================================================== */

(() => {
  'use strict';

  // ---------- Fleet Configuration ----------
  const GRID_SIZE = 10;
  const COLS = ['A','B','C','D','E','F','G','H','I','J'];

  const FLEET_MANIFEST = [
    { id: 'carrier',   name: 'Carrier',    size: 5, symbol: 'CVN-78' },
    { id: 'battleship',name: 'Battleship', size: 4, symbol: 'BB-63'  },
    { id: 'cruiser',   name: 'Cruiser',    size: 3, symbol: 'CG-72'  },
    { id: 'submarine', name: 'Submarine',  size: 3, symbol: 'SSN-774'},
    { id: 'destroyer', name: 'Destroyer',  size: 2, symbol: 'DDG-51' },
  ];

  // ---------- Game State Tree ----------
  const state = {
    phase: 'setup',            // 'setup' | 'playing' | 'over'
    turn: 'player',            // 'player' | 'enemy'
    orientation: 'h',          // 'h' | 'v'
    selectedShipId: null,
    draggedShipId: null,
    activeAbility: null,       // null | 'sonar' | 'airRecon'
    energy: 0,
    maxEnergy: 100,
    difficulty: 'captain',     // 'recruit' | 'captain' | 'admiral'
    soundEnabled: true,
    stats: {
      playerShots: 0,
      playerHits: 0,
      enemyShots: 0,
      enemyHits: 0,
      turns: 1,
    },
    player: createFleet(),
    enemy: createFleet(),
    aiMemory: {
      huntQueue: [],
      targetHits: [],
      currentLineDir: null,
    }
  };

  function createFleet() {
    return {
      grid: Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({
          ship: null,        // ship id or null
          state: 'empty',    // 'empty' | 'ship' | 'miss' | 'hit' | 'sunk'
        }))
      ),
      ships: FLEET_MANIFEST.map(s => ({
        ...s,
        placed: false,
        cells: [],           // array of [r, c]
        hits: 0,
        sunk: false,
        orientation: 'h'
      }))
    };
  }

  // ---------- DOM Query Selector ----------
  const $ = (id) => document.getElementById(id);
  const dom = {
    enemyGrid: $('enemyGrid'),
    playerGrid: $('playerGrid'),
    enemyCoordsX: $('enemyCoordsX'),
    enemyCoordsY: $('enemyCoordsY'),
    playerCoordsX: $('playerCoordsX'),
    playerCoordsY: $('playerCoordsY'),
    shipDockTray: $('shipDockTray'),
    commenceBattleBtn: $('commenceBattleBtn'),
    rotateShipBtn: $('rotateShipBtn'),
    orientationLabel: $('orientationLabel'),
    autoDeployBtn: $('autoDeployBtn'),
    resetFleetBtn: $('resetFleetBtn'),
    aiDifficultySelect: $('aiDifficultySelect'),
    soundToggleBtn: $('soundToggleBtn'),
    soundIconOn: $('soundIconOn'),
    soundIconOff: $('soundIconOff'),
    helpModalBtn: $('helpModalBtn'),
    rulesModal: $('rulesModal'),
    aarModal: $('aarModal'),
    aarPlayAgainBtn: $('aarPlayAgainBtn'),
    tickerMsg: $('tickerMsg'),
    tickerTag: $('tickerTag'),
    tickerBeacon: $('tickerBeacon'),
    hudAccuracy: $('hudAccuracy'),
    hudTurns: $('hudTurns'),
    energyVal: $('energyVal'),
    energyFill: $('energyFill'),
    sonarBtn: $('sonarBtn'),
    airReconBtn: $('airReconBtn'),
    alertToast: $('alertToast'),
    combatLogFeed: $('combatLogFeed'),
    fxCanvas: $('fxCanvas'),
    playerFleetPills: $('playerFleetPills'),
    enemyFleetPills: $('enemyFleetPills'),
    hangarBay: $('hangarBay'),
    tacticalDeck: $('tacticalDeck'),
  };

  // ==========================================================================
  // PROCEDURAL WEB AUDIO SYNTHESIZER (Zero external asset dependencies)
  // ==========================================================================
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      initAudioContext();
      const ctx = audioCtx;
      const t = ctx.currentTime;

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
        g.gain.setValueAtTime(0.06, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.05);
        osc.start(t); osc.stop(t + 0.05);
      }
      else if (type === 'sonar') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(960, t);
        osc.frequency.linearRampToValueAtTime(940, t + 0.8);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.start(t); osc.stop(t + 1.2);
      }
      else if (type === 'missile_launch') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(700, t + 0.35);
        g.gain.setValueAtTime(0.14, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);
      }
      else if (type === 'splash') {
        const bSize = ctx.sampleRate * 0.4;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const o = b.getChannelData(0);
        for (let i = 0; i < bSize; i++) o[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = b;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(450, t);
        f.Q.setValueAtTime(2.5, t);
        const g = ctx.createGain();
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        src.start(t);
      }
      else if (type === 'hit') {
        // Multi-layered explosion crunch
        const osc = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc.connect(g1); g1.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.4);
        g1.gain.setValueAtTime(0.2, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);

        const bSize = ctx.sampleRate * 0.5;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
        const src = ctx.createBufferSource();
        src.buffer = b;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(320, t);
        const g2 = ctx.createGain();
        src.connect(f); f.connect(g2); g2.connect(ctx.destination);
        g2.gain.setValueAtTime(0.25, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        src.start(t);
      }
      else if (type === 'sunk') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.linearRampToValueAtTime(45, t + 0.9);
        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
        osc.start(t); osc.stop(t + 1.1);
      }
    } catch (_) {}
  }

  // ==========================================================================
  // DYNAMIC BALLISTICS & PARTICLE FX CANVAS ENGINE
  // ==========================================================================
  const fx = {
    canvas: dom.fxCanvas,
    ctx: dom.fxCanvas.getContext('2d'),
    particles: [],
    missiles: [],
    sonarRings: [],

    init() {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    },

    resize() {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    },

    createExplosion(x, y, isBig = false) {
      const count = isBig ? 65 : 35;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isBig ? 6 : 4) + 1;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3 + 2,
          life: 1,
          decay: Math.random() * 0.03 + 0.02,
          color: Math.random() > 0.4 ? '#ff2a55' : '#ffb703'
        });
      }
    },

    createSplash(x, y) {
      for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 0.8;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          radius: Math.random() * 2.5 + 1.5,
          life: 1,
          decay: Math.random() * 0.035 + 0.02,
          color: '#00f0ff'
        });
      }
    },

    launchMissile(startX, startY, targetX, targetY, onImpact) {
      this.missiles.push({
        x: startX,
        y: startY,
        startX, startY, targetX, targetY,
        progress: 0,
        speed: 0.035,
        onImpact,
      });
      playSound('missile_launch');
    },

    triggerSonarPing(x, y) {
      this.sonarRings.push({ x, y, radius: 10, maxRadius: 160, life: 1 });
      playSound('sonar');
    },

    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. Sonar Waves
      for (let i = this.sonarRings.length - 1; i >= 0; i--) {
        const ring = this.sonarRings[i];
        ring.radius += 3.5;
        ring.life -= 0.02;

        this.ctx.beginPath();
        this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(0, 240, 255, ${ring.life * 0.7})`;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        if (ring.life <= 0) this.sonarRings.splice(i, 1);
      }

      // 2. Ballistic Missiles
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        m.progress += m.speed;

        // Parabolic trajectory
        const curX = m.startX + (m.targetX - m.startX) * m.progress;
        const curY = m.startY + (m.targetY - m.startY) * m.progress - Math.sin(m.progress * Math.PI) * 120;

        // Thrust particle trail
        this.particles.push({
          x: curX, y: curY,
          vx: (Math.random() - 0.5) * 1,
          vy: Math.random() * 1.5,
          radius: Math.random() * 2 + 1,
          life: 0.6,
          decay: 0.04,
          color: '#ffb703'
        });

        // Draw projectile head
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(curX, curY, 3, 0, Math.PI * 2);
        this.ctx.fill();

        if (m.progress >= 1) {
          if (m.onImpact) m.onImpact();
          this.missiles.splice(i, 1);
        }
      }

      // 3. Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, p.life);
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();

        if (p.life <= 0) this.particles.splice(i, 1);
      }

      requestAnimationFrame(this.loop);
    }
  };

  // ==========================================================================
  // HIGH-FIDELITY VECTOR WARSHIP RENDERER
  // ==========================================================================
  function generateShipSVG(shipId, size, isVertical = false) {
    // Generate tailored SVG silhouettes representing each unique naval vessel
    const width = isVertical ? 34 : size * 40;
    const height = isVertical ? size * 40 : 34;

    let shipDetails = '';
    if (shipId === 'carrier') {
      shipDetails = `
        <polygon points="12,4 ${width - 12},4 ${width - 4},16 ${width - 12},30 12,30 4,16" fill="#1b3652" stroke="#00f0ff" stroke-width="1.5" />
        <line x1="16" y1="17" x2="${width - 16}" y2="17" stroke="#ffffff" stroke-dasharray="8 6" stroke-width="1.5" />
        <rect x="${width - 45}" y="7" width="16" height="5" fill="#00f0ff" rx="1" />
        <circle cx="28" cy="11" r="2.5" fill="#ffb703" />
        <circle cx="44" cy="11" r="2.5" fill="#ffb703" />
      `;
    } else if (shipId === 'battleship') {
      shipDetails = `
        <polygon points="10,6 ${width - 10},6 ${width - 2},17 ${width - 10},28 10,28 2,17" fill="#172e47" stroke="#00f0ff" stroke-width="1.5" />
        <circle cx="28" cy="17" r="5" fill="#2d527c" stroke="#00f0ff" stroke-width="1" />
        <line x1="28" y1="17" x2="42" y2="17" stroke="#00f0ff" stroke-width="2" />
        <circle cx="${width - 32}" cy="17" r="5" fill="#2d527c" stroke="#00f0ff" stroke-width="1" />
        <line x1="${width - 32}" y1="17" x2="${width - 46}" y2="17" stroke="#00f0ff" stroke-width="2" />
      `;
    } else if (shipId === 'submarine') {
      shipDetails = `
        <rect x="6" y="8" width="${width - 12}" height="18" rx="9" fill="#0c1d30" stroke="#00f0ff" stroke-width="1.5" />
        <ellipse cx="${width * 0.45}" cy="17" rx="9" ry="4" fill="#00f0ff" opacity="0.8" />
        <circle cx="${width - 12}" cy="17" r="3" fill="#ffb703" />
      `;
    } else if (shipId === 'cruiser') {
      shipDetails = `
        <polygon points="8,7 ${width - 8},7 ${width - 2},17 ${width - 8},27 8,27 2,17" fill="#183454" stroke="#00f0ff" stroke-width="1.5" />
        <rect x="24" y="11" width="12" height="12" fill="#2d527c" rx="2" />
        <circle cx="${width * 0.65}" cy="17" r="4" fill="#00f0ff" />
      `;
    } else { // Destroyer
      shipDetails = `
        <polygon points="6,9 ${width - 6},9 ${width - 1},17 ${width - 6},25 6,25 1,17" fill="#142c47" stroke="#00f0ff" stroke-width="1.5" />
        <circle cx="22" cy="17" r="3" fill="#00f0ff" />
        <rect x="${width - 28}" y="12" width="10" height="10" fill="#2d527c" rx="1" />
      `;
    }

    if (isVertical) {
      return `
        <svg class="ship-hull-svg" viewBox="0 0 ${width} ${height}" style="transform-origin: center;">
          <g transform="rotate(90, ${width / 2}, ${height / 2}) translate(${(width - height) / 2}, ${(height - width) / 2})">
            ${shipDetails}
          </g>
        </svg>
      `;
    }

    return `<svg class="ship-hull-svg" viewBox="0 0 ${width} ${height}">${shipDetails}</svg>`;
  }

  // ==========================================================================
  // FLEET DEPLOYMENT & GEOMETRY
  // ==========================================================================
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

  function getShipCells(r, c, size, orientation) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push([
        orientation === 'v' ? r + i : r,
        orientation === 'h' ? c + i : c
      ]);
    }
    return cells;
  }

  function canPlaceShip(fleet, r, c, size, orientation, excludeShipId = null) {
    const cells = getShipCells(r, c, size, orientation);
    for (const [rr, cc] of cells) {
      if (!inBounds(rr, cc)) return false;
      const occupyingId = fleet.grid[rr][cc].ship;
      if (occupyingId !== null && occupyingId !== excludeShipId) {
        return false;
      }
    }
    return true;
  }

  function placeShip(fleet, shipId, r, c, orientation) {
    const ship = fleet.ships.find(s => s.id === shipId);
    if (!ship) return;

    // Clear prior assignment
    if (ship.placed) removeShip(fleet, shipId);

    const cells = getShipCells(r, c, ship.size, orientation);
    for (const [rr, cc] of cells) {
      fleet.grid[rr][cc].ship = shipId;
      fleet.grid[rr][cc].state = 'ship';
    }

    ship.cells = cells;
    ship.orientation = orientation;
    ship.placed = true;
  }

  function removeShip(fleet, shipId) {
    const ship = fleet.ships.find(s => s.id === shipId);
    if (!ship || !ship.placed) return;

    for (const [r, c] of ship.cells) {
      fleet.grid[r][c].ship = null;
      fleet.grid[r][c].state = 'empty';
    }
    ship.cells = [];
    ship.placed = false;
  }

  function autoDeployFleet(fleet) {
    fleet.ships.forEach(s => removeShip(fleet, s.id));

    fleet.ships.forEach(ship => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 500) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);

        if (canPlaceShip(fleet, r, c, ship.size, ori)) {
          placeShip(fleet, ship.id, r, c, ori);
          placed = true;
        }
        attempts++;
      }
    });
  }

  // ==========================================================================
  // HIGH-TIER ADMIRAL PROBABILITY DENSITY MATRIX AI
  // ==========================================================================
  function calculateProbabilityMatrix() {
    const density = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const targetBoard = state.player.grid;
    const remainingShips = state.player.ships.filter(s => !s.sunk);

    // Compute potential ship footprints
    for (const ship of remainingShips) {
      for (const ori of ['h', 'v']) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const cells = getShipCells(r, c, ship.size, ori);
            let isValid = true;
            let hitsContained = 0;

            for (const [rr, cc] of cells) {
              if (!inBounds(rr, cc)) { isValid = false; break; }
              const cellState = targetBoard[rr][cc].state;
              if (cellState === 'miss' || cellState === 'sunk') {
                isValid = false;
                break;
              }
              if (cellState === 'hit') {
                hitsContained++;
              }
            }

            if (isValid) {
              // Weight configuration: Massive multiplier for intersecting known hits
              const weight = 1 + (hitsContained * 80);
              for (const [rr, cc] of cells) {
                if (targetBoard[rr][cc].state === 'empty' || targetBoard[rr][cc].state === 'ship') {
                  density[rr][cc] += weight;
                }
              }
            }
          }
        }
      }
    }

    return density;
  }

  function pickAITarget() {
    const diff = state.difficulty;
    const board = state.player.grid;
    const untouched = (r, c) => board[r][c].state === 'empty' || board[r][c].state === 'ship';

    // 1. ADMIRAL (Probability Density Mapping)
    if (diff === 'admiral') {
      const density = calculateProbabilityMatrix();
      let maxScore = -1;
      let bestTargets = [];

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (untouched(r, c)) {
            if (density[r][c] > maxScore) {
              maxScore = density[r][c];
              bestTargets = [[r, c]];
            } else if (density[r][c] === maxScore) {
              bestTargets.push([r, c]);
            }
          }
        }
      }
      if (bestTargets.length > 0) {
        return bestTargets[Math.floor(Math.random() * bestTargets.length)];
      }
    }

    // 2. CAPTAIN (Parity Hunt + Line Follow Target)
    if (diff === 'captain') {
      const memory = state.aiMemory;
      memory.huntQueue = memory.huntQueue.filter(([r, c]) => untouched(r, c));

      if (memory.huntQueue.length > 0) {
        return memory.huntQueue.shift();
      }

      // Parity checkerboard search
      const parityCells = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (untouched(r, c) && (r + c) % 2 === 0) {
            parityCells.push([r, c]);
          }
        }
      }
      if (parityCells.length > 0) {
        return parityCells[Math.floor(Math.random() * parityCells.length)];
      }
    }

    // 3. ENSIGN (Casual Random Scan)
    const valid = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (untouched(r, c)) valid.push([r, c]);
      }
    }
    return valid.length > 0 ? valid[Math.floor(Math.random() * valid.length)] : null;
  }

  function recordAIHit(r, c) {
    const memory = state.aiMemory;
    memory.targetHits.push([r, c]);

    // Populate adjacent tactical queue
    const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
    for (const [nr, nc] of neighbors) {
      if (inBounds(nr, nc) && (state.player.grid[nr][nc].state === 'empty' || state.player.grid[nr][nc].state === 'ship')) {
        if (!memory.huntQueue.some(([qr, qc]) => qr === nr && qc === nc)) {
          memory.huntQueue.push([nr, nc]);
        }
      }
    }
  }

  function resetAIShipMemory() {
    state.aiMemory.huntQueue = [];
    state.aiMemory.targetHits = [];
    state.aiMemory.currentLineDir = null;
  }

  // ==========================================================================
  // RENDERING & INTERFACE SYNC
  // ==========================================================================
  function buildCoordinateHeaders() {
    // Generate Column labels A-J
    dom.enemyCoordsX.innerHTML = '';
    dom.playerCoordsX.innerHTML = '';
    COLS.forEach(col => {
      const c1 = document.createElement('span'); c1.className = 'coord-label-x'; c1.textContent = col;
      const c2 = document.createElement('span'); c2.className = 'coord-label-x'; c2.textContent = col;
      dom.enemyCoordsX.appendChild(c1);
      dom.playerCoordsX.appendChild(c2);
    });

    // Generate Row labels 1-10
    dom.enemyCoordsY.innerHTML = '';
    dom.playerCoordsY.innerHTML = '';
    for (let i = 1; i <= GRID_SIZE; i++) {
      const r1 = document.createElement('span'); r1.className = 'coord-label-y'; r1.textContent = i;
      const r2 = document.createElement('span'); r2.className = 'coord-label-y'; r2.textContent = i;
      dom.enemyCoordsY.appendChild(r1);
      dom.playerCoordsY.appendChild(r2);
    }
  }

  function buildGridDOM(gridEl, isEnemy = false) {
    gridEl.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.setAttribute('role', 'gridcell');

        const pip = document.createElement('div');
        pip.className = 'pip-marker';
        cell.appendChild(pip);

        gridEl.appendChild(cell);
      }
    }
  }

  function renderGridHulls(containerEl, fleet, isEnemy = false) {
    // Remove previous SVG hull overlay elements
    containerEl.querySelectorAll('.ship-hull-layer').forEach(e => e.remove());

    fleet.ships.forEach(ship => {
      if (!ship.placed) return;
      if (isEnemy && !ship.sunk && state.phase !== 'over') return;

      const [r0, c0] = ship.cells[0];
      const isVert = ship.orientation === 'v';

      const hullLayer = document.createElement('div');
      hullLayer.className = 'ship-hull-layer' + (ship.sunk ? ' sunk-ship' : '');
      hullLayer.style.top = `calc(${r0} * var(--cell-size) + 4px)`;
      hullLayer.style.left = `calc(${c0} * var(--cell-size) + 4px)`;
      hullLayer.style.width = isVert ? 'var(--cell-size)' : `calc(${ship.size} * var(--cell-size))`;
      hullLayer.style.height = isVert ? `calc(${ship.size} * var(--cell-size))` : 'var(--cell-size)';

      hullLayer.innerHTML = generateShipSVG(ship.id, ship.size, isVert);
      containerEl.appendChild(hullLayer);
    });
  }

  function syncGridStates(gridEl, fleet) {
    const cells = gridEl.children;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = cells[r * GRID_SIZE + c];
        const cellData = fleet.grid[r][c];

        cell.classList.remove('state-miss', 'state-hit', 'state-sunk');
        if (cellData.state === 'miss') cell.classList.add('state-miss');
        else if (cellData.state === 'hit') cell.classList.add('state-hit');
        else if (cellData.state === 'sunk') cell.classList.add('state-sunk');
      }
    }
  }

  function renderHangarDock() {
    dom.shipDockTray.innerHTML = '';
    state.player.ships.forEach(ship => {
      const card = document.createElement('div');
      card.className = 'dock-ship-card' +
        (ship.placed ? ' deployed' : '') +
        (ship.id === state.selectedShipId ? ' selected' : '');
      card.dataset.shipId = ship.id;

      card.innerHTML = `
        <div class="dock-card-top">
          <span class="dock-ship-name">${ship.name}</span>
          <span class="dock-ship-len">${ship.size}c</span>
        </div>
        <div class="dock-ship-visual">
          ${Array(ship.size).fill('<div class="dock-seg"></div>').join('')}
        </div>
      `;

      card.addEventListener('click', () => {
        if (state.phase !== 'setup') return;
        if (ship.placed) {
          removeShip(state.player, ship.id);
          playSound('click');
          state.selectedShipId = ship.id;
          refreshUI();
        } else {
          state.selectedShipId = ship.id;
          playSound('click');
          refreshUI();
        }
      });

      dom.shipDockTray.appendChild(card);
    });
  }

  function updateHUD() {
    // 1. Fleet status lights
    state.player.ships.forEach(ship => {
      const pill = dom.playerFleetPills.querySelector(`[data-ship="${ship.id}"]`);
      if (pill) pill.classList.toggle('sunk', ship.sunk);
    });

    state.enemy.ships.forEach(ship => {
      const pill = dom.enemyFleetPills.querySelector(`[data-ship="${ship.id}"]`);
      if (pill) pill.classList.toggle('sunk', ship.sunk);
    });

    // 2. Accuracy & Turns
    const shots = state.stats.playerShots;
    const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
    dom.hudAccuracy.textContent = `${acc}%`;
    dom.hudTurns.textContent = String(state.stats.turns).padStart(2, '0');

    // 3. Command Energy & Abilities
    dom.energyVal.textContent = `${state.energy} / ${state.maxEnergy}`;
    dom.energyFill.style.width = `${(state.energy / state.maxEnergy) * 100}%`;

    dom.sonarBtn.disabled = state.energy < 35 || state.turn !== 'player';
    dom.airReconBtn.disabled = state.energy < 60 || state.turn !== 'player';
  }

  function postCombatLog(text, type = 'sys') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString().slice(3, 8)}] ${text}`;
    dom.combatLogFeed.prepend(entry);
  }

  function triggerToast(text, kind = '') {
    dom.alertToast.textContent = text;
    dom.alertToast.className = `alert-toast show ${kind}`;
    clearTimeout(dom.alertToast.timer);
    dom.alertToast.timer = setTimeout(() => {
      dom.alertToast.classList.remove('show');
    }, 2800);
  }

  function refreshUI() {
    syncGridStates(dom.playerGrid, state.player);
    syncGridStates(dom.enemyGrid, state.enemy);
    renderGridHulls(dom.playerGrid, state.player, false);
    renderGridHulls(dom.enemyGrid, state.enemy, true);
    renderHangarDock();
    updateHUD();

    // Check deployment readiness
    const allPlaced = state.player.ships.every(s => s.placed);
    dom.commenceBattleBtn.disabled = !allPlaced || state.phase !== 'setup';
  }

  // ==========================================================================
  // SHIP PLACEMENT & INTERACTION
  // ==========================================================================
  function clearPlacementPreview() {
    dom.playerGrid.querySelectorAll('.placement-valid, .placement-invalid').forEach(c => {
      c.classList.remove('placement-valid', 'placement-invalid');
    });
  }

  function showPlacementPreview(r, c) {
    if (state.phase !== 'setup' || !state.selectedShipId) return;
    clearPlacementPreview();

    const ship = state.player.ships.find(s => s.id === state.selectedShipId);
    if (!ship) return;

    const cells = getShipCells(r, c, ship.size, state.orientation);
    const valid = canPlaceShip(state.player, r, c, ship.size, state.orientation, ship.id);

    for (const [rr, cc] of cells) {
      if (inBounds(rr, cc)) {
        const el = dom.playerGrid.children[rr * GRID_SIZE + cc];
        el.classList.add(valid ? 'placement-valid' : 'placement-invalid');
      }
    }
  }

  function handlePlacementClick(r, c) {
    if (state.phase !== 'setup') return;

    // Find next unplaced ship if none selected
    if (!state.selectedShipId) {
      const next = state.player.ships.find(s => !s.placed);
      if (next) state.selectedShipId = next.id;
      else return;
    }

    const ship = state.player.ships.find(s => s.id === state.selectedShipId);
    if (!ship) return;

    if (!canPlaceShip(state.player, r, c, ship.size, state.orientation, ship.id)) {
      triggerToast('Zone obstructed or out of bounds!', 'warn');
      return;
    }

    placeShip(state.player, ship.id, r, c, state.orientation);
    playSound('click');

    // Auto-select following ship
    const remaining = state.player.ships.find(s => !s.placed);
    state.selectedShipId = remaining ? remaining.id : null;

    clearPlacementPreview();
    refreshUI();
  }

  // ==========================================================================
  // COMBAT ENGINE & TACTICAL ABILITIES
  // ==========================================================================
  function resolveShot(fleet, r, c) {
    const targetCell = fleet.grid[r][c];
    if (targetCell.ship !== null) {
      targetCell.state = 'hit';
      const ship = fleet.ships.find(s => s.id === targetCell.ship);
      ship.hits++;

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        for (const [sr, sc] of ship.cells) {
          fleet.grid[sr][sc].state = 'sunk';
        }
        return { type: 'sunk', ship };
      }
      return { type: 'hit', ship };
    } else {
      targetCell.state = 'miss';
      return { type: 'miss', ship: null };
    }
  }

  function handleOffensiveStrike(r, c) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;

    // 1. Tactical Ability Execution
    if (state.activeAbility === 'sonar') {
      executeSonarPing(r, c);
      return;
    }
    if (state.activeAbility === 'airRecon') {
      executeAirRecon(r, c);
      return;
    }

    // 2. Standard Artillery Strike
    const targetCell = state.enemy.grid[r][c];
    if (targetCell.state !== 'empty' && targetCell.state !== 'ship') {
      triggerToast('Sector coordinates already targeted.', 'warn');
      return;
    }

    state.turn = 'busy';
    state.stats.playerShots++;

    // Calculate screen-space coordinates for ballistic missile trajectory
    const cellEl = dom.enemyGrid.children[r * GRID_SIZE + c];
    const rect = cellEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    const startX = window.innerWidth * 0.5;
    const startY = window.innerHeight - 40;

    fx.launchMissile(startX, startY, targetX, targetY, () => {
      const outcome = resolveShot(state.enemy, r, c);

      if (outcome.type === 'hit') {
        fx.createExplosion(targetX, targetY);
        playSound('hit');
        state.stats.playerHits++;
        state.energy = Math.min(state.maxEnergy, state.energy + 20);
        postCombatLog(`Direct hit on hostile vessel at [${COLS[c]}${r + 1}]!`, 'hit');
        triggerToast('Direct Hit!', 'success');
      } else if (outcome.type === 'sunk') {
        fx.createExplosion(targetX, targetY, true);
        playSound('sunk');
        state.stats.playerHits++;
        state.energy = Math.min(state.maxEnergy, state.energy + 35);
        postCombatLog(`Hostile ${outcome.ship.name.toUpperCase()} neutralized!`, 'sunk');
        triggerToast(`Enemy ${outcome.ship.name} Sunk!`, 'success');
      } else {
        fx.createSplash(targetX, targetY);
        playSound('splash');
        state.energy = Math.min(state.maxEnergy, state.energy + 8);
        postCombatLog(`Splash at [${COLS[c]}${r + 1}]. No contact.`, 'miss');
      }

      refreshUI();

      if (checkEngagementEnd()) return;

      // Pass turn to adversary
      state.turn = 'enemy';
      dom.tickerMsg.textContent = 'Hostile command plotting salvo...';
      dom.tickerTag.textContent = 'DEFENSE STATUS: ALERT';
      setTimeout(executeAITurn, 900);
    });
  }

  function executeSonarPing(centerR, centerC) {
    if (state.energy < 35) return;
    state.energy -= 35;
    state.activeAbility = null;
    dom.sonarBtn.classList.remove('active-ability');

    const cellEl = dom.enemyGrid.children[centerR * GRID_SIZE + centerC];
    const rect = cellEl.getBoundingClientRect();
    fx.triggerSonarPing(rect.left + rect.width / 2, rect.top + rect.height / 2);

    let detectedHullSegments = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = centerR + dr, cc = centerC + dc;
        if (inBounds(rr, cc)) {
          if (state.enemy.grid[rr][cc].ship !== null && state.enemy.grid[rr][cc].state !== 'sunk') {
            detectedHullSegments++;
          }
        }
      }
    }

    postCombatLog(`Sonar ping at [${COLS[centerC]}${centerR + 1}]: Detected ${detectedHullSegments} hull contacts.`, 'sys');
    triggerToast(`Sonar Survey: ${detectedHullSegments} Hull Contacts Detected`, 'success');
    updateHUD();
  }

  function executeAirRecon(centerR, centerC) {
    if (state.energy < 60) return;
    state.energy -= 60;
    state.activeAbility = null;
    dom.airReconBtn.classList.remove('active-ability');

    let contacts = 0;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (state.enemy.grid[centerR][c].ship !== null && state.enemy.grid[centerR][c].state === 'ship') contacts++;
    }
    for (let r = 0; r < GRID_SIZE; r++) {
      if (state.enemy.grid[r][centerC].ship !== null && state.enemy.grid[r][centerC].state === 'ship') contacts++;
    }

    const cellEl = dom.enemyGrid.children[centerR * GRID_SIZE + centerC];
    const rect = cellEl.getBoundingClientRect();
    fx.triggerSonarPing(rect.left + rect.width / 2, rect.top + rect.height / 2);

    postCombatLog(`Air recon across Row ${centerR + 1} & Col ${COLS[centerC]}: ${contacts} contacts identified.`, 'sys');
    triggerToast(`Air Recon: ${contacts} active contacts localized`, 'success');
    updateHUD();
  }

  function executeAITurn() {
    if (state.phase !== 'playing') return;

    const target = pickAITarget();
    if (!target) return;
    const [r, c] = target;

    state.stats.enemyShots++;

    const cellEl = dom.playerGrid.children[r * GRID_SIZE + c];
    const rect = cellEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    fx.launchMissile(window.innerWidth * 0.5, 0, targetX, targetY, () => {
      const outcome = resolveShot(state.player, r, c);

      if (outcome.type === 'hit') {
        fx.createExplosion(targetX, targetY);
        playSound('hit');
        state.stats.enemyHits++;
        recordAIHit(r, c);
        postCombatLog(`Hostile strike landed on our fleet at [${COLS[c]}${r + 1}]!`, 'hit');
      } else if (outcome.type === 'sunk') {
        fx.createExplosion(targetX, targetY, true);
        playSound('sunk');
        state.stats.enemyHits++;
        resetAIShipMemory();
        postCombatLog(`CRITICAL DAMAGE: Friendly ${outcome.ship.name.toUpperCase()} has been lost!`, 'sunk');
      } else {
        fx.createSplash(targetX, targetY);
        playSound('splash');
        postCombatLog(`Hostile salvo missed defense sector at [${COLS[c]}${r + 1}].`, 'miss');
      }

      state.stats.turns++;
      refreshUI();

      if (checkEngagementEnd()) return;

      state.turn = 'player';
      dom.tickerMsg.textContent = 'Salvo resolved. Select hostile coordinate to engage.';
      dom.tickerTag.textContent = 'OFFENSIVE: READY';
    });
  }

  function checkEngagementEnd() {
    const playerAllSunk = state.player.ships.every(s => s.sunk);
    const enemyAllSunk = state.enemy.ships.every(s => s.sunk);

    if (enemyAllSunk) {
      concludeBattle(true);
      return true;
    }
    if (playerAllSunk) {
      concludeBattle(false);
      return true;
    }
    return false;
  }

  function concludeBattle(playerWon) {
    state.phase = 'over';
    refreshUI();

    setTimeout(() => {
      const dialog = dom.aarModal.querySelector('.aar-dialog');
      dialog.classList.toggle('defeat', !playerWon);

      $('aarTitle').textContent = playerWon ? 'FLEET TRIUMPH' : 'FLEET DESTROYED';
      $('aarBanner').textContent = playerWon ? 'MISSION COMPLETE // DEPLOYMENT SUCCESS' : 'COMBAT FAILURE // ALL ASSETS COMPROMISED';
      $('aarNarrative').textContent = playerWon
        ? 'Superb naval command. All enemy warships in the sector have been neutralized.'
        : 'Adversary forces have overwhelmed our battle line. Sector fallen.';

      const shots = state.stats.playerShots;
      const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
      $('aarAccuracy').textContent = `${acc}%`;
      $('aarShots').textContent = shots;
      $('aarTurns').textContent = state.stats.turns;
      $('aarShipsLost').textContent = `${state.player.ships.filter(s => s.sunk).length} / 5`;

      // Assign performance medals
      const strip = $('aarMedalStrip');
      strip.innerHTML = '';
      if (playerWon) {
        if (acc >= 40) strip.innerHTML += '<span class="medal-badge">★ Sharpshooter</span>';
        if (state.player.ships.filter(s => s.sunk).length === 0) strip.innerHTML += '<span class="medal-badge">★ Flawless Defense</span>';
        if (state.stats.turns <= 24) strip.innerHTML += '<span class="medal-badge">★ Blitzkrieg</span>';
      }

      dom.aarModal.setAttribute('aria-hidden', 'false');
    }, 700);
  }

  function resetGame() {
    state.phase = 'setup';
    state.turn = 'player';
    state.selectedShipId = FLEET_MANIFEST[0].id;
    state.activeAbility = null;
    state.energy = 0;
    state.stats = { playerShots: 0, playerHits: 0, enemyShots: 0, enemyHits: 0, turns: 1 };
    state.player = createFleet();
    state.enemy = createFleet();
    resetAIShipMemory();

    dom.aarModal.setAttribute('aria-hidden', 'true');
    dom.hangarBay.style.display = 'flex';
    dom.tacticalDeck.style.display = 'flex';

    dom.tickerMsg.textContent = 'Position your fleet or select Auto Dock to deploy.';
    dom.tickerTag.textContent = 'SEC_LEVEL: ALPHA';

    autoDeployFleet(state.enemy);
    refreshUI();
  }

  // ==========================================================================
  // EVENT LISTENERS & WIRING
  // ==========================================================================
  function wireEvents() {
    // 1. Grid cell mouse enter (coordinate highlights)
    dom.enemyGrid.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      dom.enemyCoordsX.children[c]?.classList.add('active');
      dom.enemyCoordsY.children[r]?.classList.add('active');
    });

    dom.enemyGrid.addEventListener('mouseout', () => {
      dom.enemyCoordsX.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
      dom.enemyCoordsY.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
    });

    dom.enemyGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      handleOffensiveStrike(+cell.dataset.r, +cell.dataset.c);
    });

    // 2. Player grid interactions (placement)
    dom.playerGrid.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell || state.phase !== 'setup') return;
      showPlacementPreview(+cell.dataset.r, +cell.dataset.c);
    });

    dom.playerGrid.addEventListener('mouseleave', clearPlacementPreview);

    dom.playerGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      handlePlacementClick(+cell.dataset.r, +cell.dataset.c);
    });

    // 3. Controls
    dom.rotateShipBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.orientationLabel.textContent = `ROTATE (${state.orientation.toUpperCase()})`;
      playSound('click');
      clearPlacementPreview();
    });

    dom.autoDeployBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      autoDeployFleet(state.player);
      state.selectedShipId = null;
      playSound('click');
      triggerToast('Fleet deployed automatically!', 'success');
      refreshUI();
    });

    dom.resetFleetBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      state.player.ships.forEach(s => removeShip(state.player, s.id));
      state.selectedShipId = FLEET_MANIFEST[0].id;
      playSound('click');
      refreshUI();
    });

    dom.commenceBattleBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      state.phase = 'playing';
      state.turn = 'player';
      dom.hangarBay.style.display = 'none';
      dom.tickerMsg.textContent = 'Engagement initiated! Tap enemy waters to launch salvo.';
      dom.tickerTag.textContent = 'SEC_LEVEL: RED';
      playSound('missile_launch');
      triggerToast('Fleet Engaged! Weapons Free.', 'success');
      refreshUI();
    });

    // 4. Tactical Abilities
    dom.sonarBtn.addEventListener('click', () => {
      if (state.energy < 35 || state.turn !== 'player') return;
      state.activeAbility = state.activeAbility === 'sonar' ? null : 'sonar';
      dom.sonarBtn.classList.toggle('active-ability', state.activeAbility === 'sonar');
      dom.airReconBtn.classList.remove('active-ability');
      triggerToast(state.activeAbility ? 'Target 3x3 sector for Sonar Survey' : 'Sonar Ping Cancelled');
    });

    dom.airReconBtn.addEventListener('click', () => {
      if (state.energy < 60 || state.turn !== 'player') return;
      state.activeAbility = state.activeAbility === 'airRecon' ? null : 'airRecon';
      dom.airReconBtn.classList.toggle('active-ability', state.activeAbility === 'airRecon');
      dom.sonarBtn.classList.remove('active-ability');
      triggerToast(state.activeAbility ? 'Select grid intercept for Air Recon' : 'Air Recon Cancelled');
    });

    // 5. Sound & Difficulty
    dom.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      dom.soundIconOn.classList.toggle('hidden', !state.soundEnabled);
      dom.soundIconOff.classList.toggle('hidden', state.soundEnabled);
    });

    dom.aiDifficultySelect.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
      triggerToast(`Adversary Tactical Level: ${e.target.selectedOptions[0].text}`);
    });

    // 6. Modal Controls & Shortcuts
    dom.helpModalBtn.addEventListener('click', () => {
      dom.rulesModal.setAttribute('aria-hidden', 'false');
    });

    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => {
        dom.rulesModal.setAttribute('aria-hidden', 'true');
        dom.aarModal.setAttribute('aria-hidden', 'true');
      });
    });

    dom.aarPlayAgainBtn.addEventListener('click', resetGame);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R' || e.code === 'Space') {
        if (state.phase === 'setup') {
          e.preventDefault();
          dom.rotateShipBtn.click();
        }
      } else if (e.key === 'Escape') {
        dom.rulesModal.setAttribute('aria-hidden', 'true');
        dom.aarModal.setAttribute('aria-hidden', 'true');
      }
    });

    // Unlock Audio Context on initial interaction
    const unlockAudio = () => {
      initAudioContext();
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    buildCoordinateHeaders();
    buildGridDOM(dom.enemyGrid, true);
    buildGridDOM(dom.playerGrid, false);
    fx.init();

    // Auto deploy adversary fleet in secret
    autoDeployFleet(state.enemy);

    state.selectedShipId = FLEET_MANIFEST[0].id;
    wireEvents();
    refreshUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();