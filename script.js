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

  /* Наибольший целый масштаб (1..max), при котором картинка помещается в рамку.
     Если не помещается даже в 1x, остаётся 1x. */
  function fitScale(w, h, maxW, maxH, max) {
    var s = Math.floor(Math.min(maxW / w, maxH / h));
    return Math.max(1, Math.min(max || 10, s));
  }
  /* То же для картинок интерфейса, но не меньше MIN (по умолчанию 2x) */
  function uiScale(w, h, maxW, maxH) { return Math.max(MIN, fitScale(w, h, maxW, maxH, 10)); }

  function applySize(img, s) {
    img.style.width = img.naturalWidth * s + "px";
    img.style.height = img.naturalHeight * s + "px";
  }
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
  function uiImage(img, srcs, getScale, host, isSelected) {
    if (typeof srcs === "string") srcs = { normal: srcs };
    var st = { normal: srcs.normal, hover: srcs.hover || srcs.normal, active: srcs.active || srcs.hover || srcs.normal };
    var hovering = false, pressing = false, w = 0, h = 0;
    ["hover", "active"].forEach(function (k) { if (st[k] !== st.normal) { new Image().src = st[k]; } });  // предзагрузка
    function draw() {
      var k = (pressing || (isSelected && isSelected())) ? "active" : (hovering ? "hover" : "normal");
      if (img.getAttribute("src") !== st[k]) img.src = st[k];
    }
    function size() { if (w) { var s = getScale(w, h); img.style.width = w * s + "px"; img.style.height = h * s + "px"; } }
    var probe = new Image();
    probe.onload = function () { w = probe.naturalWidth; h = probe.naturalHeight; size(); };
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
    return draw;
  }

  /* Рамка из 9 тайлов (canvas). Углы - по одному, края и центр - повторяются плиткой.
     Размер блока подгоняется под целое число тайлов (ширина округляется вниз, высота вверх),
     поэтому тайлы никогда не обрезаются и не перекрываются.
     Вариации: для каждой клетки случайно, с весами из frames.variantWeights (один раз за загрузку). */
  var SLOTS = ["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"];
  function frame(host, setName) {
    var cfg = S.frames && S.frames[setName];
    if (!cfg) return;
    var weights = S.frames.variantWeights || [70, 20, 10];
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
      var s = narrow() ? MIN : Math.max(MIN, S.frames.scale || 2);
      var sw = tw * s, sh = th * s;
      var rowMode = cfg.layout === "row";   // "row": панель из левого, центрального и правого тайла
      var bw = (cfg.borderWidth == null ? tw : cfg.borderWidth) * s + (cfg.padding || 0);
      host.style.padding = rowMode ? (cfg.paddingY || 0) + "px " + bw + "px" : bw + "px";
      // ширина: целое число тайлов (не меньше 3), не шире доступного места
      host.style.width = ""; host.style.minHeight = "";
      var W = Math.max(3, Math.floor(host.clientWidth / sw)) * sw;
      host.style.width = W + "px";
      // высота: содержимое, округлённое вверх до целого числа тайлов
      var H = Math.max(rowMode ? 1 : 3, Math.ceil(host.offsetHeight / sh)) * sh;
      host.style.minHeight = H + "px";
      cv.width = W; cv.height = H; cv.style.width = W + "px"; cv.style.height = H + "px";
      var ctx = cv.getContext("2d"); ctx.imageSmoothingEnabled = false;
      function region(x, y, w, h, k) {
        var i = 0;
        for (var yy = y; yy < y + h; yy += sh) for (var xx = x; xx < x + w; xx += sw) {
          var im = pick(k, i++); if (im) ctx.drawImage(im, xx, yy, sw, sh);
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

  /* ---------- Приветствие ---------- */
  function iconBox() { return narrow() ? 96 : 160; }
  uiImage($("#avatar"), S.images.avatar, function (w, h) { var b = iconBox(); return uiScale(w, h, b, b); });
  uiImage($("#status"), S.images.status, function (w, h) { var b = iconBox() / 3; return uiScale(w, h, b, b); });

  frame($("#welcome"), "welcome");

  /* ---------- Контакты ---------- */
  var contactsEl = $("#contacts");
  S.contacts.forEach(function (c) {
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
    uiImage(icon, c.icon, function (w, h) { return uiScale(w, h, 32, 32); }, el);
    var label = document.createElement("span");
    label.className = "label";
    var text = document.createElement("span"); text.textContent = c.text;
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
    frame(el, "social");

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
      var maxW = Math.max(40, galleryEl.clientWidth - 18);
      var s = fitScale(i.naturalWidth, i.naturalHeight, maxW, 640, 10);
      card.style.width = Math.max(i.naturalWidth * s, Math.min(200, maxW)) + 18 + "px";
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
    vStage.classList.toggle("pannable", vImg.naturalWidth * s > vStage.clientWidth || vImg.naturalHeight * s > vStage.clientHeight);
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
    var sc = Math.max(MIN, narrow() ? 2 : 3);
    var tile = dim.track.w * sc;
    var maxL = Math.max(tile, Math.min(280, viewportW() - 200));
    sLen = Math.floor(maxL / tile) * tile;
    var H = Math.max(dim.thumb.h, dim.track.h, dim.fill.h) * sc;
    slider.style.width = sLen + "px"; slider.style.height = H + "px";
    function place(el, d) {
      var hh = d.h * sc;
      el.style.height = hh + "px"; el.style.top = Math.round((H - hh) / 2) + "px";
      el.style.backgroundSize = d.w * sc + "px " + hh + "px";
    }
    sTrack.style.width = sLen + "px"; place(sTrack, dim.track); place(sFill, dim.fill);
    sThumbW = dim.thumb.w * sc;
    sThumb.style.width = sThumbW + "px"; sThumb.style.height = dim.thumb.h * sc + "px";
    sThumb.style.top = Math.round((H - dim.thumb.h * sc) / 2) + "px";
    setSliderValue(sCur);
  }
  function setSliderValue(v) {
    sCur = v;
    zoomVal.textContent = v + "x";
    slider.setAttribute("aria-valuenow", v); slider.setAttribute("aria-valuetext", v + "x");
    if (!sLen) return;
    var left = Math.round((v - 1) / 9 * (sLen - sThumbW));
    sThumb.style.left = left + "px";
    sFill.style.width = left + Math.round(sThumbW / 2) + "px";
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
    var rel = (x - r.left - sThumbW / 2) / Math.max(1, sLen - sThumbW);
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
    var vw = viewportW();
    var s = Math.max(1, Math.ceil(vw / i.naturalWidth));
    fImg.style.marginLeft = Math.floor((vw - i.naturalWidth * s) / 2) + "px";
    return s;
  });

  /* ---------- Запуск ---------- */
  var raf;
  window.addEventListener("resize", function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { scalers.forEach(function (f) { f(); }); });
  });
  applyLang();
})();
