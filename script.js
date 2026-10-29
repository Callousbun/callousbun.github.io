/* Логика сайта. Тексты и списки правятся в config.js, а не здесь. */
(function () {
  "use strict";
  var S = window.SITE;
  var lang = S.defaultLang || "en";
  var MIN = S.minUiScale || 2;
  var $ = function (s) { return document.querySelector(s); };
  var langUpdaters = [];   // функции, обновляющие тексты при смене языка
  var scalers = [];        // функции, пересчитывающие масштаб при изменении окна

  function L(obj) { return typeof obj === "string" ? obj : (obj[lang] || obj.en || ""); }
  function T(key) { return S.strings[lang][key]; }
  function viewportW() { return document.documentElement.clientWidth; }
  function narrow() { return viewportW() < 480; }

  /* ---------- Масштаб в физических пикселях экрана ----------
     R - сколько физических пикселей в одном CSS-пикселе (на телефонах 2.5-3.5, на ПК обычно 1).
     Целый масштаб k считается в ФИЗИЧЕСКИХ пикселях: один пиксель арта = ровно k пикселей экрана.
     Размер в CSS = ширина * k / R. Так на телефоне нет рядов то в 2, то в 3 пикселя. */
  function ratio() {
    var d = window.devicePixelRatio || 1, vv = window.visualViewport;
    return d * (vv && vv.scale ? Math.min(1, vv.scale) : 1);   // "версия для ПК" на телефоне уменьшает страницу - учитываем
  }
  function css(dev) { return dev / ratio() + "px"; }
  /* Наибольший целый масштаб k (1..max), при котором картинка помещается в рамку maxW x maxH (CSS-пиксели).
     Если не помещается даже при k=1, остаётся 1. */
  function fitScale(w, h, maxW, maxH, max) {
    var R = ratio(), s = Math.floor(Math.min(maxW * R / w, maxH * 0.8 * R / h) + 1e-6);
    return Math.max(1, Math.min(max || 10, s) );
  }
  /* То же для картинок интерфейса, но не меньше MIN "CSS-иксов" (по умолчанию 2x) */
  function uiScale(w, h, maxW, maxH) {
    var R = ratio(), kmin = Math.ceil(MIN * R - 1e-6);
    var s = Math.floor(Math.min(maxW * R / w, maxH * R / h) + 1e-6);
    return Math.max(kmin, Math.min(Math.max(kmin, Math.ceil(10 * R)), s));
  }
  function applySize(img, s) {
    img.style.width = css(img.naturalWidth * s);
    img.style.height = css(img.naturalHeight * s);
    scheduleAlign();
  }
  /* Выравнивание на сетку физических пикселей: у каждой картинки и рамки левый и верхний край
     сдвигаются на доли пикселя так, чтобы попасть ровно на пиксель экрана. Тогда браузер не округляет
     размер на 1 пиксель и все пиксели арта остаются одинаковыми. */
  var alignRaf;
  function scheduleAlign() { cancelAnimationFrame(alignRaf); alignRaf = requestAnimationFrame(alignAll); }
  function alignAll() {
    var R = ratio();
    document.querySelectorAll("img.px:not(.s-thumb), canvas.frame-canvas").forEach(function (el) {
      var isCv = el.tagName === "CANVAS";
      if (!isCv && getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.left = isCv ? "0px" : ""; el.style.top = isCv ? "0px" : "";
      var r = el.getBoundingClientRect();
      if (!r.width) return;
      var dx = (Math.round(r.left * R) - r.left * R) / R, dy = (Math.round(r.top * R) - r.top * R) / R;
      if (Math.abs(dx) > 1e-6) el.style.left = dx + "px";
      if (Math.abs(dy) > 1e-6) el.style.top = dy + "px";
    });
  }
  /* Размеры шрифта и строки подгоняются под сетку шрифта в физических пикселях (fontGrid, по умолчанию 9) */
  var FONT_KEYS = ["title", "welcome", "contact", "hint", "toast", "desc", "caption", "zoom"];
  function contactsCompact() { return viewportW() < (S.contactsNarrow || 480); }   // "узкий" экран (CSS-пиксели), см. contactsNarrow в config.js
  function snapFonts() {
    var R = ratio(), g = S.fontGrid || 9, root = document.documentElement, cs = getComputedStyle(root);
    var cel = $("#contacts");
    if (cel) cel.classList.toggle("compact", contactsCompact());
    FONT_KEYS.forEach(function (k) {
      var half = (k === "contact" && contactsCompact()) ? 0.5 : 1;   // узкий экран: подписи контактов вдвое меньше
      var fs = parseFloat(cs.getPropertyValue("--fs-" + k)) * half;
      if (fs) root.style.setProperty("--fs-" + k + "-px", Math.max(g, Math.round(fs * R / g) * g) / R + "px");
      var lh = parseFloat(cs.getPropertyValue("--lh-" + k)) * half;
      if (lh) root.style.setProperty("--lh-" + k + "-px", Math.max(1, Math.round(lh * R)) / R + "px");
    });
  }
  snapFonts();

  /* Для галереи и нижнего арта */
  function scaled(img, src, getScale) {
    var run = function () { if (img.naturalWidth) applySize(img, getScale(img)); };
    img.addEventListener("load", run);
    img.src = src;
    if (img.complete) run();
    scalers.push(run);
  }

  /* Картинка интерфейса с тремя состояниями.
     srcs - строка или { normal, hover, active }. host - элемент, на который реагируем (мышь/касание).
     isSelected - необязательная функция: если вернула true, всегда показывается active.
     Размер берётся из файла normal, поэтому смена файла не двигает вёрстку. */
  function uiImage(img, srcs, getScale, host, isSelected, onReady) {
    if (typeof srcs === "string") srcs = { normal: srcs };
    var st = { normal: srcs.normal, hover: srcs.hover || srcs.normal, active: srcs.active || srcs.hover || srcs.normal };
    var hovering = false, pressing = false, w = 0, h = 0;
    ["hover", "active"].forEach(function (k) { if (st[k] !== st.normal) { new Image().src = st[k]; } });  // предзагрузка
    function draw() {
      var k = (pressing || (isSelected && isSelected())) ? "active" : (hovering ? "hover" : "normal");
      if (img.getAttribute("src") !== st[k]) img.src = st[k];
    }
    function size() { if (w) { var s = getScale(w, h); img.style.width = css(w * s); img.style.height = css(h * s); scheduleAlign(); } }
    var probe = new Image();
    probe.onload = function () { w = probe.naturalWidth; h = probe.naturalHeight; size(); if (onReady) onReady(); };
    probe.src = st.normal;
    img.src = st.normal;
    scalers.push(size);
    if (host) {
      host.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hovering = true; draw(); } });
      host.addEventListener("pointerleave", function () { hovering = false; pressing = false; draw(); });
      host.addEventListener("pointerdown", function () { pressing = true; draw(); });
      host.addEventListener("pointerup", function () { pressing = false; draw(); });
      host.addEventListener("pointercancel", function () { pressing = false; draw(); });
    }
    draw.size = size;
    return draw;
  }

  /* Рамка из 9 тайлов (canvas). Углы - по одному, края и центр - повторяются плиткой.
     Размер блока подгоняется под целое число тайлов (ширина округляется вниз, высота вверх),
     поэтому тайлы никогда не обрезаются и не перекрываются.
     Вариации: для каждой клетки случайно, с весами из frames.variantWeights (один раз за загрузку). */
  var SLOTS = ["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"];
  function frame(host, setName, opts) {
    opts = opts || {};
    var cfg = S.frames && S.frames[setName];
    if (!cfg) return;
    var weights = S.frames.variantWeights || [45, 35, 15];
    var slots = {}, pending = 0, tw = 0, th = 0, ready = false, rnd = {};
    var cv = document.createElement("canvas");
    cv.className = "px frame-canvas";
    host.classList.add("framed"); host.insertBefore(cv, host.firstChild);

    SLOTS.forEach(function (k) {
      var list = cfg.tiles[k] || [];
      var arr = slots[k] = new Array(list.length);
      list.forEach(function (src, j) {
        var im = new Image(); pending++;
        im.onload = function () { arr[j] = im; done(); };
        im.onerror = done;
        im.src = src;
      });
    });
    function done() {
      if (--pending > 0) return;
      SLOTS.forEach(function (k) { slots[k] = slots[k].filter(Boolean); });   // порядок как в config.js
      var first = slots.center[0] || slots.topLeft[0];
      if (!first) return;   // тайлы не найдены: остаётся простая рамка CSS
      tw = first.naturalWidth; th = first.naturalHeight; ready = true;
      host.classList.add("frame-ready"); draw();
    }
    function pick(k, i) {
      var list = slots[k]; if (!list.length) return null;
      var a = rnd[k] || (rnd[k] = []);
      while (a.length <= i) a.push(Math.random());
      var w = list.map(function (_, j) { return weights[j] != null ? weights[j] : weights[weights.length - 1]; });
      var total = w.reduce(function (x, y) { return x + y; }, 0), r = a[i] * total;
      for (var j = 0; j < list.length; j++) { if (r < w[j]) return list[j]; r -= w[j]; }
      return list[list.length - 1];
    }
    function draw() {
      if (!ready) return;
      var R = ratio();
      var kc = narrow() ? MIN : Math.max(MIN, S.frames.scale || 2);
      var k = Math.max(1, Math.round(kc * R));     // масштаб тайлов в физических пикселях
      var sw = tw * k, sh = th * k;                // размер тайла в физических пикселях
      var rowMode = cfg.layout === "row";          // "row": панель из левого, центрального и правого тайла
      var bw = (cfg.borderWidth == null ? tw : cfg.borderWidth) * k + Math.round((cfg.padding || 0) * R);
      var py = Math.round((cfg.paddingY || 0) * R);
      host.style.padding = rowMode ? py / R + "px " + bw / R + "px" : bw / R + "px";
      // ширина: целое число тайлов (не меньше 3), не шире доступного места
      host.style.width = ""; host.style.minHeight = ""; host.style.marginLeft = "";
      var slackEl = opts.slackEl && opts.slackEl();
      if (slackEl) { slackEl.style.marginTop = ""; slackEl.style.marginBottom = ""; }
      var avail = host.getBoundingClientRect().width * R;
      var W = Math.max(3, Math.floor(avail / sw + 1e-6)) * sw;
      host.style.width = W / R + "px";
      var ml = Math.max(0, Math.floor((avail - W) / 2));
      host.style.marginLeft = ml / R + "px";   // остаток ширины делим поровну слева и справа
      if (opts.exposeVars) {                    // верхняя строка (язык / звук) выравнивается по рамке
        document.documentElement.style.setProperty("--welcome-ml", ml / R + "px");
        document.documentElement.style.setProperty("--welcome-w", W / R + "px");
      }
      // содержимое, зависящее от ширины блока (контакты), раскладывается здесь: ширина уже окончательная
      if (opts.beforeHeight) opts.beforeHeight();
      // высота: содержимое, округлённое вверх до целого числа тайлов
      var natural = host.getBoundingClientRect().height * R;
      var H = Math.max(rowMode ? 1 : 3, Math.ceil(natural / sh - 1e-3)) * sh;
      // запас до целого тайла делится поровну: половина НАД контактами, половина ПОД ними
      if (slackEl) {
        var slack = Math.floor(H - natural);
        if (slack > 0) {
          var top = Math.floor(slack / 2), bottom = slack - top;
          slackEl.style.marginTop = (parseFloat(getComputedStyle(slackEl).marginTop) || 0) + top / R + "px";
          slackEl.style.marginBottom = bottom / R + "px";
        }
      }
      host.style.minHeight = H / R + "px";
      cv.width = W; cv.height = H; cv.style.width = W / R + "px"; cv.style.height = H / R + "px";
      scheduleAlign();
      var ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
      function region(x, y, w, h, k2) {
        var i = 0;
        for (var yy = y; yy < y + h; yy += sh) for (var xx = x; xx < x + w; xx += sw) {
          var im = pick(k2, i++); if (im) ctx.drawImage(im, xx, yy, sw, sh);
        }
      }
      if (rowMode) {
        region(0, 0, sw, H, "left");
        region(sw, 0, W - 2 * sw, H, "center");
        region(W - sw, 0, sw, H, "right");
        return;
      }
      region(sw, sh, W - 2 * sw, H - 2 * sh, "center");
      region(sw, 0, W - 2 * sw, sh, "top");
      region(sw, H - sh, W - 2 * sw, sh, "bottom");
      region(0, sh, sw, H - 2 * sh, "left");
      region(W - sw, sh, sw, H - 2 * sh, "right");
      region(0, 0, sw, sh, "topLeft"); region(W - sw, 0, sw, sh, "topRight");
      region(0, H - sh, sw, sh, "bottomLeft"); region(W - sw, H - sh, sw, sh, "bottomRight");
    }
    if (window.ResizeObserver) { var ro = new ResizeObserver(draw); ro.observe(host); ro.observe(host.parentElement); }
    scalers.push(draw);
    draw.isReady = function () { return ready; };
    return draw;
  }

  /* ---------- Язык ---------- */
  var langRefresh = {};
  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = T(el.getAttribute("data-i18n")); });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) { el.title = T(el.getAttribute("data-i18n-title")); });
    document.querySelectorAll("[data-i18n-label]").forEach(function (el) { el.setAttribute("aria-label", T(el.getAttribute("data-i18n-label"))); });
    $("#welcomeText").textContent = L(S.welcome);
    $("#welcomeTitle").textContent = S.title ? L(S.title) : "";
    Object.keys(langRefresh).forEach(function (c) { langRefresh[c](); });
    langUpdaters.forEach(function (f) { f(); });
  }
  var langBar = $("#langBar");
  Object.keys(S.images.lang).forEach(function (code) {
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "pbtn";
    var img = document.createElement("img"); img.className = "px";
    img.alt = (S.langNames && S.langNames[code]) || code.toUpperCase();
    btn.appendChild(img); langBar.appendChild(btn);
    var draw = uiImage(img, S.images.lang[code], function (w, h) {
      return narrow() ? uiScale(w, h, 72, 32) : uiScale(w, h, 96, 40);
    }, btn, function () { return lang === code; });
    langRefresh[code] = function () { btn.setAttribute("aria-pressed", lang === code ? "true" : "false"); draw(); };
    btn.addEventListener("click", function () { lang = code; applyLang(); });
  });

  /* ---------- Кнопка звука ----------
     Иконки рисуются кодом (пиксельные 16x16). Свои PNG - в config.js, images.sound. */
  var SND_BITMAP = {
    on: [
      "................",
      ".......#........",
      "......##...#....",
      ".....###....#...",
      "..#####..#...#..",
      "..#####...#..#..",
      "..#####...#..#..",
      "..#####...#..#..",
      "..#####..#...#..",
      ".....###....#...",
      "......##...#....",
      ".......#........",
      "................"
    ],
    off: [
      "................",
      ".......#........",
      "......##........",
      ".....###..x...x.",
      "..#####....x.x..",
      "..#####.....x...",
      "..#####....x.x..",
      "..#####...x...x.",
      "..#####.........",
      ".....###........",
      "......##........",
      ".......#........",
      "................"
    ]
  };
  function sndIcon(kind, body, mark) {
    var rows = SND_BITMAP[kind], cv = document.createElement("canvas"), g;
    cv.width = 16; cv.height = rows.length; g = cv.getContext("2d");
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        if (row[x] === ".") continue;
        g.fillStyle = row[x] === "x" ? mark : body; g.fillRect(x, y, 1, 1);
      }
    });
    return cv.toDataURL("image/png");
  }
  var soundBtn = $("#soundBtn");
  ["on", "off"].forEach(function (k) {
    var srcs = (S.images.sound && S.images.sound[k]) || {
      normal: sndIcon(k, "#c3c7d3", "#d9534f"), hover: sndIcon(k, "#ffffff", "#ff7a73"), active: sndIcon(k, "#7fd18b", "#ffb0ab")
    };
    uiImage(soundBtn.querySelector("img." + k), srcs, function (w, h) {
      return narrow() ? uiScale(w, h, 72, 32) : uiScale(w, h, 96, 40);
    }, soundBtn);
  });
  function syncSound() {
    var fx = window.SoundFX, off = !!(fx && fx.isMuted());
    soundBtn.style.display = (fx && fx.available) ? "" : "none";
    soundBtn.querySelector("img.on").style.display = off ? "none" : "";
    soundBtn.querySelector("img.off").style.display = off ? "" : "none";
    var label = T(off ? "soundOff" : "soundOn") || "";
    soundBtn.title = label; soundBtn.setAttribute("aria-label", label); soundBtn.setAttribute("aria-pressed", off ? "false" : "true");
    scheduleAlign();
  }
  soundBtn.addEventListener("click", function () { if (window.SoundFX) window.SoundFX.toggle(); });
  window.addEventListener("soundfx", syncSound);   // sounds.js сообщает, что готов или что состояние изменилось
  langUpdaters.push(syncSound);

  /* ---------- Приветствие ---------- */
  function iconBox() { return narrow() ? 96 : 160; }
  uiImage($("#avatar"), S.images.avatar, function (w, h) { var b = iconBox(); return uiScale(w, h, b, b); });
  uiImage($("#status"), S.images.status, function (w, h) { var b = iconBox() / 3; return uiScale(w, h, b, b); });

  var welcomeDraw = frame($("#welcome"), "welcome", {
    exposeVars: true,
    beforeHeight: function () { relayoutContacts(); },
    slackEl: function () { return contactsEl; }
  });

  /* ---------- Контакты ---------- */
  var contactsEl = $("#contacts"), contactSizers = [], contactNat = [], contactK = 0;
  function refreshWelcome() { if (welcomeDraw.isReady()) welcomeDraw(); else relayoutContacts(); }
  S.contacts.forEach(function (c, idx) {
    var el;
    if (c.type === "link") {
      el = document.createElement("a");
      el.href = c.url; el.target = "_blank"; el.rel = "noopener noreferrer";
    } else {
      el = document.createElement("div");
      el.setAttribute("role", "button"); el.tabIndex = 0;
    }
    el.className = "contact";
    var icon = document.createElement("img");
    icon.className = "px"; icon.alt = "";
    var iconDraw = uiImage(icon, c.icon, function (w, h) {
      // масштаб один для всех иконок и считается в layoutContacts (без обратной связи от текущих размеров)
      contactNat[idx] = w;
      return contactK || Math.max(1, Math.ceil((S.contactsMinScale || 1) * ratio() - 1e-6));
    }, el, null, refreshWelcome);
    contactSizers.push(iconDraw.size);
    var label = document.createElement("span");
    label.className = "label";
        var text = document.createElement("span");
    (c.label || c.text).split("\n").forEach(function (line, i) {
      if (i) text.appendChild(document.createElement("br"));
      text.appendChild(document.createTextNode(line));
    });
    label.appendChild(text);
    var hint, toast;
    if (c.type === "copy") {
      hint = document.createElement("span"); hint.className = "hint";
      label.appendChild(document.createTextNode(" "));   // пробел: подпись переносится под адрес целиком
      label.appendChild(hint);
      toast = document.createElement("span"); toast.className = "toast";
      el.appendChild(toast);
    }
    el.insertBefore(label, el.firstChild); el.insertBefore(icon, el.firstChild);
    contactsEl.appendChild(el);

    langUpdaters.push(function () {
      el.title = L(c.title);
      if (hint) hint.textContent = T("copyHint");
    });

    if (c.type === "copy") {
      var timer;
      var show = function (msg) {
        toast.textContent = msg; toast.classList.remove("show"); void toast.offsetWidth; toast.classList.add("show");
        clearTimeout(timer); timer = setTimeout(function () { toast.classList.remove("show"); }, 3000);
      };
      var manual = function () {
        var r = document.createRange(); r.selectNodeContents(text);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        show(T("copyFailed"));
      };
      var copy = function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(c.text).then(function () { show(T("copied")); }, manual);
        } else { manual(); }
      };
      el.addEventListener("click", copy);
      el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copy(); } });
    }
  });

  /* Раскладка контактов считается за один проход и не зависит от предыдущего состояния:
     для каждого масштаба k (от наибольшего к наименьшему) считаем нужное расстояние между иконками
     (одинаковое; на широком экране - такое, чтобы самые длинные подписи не наезжали друг на друга,
     на узком - --contacts-gap-compact) и берём первый k, при котором всё влезает в ширину блока. */
  function layoutContacts() {
    contactsEl.style.columnGap = "";
    var n = contactNat.length, items = contactsEl.querySelectorAll(".contact");
    for (var q = 0; q < S.contacts.length; q++) if (!contactNat[q]) return;   // размеры картинок ещё не известны
    var R = ratio(), avail = contactsEl.getBoundingClientRect().width;
    var base = parseFloat(getComputedStyle(contactsEl).columnGap) || 0, compact = contactsCompact();
    var lw = [];
    items.forEach(function (it) {
      var w = 0; it.querySelectorAll(".label > *").forEach(function (c) { w = Math.max(w, c.getBoundingClientRect().width); });
      lw.push(w);
    });
    var maxNat = Math.max.apply(null, contactNat);
    var kmin = Math.max(1, Math.ceil((S.contactsMinScale || 1) * R - 1e-6));
    var kmax = Math.max(kmin, Math.min(Math.ceil(10 * R), Math.floor((S.contactIconBox || 96) * R / maxNat + 1e-6)));
    var k = kmin, gap = base;
    for (var kk = kmax; kk >= kmin; kk--) {
      var iw = contactNat.map(function (w) { return w * kk / R; }), need = base;
      if (!compact) for (var i = 0; i + 1 < n; i++) need = Math.max(need, (lw[i] + lw[i + 1]) / 2 - (iw[i] + iw[i + 1]) / 2 + 16);
      var total = iw.reduce(function (a, b) { return a + b; }, 0) + need * (n - 1);
      k = kk; gap = need;
      if (total <= avail + 1e-6) break;
    }
    contactK = k;
    if (!compact) contactsEl.style.columnGap = gap + "px";
  }
  function relayoutContacts() { layoutContacts(); contactSizers.forEach(function (f) { f(); }); }
  scalers.push(function () { if (!welcomeDraw.isReady()) relayoutContacts(); });   // запасной путь, если рамка не загрузилась
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshWelcome);

  /* ---------- Галерея ---------- */
  var galleryEl = $("#gallery");
  S.gallery.forEach(function (w, index) {
    var card = document.createElement("button");
    card.type = "button"; card.className = "work";
    var img = document.createElement("img"); img.className = "px"; img.alt = "";
    var desc = document.createElement("div"); desc.className = "desc";
    card.appendChild(img); card.appendChild(desc);
    galleryEl.appendChild(card);
    scaled(img, w.file, function (i) {
      // как можно крупнее (целый масштаб), но чтобы работа целиком влезала в окно по ширине и высоте
      var maxW = Math.max(40, galleryEl.getBoundingClientRect().width - 18);
      var maxH = Math.max(40, window.innerHeight - 18 - (desc.textContent ? desc.offsetHeight + 8 : 0));
      var s = fitScale(i.naturalWidth, i.naturalHeight, maxW, maxH, 10);
      card.style.width = Math.max(i.naturalWidth * s / ratio(), Math.min(200, maxW)) + 18 + "px";
      return s;
    });
    langUpdaters.push(function () { desc.textContent = L(w.desc); img.alt = L(w.desc); });
    card.addEventListener("click", function () { openViewer(index, card); });
  });

  /* ---------- Просмотр ---------- */
  var viewer = $("#viewer"), vRow = $("#viewerRow"), vStage = $("#viewerStage"), vImg = $("#viewerImg"), vCap = $("#viewerCaption");
  var prevBtn = $("#prevBtn"), nextBtn = $("#nextBtn");
  var openWork = null, idx = 0, lastFocus = null, userScale = null;

  function viewerScale() {
    var cs = getComputedStyle(vStage);
    var w = vStage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = vStage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return fitScale(vImg.naturalWidth, vImg.naturalHeight, w, h, 10);
  }
  function refreshViewer() {
    if (!openWork || !vImg.naturalWidth) return;
    var s = userScale || viewerScale();
    applySize(vImg, s);
    vImg.style.visibility = "";
    setSliderValue(s);
    vStage.classList.toggle("pannable", vImg.naturalWidth * s > vStage.clientWidth * ratio() + 0.5 || vImg.naturalHeight * s > vStage.clientHeight * ratio() + 0.5);
  }
  function setViewerText() { if (openWork) { vCap.textContent = L(openWork.desc); vImg.alt = L(openWork.desc); } }

  function setWork(i) {
    var n = S.gallery.length;
    idx = (i + n) % n; openWork = S.gallery[idx]; userScale = null;
    vImg.removeAttribute("style"); vImg.style.visibility = "hidden";
    vImg.onload = refreshViewer;
    vImg.src = openWork.file;
    setViewerText();
    vStage.scrollTop = 0; vStage.scrollLeft = 0;
    if (vImg.complete && vImg.naturalWidth) refreshViewer();
  }
  function go(d) { if (openWork && S.gallery.length > 1) { setWork(idx + d); wake(); } }
  function openViewer(i, from) {
    lastFocus = from;
    viewer.hidden = false;
    document.body.style.overflow = "hidden";   // позиция страницы не меняется
    var many = S.gallery.length > 1;
    prevBtn.hidden = nextBtn.hidden = !many;
    setWork(i);
    $("#viewerClose").focus();
    wake();
  }
  function closeViewer() {
    if (viewer.hidden) return;
    viewer.hidden = true; openWork = null;
    document.body.style.overflow = "";
    clearTimeout(idleTimer);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  uiImage($("#viewerClose").querySelector("img"), S.images.close, function (w, h) { var b = narrow() ? 48 : 64; return uiScale(w, h, b, b); }, $("#viewerClose"));
  $("#viewerClose").addEventListener("click", closeViewer);
  viewer.addEventListener("click", function (e) { if (dragJustEnded) return; if (e.target === viewer || e.target === vRow || e.target === vStage) closeViewer(); });
  document.addEventListener("keydown", function (e) {
    if (viewer.hidden) return;
    wake();
    if (e.key === "Escape") closeViewer();
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });

  /* Стрелки (PNG, три состояния) */
  var arrowBox = function () { return narrow() ? 40 : 64; };
  [[prevBtn, S.images.arrows.prev, -1], [nextBtn, S.images.arrows.next, 1]].forEach(function (a) {
    uiImage(a[0].querySelector("img"), a[1], function (w, h) { var b = arrowBox(); return uiScale(w, h, b, b); }, a[0]);
    a[0].addEventListener("click", function () { go(a[2]); });
  });
  langUpdaters.push(function () {
    $("#viewerClose").setAttribute("aria-label", T("close"));
    prevBtn.setAttribute("aria-label", T("prev")); nextBtn.setAttribute("aria-label", T("next"));
    $("#slider").setAttribute("aria-label", T("zoom"));
  });

  /* Свайп на телефоне. Если картинка больше экрана и пользователь её двигает, это прокрутка, а не листание. */
  var swipe = null;
  vRow.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { swipe = null; return; }
    var t = e.touches[0];
    swipe = { x: t.clientX, y: t.clientY, sl: vStage.scrollLeft, st: vStage.scrollTop };
  }, { passive: true });
  vRow.addEventListener("touchend", function (e) {
    if (!swipe) return;
    var t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
    var moved = vStage.scrollLeft !== swipe.sl || vStage.scrollTop !== swipe.st;
    swipe = null;
    if (!moved && Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* Перетаскивание мышью (на телефонах работает обычная прокрутка касанием) */
  var drag = null;
  vStage.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse" || e.button !== 0 || !vStage.classList.contains("pannable")) return;
    e.preventDefault();   // отключает встроенное перетаскивание картинки браузером
    drag = { x: e.clientX, y: e.clientY, sl: vStage.scrollLeft, st: vStage.scrollTop };
    vStage.setPointerCapture(e.pointerId); vStage.classList.add("dragging");
  });
  vStage.addEventListener("pointermove", function (e) {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > 3 || Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
    vStage.scrollLeft = drag.sl - (e.clientX - drag.x);
    vStage.scrollTop = drag.st - (e.clientY - drag.y);
  });
  vStage.addEventListener("dragstart", function (e) { e.preventDefault(); });
  var dragJustEnded = false;   // чтобы отпускание кнопки после перетаскивания не закрывало просмотр
  function endDrag() {
    if (drag && drag.moved) { dragJustEnded = true; setTimeout(function () { dragJustEnded = false; }, 50); }
    drag = null; vStage.classList.remove("dragging");
  }
  vStage.addEventListener("pointerup", endDrag);
  vStage.addEventListener("pointercancel", endDrag);

  /* Автоскрытие интерфейса просмотра после 2 секунд без движения */
  var idleTimer;
  function wake() {
    viewer.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { viewer.classList.add("idle"); }, 2000);
  }
  viewer.addEventListener("pointermove", wake);
  viewer.addEventListener("pointerdown", wake);

  /* ---------- Ползунок масштаба из PNG ----------
     Шаги 1..10. track и fill - плитки, повторяются по горизонтали в целых масштабах.
     Длина дорожки кратна ширине плитки track, поэтому пиксели не искажаются. */
  var slider = $("#slider"), zoomVal = $("#zoomVal");
  var sTrack = document.createElement("div"), sFill = document.createElement("div"), sThumb = document.createElement("img");
  sTrack.className = "s-track"; sFill.className = "s-fill"; sThumb.className = "px s-thumb"; sThumb.alt = "";
  slider.appendChild(sTrack); slider.appendChild(sFill); slider.appendChild(sThumb);
  var dim = {}, sLen = 0, sThumbW = 0, sCur = 1;
  ["track", "fill", "thumb"].forEach(function (k) {
    var i = new Image();
    i.onload = function () { dim[k] = { w: i.naturalWidth, h: i.naturalHeight }; layoutSlider(); };
    i.src = S.images.slider[k];
  });
  sTrack.style.backgroundImage = "url('" + S.images.slider.track + "')";
  sFill.style.backgroundImage = "url('" + S.images.slider.fill + "')";
  sThumb.src = S.images.slider.thumb;

  function layoutSlider() {
    if (!dim.track || !dim.fill || !dim.thumb) return;
    var R = ratio();
    var sc = Math.max(1, Math.round(Math.max(MIN, narrow() ? 2 : 3) * R));   // масштаб в физических пикселях
    var tile = dim.track.w * sc;
    var maxL = Math.max(tile, Math.min(280, viewportW() - 200) * R);
    sLen = Math.floor(maxL / tile) * tile;                                    // длина дорожки (физ. пиксели)
    var H = Math.max(dim.thumb.h, dim.track.h, dim.fill.h) * sc;
    slider.style.width = sLen / R + "px"; slider.style.height = H / R + "px";
    function place(el, d) {
      var hh = d.h * sc;
      el.style.height = hh / R + "px"; el.style.top = Math.round((H - hh) / 2) / R + "px";
      el.style.backgroundSize = d.w * sc / R + "px " + hh / R + "px";
    }
    sTrack.style.width = sLen / R + "px"; place(sTrack, dim.track); place(sFill, dim.fill);
    sThumbW = dim.thumb.w * sc;
    sThumb.style.width = sThumbW / R + "px"; sThumb.style.height = dim.thumb.h * sc / R + "px";
    sThumb.style.top = Math.round((H - dim.thumb.h * sc) / 2) / R + "px";
    setSliderValue(sCur);
  }
  function setSliderValue(v) {
    sCur = v;
    zoomVal.textContent = v + "x";
    slider.setAttribute("aria-valuenow", v); slider.setAttribute("aria-valuetext", v + "x");
    if (!sLen) return;
    var left = Math.round((v - 1) / 9 * (sLen - sThumbW));
    sThumb.style.left = left / ratio() + "px";
    sFill.style.width = (left + Math.round(sThumbW / 2)) / ratio() + "px";
  }
  /* Меняет масштаб так, чтобы точка изображения под (ax, ay) осталась на месте.
     Без ax/ay - точка в центре видимой области (так работает ползунок). */
  function userSet(v, ax, ay) {
    v = Math.max(1, Math.min(10, v));
    if (!openWork) return;
    var r = vImg.getBoundingClientRect(), sr = vStage.getBoundingClientRect();
    if (ax == null) { ax = sr.left + sr.width / 2; ay = sr.top + sr.height / 2; }
    var fx = r.width ? Math.max(0, Math.min(1, (ax - r.left) / r.width)) : 0.5;
    var fy = r.height ? Math.max(0, Math.min(1, (ay - r.top) / r.height)) : 0.5;
    userScale = v; refreshViewer();
    var r2 = vImg.getBoundingClientRect();
    vStage.scrollLeft += r2.left + fx * r2.width - ax;
    vStage.scrollTop += r2.top + fy * r2.height - ay;
  }
  /* Колёсико мыши: масштаб к точке под курсором, страница под просмотром не прокручивается */
  var wheelAcc = 0;
  viewer.addEventListener("wheel", function (e) {
    if (e.target.closest && e.target.closest("#viewerCaption") && vCap.scrollHeight > vCap.clientHeight) return;
    e.preventDefault();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    wheelAcc += dy;
    if (Math.abs(wheelAcc) >= 60) {
      userSet(sCur + (wheelAcc < 0 ? 1 : -1), e.clientX, e.clientY);
      wheelAcc = 0; wake();
    }
  }, { passive: false });
  function valueFromX(x) {
    var r = slider.getBoundingClientRect();
    var R = ratio(), rel = (x - r.left - sThumbW / R / 2) / Math.max(1, (sLen - sThumbW) / R);
    return Math.round(rel * 9) + 1;
  }
  var sliding = false;
  slider.addEventListener("pointerdown", function (e) { sliding = true; slider.setPointerCapture(e.pointerId); userSet(valueFromX(e.clientX)); });
  slider.addEventListener("pointermove", function (e) { if (sliding) userSet(valueFromX(e.clientX)); });
  slider.addEventListener("pointerup", function () { sliding = false; });
  slider.addEventListener("pointercancel", function () { sliding = false; });
  slider.addEventListener("keydown", function (e) {   // стрелки влево/вправо листают работы, поэтому здесь вверх/вниз
    var k = e.key, d = 0;
    if (k === "ArrowUp" || k === "PageUp") d = 1; else if (k === "ArrowDown" || k === "PageDown") d = -1;
    else if (k === "Home") { e.preventDefault(); userSet(1); return; } else if (k === "End") { e.preventDefault(); userSet(10); return; }
    if (d) { e.preventDefault(); userSet(sCur + d); }
  });
  scalers.push(layoutSlider);
  scalers.push(refreshViewer);

  /* ---------- Нижний арт ----------
     Наименьший целый масштаб, при котором ширина арта >= ширины окна. Центрируется, края обрезаются. */
  var fImg = $("#footerImg");
  scaled(fImg, S.images.footer, function (i) {
    var R = ratio();
    var vwDev = Math.ceil(document.documentElement.getBoundingClientRect().width * R - 1e-6);   // ширина окна в физических пикселях
    var s = Math.max(1, Math.ceil(vwDev / i.naturalWidth));
    fImg.style.marginLeft = css(Math.floor((vwDev - i.naturalWidth * s) / 2));
    return s;
  });

  /* ---------- Запуск ---------- */
  var raf, lastR = ratio();
  function relayout() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { lastR = ratio(); snapFonts(); scalers.forEach(function (f) { f(); }); alignAll(); });
  }
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", relayout);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", function () { if (Math.abs(ratio() - lastR) > 1e-4) relayout(); });

  /* Отладка на телефоне: откройте сайт с #debug в конце адреса */
  if (location.hash === "#debug") {
    var dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;right:0;top:0;z-index:99;background:#000;color:#0f0;font:12px/1.3 monospace;padding:4px;white-space:pre;pointer-events:none";
    document.body.appendChild(dbg);
    var upd = function () {
      var vv = window.visualViewport;
      dbg.textContent = "dpr " + window.devicePixelRatio + "\nvv.scale " + (vv ? vv.scale : "-") + "\nR " + ratio().toFixed(4) + "\ncss width " + viewportW();
    };
    scalers.push(upd); upd();
  }
  if (window.ResizeObserver) new ResizeObserver(scheduleAlign).observe(document.body);
  applyLang();
})();