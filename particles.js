/* ==========================================================================
   Aventric particle system
   Outlined triangular glyphs in the brand spectrum, floating on the void.
   - Hero constellation: organic cloud of ~1500 triangles (fragmented data
     forming one intelligence).
   - Solution canvases: "lattice" (Trellis) and "chain" (Convoy) motifs.
   - Ambient field: sparse slow-drifting triangles behind the whole page.
   ========================================================================== */

(function () {
  'use strict';

  var PALETTE = [
    '#00b884', // emerald (brand primary)
    '#ffb03a', // saffron
    '#2ab3a6', // teal
    '#c4652f', // copper
    '#7ce0b8', // pale emerald
    '#8052ff', // violet spark (rare)
  ];

  // Weighted color pick — emerald/saffron dominate, violet is a rare spark.
  function pickColor(rand) {
    var r = rand();
    if (r < 0.34) return PALETTE[0];
    if (r < 0.58) return PALETTE[1];
    if (r < 0.76) return PALETTE[2];
    if (r < 0.88) return PALETTE[3];
    if (r < 0.97) return PALETTE[4];
    return PALETTE[5];
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Deterministic PRNG so the constellation shape is stable across loads.
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawTriangle(ctx, x, y, size, rotation, color, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.866, size * 0.5);
    ctx.lineTo(-size * 0.866, size * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function fitCanvas(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  /* ------------------------------------------------------------------
     Generic animator: particles = [{x, y, size, rot, color, alpha,
     phase, driftX, driftY}], positions in unit space (0..1).
     ------------------------------------------------------------------ */
  function animate(canvas, particles, options) {
    var view = fitCanvas(canvas);
    if (!view) return;
    var opts = options || {};
    var running = true;

    function frame(t) {
      if (!running) return;
      var ctx = view.ctx;
      ctx.clearRect(0, 0, view.w, view.h);
      var time = t * 0.001;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var wobble = reducedMotion ? 0 : Math.sin(time * p.speed + p.phase);
        var x = (p.x + p.driftX * wobble) * view.w;
        var y = (p.y + p.driftY * wobble) * view.h;
        var twinkle = reducedMotion
          ? 1
          : 0.75 + 0.25 * Math.sin(time * p.twinkleSpeed + p.phase * 2);
        drawTriangle(
          ctx,
          x,
          y,
          p.size,
          p.rot + (reducedMotion ? 0 : time * p.spin),
          p.color,
          p.alpha * twinkle
        );
      }
      if (!reducedMotion) {
        requestAnimationFrame(frame);
      }
    }

    requestAnimationFrame(frame);

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var next = fitCanvas(canvas);
        if (next) view = next;
        if (reducedMotion) requestAnimationFrame(frame);
      }, 150);
    });

    if (opts.pauseWhenHidden !== false) {
      document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running && !reducedMotion) requestAnimationFrame(frame);
      });
    }
  }

  function makeParticle(rand, x, y, sizeMin, sizeMax, alphaMin, alphaMax) {
    return {
      x: x,
      y: y,
      size: sizeMin + rand() * (sizeMax - sizeMin),
      rot: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.25,
      color: pickColor(rand),
      alpha: alphaMin + rand() * (alphaMax - alphaMin),
      phase: rand() * Math.PI * 2,
      speed: 0.3 + rand() * 0.5,
      twinkleSpeed: 0.4 + rand() * 0.9,
      driftX: (rand() - 0.5) * 0.012,
      driftY: (rand() - 0.5) * 0.012,
    };
  }

  /* ------------------------------------------------------------------
     Hero constellation — organic cloud built from overlapping lobes,
     denser toward the core, with scattered outliers.
     ------------------------------------------------------------------ */
  function buildConstellation() {
    var canvas = document.getElementById('constellation');
    if (!canvas) return;
    var rand = mulberry32(20260801);
    var particles = [];

    var lobes = [
      { cx: 0.52, cy: 0.44, rx: 0.30, ry: 0.26 },
      { cx: 0.38, cy: 0.58, rx: 0.22, ry: 0.20 },
      { cx: 0.66, cy: 0.60, rx: 0.20, ry: 0.18 },
      { cx: 0.52, cy: 0.30, rx: 0.18, ry: 0.14 },
    ];

    function insideCloud(x, y) {
      for (var i = 0; i < lobes.length; i++) {
        var l = lobes[i];
        var dx = (x - l.cx) / l.rx;
        var dy = (y - l.cy) / l.ry;
        if (dx * dx + dy * dy < 1) return true;
      }
      return false;
    }

    // Dense core
    var placed = 0;
    while (placed < 1300) {
      var x = rand();
      var y = rand();
      if (insideCloud(x, y)) {
        particles.push(makeParticle(rand, x, y, 1.8, 4.6, 0.5, 1));
        placed++;
      }
    }

    // Scattered outliers around the cloud
    for (var i = 0; i < 120; i++) {
      particles.push(makeParticle(rand, rand(), rand(), 1.2, 3, 0.08, 0.3));
    }

    animate(canvas, particles);
  }

  /* ------------------------------------------------------------------
     Solution visuals
     - lattice (Trellis): points on a diagonal trellis grid, organic jitter
     - chain (Convoy): particles flowing along a supply-chain path
     ------------------------------------------------------------------ */
  function buildSolutionVisuals() {
    var canvases = document.querySelectorAll('.solution__canvas');
    Array.prototype.forEach.call(canvases, function (canvas) {
      var shape = canvas.getAttribute('data-shape');
      var rand = mulberry32(shape === 'lattice' ? 7101 : 9203);
      var particles = [];

      if (shape === 'lattice') {
        var steps = 11;
        for (var i = 0; i <= steps; i++) {
          for (var j = 0; j <= steps; j++) {
            var gx = 0.12 + (i / steps) * 0.76 + (rand() - 0.5) * 0.03;
            var gy = 0.12 + (j / steps) * 0.76 + (rand() - 0.5) * 0.03;
            // keep a diamond-ish silhouette
            var dx = Math.abs(gx - 0.5);
            var dy = Math.abs(gy - 0.5);
            if (dx + dy < 0.5) {
              particles.push(makeParticle(rand, gx, gy, 2.6, 5, 0.6, 1));
              // in-between fillers on lattice lines
              if (rand() < 0.75) {
                particles.push(
                  makeParticle(rand, gx + 0.035, gy + 0.035, 1.6, 3.2, 0.3, 0.65)
                );
              }
            }
          }
        }
      } else {
        // chain: an S-curve path of clustered links
        var links = 11;
        for (var k = 0; k < links; k++) {
          var t = k / (links - 1);
          var cx = 0.14 + t * 0.72;
          var cy = 0.5 + Math.sin(t * Math.PI * 2) * 0.22;
          var clusterSize = 16 + Math.floor(rand() * 10);
          for (var c = 0; c < clusterSize; c++) {
            var angle = rand() * Math.PI * 2;
            var radius = rand() * 0.055;
            particles.push(
              makeParticle(
                rand,
                cx + Math.cos(angle) * radius,
                cy + Math.sin(angle) * radius * 1.4,
                1.6,
                4,
                0.5,
                1
              )
            );
          }
        }
      }

      // ambient sprinkle
      for (var s = 0; s < 40; s++) {
        particles.push(makeParticle(rand, rand(), rand(), 1, 2.4, 0.06, 0.22));
      }

      animate(canvas, particles);
    });
  }

  /* ------------------------------------------------------------------
     Ambient field — sparse triangles drifting behind the page
     ------------------------------------------------------------------ */
  function buildAmbientField() {
    var canvas = document.getElementById('ambient-field');
    if (!canvas) return;
    var rand = mulberry32(4406);
    var particles = [];
    for (var i = 0; i < 64; i++) {
      var p = makeParticle(rand, rand(), rand(), 1.2, 3.2, 0.05, 0.22);
      p.driftX = (rand() - 0.5) * 0.02;
      p.driftY = (rand() - 0.5) * 0.02;
      particles.push(p);
    }
    animate(canvas, particles);
  }

  function init() {
    buildConstellation();
    buildSolutionVisuals();
    buildAmbientField();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
