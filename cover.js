/* ============================================================
   COVER ENGINE — Interactive case covers
   v1.0.0 | 2026-03-03

   Reusable engine for all 6 case covers.
   Generates DOM from config, handles hover/parallax/animations.

   Usage:
     new CoverEngine(document.getElementById('case-01-cover'), { ... })

   Подключение: <script src="cover.js" defer></script>
   ============================================================ */

(function () {
  'use strict';

  /* ---- Helper: create element with className ---- */
  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }


  /* ============================================================
     CoverEngine
     ============================================================ */

  function CoverEngine(container, config) {
    this.el = container;
    this.config = config;
    this._cover = null;
    this._funcEls = [];
    this._routeInterval = null;
    this._activeRoute = 0;
    this._hovered = false;
    this._onEnter = null;
    this._onLeave = null;
    this._onMove = null;

    /* Spring state — lerp-цикл для плавного следования за курсором */
    this._targetMx = 0.5;
    this._targetMy = 0.5;
    this._curMx    = 0.5;
    this._curMy    = 0.5;
    this._rafId    = null;

    /* frame-and-cards state */
    this._cards       = null;
    this._dotsEl      = null;
    this._dotsHoverBg = null;

    /* carousel-stack state */
    this._csWrapper              = null;
    this._carouselSlotEls        = [];
    this._activeIndex            = 0;
    this._seqRef                 = 0;
    this._carouselTimeoutId      = null;
    this._carouselIntervalId     = null;
    this._carouselAutoTimeoutId  = null;
    this._carouselAutoIntervalId = null;
    this._pdotEls                = [];
    this._mobileStack            = null;
    this._tabletObserver         = null;

    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._canHover = window.matchMedia('(hover: hover)').matches;
    this._desktopMQ = window.matchMedia('(min-width: 961px)');

    this._build();
    this._setupBreakpoints();

    if (this._canHover && !this._reducedMotion) {
      this._setupHover();
    }

    if (this.config.layout === 'carousel-stack' && !this._reducedMotion) {
      this._setupCarousel();
    }

    this._setupMobileStagger();
    this._setupScrollActivation();
  }


  /* ---- DOM generation ---- */

  CoverEngine.prototype._build = function () {
    var wrap = el('div', 'p-cover-wrap');
    var cover = el('div', 'p-cover');
    this._cover = cover;

    /* Layout modifier class */
    if (this.config.layout === 'frame-and-cards') {
      cover.classList.add('p-cover--fac');
    }
    if (this.config.layout === 'carousel-stack') {
      cover.classList.add('p-cover--cs');
      if (this.config.wideScreenshots) {
        cover.classList.add('p-cover--cs-wide');
      }
    }

    /* Background */
    var bgEl = el('div', 'p-cover__bg');
    if (this.config.bg && this.config.bg.gradient) {
      bgEl.style.background = this.config.bg.gradient;
    }
    cover.appendChild(bgEl);

    /* Grain (optional) */
    if (this.config.bg && this.config.bg.grain) {
      cover.appendChild(this._buildGrain());
    }

    /* Dot grid — store ref for dotgridHoverColor swap */
    var dotsEl = el('div', 'p-cover__dots');
    if (this.config.bg && this.config.bg.dotgridHoverColor) {
      this._dotsEl = dotsEl;
      this._dotsHoverBg = 'radial-gradient(' + this.config.bg.dotgridHoverColor + ' 0.5px, transparent 0.5px)';
    }
    cover.appendChild(dotsEl);

    /* Glow — support custom color */
    var glowEl = el('div', 'p-cover__glow');
    if (this.config.bg && this.config.bg.glowColor) {
      glowEl.style.background = 'radial-gradient(circle, ' + this.config.bg.glowColor + ' 0%, transparent 70%)';
    }
    cover.appendChild(glowEl);

    /* Frame glow — терракотовое свечение за фреймом (все обложки) */
    cover.appendChild(el('div', 'p-cover__frame-glow'));

    /* Layout-specific content */
    if (this.config.layout === 'frame-and-cards') {
      this._buildFrameAndCards(cover);
    } else if (this.config.layout === 'carousel-stack') {
      this._buildCarouselStack(cover);
    } else {
      /* Default: two-frames grid */
      var grid = el('div', 'p-cover__grid');
      if (this.config.left) {
        grid.appendChild(this._buildFrame(this.config.left, 'left'));
      }
      if (this.config.right) {
        grid.appendChild(this._buildFrame(this.config.right, 'right'));
      }
      cover.appendChild(grid);
    }

    /* Peek hints и pagination dots — только для carousel-stack */
    if (this.config.layout === 'carousel-stack') {
      this._buildPeekHints(cover);
      if (this.config.frames) {
        this._buildPaginationDots(cover, this.config.frames.length);
      }
    }

    /* Mobile card stack — показывается вместо десктопного контента на < 960px */
    if (this.config.mobile && this.config.mobile.cards) {
      var mobileStack = el('div', 'p-cover__mobile-stack p-hide-desktop');
      this.config.mobile.cards.forEach(function (card) {
        var img = document.createElement('img');
        img.src = card.src;
        img.alt = card.alt || '';
        img.loading = 'lazy';
        img.className = 'p-cover__mobile-card';
        mobileStack.appendChild(img);
      });
      cover.appendChild(mobileStack);
      this._mobileStack = mobileStack;
    }

    /* Vignette overlay */
    cover.appendChild(el('div', 'p-cover__vignette'));

    wrap.appendChild(cover);
    this.el.appendChild(wrap);
  };

  CoverEngine.prototype._buildFrame = function (config, side) {
    var frame = el('div', 'p-cover__frame p-cover__frame--' + side);

    /* Titlebar */
    var titlebar = el('div', 'p-cover__titlebar');

    var traffic = el('div', 'p-cover__traffic');
    ['close', 'minimize', 'maximize'].forEach(function (type) {
      traffic.appendChild(el('div', 'p-cover__dot p-cover__dot--' + type));
    });
    titlebar.appendChild(traffic);

    var filename = el('div', 'p-cover__filename');
    filename.textContent = config.title;
    titlebar.appendChild(filename);

    titlebar.appendChild(el('div', 'p-cover__titlebar-spacer'));
    frame.appendChild(titlebar);

    /* Content */
    var content = el('div', 'p-cover__content');
    if (config.type === 'prompt') {
      content.appendChild(this._buildPrompt(config.lines));
    } else if (config.type === 'architecture') {
      content.appendChild(this._buildArchitecture(config));
    } else if (config.type === 'screenshot') {
      content.appendChild(this._buildScreenshot(config));
    }
    frame.appendChild(content);

    return frame;
  };


  /* ---- Prompt content ---- */

  CoverEngine.prototype._buildPrompt = function (lines) {
    var wrap = el('div', 'p-cover__prompt');

    lines.forEach(function (line) {
      var div = el('div', 'p-cover__line' + (line.accent ? ' p-cover__line--key' : ''));
      div.textContent = line.text;

      if (line.cursor) {
        div.appendChild(el('span', 'p-cover__cursor'));
      }

      wrap.appendChild(div);
    });

    return wrap;
  };


  /* ---- Architecture content ---- */

  CoverEngine.prototype._buildArchitecture = function (config) {
    var wrap = el('div', 'p-cover__arch');
    var self = this;
    var nodes = config.nodes;
    var connectors = config.connectors || [];
    var functions = config.functions || [];
    var funcGridAfter = config.funcGridAfter;
    var connIdx = 0;

    for (var i = 0; i < nodes.length; i++) {
      /* Node */
      wrap.appendChild(this._createArchNode(nodes[i]));

      /* Connector after node (if not last) */
      if (connIdx < connectors.length && i < nodes.length - 1) {
        wrap.appendChild(this._createConnector(connectors[connIdx]));
        connIdx++;
      }

      /* Function grid after specified node */
      if (i === funcGridAfter && functions.length) {
        var grid = el('div', 'p-cover__func-grid');

        functions.forEach(function (func, fi) {
          var f = el('div', 'p-cover__func');
          f.setAttribute('data-func-index', fi);

          var icon = el('div', 'p-cover__func-icon');
          icon.textContent = func.icon;
          f.appendChild(icon);

          var name = el('div', 'p-cover__func-name');
          name.textContent = func.name;
          f.appendChild(name);

          grid.appendChild(f);
          self._funcEls.push(f);
        });

        wrap.appendChild(grid);

        /* Connector from grid to next node */
        if (connIdx < connectors.length) {
          wrap.appendChild(this._createConnector(connectors[connIdx]));
          connIdx++;
        }
      }
    }

    return wrap;
  };

  CoverEngine.prototype._createArchNode = function (cfg) {
    var node = el('div', 'p-cover__node' + (cfg.accent ? ' p-cover__node--accent' : ''));

    var icon = el('span', 'p-cover__node-icon');
    icon.textContent = cfg.icon;
    node.appendChild(icon);

    var info = document.createElement('div');

    var name = el('div', 'p-cover__node-name');
    name.textContent = cfg.name;
    info.appendChild(name);

    if (cfg.sub) {
      var sub = el('div', 'p-cover__node-sub');
      sub.textContent = cfg.sub;
      info.appendChild(sub);
    }

    node.appendChild(info);
    return node;
  };

  CoverEngine.prototype._createConnector = function (cfg) {
    var conn = el('div', 'p-cover__connector' + (cfg.lit ? ' p-cover__connector--lit' : ''));
    conn.appendChild(el('div', 'p-cover__connector-line'));

    if (cfg.text) {
      var text = el('div', 'p-cover__connector-text');
      text.textContent = cfg.text;
      conn.appendChild(text);
    }

    conn.appendChild(el('div', 'p-cover__connector-line'));
    return conn;
  };


  /* ---- Frame-and-cards layout ---- */

  CoverEngine.prototype._buildFrameAndCards = function (cover) {
    var self = this;

    /* Main Mac frame */
    var mainWrap = el('div', 'p-cover__main-frame');
    var frameEl = this._buildFrame(this.config.frame, 'main');
    mainWrap.appendChild(frameEl);
    cover.appendChild(mainWrap);

    /* Card fan */
    if (this.config.cards && this.config.cards.length) {
      var cardsWrap = el('div', 'p-cover__cards');
      var fan = this.config.cardFan || {};
      var restSpread  = fan.restSpread  || 26;
      var hoverSpread = fan.hoverSpread || 80;
      var restAngle   = fan.restAngle   || 2.5;
      var hoverAngle  = fan.hoverAngle  || 7;
      var depths      = fan.depths      || [-6, -10, -14];

      this._cards = [];

      this.config.cards.forEach(function (card, i) {
        var cardEl = el('div', 'p-cover__card');
        cardEl.style.transitionDelay = (i * 0.04) + 's';
        cardEl.style.zIndex = self.config.cards.length - i;

        var pos = self._fanPositions(i, self.config.cards.length);
        cardEl.style.setProperty('--card-ry',      pos.sign * restSpread);
        cardEl.style.setProperty('--card-rrot',    pos.sign * restAngle);
        cardEl.style.setProperty('--card-hy',      pos.sign * hoverSpread);
        cardEl.style.setProperty('--card-hrot',    pos.sign * hoverAngle);
        cardEl.style.setProperty('--card-depth',   depths[i] !== undefined ? depths[i] : -10);

        if (card.src) {
          var img = document.createElement('img');
          img.className = 'p-cover__card-img';
          img.src = card.src;
          img.alt = card.alt || '';
          img.loading = 'lazy';
          cardEl.appendChild(img);
        }

        self._cards.push(cardEl);
        cardsWrap.appendChild(cardEl);
      });

      cover.appendChild(cardsWrap);
    }
  };

  CoverEngine.prototype._buildScreenshot = function (cfg) {
    var img = document.createElement('img');
    img.className = 'p-cover__screenshot';
    img.src = cfg.src || '';
    img.alt = cfg.alt || '';
    img.loading = 'lazy';
    return img;
  };

  CoverEngine.prototype._buildGrain = function () {
    var id = 'p-cover-grain-' + Math.random().toString(36).slice(2, 8);
    var ns = 'http://www.w3.org/2000/svg';

    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'p-cover__grain');
    svg.setAttribute('aria-hidden', 'true');

    var defs = document.createElementNS(ns, 'defs');
    var filter = document.createElementNS(ns, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('x', '0%');
    filter.setAttribute('y', '0%');
    filter.setAttribute('width', '100%');
    filter.setAttribute('height', '100%');

    var turb = document.createElementNS(ns, 'feTurbulence');
    turb.setAttribute('type', 'fractalNoise');
    turb.setAttribute('baseFrequency', '0.8');
    turb.setAttribute('numOctaves', '4');
    turb.setAttribute('stitchTiles', 'stitch');
    filter.appendChild(turb);

    var cm = document.createElementNS(ns, 'feColorMatrix');
    cm.setAttribute('type', 'saturate');
    cm.setAttribute('values', '0');
    filter.appendChild(cm);

    defs.appendChild(filter);
    svg.appendChild(defs);

    var rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('filter', 'url(#' + id + ')');
    svg.appendChild(rect);

    return svg;
  };

  CoverEngine.prototype._fanPositions = function (index, total) {
    if (total === 3) { return { sign: [-1, 0, 1][index] }; }
    if (total === 2) { return { sign: [-1, 1][index] }; }
    return { sign: total === 1 ? 0 : -1 + (2 * index / (total - 1)) };
  };


  /* ---- Carousel-stack layout ---- */

  CoverEngine.prototype._buildCarouselStack = function (cover) {
    var self = this;
    var frames = this.config.frames || [];

    /* wrapper — позиционирование + высота; overflow: visible → peek-хинты видны снизу */
    var wrapper = el('div', 'p-cover__cs-wrapper');
    this._csWrapper = wrapper;

    /* stack — только клиппинг анимации */
    var stack = el('div', 'p-cover__cs-stack');

    this._carouselSlotEls = [];

    frames.forEach(function (frame, i) {
      var slot = el('div', 'p-cover__cs-slot' + (i === 0 ? ' p-cover__cs-slot--active' : ''));
      var frameEl = self._buildFrame(frame, 'carousel');
      slot.appendChild(frameEl);
      self._carouselSlotEls.push(slot);
      stack.appendChild(slot);
    });

    wrapper.appendChild(stack);
    cover.appendChild(wrapper);
  };

  CoverEngine.prototype._buildFrameGlow = function (cover) {
    cover.appendChild(el('div', 'p-cover__frame-glow'));
  };

  CoverEngine.prototype._buildPeekHints = function (cover) {
    /* Вешаем на wrapper (если есть) — тогда top: 100% = прямо под фреймом */
    var parent = this._csWrapper || cover;
    parent.appendChild(el('div', 'p-cover__peek-1'));
    parent.appendChild(el('div', 'p-cover__peek-2'));
  };

  CoverEngine.prototype._buildPaginationDots = function (cover, count) {
    var self = this;
    var wrap = el('div', 'p-cover__pdots');
    this._pdotEls = [];

    for (var i = 0; i < count; i++) {
      var dot = el('div', 'p-cover__pdot' + (i === 0 ? ' p-cover__pdot--active' : ''));
      this._pdotEls.push(dot);
      wrap.appendChild(dot);
    }

    cover.appendChild(wrap);
  };

  CoverEngine.prototype._updatePaginationDots = function () {
    var active = this._activeIndex;
    this._pdotEls.forEach(function (dot, i) {
      dot.classList.toggle('p-cover__pdot--active', i === active);
    });
  };


  /* ---- Carousel cycling ---- */

  CoverEngine.prototype._advanceFrame = function () {
    var self = this;
    var slots = this._carouselSlotEls;
    if (!slots || slots.length < 2) return;

    var exitingIdx  = this._activeIndex;
    var enteringIdx = (this._activeIndex + 1) % slots.length;
    var exitingSlot  = slots[exitingIdx];
    var enteringSlot = slots[enteringIdx];

    /* Exiting: remove active, play spOut */
    exitingSlot.classList.remove('p-cover__cs-slot--active');
    exitingSlot.classList.add('p-cover__cs-slot--exiting');

    /* Entering: play spIn */
    enteringSlot.classList.add('p-cover__cs-slot--entering');

    this._activeIndex = enteringIdx;
    this._updatePaginationDots();

    /* Cleanup after animation completes (0.6s + tiny buffer) */
    var seq = ++this._seqRef;
    setTimeout(function () {
      if (seq !== self._seqRef) return;
      exitingSlot.classList.remove('p-cover__cs-slot--exiting');
      enteringSlot.classList.remove('p-cover__cs-slot--entering');
      enteringSlot.classList.add('p-cover__cs-slot--active');
    }, 650);
  };

  CoverEngine.prototype._resetCarousel = function () {
    var slots = this._carouselSlotEls;
    if (!slots) return;

    /* Bump seqRef so any pending cleanup callbacks become stale */
    this._seqRef++;

    slots.forEach(function (slot) {
      slot.classList.remove(
        'p-cover__cs-slot--active',
        'p-cover__cs-slot--exiting',
        'p-cover__cs-slot--entering'
      );
    });

    this._activeIndex = 0;
    slots[0].classList.add('p-cover__cs-slot--active');
    this._updatePaginationDots();
  };

  CoverEngine.prototype._startCarouselHover = function () {
    var self = this;
    var hover    = this.config.hover || {};
    var delay    = hover.firstDelay !== undefined ? hover.firstDelay : 900;
    var cycleMs  = hover.cycleMs    !== undefined ? hover.cycleMs    : 2500;

    this._carouselTimeoutId = setTimeout(function () {
      self._advanceFrame();
      self._carouselIntervalId = setInterval(function () {
        self._advanceFrame();
      }, cycleMs);
    }, delay);
  };

  CoverEngine.prototype._stopCarouselHover = function () {
    if (this._carouselTimeoutId) {
      clearTimeout(this._carouselTimeoutId);
      this._carouselTimeoutId = null;
    }
    if (this._carouselIntervalId) {
      clearInterval(this._carouselIntervalId);
      this._carouselIntervalId = null;
    }
  };

  CoverEngine.prototype._startCarouselAuto = function () {
    var self    = this;
    var delay   = 1500;
    var cycleMs = 3000;

    this._cover.classList.add('p-cover--autocycle');

    this._carouselAutoTimeoutId = setTimeout(function () {
      self._advanceFrame();
      self._carouselAutoIntervalId = setInterval(function () {
        self._advanceFrame();
      }, cycleMs);
    }, delay);
  };

  CoverEngine.prototype._stopCarouselAuto = function () {
    this._cover.classList.remove('p-cover--autocycle');
    if (this._carouselAutoTimeoutId) {
      clearTimeout(this._carouselAutoTimeoutId);
      this._carouselAutoTimeoutId = null;
    }
    if (this._carouselAutoIntervalId) {
      clearInterval(this._carouselAutoIntervalId);
      this._carouselAutoIntervalId = null;
    }
  };

  CoverEngine.prototype._setupCarousel = function () {
    var self = this;

    if (this._canHover) {
      /* Desktop: cycle starts on hover */
      this._cover.addEventListener('mouseenter', function () {
        if (!self._desktopMQ.matches) return;
        self._startCarouselHover();
      });
      this._cover.addEventListener('mouseleave', function () {
        if (!self._desktopMQ.matches) return;
        self._stopCarouselHover();
        self._resetCarousel();
      });
    }

    /* Respond to viewport size changes */
    this._desktopMQ.addEventListener('change', function (e) {
      if (e.matches) {
        /* Switched to desktop: stop auto-cycle, will start on hover */
        self._stopCarouselAuto();
        self._resetCarousel();
      } else {
        /* Switched to non-desktop: start auto-cycle */
        self._stopCarouselHover();
        self._startCarouselAuto();
      }
    });

    /* Initial state */
    if (!this._desktopMQ.matches) {
      this._startCarouselAuto();
    }
  };


  /* ---- Tablet breakpoint (frame-and-cards: open fan via scroll) ---- */

  CoverEngine.prototype._setupBreakpoints = function () {
    if (this.config.layout !== 'frame-and-cards' || !this._cards) return;
    var self = this;
    var mq = window.matchMedia('(max-width: 960px)');

    function onEnterTablet() {
      var screen = self.el.closest('.p-snap__screen');

      /* Fallback: нет IntersectionObserver или нет родительской секции */
      if (!screen || !('IntersectionObserver' in window)) {
        self._cover.classList.add('p-cover--tablet-open');
        return;
      }

      self._tabletObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            setTimeout(function () {
              self._cover.classList.add('p-cover--tablet-open');
            }, 120);
            self._tabletObserver.disconnect();
            self._tabletObserver = null;
          }
        });
      }, { threshold: 0.5 });

      self._tabletObserver.observe(screen);
    }

    function onLeaveTablet() {
      self._cover.classList.remove('p-cover--tablet-open');
      if (self._tabletObserver) {
        self._tabletObserver.disconnect();
        self._tabletObserver = null;
      }
    }

    mq.addEventListener('change', function (e) {
      if (e.matches) { onEnterTablet(); } else { onLeaveTablet(); }
    });

    if (mq.matches) { onEnterTablet(); }
  };


  /* ---- Spring tick (lerp RAF loop) ---- */

  CoverEngine.prototype._tick = function () {
    var self = this;
    var f = 0.12; /* коэффициент пружины: 0.12 — живее, без двойного тормоза от CSS-transition */

    this._curMx += (this._targetMx - this._curMx) * f;
    this._curMy += (this._targetMy - this._curMy) * f;

    this._cover.style.setProperty('--mx', this._curMx);
    this._cover.style.setProperty('--my', this._curMy);

    if (Math.abs(this._curMx - this._targetMx) > 0.0005 ||
        Math.abs(this._curMy - this._targetMy) > 0.0005) {
      this._rafId = requestAnimationFrame(function () { self._tick(); });
    } else {
      /* Зафиксировать точное значение и остановить цикл */
      this._cover.style.setProperty('--mx', this._targetMx);
      this._cover.style.setProperty('--my', this._targetMy);
      this._rafId = null;
    }
  };


  /* ---- Hover interactions ---- */

  CoverEngine.prototype._setupHover = function () {
    var self = this;
    var cover = this._cover;

    this._onEnter = function () {
      if (!self._desktopMQ.matches) return;
      self._hovered = true;
      cover.classList.add('p-cover--hovered');

      if (self.config.hover && self.config.hover.routeCycling) {
        self._startRouteCycling();
      }

      /* Swap dot grid to warm accent color (case 02) */
      if (self._dotsEl && self._dotsHoverBg) {
        self._dotsEl.style.backgroundImage = self._dotsHoverBg;
      }
    };

    this._onLeave = function () {
      self._hovered = false;
      cover.classList.remove('p-cover--hovered');
      self._stopRouteCycling();

      /* Restore default dot grid color */
      if (self._dotsEl) {
        self._dotsEl.style.backgroundImage = '';
      }
      /* Плавный возврат к центру через spring, а не мгновенный снап */
      self._targetMx = 0.5;
      self._targetMy = 0.5;
      if (!self._rafId) {
        self._rafId = requestAnimationFrame(function () { self._tick(); });
      }
    };

    this._onMove = function (e) {
      if (!self._hovered) return;
      var rect = cover.getBoundingClientRect();
      /* Обновляем только цель — tick-цикл плавно подтягивает текущее значение */
      self._targetMx = (e.clientX - rect.left) / rect.width;
      self._targetMy = (e.clientY - rect.top) / rect.height;
      if (!self._rafId) {
        self._rafId = requestAnimationFrame(function () { self._tick(); });
      }
    };

    cover.addEventListener('mouseenter', this._onEnter);
    cover.addEventListener('mouseleave', this._onLeave);
    cover.addEventListener('mousemove', this._onMove);

    /* Deactivate if viewport shrinks below desktop */
    this._desktopMQ.addEventListener('change', function (e) {
      if (!e.matches && self._hovered) {
        self._onLeave();
      }
    });
  };


  /* ---- Route cycling animation ---- */

  CoverEngine.prototype._startRouteCycling = function () {
    var self = this;
    this._activeRoute = 0;
    this._updateFuncHighlight();

    this._routeInterval = setInterval(function () {
      self._activeRoute = (self._activeRoute + 1) % self._funcEls.length;
      self._updateFuncHighlight();
    }, 1800);
  };

  CoverEngine.prototype._stopRouteCycling = function () {
    if (this._routeInterval) {
      clearInterval(this._routeInterval);
      this._routeInterval = null;
    }
    this._funcEls.forEach(function (f) {
      f.classList.remove('p-cover__func--active', 'p-cover__func--dimmed');
    });
    this._activeRoute = 0;
  };

  CoverEngine.prototype._updateFuncHighlight = function () {
    var active = this._activeRoute;
    this._funcEls.forEach(function (f, i) {
      f.classList.toggle('p-cover__func--active', i === active);
      f.classList.toggle('p-cover__func--dimmed', i !== active);
    });
  };


  /* ---- Mobile card entrance stagger ---- */

  CoverEngine.prototype._setupMobileStagger = function () {
    var stack = this._mobileStack;
    if (!stack) return;

    /* Fallback: no IntersectionObserver support */
    if (!('IntersectionObserver' in window)) {
      stack.classList.add('p-cover__mobile-stack--visible');
      return;
    }

    /* Find the ancestor snap-screen to observe */
    var screen = this.el.closest('.p-snap__screen');
    if (!screen) {
      stack.classList.add('p-cover__mobile-stack--visible');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          /* Small delay so snap settles before animation starts */
          setTimeout(function () {
            stack.classList.add('p-cover__mobile-stack--visible');
          }, 120);
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(screen);
  };


  /* ---- Scroll activation for non-hover devices (two-frames layout) ---- */

  CoverEngine.prototype._setupScrollActivation = function () {
    /* Only default (two-frames) layout on touch/non-hover devices */
    if (this._canHover) return;
    if (this.config.layout === 'frame-and-cards') return;
    if (this.config.layout === 'carousel-stack') return;

    var self = this;
    var screen = this.el.closest('.p-snap__screen');

    function activate() {
      self._cover.classList.add('p-cover--hovered');
      if (self.config.hover && self.config.hover.routeCycling && !self._reducedMotion) {
        self._startRouteCycling();
      }
    }

    if (!screen || !('IntersectionObserver' in window)) {
      activate();
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setTimeout(activate, 150);
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    observer.observe(screen);
  };


  /* ---- Cleanup ---- */

  CoverEngine.prototype.destroy = function () {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._stopRouteCycling();
    this._stopCarouselHover();
    this._stopCarouselAuto();
    if (this._tabletObserver) {
      this._tabletObserver.disconnect();
      this._tabletObserver = null;
    }
    if (this._cover && this._onEnter) {
      this._cover.removeEventListener('mouseenter', this._onEnter);
      this._cover.removeEventListener('mouseleave', this._onLeave);
      this._cover.removeEventListener('mousemove', this._onMove);
    }
    this.el.innerHTML = '';
  };


  /* ---- Expose ---- */
  window.CoverEngine = CoverEngine;


  /* ============================================================
     CASE 02 CONFIG — Аресты и взыскания
     ============================================================ */

  var CASE_02_CONFIG = {
    layout: 'frame-and-cards',
    bg: {
      gradient: '#2a324c',
      grain: true
    },
    frame: {
      type: 'screenshot',
      title: 'arrest_detail.tsx \u2014 SmartCare',
      src: 'images/Covers/arrest-detail-viewport.png',
      depth: -4
    },
    cards: [
      { src: 'images/Covers/v_BaselistItem-1.png', alt: 'Арест исполнен' },
      { src: 'images/Covers/v_BaselistItem-2.png', alt: 'Взыскание' },
      { src: 'images/Covers/v_BaselistItem-3.png', alt: 'На паузе' }
    ],
    cardFan: {
      restSpread:  26,
      hoverSpread: 80,
      restAngle:   2.5,
      hoverAngle:  7,
      depths: [-6, -10, -14]
    },
    hover: {
      tilt:       true,
      parallax:   true,
      frameShift: true
    },
    mobile: {
      cards: [
        { src: 'images/Covers/v_BaselistItem-1.png', alt: 'Арест исполнен' },
        { src: 'images/Covers/v_BaselistItem-2.png', alt: 'Взыскание' },
        { src: 'images/Covers/v_BaselistItem-3.png', alt: 'На паузе' }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cover02 = document.getElementById('case-02-cover');
    if (cover02) {
      new CoverEngine(cover02, CASE_02_CONFIG);
    }
  });


  /* ============================================================
     CASE 01 CONFIG — AI-агент для налоговых консультаций
     ============================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    var coverEl = document.getElementById('case-01-cover');
    if (!coverEl) return;

    new CoverEngine(coverEl, {
      bg: {
        gradient: '#2a2f3a'
      },
      left: {
        type: 'prompt',
        title: 'router_prompt.md',
        lines: [
          { text: 'role:', accent: true },
          { text: '  Администратор на первой линии' },
          { text: '  поддержки клиентов по вопросам' },
          { text: '  налогов.' },
          { text: '' },
          { text: 'key_rules:', accent: true },
          { text: '  - Начислением налогов' },
          { text: '    занимается ФНС' },
          { text: '  - Банк называет только сумму' },
          { text: '    процентного дохода' },
          { text: '  - В текущем году платим' },
          { text: '    за прошлый' },
          { text: '  - Доходы физлица и ИП' },
          { text: '    не суммируются' },
          { text: '' },
          { text: 'style:', accent: true },
          { text: '  Живая и естественная речь.' },
          { text: '  Без \u00ABСейчас подумаю\u00BB \u2014' },
          { text: '  клиенту важен ответ по сути.' },
          { text: '' },
          { text: 'end:', accent: true },
          { text: '  Убедиться, что вопрос решён.' },
          { text: '  Если да \u2014 добавить "КОНЕЦ".', cursor: true }
        ]
      },
      right: {
        type: 'architecture',
        title: 'architecture.yaml',
        nodes: [
          { icon: '\uD83D\uDCDE', name: 'Клиент', sub: 'Звонок на 900' },
          { icon: '\uD83E\uDDE0', name: 'Маршрутизатор', sub: 'Намерение \u2192 1 из 6', accent: true },
          { icon: '\u2705', name: 'Критик', sub: 'Год корректен? Вопрос понят?' },
          { icon: '\uD83D\uDCAC', name: 'Ответ', sub: 'До 7 секунд' }
        ],
        connectors: [
          { text: 'вопрос', lit: true },
          { text: '1 из 6', lit: true },
          { text: 'ответ', lit: true },
          { lit: false }
        ],
        functions: [
          { icon: '\uD83D\uDCDA', name: 'RAG' },
          { icon: '\uD83D\uDD0A', name: 'IVR' },
          { icon: '\uD83C\uDFE6', name: 'API' },
          { icon: '\uD83D\uDCF1', name: 'SMS' },
          { icon: '\uD83D\uDC64', name: 'Опер.' },
          { icon: '\uD83D\uDD04', name: 'Возврат' }
        ],
        funcGridAfter: 1
      },
      hover: {
        routeCycling: true,
        tilt: true,
        parallax: true,
        rotateY: true
      }
    });
  });


  /* ============================================================
     CASE 03 CONFIG — Ставка и надбавки по вкладам
     ============================================================ */

  var CASE_03_CONFIG = {
    layout: 'carousel-stack',
    bg: {
      gradient: '#1a3e3e',
      grain: true
    },
    frames: [
      {
        type: 'screenshot',
        title: 'deposit_rate.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame_2131328627.png',
        alt: '\u041d\u0430\u043a\u043e\u043f\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0441\u0447\u0451\u0442, \u0441\u0442\u0430\u0432\u043a\u0430 14%'
      },
      {
        type: 'screenshot',
        title: 'partner_bonuses.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame_2131328629.png',
        alt: '\u041f\u043e\u043a\u0443\u043f\u043a\u0438 \u0443 \u043f\u0430\u0440\u0442\u043d\u0451\u0440\u043e\u0432, \u043d\u0430\u0434\u0431\u0430\u0432\u043a\u0438'
      },
      {
        type: 'screenshot',
        title: 'partner_transactions.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame_2131328641.png',
        alt: '\u0422\u0440\u0430\u0442\u044b \u0443 \u043f\u0430\u0440\u0442\u043d\u0451\u0440\u043e\u0432 \u0432 \u043c\u0430\u0435'
      }
    ],
    hover: {
      carousel: true,
      cycleMs: 2500,
      firstDelay: 900,
      tilt: true,
      parallax: true,
      cursorGlow: true
    },
    mobile: {
      cards: [
        { src: 'images/Covers/\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0438.png', alt: '\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0438 \u043f\u043e \u0432\u043a\u043b\u0430\u0434\u0443' },
        { src: 'images/Covers/\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0438-1.png', alt: '\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0430: \u043f\u0430\u0440\u0442\u043d\u0451\u0440\u0441\u043a\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430' },
        { src: 'images/Covers/\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0438-2.png', alt: '\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0430: \u043f\u0430\u043a\u0435\u0442 \u0443\u0441\u043b\u0443\u0433' },
        { src: 'images/Covers/\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0438-3.png', alt: '\u041d\u0430\u0434\u0431\u0430\u0432\u043a\u0430: \u043c\u0443\u043b\u044c\u0442\u0438\u0432\u0430\u043b\u044e\u0442\u043d\u044b\u0439 \u0432\u043a\u043b\u0430\u0434' }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cover03 = document.getElementById('case-03-cover');
    if (cover03) {
      new CoverEngine(cover03, CASE_03_CONFIG);
    }
  });


  /* ============================================================
     CASE 04 CONFIG — AI-агент по процентной ставке
     ============================================================ */

  var CASE_04_CONFIG = {
    layout: 'carousel-stack',
    bg: {
      gradient: '#231e38',
      grain: true
    },
    frames: [
      {
        type: 'screenshot',
        title: 'rate_agent.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame 4133415314.png',
        alt: '\u0410\u0418-\u0430\u0433\u0435\u043d\u0442 \u043f\u043e \u043f\u0440\u043e\u0446\u0435\u043d\u0442\u043d\u043e\u0439 \u0441\u0442\u0430\u0432\u043a\u0435'
      },
      {
        type: 'screenshot',
        title: 'capitalization.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame 4133415316.png',
        alt: '\u041a\u0430\u043f\u0438\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u0432\u043a\u043b\u0430\u0434\u0430'
      },
      {
        type: 'screenshot',
        title: 'agent_response.tsx \u2014 SmartCare',
        src: 'images/Covers/Frame 4133415317.png',
        alt: '\u041e\u0442\u0432\u0435\u0442 \u0430\u0433\u0435\u043d\u0442\u0430 \u043e\u043f\u0435\u0440\u0430\u0442\u043e\u0440\u0443'
      },
      {
        type: 'screenshot',
        title: '\u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f.tsx \u2014 SmartCare',
        src: 'images/Covers/\u041a\u0430\u043f\u0438\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f(2).png',
        alt: '\u0410\u0433\u0435\u043d\u0442: \u043a\u0430\u043f\u0438\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u043f\u0440\u043e\u0446\u0435\u043d\u0442\u043e\u0432'
      }
    ],
    hover: {
      carousel: true,
      cycleMs: 2500,
      firstDelay: 900,
      tilt: true,
      parallax: true,
      cursorGlow: true
    },
    mobile: {
      cards: [
        { src: 'images/Covers/v_AI Quote-1.png', alt: '\u041e\u0442\u0432\u0435\u0442 AI-\u0430\u0433\u0435\u043d\u0442\u0430 \u043f\u043e \u043f\u0440\u043e\u0446\u0435\u043d\u0442\u043d\u043e\u0439 \u0441\u0442\u0430\u0432\u043a\u0435' }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cover04 = document.getElementById('case-04-cover');
    if (cover04) {
      new CoverEngine(cover04, CASE_04_CONFIG);
    }
  });


  /* ============================================================
     CASE 05 CONFIG — Персональные предложения
     ============================================================ */

  var CASE_05_CONFIG = {
    layout: 'frame-and-cards',
    bg: {
      gradient: '#2e3830',
      grain: true
    },
    frame: {
      type: 'screenshot',
      title: 'personal_offers.tsx — SmartCare',
      src: 'images/Covers/Список ПП-2.png',
      depth: -4
    },
    cards: [
      { src: 'images/Covers/Персональные предложенияItem.png', alt: 'Персональное предложение' },
      { src: 'images/Covers/Персональные предложенияItem-1.png', alt: 'Детали предложения' }
    ],
    cardFan: {
      restSpread:  30,
      hoverSpread: 70,
      restAngle:   3,
      hoverAngle:  6,
      depths: [-6, -12]
    },
    hover: {
      tilt:       true,
      parallax:   true,
      frameShift: true
    },
    mobile: {
      cards: [
        { src: 'images/Covers/Персональные предложенияItem.png', alt: 'Персональное предложение' },
        { src: 'images/Covers/Персональные предложенияItem-1.png', alt: 'Детали предложения' }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cover05 = document.getElementById('case-05-cover');
    if (cover05) {
      new CoverEngine(cover05, CASE_05_CONFIG);
    }
  });


  /* ============================================================
     CASE 06 CONFIG — Подбор вклада и калькулятор
     ============================================================ */

  var CASE_06_CONFIG = {
    layout: 'carousel-stack',
    wideScreenshots: true,
    bg: {
      gradient: '#302838',
      grain: true
    },
    frames: [
      {
        type: 'screenshot',
        title: 'calculator_proto.tsx — SmartCare',
        src: 'images/Covers/Кальк протик.png',
        alt: 'Прототип калькулятора вкладов'
      },
      {
        type: 'screenshot',
        title: 'deposit_calculator.tsx — SmartCare',
        src: 'images/Covers/Прототип калькулятора.png',
        alt: 'Калькулятор подбора вклада'
      }
    ],
    hover: {
      carousel: true,
      cycleMs: 2500,
      firstDelay: 900,
      tilt: true,
      parallax: true,
      cursorGlow: true
    },
    mobile: {
      cards: [
        { src: 'images/Covers/Кальк протик.png', alt: 'Прототип калькулятора вкладов' },
        { src: 'images/Covers/Прототип калькулятора.png', alt: 'Калькулятор подбора вклада' }
      ]
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var cover06 = document.getElementById('case-06-cover');
    if (cover06) {
      new CoverEngine(cover06, CASE_06_CONFIG);
    }
  });

})();
