/* ============================================================
   PORTFOLIO — SOUND DESIGN
   v5.0.0 | 2026-03-13

   Dieter Rams. Braun. Ламповость.

   — hover:  сэмпл шариковой ручки (sounds/01-hover.wav)
   — click:  сэмпл car door latch (sounds/02-click.wav)
   — pop:    синтез — аккорд C4-E4, включение звука

   Подключение: <script src="sound.js" defer></script>
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'portfolio-sound-v2';
  var HOVER_SRC = '/sounds/01-hover.wav';
  var CLICK_SRC = '/sounds/02-click.wav';
  var ctx = null;
  var hoverBuffer = null;
  var clickBuffer = null;
  var enabled = localStorage.getItem(STORAGE_KEY) === 'on';
  var initialized = false;
  var btn = null;

  function ensureCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  // Загрузка сэмплов
  function loadSample(url, cb) {
    var ac = ensureCtx();
    fetch(url)
      .then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { return ac.decodeAudioData(buf); })
      .then(cb)
      .catch(function () {});
  }

  function loadSamples() {
    if (!hoverBuffer) loadSample(HOVER_SRC, function (b) { hoverBuffer = b; });
    if (!clickBuffer) loadSample(CLICK_SRC, function (b) { clickBuffer = b; });
  }

  // Двойной lowpass — аналоговая теплота.
  function makeWarm(ac) {
    var lp1 = ac.createBiquadFilter();
    lp1.type = 'lowpass';
    lp1.frequency.value = 1800;
    lp1.Q.value = 0.5;

    var lp2 = ac.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 2200;
    lp2.Q.value = 0.4;

    lp1.connect(lp2);
    return { input: lp1, output: lp2 };
  }

  /* ---- HOVER ---- */
  function playHover() {
    if (!enabled || !hoverBuffer) return;
    var ac = ensureCtx();
    var src = ac.createBufferSource();
    src.buffer = hoverBuffer;

    var g = ac.createGain();
    g.gain.value = 1.5;

    var w = makeWarm(ac);
    src.connect(w.input);
    w.output.connect(g);
    g.connect(ac.destination);
    src.start(ac.currentTime);
  }

  /* ---- CLICK ---- */
  function playClick() {
    if (!enabled || !clickBuffer) return;
    var ac = ensureCtx();
    var src = ac.createBufferSource();
    src.buffer = clickBuffer;

    var g = ac.createGain();
    g.gain.value = 1.3;

    var w = makeWarm(ac);
    src.connect(w.input);
    w.output.connect(g);
    g.connect(ac.destination);
    src.start(ac.currentTime);
  }

  /* ---- POP ----
     Тумблер: короткий «тук» — нота скользит вверх.
     Быстро, тактильно, деликатно. Как iOS toggle.
  */
  function playPop() {
    if (!enabled) return;
    var ac = ensureCtx();
    var t = ac.currentTime;

    var master = ac.createGain();
    master.gain.value = 0.35;
    master.connect(ac.destination);

    var lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.Q.value = 0.4;
    lp.connect(master);

    // Нота с pitch-glide вверх — ощущение «щёлк, включил»
    var osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.06);

    var g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.45, t + 0.006);
    g.gain.setTargetAtTime(0, t + 0.05, 0.06);

    osc.connect(g);
    g.connect(lp);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  /* ---- TOGGLE ---- */

  function updateBtn() {
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.classList.toggle('is-muted', !enabled);
  }

  function toggle() {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
    updateBtn();
    if (enabled) playPop();
  }

  /* ---- EVENT WIRING ---- */

  function initSoundEvents() {
    if (initialized) return;
    initialized = true;

    var hoverTargets =
      '.p-header__link, .p-header__cta, .p-dots__dot, ' +
      '.p-mobile-menu__link, .p-case-nav__link, .p-toc__link, ' +
      '[data-glow], .p-btn';

    document.addEventListener('pointerover', function (e) {
      var target = e.target.closest(hoverTargets);
      if (target && e.pointerType !== 'touch') playHover();
    }, { passive: true });

    var clickTargets =
      '.p-header__link, .p-header__cta, .p-dots__dot, ' +
      '.p-header__burger, .p-mobile-menu__link, .p-tabs__tab, ' +
      '.p-case-nav__link, .p-toc__link, [data-glow], .p-btn';

    document.addEventListener('pointerdown', function (e) {
      var target = e.target.closest(clickTargets);
      if (target) playClick();
    }, { passive: true });
  }

  /* ---- INIT ---- */

  function init() {
    btn = document.querySelector('.p-header__sound');
    if (btn) {
      updateBtn();
      btn.addEventListener('click', function () {
        ensureCtx();
        toggle();
      });
    }

    var activateOnce = function () {
      ensureCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume();
      loadSamples();
      initSoundEvents();
      document.removeEventListener('click', activateOnce);
      document.removeEventListener('keydown', activateOnce);
      document.removeEventListener('touchstart', activateOnce);
    };

    document.addEventListener('click', activateOnce);
    document.addEventListener('keydown', activateOnce);
    document.addEventListener('touchstart', activateOnce);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PortfolioSound = {
    hover: playHover,
    click: playClick,
    pop: playPop
  };

})();
