/* 8-bit звуки наведения и нажатия. Настройки - в config.js (блок sounds).
   Звуки синтезируются кодом (Web Audio), либо берутся из файлов, если в config.js указан file. */
(function () {
  "use strict";
  var cfg = (window.SITE && window.SITE.sounds) || {};
  if (cfg.enabled === false) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  var master = cfg.volume == null ? 0.5 : cfg.volume;
  // Что считается кнопкой (наведение и нажатие по этим элементам звучат)
  var SEL = ".pbtn, .contact, .work, .slider";

  var ctx = null, noiseBuf = null, pulses = {}, files = {}, lastHover = 0;

  function unlock() {   // создаётся и включается только по действию пользователя (правило браузеров)
    if (!ctx && AC) { try { ctx = new AC(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function pulseWave(duty) {   // прямоугольная волна с заданной шириной импульса
    if (pulses[duty]) return pulses[duty];
    var n = 64, re = new Float32Array(n), im = new Float32Array(n);
    for (var k = 1; k < n; k++) {
      re[k] = 2 / (k * Math.PI) * Math.sin(k * Math.PI * duty);
      im[k] = 2 / (k * Math.PI) * (1 - Math.cos(k * Math.PI * duty));
    }
    return (pulses[duty] = ctx.createPeriodicWave(re, im));
  }

  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function synth(def) {
    var steps = def.steps || [[880, 0.05]];
    var t0 = ctx.currentTime + 0.005, t = t0, i, src, isNoise = def.wave === "noise";
    var out = ctx.createGain(); out.connect(ctx.destination);
    if (isNoise) { src = ctx.createBufferSource(); src.buffer = noise(); src.loop = true; }
    else {
      src = ctx.createOscillator();
      if (def.wave === "pulse") src.setPeriodicWave(pulseWave(def.duty || 0.25));
      else src.type = def.wave || "square";
    }
    var param = isNoise ? src.playbackRate : src.frequency;
    for (i = 0; i < steps.length; i++) {
      var f = isNoise ? steps[i][0] / 1000 : steps[i][0];
      if (def.slide && i) param.linearRampToValueAtTime(f, t); else param.setValueAtTime(f, t);
      t += steps[i][1];
    }
    var vol = (def.volume == null ? 1 : def.volume) * master;
    out.gain.setValueAtTime(0, t0);
    out.gain.linearRampToValueAtTime(vol, t0 + 0.003);          // короткое нарастание - без щелчка
    out.gain.setValueAtTime(vol, Math.max(t0 + 0.003, t - 0.01));
    out.gain.linearRampToValueAtTime(0, t);                       // и затухание
    src.connect(out); src.start(t0); src.stop(t + 0.02);
  }

  function play(name) {
    var def = cfg[name];
    if (!def) return;
    if (def.file) {                                               // вариант с файлом
      var a = files[name] || (files[name] = new Audio(def.file));
      var c = a.cloneNode(); c.volume = Math.min(1, (def.volume == null ? 1 : def.volume) * master);
      var p = c.play(); if (p && p.catch) p.catch(function () {});
      return;
    }
    if (ctx && ctx.state === "running") synth(def);
  }

  document.addEventListener("pointerdown", function (e) {
    unlock();
    if (e.target.closest && e.target.closest(SEL)) play("click");
  }, true);
  document.addEventListener("keydown", function (e) {
    unlock();
    if (!e.repeat && (e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest(SEL)) play("click");
  }, true);
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;                        // на телефонах наведения нет
    var el = e.target.closest && e.target.closest(SEL);
    if (!el || el.contains(e.relatedTarget)) return;              // переход между детьми одной кнопки - не считается
    var now = Date.now(); if (now - lastHover < 40) return; lastHover = now;
    play("hover");
  });
})();
