/**
 * BATTLESHIP // TACTICAL MOBILE ENGINE
 * Zero-Scroll 100dvh Layout, Fluid One-Tap/Drag Fleet Deployment & Procedural Audio
 */
(() => {
  'use strict';

  const GRID_SIZE = 10;
  const COLS = ['A','B','C','D','E','F','G','H','I','J'];
  const SHIPS = [
    { id: 'carrier',    name: 'Carrier',    size: 5 },
    { id: 'battleship', name: 'Battleship', size: 4 },
    { id: 'cruiser',    name: 'Cruiser',    size: 3 },
    { id: 'submarine',  name: 'Submarine',  size: 3 },
    { id: 'destroyer',  name: 'Destroyer',  size: 2 }
  ];

  // --- Synthesizer Audio ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = localStorage.getItem('btl_sound') !== 'false';
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    play(type) {
      if (!this.enabled) return;
      try {
        this.init();
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.ctx.destination);

        if (type === 'tap') {
          osc.frequency.setValueAtTime(1200, t);
          osc.frequency.exponentialRampToValueAtTime(140, t + 0.025);
          g.gain.setValueAtTime(0.1, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
          osc.start(t); osc.stop(t + 0.025);
        } else if (type === 'sonar') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(784, t);
          osc.frequency.exponentialRampToValueAtTime(770, t + 0.8);
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
          osc.start(t); osc.stop(t + 0.8);
        } else if (type === 'launch') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, t);
          osc.frequency.exponentialRampToValueAtTime(700, t + 0.2);
          g.gain.setValueAtTime(0.08, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.start(t); osc.stop(t + 0.2);
        } else if (type === 'hit') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
          g.gain.setValueAtTime(0.4, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.start(t); osc.stop(t + 0.3);
        } else if (type === 'miss') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
          g.gain.setValueAtTime(0.15, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.start(t); osc.stop(t + 0.15);
        } else if (type === 'sunk') {
          [350, 260].forEach((freq, idx) => {
            const o = this.ctx.createOscillator();
            const gn = this.ctx.createGain();
            o.connect(gn); gn.connect(this.ctx.destination);
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(freq, t + idx * 0.14);
            gn.gain.setValueAtTime(0.25, t + idx * 0.14);
            gn.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.14 + 0.22);
            o.start(t + idx * 0.14); o.stop(t + idx * 0.14 + 0.22);
          });
        }
      } catch (_) {}
    }
  }

  const sfx = new SoundEngine();
  const haptic = (ms = 15) => { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (_) {} };

  // --- Canvas Particle FX ---
  class CanvasFX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.particles = [];
      this.projectiles = [];
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

    fire(startX, startY, targetX, targetY, cb) {
      this.projectiles.push({ x: startX, y: startY, startX, startY, targetX, targetY, p: 0, cb });
      this.startLoop();
    }

    explode(x, y) {
      for (let i = 0; i < 24; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = Math.random() * 4 + 1.5;
        this.particles.push({
          x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
          size: Math.random() * 3 + 1,
          color: Math.random() < 0.5 ? '#ff2a51' : '#f59e0b',
          alpha: 1, decay: 0.035
        });
      }
      this.startLoop();
    }

    splash(x, y) {
      this.ripples.push({ x, y, r: 2, maxR: 20, alpha: 0.8 });
      for (let i = 0; i < 14; i++) {
        this.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 3,
          vy: -(Math.random() * 3.5 + 1),
          gravity: 0.2,
          size: 1.8,
          color: '#00f0ff',
          alpha: 0.9, decay: 0.04
        });
      }
      this.startLoop();
    }

    loop() {
      this.ctx.save();
      this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width / this.scale, this.canvas.height / this.scale);

      // Projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        pr.p += 0.08;
        pr.x = pr.startX + (pr.targetX - pr.startX) * pr.p;
        pr.y = pr.startY + (pr.targetY - pr.startY) * pr.p;

        this.ctx.beginPath();
        this.ctx.arc(pr.x, pr.y, 2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.fill();

        if (pr.p >= 1) {
          pr.cb(pr.targetX, pr.targetY);
          this.projectiles.splice(i, 1);
        }
      }

      // Ripples
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const rp = this.ripples[i];
        rp.r += 1.2;
        rp.alpha -= 0.04;
        if (rp.alpha <= 0) {
          this.ripples.splice(i, 1);
          continue;
        }
        this.ctx.beginPath();
        this.ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(0, 240, 255, ${rp.alpha})`;
        this.ctx.lineWidth = 1.8;
        this.ctx.stroke();
      }

      // Particles
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

      if (this.projectiles.length > 0 || this.ripples.length > 0 || this.particles.length > 0) {
        requestAnimationFrame(() => this.loop());
      } else {
        this.animating = false;
      }
    }
  }

  // --- Fleet Model ---
  const createFleet = () => ({
    grid: Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null)),
    ships: SHIPS.map(s => ({ ...s, placed: false, cells: [], hits: 0, sunk: false }))
  });

  const state = {
    phase: 'setup',
    turn: 'player',
    orientation: 'h',
    selectedShipIndex: 0,
    player: createFleet(),
    enemy: createFleet(),
    stats: { shots: 0, hits: 0, turns: 0 },
    ai: { targetQueue: [], activeHits: [] }
  };

  // --- DOM Elements ---
  const $ = (id) => document.getElementById(id);
  const dom = {
    arena: $('arena'),
    fxCanvas: $('fxCanvas'),
    commsText: $('commsText'),
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

    setupControls: $('setupControls'),
    battleControls: $('battleControls'),
    shipDock: $('shipDock'),
    rotateBtn: $('rotateBtn'),
    orientationLabel: $('orientationLabel'),
    scrambleBtn: $('scrambleBtn'),
    startBattleBtn: $('startBattleBtn'),

    tabEnemy: $('tabEnemy'),
    tabPlayer: $('tabPlayer'),
    enemyCountBadge: $('enemyCountBadge'),
    playerCountBadge: $('playerCountBadge'),
    incomingAlert: $('incomingAlert'),
    shotsMetric: $('shotsMetric'),
    accuracyMetric: $('accuracyMetric'),
    sunkMetric: $('sunkMetric'),
    abortBtn: $('abortBtn'),

    gameModal: $('gameModal'),
    modalRank: $('modalRank'),
    modalTitle: $('modalTitle'),
    modalDesc: $('modalDesc'),
    modalSalvoes: $('modalSalvoes'),
    modalAccuracy: $('modalAccuracy'),
    modalSurvivors: $('modalSurvivors'),
    shareSummary: $('shareSummary'),
    shareReportBtn: $('shareReportBtn'),
    playAgainBtn: $('playAgainBtn'),
    toastNotice: $('toastNotice')
  };

  let fx = null;

  // --- Grid & Placement Helpers ---
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

  function getShipCells(r, c, size, orient) {
    const cells = [];
    for (let i = 0; i < size; i++) {
      cells.push({
        r: orient === 'v' ? r + i : r,
        c: orient === 'h' ? c + i : c,
        index: i
      });
    }
    return cells;
  }

  function canPlace(fleet, r, c, size, orient, excludeId = null) {
    const coords = getShipCells(r, c, size, orient);
    for (const pt of coords) {
      if (!inBounds(pt.r, pt.c)) return false;
      const cell = fleet.grid[pt.r][pt.c];
      if (cell && cell.shipId !== excludeId) return false;
    }
    return true;
  }

  function placeShip(fleet, ship, r, c, orient) {
    if (ship.placed) unplaceShip(fleet, ship);
    const coords = getShipCells(r, c, ship.size, orient);
    coords.forEach(pt => {
      fleet.grid[pt.r][pt.c] = {
        shipId: ship.id,
        part: pt.index === 0 ? 'bow' : (pt.index === ship.size - 1 ? 'stern' : 'mid'),
        orient,
        hit: false
      };
    });
    ship.cells = coords;
    ship.orient = orient;
    ship.placed = true;
  }

  function unplaceShip(fleet, ship) {
    if (!ship.placed) return;
    ship.cells.forEach(pt => { fleet.grid[pt.r][pt.c] = null; });
    ship.cells = [];
    ship.placed = false;
  }

  function autoPlaceAll(fleet) {
    fleet.ships.forEach(s => unplaceShip(fleet, s));
    fleet.ships.forEach(ship => {
      let placed = false;
      let limit = 0;
      while (!placed && limit < 1000) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        if (canPlace(fleet, r, c, ship.size, ori)) {
          placeShip(fleet, ship, r, c, ori);
          placed = true;
        }
        limit++;
      }
    });
  }

  // --- Grid Construction ---
  function buildAxes() {
    [dom.enemyAxisX, dom.playerAxisX].forEach(el => {
      el.innerHTML = '';
      COLS.forEach(c => {
        const s = document.createElement('span');
        s.textContent = c;
        el.appendChild(s);
      });
    });

    [dom.enemyAxisY, dom.playerAxisY].forEach(el => {
      el.innerHTML = '';
      for (let i = 1; i <= GRID_SIZE; i++) {
        const s = document.createElement('span');
        s.textContent = i;
        el.appendChild(s);
      }
    });
  }

  function buildGrid(container, onClick, isPlayer = false) {
    container.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => onClick(r, c, cell));
        if (isPlayer) {
          cell.addEventListener('pointerenter', () => previewHalo(r, c));
        }
        container.appendChild(cell);
      }
    }
    if (isPlayer) {
      container.addEventListener('pointerleave', clearHalos);
    }
  }

  // --- Dock UI ---
  function renderDock() {
    dom.shipDock.innerHTML = '';
    state.player.ships.forEach((ship, idx) => {
      const card = document.createElement('button');
      card.className = 'dock-card' +
        (idx === state.selectedShipIndex ? ' active' : '') +
        (ship.placed ? ' placed' : '');
      card.setAttribute('role', 'tab');

      const name = document.createElement('span');
      name.className = 'dock-name';
      name.textContent = `${ship.name.toUpperCase()} (${ship.size})`;

      const pips = document.createElement('div');
      pips.className = 'dock-pips';
      for (let i = 0; i < ship.size; i++) {
        const p = document.createElement('span');
        p.className = 'dock-pip';
        pips.appendChild(p);
      }

      card.appendChild(name);
      card.appendChild(pips);

      card.addEventListener('click', () => {
        state.selectedShipIndex = idx;
        sfx.play('tap');
        haptic(15);
        render();
      });

      dom.shipDock.appendChild(card);
    });
  }

  // --- Placement Previews ---
  function previewHalo(r, c) {
    if (state.phase !== 'setup') return;
    clearHalos();
    const ship = state.player.ships[state.selectedShipIndex];
    if (!ship) return;

    const coords = getShipCells(r, c, ship.size, state.orientation);
    const valid = canPlace(state.player, r, c, ship.size, state.orientation, ship.id);

    coords.forEach(pt => {
      if (inBounds(pt.r, pt.c)) {
        const el = dom.playerGrid.children[pt.r * GRID_SIZE + pt.c];
        el.classList.add(valid ? 'valid-halo' : 'invalid-halo');
      }
    });
  }

  function clearHalos() {
    dom.playerGrid.querySelectorAll('.valid-halo, .invalid-halo')
      .forEach(el => el.classList.remove('valid-halo', 'invalid-halo'));
  }

  // --- Player Setup Grid Interaction ---
  function onPlayerGridClick(r, c) {
    if (state.phase !== 'setup') return;

    const existing = state.player.grid[r][c];
    if (existing) {
      // Tap placed ship: rotate it in place or pick it up
      const ship = state.player.ships.find(s => s.id === existing.shipId);
      if (ship) {
        const newOrient = ship.orient === 'h' ? 'v' : 'h';
        const bow = ship.cells[0];
        if (canPlace(state.player, bow.r, bow.c, ship.size, newOrient, ship.id)) {
          placeShip(state.player, ship, bow.r, bow.c, newOrient);
          sfx.play('tap');
          haptic(20);
        } else {
          unplaceShip(state.player, ship);
          state.selectedShipIndex = state.player.ships.indexOf(ship);
          sfx.play('tap');
          haptic(15);
        }
        render();
        previewHalo(r, c);
        return;
      }
    }

    const ship = state.player.ships[state.selectedShipIndex];
    if (!ship) return;

    if (canPlace(state.player, r, c, ship.size, state.orientation, ship.id)) {
      placeShip(state.player, ship, r, c, state.orientation);
      sfx.play('tap');
      haptic(20);

      const nextUnplaced = state.player.ships.findIndex(s => !s.placed);
      if (nextUnplaced !== -1) {
        state.selectedShipIndex = nextUnplaced;
      }
      clearHalos();
      render();
    } else {
      haptic([30, 20, 30]);
    }
  }

  // --- Combat Target Resolution ---
  function getCellCenter(cellEl) {
    const arenaRect = dom.arena.getBoundingClientRect();
    const cellRect = cellEl.getBoundingClientRect();
    return {
      x: cellRect.left + cellRect.width / 2 - arenaRect.left,
      y: cellRect.top + cellRect.height / 2 - arenaRect.top
    };
  }

  function onEnemyGridClick(r, c, cellEl) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;

    const target = state.enemy.grid[r][c];
    if (target && (target.state === 'hit' || target.state === 'miss')) {
      sfx.play('tap');
      return;
    }

    state.turn = 'resolving';
    state.stats.shots++;

    const pos = getCellCenter(cellEl);
    sfx.play('launch');

    fx.fire(pos.x + (Math.random() - 0.5) * 40, -30, pos.x, pos.y, () => {
      if (target && target.shipId) {
        target.state = 'hit';
        const ship = state.enemy.ships.find(s => s.id === target.shipId);
        ship.hits++;
        state.stats.hits++;

        fx.explode(pos.x, pos.y);
        dom.arena.classList.add('screen-shake-sm');
        setTimeout(() => dom.arena.classList.remove('screen-shake-sm'), 280);

        if (ship.hits >= ship.size) {
          ship.sunk = true;
          sfx.play('sunk');
          haptic([50, 40, 90]);
          dom.commsText.textContent = `TARGET ELIMINATED // ${ship.name.toUpperCase()} SUNK!`;
        } else {
          sfx.play('hit');
          haptic([30, 20, 40]);
          dom.commsText.textContent = `CONFIRMED HIT // SECTOR ${COLS[c]}-${r + 1}`;
        }
      } else {
        state.enemy.grid[r][c] = { state: 'miss' };
        fx.splash(pos.x, pos.y);
        sfx.play('miss');
        haptic(15);
        dom.commsText.textContent = `SPLASH // SECTOR ${COLS[c]}-${r + 1} CLEAR`;
      }

      render();
      if (checkEndGame()) return;

      state.turn = 'enemy';
      setTimeout(executeAITurn, 600);
    });
  }

  // --- AI Strategic Hunt / Target Logic ---
  function executeAITurn() {
    if (state.phase !== 'playing') return;

    let target = null;
    while (state.ai.targetQueue.length > 0) {
      const cand = state.ai.targetQueue.shift();
      const cell = state.player.grid[cand.r][cand.c];
      if (!cell || (cell.state !== 'hit' && cell.state !== 'miss')) {
        target = cand;
        break;
      }
    }

    if (!target) {
      const parity = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = state.player.grid[r][c];
          if ((!cell || (cell.state !== 'hit' && cell.state !== 'miss')) && (r + c) % 2 === 0) {
            parity.push({ r, c });
          }
        }
      }
      target = parity.length > 0
        ? parity[Math.floor(Math.random() * parity.length)]
        : getRandomUntouchedCell();
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
      haptic([40, 25, 50]);
      dom.incomingAlert.classList.remove('hidden');

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        dom.commsText.textContent = `WARNING // YOUR ${ship.name.toUpperCase()} WAS SUNK!`;
        state.ai.activeHits = state.ai.activeHits.filter(
          h => !ship.cells.some(c => c.r === h.r && c.c === h.c)
        );
      } else {
        dom.commsText.textContent = `HOSTILE HIT // DEFENSE SECTOR ${COLS[target.c]}-${target.r + 1}`;
        const neighbors = [
          { r: target.r - 1, c: target.c },
          { r: target.r + 1, c: target.c },
          { r: target.r, c: target.c - 1 },
          { r: target.r, c: target.c + 1 }
        ];
        neighbors.forEach(n => {
          if (inBounds(n.r, n.c)) {
            const nc = state.player.grid[n.r][n.c];
            if (!nc || (nc.state !== 'hit' && nc.state !== 'miss')) {
              state.ai.targetQueue.push(n);
            }
          }
        });
      }
    } else {
      state.player.grid[target.r][target.c] = { state: 'miss' };
      sfx.play('miss');
      dom.commsText.textContent = `DEFENSES SECURE // ENEMY SALVO MISSED`;
    }

    state.stats.turns++;
    render();
    if (checkEndGame()) return;

    state.turn = 'player';
  }

  function getRandomUntouchedCell() {
    const list = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = state.player.grid[r][c];
        if (!cell || (cell.state !== 'hit' && cell.state !== 'miss')) {
          list.push({ r, c });
        }
      }
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  // --- End Game Evaluation ---
  function checkEndGame() {
    const enemySunk = state.enemy.ships.every(s => s.sunk);
    const playerSunk = state.player.ships.every(s => s.sunk);

    if (enemySunk || playerSunk) {
      state.phase = 'over';
      const win = enemySunk;
      const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
      const survivors = state.player.ships.filter(s => !s.sunk).length;

      let rank = '★☆☆☆☆ SEAMAN';
      if (win) {
        if (state.stats.shots <= 34) rank = '★★★★★ FLEET ADMIRAL';
        else if (state.stats.shots <= 45) rank = '★★★★☆ VICE ADMIRAL';
        else rank = '★★★☆☆ COMMANDER';
        sfx.play('sonar');
      } else {
        sfx.play('sunk');
      }

      dom.modalRank.textContent = rank;
      dom.modalTitle.textContent = win ? 'VICTORY' : 'DEFEAT';
      dom.modalDesc.textContent = win ? 'Hostile squadron eradicated. Sector cleared.' : 'Friendly fleet suffered critical destruction.';
      dom.modalSalvoes.textContent = state.stats.shots;
      dom.modalAccuracy.textContent = `${acc}%`;
      dom.modalSurvivors.textContent = `${survivors}/5`;

      const preview = state.enemy.ships.map(s => s.sunk ? '🟥' : '🟦').join(' ');
      dom.shareSummary.textContent = `FLEET STATUS: ${preview}`;

      dom.gameModal.classList.remove('hidden');
      return true;
    }
    return false;
  }

  // --- Rendering Functions ---
  function renderGrid(container, fleet, hideShips) {
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
          if (data.state === 'miss') cellEl.classList.add('miss');
          if (data.state === 'hit') {
            const ship = fleet.ships.find(s => s.id === data.shipId);
            cellEl.classList.add(ship && ship.sunk ? 'sunk' : 'hit');
          }

          const ship = fleet.ships.find(s => s.id === data.shipId);
          const show = !hideShips || (ship && ship.sunk);

          if (show && data.shipId) {
            cellEl.setAttribute('data-orient', data.orient);
            cellEl.setAttribute('data-part', data.part);
            const hull = document.createElement('div');
            hull.className = 'ship-hull';
            cellEl.appendChild(hull);
          }
        }
      }
    }
  }

  function renderHUD() {
    const updatePills = (fleet, container) => {
      container.innerHTML = '';
      fleet.ships.forEach(s => {
        const pip = document.createElement('div');
        pip.className = 'pip' + (s.sunk ? ' sunk' : '');
        container.appendChild(pip);
      });
    };

    updatePills(state.player, dom.playerFleetPills);
    updatePills(state.enemy, dom.enemyFleetPills);

    const pAlive = state.player.ships.filter(s => !s.sunk).length;
    const eAlive = state.enemy.ships.filter(s => !s.sunk).length;

    dom.playerCountBadge.textContent = pAlive;
    dom.enemyCountBadge.textContent = eAlive;
    dom.sunkMetric.textContent = `${5 - eAlive}/5`;

    const shots = state.stats.shots;
    const acc = shots > 0 ? Math.round((state.stats.hits / shots) * 100) : 0;
    dom.shotsMetric.textContent = shots;
    dom.accuracyMetric.textContent = `${acc}%`;

    if (state.phase === 'setup') {
      dom.setupControls.classList.remove('hidden');
      dom.battleControls.classList.add('hidden');
      renderDock();
      dom.startBattleBtn.disabled = !state.player.ships.every(s => s.placed);
    } else {
      dom.setupControls.classList.add('hidden');
      dom.battleControls.classList.remove('hidden');
    }
  }

  function render() {
    renderGrid(dom.playerGrid, state.player, false);
    renderGrid(dom.enemyGrid, state.enemy, true);
    renderHUD();
  }

  function switchTheater(theater) {
    if (theater === 'enemy') {
      dom.tabEnemy.classList.add('active');
      dom.tabPlayer.classList.remove('active');
      dom.enemyCard.classList.add('active');
      dom.playerCard.classList.remove('active');
    } else {
      dom.tabPlayer.classList.add('active');
      dom.tabEnemy.classList.remove('active');
      dom.playerCard.classList.add('active');
      dom.enemyCard.classList.remove('active');
      dom.incomingAlert.classList.add('hidden');
    }
    if (fx) fx.resize();
  }

  function showToast(msg) {
    dom.toastNotice.textContent = msg;
    dom.toastNotice.classList.remove('hidden');
    setTimeout(() => dom.toastNotice.classList.add('hidden'), 2000);
  }

  function resetMission() {
    state.phase = 'setup';
    state.turn = 'player';
    state.selectedShipIndex = 0;
    state.orientation = 'h';
    state.stats = { shots: 0, hits: 0, turns: 0 };
    state.ai = { targetQueue: [], activeHits: [] };
    state.player = createFleet();
    state.enemy = createFleet();

    dom.gameModal.classList.add('hidden');
    dom.incomingAlert.classList.add('hidden');
    dom.orientationLabel.textContent = 'ROT (H)';
    dom.commsText.textContent = 'DEPLOY WARSHIPS: TAP GRID OR USE DOCK';

    autoPlaceAll(state.enemy);
    switchTheater('player');
    render();
  }

  // --- Event Binding ---
  function wireEvents() {
    dom.tabEnemy.addEventListener('click', () => { sfx.play('tap'); switchTheater('enemy'); });
    dom.tabPlayer.addEventListener('click', () => { sfx.play('tap'); switchTheater('player'); });

    dom.rotateBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.orientationLabel.textContent = `ROT (${state.orientation.toUpperCase()})`;
      sfx.play('tap');
      haptic(15);
    });

    dom.scrambleBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      autoPlaceAll(state.player);
      sfx.play('tap');
      haptic([20, 20, 30]);
      render();
    });

    dom.startBattleBtn.addEventListener('click', () => {
      if (!state.player.ships.every(s => s.placed)) return;
      state.phase = 'playing';
      sfx.play('sonar');
      haptic(35);
      dom.commsText.textContent = 'TARGET RADAR ACTIVE // SELECT GRID COORDINATES';
      switchTheater('enemy');
      render();
    });

    dom.sonarBtn.addEventListener('click', () => { sfx.play('sonar'); haptic(25); });
    dom.abortBtn.addEventListener('click', () => { sfx.play('tap'); resetMission(); });
    dom.playAgainBtn.addEventListener('click', () => { sfx.play('tap'); resetMission(); });

    dom.shareReportBtn.addEventListener('click', () => {
      sfx.play('tap');
      const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
      const text = `⚓ BATTLESHIP MISSION DEBRIEF ⚓\nRank: ${dom.modalRank.textContent}\nSalvoes: ${state.stats.shots} | Accuracy: ${acc}%\nStatus: SECURED`;
      if (navigator.share) {
        navigator.share({ title: 'Battleship Debrief', text }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text).then(() => showToast('DEBRIEF COPIED TO CLIPBOARD'));
      }
    });

    dom.soundToggle.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('btl_sound', sfx.enabled);
      dom.soundOnIcon.classList.toggle('hidden', !sfx.enabled);
      dom.soundOffIcon.classList.toggle('hidden', sfx.enabled);
      if (sfx.enabled) sfx.play('tap');
    });

    const unlock = () => { sfx.init(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock, { passive: true });
  }

  function init() {
    fx = new CanvasFX(dom.fxCanvas);
    buildAxes();
    buildGrid(dom.enemyGrid, onEnemyGridClick, false);
    buildGrid(dom.playerGrid, onPlayerGridClick, true);

    dom.soundOnIcon.classList.toggle('hidden', !sfx.enabled);
    dom.soundOffIcon.classList.toggle('hidden', sfx.enabled);

    wireEvents();
    resetMission();
  }

  document.addEventListener('DOMContentLoaded', init);
})();