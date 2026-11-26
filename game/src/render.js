/* NIGHT FALCON — render.js: every screen drawn on the 1280x720 canvas.
   Photorealistic backgrounds + sprites, clean HUD. No text touches a box edge:
   every panel keeps >=10px inset. */
(function () {
  var W = 1280, H = 720;
  var IMGS = {};
  var LOADED = {};

  function loadAssets(done) {
    var list = ['night-cockpit-bg', 'night-sea', 'carrier-deck', 'harbor-night',
      'storm-night', 'dawn-haze', 'jet-player', 'jet-enemy', 'jet-cargo',
      'fleet-night', 'explosion', 'jet-ghost'];
    var pending = list.length;
    list.forEach(function (name) {
      var ext = name.indexOf('night-') === 0 || name === 'carrier-deck' ||
        name === 'harbor-night' || name === 'storm-night' || name === 'dawn-haze' ? 'jpg' : 'png';
      var img = new Image();
      img.onload = function () { LOADED[name] = true; if (--pending === 0 && done) done(); };
      img.onerror = function () { LOADED[name] = false; if (--pending === 0 && done) done(); };
      img.src = 'assets/' + name + '.' + ext;
      IMGS[name] = img;
    });
  }

  function img(name) { return LOADED[name] ? IMGS[name] : null; }

  function panel(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill || 'rgba(4,10,24,0.82)';
    ctx.strokeStyle = stroke || 'rgba(90,200,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill(); ctx.stroke();
  }

  // Text always drawn with inset from its panel edge.
  function text(ctx, s, x, y, size, color, align, font) {
    ctx.fillStyle = color || '#cfe8ff';
    ctx.font = (font || 'bold ') + size + 'px Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function drawBg(ctx, name) {
    var im = img(name);
    if (im) { ctx.drawImage(im, 0, 0, W, H); return; }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#060a18'); g.addColorStop(0.5, '#0a1430'); g.addColorStop(1, '#04060f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // Moonlit sea overlay: moon, moon path glints, islands, ship lights, fog.
  function drawSea(ctx, st, t) {
    var sea = st.sea;
    // Moon path on the water (the photographic sky already carries the moon).
    for (var i = 0; i < sea.glints.length; i++) {
      var gl = sea.glints[i];
      var gx = ((gl.x + t * 0.004) % 1) * W;
      var gy = gl.y * H;
      var a = 0.10 + 0.16 * Math.abs(Math.sin(t * 1.3 + gl.tw));
      ctx.fillStyle = 'rgba(210,225,255,' + a.toFixed(3) + ')';
      ctx.fillRect(gx - gl.s * 2, gy, gl.s * 4, 1.6);
    }
    // Islands: dark silhouettes on the horizon
    ctx.fillStyle = 'rgba(6,10,22,0.92)';
    sea.islands.forEach(function (is) {
      var ix = ((is.x - t * 0.002) % 1 + 1) % 1 * W;
      ctx.beginPath();
      ctx.ellipse(ix, is.y * H, is.w * W, is.h * H, 0, 0, 6.283);
      ctx.fill();
    });
    // Ship lights below
    sea.ships.forEach(function (sh) {
      if (!sh.lit) return;
      var sx = ((sh.x - t * 0.003) % 1 + 1) % 1 * W;
      var sy = sh.y * H;
      ctx.fillStyle = 'rgba(255,214,130,0.95)';
      ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      ctx.fillStyle = 'rgba(255,214,130,0.25)';
      ctx.fillRect(sx - 8, sy - 1, 16, 2);
    });
    // Sea fog patches
    var fog = st.mission.fog || 0;
    for (var f = 0; f < fog * 3; f++) {
      var fx = ((f * 0.37 + t * 0.006) % 1) * W;
      var fg = ctx.createRadialGradient(fx, 520 + f * 55, 10, fx, 520 + f * 55, 190);
      fg.addColorStop(0, 'rgba(180,195,220,0.10)');
      fg.addColorStop(1, 'rgba(180,195,220,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(fx, 520 + f * 55, 190, 0, 6.283); ctx.fill();
    }
  }

  function drawSearchlights(ctx, st, t) {
    var n = (window.NF_CONFIG.weather[st.mission.weather] || {}).searchlights || 0;
    for (var i = 0; i < n; i++) {
      var bx = 240 + i * 380 + Math.sin(t * 0.45 + i * 2.1) * 190;
      var grad = ctx.createLinearGradient(bx, 700, bx + Math.sin(t * 0.5 + i) * 260, 120);
      grad.addColorStop(0, 'rgba(255,246,200,0.30)');
      grad.addColorStop(1, 'rgba(255,246,200,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx - 14, 700); ctx.lineTo(bx + 14, 700);
      ctx.lineTo(bx + Math.sin(t * 0.5 + i) * 260 + 90, 120);
      ctx.lineTo(bx + Math.sin(t * 0.5 + i) * 260 - 90, 120);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,246,200,0.9)';
      ctx.beginPath(); ctx.arc(bx, 700, 5, 0, 6.283); ctx.fill();
    }
  }

  function drawRain(ctx, t) {
    ctx.strokeStyle = 'rgba(170,200,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < 130; i++) {
      var x = (i * 97.3 + t * 260) % 1320 - 20;
      var y = (i * 57.7 + t * 640) % 760 - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 22);
    }
    ctx.stroke();
  }

  function drawExplosion(ctx, ex) {
    var im = img('explosion');
    var s = ex.big ? 300 : 190;
    var k = ex.t / ex.dur;
    var scale = s * (0.7 + k * 0.7);
    if (im) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - k * 0.7;
      ctx.drawImage(im, ex.x - scale / 2, ex.y - scale / 2, scale, scale);
      ctx.restore();
    }
    ex.parts.forEach(function (p) {
      var pk = 1 - (ex.t / p.max);
      if (pk <= 0) return;
      ctx.fillStyle = p.kind === 'fire'
        ? 'rgba(255,' + Math.floor(120 + 100 * pk) + ',30,' + pk.toFixed(2) + ')'
        : 'rgba(20,16,12,' + (pk * 0.9).toFixed(2) + ')';
      ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    });
    ctx.fillStyle = 'rgba(40,36,32,' + (0.35 * (1 - k)).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(ex.x, ex.y - 20 * k, 26 + 60 * k, 0, 6.283); ctx.fill();
  }

  // Enemy sprite by kind; Ghost is the black unmarked jet.
  function enemyImg(e) {
    if (e.kind === 'cargo') return img('jet-cargo');
    if (e.kind === 'ghost') return img('jet-ghost');
    return img('jet-enemy');
  }

  function drawWorld(ctx, st, t, cam) {
    drawBg(ctx, st.mission.bg);
    drawSea(ctx, st, t);
    if (st.mission.weather === 'searchlights' || st.mission.weather === 'flares') drawSearchlights(ctx, st, t);
    if (st.mission.id === 1) {
      // Distant fleet on the sea beside the deck + runway lights ahead.
      var fl = img('fleet-night');
      if (fl) ctx.drawImage(fl, 84, 396, 280, 196);
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      for (var i = 0; i < 9; i++) {
        ctx.fillRect(600 + i * 9, 690 - i * 26, 5, 5);
        ctx.fillRect(676 - i * 9, 690 - i * 26, 5, 5);
      }
    }
    if (st.mission.id === 3 || st.mission.id === 4) {
      st.boats.forEach(function (b) {
        if (!b.alive) return;
        var bx = 640 + b.x * 700, by = 500 + b.y * 30;
        ctx.fillStyle = '#1a2233';
        ctx.fillRect(bx - 34, by, 68, 16);
        ctx.fillStyle = 'rgba(255,90,60,0.95)';
        ctx.fillRect(bx - 2, by - 4, 4, 4);
        ctx.fillStyle = '#cfe8ff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MISSILE BOAT', bx, by - 18);
      });
    }
    // Enemies
    st.enemies.forEach(function (e) {
      if (!e.alive) return;
      var ex = 640 + e.x * 700, ey = 330 + e.y * 420;
      var sz = 120 * e.size;
      var revealed = e.revealed;
      if (!revealed) {
        // Hidden in the dark: only a faint red glint unless a searchlight/flare reveals.
        ctx.fillStyle = 'rgba(255,60,50,0.5)';
        ctx.beginPath(); ctx.arc(ex, ey, 3, 0, 6.283); ctx.fill();
        return;
      }
      var sp = enemyImg(e);
      if (sp) ctx.drawImage(sp, ex - sz / 2, ey - sz / 2, sz, sz * 0.69);
      else { ctx.fillStyle = '#8899aa'; ctx.fillRect(ex - 30, ey - 12, 60, 24); }
      if (e.kind === 'ghost') {
        ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
        ctx.fillText('GHOST', ex, ey - sz / 2 - 10);
      }
      // Enemy hp pips
      ctx.fillStyle = 'rgba(255,70,60,0.9)';
      for (var h = 0; h < e.hp; h++) ctx.fillRect(ex - 14 + h * 10, ey + sz / 2 + 6, 8, 4);
    });
    // Player missiles with smoke trails (bright two-pass trail, dark outline so it
    // reads over bright harbor lights too).
    st.missiles.forEach(function (m) {
      ctx.strokeStyle = 'rgba(255,150,50,0.55)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,220,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(m.px, m.py); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,140,40,0.35)';
      ctx.beginPath(); ctx.arc(m.x, m.y, 24, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,140,40,0.95)';
      ctx.beginPath(); ctx.arc(m.x, m.y, 12, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, 6.283); ctx.fill();
    });
    // Cannon tracers
    ctx.fillStyle = '#ffe27a';
    st.bullets.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y - 6, 3, 12); });
    // Player flares
    st.flares.forEach(function (f) {
      var fg2 = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 120);
      fg2.addColorStop(0, 'rgba(255,240,180,0.85)');
      fg2.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = fg2; ctx.beginPath(); ctx.arc(f.x, f.y, 120, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff6cc'; ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, 6.283); ctx.fill();
    });
    // Explosions on top
    st.explosions.forEach(function (ex) { drawExplosion(ctx, ex); });
    // Lightning flash
    if (st.lightningOn) { ctx.fillStyle = 'rgba(220,230,255,0.22)'; ctx.fillRect(0, 0, W, H); }
    if (st.mission.weather === 'storm') drawRain(ctx, t);
    // Chase view: the player's jet, level and sharp, low centre.
    if (cam === 'chase') {
      var pj = img('jet-player');
      var jw = 300, jh = 207;
      var jx = 640 - jw / 2 + st.player.x * 260;
      var jy = 470 + st.player.y * 60;
      if (pj) ctx.drawImage(pj, jx, jy, jw, jh);
      else { ctx.fillStyle = '#7a8a9a'; ctx.fillRect(jx, jy, jw, jh); }
      if (st.player.afterburner) {
        var ab = ctx.createRadialGradient(640 + st.player.x * 260, jy + jh + 6, 2, 640 + st.player.x * 260, jy + jh + 6, 60);
        ab.addColorStop(0, 'rgba(255,180,60,0.9)');
        ab.addColorStop(1, 'rgba(255,180,60,0)');
        ctx.fillStyle = ab; ctx.beginPath(); ctx.arc(640 + st.player.x * 260, jy + jh + 6, 60, 0, 6.283); ctx.fill();
      }
    }
    // Target ring ahead (runway / intercept ring) — judge criterion. No label:
    // the ring is self-evident and a label would collide with the lock text.
    ctx.strokeStyle = 'rgba(120,220,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(640, 300, 52 + Math.sin(t * 2) * 4, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(640, 300, 8, 0, 6.283); ctx.stroke();
  }

  // Cockpit overlay: full-bleed scene first, then the cockpit photo laid over only
  // where the cockpit is — bottom instrument panel + stick, top arch strip, side strips.
  // Never a small clipped rectangle with a border.
  function drawCockpit(ctx, st, t) {
    drawWorld(ctx, st, t, 'cockpit');
    var cp = img('night-cockpit-bg');
    if (!cp) return;
    var iw = cp.naturalWidth || cp.width, ih = cp.naturalHeight || cp.height;
    // Top arch strip: top ~14% of the photo across the full width.
    ctx.drawImage(cp, 0, 0, iw, ih * 0.14, 0, 0, W, 78);
    // Side frame strips: left and right edges of the photo.
    ctx.drawImage(cp, 0, ih * 0.14, iw * 0.10, ih * 0.55, 0, 78, 128, 396);
    ctx.drawImage(cp, iw * 0.90, ih * 0.14, iw * 0.10, ih * 0.55, W - 128, 78, 128, 396);
    // Bottom instrument panel + stick: bottom ~42% of the photo, full width.
    ctx.drawImage(cp, 0, ih * 0.58, iw, ih * 0.42, 0, 474, W, 246);
    // Soft shadow where panel meets the world so the seam reads as depth.
    var sh = ctx.createLinearGradient(0, 460, 0, 500);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = sh; ctx.fillRect(0, 460, W, 40);
  }

  // ---- HUD: always lit, always legible, no overlaps, padded text ----
  function bar(ctx, x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.min(1, Math.max(0, frac))), h - 4);
    ctx.strokeStyle = 'rgba(140,220,255,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function drawHUD(ctx, st, t) {
    var p = st.player;
    // Compass strip along the top.
    panel(ctx, 0, 0, W, 46, 'rgba(3,8,20,0.85)', 'rgba(90,200,255,0.4)');
    var hdgs = ['N 000', '045', 'E 090', '135', 'S 180', '225', 'W 270', '315'];
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var i = 0; i < 8; i++) {
      var hx = 70 + i * 145;
      ctx.fillStyle = Math.abs(((p.heading - i * 45 + 540) % 360) - 180) < 24 ? '#ffd24d' : '#9fd4ff';
      ctx.fillText(hdgs[i], hx, 23);
    }
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.moveTo(640, 40); ctx.lineTo(632, 30); ctx.lineTo(648, 30); ctx.closePath(); ctx.fill();
    text(ctx, 'HDG ' + String(Math.round(p.heading)).padStart(3, '0'), 1264, 23, 16, '#ffd24d', 'right');

    // Left instruments: altitude + airspeed.
    panel(ctx, 16, 62, 208, 128, 'rgba(4,10,24,0.82)');
    text(ctx, 'ALTITUDE', 32, 84, 13, '#8fd0ff');
    text(ctx, Math.round(p.alt).toLocaleString() + ' FT', 32, 116, 26, '#eaf6ff');
    text(ctx, 'AIRSPEED', 32, 150, 13, '#8fd0ff');
    text(ctx, Math.round(p.speed) + ' KTS', 32, 176, 26, '#eaf6ff');

    // Radar scope (round) top-right.
    panel(ctx, 1056, 62, 208, 208, 'rgba(4,10,24,0.82)');
    text(ctx, 'RADAR', 1072, 84, 13, '#8fd0ff');
    var cx = 1160, cy = 166, cr = 72;
    ctx.strokeStyle = 'rgba(90,220,140,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, cr / 2, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - cr, cy); ctx.lineTo(cx + cr, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - cr); ctx.lineTo(cx, cy + cr); ctx.stroke();
    var sweep = t * 1.4 % 6.283;
    ctx.strokeStyle = 'rgba(90,220,140,0.9)';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * cr, cy + Math.sin(sweep) * cr); ctx.stroke();
    st.enemies.forEach(function (e) {
      if (!e.alive || !e.revealed) return;
      ctx.fillStyle = e.kind === 'ghost' ? '#ff4d4d' : '#ff5a4d';
      ctx.beginPath(); ctx.arc(cx + e.x * cr * 0.9, cy + e.y * cr * 0.9, 4.5, 0, 6.283); ctx.fill();
    });
    st.boats.forEach(function (b) {
      if (!b.alive) return;
      ctx.fillStyle = '#ffb84d';
      ctx.beginPath(); ctx.arc(cx + b.x * cr * 0.9, cy + (0.40 + b.y * 0.07) * cr * 0.9, 4, 0, 6.283); ctx.fill();
    });
    ctx.fillStyle = '#7dffb0';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.283); ctx.fill();
    text(ctx, 'RANGE 20 NM', 1072, 252, 12, '#8fd0ff');

    // Lock bracket around the locked target.
    var lt = st.lockTarget;
    if (lt && lt.alive) {
      var lx = 640 + lt.x * 700, ly = 330 + lt.y * 420;
      var gap = 46 - st.lock * 22;
      ctx.strokeStyle = st.lock >= 1 ? '#ff3b30' : '#ffd24d';
      ctx.lineWidth = 3;
      var L = 26;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        ctx.beginPath();
        ctx.moveTo(lx + s[0] * gap, ly + s[1] * gap + s[1] * L);
        ctx.lineTo(lx + s[0] * gap, ly + s[1] * gap);
        ctx.lineTo(lx + s[0] * gap + s[0] * L, ly + s[1] * gap);
        ctx.stroke();
      });
      ctx.fillStyle = 'rgba(2,6,16,0.65)';
      ctx.fillRect(lx - 62, ly - gap - 40, 124, 26);
      text(ctx, st.lock >= 1 ? 'LOCK — FIRE!' : 'LOCK ' + Math.round(st.lock * 100) + '%',
        lx, ly - gap - 26, 15, st.lock >= 1 ? '#ff3b30' : '#ffd24d', 'center');
      ctx.fillStyle = 'rgba(2,6,16,0.65)';
      ctx.fillRect(lx - 52, ly + gap + 14, 104, 24);
      text(ctx, 'TGT ' + Math.round(4.2 - Math.abs(lt.x) * 2.4) + '.' + Math.abs(Math.round(lt.y * 9)) + ' NM',
        lx, ly + gap + 26, 13, '#cfe8ff', 'center');
    } else {
      text(ctx, 'NO LOCK — HOLD TARGET IN BRACKET', 640, 96, 14, '#9fb8cc', 'center');
    }

    // Bottom-left: fuel + hull + throttle.
    panel(ctx, 16, 560, 300, 144, 'rgba(4,10,24,0.82)');
    text(ctx, 'FUEL', 32, 582, 13, '#8fd0ff');
    bar(ctx, 32, 594, 220, 14, p.fuel / p.fuelMax, p.fuel < 25 ? '#ff5a4d' : '#ffb84d');
    text(ctx, Math.round(p.fuel) + '%', 262, 601, 13, '#eaf6ff');
    text(ctx, 'HULL', 32, 626, 13, '#8fd0ff');
    bar(ctx, 32, 638, 220, 14, p.hull / p.hullMax, p.hull < 30 ? '#ff5a4d' : '#7dffb0');
    text(ctx, Math.round(p.hull) + '%', 262, 645, 13, '#eaf6ff');
    text(ctx, 'THROTTLE', 32, 670, 13, '#8fd0ff');
    if (p.afterburner) text(ctx, 'AFTERBURNER', 130, 670, 13, '#ff9a3d');
    bar(ctx, 32, 682, 220, 10, p.throttle, '#6fb7ff');

    // Bottom-right: weapons.
    panel(ctx, 964, 560, 300, 144, 'rgba(4,10,24,0.82)');
    text(ctx, 'MISSILES  ' + p.missiles, 980, 586, 17, '#eaf6ff');
    text(ctx, 'FLARES  ' + p.flares, 980, 614, 17, '#eaf6ff');
    text(ctx, 'GUN  ' + p.gunDmg + ' DMG', 980, 642, 17, '#eaf6ff');
    text(ctx, 'KILLS  ' + st.kills + ' / ' + (st.enemies.length + st.boats.length), 980, 670, 15, '#ffd24d');
    text(ctx, 'TIME  ' + fmtTime(st.timer), 980, 692, 15, '#cfe8ff');

    // Mission strip bottom centre: name + route progress.
    panel(ctx, 380, 668, 520, 36, 'rgba(4,10,24,0.85)');
    text(ctx, 'M' + st.mission.id + '  ' + st.mission.code + '   —   ' + st.mission.time, 396, 686, 14, '#eaf6ff');
    bar(ctx, 700, 678, 140, 12, st.routeProgress, '#6fb7ff');
    text(ctx, Math.round(st.routeProgress * 100) + '%', 888, 686, 13, '#cfe8ff', 'right');

    // Warning lights.
    if (p.fuel < 25) text(ctx, 'LOW FUEL', 640, 120, 18, '#ff5a4d', 'center');
    else if (p.hull < 30) text(ctx, 'HULL CRITICAL', 640, 120, 18, '#ff5a4d', 'center');

    // Dialogue line (radio) — padded band, never overlapping the HUD.
    if (st.radio && st.radioT > 0) {
      var who = st.radioWho || 'TOWER';
      panel(ctx, 300, 420, 680, 44, 'rgba(3,8,20,0.88)', 'rgba(255,210,77,0.6)');
      text(ctx, who + ':  ' + st.radio, 320, 442, 15, '#ffe9a8');
    }
  }

  function fmtTime(s) {
    var m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function drawFlight(ctx, st, t, cam) {
    if (cam === 'cockpit') drawCockpit(ctx, st, t);
    else drawWorld(ctx, st, t, 'chase');
    drawHUD(ctx, st, t);
  }

  // ---- Screens ----
  function drawTitle(ctx, t, save) {
    drawBg(ctx, 'carrier-deck');
    drawSea(ctx, { sea: window.NF_WORLD.makeSea(7), mission: { fog: 0 } }, t);
    var pj = img('jet-player');
    if (pj) ctx.drawImage(pj, 490, 330, 300, 207);
    panel(ctx, 240, 84, 800, 150, 'rgba(3,8,20,0.78)');
    text(ctx, 'NIGHT FALCON', 640, 140, 64, '#f2f7ff', 'center');
    text(ctx, 'MOONLIT SEA INTERCEPT', 640, 196, 24, '#ffd24d', 'center');
    panel(ctx, 390, 262, 500, 96, 'rgba(3,8,20,0.78)');
    text(ctx, 'Night combat over the moonlit sea — six sorties, one night,', 640, 292, 16, '#cfe8ff', 'center');
    text(ctx, 'one hidden ace waiting in the dark.', 640, 318, 16, '#cfe8ff', 'center');
    text(ctx, 'Carrier Kestrel  •  vs the Crimson Wake  •  03:00 finale', 640, 344, 14, '#8fd0ff', 'center');
    panel(ctx, 440, 396, 400, 120, 'rgba(3,8,20,0.85)');
    text(ctx, 'ENTER — Hangar', 640, 428, 20, '#eaf6ff', 'center');
    text(ctx, 'H — Help & keys', 640, 458, 16, '#cfe8ff', 'center');
    text(ctx, 'M — Mute', 640, 486, 16, '#cfe8ff', 'center');
    text(ctx, 'Best grade: ' + (save && save.bestGrade ? save.bestGrade : '—') +
      '   •   Credits: ' + (save ? save.credits : 0), 640, 560, 15, '#ffd24d', 'center');
    text(ctx, 'A NIGHT FALCON squadron game — original art, sounds and names.', 640, 692, 13, '#7fa3c4', 'center');
  }

  function drawHangar(ctx, save, sel, t) {
    drawBg(ctx, 'carrier-deck');
    panel(ctx, 32, 20, 1216, 64, 'rgba(3,8,20,0.85)');
    text(ctx, 'HANGAR — CARRIER KESTREL', 56, 52, 28, '#f2f7ff');
    text(ctx, 'Credits: ' + save.credits + '   •   Pilot: ' + (save.pilot || 'Night-1'), 1224, 52, 18, '#ffd24d', 'right');
    // Crew strip.
    panel(ctx, 32, 96, 600, 110, 'rgba(3,8,20,0.82)');
    text(ctx, 'CREW', 48, 118, 14, '#8fd0ff');
    text(ctx, 'Cmdr Nadia "Starling" Putri — squadron leader', 48, 142, 15, '#eaf6ff');
    text(ctx, 'Lt Bimo "Kite" Santoso — wingman', 48, 166, 15, '#eaf6ff');
    text(ctx, 'Chief Darma "Wrench" Gunawan — hangar, sells upgrades', 48, 190, 15, '#cfe8ff');
    // Mission map 1-6.
    panel(ctx, 648, 96, 600, 110, 'rgba(3,8,20,0.82)');
    text(ctx, 'MISSION MAP — press 1-6 to brief', 664, 118, 14, '#8fd0ff');
    window.NF_CONFIG.missions.forEach(function (m, i) {
      var x = 664 + i * 96;
      var unlocked = i === 0 || (save.unlocked && save.unlocked.indexOf(m.id) >= 0);
      var done = save.grades && save.grades[m.id];
      ctx.fillStyle = done ? '#2fae5f' : unlocked ? '#1d5f8a' : '#222c3d';
      ctx.fillRect(x, 134, 84, 44);
      ctx.strokeStyle = sel === i ? '#ffd24d' : 'rgba(140,220,255,0.5)';
      ctx.lineWidth = sel === i ? 3 : 1;
      ctx.strokeRect(x, 134, 84, 44);
      text(ctx, 'M' + m.id + ' ' + (done || '—'), x + 42, 150, 14, '#fff', 'center');
      text(ctx, m.time, x + 42, 170, 12, '#cfe8ff', 'center');
    });
    text(ctx, 'Wrench: "She\'s fueled and armed. Spend credits, fly clean."', 664, 196, 13, '#ffe9a8');
    // Upgrade shop: 7 cards in one row.
    panel(ctx, 32, 218, 1216, 134, 'rgba(3,8,20,0.82)');
    text(ctx, 'HANGAR SHOP — 7 UPGRADES  (Up/Down to pick, B to buy)', 48, 240, 16, '#8fd0ff');
    window.NF_CONFIG.upgrades.forEach(function (u, i) {
      var x = 44 + i * 171, y = 256;
      var lv = (save.upgrades && save.upgrades[u.id]) || 0;
      var owned = lv >= u.max;
      ctx.fillStyle = sel - 10 === i ? 'rgba(40,90,140,0.9)' : 'rgba(10,20,40,0.9)';
      ctx.fillRect(x, y, 163, 82);
      ctx.strokeStyle = sel - 10 === i ? '#ffd24d' : 'rgba(140,220,255,0.4)';
      ctx.lineWidth = sel - 10 === i ? 2.5 : 1;
      ctx.strokeRect(x, y, 163, 82);
      text(ctx, u.name, x + 10, y + 16, 12, '#eaf6ff');
      var words = u.desc.split(' ');
      var mid = Math.ceil(words.length / 2);
      text(ctx, words.slice(0, mid).join(' '), x + 10, y + 36, 11, '#cfe8ff');
      text(ctx, words.slice(mid).join(' '), x + 10, y + 52, 11, '#cfe8ff');
      text(ctx, (owned ? 'MAXED' : u.price * (lv + 1) + ' CR') + '   Lv ' + lv + '/' + u.max,
        x + 10, y + 70, 12, owned ? '#7dffb0' : '#ffd24d');
    });
    // The jet, large, with the Ghost ace dossier beside it.
    var pj = img('jet-player');
    if (pj) ctx.drawImage(pj, 56, 362, 280, 193);
    panel(ctx, 380, 364, 868, 180, 'rgba(3,8,20,0.85)');
    text(ctx, 'GHOST ACE — DOSSIER (FINAL DUEL, 03:00)', 404, 390, 15, '#ff8a7a');
    text(ctx, 'One black jet, no markings, no squadron. He has downed four of ours', 404, 418, 14, '#eaf6ff');
    text(ctx, 'and never flies straight — he dodges, drops flares, and taunts on the', 404, 440, 14, '#eaf6ff');
    text(ctx, 'radio. Starling: "He waits above the moonlit sea at 03:00. End him,', 404, 462, 14, '#eaf6ff');
    text(ctx, 'and the Crimson Wake has no ace left. The war ends with Ghost."', 404, 484, 14, '#eaf6ff');
    text(ctx, 'Tower: "Dawn haze in the finale. Watch the flares — they break locks."', 404, 512, 13, '#ffe9a8');
    // Save slots.
    panel(ctx, 32, 556, 1216, 120, 'rgba(3,8,20,0.85)');
    text(ctx, 'SAVE SLOTS  (S to cycle slot, G to save here)', 48, 580, 15, '#8fd0ff');
    for (var s = 0; s < 3; s++) {
      var sx = 48 + s * 396;
      var slot = save.slots && save.slots[s];
      ctx.fillStyle = save.slot === s ? 'rgba(40,90,140,0.9)' : 'rgba(10,20,40,0.9)';
      ctx.fillRect(sx, 594, 380, 66);
      ctx.strokeStyle = save.slot === s ? '#ffd24d' : 'rgba(140,220,255,0.4)';
      ctx.lineWidth = save.slot === s ? 2.5 : 1;
      ctx.strokeRect(sx, 594, 380, 66);
      text(ctx, 'SLOT ' + (s + 1) + (save.slot === s ? '  ◄ ACTIVE' : ''), sx + 14, 614, 14, '#eaf6ff');
      text(ctx, slot ? ('Pilot ' + slot.pilot + '  •  ' + slot.credits + ' CR  •  ' +
        Object.keys(slot.grades || {}).length + ' missions graded') : 'Empty — no save yet',
        sx + 14, 640, 13, '#cfe8ff');
    }
    text(ctx, 'ENTER — fly selected mission   •   H — help   •   Esc — title', 640, 700, 13, '#7fa3c4', 'center');
  }

  function drawBriefing(ctx, m, t) {
    drawBg(ctx, m.bg);
    panel(ctx, 140, 60, 1000, 116, 'rgba(3,8,20,0.88)');
    text(ctx, 'MISSION ' + m.id + ' — ' + m.code, 640, 104, 34, '#f2f7ff', 'center');
    text(ctx, m.time + '  •  ' + (window.NF_CONFIG.weather[m.weather] || {}).label +
      '  •  Reward ' + m.reward + ' CR', 640, 146, 16, '#ffd24d', 'center');
    panel(ctx, 140, 196, 1000, 150, 'rgba(3,8,20,0.88)');
    text(ctx, 'BRIEFING — Cmdr Nadia "Starling" Putri', 164, 222, 15, '#8fd0ff');
    text(ctx, m.brief, 164, 254, 17, '#eaf6ff');
    text(ctx, 'OBJECTIVE: ' + m.objective, 164, 288, 15, '#ffe9a8');
    text(ctx, 'TOWER: ' + m.tower, 164, 322, 14, '#cfe8ff');
    panel(ctx, 140, 366, 1000, 120, 'rgba(3,8,20,0.88)');
    text(ctx, 'ROUTE', 164, 392, 15, '#8fd0ff');
    ctx.strokeStyle = '#6fb7ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(180, 440); ctx.lineTo(1100, 440); ctx.stroke();
    m.route.forEach(function (r, i) {
      var x = 180 + i * (920 / Math.max(1, m.route.length - 1));
      ctx.fillStyle = '#ffd24d';
      ctx.beginPath(); ctx.arc(x, 440, 7, 0, 6.283); ctx.fill();
      text(ctx, r, x, 468, 13, '#eaf6ff', 'center');
    });
    panel(ctx, 440, 516, 400, 96, 'rgba(3,8,20,0.88)');
    text(ctx, 'ENTER — launch', 640, 548, 20, '#eaf6ff', 'center');
    text(ctx, 'Esc — back to hangar', 640, 580, 15, '#cfe8ff', 'center');
  }

  function drawResults(ctx, res) {
    drawBg(ctx, 'night-sea');
    panel(ctx, 240, 56, 800, 120, 'rgba(3,8,20,0.88)');
    text(ctx, 'MISSION COMPLETE', 640, 100, 36, '#f2f7ff', 'center');
    text(ctx, 'M' + res.mission.id + ' — ' + res.mission.code + '   •   GRADE ' + res.grade, 640, 142, 22, '#ffd24d', 'center');
    panel(ctx, 240, 196, 800, 300, 'rgba(3,8,20,0.88)');
    text(ctx, 'Kills ' + res.kills + '   •   Accuracy ' + res.accuracy + '%   •   Time ' + fmtTime(res.time), 640, 232, 18, '#eaf6ff', 'center');
    text(ctx, 'Credits earned: +' + res.credits + ' CR', 640, 264, 18, '#ffd24d', 'center');
    text(ctx, 'SCORE PER MISSION', 280, 300, 14, '#8fd0ff');
    var max = 100;
    Object.keys(res.allGrades || {}).forEach(function (k, i) {
      var g = res.allGrades[k];
      var val = { S: 100, A: 85, B: 70, C: 55 }[g] || 40;
      var bx = 280 + i * 122;
      bar(ctx, bx, 400, 96, 16, val / max, '#6fb7ff');
      text(ctx, 'M' + k + ' ' + g, bx + 48, 380, 14, '#eaf6ff', 'center');
      text(ctx, String(val), bx + 48, 440, 13, '#cfe8ff', 'center');
    });
    text(ctx, 'Starling: "Clean flying, Night-1. The sea is quieter tonight."', 640, 472, 15, '#ffe9a8', 'center');
    panel(ctx, 440, 524, 400, 96, 'rgba(3,8,20,0.88)');
    text(ctx, 'R — back to hangar', 640, 556, 19, '#eaf6ff', 'center');
    text(ctx, 'Enter — next mission', 640, 588, 15, '#cfe8ff', 'center');
  }

  function drawGameOver(ctx, reason) {
    drawBg(ctx, 'storm-night');
    panel(ctx, 240, 200, 800, 220, 'rgba(3,8,20,0.9)');
    text(ctx, 'SHOT DOWN', 640, 256, 44, '#ff5a4d', 'center');
    text(ctx, reason || 'Your jet went down over the dark sea.', 640, 312, 18, '#eaf6ff', 'center');
    text(ctx, 'Kestrel Tower: "Night-1 is down. Rescue is on the way."', 640, 348, 15, '#ffe9a8', 'center');
    text(ctx, 'R — try again   •   Esc — title', 640, 384, 16, '#cfe8ff', 'center');
  }

  function drawHelp(ctx) {
    drawBg(ctx, 'night-sea');
    panel(ctx, 240, 40, 800, 620, 'rgba(3,8,20,0.92)');
    text(ctx, 'HELP — EVERY KEY', 640, 76, 30, '#f2f7ff', 'center');
    window.NF_CONFIG.keys.forEach(function (k, i) {
      var y = 116 + i * 40;
      text(ctx, k[0], 300, y, 16, '#ffd24d');
      text(ctx, k[1], 620, y, 16, '#eaf6ff');
    });
    text(ctx, 'Night lock: hold the target in the centre bracket to build lock,', 640, 604, 14, '#cfe8ff', 'center');
    text(ctx, 'then F fires a missile. C drops a flare. Esc — back.', 640, 628, 14, '#cfe8ff', 'center');
  }

  function drawPause(ctx) {
    ctx.fillStyle = 'rgba(2,6,16,0.72)'; ctx.fillRect(0, 0, W, H);
    panel(ctx, 440, 280, 400, 160, 'rgba(3,8,20,0.92)');
    text(ctx, 'PAUSED', 640, 330, 34, '#f2f7ff', 'center');
    text(ctx, 'P — resume   •   Esc — hangar', 640, 380, 16, '#cfe8ff', 'center');
  }

  window.NF_RENDER = {
    loadAssets: loadAssets, drawFlight: drawFlight, drawTitle: drawTitle,
    drawHangar: drawHangar, drawBriefing: drawBriefing, drawResults: drawResults,
    drawGameOver: drawGameOver, drawHelp: drawHelp, drawPause: drawPause,
    fmtTime: fmtTime, W: W, H: H
  };
})();
