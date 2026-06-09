/* =================================================================
   NHC — Home Maintenance  |  particles.js
   Lightweight interactive "constellation" network for dark sections.
   - Auto-targets: .hero, .page-hero, .section--ink, .cta-band
   - Dots drift + link to nearby dots; gold links + gentle repel near cursor
   - Capped count, retina-aware, pauses off-screen / when tab hidden
   - Lighter on touch devices; static (no motion) under prefers-reduced-motion
   - Purely decorative: canvas is aria-hidden + pointer-events:none
   ================================================================= */
(function () {
  'use strict';

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  var hosts = document.querySelectorAll('.hero, .page-hero, .section--ink, .cta-band');
  if (!hosts.length || !document.createElement('canvas').getContext) return;

  var GOLD = '226,169,61';      // brand gold
  var WHITE = '255,255,255';
  var LINE = '203,213,225';     // cool slate-200 for the web

  var instances = [];

  function Field(host) {
    var canvas = document.createElement('canvas');
    canvas.className = 'particles-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    var particles = [];
    var raf = null;
    var inView = true, tabHidden = false, running = false;

    var mouse = { cx: 0, cy: 0, on: false };

    // Tuning
    var DENSITY = 0.00009;             // particles per px²
    var MAX = isTouch ? 34 : 92;
    var MIN = 12;
    var LINK = 132;                    // px: dot-to-dot link distance
    var MDIST = isTouch ? 0 : 168;     // px: cursor influence radius (0 = off on touch)
    var SPEED = 0.26;

    function resize() {
      var r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      var count = Math.min(MAX, Math.max(MIN, Math.round(w * h * DENSITY)));
      particles = [];
      for (var i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * SPEED,
          vy: (Math.random() - 0.5) * SPEED,
          r: Math.random() * 1.5 + 0.8,
          gold: Math.random() < 0.5
        });
      }
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);

      // resolve cursor position relative to this host (one layout read per frame, only when hovered)
      var mx = null, my = null;
      if (mouse.on && MDIST > 0) {
        var rect = host.getBoundingClientRect();
        mx = mouse.cx - rect.left;
        my = mouse.cy - rect.top;
      }

      var i, p;
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -12) p.x = w + 12; else if (p.x > w + 12) p.x = -12;
        if (p.y < -12) p.y = h + 12; else if (p.y > h + 12) p.y = -12;

        if (mx !== null) {
          var dxm = p.x - mx, dym = p.y - my;
          var dm2 = dxm * dxm + dym * dym;
          if (dm2 > 0.5 && dm2 < MDIST * MDIST) {
            var dm = Math.sqrt(dm2);
            var force = (MDIST - dm) / MDIST;
            p.x += (dxm / dm) * force * 1.5;
            p.y += (dym / dm) * force * 1.5;
          }
        }
      }

      // links between nearby dots
      ctx.lineWidth = 1;
      for (i = 0; i < particles.length; i++) {
        var pa = particles[i];
        for (var j = i + 1; j < particles.length; j++) {
          var pb = particles[j];
          var dx = pa.x - pb.x, dy = pa.y - pb.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            var a = (1 - Math.sqrt(d2) / LINK) * 0.22;
            ctx.strokeStyle = 'rgba(' + LINE + ',' + a + ')';
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
        // link to cursor (gold)
        if (mx !== null) {
          var mdx = pa.x - mx, mdy = pa.y - my;
          var md2 = mdx * mdx + mdy * mdy;
          if (md2 < MDIST * MDIST) {
            var ma = (1 - Math.sqrt(md2) / MDIST) * 0.45;
            ctx.strokeStyle = 'rgba(' + GOLD + ',' + ma + ')';
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
          }
        }
      }

      // dots
      for (i = 0; i < particles.length; i++) {
        p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + (p.gold ? GOLD : WHITE) + ',0.85)';
        ctx.fill();
      }
    }

    function loop() { frame(); raf = requestAnimationFrame(loop); }

    function update() {
      var should = inView && !tabHidden && !prefersReduced;
      if (should && !running) { running = true; loop(); }
      else if (!should && running) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      }
    }

    if (!isTouch && !prefersReduced) {
      host.addEventListener('mousemove', function (e) {
        mouse.cx = e.clientX; mouse.cy = e.clientY; mouse.on = true;
      });
      host.addEventListener('mouseleave', function () { mouse.on = false; });
    }

    return {
      host: host,
      resize: resize,
      drawOnce: function () { frame(); },
      setInView: function (v) { inView = v; update(); },
      setTabHidden: function (v) { tabHidden = v; update(); },
      stop: function () { if (raf) cancelAnimationFrame(raf); raf = null; running = false; }
    };
  }

  hosts.forEach(function (host) {
    var f = new Field(host);
    f.resize();
    instances.push(f);
    if (prefersReduced) f.drawOnce(); // single static frame, no animation
  });

  if (!prefersReduced) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          for (var i = 0; i < instances.length; i++) {
            if (instances[i].host === en.target) { instances[i].setInView(en.isIntersecting); break; }
          }
        });
      }, { threshold: 0.01 });
      hosts.forEach(function (h) { io.observe(h); });
    } else {
      instances.forEach(function (f) { f.setInView(true); });
    }

    document.addEventListener('visibilitychange', function () {
      instances.forEach(function (f) { f.setTabHidden(document.hidden); });
    });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      instances.forEach(function (f) {
        f.resize();
        if (prefersReduced) f.drawOnce();
      });
    }, 200);
  });
})();
