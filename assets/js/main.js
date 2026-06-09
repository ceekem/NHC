/* =================================================================
   NHC — Home Maintenance  |  main.js
   Nav drawer · header scroll state · scroll reveal · stat counters
   · FAQ accordion · contact form validation
   ================================================================= */
(function () {
  'use strict';
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Footer year ---- */
  var yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Header scroll state ---- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Mobile nav drawer ---- */
  var toggle = document.querySelector('.nav__toggle');
  var scrim = document.querySelector('.nav__scrim');
  var drawer = document.querySelector('.nav__drawer');

  function closeMenu() {
    document.body.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  function openMenu() {
    document.body.classList.add('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }
  if (toggle) {
    toggle.addEventListener('click', function () {
      document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
    });
  }
  if (scrim) scrim.addEventListener('click', closeMenu);
  if (drawer) {
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
  // reset on resize to desktop
  window.addEventListener('resize', function () {
    if (window.innerWidth > 980) closeMenu();
  });

  /* ---- Scroll reveal ---- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---- Animated stat counters ---- */
  var counters = document.querySelectorAll('[data-count]');
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = (el.getAttribute('data-decimals')) ? parseInt(el.getAttribute('data-decimals'), 10) : 0;
    if (prefersReduced) { el.textContent = target.toFixed(decimals); return; }
    var dur = 1600, start = null;
    function tick(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(decimals);
    }
    requestAnimationFrame(tick);
  }
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCount);
    } else {
      var cio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            cio.unobserve(entry.target);
          }
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cio.observe(el); });
    }
  }

  /* ---- FAQ accordion ---- */
  document.querySelectorAll('.faq__item').forEach(function (item) {
    var btn = item.querySelector('.faq__q');
    var panel = item.querySelector('.faq__a');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      // close siblings within the same .faq group
      var group = item.closest('.faq');
      if (group) {
        group.querySelectorAll('.faq__item.open').forEach(function (other) {
          if (other !== item) {
            other.classList.remove('open');
            other.querySelector('.faq__q').setAttribute('aria-expanded', 'false');
            other.querySelector('.faq__a').style.maxHeight = null;
          }
        });
      }
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = !isOpen ? panel.scrollHeight + 'px' : null;
    });
  });

  /* ---- Contact form validation + mock submit ---- */
  var form = document.querySelector('[data-contact-form]');
  if (form) {
    var success = document.querySelector('[data-form-success]');

    function setError(field, on) {
      field.classList.toggle('invalid', on);
    }
    function validateField(input) {
      var field = input.closest('.field');
      if (!field) return true;
      var val = (input.value || '').trim();
      var ok = true;
      if (input.hasAttribute('required') && !val) ok = false;
      if (ok && input.type === 'email' && val) {
        ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
      }
      if (ok && input.type === 'tel' && val) {
        ok = (val.replace(/[^\d]/g, '').length >= 7);
      }
      setError(field, !ok);
      return ok;
    }

    form.querySelectorAll('input, select, textarea').forEach(function (input) {
      input.addEventListener('blur', function () { validateField(input); });
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('invalid')) validateField(input);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;
      var firstInvalid = null;
      form.querySelectorAll('input, select, textarea').forEach(function (input) {
        var ok = validateField(input);
        if (!ok && !firstInvalid) firstInvalid = input;
        if (!ok) valid = false;
      });
      if (!valid) {
        if (firstInvalid) firstInvalid.focus();
        return;
      }
      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      // Mock async submission (no backend wired up)
      setTimeout(function () {
        form.style.display = 'none';
        if (success) {
          success.classList.add('show');
          success.setAttribute('tabindex', '-1');
          success.focus();
        }
      }, 850);
    });
  }
})();
