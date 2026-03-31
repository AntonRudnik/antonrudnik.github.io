/* ═══════════════════════════════════════════
   PROTECT v3 — NDA case protection
   Оверлей на каждой карточке + fullscreen на кейс-странице
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  var STORAGE_KEY = 'portfolio-unlocked';
  var HASH = 'f64b79a7d2493ddbb9aacaa69d6cca134ef190c8ed45a217cf640d93032af1c1';

  function isUnlocked() {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  }

  function setUnlocked() {
    localStorage.setItem(STORAGE_KEY, 'true');
  }

  async function checkPassword(value) {
    var data = new TextEncoder().encode(value);
    var buf = await crypto.subtle.digest('SHA-256', data);
    var arr = Array.from(new Uint8Array(buf));
    return arr.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('') === HASH;
  }

  function shakeInput(input, cls) {
    input.classList.add(cls);
    input.value = '';
    input.focus();
    setTimeout(function () { input.classList.remove(cls); }, 1000);
  }

  var isMainPage = !!document.querySelector('.p-case-screen');
  var isCasePage = !!document.querySelector('.ct-toc, .ct-container');

  // ── Main page: overlay on each case card ──

  function initMainPage() {
    if (isUnlocked()) return;

    document.body.classList.add('is-locked');

    var visuals = document.querySelectorAll('.p-case-screen .p-case-screen__visual');

    visuals.forEach(function (visual) {
      // Make visual a positioning context
      visual.style.position = 'relative';

      var overlay = document.createElement('div');
      overlay.className = 'p-case-lock';
      overlay.innerHTML =
        '<span class="p-case-lock__icon" aria-hidden="true">🔒</span>' +
        '<p class="p-case-lock__title">Кейс под&nbsp;NDA</p>' +
        '<p class="p-case-lock__desc">Введите пароль для&nbsp;просмотра</p>' +
        '<form class="p-case-lock__form" autocomplete="off">' +
          '<input type="password" class="p-case-lock__input" placeholder="Пароль" autocomplete="off">' +
          '<button type="submit" class="p-btn p-btn--outline">→</button>' +
        '</form>' +
        '<a href="https://t.me/akti_92" class="p-case-lock__tg" target="_blank" rel="noopener">Написать в&nbsp;Telegram</a>';

      visual.appendChild(overlay);

      var form = overlay.querySelector('.p-case-lock__form');
      var input = overlay.querySelector('.p-case-lock__input');

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var val = input.value.trim();
        if (!val) return;

        var ok = await checkPassword(val);
        if (ok) {
          setUnlocked();
          document.body.classList.remove('is-locked');
        } else {
          shakeInput(input, 'p-case-lock__input--error');
        }
      });

      // Stop click propagation so card interactions don't fire
      overlay.addEventListener('click', function (e) { e.stopPropagation(); });
    });
  }

  // ── Case page: fullscreen overlay ──

  function initCasePage() {
    if (isUnlocked()) return;

    document.body.classList.add('is-case-locked');

    var overlay = document.createElement('div');
    overlay.className = 'p-password-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Введите пароль');

    overlay.innerHTML =
      '<div class="p-password-overlay__box">' +
        '<span class="p-password-overlay__icon" aria-hidden="true">🔒</span>' +
        '<p class="p-password-overlay__title">Кейс под&nbsp;NDA</p>' +
        '<p class="p-password-overlay__desc">Введите пароль для&nbsp;просмотра.<br>Если пароля нет&nbsp;&mdash; напишите мне.</p>' +
        '<form class="p-password-overlay__form" autocomplete="off">' +
          '<input type="password" class="p-password-overlay__input" placeholder="Пароль" autocomplete="off">' +
          '<button type="submit" class="p-password-overlay__btn">Открыть</button>' +
        '</form>' +
        '<div class="p-password-overlay__links">' +
          '<a href="/" class="p-password-overlay__link">&larr; На&nbsp;главную</a>' +
          '<a href="https://t.me/akti_92" class="p-password-overlay__link" target="_blank" rel="noopener">Telegram</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var form = overlay.querySelector('.p-password-overlay__form');
    var input = overlay.querySelector('.p-password-overlay__input');

    // Prevent iOS Safari zoom on input focus
    var vpMeta = document.querySelector('meta[name="viewport"]');
    if (vpMeta) {
      var vpOriginal = vpMeta.getAttribute('content');
      var vpNoZoom = vpOriginal.replace(/maximum-scale=[^,]*,?\s*/g, '') + ', maximum-scale=1';
      input.addEventListener('focus', function () { vpMeta.setAttribute('content', vpNoZoom); });
      input.addEventListener('blur', function () { vpMeta.setAttribute('content', vpOriginal); });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val) return;

      var ok = await checkPassword(val);
      if (ok) {
        setUnlocked();
        document.body.classList.remove('is-case-locked');
        overlay.setAttribute('aria-hidden', 'true');
        setTimeout(function () { overlay.remove(); }, 600);
      } else {
        shakeInput(input, 'p-password-overlay__input--error');
      }
    });

    requestAnimationFrame(function () { input.focus(); });
  }

  // ── Init ──

  document.addEventListener('DOMContentLoaded', function () {
    if (isMainPage) initMainPage();
    if (isCasePage && !isMainPage) initCasePage();
  });
})();
