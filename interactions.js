/* ============================================================
   PORTFOLIO DESIGN SYSTEM — INTERACTIONS
   v2.0.0 | 2026-02-26
   
   Garri: dot navigation, cross-fade текста, scroll tracking.
   Michael: minimal, fast.
   
   Подключение: <script src="interactions.js" defer></script>
   ============================================================ */

(function () {
  'use strict';

  /* ---- 1. SCROLL REVEAL ---- */
  function initReveal() {
    var els = document.querySelectorAll('.p-reveal');
    if (!els.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    els.forEach(function (el) { obs.observe(el); });
  }

  /* ---- 2. DOT NAVIGATION (scroll-snap pages) ----
     Garri: vertical dots tracking current section.
     Works with .p-snap container + .p-snap__screen children.
     Updates .p-dots__dot--active.
  */
  function initDots() {
    var snap = document.querySelector('.p-snap');
    var dots = document.querySelectorAll('.p-dots__dot');
    var screens = document.querySelectorAll('.p-snap__screen');
    if (!snap || !dots.length || !screens.length) return;

    function update() {
      var scrollTop = snap.scrollTop;
      var h = snap.clientHeight;
      var idx = Math.round(scrollTop / h);
      dots.forEach(function (d, i) {
        d.classList.toggle('p-dots__dot--active', i === idx);
      });
    }

    snap.addEventListener('scroll', function () {
      requestAnimationFrame(update);
    }, { passive: true });

    // Click to scroll
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        screens[i].scrollIntoView({ behavior: 'smooth' });
      });
    });

    update();
  }

  /* ---- 3. CROSS-FADE SIDEBAR TEXT ----
     Garri: sticky sidebar text fades between sections.
     Each .p-crossfade block maps to a section in the main content.
     data-section="id" links crossfade block to observed section.
  */
  function initCrossfade() {
    var blocks = document.querySelectorAll('.p-crossfade');
    if (!blocks.length) return;

    var sections = [];
    blocks.forEach(function (block) {
      var id = block.dataset.section;
      var target = id ? document.getElementById(id) : null;
      if (target) sections.push({ block: block, target: target });
    });

    if (!sections.length) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          blocks.forEach(function (b) { b.classList.remove('is-active'); });
          var match = sections.find(function (s) { return s.target === entry.target; });
          if (match) match.block.classList.add('is-active');
        }
      });
    }, { rootMargin: '-30% 0px -50% 0px' });

    sections.forEach(function (s) { obs.observe(s.target); });

    // Activate first by default
    if (sections[0]) sections[0].block.classList.add('is-active');
  }

  /* ---- 4. SCROLL PROGRESS BAR ---- */
  function initProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;
    var ticking = false;
    function update() {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.pageYOffset / h * 100) : 0) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  /* ---- 5. COUNTER ANIMATION ----
     HTML: <span class="p-counter" data-target="-37" data-suffix="%">0%</span>
  */
  function animateCounter(el) {
    var target = parseFloat(el.dataset.target) || 0;
    var suffix = el.dataset.suffix || '';
    var prefix = el.dataset.prefix || '';
    var dur = 1000;
    var isFloat = target % 1 !== 0;

    // Lock width to widest digit to prevent layout shift (proportional fonts)
    var saved = el.textContent;
    var maxW = 0;
    var absTarget = Math.ceil(Math.abs(target));
    var signStr = target < 0 ? '\u2212' : prefix.replace('+','');
    for (var d = 0; d <= absTarget; d++) {
      el.textContent = signStr + d + suffix;
      if (el.offsetWidth > maxW) maxW = el.offsetWidth;
    }
    el.style.minWidth = maxW + 'px';
    el.textContent = saved;

    var start = performance.now();

    (function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = target * eased;
      var sign = v < 0 ? '\u2212' : (v > 0 && prefix === '+' ? '+' : '');
      v = Math.abs(v);
      el.textContent = sign + prefix.replace('+','') + (isFloat ? v.toFixed(1).replace('.', ',') : Math.round(v)) + suffix;
      if (p < 1) {
        requestAnimationFrame(tick);
      }
    })(start);
  }

  function initCounters() {
    var counters = document.querySelectorAll('.p-counter');
    if (!counters.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCounter(e.target); obs.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { obs.observe(el); });
  }


  /* ---- 6. BURGER MENU ---- */
  function initBurger() {
    var btn = document.querySelector('.p-header__burger');
    var menu = document.getElementById('mobile-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var open = !menu.hidden;
      menu.hidden = open;
      btn.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
      document.body.style.overflow = open ? '' : 'hidden';
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.hidden = true;
        btn.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---- 7. SMOOTH SCROLL TO ANCHORS ---- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id === '#') return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, null, id);
    });
  }

  /* ---- 8. TOC ACTIVE STATE ---- */
  function initTOC() {
    var links = document.querySelectorAll('.p-toc__link');
    if (!links.length) return;
    var sections = [];
    links.forEach(function (l) {
      var id = l.getAttribute('href');
      if (id && id.charAt(0) === '#') {
        var el = document.getElementById(id.slice(1));
        if (el) sections.push({ el: el, link: l });
      }
    });
    if (!sections.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('p-toc__link--active'); });
          var m = sections.find(function (s) { return s.el === e.target; });
          if (m) m.link.classList.add('p-toc__link--active');
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(function (s) { obs.observe(s.el); });
  }

  /* ---- 9. TABS ---- */
  function initTabs() {
    document.querySelectorAll('.p-tabs').forEach(function (tabs) {
      var btns = tabs.querySelectorAll('.p-tabs__tab');
      var panels = tabs.querySelectorAll('.p-tabs__panel');

      btns.forEach(function (btn, i) {
        btn.addEventListener('click', function () {
          btns.forEach(function (b) { b.classList.remove('is-active'); });
          panels.forEach(function (p) { p.classList.remove('is-active'); });
          btn.classList.add('is-active');
          if (panels[i]) panels[i].classList.add('is-active');
        });
      });
    });
  }


  /* ---- 10. WORD TRANSFORMER ----
     HTML: <span class="p-transformer" data-words="сложно,масштабно,системно,думают">сложно</span>
     Scramble-эффект при каждой смене слова.
  */
  function initTransformer() {
    var el = document.querySelector('.p-transformer');
    if (!el) return;

    var words = (el.dataset.words || '').split(',').map(function (w) { return w.trim(); });
    if (words.length < 2) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.transition = 'opacity 0.3s';
      var ridx = 0;
      setInterval(function () {
        ridx = (ridx + 1) % words.length;
        el.style.opacity = '0';
        setTimeout(function () { el.textContent = words[ridx]; el.style.opacity = '1'; }, 300);
      }, 3000);
      return;
    }

    var chars = 'абдеиклопрст'; // узкий набор — меньше визуального шума
    var charDelay = 50;      // мс между стартом каждой позиции
    var scrambleDur = 80;    // мс хаоса на позицию — коротко, не успевает надоесть
    var displayTime = 3000;  // мс отображения слова до следующей смены

    // Фиксируем ширину по самому длинному слову — без layout shift
    var maxW = 0;
    var saved = el.textContent;
    el.style.display = 'inline-block';
    words.forEach(function (w) {
      el.textContent = w;
      if (el.offsetWidth > maxW) maxW = el.offsetWidth;
    });
    el.textContent = saved;
    el.style.minWidth = maxW + 'px';

    var idx = 0;

    function scrambleTo(target, done) {
      var start = performance.now();
      var len = target.length;
      var settled = new Array(len).fill(false);

      (function tick(now) {
        var elapsed = now - start;
        var html = '';
        var allDone = true;

        for (var i = 0; i < len; i++) {
          if (settled[i]) {
            // Буква зафиксировалась — полная яркость
            html += target[i];
          } else if (elapsed >= i * charDelay) {
            var charElapsed = elapsed - i * charDelay;
            if (charElapsed >= scrambleDur) {
              settled[i] = true;
              html += target[i];
            } else {
              // Активный скрэмбл — dim, читается как «поиск»
              allDone = false;
              html += '<span style="opacity:0.25">' +
                chars[Math.floor(Math.random() * chars.length)] +
                '</span>';
            }
          } else {
            // Ещё не началась — невидима
            allDone = false;
            html += '<span style="opacity:0">\u00a0</span>';
          }
        }

        el.innerHTML = html;

        if (allDone) {
          el.textContent = target;
          if (done) done();
        } else {
          requestAnimationFrame(tick);
        }
      })(start);
    }

    function next() {
      idx = (idx + 1) % words.length;
      scrambleTo(words[idx], function () {
        setTimeout(next, displayTime);
      });
    }

    setTimeout(next, displayTime);
  }


  /* ---- 11. GLOWING BORDER EFFECT ----
     HTML: добавь data-glow к любому .p-btn
     Терракотовый arc следует за курсором по границе кнопки.
  */
  function initGlowingButtons() {
    if (!window.matchMedia('(hover: hover)').matches) return;
    var elems = document.querySelectorAll('[data-glow]');
    if (!elems.length) return;

    var proximity = 40;
    var inactiveZone = 0.7;
    var mouse = { x: 0, y: 0 };
    var raf = 0;

    var items = [];
    elems.forEach(function (el) {
      var wrap = document.createElement('span');
      wrap.className = 'p-glow-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      el.appendChild(wrap);
      items.push({ el: el, wrap: wrap, angle: 0 });
    });

    function tick() {
      var anyActive = false;
      items.forEach(function (item) {
        var r = item.el.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dist = Math.hypot(mouse.x - cx, mouse.y - cy);
        var inactiveR = 0.5 * Math.min(r.width, r.height) * inactiveZone;

        if (dist < inactiveR) {
          item.wrap.style.setProperty('--active', '0');
          return;
        }

        var active =
          mouse.x > r.left - proximity && mouse.x < r.right + proximity &&
          mouse.y > r.top - proximity && mouse.y < r.bottom + proximity;

        item.wrap.style.setProperty('--active', active ? '1' : '0');
        if (!active) return;

        anyActive = true;
        var target = (180 * Math.atan2(mouse.y - cy, mouse.x - cx)) / Math.PI + 90;
        var diff = ((target - item.angle + 180) % 360) - 180;
        item.angle += diff * 0.15;
        item.wrap.style.setProperty('--start', String(item.angle));
      });

      raf = anyActive ? requestAnimationFrame(tick) : 0;
    }

    document.body.addEventListener('pointermove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }


  /* ---- INIT ---- */
  document.addEventListener('DOMContentLoaded', function () {
    initReveal();
    initDots();
    initCrossfade();
    initProgress();
    initCounters();
    initBurger();
    initSmoothScroll();
    initTOC();
    initTabs();
    initGlowingButtons();
    initTransformer();
    initCareerTabs();
  });

  /* ─── Career employer tabs ─── */
  function initCareerTabs() {
    var employers = document.querySelectorAll('.p-employer--clickable[data-employer]');
    var panels = document.querySelectorAll('.p-career__panel[data-panel]');
    var detail = document.querySelector('.p-career__detail');
    if (!employers.length || !panels.length || !detail) return;

    // Fix detail to exact height of tallest panel — no layout shift
    var maxH = 0;
    panels.forEach(function(p) {
      p.style.display = 'flex';
      if (p.offsetHeight > maxH) maxH = p.offsetHeight;
      p.style.display = '';
    });
    var cs = getComputedStyle(detail);
    var padV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    detail.style.height = (maxH + padV) + 'px';

    employers.forEach(function(emp) {
      emp.addEventListener('click', function() {
        var key = emp.getAttribute('data-employer');
        employers.forEach(function(e) { e.classList.remove('is-active'); });
        panels.forEach(function(p) { p.classList.remove('is-active'); });
        emp.classList.add('is-active');
        var panel = document.querySelector('.p-career__panel[data-panel="' + key + '"]');
        if (panel) panel.classList.add('is-active');
      });
    });
  }

})();
