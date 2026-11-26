/* NIGHT FALCON — main.js: game loop, screens, input, save slots, scoring.
   Classic script, no imports. Exposes window.NF for the playtest harness. */
(function () {
  var CFG = window.NF_CONFIG;
  var R = window.NF_RENDER;
  var W = window.NF_WORLD;
  var AU = window.NF_AUDIO;
  var SAVE_KEY = 'night-falcon-save-v1';

  var canvas, ctx;
  var screen = 'title'; // title | hangar | briefing | flight | pause | results | gameover | help
  var prevScreen = 'title';
  var save = null;
  var sel = 0; // hangar selection: 0-5 missions, 10-16 upgrades
  var st = null; // live mission state
  var cam = 'cockpit';
  var keys = {};
  var t = 0;
  var last = 0;
  var shotMode = null;
  var results = null;
  var gameOverReason = '';
  var radioQueue = [];
  var muted = false;

  function defaultSave() {
    return { pilot: 'Night-1', credits: 500, unlocked: [1], grades: {}, upgrades: {},
      slots: [null, null, null], slot: 0, bestGrade: null };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s.credits === 'number') return s;
      }
    } catch (e) {}
    return defaultSave();
  }

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function saveToSlot(i) {
    save.slots[i] = { pilot: save.pilot, credits: save.credits,
      unlocked: save.unlocked.slice(), grades: Object.assign({}, save.grades),
      upgrades: Object.assign({}, save.upgrades), bestGrade: save.bestGrade };
    save.slot = i;
    persist();
  }

  function loadFromSlot(i) {
    var s = save.slots[i];
    if (!s) return false;
    save.pilot = s.pilot; save.credits = s.credits;
    save.unlocked = s.unlocked.slice();
    save.grades = Object.assign({}, s.grades);
    save.upgrades = Object.assign({}, s.upgrades);
    save.bestGrade = s.bestGrade;
    persist();
    return true;
  }

  function gradeFor(stt) {
    var acc = stt.shots ? Math.round(stt.hits / stt.shots * 100) : 100;
    var timeBonus = Math.max(0, 300 - Math.floor(stt.timer));
    var score = stt.kills * 100 + acc + timeBonus + Math.round(stt.player.hull);
    if (score >= 520 && acc >= 60) return 'S';
    if (score >= 420) return 'A';
    if (score >= 320) return 'B';
    return 'C';
  }

  function startMission(i) {
    var m = CFG.missions[i];
    st = W.startMission(m, save.upgrades);
    cam = 'cockpit';
    screen = 'flight';
    AU.ensure(); AU.stopTheme(); AU.engine(0.7, true);
    say('TOWER', m.tower, 6);
    setTimeout(function () { if (screen === 'flight') say('STARLING', CFG.people.commander.line, 5); }, 6500);
    if (m.id === 6) setTimeout(function () {
      if (screen === 'flight') say('GHOST', CFG.people.ghost.line, 6);
    }, 12000);
  }

  function say(who, line, secs) {
    if (!st) return;
    st.radio = line; st.radioWho = who; st.radioT = secs;
    AU.radio();
  }

  function winMission() {
    if (!st || st.won) return;
    st.won = true;
    var g = gradeFor(st);
    var credits = st.mission.reward + st.kills * 100;
    save.credits += credits;
    save.grades[st.mission.id] = g;
    if (st.mission.id < 6 && save.unlocked.indexOf(st.mission.id + 1) < 0) save.unlocked.push(st.mission.id + 1);
    var order = ['C', 'B', 'A', 'S'];
    if (!save.bestGrade || order.indexOf(g) > order.indexOf(save.bestGrade)) save.bestGrade = g;
    persist();
    AU.engine(0, false);
    results = { mission: st.mission, grade: g, kills: st.kills,
      accuracy: st.shots ? Math.round(st.hits / st.shots * 100) : 100,
      time: st.timer, credits: credits, allGrades: Object.assign({}, save.grades) };
    screen = 'results';
  }

  function loseMission(reason) {
    if (!st || st.lost) return;
    st.lost = true;
    gameOverReason = reason;
    AU.engine(0, false);
    AU.explosion();
    screen = 'gameover';
  }

  function buyUpgrade(i) {
    var u = CFG.upgrades[i];
    if (!u) return false;
    var lv = save.upgrades[u.id] || 0;
    if (lv >= u.max) return false;
    var price = u.price * (lv + 1);
    if (save.credits < price) return false;
    save.credits -= price;
    save.upgrades[u.id] = lv + 1;
    persist();
    AU.click();
    return true;
  }

  // ---- flight simulation step ----
  function step(dt) {
    if (!st || screen !== 'flight') return;
    t += dt;
    st.time += dt; st.timer += dt;
    var p = st.player;
    var up = keys['ArrowUp'] || keys['w'] || keys['W'];
    var dn = keys['ArrowDown'] || keys['s'] || keys['S'];
    var lf = keys['ArrowLeft'] || keys['a'] || keys['A'];
    var rt = keys['ArrowRight'] || keys['d'] || keys['D'];
    p.afterburner = !!(keys['Shift']);
    if (up) p.y -= dt * 0.55;
    if (dn) p.y += dt * 0.55;
    if (lf) { p.x -= dt * 0.6; p.heading = Math.max(30, p.heading - dt * 22); }
    if (rt) { p.x += dt * 0.6; p.heading = Math.min(150, p.heading + dt * 22); }
    p.x = Math.max(-1, Math.min(1, p.x));
    p.y = Math.max(-1, Math.min(1, p.y));
    if (!up && !dn) p.y *= (1 - dt * 0.4);
    if (!lf && !rt) p.heading += (90 - p.heading) * dt * 0.4;
    // Speed / altitude.
    var targetSpeed = p.afterburner ? p.topSpeed : 420;
    p.speed += (targetSpeed - p.speed) * dt * 0.8;
    p.throttle = Math.min(1, 0.55 + (p.speed - 300) / 400 + (p.afterburner ? 0.25 : 0));
    if (st.mission.id === 1 && st.time < 6) {
      p.alt = Math.min(12000, p.alt + dt * 2600);
      p.speed = Math.min(p.speed, 120 + st.time * 90);
    } else {
      p.alt += (12000 - p.alt) * dt * 0.2;
    }
    // Fuel: afterburner burns faster.
    p.fuel -= dt * (p.afterburner ? 2.6 : 0.55);
    if (p.fuel <= 0) { p.fuel = 0; AU.splash(); loseMission('Out of fuel over the dark sea — the jet glided down into the waves.'); return; }
    // Lock: nearest revealed target near centre builds lock — enemies and
    // missile boats alike (boats use the same screen mapping as the render).
    var targets = [];
    st.enemies.forEach(function (e) { if (e.alive) targets.push(e); });
    st.boats.forEach(function (b) {
      if (b.alive) targets.push({ x: b.x, y: 0.40 + b.y * 0.07, boat: b, kind: 'boat',
        hp: b.hp, alive: true });
    });
    var best = null, bestD = 1e9;
    targets.forEach(function (tg) {
      var d = Math.sqrt(tg.x * tg.x + tg.y * tg.y);
      if (d < bestD) { bestD = d; best = tg; }
    });
    st.lockTarget = bestD < 0.85 ? best : null;
    if (st.lockTarget) {
      st.lock = Math.min(1, st.lock + dt * 0.55 * p.lockRate * (1 - bestD));
      if (Math.random() < dt * 2) AU.lockBeep(st.lock);
    } else {
      st.lock = Math.max(0, st.lock - dt * 0.8);
    }
    // Enemies drift, make attack runs toward the centre (so a lock can build),
    // dodge, drop flares, shoot back.
    st.enemies.forEach(function (e) {
      if (!e.alive) return;
      e.x += e.vx * dt * e.speed * 2 + Math.sin(st.time * 0.7 + e.id) * 0.02 * dt;
      e.y += e.vy * dt * e.speed * 2;
      e.x += (0 - e.x) * 0.06 * dt;
      e.y += (0 - e.y) * 0.04 * dt;
      if (e.kind === 'ghost') {
        e.dodgeT -= dt;
        if (e.dodgeT <= 0) {
          e.vx = (Math.random() - 0.5) * 0.9; e.vy = (Math.random() - 0.5) * 0.5;
          e.dodgeT = 0.7 + Math.random() * 0.8;
          if (Math.random() < 0.4) { e.flareT = 0.8; st.lock = 0; }
          if (Math.random() < 0.35) {
            st.ghostTaunt++;
            say('GHOST', ['You fly like a cargo pilot.', 'Is that all, little falcon?',
              'The dark is mine.', 'Catch me if you can.'][st.ghostTaunt % 4], 3);
          }
        }
      }
      e.fireT -= dt;
      if (e.fireT <= 0 && Math.abs(e.x) < 0.7) {
        e.fireT = 3 + Math.random() * 3;
        p.hull -= e.kind === 'ghost' ? 8 : 4;
        AU.hit();
        say('KITE', 'Bandit firing on you — break!', 2.5);
        if (p.hull <= 0) { p.hull = 0; loseMission('Enemy fire tore through the hull — Night-1 went down in flames.'); return; }
      }
      if (e.flareT > 0) e.flareT -= dt;
      if (Math.abs(e.x) > 1.1) e.vx *= -1;
      if (Math.abs(e.y) > 0.9) e.vy *= -1;
    });
    // Boats shoot.
    st.boats.forEach(function (b) {
      if (!b.alive) return;
      b.fireT -= dt;
      if (b.fireT <= 0) {
        b.fireT = 4 + Math.random() * 2;
        p.hull -= 4; AU.hit();
        if (p.hull <= 0) { p.hull = 0; loseMission('A missile boat found its mark — Night-1 went down.'); return; }
      }
    });
    // Searchlights reveal hidden enemies.
    if (st.mission.weather === 'searchlights' || st.mission.weather === 'flares') {
      st.searchT += dt;
      st.enemies.forEach(function (e) {
        if (!e.alive) return;
        var beamX = 0.5 + Math.sin(st.searchT * 0.45 + e.id * 2.1) * 0.45;
        if (Math.abs(e.x - (beamX - 0.5) * 2) < 0.25) e.revealed = true;
      });
    }
    // Storm lightning.
    if (st.mission.weather === 'storm') {
      st.lightningT -= dt;
      if (st.lightningT <= 0) {
        st.lightningOn = true;
        st.lightningT = 2.5 + Math.random() * 3.5;
        setTimeout(function () { if (st) st.lightningOn = false; }, 160);
        st.enemies.forEach(function (e) { if (e.alive) e.revealed = true; });
      }
    }
    // Player missiles chase the locked target (enemy jet or missile boat).
    st.missiles.forEach(function (m) {
      var tgtAlive = m.target ? (m.target.boat ? m.target.boat.alive : m.target.alive) : false;
      if (!m.target || !tgtAlive) { m.dead = true; return; }
      var tx = 640 + m.target.x * 700, ty = 330 + m.target.y * 420;
      var dx = tx - m.x, dy = ty - m.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var sp = 620;
      m.x += dx / d * sp * dt; m.y += dy / d * sp * dt;
      if (d < 46) {
        m.dead = true;
        st.hits++;
        if (m.target.boat) {
          var boat = m.target.boat;
          boat.hp -= 1;
          if (boat.hp <= 0) {
            boat.alive = false;
            st.kills++;
            st.explosions.push(W.makeExplosion(tx, ty, true));
            AU.explosion();
            say('KITE', 'Missile boat is burning! One less gun on the water!', 3);
          }
        } else {
          m.target.hp -= 1;
          if (m.target.hp <= 0) {
            m.target.alive = false;
            st.kills++;
            st.explosions.push(W.makeExplosion(tx, ty, m.target.kind === 'cargo'));
            AU.explosion();
            say('KITE', m.target.kind === 'ghost' ? 'GHOST IS DOWN! The war is over!' : 'Splash one! Good kill, Night-1!', 3);
          }
        }
      }
    });
    st.missiles = st.missiles.filter(function (m) { return !m.dead && st.time - m.t0 < 6; });
    // Cannon bullets fly up-centre and hit near-centre enemies and boats.
    st.bullets.forEach(function (b) {
      b.y -= 900 * dt;
      st.enemies.forEach(function (e) {
        if (!e.alive) return;
        var ex = 640 + e.x * 700, ey = 330 + e.y * 420;
        if (Math.abs(b.x - ex) < 46 && Math.abs(b.y - ey) < 46) {
          b.dead = true;
          e.hp -= 1;
          st.hits++;
          if (e.hp <= 0) {
            e.alive = false; st.kills++;
            st.explosions.push(W.makeExplosion(ex, ey, e.kind === 'cargo'));
            AU.explosion();
          }
        }
      });
      st.boats.forEach(function (bt) {
        if (!bt.alive || b.dead) return;
        var bx = 640 + bt.x * 700, by = 500 + bt.y * 30;
        if (Math.abs(b.x - bx) < 40 && Math.abs(b.y - by) < 20) {
          b.dead = true;
          bt.hp -= 1;
          st.hits++;
          if (bt.hp <= 0) {
            bt.alive = false; st.kills++;
            st.explosions.push(W.makeExplosion(bx, by, true));
            AU.explosion();
          }
        }
      });
    });
    st.bullets = st.bullets.filter(function (b) { return !b.dead && b.y > 40; });
    // Boats die to missiles too (nearest boat when no enemy locked).
    // Explosions age.
    st.explosions.forEach(function (ex) {
      ex.t += dt;
      ex.parts.forEach(function (pp) { pp.x += pp.vx * dt; pp.y += pp.vy * dt; pp.vy += 60 * dt; });
    });
    st.explosions = st.explosions.filter(function (ex) { return ex.t < ex.dur; });
    st.flares.forEach(function (f) { f.t += dt; f.y += 30 * dt; });
    st.flares = st.flares.filter(function (f) { return f.t < 2.2; });
    // Route progress: kills + time.
    var total = st.enemies.length + st.boats.length;
    st.routeProgress = Math.min(1, (st.kills / Math.max(1, total)) * 0.8 + Math.min(0.2, st.timer / 300));
    if (st.radioT > 0) st.radioT -= dt;
    AU.engine(p.throttle, true);
    // Win check: all enemies (and boats) down.
    var alive = st.enemies.filter(function (e) { return e.alive; }).length +
      st.boats.filter(function (b) { return b.alive; }).length;
    if (alive === 0) winMission();
  }

  function fireMissile() {
    if (!st || screen !== 'flight' || st.player.missiles <= 0) return;
    if (st.lock < 1 || !st.lockTarget) return;
    st.player.missiles--;
    st.shots++;
    st.missiles.push({ x: 640 + st.player.x * 260, y: 560, px: 640 + st.player.x * 260, py: 560,
      target: st.lockTarget, t0: st.time });
    st.lock = 0;
    AU.missile();
  }

  function fireCannon() {
    if (!st || screen !== 'flight') return;
    st.shots++;
    st.bullets.push({ x: 640 + st.player.x * 260 + (Math.random() - 0.5) * 30, y: 520 });
    AU.cannon();
  }

  function dropFlare() {
    if (!st || screen !== 'flight' || st.player.flares <= 0) return;
    st.player.flares--;
    st.flares.push({ x: 640 + st.player.x * 260, y: 420, t: 0 });
    st.enemies.forEach(function (e) { e.revealed = true; });
    AU.flare();
    say('TOWER', 'Flare away — area lit, their locks are broken.', 2.5);
  }

  // ---- input ----
  function onKey(e) {
    var k = e.key;
    if (k === ' ') { e.preventDefault(); }
    keys[k] = true;
    if (k === 'm' || k === 'M') {
      muted = !muted; AU.setMuted(muted); return;
    }
    if (screen === 'title') {
      if (k === 'Enter') { screen = 'hangar'; AU.click(); AU.startTheme(); }
      else if (k === 'h' || k === 'H') { prevScreen = 'title'; screen = 'help'; }
      return;
    }
    if (screen === 'help') {
      if (k === 'Escape' || k === 'Enter' || k === 'h' || k === 'H') screen = prevScreen;
      return;
    }
    if (screen === 'hangar') {
      if (k >= '1' && k <= '6') { sel = Number(k) - 1; screen = 'briefing'; AU.click(); return; }
      if (k === 'ArrowUp') { sel = sel <= 0 ? 16 : (sel < 10 ? sel - 1 : sel - 1); if (sel < 0) sel = 0; AU.click(); return; }
      if (k === 'ArrowDown') { sel = sel >= 16 ? 16 : sel + 1; AU.click(); return; }
      if (k === 'b' || k === 'B') { if (sel >= 10) buyUpgrade(sel - 10); return; }
      if (k === 's' || k === 'S') { save.slot = (save.slot + 1) % 3; persist(); AU.click(); return; }
      if (k === 'g' || k === 'G') { saveToSlot(save.slot); AU.click(); return; }
      if (k === 'Enter') { screen = 'briefing'; AU.click(); return; }
      if (k === 'Escape') { screen = 'title'; return; }
      if (k === 'h' || k === 'H') { prevScreen = 'hangar'; screen = 'help'; return; }
      return;
    }
    if (screen === 'briefing') {
      if (k === 'Enter') { startMission(sel < 6 ? sel : 0); return; }
      if (k === 'Escape') { screen = 'hangar'; return; }
      return;
    }
    if (screen === 'flight') {
      if (k === 'p' || k === 'P') { screen = 'pause'; AU.engine(0, false); return; }
      if (k === 'v' || k === 'V') { cam = cam === 'cockpit' ? 'chase' : 'cockpit'; AU.click(); return; }
      if (k === 'f' || k === 'F') { fireMissile(); return; }
      if (k === 'c' || k === 'C') { dropFlare(); return; }
      if (k === ' ') { fireCannon(); return; }
      if (k === 'Escape') { screen = 'hangar'; AU.engine(0, false); return; }
      return;
    }
    if (screen === 'pause') {
      if (k === 'p' || k === 'P') { screen = 'flight'; AU.engine(0.7, true); return; }
      if (k === 'Escape') { screen = 'hangar'; AU.engine(0, false); return; }
      return;
    }
    if (screen === 'results') {
      if (k === 'r' || k === 'R' || k === 'Enter') {
        if (k === 'Enter' && results && results.mission.id < 6) {
          sel = results.mission.id; screen = 'briefing';
        } else { screen = 'hangar'; }
        return;
      }
      if (k === 'Escape') { screen = 'title'; return; }
      return;
    }
    if (screen === 'gameover') {
      if (k === 'r' || k === 'R') { screen = 'hangar'; return; }
      if (k === 'Escape') { screen = 'title'; return; }
      return;
    }
  }

  function onKeyUp(e) { keys[e.key] = false; }

  function onClick(e) {
    if (screen === 'flight') fireMissile();
  }

  // ---- render ----
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (screen === 'flight') step(dt);
    else t += dt;
    if (shotMode) { window.NF_SHOTS.drawShot(ctx, shotMode, t); return; }
    if (screen === 'title') R.drawTitle(ctx, t, save);
    else if (screen === 'hangar') R.drawHangar(ctx, save, sel, t);
    else if (screen === 'briefing') R.drawBriefing(ctx, CFG.missions[sel < 6 ? sel : 0], t);
    else if (screen === 'flight') R.drawFlight(ctx, st, t, cam);
    else if (screen === 'pause') { R.drawFlight(ctx, st, t, cam); R.drawPause(ctx); }
    else if (screen === 'results') R.drawResults(ctx, results);
    else if (screen === 'gameover') R.drawGameOver(ctx, gameOverReason);
    else if (screen === 'help') R.drawHelp(ctx);
  }

  function loop(now) {
    frame(now);
    if (!window.__NF_STOP_LOOP) requestAnimationFrame(loop);
  }

  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    save = loadSave();
    var params = new URLSearchParams(window.location.search || '');
    var shot = params.get('shot');
    if (shot) shotMode = Number(shot);
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('click', onClick);
    R.loadAssets(function () {
      if (shotMode) { window.NF_SHOTS.drawShot(ctx, shotMode, 1.2); return; }
      last = performance.now();
      requestAnimationFrame(loop);
    });
    // If assets never resolve (offline test), still start the loop.
    setTimeout(function () {
      if (!window.__NF_STARTED && !shotMode) {
        window.__NF_STARTED = true;
        last = performance.now();
        requestAnimationFrame(loop);
      }
    }, 2500);
  }

  window.NF = {
    init: init, frame: frame,
    get screen() { return screen; },
    get save() { return save; },
    get state() { return st; },
    get cam() { return cam; },
    setScreen: function (s) { screen = s; },
    setSel: function (i) { sel = i; },
    startMission: startMission,
    buyUpgrade: buyUpgrade,
    saveToSlot: saveToSlot,
    loadFromSlot: loadFromSlot,
    winMission: winMission,
    loseMission: loseMission,
    fireMissile: fireMissile,
    fireCannon: fireCannon,
    dropFlare: dropFlare,
    step: step,
    press: function (key) { onKey({ key: key, preventDefault: function () {} }); },
    release: function (key) { onKeyUp({ key: key }); },
    setKeys: function (k) { keys = k; },
    getKeys: function () { return keys; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
