/* 8-bit звуки наведения и нажатия, разделённые на группы элементов.
   Настройки (группы, ноты, громкость) - в config.js, блок sounds.
   Звук синтезируется кодом (Web Audio) либо берётся из файла, если у звука указан file. */
(function () {
  "use strict";
  var cfg = (window.SITE && window.SITE.sounds) || {};
  var AC = window.AudioContext || window.webkitAudioContext;
  var master = cfg.volume == null ? 0.5 : cfg.volume;
  var groups = cfg.groups || {};
  var KEY = "callousbun-sound-muted";
  var muted = false;
  try { muted = localStorage.getItem(KEY) === "1"; } catch (e) {}

  var ctx = null, noiseBuf = null, pulses = {}, files = {}, lastHover = 0;

  function emit() { window.dispatchEvent(new CustomEvent("soundfx")); }

  /* Общий переключатель (его использует кнопка звука в script.js) */
  var api = window.SoundFX = {
    available: cfg.enabled !== false && !!AC,
    isMuted: function () { return muted; },
    setMuted: function (m) {
      muted = !!m;
      try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch (e) {}
      if (!muted) { unlock(); playGroup("toggle", "click"); }   // подтверждающий звук при включении
      emit();
    },
    toggle: function () { api.setMuted(!muted); }
  };
  if (!api.available) { emit(); return; }

  function unlock() {   // создаётся и включается только по действию пользователя (правило браузеров)
    if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }
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

  /* Один голос: генератор -> (фильтр) -> огибающая громкости */
  function synth(def) {
    var steps = def.steps || [[880, 0.05]];
    var t0 = ctx.currentTime + 0.005, t = t0, i, src, isNoise = def.wave === "noise";
    var out = ctx.createGain(), inp = out;
    out.connect(ctx.destination);
    if (def.lowpass) {                                            // "глухой" звук: срезаем верха
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = def.lowpass;
      lp.connect(out); inp = lp;
    }
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
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.linearRampToValueAtTime(vol, t0 + 0.003);            // короткое нарастание - без щелчка
    if (def.decay) {
      out.gain.exponentialRampToValueAtTime(0.0001, t);           // удар: сразу громко и быстро затухает
    } else {
      out.gain.setValueAtTime(vol, Math.max(t0 + 0.003, t - 0.01));
      out.gain.linearRampToValueAtTime(0, t);
    }
    src.connect(inp); src.start(t0); src.stop(t + 0.02);
  }

  function voice(def) {
    if (def.file) {                                               // вариант с файлом
      var a = files[def.file] || (files[def.file] = new Audio(def.file));
      var c = a.cloneNode(); c.volume = Math.min(1, (def.volume == null ? 1 : def.volume) * master);
      var p = c.play(); if (p && p.catch) p.catch(function () {});
    } else if (ctx && ctx.state === "running") synth(def);
  }

  function play(def) {          // def - один голос или массив голосов (слои звучат одновременно)
    if (!def || muted) return;
    (Array.isArray(def) ? def : [def]).forEach(voice);
  }

  function playGroup(name, kind) {
    var g = groups[name];
    if (g && g.enabled !== false) play(g[kind]);
  }

  /* Какая группа отвечает за элемент: первая, чей selector подходит */
  function find(target) {
    if (!target || !target.closest) return null;
    for (var name in groups) {
      var g = groups[name];
      if (g && g.enabled !== false && g.selector) {
        var el = target.closest(g.selector);
        if (el) return { name: name, el: el, g: g };
      }
    }
    return null;
  }

  document.addEventListener("pointerdown", function (e) {
    unlock();
    var m = find(e.target);
    if (m && m.name !== "toggle") play(m.g.click);                // у кнопки звука свой звук - после переключения
  }, true);
  document.addEventListener("keydown", function (e) {
    unlock();
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    var m = find(e.target);
    if (m && m.name !== "toggle") play(m.g.click);
  }, true);
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;                        // на телефонах наведения нет
    var m = find(e.target);
    if (!m || m.el.contains(e.relatedTarget)) return;             // переход между детьми одной кнопки - не считается
    var now = Date.now(); if (now - lastHover < 40) return; lastHover = now;
    play(m.g.hover);
  });
  emit();
})();
