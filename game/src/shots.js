/* NIGHT FALCON — shots.js: deterministic staged screenshot scenes (?shot=1..4).
   Each scene is a real render of this game's own code: a fixed mission state
   drawn through the same drawFlight / drawHangar path the player sees. */
(function () {
  var R = window.NF_RENDER;
  var W = window.NF_WORLD;
  var CFG = window.NF_CONFIG;

  function baseState(missionId, upg) {
    var m = CFG.missions[missionId - 1];
    var stt = W.startMission(m, upg || {});
    stt.timer = 87;
    stt.time = 87;
    return stt;
  }

  function lockOn(stt, idx) {
    var e = stt.enemies[idx || 0];
    e.revealed = true;
    stt.lockTarget = e;
    stt.lock = 1;
    return e;
  }

  function drawShot(ctx, n, t) {
    var stt;
    if (n === 1) {
      // 1-night-cockpit.jpg — cockpit view at night mid-dogfight, enemy exploding
      // dead ahead, flares lighting the sea.
      stt = baseState(2, {});
      stt.player.alt = 11800; stt.player.speed = 512; stt.player.heading = 94;
      stt.player.fuel = 78; stt.player.hull = 92; stt.player.missiles = 4; stt.player.flares = 5;
      stt.kills = 2;
      stt.enemies[0].x = 0.05; stt.enemies[0].y = -0.03; stt.enemies[0].revealed = true;
      stt.enemies[0].alive = false;
      stt.enemies[1].x = -0.30; stt.enemies[1].y = -0.12; stt.enemies[1].revealed = true;
      stt.enemies[2].x = 0.34; stt.enemies[2].y = -0.18; stt.enemies[2].revealed = true;
      stt.routeProgress = 0.66;
      stt.explosions.push(W.makeExplosion(660, 320, true));
      stt.explosions[0].t = 0.35;
      stt.explosions[0].parts.forEach(function (pp) { pp.x += pp.vx * 0.35; pp.y += pp.vy * 0.35; });
      stt.flares.push({ x: 380, y: 430, t: 0.4 });
      stt.flares.push({ x: 920, y: 460, t: 0.7 });
      stt.radio = 'Bandit down! Kite, tally two more on the scope.';
      stt.radioWho = 'KITE'; stt.radioT = 5;
      lockOn(stt, 1);
      R.drawFlight(ctx, stt, 1.2, 'cockpit');
    } else if (n === 2) {
      // 2-deck-launch.jpg — chase view at night, jet launching off the carrier
      // deck with runway lights and afterburners, moonlit sea ahead.
      stt = baseState(1, {});
      stt.player.alt = 320; stt.player.speed = 148; stt.player.heading = 90;
      stt.player.afterburner = true; stt.player.throttle = 1;
      stt.player.fuel = 100; stt.player.hull = 100;
      stt.enemies[0].x = 0.22; stt.enemies[0].y = -0.22; stt.enemies[0].revealed = true;
      stt.enemies[1].x = -0.3; stt.enemies[1].y = 0.1; stt.enemies[1].revealed = true;
      stt.routeProgress = 0.12;
      stt.radio = 'Catapult is hot — good launch, Night-1.';
      stt.radioWho = 'TOWER'; stt.radioT = 5;
      R.drawFlight(ctx, stt, 1.2, 'chase');
    } else if (n === 3) {
      // 3-night-sea-strike.jpg — combat HUD, red lock-on brackets, missile in
      // flight over the moonlit sea, lit ships below.
      stt = baseState(3, {});
      stt.player.alt = 9400; stt.player.speed = 488; stt.player.heading = 112;
      stt.player.fuel = 66; stt.player.hull = 84; stt.player.missiles = 3; stt.player.flares = 4;
      stt.kills = 3;
      stt.enemies[0].x = -0.18; stt.enemies[0].y = -0.1; stt.enemies[0].revealed = true;
      stt.enemies[1].x = 0.3; stt.enemies[1].y = 0.16; stt.enemies[1].revealed = true;
      stt.enemies[2].x = 0.42; stt.enemies[2].y = -0.24; stt.enemies[2].revealed = true;
      stt.enemies[3].x = -0.42; stt.enemies[3].y = 0.22; stt.enemies[3].revealed = true;
      // Boats clear of the player jet and both bottom panels so their labels stay legible.
      stt.boats[0].x = -0.62; stt.boats[0].y = 0.1;
      stt.boats[1].x = -0.35; stt.boats[1].y = 0.35;
      stt.routeProgress = 0.5;
      var tgt = lockOn(stt, 0);
      stt.missiles.push({ x: 590, y: 380, px: 640, py: 520,
        target: tgt, t0: 0 });
      stt.radio = 'Searchlight has him! Fox two — missile away!';
      stt.radioWho = 'KITE'; stt.radioT = 5;
      R.drawFlight(ctx, stt, 1.2, 'chase');
    } else if (n === 4) {
      // 4-night-hangar.jpg — home/hangar screen at night with the jet,
      // loadout cards, crew, and the three save slots.
      var save = {
        pilot: 'Night-1', credits: 2450, unlocked: [1, 2, 3, 4],
        grades: { 1: 'S', 2: 'A', 3: 'B' },
        upgrades: { missiles: 2, flares: 1, armor: 1 },
        slots: [
          { pilot: 'Night-1', credits: 2450, grades: { 1: 'S', 2: 'A', 3: 'B' }, upgrades: { missiles: 2 } },
          { pilot: 'Night-1', credits: 900, grades: { 1: 'A' }, upgrades: {} },
          null
        ],
        slot: 0, bestGrade: 'S'
      };
      R.drawHangar(ctx, save, 11, 1.2);
    }
  }

  window.NF_SHOTS = { drawShot: drawShot };
})();
