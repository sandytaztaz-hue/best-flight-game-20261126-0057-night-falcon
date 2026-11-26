/* NIGHT FALCON — audio.js: WebAudio only. Engine hum, lock beep, missile whoosh,
   cannon thump, explosion boom, radio blips, short menu theme loop. Mute with M. */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, engineOsc = null, engineGain = null;
  var muted = false, themeTimer = null, themeStep = 0;

  function ensure() {
    if (ctx) return ctx;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine hum: low sawtooth + lowpass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted || !ensure()) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) {}
  }

  function noise(dur, vol, low) {
    if (muted || !ensure()) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 900;
      var g = ctx.createGain(); g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) {}
  }

  // Short menu theme: a moody minor loop, 8 steps, low volume.
  var THEME = [220, 0, 261.6, 0, 196, 0, 164.8, 0, 220, 0, 261.6, 0, 329.6, 293.7, 261.6, 0];
  function startTheme() {
    if (!ensure() || themeTimer) return;
    themeTimer = setInterval(function () {
      if (muted) return;
      var f = THEME[themeStep % THEME.length];
      themeStep++;
      if (f) tone(f, 0.34, 'triangle', 0.05);
    }, 340);
  }
  function stopTheme() {
    if (themeTimer) { clearInterval(themeTimer); themeTimer = null; }
  }

  window.NF_AUDIO = {
    ensure: ensure,
    setMuted: function (m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted: function () { return muted; },
    engine: function (throttle, on) {
      if (!ensure()) return;
      try {
        engineGain.gain.setTargetAtTime(on ? 0.05 + throttle * 0.09 : 0, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(48 + throttle * 70, ctx.currentTime, 0.1);
      } catch (e) {}
    },
    lockBeep: function (lock) {
      // Lock tone rises in pitch and quickens as lock builds.
      tone(700 + lock * 900, 0.07, 'square', 0.06);
    },
    missile: function () { noise(0.7, 0.25, 2400); tone(300, 0.6, 'sawtooth', 0.08, 900); },
    cannon: function () { noise(0.12, 0.3, 500); tone(120, 0.1, 'square', 0.12, 60); },
    explosion: function () { noise(1.1, 0.5, 420); tone(90, 0.9, 'sine', 0.3, 30); },
    flare: function () { noise(0.4, 0.15, 3000); tone(1200, 0.3, 'sine', 0.05, 2400); },
    radio: function () { tone(880, 0.08, 'sine', 0.07); setTimeout(function () { tone(1100, 0.08, 'sine', 0.07); }, 110); },
    splash: function () { noise(0.9, 0.3, 600); tone(220, 0.8, 'sine', 0.1, 55); },
    hit: function () { tone(180, 0.15, 'square', 0.15, 90); },
    click: function () { tone(660, 0.05, 'sine', 0.08); },
    startTheme: startTheme,
    stopTheme: stopTheme
  };
})();
