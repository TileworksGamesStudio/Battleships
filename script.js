(() => {
  'use strict';

  // ---------- Fleet Specs & Ranking Manifest ----------
  const GRID_SIZE = 10;
  const COLS = ['A','B','C','D','E','F','G','H','I','J'];

  const FLEET_MANIFEST = [
    { id: 'carrier',   name: 'Carrier',    size: 5, symbol: 'CVN-78' },
    { id: 'battleship',name: 'Battleship', size: 4, symbol: 'BB-63'  },
    { id: 'cruiser',   name: 'Cruiser',    size: 3, symbol: 'CG-72'  },
    { id: 'submarine', name: 'Submarine',  size: 3, symbol: 'SSN-774'},
    { id: 'destroyer', name: 'Destroyer',  size: 2, symbol: 'DDG-51' },
  ];

  const RANKS = [
    { name: 'Ensign',        reqExp: 0    },
    { name: 'Lieutenant',    reqExp: 300  },
    { name: 'Commander',     reqExp: 800  },
    { name: 'Captain',       reqExp: 1600 },
    { name: 'Rear Admiral',  reqExp: 2800 },
    { name: 'Fleet Admiral', reqExp: 4500 },
  ];

  // ---------- Game State Tree ----------
  const state = {
    phase: 'setup',            // 'setup' | 'playing' | 'over'
    turn: 'player',            // 'player' | 'enemy' | 'busy'
    orientation: 'h',          // 'h' | 'v'
    selectedShipId: null,
    activeAbility: null,       // null | 'sonar' | 'carpet' | 'airRecon' | 'smoke'
    energy: 0,
    maxEnergy: 100,
    streak: 0,
    lockedTarget: null,        // [r, c] for mobile precision strike
    smokeSectors: [],          // [{r, c, turnsLeft}]
    difficulty: 'captain',
    soundEnabled: localStorage.getItem('aegis_sound') !== 'false',
    hapticsEnabled: localStorage.getItem('aegis_haptics') !== 'false',
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
    }
  };

  // Persistent Career Record
  let career = {
    exp: 0,
    battles: 0,
    wins: 0,
    sunkShips: 0,
    medals: []
  };

  function loadCareer() {
    try {
      const saved = localStorage.getItem('aegis_career');
      if (saved) career = { ...career, ...JSON.parse(saved) };
    } catch (_) {}
  }

  function saveCareer() {
    try {
      localStorage.setItem('aegis_career', JSON.stringify(career));
    } catch (_) {}
  }

  function getPlayerRank() {
    let rank = RANKS[0];
    for (const r of RANKS) {
      if (career.exp >= r.reqExp) rank = r;
    }
    return rank;
  }

  function createFleet() {
    return {
      grid: Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({
          ship: null,
          state: 'empty', // 'empty' | 'ship' | 'miss' | 'hit' | 'sunk'
          smoke: false
        }))
      ),
      ships: FLEET_MANIFEST.map(s => ({
        ...s,
        placed: false,
        cells: [],
        hits: 0,
        sunk: false,
        orientation: 'h'
      }))
    };
  }

  // ---------- DOM References ----------
  const $ = (id) => document.getElementById(id);
  const dom = {
    appShell: $('appShell'),
    enemyGrid: $('enemyGrid'),
    playerGrid: $('playerGrid'),
    enemyCoordsX: $('enemyCoordsX'),
    enemyCoordsY: $('enemyCoordsY'),
    playerCoordsX: $('playerCoordsX'),
    playerCoordsY: $('playerCoordsY'),
    tabOffensive: $('tabOffensive'),
    tabDefensive: $('tabDefensive'),
    offensiveTheater: $('offensiveTheater'),
    defensiveTheater: $('defensiveTheater'),
    enemyFleetCount: $('enemyFleetCount'),
    playerFleetCount: $('playerFleetCount'),
    lockedCoordText: $('lockedCoordText'),
    commitStrikeBtn: $('commitStrikeBtn'),
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
    hapticToggleBtn: $('hapticToggleBtn'),
    hapticIconOn: $('hapticIconOn'),
    careerModalBtn: $('careerModalBtn'),
    helpModalBtn: $('helpModalBtn'),
    rulesModal: $('rulesModal'),
    careerModal: $('careerModal'),
    aarModal: $('aarModal'),
    aarPlayAgainBtn: $('aarPlayAgainBtn'),
    tickerMsg: $('tickerMsg'),
    tickerTag: $('tickerTag'),
    hudAccuracy: $('hudAccuracy'),
    hudTurns: $('hudTurns'),
    hudStreak: $('hudStreak'),
    playerRankLabel: $('playerRankLabel'),
    energyVal: $('energyVal'),
    energyFill: $('energyFill'),
    sonarBtn: $('sonarBtn'),
    carpetBtn: $('carpetBtn'),
    airReconBtn: $('airReconBtn'),
    smokeBtn: $('smokeBtn'),
    alertToast: $('alertToast'),
    combatLogFeed: $('combatLogFeed'),
    fxCanvas: $('fxCanvas'),
    playerFleetPills: $('playerFleetPills'),
    enemyFleetPills: $('enemyFleetPills'),
    hangarBay: $('hangarBay'),
  };

  // ==========================================================================
  // PROCEDURAL WEB AUDIO & HAPTICS (Zero Dependencies)
  // ==========================================================================
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function triggerHaptic(pattern) {
    if (!state.hapticsEnabled || !navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  }

  function playSound(type) {
    if (!state.soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtx;
      const t = ctx.currentTime;

      if (type === 'tap') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.setValueAtTime(650, t);
        osc.frequency.exponentialRampToValueAtTime(300, t + 0.04);
        g.gain.setValueAtTime(0.06, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.04);
        osc.start(t); osc.stop(t + 0.04);
      }
      else if (type === 'lock') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.setValueAtTime(1200, t + 0.04);
        g.gain.setValueAtTime(0.08, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.08);
        osc.start(t); osc.stop(t + 0.08);
      }
      else if (type === 'sonar') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(980, t);
        osc.frequency.linearRampToValueAtTime(950, t + 0.9);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.start(t); osc.stop(t + 1.2);
      }
      else if (type === 'missile') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(850, t + 0.38);
        g.gain.setValueAtTime(0.18, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.42);
        osc.start(t); osc.stop(t + 0.42);
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
        f.frequency.setValueAtTime(380, t);
        f.Q.setValueAtTime(3.0, t);
        const g = ctx.createGain();
        src.connect(f); f.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        src.start(t);
      }
      else if (type === 'hit') {
        const osc = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc.connect(g1); g1.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
        g1.gain.setValueAtTime(0.3, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);

        const bSize = ctx.sampleRate * 0.45;
        const b = ctx.createBuffer(1, bSize, ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1) * 0.8;
        const src = ctx.createBufferSource();
        src.buffer = b;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(260, t);
        const g2 = ctx.createGain();
        src.connect(f); f.connect(g2); g2.connect(ctx.destination);
        g2.gain.setValueAtTime(0.35, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        src.start(t);
      }
      else if (type === 'sunk') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(30, t + 1.2);
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
        osc.start(t); osc.stop(t + 1.3);
      }
      else if (type === 'klaxon') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, t);
        osc.frequency.setValueAtTime(330, t + 0.15);
        g.gain.setValueAtTime(0.15, t);
        g.gain.linearRampToValueAtTime(0.001, t + 0.35);
        osc.start(t); osc.stop(t + 0.35);
      }
    } catch (_) {}
  }

  // ==========================================================================
  // DYNAMIC FX CANVAS ENGINE
  // ==========================================================================
  const fx = {
    canvas: dom.fxCanvas,
    ctx: dom.fxCanvas.getContext('2d'),
    particles: [],
    missiles: [],
    rings: [],

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

    shakeScreen() {
      document.body.classList.remove('screen-shake');
      void document.body.offsetWidth;
      document.body.classList.add('screen-shake');
      setTimeout(() => document.body.classList.remove('screen-shake'), 400);
    },

    createExplosion(x, y, isBig = false) {
      this.shakeScreen();
      const count = isBig ? 70 : 40;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isBig ? 7 : 4.5) + 1;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.random() * 3 + 2,
          life: 1,
          decay: Math.random() * 0.025 + 0.02,
          color: Math.random() > 0.4 ? '#ff2a55' : '#ffb703'
        });
      }
    },

    createSplash(x, y) {
      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          radius: Math.random() * 2.5 + 1.5,
          life: 1,
          decay: Math.random() * 0.035 + 0.02,
          color: '#00f0ff'
        });
      }
      this.rings.push({ x, y, radius: 4, maxRadius: 35, life: 1, color: 'rgba(0, 240, 255, ' });
    },

    launchMissile(startX, startY, targetX, targetY, onImpact) {
      this.missiles.push({
        startX, startY, targetX, targetY,
        progress: 0,
        speed: 0.042,
        onImpact
      });
      playSound('missile');
    },

    triggerSonarPing(x, y) {
      this.rings.push({ x, y, radius: 10, maxRadius: 180, life: 1, color: 'rgba(0, 240, 255, ' });
      playSound('sonar');
      triggerHaptic(50);
    },

    loop() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // 1. Shockwaves & Sonar Rings
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.radius += 3.5;
        r.life -= 0.025;

        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `${r.color}${Math.max(0, r.life * 0.8)})`;
        this.ctx.lineWidth = 2.5;
        this.ctx.stroke();

        if (r.life <= 0) this.rings.splice(i, 1);
      }

      // 2. Ballistic Projectiles
      for (let i = this.missiles.length - 1; i >= 0; i--) {
        const m = this.missiles[i];
        m.progress += m.speed;

        const curX = m.startX + (m.targetX - m.startX) * m.progress;
        const curY = m.startY + (m.targetY - m.startY) * m.progress - Math.sin(m.progress * Math.PI) * 110;

        // Exhaust smoke particle trail
        this.particles.push({
          x: curX, y: curY,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 1.5,
          radius: Math.random() * 2 + 1,
          life: 0.5,
          decay: 0.05,
          color: '#ffb703'
        });

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(curX, curY, 3.5, 0, Math.PI * 2);
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
  // SHIP SILHOUETTE BUILDER
  // ==========================================================================
  function generateShipSVG(shipId, size, isVertical = false) {
    const width = isVertical ? 32 : size * 38;
    const height = isVertical ? size * 38 : 32;

    let details = '';
    if (shipId === 'carrier') {
      details = `
        <polygon points="10,4 ${width - 10},4 ${width - 3},16 ${width - 10},28 10,28 3,16" fill="#183654" stroke="#00f0ff" stroke-width="1.5" />
        <line x1="14" y1="16" x2="${width - 14}" y2="16" stroke="#ffffff" stroke-dasharray="6 4" stroke-width="1.5" />
        <rect x="${width - 38}" y="6" width="14" height="5" fill="#00f0ff" rx="1" />
      `;
    } else if (shipId === 'battleship') {
      details = `
        <polygon points="8,5 ${width - 8},5 ${width - 2},16 ${width - 8},27 8,27 2,16" fill="#142c47" stroke="#00f0ff" stroke-width="1.5" />
        <circle cx="26" cy="16" r="4.5" fill="#254b73" stroke="#00f0ff" stroke-width="1.5" />
        <circle cx="${width - 28}" cy="16" r="4.5" fill="#254b73" stroke="#00f0ff" stroke-width="1.5" />
      `;
    } else if (shipId === 'submarine') {
      details = `
        <rect x="4" y="7" width="${width - 8}" height="18" rx="9" fill="#0c1e33" stroke="#00f0ff" stroke-width="1.5" />
        <ellipse cx="${width * 0.45}" cy="16" rx="8" ry="4" fill="#00f0ff" opacity="0.85" />
      `;
    } else if (shipId === 'cruiser') {
      details = `
        <polygon points="6,6 ${width - 6},6 ${width - 2},16 ${width - 6},26 6,26 2,16" fill="#16314f" stroke="#00f0ff" stroke-width="1.5" />
        <rect x="22" y="10" width="10" height="12" fill="#294e77" rx="2" />
      `;
    } else { // Destroyer
      details = `
        <polygon points="5,8 ${width - 5},8 ${width - 1},16 ${width - 5},24 5,24 1,16" fill="#132a45" stroke="#00f0ff" stroke-width="1.5" />
        <circle cx="18" cy="16" r="3" fill="#00f0ff" />
      `;
    }

    if (isVertical) {
      return `
        <svg class="ship-hull-svg" viewBox="0 0 ${width} ${height}">
          <g transform="rotate(90, ${width / 2}, ${height / 2}) translate(${(width - height) / 2}, ${(height - width) / 2})">
            ${details}
          </g>
        </svg>
      `;
    }
    return `<svg class="ship-hull-svg" viewBox="0 0 ${width} ${height}">${details}</svg>`;
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
      const occ = fleet.grid[rr][cc].ship;
      if (occ !== null && occ !== excludeShipId) return false;
    }
    return true;
  }

  function placeShip(fleet, shipId, r, c, orientation) {
    const ship = fleet.ships.find(s => s.id === shipId);
    if (!ship) return;
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
      let placed = false, attempts = 0;
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
  // AI STRATEGY ENGINE
  // ==========================================================================
  function calculateProbabilityMatrix() {
    const density = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const targetBoard = state.player.grid;
    const remainingShips = state.player.ships.filter(s => !s.sunk);

    for (const ship of remainingShips) {
      for (const ori of ['h', 'v']) {
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            const cells = getShipCells(r, c, ship.size, ori);
            let valid = true;
            let hits = 0;

            for (const [rr, cc] of cells) {
              if (!inBounds(rr, cc)) { valid = false; break; }
              const cell = targetBoard[rr][cc];
              if (cell.state === 'miss' || cell.state === 'sunk') {
                valid = false;
                break;
              }
              if (cell.smoke) valid = false; // Blocked by smoke screen
              if (cell.state === 'hit') hits++;
            }

            if (valid) {
              const weight = 1 + (hits * 75);
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
    const untouched = (r, c) => !board[r][c].smoke && (board[r][c].state === 'empty' || board[r][c].state === 'ship');

    // 1. ADMIRAL
    if (diff === 'admiral') {
      const density = calculateProbabilityMatrix();
      let maxScore = -1, best = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (untouched(r, c)) {
            if (density[r][c] > maxScore) {
              maxScore = density[r][c];
              best = [[r, c]];
            } else if (density[r][c] === maxScore) {
              best.push([r, c]);
            }
          }
        }
      }
      if (best.length > 0) return best[Math.floor(Math.random() * best.length)];
    }

    // 2. CAPTAIN
    if (diff === 'captain') {
      const mem = state.aiMemory;
      mem.huntQueue = mem.huntQueue.filter(([r, c]) => untouched(r, c));
      if (mem.huntQueue.length > 0) return mem.huntQueue.shift();

      const parityCells = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (untouched(r, c) && (r + c) % 2 === 0) parityCells.push([r, c]);
        }
      }
      if (parityCells.length > 0) return parityCells[Math.floor(Math.random() * parityCells.length)];
    }

    // 3. ENSIGN
    const pool = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (untouched(r, c)) pool.push([r, c]);
      }
    }
    return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  function recordAIHit(r, c) {
    state.aiMemory.targetHits.push([r, c]);
    const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
    for (const [nr, nc] of neighbors) {
      if (inBounds(nr, nc)) {
        const cell = state.player.grid[nr][nc];
        if (cell.state === 'empty' || cell.state === 'ship') {
          if (!state.aiMemory.huntQueue.some(([qr, qc]) => qr === nr && qc === nc)) {
            state.aiMemory.huntQueue.push([nr, nc]);
          }
        }
      }
    }
  }

  // ==========================================================================
  // RENDERING & INTERFACE
  // ==========================================================================
  function buildCoordinateHeaders() {
    dom.enemyCoordsX.innerHTML = '';
    dom.playerCoordsX.innerHTML = '';
    COLS.forEach(col => {
      const c1 = document.createElement('span'); c1.className = 'coord-label-x'; c1.textContent = col;
      const c2 = document.createElement('span'); c2.className = 'coord-label-x'; c2.textContent = col;
      dom.enemyCoordsX.appendChild(c1);
      dom.playerCoordsX.appendChild(c2);
    });

    dom.enemyCoordsY.innerHTML = '';
    dom.playerCoordsY.innerHTML = '';
    for (let i = 1; i <= GRID_SIZE; i++) {
      const r1 = document.createElement('span'); r1.className = 'coord-label-y'; r1.textContent = i;
      const r2 = document.createElement('span'); r2.className = 'coord-label-y'; r2.textContent = i;
      dom.enemyCoordsY.appendChild(r1);
      dom.playerCoordsY.appendChild(r2);
    }
  }

  function buildGridDOM(gridEl) {
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
    containerEl.querySelectorAll('.ship-hull-layer').forEach(e => e.remove());

    fleet.ships.forEach(ship => {
      if (!ship.placed) return;
      if (isEnemy && !ship.sunk && state.phase !== 'over') return;

      const [r0, c0] = ship.cells[0];
      const isVert = ship.orientation === 'v';

      const hullLayer = document.createElement('div');
      hullLayer.className = 'ship-hull-layer' + (ship.sunk ? ' sunk-ship' : '');
      hullLayer.style.top = `calc(${r0} * var(--cell-size) + 3px)`;
      hullLayer.style.left = `calc(${c0} * var(--cell-size) + 3px)`;
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

        cell.classList.remove('state-miss', 'state-hit', 'state-sunk', 'state-smoke', 'target-locked');
        if (cellData.state === 'miss') cell.classList.add('state-miss');
        else if (cellData.state === 'hit') cell.classList.add('state-hit');
        else if (cellData.state === 'sunk') cell.classList.add('state-sunk');
        if (cellData.smoke) cell.classList.add('state-smoke');

        if (state.lockedTarget && state.lockedTarget[0] === r && state.lockedTarget[1] === c && gridEl === dom.enemyGrid) {
          cell.classList.add('target-locked');
        }
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
        playSound('tap');
        triggerHaptic(20);
        if (ship.placed) removeShip(state.player, ship.id);
        state.selectedShipId = ship.id;
        refreshUI();
      });

      dom.shipDockTray.appendChild(card);
    });
  }

  function updateHUD() {
    // 1. Health Status indicators
    let pCount = 0, eCount = 0;
    state.player.ships.forEach(ship => {
      if (!ship.sunk) pCount++;
      const pill = dom.playerFleetPills.querySelector(`[data-ship="${ship.id}"]`);
      if (pill) pill.classList.toggle('sunk', ship.sunk);
    });

    state.enemy.ships.forEach(ship => {
      if (!ship.sunk) eCount++;
      const pill = dom.enemyFleetPills.querySelector(`[data-ship="${ship.id}"]`);
      if (pill) pill.classList.toggle('sunk', ship.sunk);
    });

    dom.playerFleetCount.textContent = `${pCount}/5`;
    dom.enemyFleetCount.textContent = `${eCount}/5`;

    // 2. Telemetry
    const shots = state.stats.playerShots;
    const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
    dom.hudAccuracy.textContent = `${acc}%`;
    dom.hudTurns.textContent = String(state.stats.turns).padStart(2, '0');
    dom.hudStreak.textContent = `${state.streak}x`;

    const r = getPlayerRank();
    dom.playerRankLabel.textContent = `${r.name.toUpperCase()} // LVL ${RANKS.indexOf(r) + 1}`;

    // 3. Command Energy & Abilities
    dom.energyVal.textContent = `${state.energy} / ${state.maxEnergy}`;
    dom.energyFill.style.width = `${(state.energy / state.maxEnergy) * 100}%`;

    const isPlayerTurn = state.phase === 'playing' && state.turn === 'player';
    dom.sonarBtn.disabled = state.energy < 30 || !isPlayerTurn;
    dom.carpetBtn.disabled = state.energy < 50 || !isPlayerTurn;
    dom.smokeBtn.disabled = state.energy < 40 || !isPlayerTurn;
    dom.airReconBtn.disabled = state.energy < 70 || !isPlayerTurn;

    // Precision locked coordinate
    if (state.lockedTarget) {
      dom.lockedCoordText.textContent = `${COLS[state.lockedTarget[1]]}${state.lockedTarget[0] + 1}`;
      dom.commitStrikeBtn.disabled = !isPlayerTurn;
    } else {
      dom.lockedCoordText.textContent = '--';
      dom.commitStrikeBtn.disabled = true;
    }
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
    dom.alertToast.timer = setTimeout(() => dom.alertToast.classList.remove('show'), 2400);
  }

  function refreshUI() {
    syncGridStates(dom.playerGrid, state.player);
    syncGridStates(dom.enemyGrid, state.enemy);
    renderGridHulls(dom.playerGrid, state.player, false);
    renderGridHulls(dom.enemyGrid, state.enemy, true);
    renderHangarDock();
    updateHUD();

    const allPlaced = state.player.ships.every(s => s.placed);
    dom.commenceBattleBtn.disabled = !allPlaced || state.phase !== 'setup';
  }

  // ==========================================================================
  // TOUCH GESTURES & PLACEMENT LOGIC
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

    if (!state.selectedShipId) {
      const next = state.player.ships.find(s => !s.placed);
      if (next) state.selectedShipId = next.id;
      else return;
    }

    const ship = state.player.ships.find(s => s.id === state.selectedShipId);
    if (!ship) return;

    if (!canPlaceShip(state.player, r, c, ship.size, state.orientation, ship.id)) {
      triggerToast('Coordinates blocked or out of bounds!', 'warn');
      triggerHaptic([40, 60, 40]);
      return;
    }

    placeShip(state.player, ship.id, r, c, state.orientation);
    playSound('tap');
    triggerHaptic(30);

    const remaining = state.player.ships.find(s => !s.placed);
    state.selectedShipId = remaining ? remaining.id : null;

    clearPlacementPreview();
    refreshUI();
  }

  // ==========================================================================
  // COMBAT ENGINE & TACTICAL ABILITIES
  // ==========================================================================
  function resolveShot(fleet, r, c) {
    const cell = fleet.grid[r][c];
    if (cell.ship !== null) {
      cell.state = 'hit';
      const ship = fleet.ships.find(s => s.id === cell.ship);
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
      cell.state = 'miss';
      return { type: 'miss', ship: null };
    }
  }

  function handleEnemyCellTouch(r, c) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;

    // Ability Targeting Mode
    if (state.activeAbility) {
      if (state.activeAbility === 'sonar') executeSonar(r, c);
      else if (state.activeAbility === 'carpet') executeClusterStrike(r, c);
      else if (state.activeAbility === 'airRecon') executeAirRecon(r, c);
      return;
    }

    // Check if cell already struck
    const targetCell = state.enemy.grid[r][c];
    if (targetCell.state !== 'empty' && targetCell.state !== 'ship') {
      triggerToast('Sector coordinate already struck.', 'warn');
      return;
    }

    // Mobile Precision Lock: If tapping locked cell -> Fire immediately; else select it
    if (state.lockedTarget && state.lockedTarget[0] === r && state.lockedTarget[1] === c) {
      fireSalvoAtLockedSector();
    } else {
      state.lockedTarget = [r, c];
      playSound('lock');
      triggerHaptic(25);
      refreshUI();
    }
  }

  function fireSalvoAtLockedSector() {
    if (!state.lockedTarget || state.phase !== 'playing' || state.turn !== 'player') return;
    const [r, c] = state.lockedTarget;
    state.lockedTarget = null;
    state.turn = 'busy';
    state.stats.playerShots++;

    const cellEl = dom.enemyGrid.children[r * GRID_SIZE + c];
    const rect = cellEl.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    fx.launchMissile(window.innerWidth * 0.5, window.innerHeight - 80, targetX, targetY, () => {
      const outcome = resolveShot(state.enemy, r, c);

      if (outcome.type === 'hit') {
        fx.createExplosion(targetX, targetY);
        playSound('hit');
        triggerHaptic([60, 40, 80]);
        state.stats.playerHits++;
        state.streak++;
        const streakBonus = Math.min(25, state.streak * 5);
        state.energy = Math.min(state.maxEnergy, state.energy + 20 + streakBonus);
        career.exp += 25;
        postCombatLog(`Direct strike on hostile hull at [${COLS[c]}${r + 1}]!`, 'hit');
        triggerToast(`Direct Hit! Streak ${state.streak}x`, 'success');
      } else if (outcome.type === 'sunk') {
        fx.createExplosion(targetX, targetY, true);
        playSound('sunk');
        triggerHaptic([100, 50, 150, 50, 200]);
        state.stats.playerHits++;
        state.streak++;
        career.sunkShips++;
        career.exp += 80;
        state.energy = Math.min(state.maxEnergy, state.energy + 40);
        postCombatLog(`Hostile ${outcome.ship.name.toUpperCase()} sunk!`, 'sunk');
        triggerToast(`Hostile ${outcome.ship.name} Neutralized!`, 'success');
      } else {
        fx.createSplash(targetX, targetY);
        playSound('splash');
        triggerHaptic(30);
        state.streak = 0;
        state.energy = Math.min(state.maxEnergy, state.energy + 8);
        career.exp += 5;
        postCombatLog(`Salvo splash at [${COLS[c]}${r + 1}]. No contact.`, 'miss');
      }

      saveCareer();
      refreshUI();

      if (checkGameEnd()) return;

      // Enemy Turn
      state.turn = 'enemy';
      dom.tickerMsg.textContent = 'Hostile battery plotting counter-salvo...';
      dom.tickerTag.textContent = 'DEFENSE STATUS: ALERT';

      setTimeout(() => {
        // Automatically pivot to defense harbor on mobile so player sees incoming strike
        if (window.innerWidth < 900) switchTheaterTab('defensive');
        setTimeout(executeAITurn, 800);
      }, 700);
    });
  }

  // Tactical Abilities Implementations
  function executeSonar(centerR, centerC) {
    if (state.energy < 30) return;
    state.energy -= 30;
    state.activeAbility = null;
    dom.sonarBtn.classList.remove('active-ability');

    const cellEl = dom.enemyGrid.children[centerR * GRID_SIZE + centerC];
    const rect = cellEl.getBoundingClientRect();
    fx.triggerSonarPing(rect.left + rect.width / 2, rect.top + rect.height / 2);

    let contacts = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = centerR + dr, cc = centerC + dc;
        if (inBounds(rr, cc)) {
          if (state.enemy.grid[rr][cc].ship !== null && state.enemy.grid[rr][cc].state !== 'sunk') {
            contacts++;
          }
        }
      }
    }

    postCombatLog(`Sonar Ping at [${COLS[centerC]}${centerR + 1}]: Localized ${contacts} hull sections.`, 'sys');
    triggerToast(`Sonar Survey: ${contacts} Contacts Detected`, 'success');
    updateHUD();
  }

  function executeClusterStrike(centerR, centerC) {
    if (state.energy < 50) return;
    state.energy -= 50;
    state.activeAbility = null;
    dom.carpetBtn.classList.remove('active-ability');
    state.turn = 'busy';

    const targets = [[centerR, centerC], [centerR, Math.max(0, centerC - 1)], [centerR, Math.min(GRID_SIZE - 1, centerC + 1)]];

    targets.forEach(([r, c], i) => {
      setTimeout(() => {
        const cellEl = dom.enemyGrid.children[r * GRID_SIZE + c];
        const rect = cellEl.getBoundingClientRect();
        fx.launchMissile(window.innerWidth * 0.5, window.innerHeight - 80, rect.left + rect.width / 2, rect.top + rect.height / 2, () => {
          const outcome = resolveShot(state.enemy, r, c);
          if (outcome.type === 'hit' || outcome.type === 'sunk') {
            fx.createExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
            playSound('hit');
            triggerHaptic(50);
          } else {
            fx.createSplash(rect.left + rect.width / 2, rect.top + rect.height / 2);
            playSound('splash');
          }
          if (i === targets.length - 1) {
            refreshUI();
            if (checkGameEnd()) return;
            state.turn = 'enemy';
            setTimeout(executeAITurn, 800);
          }
        });
      }, i * 200);
    });
  }

  function executeAirRecon(centerR, centerC) {
    if (state.energy < 70) return;
    state.energy -= 70;
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

    postCombatLog(`Recon sweeps Row ${centerR + 1} & Col ${COLS[centerC]}: ${contacts} contacts identified.`, 'sys');
    triggerToast(`Air Recon: ${contacts} active contacts localized`, 'success');
    updateHUD();
  }

  function executeSmokeScreen(centerR, centerC) {
    if (state.energy < 40) return;
    state.energy -= 40;
    state.activeAbility = null;
    dom.smokeBtn.classList.remove('active-ability');

    for (let dr = 0; dr <= 1; dr++) {
      for (let dc = 0; dc <= 1; dc++) {
        const rr = centerR + dr, cc = centerC + dc;
        if (inBounds(rr, cc)) {
          state.player.grid[rr][cc].smoke = true;
          state.smokeSectors.push({ r: rr, c: cc, turnsLeft: 3 });
        }
      }
    }

    postCombatLog(`Smoke Screen deployed over friendly sectors [${COLS[centerC]}${centerR + 1}].`, 'sys');
    triggerToast('Smoke Screen active! Sensor masked for 2 turns', 'success');
    triggerHaptic(40);
    refreshUI();
  }

  // Enemy Turn Resolution
  function executeAITurn() {
    if (state.phase !== 'playing') return;

    // Decay smoke screen
    state.smokeSectors.forEach(s => { s.turnsLeft--; });
    state.smokeSectors = state.smokeSectors.filter(s => {
      if (s.turnsLeft <= 0) {
        state.player.grid[s.r][s.c].smoke = false;
        return false;
      }
      return true;
    });

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
        playSound('klaxon');
        triggerHaptic([80, 50, 100]);
        state.stats.enemyHits++;
        recordAIHit(r, c);
        postCombatLog(`Hostile strike landed on friendly fleet at [${COLS[c]}${r + 1}]!`, 'hit');
      } else if (outcome.type === 'sunk') {
        fx.createExplosion(targetX, targetY, true);
        playSound('sunk');
        triggerHaptic([150, 60, 200, 60, 250]);
        state.stats.enemyHits++;
        state.aiMemory.huntQueue = [];
        postCombatLog(`CRITICAL CASUALTY: Our ${outcome.ship.name.toUpperCase()} has been sunk!`, 'sunk');
      } else {
        fx.createSplash(targetX, targetY);
        playSound('splash');
        postCombatLog(`Hostile salvo missed our coordinates at [${COLS[c]}${r + 1}].`, 'miss');
      }

      state.stats.turns++;
      refreshUI();

      if (checkGameEnd()) return;

      state.turn = 'player';
      dom.tickerMsg.textContent = 'Salvo resolved. Select hostile coordinate to engage.';
      dom.tickerTag.textContent = 'OFFENSIVE: READY';

      // Automatically flip back to offensive radar for rapid mobile striking
      setTimeout(() => {
        if (window.innerWidth < 900) switchTheaterTab('offensive');
      }, 500);
    });
  }

  function checkGameEnd() {
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
    career.battles++;
    if (playerWon) career.wins++;

    saveCareer();
    refreshUI();

    setTimeout(() => {
      const dialog = dom.aarModal.querySelector('.aar-dialog');
      dialog.classList.toggle('defeat', !playerWon);

      $('aarTitle').textContent = playerWon ? 'FLEET TRIUMPH' : 'FLEET DESTROYED';
      $('aarBanner').textContent = playerWon ? 'MISSION COMPLETE // ENEMY DESTROYED' : 'CASUALTY REPORT // COMBAT FAILURE';
      $('aarNarrative').textContent = playerWon
        ? 'Outstanding tactical execution. All hostile naval combatants have been neutralized.'
        : 'Enemy battle line has penetrated our defensive zone. All assets scuttled.';

      const shots = state.stats.playerShots;
      const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
      $('aarAccuracy').textContent = `${acc}%`;
      $('aarShots').textContent = shots;
      $('aarTurns').textContent = state.stats.turns;
      $('aarShipsLost').textContent = `${state.player.ships.filter(s => s.sunk).length}/5`;

      const strip = $('aarMedalStrip');
      strip.innerHTML = '';
      if (playerWon) {
        if (acc >= 45) strip.innerHTML += '<span class="medal-badge">★ Sharpshooter</span>';
        if (state.player.ships.filter(s => s.sunk).length === 0) strip.innerHTML += '<span class="medal-badge">★ Undefeated</span>';
        if (state.stats.turns <= 22) strip.innerHTML += '<span class="medal-badge">★ Blitz Salvo</span>';
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
    state.streak = 0;
    state.lockedTarget = null;
    state.smokeSectors = [];
    state.stats = { playerShots: 0, playerHits: 0, enemyShots: 0, enemyHits: 0, turns: 1 };
    state.player = createFleet();
    state.enemy = createFleet();
    state.aiMemory.huntQueue = [];
    state.aiMemory.targetHits = [];

    dom.aarModal.setAttribute('aria-hidden', 'true');
    dom.hangarBay.style.display = 'flex';

    dom.tickerMsg.textContent = 'Arrange ships or select Auto-Deploy to begin.';
    dom.tickerTag.textContent = 'SYSTEM READY';

    autoDeployFleet(state.enemy);
    switchTheaterTab('defensive');
    refreshUI();
  }

  // ==========================================================================
  // MOBILE VIEW SWITCHING & DOSSIER
  // ==========================================================================
  function switchTheaterTab(view) {
    if (view === 'offensive') {
      dom.tabOffensive.classList.add('active');
      dom.tabDefensive.classList.remove('active');
      dom.offensiveTheater.classList.add('active-view');
      dom.defensiveTheater.classList.remove('active-view');
    } else {
      dom.tabDefensive.classList.add('active');
      dom.tabOffensive.classList.remove('active');
      dom.defensiveTheater.classList.add('active-view');
      dom.offensiveTheater.classList.remove('active-view');
    }
  }

  function populateDossierModal() {
    const r = getPlayerRank();
    $('dossierRank').textContent = r.name.toUpperCase();
    $('dossierBattles').textContent = career.battles;
    $('dossierWins').textContent = career.wins;
    const rate = career.battles > 0 ? Math.round((career.wins / career.battles) * 100) : 0;
    $('dossierWinRate').textContent = `${rate}%`;
    $('dossierSunk').textContent = career.sunkShips;

    const nextRank = RANKS[RANKS.indexOf(r) + 1] || r;
    const progress = Math.min(100, Math.round((career.exp / nextRank.reqExp) * 100));
    $('dossierExpFill').style.width = `${progress}%`;
    $('dossierExpText').textContent = `EXP: ${career.exp} / ${nextRank.reqExp}`;

    const medalsList = $('dossierMedalsList');
    medalsList.innerHTML = `
      <span class="medal-badge">★ Sea Scout (${career.battles} Sorties)</span>
      <span class="medal-badge">⚓ Dreadnought (${career.sunkShips} Sunk)</span>
      <span class="medal-badge">🏆 Fleet Commander (${career.wins} Victories)</span>
    `;
  }

  // ==========================================================================
  // EVENT WIRING & GESTURES
  // ==========================================================================
  function wireEvents() {
    // 1. Mobile Segmented Tabs
    dom.tabOffensive.addEventListener('click', () => { playSound('tap'); switchTheaterTab('offensive'); });
    dom.tabDefensive.addEventListener('click', () => { playSound('tap'); switchTheaterTab('defensive'); });

    // 2. Grid Interactivity
    dom.enemyGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      handleEnemyCellTouch(+cell.dataset.r, +cell.dataset.c);
    });

    dom.playerGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell) return;
      const r = +cell.dataset.r, c = +cell.dataset.c;
      if (state.phase === 'setup') {
        handlePlacementClick(r, c);
      } else if (state.activeAbility === 'smoke') {
        executeSmokeScreen(r, c);
      }
    });

    dom.playerGrid.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.grid-cell');
      if (!cell || state.phase !== 'setup') return;
      showPlacementPreview(+cell.dataset.r, +cell.dataset.c);
    });

    dom.playerGrid.addEventListener('mouseleave', clearPlacementPreview);

    // 3. Fire Salvo Commit Button
    dom.commitStrikeBtn.addEventListener('click', fireSalvoAtLockedSector);

    // 4. Staging Toolbar
    dom.rotateShipBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.orientationLabel.textContent = `ROT (${state.orientation.toUpperCase()})`;
      playSound('tap');
      triggerHaptic(20);
      clearPlacementPreview();
    });

    dom.autoDeployBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      autoDeployFleet(state.player);
      state.selectedShipId = null;
      playSound('tap');
      triggerHaptic(35);
      triggerToast('Fleet Deployed Automatically!', 'success');
      refreshUI();
    });

    dom.resetFleetBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      state.player.ships.forEach(s => removeShip(state.player, s.id));
      state.selectedShipId = FLEET_MANIFEST[0].id;
      playSound('tap');
      triggerHaptic(30);
      refreshUI();
    });

    dom.commenceBattleBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      state.phase = 'playing';
      state.turn = 'player';
      dom.hangarBay.style.display = 'none';
      switchTheaterTab('offensive');
      dom.tickerMsg.textContent = 'Engagement active! Select enemy sector to fire.';
      dom.tickerTag.textContent = 'WEAPONS FREE';
      playSound('missile');
      triggerHaptic([50, 40, 70]);
      triggerToast('Fleet Engaged! Weapons Free.', 'success');
      refreshUI();
    });

    // 5. Tactical Ability Buttons
    function toggleAbility(name, btn, promptMsg) {
      if (state.activeAbility === name) {
        state.activeAbility = null;
        btn.classList.remove('active-ability');
        triggerToast('Ability Standby Cancelled');
      } else {
        [dom.sonarBtn, dom.carpetBtn, dom.airReconBtn, dom.smokeBtn].forEach(b => b.classList.remove('active-ability'));
        state.activeAbility = name;
        btn.classList.add('active-ability');
        triggerToast(promptMsg);
        triggerHaptic(30);
      }
    }

    dom.sonarBtn.addEventListener('click', () => toggleAbility('sonar', dom.sonarBtn, 'Target 3x3 zone for Sonar'));
    dom.carpetBtn.addEventListener('click', () => toggleAbility('carpet', dom.carpetBtn, 'Select 3-cell cluster zone to barrage'));
    dom.airReconBtn.addEventListener('click', () => toggleAbility('airRecon', dom.airReconBtn, 'Select row and column intersection'));
    dom.smokeBtn.addEventListener('click', () => {
      if (window.innerWidth < 900) switchTheaterTab('defensive');
      toggleAbility('smoke', dom.smokeBtn, 'Select 2x2 friendly sector for Smoke Screen');
    });

    // 6. Sound & Haptics Toggles
    dom.soundToggleBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('aegis_sound', state.soundEnabled);
      dom.soundIconOn.classList.toggle('hidden', !state.soundEnabled);
      dom.soundIconOff.classList.toggle('hidden', state.soundEnabled);
      triggerHaptic(20);
    });

    dom.hapticToggleBtn.addEventListener('click', () => {
      state.hapticsEnabled = !state.hapticsEnabled;
      localStorage.setItem('aegis_haptics', state.hapticsEnabled);
      dom.hapticIconOn.style.opacity = state.hapticsEnabled ? '1' : '0.35';
      triggerHaptic(50);
      triggerToast(state.hapticsEnabled ? 'Haptics Enabled' : 'Haptics Disabled');
    });

    // 7. Modals
    dom.careerModalBtn.addEventListener('click', () => {
      populateDossierModal();
      dom.careerModal.setAttribute('aria-hidden', 'false');
    });

    $('rankInsigniaBox').addEventListener('click', () => {
      populateDossierModal();
      dom.careerModal.setAttribute('aria-hidden', 'false');
    });

    dom.helpModalBtn.addEventListener('click', () => {
      dom.rulesModal.setAttribute('aria-hidden', 'false');
    });

    document.querySelectorAll('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => {
        dom.rulesModal.setAttribute('aria-hidden', 'true');
        dom.careerModal.setAttribute('aria-hidden', 'true');
        dom.aarModal.setAttribute('aria-hidden', 'true');
      });
    });

    dom.aarPlayAgainBtn.addEventListener('click', resetGame);

    dom.aiDifficultySelect.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
      triggerToast(`Adversary AI: ${e.target.selectedOptions[0].text}`);
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R' || e.code === 'Space') {
        if (state.phase === 'setup') {
          e.preventDefault();
          dom.rotateShipBtn.click();
        }
      } else if (e.key === 'Escape') {
        dom.rulesModal.setAttribute('aria-hidden', 'true');
        dom.careerModal.setAttribute('aria-hidden', 'true');
        dom.aarModal.setAttribute('aria-hidden', 'true');
      }
    });

    // Audio Context Unlock on initial touch
    const unlock = () => {
      initAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    loadCareer();
    buildCoordinateHeaders();
    buildGridDOM(dom.enemyGrid);
    buildGridDOM(dom.playerGrid);
    fx.init();

    // Deploy Enemy Fleet in secret
    autoDeployFleet(state.enemy);

    state.selectedShipId = FLEET_MANIFEST[0].id;
    dom.soundIconOn.classList.toggle('hidden', !state.soundEnabled);
    dom.soundIconOff.classList.toggle('hidden', state.soundEnabled);

    wireEvents();
    switchTheaterTab('defensive'); // Start on harbor view for quick ship setup
    refreshUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
