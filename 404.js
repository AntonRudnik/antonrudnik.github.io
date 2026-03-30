(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var lightbox = document.getElementById('nf-lightbox');
    var closeButton = document.getElementById('nf-lightbox-close');
    var lightboxImage = lightbox ? lightbox.querySelector('img') : null;
    var triggers = document.querySelectorAll('[data-lightbox-image]');
    var drag = { active: false, moved: false, x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };
    var activeTrigger = null;

    if (!lightbox || !closeButton || !lightboxImage || !triggers.length) return;

    function closeLightbox() {
      lightbox.classList.remove('nf-lightbox--open', 'nf-lightbox--zoomed', 'nf-lightbox--dragging');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImage.removeAttribute('src');
      lightboxImage.alt = '';
      lightbox.scrollLeft = 0;
      lightbox.scrollTop = 0;
      document.body.style.overflow = '';
      drag.active = false;
      drag.moved = false;

      if (activeTrigger) {
        activeTrigger.focus();
        activeTrigger = null;
      }
    }

    triggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault();

        activeTrigger = trigger;
        lightboxImage.src = trigger.getAttribute('data-lightbox-full') || trigger.getAttribute('href');
        lightboxImage.alt = trigger.getAttribute('data-lightbox-alt') || '';

        lightbox.classList.remove('nf-lightbox--zoomed', 'nf-lightbox--dragging');
        lightbox.classList.add('nf-lightbox--open');
        lightbox.setAttribute('aria-hidden', 'false');
        lightbox.scrollLeft = 0;
        lightbox.scrollTop = 0;
        document.body.style.overflow = 'hidden';
        closeButton.focus();
      });
    });

    closeButton.addEventListener('click', function (event) {
      event.stopPropagation();
      closeLightbox();
    });

    lightbox.addEventListener('click', function (event) {
      var rect;
      var ratioX;
      var ratioY;

      if (event.target === closeButton) return;

      if (drag.moved) {
        drag.moved = false;
        return;
      }

      if (!lightbox.classList.contains('nf-lightbox--zoomed')) {
        lightbox.classList.add('nf-lightbox--zoomed');
        rect = lightbox.getBoundingClientRect();
        ratioX = (event.clientX - rect.left) / rect.width;
        ratioY = (event.clientY - rect.top) / rect.height;

        requestAnimationFrame(function () {
          lightbox.scrollLeft = (lightbox.scrollWidth - rect.width) * ratioX;
          lightbox.scrollTop = (lightbox.scrollHeight - rect.height) * ratioY;
        });
        return;
      }

      lightbox.classList.remove('nf-lightbox--zoomed');
      lightbox.scrollLeft = 0;
      lightbox.scrollTop = 0;
    });

    lightbox.addEventListener('pointerdown', function (event) {
      if (!lightbox.classList.contains('nf-lightbox--zoomed')) return;
      if (event.target === closeButton) return;

      drag.active = true;
      drag.moved = false;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.scrollLeft = lightbox.scrollLeft;
      drag.scrollTop = lightbox.scrollTop;

      lightbox.classList.add('nf-lightbox--dragging');

      if (lightbox.setPointerCapture) {
        lightbox.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
    });

    lightbox.addEventListener('pointermove', function (event) {
      var deltaX;
      var deltaY;

      if (!drag.active) return;

      deltaX = event.clientX - drag.x;
      deltaY = event.clientY - drag.y;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        drag.moved = true;
      }

      lightbox.scrollLeft = drag.scrollLeft - deltaX;
      lightbox.scrollTop = drag.scrollTop - deltaY;
    });

    function stopDragging(event) {
      if (!drag.active) return;

      drag.active = false;
      lightbox.classList.remove('nf-lightbox--dragging');

      if (event && lightbox.releasePointerCapture) {
        try {
          lightbox.releasePointerCapture(event.pointerId);
        } catch (error) {
          /* noop */
        }
      }
    }

    lightbox.addEventListener('pointerup', stopDragging);
    lightbox.addEventListener('pointercancel', stopDragging);
    lightbox.addEventListener('pointerleave', function (event) {
      if (drag.active && event.pointerType === 'mouse') {
        stopDragging(event);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && lightbox.classList.contains('nf-lightbox--open')) {
        closeLightbox();
      }
    });
  });
})();
