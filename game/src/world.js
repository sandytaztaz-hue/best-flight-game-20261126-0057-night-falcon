/* NIGHT FALCON — world.js: seeded random, terrain, enemies, missiles, flares,
   explosions, ships. Pure simulation, no drawing. */
(function () {
  // Mulberry32 seeded RNG — deterministic per mission seed.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Moonlit sea: a scrolling band of wave glints + islands + ship lights.
  function makeSea(seed) {
    var r = rng(seed);
    var islands = [];
    for (var i = 0; i < 5; i++) islands.push({ x: r(), y: 0.55 + r() * 0.3, w: 0.06 + r() * 0.12, h: 0.02 + r() * 0.03 });
    var ships = [];
    for (var j = 0; j < 7; j++) ships.push({ x: r(), y: 0.62 + r() * 0.3, lit: r() > 0.3 });
    var glints = [];
    for (var k = 0; k < 90; k++) glints.push({ x: r(), y: 0.5 + r() * 0.48, s: 0.5 + r() * 2.2, tw: r() * 6.28 });
    return { islands: islands, ships: ships, glints: glints, moonX: 0.68, moonY: 0.14 };
  }

  function makeEnemy(kind, i, seed) {
    var r = rng(seed + i * 977);
    var base = {
      id: i, kind: kind, x: (r() - 0.5) * 0.9, y: (r() - 0.5) * 0.5,
      vx: (r() - 0.5) * 0.12, vy: (r() - 0.5) * 0.06,
      hp: kind === 'cargo' ? 2 : kind === 'ghost' ? 6 : 1,
      maxHp: kind === 'cargo' ? 2 : kind === 'ghost' ? 6 : 1,
      size: kind === 'cargo' ? 1.7 : kind === 'ghost' ? 1.1 : 1.0,
      speed: kind === 'cargo' ? 0.05 : kind === 'ghost' ? 0.22 : 0.14,
      alive: true, lockBreak: 0, flareT: 0, taunt: 0,
      dodgeT: 0, fireT: 2 + r() * 3, revealed: kind !== 'ghost'
    };
    if (kind === 'ghost') base.name = 'GHOST';
    return base;
  }

  function makeBoat(i, seed) {
    var r = rng(seed + 500 + i * 331);
    return { id: i, x: (r() - 0.5) * 1.1, y: 0.35 + r() * 0.2, hp: 1, alive: true, fireT: 3 + r() * 2 };
  }

  // One explosion: fireball + smoke + debris + wreck fall.
  function makeExplosion(x, y, big) {
    var parts = [];
    for (var i = 0; i < 26; i++) {
      var a = Math.random() * 6.283, sp = 40 + Math.random() * (big ? 260 : 160);
      parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0.6 + Math.random() * 0.9, max: 1.5, kind: Math.random() < 0.6 ? 'fire' : 'debris',
        s: 3 + Math.random() * 9 });
    }
    return { x: x, y: y, t: 0, dur: big ? 1.8 : 1.2, big: !!big, parts: parts, smoke: 0 };
  }

  window.NF_WORLD = {
    rng: rng,
    makeSea: makeSea,
    makeEnemy: makeEnemy,
    makeBoat: makeBoat,
    makeExplosion: makeExplosion,

    // Build a mission's live state from config + player upgrades.
    startMission: function (mission, upg) {
      var seed = mission.id * 7919 + 13;
      var enemies = [];
      for (var i = 0; i < mission.enemies; i++) enemies.push(makeEnemy(mission.kind, i, seed));
      var boats = [];
      for (var b = 0; b < (mission.boats || 0); b++) boats.push(makeBoat(b, seed));
      var lv = function (id) { return (upg && upg[id]) || 0; };
      return {
        mission: mission, seed: seed, sea: makeSea(seed),
        time: 0, timer: 0,
        player: {
          x: 0, y: 0, alt: mission.id === 1 ? 0 : 12000, speed: mission.id === 1 ? 0 : 420,
          heading: 90, throttle: 0.7, fuel: 100 + lv('tank') * 30,
          fuelMax: 100 + lv('tank') * 30, hull: 100 + lv('armor') * 40,
          hullMax: 100 + lv('armor') * 40,
          missiles: 6 + lv('missiles') * 2, flares: 6 + lv('flares') * 4,
          gunDmg: 10 + lv('cannon') * 8, lockRate: 1 + lv('radar') * 0.5,
          topSpeed: 620 + lv('engine') * 60, afterburner: false
        },
        enemies: enemies, boats: boats,
        missiles: [], bullets: [], explosions: [], flares: [],
        lock: 0, lockTarget: null, kills: 0, shots: 0, hits: 0,
        searchT: 0, lightningT: 0, lightningOn: false, rain: [],
        won: false, lost: false, loseReason: '', score: 0,
        routeProgress: 0, radio: '', radioT: 0, ghostTaunt: 0
      };
    }
  };
})();
