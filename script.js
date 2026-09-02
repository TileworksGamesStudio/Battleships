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

  // --- Procedural Sound FX Engine (Zero External Audio Files) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = localStorage.getItem('bts_snd') !== 'false';
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

        if (type === 'beep') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(650, t);
          g.gain.setValueAtTime(0.05, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          osc.start(t); osc.stop(t + 0.06);
        } else if (type === 'place') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(420, t);
          osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
          g.gain.setValueAtTime(0.08, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.08);
          osc.start(t); osc.stop(t + 0.08);
        } else if (type === 'klaxon') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(780, t);
          osc.frequency.setValueAtTime(980, t + 0.1);
          g.gain.setValueAtTime(0.09, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.22);
          osc.start(t); osc.stop(t + 0.22);
        } else if (type === 'miss') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(240, t);
          osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
          g.gain.setValueAtTime(0.08, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.12);
          osc.start(t); osc.stop(t + 0.12);
        } else if (type === 'hit') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(180, t);
          osc.frequency.exponentialRampToValueAtTime(40, t + 0.24);
          g.gain.setValueAtTime(0.2, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.24);
          osc.start(t); osc.stop(t + 0.24);
        } else if (type === 'sunk') {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'triangle';
          osc.connect(g); g.connect(this.ctx.destination);
          osc.frequency.setValueAtTime(140, t);
          osc.frequency.linearRampToValueAtTime(28, t + 0.5);
          g.gain.setValueAtTime(0.26, t);
          g.gain.linearRampToValueAtTime(0.001, t + 0.5);
          osc.start(t); osc.stop(t + 0.5);
        } else if (type === 'win') {
          [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.connect(g); g.connect(this.ctx.destination);
            osc.frequency.value = freq;
            g.gain.setValueAtTime(0.07, t + idx * 0.08);
            g.gain.linearRampToValueAtTime(0.001, t + idx * 0.08 + 0.22);
            osc.start(t + idx * 0.08);
            osc.stop(t + idx * 0.08 + 0.22);
          });
        }
      } catch (_) {}
    }
  }

  const sfx = new SoundEngine();

  // --- Fleet Factory ---
  function makeFleet() {
    return {
      grid: Array.from({ length: GRID_SIZE }, () =>
        Array.from({ length: GRID_SIZE }, () => ({
          shipId: null,
          shot: false,
        }))
      ),
      ships: SHIPS.map(s => ({
        ...s,
        placed: false,
        coords: [],
        hits: 0,
        sunk: false,
      }))
    };
  }

  // --- Game State Tree ---
  const state = {
    screen: 'setup',            // 'setup' | 'countdown' | 'battle' | 'over'
    turn: 'player',             // 'player' | 'enemy' | 'busy'
    orientation: 'h',           // 'h' | 'v'
    difficulty: 'normal',       // 'easy' | 'normal' | 'hard'
    selectedShipId: null,
    player: makeFleet(),
    enemy: makeFleet(),
    stats: { shots: 0, hits: 0, turns: 0 },
    ai: {
      targetQueue: [],
      currentChain: [],
    }
  };

  // --- Coordinates Geometry ---
  const inBounds = (r, c) => r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE;

  function getShipPoints(r, c, size, orientation) {
    const pts = [];
    for (let i = 0; i < size; i++) {
      pts.push({
        r: orientation === 'v' ? r + i : r,
        c: orientation === 'h' ? c + i : c
      });
    }
    return pts;
  }

  function canPlace(fleet, r, c, size, orientation, excludeId = null) {
    const pts = getShipPoints(r, c, size, orientation);
    for (const p of pts) {
      if (!inBounds(p.r, p.c)) return false;
      const cell = fleet.grid[p.r][p.c];
      if (cell.shipId !== null && cell.shipId !== excludeId) return false;
    }
    return true;
  }

  function placeShip(fleet, ship, r, c, orientation) {
    if (ship.placed) {
      ship.coords.forEach(p => { fleet.grid[p.r][p.c].shipId = null; });
    }
    const pts = getShipPoints(r, c, ship.size, orientation);
    pts.forEach(p => {
      fleet.grid[p.r][p.c].shipId = ship.id;
    });
    ship.coords = pts;
    ship.placed = true;
  }

  function clearFleet(fleet) {
    fleet.ships.forEach(s => {
      s.placed = false;
      s.coords = [];
      s.hits = 0;
      s.sunk = false;
    });
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        fleet.grid[r][c] = { shipId: null, shot: false };
      }
    }
  }

  function autoPlaceAll(fleet) {
    clearFleet(fleet);
    fleet.ships.forEach(ship => {
      let placed = false;
      let guard = 0;
      while (!placed && guard < 600) {
        const ori = Math.random() < 0.5 ? 'h' : 'v';
        const r = Math.floor(Math.random() * GRID_SIZE);
        const c = Math.floor(Math.random() * GRID_SIZE);
        if (canPlace(fleet, r, c, ship.size, ori)) {
          placeShip(fleet, ship, r, c, ori);
          placed = true;
        }
        guard++;
      }
    });
  }

  // --- DOM Elements ---
  const $ = (id) => document.getElementById(id);
  const dom = {
    screenSetup: $('screenSetup'),
    screenBattle: $('screenBattle'),
    countdownCurtain: $('countdownCurtain'),
    countdownDigit: $('countdownDigit'),
    gameOverModal: $('gameOverModal'),
    optionsModal: $('optionsModal'),
    setupInstruction: $('setupInstruction'),
    setupGrid: $('setupGrid'),
    setupAxisCols: $('setupAxisCols'),
    setupAxisRows: $('setupAxisRows'),
    shipManifest: $('shipManifest'),
    rotateBtn: $('rotateBtn'),
    rotateText: $('rotateText'),
    shuffleBtn: $('shuffleBtn'),
    clearBtn: $('clearBtn'),
    startBattleBtn: $('startBattleBtn'),
    combatTickerText: $('combatTickerText'),
    tickerBlip: $('tickerBlip'),
    defensePip: $('defensePip'),
    harborIntegrity: $('harborIntegrity'),
    playerMiniGrid: $('playerMiniGrid'),
    enemyRadarGrid: $('enemyRadarGrid'),
    battleAxisCols: $('battleAxisCols'),
    battleAxisRows: $('battleAxisRows'),
    enemySunkCount: $('enemySunkCount'),
    playerSunkCount: $('playerSunkCount'),
    enemyShipPips: $('enemyShipPips'),
    playerShipPips: $('playerShipPips'),
    debriefBanner: $('debriefBanner'),
    debriefSubtitle: $('debriefSubtitle'),
    statTurns: $('statTurns'),
    statAccuracy: $('statAccuracy'),
    statSurvivors: $('statSurvivors'),
    rematchBtn: $('rematchBtn'),
    redeployBtn: $('redeployBtn'),
    soundToggleBtn: $('soundToggleBtn'),
    soundLabel: $('soundLabel'),
    menuOpenBtn: $('menuOpenBtn'),
    optionsResumeBtn: $('optionsResumeBtn'),
    optionsSurrenderBtn: $('optionsSurrenderBtn'),
    optionsSoundToggle: $('optionsSoundToggle'),
    optionsDifficulty: $('optionsDifficulty'),
  };

  // --- Grid Construction ---
  function buildAxes() {
    [dom.setupAxisCols, dom.battleAxisCols].forEach(el => {
      el.innerHTML = '';
      COLS.forEach(c => {
        const s = document.createElement('span');
        s.textContent = c;
        el.appendChild(s);
      });
    });

    [dom.setupAxisRows, dom.battleAxisRows].forEach(el => {
      el.innerHTML = '';
      for (let i = 1; i <= GRID_SIZE; i++) {
        const s = document.createElement('span');
        s.textContent = i;
        el.appendChild(s);
      }
    });
  }

  function buildGrids() {
    // Screen 1 Setup Grid
    dom.setupGrid.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => onSetupCellClick(r, c));
        cell.addEventListener('pointerenter', () => onSetupCellHover(r, c));
        dom.setupGrid.appendChild(cell);
      }
    }
    dom.setupGrid.addEventListener('pointerleave', clearSetupPreview);

    // Screen 2 Main Radar Grid
    dom.enemyRadarGrid.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => onRadarFireClick(r, c));
        dom.enemyRadarGrid.appendChild(cell);
      }
    }

    // Screen 2 Defense Harbor Mini-Map (PIP)
    dom.playerMiniGrid.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'pip-cell';
        dom.playerMiniGrid.appendChild(cell);
      }
    }
  }

  // --- Screen 1 Placement Mechanics ---
  function getActiveShipToPlace() {
    if (state.selectedShipId) {
      const s = state.player.ships.find(ship => ship.id === state.selectedShipId);
      if (s) return s;
    }
    return state.player.ships.find(s => !s.placed) || null;
  }

  function clearSetupPreview() {
    const list = dom.setupGrid.querySelectorAll('.preview-valid, .preview-invalid');
    list.forEach(el => el.classList.remove('preview-valid', 'preview-invalid'));
  }

  function onSetupCellHover(r, c) {
    clearSetupPreview();
    const ship = getActiveShipToPlace();
    if (!ship) return;

    const pts = getShipPoints(r, c, ship.size, state.orientation);
    const valid = canPlace(state.player, r, c, ship.size, state.orientation, ship.id);

    pts.forEach(p => {
      if (inBounds(p.r, p.c)) {
        const cellEl = dom.setupGrid.children[p.r * GRID_SIZE + p.c];
        cellEl.classList.add(valid ? 'preview-valid' : 'preview-invalid');
      }
    });
  }

  function onSetupCellClick(r, c) {
    const clickedCell = state.player.grid[r][c];

    // Clicked an existing ship segment on the board -> pick it up to relocate
    if (clickedCell.shipId) {
      const ship = state.player.ships.find(s => s.id === clickedCell.shipId);
      if (ship) {
        ship.placed = false;
        ship.coords.forEach(p => { state.player.grid[p.r][p.c].shipId = null; });
        ship.coords = [];
        state.selectedShipId = ship.id;
        sfx.play('beep');
        renderSetup();
        onSetupCellHover(r, c);
        return;
      }
    }

    const shipToPlace = getActiveShipToPlace();
    if (!shipToPlace) return;

    if (canPlace(state.player, r, c, shipToPlace.size, state.orientation, shipToPlace.id)) {
      placeShip(state.player, shipToPlace, r, c, state.orientation);
      sfx.play('place');

      // Auto-advance to next unplaced ship
      const nextUnplaced = state.player.ships.find(s => !s.placed);
      state.selectedShipId = nextUnplaced ? nextUnplaced.id : null;

      clearSetupPreview();
      renderSetup();
    }
  }

  function renderManifest() {
    dom.shipManifest.innerHTML = '';
    const currentActive = getActiveShipToPlace();

    state.player.ships.forEach(s => {
      const card = document.createElement('div');
      card.className = 'manifest-ship';
      if (s.placed) card.classList.add('placed');
      if (currentActive && currentActive.id === s.id) card.classList.add('active');

      const name = document.createElement('span');
      name.className = 'manifest-name';
      name.textContent = `${s.name.substring(0, 4).toUpperCase()} (${s.size})`;

      const pips = document.createElement('div');
      pips.className = 'manifest-pips';
      for (let i = 0; i < s.size; i++) {
        const pip = document.createElement('span');
        pip.className = 'manifest-pip';
        pips.appendChild(pip);
      }

      card.appendChild(name);
      card.appendChild(pips);

      card.addEventListener('click', () => {
        state.selectedShipId = s.id;
        sfx.play('beep');
        renderSetup();
      });

      dom.shipManifest.appendChild(card);
    });
  }

  function renderSetup() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cellEl = dom.setupGrid.children[r * GRID_SIZE + c];
        const data = state.player.grid[r][c];
        cellEl.className = 'cell' + (data.shipId ? ' ship-segment' : '');
      }
    }

    renderManifest();

    const allPlaced = state.player.ships.every(s => s.placed);
    dom.startBattleBtn.disabled = !allPlaced;

    if (allPlaced) {
      dom.setupInstruction.textContent = 'ALL SHIPS DEPLOYED // READY FOR COMBAT';
    } else {
      const current = getActiveShipToPlace();
      dom.setupInstruction.textContent = current
        ? `POSITION ${current.name.toUpperCase()} (${current.size} CELLS)`
        : 'POSITION SQUADRON';
    }
  }

  // --- Countdown Transition ---
  function startLaunchSequence() {
    state.screen = 'countdown';
    dom.countdownCurtain.classList.remove('hidden');

    let count = 3;
    dom.countdownDigit.textContent = count;
    sfx.play('beep');

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        dom.countdownDigit.textContent = count;
        sfx.play('beep');
      } else {
        clearInterval(interval);
        sfx.play('klaxon');
        dom.countdownCurtain.classList.add('hidden');
        enterBattleScreen();
      }
    }, 650);
  }

  function enterBattleScreen() {
    state.screen = 'battle';
    state.turn = 'player';
    dom.screenSetup.classList.remove('active');
    dom.screenBattle.classList.add('active');

    // Place enemy fleet secretly
    autoPlaceAll(state.enemy);

    setCombatTicker('RADAR ONLINE // ENGAGE HOSTILE SECTOR', false);
    renderBattle();
  }

  // --- Screen 2: Combat Loop ---
  function onRadarFireClick(r, c) {
    if (state.screen !== 'battle' || state.turn !== 'player') return;

    const cell = state.enemy.grid[r][c];
    if (cell.shot) return; // Sector already attacked

    cell.shot = true;
    state.stats.shots++;
    state.turn = 'busy';

    if (cell.shipId) {
      state.stats.hits++;
      const ship = state.enemy.ships.find(s => s.id === cell.shipId);
      ship.hits++;

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        setCombatTicker(`CONFIRMED: HOSTILE ${ship.name.toUpperCase()} SCUTTLED!`, true);
      } else {
        sfx.play('hit');
        setCombatTicker(`DIRECT IMPACT ON HOSTILE HULL AT [${COLS[c]}${r + 1}]!`);
      }
    } else {
      sfx.play('miss');
      setCombatTicker(`SALVO SPLASH AT [${COLS[c]}${r + 1}] // NO CONTACT.`);
    }

    renderBattle();

    if (checkEndCondition()) return;

    // Enemy AI Turn
    state.turn = 'enemy';
    setTimeout(executeAITurn, 550);
  }

  // --- Strategic AI Engine ---
  function executeAITurn() {
    if (state.screen !== 'battle') return;

    let target = null;
    const diff = state.difficulty;

    // 1. Target Queue (Normal & Hard)
    while (state.ai.targetQueue.length > 0) {
      const candidate = state.ai.targetQueue.shift();
      if (inBounds(candidate.r, candidate.c) && !state.player.grid[candidate.r][candidate.c].shot) {
        target = candidate;
        break;
      }
    }

    // 2. Parity Checkerboard Hunt (Hard Mode only)
    if (!target && diff === 'hard') {
      const parityCells = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!state.player.grid[r][c].shot && (r + c) % 2 === 0) {
            parityCells.push({ r, c });
          }
        }
      }
      if (parityCells.length > 0) {
        target = parityCells[Math.floor(Math.random() * parityCells.length)];
      }
    }

    // 3. Random Untouched Sector Fallback
    if (!target) {
      const untouched = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!state.player.grid[r][c].shot) untouched.push({ r, c });
        }
      }
      target = untouched[Math.floor(Math.random() * untouched.length)];
    }

    if (!target) return;

    const cell = state.player.grid[target.r][target.c];
    cell.shot = true;

    if (cell.shipId) {
      const ship = state.player.ships.find(s => s.id === cell.shipId);
      ship.hits++;

      if (ship.hits >= ship.size) {
        ship.sunk = true;
        sfx.play('sunk');
        setCombatTicker(`WARNING: OUR ${ship.name.toUpperCase()} HAS BEEN SUNK!`, true);
        state.ai.currentChain = [];
      } else {
        sfx.play('hit');
        setCombatTicker(`HOSTILE FIRE STRUCK OUR SHIP AT [${COLS[target.c]}${target.r + 1}]!`, true);
        state.ai.currentChain.push(target);
      }

      // Add adjacent orthogonal coordinates into target queue
      if (diff !== 'easy') {
        const neighbors = [
          { r: target.r - 1, c: target.c },
          { r: target.r + 1, c: target.c },
          { r: target.r, c: target.c - 1 },
          { r: target.r, c: target.c + 1 }
        ];

        neighbors.forEach(n => {
          if (inBounds(n.r, n.c) && !state.player.grid[n.r][n.c].shot) {
            state.ai.targetQueue.push(n);
          }
        });
      }
    } else {
      sfx.play('miss');
      setCombatTicker(`HOSTILE SALVO MISSED AT [${COLS[target.c]}${target.r + 1}].`);
    }

    state.stats.turns++;
    renderBattle();

    if (checkEndCondition()) return;

    state.turn = 'player';
  }

  // --- End of Battle Evaluation ---
  function checkEndCondition() {
    const enemyAllSunk = state.enemy.ships.every(s => s.sunk);
    const playerAllSunk = state.player.ships.every(s => s.sunk);

    if (enemyAllSunk || playerAllSunk) {
      state.screen = 'over';

      if (enemyAllSunk) {
        sfx.play('win');
        dom.debriefBanner.textContent = 'VICTORY';
        dom.debriefBanner.className = 'debrief-banner';
        dom.debriefSubtitle.textContent = 'Hostile fleet neutralized. Theater secured.';
      } else {
        sfx.play('miss');
        dom.debriefBanner.textContent = 'DEFEAT';
        dom.debriefBanner.className = 'debrief-banner defeat';
        dom.debriefSubtitle.textContent = 'Defensive perimeter lost. Harbor scuttled.';
      }

      const acc = state.stats.shots > 0 ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
      dom.statTurns.textContent = state.stats.turns;
      dom.statAccuracy.textContent = `${acc}%`;
      dom.statSurvivors.textContent = `${state.player.ships.filter(s => !s.sunk).length}/5`;

      dom.gameOverModal.classList.remove('hidden');
      return true;
    }
    return false;
  }

  function setCombatTicker(msg, isDanger = false) {
    dom.combatTickerText.textContent = msg;
    dom.tickerBlip.classList.toggle('danger', isDanger);
  }

  // --- Render Battle Screen: Main Offensive Grid & Defense Mini-Map ---
  function renderBattle() {
    // 1. Hostile Radar (Main Board)
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cellData = state.enemy.grid[r][c];
        const cellEl = dom.enemyRadarGrid.children[r * GRID_SIZE + c];
        cellEl.className = 'cell';

        if (cellData.shot) {
          if (cellData.shipId) {
            const ship = state.enemy.ships.find(s => s.id === cellData.shipId);
            cellEl.classList.add(ship && ship.sunk ? 'sunk' : 'hit');
          } else {
            cellEl.classList.add('miss');
          }
        }
      }
    }

    // 2. Corner Harbor Mini-Map (PIP)
    let playerHitsTaken = 0;
    const totalSegments = 17; // 5 + 4 + 3 + 3 + 2

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const cellData = state.player.grid[r][c];
        const pipEl = dom.playerMiniGrid.children[r * GRID_SIZE + c];
        pipEl.className = 'pip-cell';

        if (cellData.shipId) pipEl.classList.add('ship');
        if (cellData.shot) {
          if (cellData.shipId) {
            pipEl.classList.add('hit');
            playerHitsTaken++;
          } else {
            pipEl.classList.add('miss');
          }
        }
      }
    }

    const healthLeft = Math.max(0, Math.round(((totalSegments - playerHitsTaken) / totalSegments) * 100));
    dom.harborIntegrity.textContent = `${healthLeft}%`;

    // 3. Fleet Hull Status Roster
    const renderHullPips = (fleet, container, isEnemy = false) => {
      container.innerHTML = '';
      fleet.ships.forEach(s => {
        const p = document.createElement('div');
        p.className = 'fleet-pip' + (isEnemy ? ' enemy-pip' : '') + (s.sunk ? ' sunk' : '');
        p.title = `${s.name} (${s.size})`;
        container.appendChild(p);
      });
    };

    renderHullPips(state.enemy, dom.enemyShipPips, true);
    renderHullPips(state.player, dom.playerShipPips, false);

    const enemySunk = state.enemy.ships.filter(s => s.sunk).length;
    const playerSunk = state.player.ships.filter(s => s.sunk).length;
    dom.enemySunkCount.textContent = `${enemySunk}/5 SUNK`;
    dom.playerSunkCount.textContent = `${playerSunk}/5 SUNK`;
  }

  // --- Reset & Redeployment Flows ---
  function resetGame(keepFleet = false) {
    state.screen = 'setup';
    state.turn = 'player';
    state.stats = { shots: 0, hits: 0, turns: 0 };
    state.ai = { targetQueue: [], currentChain: [] };

    dom.gameOverModal.classList.add('hidden');
    dom.optionsModal.classList.add('hidden');
    dom.screenBattle.classList.remove('active');
    dom.screenSetup.classList.add('active');

    if (!keepFleet) {
      autoPlaceAll(state.player);
      state.selectedShipId = null;
    } else {
      // Retain placements, reset hit markers
      state.player.ships.forEach(s => { s.hits = 0; s.sunk = false; });
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          state.player.grid[r][c].shot = false;
        }
      }
    }

    renderSetup();
  }

  // --- Event Bindings ---
  function wireEvents() {
    // Rotation
    dom.rotateBtn.addEventListener('click', () => {
      state.orientation = state.orientation === 'h' ? 'v' : 'h';
      dom.rotateText.textContent = state.orientation === 'h' ? 'ROT: HORIZ' : 'ROT: VERT';
      sfx.play('beep');
    });

    // Shuffle
    dom.shuffleBtn.addEventListener('click', () => {
      autoPlaceAll(state.player);
      state.selectedShipId = null;
      sfx.play('beep');
      renderSetup();
    });

    // Clear
    dom.clearBtn.addEventListener('click', () => {
      clearFleet(state.player);
      state.selectedShipId = state.player.ships[0].id;
      sfx.play('beep');
      renderSetup();
    });

    // Launch Battle
    dom.startBattleBtn.addEventListener('click', () => {
      if (!state.player.ships.every(s => s.placed)) return;
      startLaunchSequence();
    });

    // Rematch & Redeploy
    dom.rematchBtn.addEventListener('click', () => {
      resetGame(true);
      startLaunchSequence();
    });

    dom.redeployBtn.addEventListener('click', () => {
      resetGame(false);
    });

    // Options Modal
    dom.menuOpenBtn.addEventListener('click', () => {
      dom.optionsModal.classList.remove('hidden');
    });

    dom.optionsResumeBtn.addEventListener('click', () => {
      dom.optionsModal.classList.add('hidden');
    });

    dom.optionsSurrenderBtn.addEventListener('click', () => {
      dom.optionsModal.classList.add('hidden');
      resetGame(false);
    });

    // Difficulty Settings
    dom.optionsDifficulty.addEventListener('change', (e) => {
      state.difficulty = e.target.value;
    });

    // Sound Controls
    const toggleSound = () => {
      sfx.enabled = !sfx.enabled;
      localStorage.setItem('bts_snd', sfx.enabled);
      dom.soundLabel.textContent = sfx.enabled ? 'SND: ON' : 'SND: OFF';
      dom.optionsSoundToggle.textContent = sfx.enabled ? 'ENABLED' : 'MUTED';
      if (sfx.enabled) sfx.play('beep');
    };

    dom.soundToggleBtn.addEventListener('click', toggleSound);
    dom.optionsSoundToggle.addEventListener('click', toggleSound);

    // Audio Context Unlock
    const unlock = () => {
      sfx.init();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
  }

  // --- Initializer ---
  function init() {
    buildAxes();
    buildGrids();
    wireEvents();

    dom.soundLabel.textContent = sfx.enabled ? 'SND: ON' : 'SND: OFF';
    dom.optionsSoundToggle.textContent = sfx.enabled ? 'ENABLED' : 'MUTED';
    dom.optionsDifficulty.value = state.difficulty;

    resetGame(false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();