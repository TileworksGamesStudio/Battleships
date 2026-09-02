(() => {
  'use strict';

  // --- Classic Ship Manifest ---
  const GRID_SIZE = 10;
  const COLS = ['A','B','C','D','E','F','G','H','I','J'];
  const SHIPS = [
    { id: 'carrier',    name: 'Carrier',    size: 5 },
    { id: 'battleship', name: 'Battleship', size: 4 },
    { id: 'cruiser',    name: 'Cruiser',    size: 3 },
    { id: 'submarine',  name: 'Submarine',  size: 3 },
    { id: 'destroyer',  name: 'Destroyer',  size: 2 },
  ];

  // --- Sound FX Engine (Procedural Synthesizer, 0 External Files) ---
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
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.exponentialRampToValueAtTime(150, t + 0.04);
          g.gain.setValueAtTime(0.04, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.04);
          osc.start(t); osc.stop(t + 0.04);
        }
        else if (type === 'miss') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(260, t);
          osc.frequency.exponentialRampToValueAtTime(180, t + 0.1);
          g.gain.setValueAtTime(0.08, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.1);
          osc.start(t); osc.stop(t + 0.1);
        }
        else if (type === 'hit') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(140, t);
          osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.2);
          osc.start(t); osc.stop(t + 0.2);
        }
        else if (type === 'sunk') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(90, t);
          osc.frequency.linearRampToValueAtTime(30, t + 0.5);
          g.gain.setValueAtTime(0.2, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.5);
          osc.start(t); osc.stop(t + 0.5);
        }
        else if (type === 'win') {
          [350, 440, 523, 659].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g); g.connect(this.ctx.destination);
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.08, t + idx * 0.08);
            g.gain.linearRampToValueAtTime(0.001, t + idx * 0.08 + 0.25);
            osc.start(t + idx * 0.08);
            osc.stop(t + idx * 0.08 + 0.25);
          });
        }
      } catch (_) {}
    }
  }

  const sfx = new SoundEngine();

  function triggerHaptic(duration = 20) {
    if (navigator.vibrate) {
      try { navigator.vibrate(duration); } catch (_) {}
    }
  }

  // --- Fleet Factory ---
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

  // --- Game State ---
  const state = {
    phase: 'setup', // 'setup' | 'playing' | 'over'
    turn: 'player', // 'player' | 'enemy'
    orientation: 'h', // 'h' | 'v'
    selectedShipIndex: 0,
    player: createFleet(),
    enemy: createFleet(),
    stats: {
      playerShots: 0,
      playerHits: 0,
      turns: 0,
    },
    ai: {
      huntQueue: [],
    }
  };

  // --- DOM References ---
  const $ = (id) => document.getElementById(id);
  const dom = {
    statusText: $('statusText'),
    tabEnemy: $('tabEnemy'),
    tabPlayer: $('tabPlayer'),
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
    rotateBtn: $('rotateBtn'),
    orientationLabel: $('orientationLabel'),
    randomBtn: $('randomBtn'),
    startBattleBtn: $('startBattleBtn'),
    setupControls: $('setupControls'),
    battleControls: $('battleControls'),
    accuracyVal: $('accuracyVal'),
    turnsVal: $('turnsVal'),
    rematchQuickBtn: $('rematchQuickBtn'),
    gameModal: $('gameModal'),
    modalTitle: $('modalTitle'),
    modalDesc: $('modalDesc'),
    modalTurns: $('modalTurns'),
    modalAccuracy: $('modalAccuracy'),
    modalSurvivors: $('modalSurvivors'),
    playAgainBtn: $('playAgainBtn'),
    soundToggle: $('soundToggle'),
    soundOnIcon: $('soundOnIcon'),
    soundOffIcon: $('soundOffIcon'),
  };

  // --- Helper Math ---
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

  function getShipCoordinates(r, c, size, orientation) {
    const coords = [];
    for (let i = 0; i < size; i++) {
      coords.push({
        r: orientation === 'v' ? r + i : r,
        c: orientation === 'h' ? c + i : c
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
      fleet.grid[pt.r][pt.c] = { shipId: ship.id, hit: false };
    });

    ship.cells = coords;
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
      while (!placed && safety < 1000) {
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

  // --- Grid Building ---
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

        cell.addEventListener('click', () => clickHandler(r, c));

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
      // Tapped existing ship: pick it up to reposition
      const ship = state.player.ships.find(s => s.id === currentCell.shipId);
      if (ship) {
        removeShip(state.player, ship);
        state.selectedShipIndex = state.player.ships.indexOf(ship);
        sfx.play('tap');
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
      triggerHaptic(15);

      // Advance to next unplaced ship
      const nextIndex = state.player.ships.findIndex(s => !s.placed);
      state.selectedShipIndex = nextIndex !== -1 ? nextIndex : 0;
      clearPreview();
      render();
    } else {
      triggerHaptic(40);
    }
  }

  // --- Battle: Firing & Resolution ---
  function onEnemyGridCellClick(r, c) {
    if (state.phase !== 'playing' || state.turn !== 'player') return;

    const targetCell = state.enemy.grid[r][c];
    if (targetCell && (targetCell.state === 'hit' || targetCell.state === 'miss')) {
      return; // Already shot here
    }

    state.stats.playerShots++;
    state.turn = 'enemy';

    // Player Shot Resolution
    if (targetCell && targetCell.shipId) {
      targetCell.state = 'hit';
      const ship = state.enemy.ships.find(s => s.id === targetCell.shipId);
      ship.hits++;
      state.stats.playerHits++;

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        triggerHaptic([40, 40, 80]);
        dom.statusText.textContent = `You sunk enemy ${ship.name}!`;
      } else {
        sfx.play('hit');
        triggerHaptic(30);
        dom.statusText.textContent = 'Direct hit!';
      }
    } else {
      state.enemy.grid[r][c] = { state: 'miss' };
      sfx.play('miss');
      triggerHaptic(10);
      dom.statusText.textContent = 'Shot missed.';
    }

    render();

    if (checkEndGame()) return;

    // Trigger AI Turn
    setTimeout(executeAITurn, 600);
  }

  // --- Classic Hunt & Target AI ---
  function executeAITurn() {
    if (state.phase !== 'playing') return;

    let target = null;

    // Target Mode: Pop from queued neighbor targets
    while (state.ai.huntQueue.length > 0) {
      const candidate = state.ai.huntQueue.shift();
      const cell = state.player.grid[candidate.r][candidate.c];
      if (!cell || (cell.state !== 'hit' && cell.state !== 'miss')) {
        target = candidate;
        break;
      }
    }

    // Hunt Mode: Checkerboard parity selection
    if (!target) {
      const candidates = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = state.player.grid[r][c];
          const unhit = !cell || (cell.state !== 'hit' && cell.state !== 'miss');
          if (unhit && (r + c) % 2 === 0) {
            candidates.push({ r, c });
          }
        }
      }

      if (candidates.length > 0) {
        target = candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        // Fallback to any remaining untouched cell
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
    if (cell && cell.shipId) {
      cell.state = 'hit';
      const ship = state.player.ships.find(s => s.id === cell.shipId);
      ship.hits++;

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        dom.statusText.textContent = `Enemy sunk your ${ship.name}!`;
      } else {
        sfx.play('hit');
        dom.statusText.textContent = 'Enemy scored a hit!';
      }

      // Add orthogonal neighbors to hunt queue
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
          if (unhit) state.ai.huntQueue.push(n);
        }
      });
    } else {
      state.player.grid[target.r][target.c] = { state: 'miss' };
      sfx.play('miss');
      dom.statusText.textContent = 'Enemy salvo missed.';
    }

    state.stats.turns++;
    render();

    if (checkEndGame()) return;

    state.turn = 'player';
  }

  function checkEndGame() {
    const enemyAllSunk = state.enemy.ships.every(s => s.sunk);
    const playerAllSunk = state.player.ships.every(s => s.sunk);

    if (enemyAllSunk || playerAllSunk) {
      state.phase = 'over';

      if (enemyAllSunk) {
        sfx.play('win');
        dom.modalTitle.textContent = 'VICTORY';
        dom.modalDesc.textContent = 'Hostile fleet eliminated. Theater secured.';
      } else {
        sfx.play('miss');
        dom.modalTitle.textContent = 'DEFEAT';
        dom.modalDesc.textContent = 'Your fleet was dismantled by enemy fire.';
      }

      const shots = state.stats.playerShots;
      const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
      dom.modalTurns.textContent = state.stats.turns;
      dom.modalAccuracy.textContent = `${acc}%`;
      dom.modalSurvivors.textContent = `${state.player.ships.filter(s => !s.sunk).length}/5`;

      dom.gameModal.classList.remove('hidden');
      return true;
    }
    return false;
  }

  // --- Render Cycle ---
  function renderGrid(container, fleet, hideShips = false) {
    const cells = container.children;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const cellEl = cells[idx];
        const data = fleet.grid[r][c];

        cellEl.className = 'cell';

        if (data) {
          if (data.state === 'miss') {
            cellEl.classList.add('miss');
          } else if (data.state === 'hit') {
            const ship = fleet.ships.find(s => s.id === data.shipId);
            cellEl.classList.add(ship && ship.sunk ? 'sunk' : 'hit');
          } else if (!hideShips && data.shipId) {
            cellEl.classList.add('ship');
          }
        }
      }
    }
  }

  function renderIndicators() {
    const makePills = (fleet, container) => {
      container.innerHTML = '';
      fleet.ships.forEach(s => {
        const pip = document.createElement('div');
        pip.className = 'indicator-pip' + (s.sunk ? ' sunk' : '');
        pip.title = `${s.name} (${s.size})`;
        container.appendChild(pip);
      });
    };

    makePills(state.player, dom.playerFleetPills);
    makePills(state.enemy, dom.enemyFleetPills);

    const pAlive = state.player.ships.filter(s => !s.sunk).length;
    const eAlive = state.enemy.ships.filter(s => !s.sunk).length;

    dom.playerFleetCount.textContent = pAlive;
    dom.enemyFleetCount.textContent = eAlive;
  }

  function render() {
    renderGrid(dom.playerGrid, state.player, false);
    renderGrid(dom.enemyGrid, state.enemy, true);
    renderIndicators();

    // Stats
    const shots = state.stats.playerShots;
    const acc = shots > 0 ? Math.round((state.stats.playerHits / shots) * 100) : 0;
    dom.accuracyVal.textContent = `${acc}%`;
    dom.turnsVal.textContent = state.stats.turns;

    // Controls display switch
    if (state.phase === 'setup') {
      dom.setupControls.classList.remove('hidden');
      dom.battleControls.classList.add('hidden');
      const allPlaced = state.player.ships.every(s => s.placed);
      dom.startBattleBtn.style.opacity = allPlaced ? '1' : '0.4';
      dom.startBattleBtn.disabled = !allPlaced;
    } else {
      dom.setupControls.classList.add('hidden');
      dom.battleControls.classList.remove('hidden');
    }
  }

  // --- Reset Game (Clean State Transitions) ---
  function resetGame() {
    state.phase = 'setup';
    state.turn = 'player';
    state.selectedShipIndex = 0;
    state.orientation = 'h';
    state.stats = { playerShots: 0, playerHits: 0, turns: 0 };
    state.ai.huntQueue = [];
    state.player = createFleet();
    state.enemy = createFleet();

    dom.gameModal.classList.add('hidden');
    dom.orientationLabel.textContent = 'ROTATE (H)';
    dom.statusText.textContent = 'Position your fleet';

    // Auto deploy enemy ships secretly
    autoPlaceAll(state.enemy);

    // Switch view to player harbor for setup on mobile
    switchView('player');
    render();
  }

  // --- Mobile Single-View Switching ---
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
    }
  }

  // --- Wire Event Handlers ---
  function wireEvents() {
    // Tabs
    dom.tabEnemy.addEventListener('click', () => { sfx.play('tap'); switchView('enemy'); });
    dom.tabPlayer.addEventListener('click', () => { sfx.play('tap'); switchView('player'); });

    // Rotate Ship
    dom.rotateBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.orientationLabel.textContent = `ROTATE (${state.orientation.toUpperCase()})`;
      sfx.play('tap');
    });

    // Randomize Fleet
    dom.randomBtn.addEventListener('click', () => {
      if (state.phase !== 'setup') return;
      autoPlaceAll(state.player);
      sfx.play('tap');
      triggerHaptic(20);
      render();
    });

    // Start Battle
    dom.startBattleBtn.addEventListener('click', () => {
      if (!state.player.ships.every(s => s.placed)) return;
      state.phase = 'playing';
      sfx.play('tap');
      triggerHaptic(30);
      dom.statusText.textContent = 'Battle commenced. Pick a target!';
      switchView('enemy');
      render();
    });

    // Rematch Quick Button
    dom.rematchQuickBtn.addEventListener('click', () => {
      sfx.play('tap');
      resetGame();
    });

    // Modal Play Again
    dom.playAgainBtn.addEventListener('click', () => {
      sfx.play('tap');
      resetGame();
    });

    // Audio Toggle
    dom.soundToggle.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('btl_sound', sfx.enabled);
      dom.soundOnIcon.classList.toggle('hidden', !sfx.enabled);
      dom.soundOffIcon.classList.toggle('hidden', sfx.enabled);
      if (sfx.enabled) sfx.play('tap');
    });

    // Resume Audio Context on First Interaction
    const unlockAudio = () => {
      sfx.init();
      window.removeEventListener('pointerdown', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
  }

  // --- Init ---
  function init() {
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