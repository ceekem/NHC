/* =================================================================
   NHC — New Horizon Concepts  |  motion.js
   Cinematic motion layer built on GSAP (ScrollTrigger, SplitText,
   CustomEase) and Lenis smooth scrolling.

   - Smooth scroll (Lenis) kept in sync with ScrollTrigger
   - Home: preloader tied to the hero frames, scroll-scrubbed image
     sequence on a canvas, headline scenes, logo that settles into the
     header, transparent header while over the hero
   - Titles (.anim-title): each letter fades in and shrinks into place
   - Paragraphs (.anim-text): lines rise and fade in one after another
   - Photos (.anim-photo) drift inside their frame; [data-depth]
     layers move at their own speed (desktop only)
   - Project slider ([data-slider]): stretch-wipe transition,
     drag/swipe, arrow keys and a custom "Drag" cursor

   Everything falls back to static, fully visible content when GSAP is
   unavailable or the visitor prefers reduced motion.
   ================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText);
  var motion = hasGsap && !reduced;

  // Overwritten with the custom curves once CustomEase is available
  var EASE = 'expo.out';
  var WIPE = 'power4.inOut';

  /* ---------- Helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
  function session(key, val) {
    try {
      if (val === undefined) return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, val);
    } catch (e) { /* storage blocked — not critical */ }
    return null;
  }
  function fontsReady(timeout) {
    return new Promise(function (resolve) {
      setTimeout(resolve, timeout);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(resolve, resolve);
      else resolve();
    });
  }

  var preloader = $('.preloader');
  function removePreloader() {
    root.classList.remove('is-loading');
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
    preloader = null;
  }

  /* The project slider works in every mode (animated or instant) */
  $$('[data-slider]').forEach(initSlider);

  if (!motion) {
    // No GSAP (offline / blocked CDN) or reduced motion: show everything as-is
    root.classList.remove('motion');
    removePreloader();
    return;
  }

  root.classList.add('motion-live');
  gsap.registerPlugin(ScrollTrigger, SplitText);
  if (window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create('nhc', '0.16, 1, 0.3, 1');
    CustomEase.create('nhc-wipe', '0.83, 0, 0.17, 1');
    EASE = 'nhc';
    WIPE = 'nhc-wipe';
  }

  /* ---------- Smooth scroll ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.2,
      smoothWheel: true,
      // let the browser handle (i.e. block) scrolling while the menu or preloader is open
      prevent: function () {
        return body.classList.contains('menu-open') || root.classList.contains('is-loading');
      }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.nhcLenis = lenis;
  }
  initAnchors();

  /* ---------- Page setup ---------- */
  var header = $('.site-header');
  var hero = $('.hero[data-sequence]');
  var seq = hero ? initSequence(hero) : null;
  var showPreloader = !!(preloader && seq && !root.classList.contains('no-preloader'));
  var fonts = fontsReady(showPreloader ? 4000 : 1200);

  if (showPreloader) root.classList.add('is-loading');
  else removePreloader();

  if (seq) buildHeroScroll(seq);
  if (hero) heroParallax(hero, !!seq);
  if (hero && header) headerOverHero(hero, header);
  setupPageHero();
  setupReveals();
  setupParallax();

  if (showPreloader) {
    Promise.all([runPreloader(seq), fonts]).then(function () {
      preloaderExit();
      gsap.delayedCall(0.7, heroIntro);
    });
  } else {
    fonts.then(function () {
      if (hero) heroIntro();
      pageHeroIntro();
    });
  }

  /* =================================================================
     Text animations
     ================================================================= */
  function splitChars(el) {
    if (!el._nhcSplit) {
      el._nhcSplit = new SplitText(el, { type: 'words,chars', wordsClass: 'split-w', charsClass: 'split-c' });
    }
    return el._nhcSplit;
  }

  // Letters of each word fade in and shrink from 1.7x, working in from the
  // word's edges; words start at slightly random moments.
  function charsIn(split) {
    var tl = gsap.timeline();
    var at = 0;
    split.words.forEach(function (word) {
      tl.to(word.querySelectorAll('.split-c'), {
        opacity: 1, scale: 1, duration: 0.65, ease: EASE,
        stagger: { each: 0.022, from: 'edges' }
      }, at);
      at += 0.05 + Math.random() * 0.13;
    });
    return tl;
  }

  function titleIn(el, keepSplit) {
    var split = splitChars(el);
    gsap.set(split.chars, { opacity: 0, scale: 1.7 });
    el.classList.add('is-ready');
    var tl = charsIn(split);
    if (!keepSplit) {
      tl.eventCallback('onComplete', function () { split.revert(); el._nhcSplit = null; });
    }
    return tl;
  }

  function linesIn(el) {
    var split = new SplitText(el, { type: 'lines', linesClass: 'split-line' });
    gsap.set(split.lines, { autoAlpha: 0, yPercent: 40 });
    el.classList.add('is-ready');
    return gsap.timeline({ onComplete: function () { split.revert(); } })
      .to(split.lines, { autoAlpha: 1, yPercent: 0, duration: 0.95, ease: EASE, stagger: 0.08 });
  }

  function fadeIn(el) {
    return gsap.fromTo(el, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, clearProps: 'transform' });
  }

  // Plays the intro of a hero block in DOM order
  function introSequence(container, tl, at, keepTitleSplit) {
    if (!container) return tl;
    $$('[data-hero-fade], .anim-title, .anim-text', container).forEach(function (el) {
      if (el.classList.contains('anim-title')) { tl.add(titleIn(el, keepTitleSplit), at); at += 0.4; }
      else if (el.classList.contains('anim-text')) { tl.add(linesIn(el), at); at += 0.22; }
      else { tl.add(fadeIn(el), at); at += 0.12; }
    });
    return tl;
  }

  function setupReveals() {
    $$('.anim-title').forEach(function (el) {
      if (el.closest('.hero, .page-hero')) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 90%', once: true,
        onEnter: function () { titleIn(el); }
      });
    });
    $$('.anim-text').forEach(function (el) {
      if (el.closest('.hero, .page-hero')) return;
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        // line breaks depend on the final font, so wait for it
        onEnter: function () { fonts.then(function () { linesIn(el); }); }
      });
    });
  }

  /* =================================================================
     Photo parallax + depth layers (desktop only)
     ================================================================= */
  function setupParallax() {
    gsap.matchMedia().add('(min-width: 981px)', function () {
      $$('.anim-photo').forEach(function (wrap) {
        var img = $('img', wrap);
        if (!img) return;
        // scaled 1.16x so the ±7% drift never shows an edge
        gsap.fromTo(img, { yPercent: -7, scale: 1.16 }, {
          yPercent: 7, scale: 1.16, ease: 'none',
          scrollTrigger: { trigger: wrap, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
      $$('[data-depth]').forEach(function (el) {
        var d = parseFloat(el.getAttribute('data-depth')) || 0.1;
        gsap.fromTo(el, { y: d * 180 }, {
          y: -d * 180, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
    });
  }

  /* =================================================================
     Inner-page hero
     ================================================================= */
  function setupPageHero() {
    var ph = $('.page-hero');
    if (!ph) return;
    var media = $('.page-hero__media', ph);
    if (media) {
      gsap.to(media, {
        yPercent: 22, ease: 'none',
        scrollTrigger: { trigger: ph, start: 'top top', end: 'bottom top', scrub: true }
      });
    }
  }

  function pageHeroIntro() {
    var ph = $('.page-hero');
    if (!ph) return;
    var tl = gsap.timeline();
    var img = $('.page-hero__media img', ph);
    if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 2.2, ease: EASE }, 0);
    introSequence($('.page-hero__inner', ph), tl, 0.15, false);
  }

  /* =================================================================
     Home hero — scroll-scrubbed image sequence
     ================================================================= */
  function initSequence(heroEl) {
    var conn = navigator.connection;
    if ((conn && conn.saveData) || window.innerHeight < 520) return null;

    var canvas = $('.hero__canvas', heroEl);
    var stage = $('.hero__stage', heroEl);
    var scene1 = $('.hero__scene[data-scene="1"]', heroEl);
    if (!canvas || !canvas.getContext || !stage || !scene1) return null;

    heroEl.classList.add('is-sequence');
    // The opening content must fit the pinned screen; otherwise keep the static hero
    var cs = window.getComputedStyle(stage);
    var room = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (scene1.offsetHeight > room + 1) {
      heroEl.classList.remove('is-sequence');
      return null;
    }

    var ctx = canvas.getContext('2d');
    var count = parseInt(heroEl.getAttribute('data-frames'), 10) || 1;
    var portrait = window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches;
    var base = heroEl.getAttribute(portrait ? 'data-src-mobile' : 'data-src-desktop');
    var frames = new Array(count);
    var pos = { frame: 0 };
    var dirty = true;
    var shown = false;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    function src(i) { return base + ('00' + i).slice(-3) + '.webp'; }

    function resize() {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      dirty = true;
    }

    function drawCover(img, alpha) {
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var s = Math.max(cw / iw, ch / ih);
      var dw = iw * s, dh = ih * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    function nearest(i) {
      if (frames[i]) return frames[i];
      for (var d = 1; d < count; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return null;
    }

    // Draws the current frame, blending in the next one by the fractional
    // position so the 24 fps clip scrubs smoothly.
    function render() {
      if (!dirty) return;
      var p = Math.min(count - 1, Math.max(0, pos.frame));
      var i = Math.floor(p), f = p - i;
      var a = nearest(i);
      if (!a) return;
      dirty = false;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawCover(a, 1);
      if (f > 0.01 && frames[i] && frames[i + 1]) drawCover(frames[i + 1], f);
      ctx.globalAlpha = 1;
      if (!shown) { shown = true; canvas.classList.add('is-ready'); }
    }

    /* Loading: every 4th frame first (these gate the preloader), then the rest */
    var order = [], rest = [];
    for (var n = 0; n < count; n++) ((n % 4 === 0 || n === count - 1) ? order : rest).push(n);
    var priorityCount = order.length;
    order = order.concat(rest);
    var cursor = 0, priorityDone = 0, listeners = [], resolveReady;
    var ready = new Promise(function (r) { resolveReady = r; });

    function loadNext() {
      if (cursor >= order.length) return;
      var idx = order[cursor];
      var isPriority = cursor < priorityCount;
      cursor++;
      var img = new Image();
      img.decoding = 'async';
      function finish(ok) {
        if (ok) { frames[idx] = img; dirty = true; }
        if (isPriority) {
          priorityDone++;
          var p = priorityDone / priorityCount;
          listeners.forEach(function (fn) { fn(p); });
          if (priorityDone >= priorityCount) resolveReady();
        }
        loadNext();
      }
      img.onload = function () {
        if (img.decode) img.decode().then(function () { finish(true); }, function () { finish(true); });
        else finish(true);
      };
      img.onerror = function () { finish(false); };
      img.src = src(idx);
    }
    for (var w = 0; w < 6; w++) loadNext();

    resize();
    window.addEventListener('resize', debounce(resize, 150));
    gsap.ticker.add(render);

    return {
      hero: heroEl,
      count: count,
      pos: pos,
      ready: ready,
      invalidate: function () { dirty = true; },
      onProgress: function (fn) { listeners.push(fn); }
    };
  }

  function buildHeroScroll(s) {
    var s1 = $('.hero__scene[data-scene="1"]', s.hero);
    var s2 = $('.hero__scene[data-scene="2"]', s.hero);
    var s3 = $('.hero__scene[data-scene="3"]', s.hero);
    var cue = $('.hero__scroll', s.hero);
    var h1 = $('h1', s1);
    var t2 = splitChars($('.hero__title', s2));
    var t3 = splitChars($('.hero__title', s3));
    var cta3 = $('.hero__cta', s3);

    gsap.set(t2.chars.concat(t3.chars), { opacity: 0, scale: 1.7 });
    gsap.set(cta3, { autoAlpha: 0, y: 24 });
    gsap.set([s2, s3], { visibility: 'visible' });

    // 10 timeline units = the whole pinned scroll distance
    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: s.hero, start: 'top top', end: 'bottom bottom', scrub: 0.6 }
    });
    tl.to(s.pos, { frame: s.count - 1, duration: 10, onUpdate: s.invalidate }, 0);
    if (cue) tl.fromTo(cue, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.4, immediateRender: false }, 0);

    // Scene 1 leaves
    tl.fromTo(s1, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -70, duration: 1.5, ease: 'power1.in', immediateRender: false }, 0.25);
    tl.fromTo(splitChars(h1).words, { yPercent: 0 }, { yPercent: -45, duration: 1.1, stagger: 0.05, ease: 'power1.in', immediateRender: false }, 0.25);

    // Scene 2 in, then out
    tl.add(charsIn(t2).duration(1.6), 2.1);
    tl.to(t2.words, { yPercent: -45, opacity: 0, duration: 1, stagger: 0.05, ease: 'power1.in' }, 4.4);

    // Scene 3 in, with the call to action
    tl.add(charsIn(t3).duration(1.6), 5.7);
    tl.to(cta3, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power2.out' }, 7.1);
    tl.set({}, {}, 10);
  }

  function heroParallax(heroEl, sequence) {
    var media = $('.hero__media', heroEl);
    if (!media) return;
    gsap.to(media, {
      yPercent: sequence ? 28 : 22, ease: 'none',
      scrollTrigger: { trigger: heroEl, start: sequence ? 'bottom bottom' : 'top top', end: 'bottom top', scrub: true }
    });
  }

  function headerOverHero(heroEl, headerEl) {
    // Transparent header until the hero has scrolled past it
    ScrollTrigger.create({
      trigger: heroEl,
      start: function () { return 'bottom top+=' + headerEl.offsetHeight; },
      end: 'max',
      toggleClass: { targets: headerEl, className: 'is-past-hero' }
    });
    // Logo starts larger and lower, then settles into the header
    var logo = $('.logo', headerEl);
    if (!logo) return;
    gsap.matchMedia().add({ wide: '(min-width: 981px)', narrow: '(max-width: 980px)' }, function (c) {
      var wide = c.conditions.wide;
      gsap.fromTo(logo, { scale: wide ? 1.4 : 1.16, y: wide ? 18 : 6 }, {
        scale: 1, y: 0, ease: 'none',
        scrollTrigger: { start: 0, end: function () { return window.innerHeight * 0.5; }, scrub: true }
      });
    });
  }

  function heroIntro() {
    var tl = gsap.timeline();
    var frame = $('.hero__frame', hero);
    if (frame) tl.fromTo(frame, { scale: 1.12 }, { scale: 1, duration: 2.4, ease: EASE, clearProps: 'transform' }, 0);
    if (header) {
      tl.fromTo(header, { yPercent: -100, autoAlpha: 0 }, {
        yPercent: 0, autoAlpha: 1, duration: 1.1, ease: EASE, clearProps: 'transform,opacity,visibility'
      }, 0.3);
    }
    // keep the h1 split: the scroll timeline moves its words
    introSequence($('.hero__scene[data-scene="1"]', hero), tl, 0.35, !!seq);
  }

  /* =================================================================
     Preloader (home, first visit per session)
     ================================================================= */
  function runPreloader(s) {
    return new Promise(function (resolve) {
      var countEl = $('[data-preloader-count]', preloader);
      var bar = $('[data-preloader-bar]', preloader);
      var shown = { v: 0 };
      var started = performance.now();
      var finished = false;
      preloader.style.animation = 'none'; // JS is in control: cancel the CSS failsafe

      function paint() {
        if (countEl) countEl.textContent = Math.round(shown.v);
        if (bar) gsap.set(bar, { scaleX: shown.v / 100 });
      }
      function done() {
        if (finished) return;
        finished = true;
        clearTimeout(timeout);
        gsap.to(shown, { v: 100, duration: 0.45, ease: 'power2.out', overwrite: true, onUpdate: paint, onComplete: resolve });
      }
      s.onProgress(function (p) {
        gsap.to(shown, { v: p * 100, duration: 0.6, ease: 'power2.out', overwrite: true, onUpdate: paint });
      });
      var timeout = setTimeout(done, 12000); // never hold the page hostage
      s.ready.then(function () {
        setTimeout(done, Math.max(0, 900 - (performance.now() - started)));
      });
    });
  }

  function preloaderExit() {
    session('nhc-intro', '1');
    var inner = $('.preloader__inner', preloader);
    gsap.timeline({ onComplete: removePreloader })
      .to(inner, { autoAlpha: 0, y: -30, duration: 0.55, ease: 'power2.in' })
      .to(preloader, { yPercent: -100, duration: 1.1, ease: WIPE }, '-=0.15')
      .add(function () { root.classList.remove('is-loading'); }, '-=0.8');
  }

  /* =================================================================
     In-page anchor links (smooth, offset for the sticky header)
     ================================================================= */
  function initAnchors() {
    function norm(p) { return p.replace(/index\.html$/, ''); }
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a || a.target === '_blank') return;
      var url;
      try { url = new URL(a.href, window.location.href); } catch (err) { return; }
      if (!url.hash || norm(url.pathname) !== norm(window.location.pathname) || url.search !== window.location.search) return;
      var id = decodeURIComponent(url.hash.slice(1));
      var target = id === 'top' ? 0 : document.getElementById(id);
      if (target === null) return;
      e.preventDefault();
      var headerEl = $('.site-header');
      var offset = target === 0 ? 0 : -((headerEl ? headerEl.offsetHeight : 0) + 16);
      if (lenis) {
        lenis.scrollTo(target, { offset: offset, duration: 1.6 });
      } else {
        var top = target === 0 ? 0 : target.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      if (window.history && history.replaceState) history.replaceState(null, '', url.hash);
      if (target !== 0) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  /* =================================================================
     Project slider
     ================================================================= */
  function initSlider(el) {
    var viewport = $('.work-slider__viewport', el);
    var slides = $$('.work-slide', el);
    var count = slides.length;
    if (!viewport || count < 2) return;

    var tagEl = $('[data-slide-tag]', el);
    var titleEl = $('[data-slide-title]', el);
    var linkEl = $('[data-slide-link]', el);
    var linkText = linkEl ? $('[data-slide-link-text]', linkEl) : null;
    var indexEl = $('[data-slide-index]', el);
    var totalEl = $('[data-slide-total]', el);
    var prevBtn = $('[data-slide-prev]', el);
    var nextBtn = $('[data-slide-next]', el);
    var captionItems = [tagEl, titleEl, linkEl].filter(Boolean);
    var index = 0;
    var busy = false;
    var dragCursor = null;

    if (totalEl) totalEl.textContent = pad(count);

    function setActive(i) {
      slides.forEach(function (s, k) {
        s.classList.toggle('is-active', k === i);
        s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
    }
    function fillCaption(i) {
      var s = slides[i];
      if (tagEl) tagEl.textContent = s.getAttribute('data-tag') || '';
      if (titleEl) titleEl.textContent = s.getAttribute('data-title') || '';
      if (linkEl) linkEl.setAttribute('href', s.getAttribute('data-href') || '#');
      if (linkText) linkText.textContent = s.getAttribute('data-link') || 'View the service';
      if (indexEl) indexEl.textContent = pad(i + 1);
    }

    function go(dir) {
      if (busy) return;
      var from = index;
      var to = (index + dir + count) % count;
      var a = slides[from], b = slides[to];
      var aImg = $('img', a), bImg = $('img', b);
      index = to;

      if (!motion) {
        setActive(to);
        fillCaption(to);
        return;
      }

      busy = true;
      a.classList.add('is-leaving');
      setActive(to);
      var tl = gsap.timeline({
        onComplete: function () {
          a.classList.remove('is-leaving');
          gsap.set([a, b, aImg, bImg], { clearProps: 'transform,zIndex,transformOrigin' });
          busy = false;
        }
      });
      // Outgoing slide leaves while its photo stretches; the incoming
      // photo arrives stretched and relaxes back to normal.
      tl.set(a, { zIndex: 2, transformOrigin: dir > 0 ? 'right center' : 'left center' }, 0)
        .set(b, { zIndex: 3, transformOrigin: dir > 0 ? 'left center' : 'right center' }, 0)
        .fromTo(a, { xPercent: 0 }, { xPercent: -100 * dir, duration: 1.1, ease: 'power2.out' }, 0)
        .fromTo(aImg, { scaleX: 1, scaleY: 1, xPercent: 0 }, { scaleX: 2.2, scaleY: 1.2, xPercent: 30 * dir, duration: 1.1, ease: 'power2.out' }, 0)
        .fromTo(b, { xPercent: 100 * dir }, { xPercent: 0, duration: 1.1, ease: 'power2.out' }, 0)
        .fromTo(bImg, { scaleX: 2.2, scaleY: 1.2, xPercent: -30 * dir }, { scaleX: 1, scaleY: 1, xPercent: 0, duration: 1.1, ease: 'power2.out' }, 0);
      if (captionItems.length) {
        tl.to(captionItems, { autoAlpha: 0, y: -16, duration: 0.3, stagger: 0.04, ease: 'power2.in' }, 0)
          .add(function () { fillCaption(to); }, 0.36)
          .fromTo(captionItems, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.07, ease: EASE, clearProps: 'transform' }, 0.38);
      } else {
        fillCaption(to);
      }
    }

    setActive(0);
    fillCaption(0);
    if (prevBtn) prevBtn.addEventListener('click', function () { go(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(1); });
    viewport.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });

    /* Drag / swipe */
    var startX = 0, dx = 0, dragging = false, pointerId = null;
    viewport.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || busy) return;
      dragging = true;
      startX = e.clientX;
      dx = 0;
      pointerId = e.pointerId;
      try { viewport.setPointerCapture(pointerId); } catch (err) { /* not critical */ }
      if (dragCursor) dragCursor.press(true);
    });
    viewport.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      if (motion) gsap.set($('img', slides[index]), { x: dx * 0.2 });
    });
    function endDrag(cancelled) {
      if (!dragging) return;
      dragging = false;
      try { viewport.releasePointerCapture(pointerId); } catch (err) { /* not critical */ }
      if (motion) gsap.to($('img', slides[index]), { x: 0, duration: 0.6, ease: EASE });
      if (!cancelled && Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
      if (dragCursor) dragCursor.press(false);
    }
    viewport.addEventListener('pointerup', function () { endDrag(false); });
    viewport.addEventListener('pointercancel', function () { endDrag(true); });

    if (motion && finePointer) dragCursor = makeDragCursor(viewport);
  }

  function makeDragCursor(area) {
    var c = document.createElement('div');
    c.className = 'drag-cursor';
    c.setAttribute('aria-hidden', 'true');
    c.innerHTML = '<span>Drag</span>';
    body.appendChild(c);
    area.classList.add('has-drag-cursor');
    gsap.set(c, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });
    var xTo = gsap.quickTo(c, 'x', { duration: 0.45, ease: 'power3' });
    var yTo = gsap.quickTo(c, 'y', { duration: 0.45, ease: 'power3' });

    area.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse') return;
      gsap.set(c, { x: e.clientX, y: e.clientY });
      xTo(e.clientX); yTo(e.clientY);
      gsap.to(c, { scale: 1, autoAlpha: 1, duration: 0.5, ease: EASE, overwrite: 'auto' });
    });
    area.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      xTo(e.clientX); yTo(e.clientY);
    });
    area.addEventListener('pointerleave', function () {
      gsap.to(c, { scale: 0, autoAlpha: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
    });
    return {
      press: function (down) {
        gsap.to(c, { scale: down ? 0.8 : 1, duration: down ? 0.25 : 0.45, ease: down ? 'power2.out' : EASE, overwrite: 'auto' });
      }
    };
  }
})();
