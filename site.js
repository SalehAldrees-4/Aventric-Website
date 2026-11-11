(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EMERALD = '0,184,132';
  var SAFFRON = '255,176,58';

  function fit(canvas) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, r.width * dpr);
    canvas.height = Math.max(1, r.height * dpr);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: r.width, h: r.height };
  }

  // Runs draw(time) every frame while the canvas is on screen.
  function loop(canvas, draw) {
    var view = fit(canvas);
    var visible = true;
    var queued = false;
    function frame(t) {
      queued = false;
      draw(view, t * 0.001);
      if (visible && !reduced && !document.hidden) schedule();
    }
    function schedule() {
      if (!queued) { queued = true; requestAnimationFrame(frame); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        if (visible) schedule();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('resize', function () { view = fit(canvas); schedule(); });
    schedule();
  }

  /* Hero vortex: a ruled hyperboloid. Each line joins a point on the wide
     top ring to a point on the floor ring further round, so scattered
     strands pinch into one column before spreading out again. */
  function vortex() {
    var canvas = document.getElementById('vortex');
    if (!canvas) return;
    var LINES = 300;
    var TWIST = 2.72;
    var sparks = [];
    for (var i = 0; i < 520; i++) {
      var r = Math.random();
      sparks.push({
        line: Math.random() * LINES,
        s: Math.random(),
        v: 0.02 + Math.random() * 0.05,
        size: 0.5 + Math.random() * 1.2,
        color: r < 0.1 ? EMERALD : r < 0.14 ? SAFFRON : '255,255,255',
        a: 0.25 + Math.random() * 0.65,
      });
    }

    loop(canvas, function (view, time) {
      var ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);
      var cx = w / 2;
      var topY = -h * 0.2, botY = h * 0.84;
      var topR = Math.max(w * 0.74, 420), botR = Math.max(w * 0.44, 300);
      var topSq = 0.16, botSq = 0.15;
      var spin = reduced ? 0.6 : time * 0.05;

      function point(line, s) {
        var a0 = (line / LINES) * Math.PI * 2 + spin;
        var a1 = a0 + TWIST;
        var x0 = cx + Math.cos(a0) * topR, y0 = topY + Math.sin(a0) * topR * topSq;
        var x1 = cx + Math.cos(a1) * botR, y1 = botY + Math.sin(a1) * botR * botSq;
        return [x0 + (x1 - x0) * s, y0 + (y1 - y0) * s];
      }

      ctx.lineWidth = 0.6;
      for (var i = 0; i < LINES; i++) {
        var p0 = point(i, 0), p1 = point(i, 1);
        var g = ctx.createLinearGradient(0, topY, 0, botY);
        g.addColorStop(0, 'rgba(255,255,255,0.05)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.2)');
        g.addColorStop(1, 'rgba(255,255,255,0.03)');
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }

      // floor ripples
      for (var k = 1; k <= 14; k++) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.11 - k * 0.006) + ')';
        ctx.beginPath();
        ctx.ellipse(cx, botY, botR * (0.3 + k * 0.1), botR * botSq * (0.3 + k * 0.1), 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (var j = 0; j < sparks.length; j++) {
        var sp = sparks[j];
        var s = reduced ? sp.s : (sp.s + time * sp.v) % 1;
        var p = point(sp.line, s);
        ctx.fillStyle = 'rgba(' + sp.color + ',' + sp.a * Math.sin(s * Math.PI) + ')';
        ctx.fillRect(p[0], p[1], sp.size, sp.size);
      }

      // fade into the page at the bottom edge
      var fade = ctx.createLinearGradient(0, h * 0.8, 0, h);
      fade.addColorStop(0, 'rgba(4,4,5,0)');
      fade.addColorStop(1, 'rgba(4,4,5,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, h * 0.8, w, h * 0.2);
    });
  }

  /* CTA rain: thin vertical streaks falling at different speeds. */
  function rain() {
    var canvas = document.getElementById('rain');
    if (!canvas) return;
    var drops = [];
    for (var i = 0; i < 150; i++) {
      var r = Math.random();
      drops.push({
        x: Math.random(), y: Math.random(), len: 0.05 + Math.random() * 0.2,
        v: 0.03 + Math.random() * 0.09, a: 0.05 + Math.random() * 0.2,
        color: r < 0.08 ? EMERALD : r < 0.11 ? SAFFRON : '255,255,255',
      });
    }
    loop(canvas, function (view, time) {
      var ctx = view.ctx, w = view.w, h = view.h;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (var i = 0; i < drops.length; i++) {
        var d = drops[i];
        var y = ((d.y + (reduced ? 0 : time * d.v)) % 1.3 - 0.2) * h;
        var x = Math.round(d.x * w) + 0.5;
        var g = ctx.createLinearGradient(0, y, 0, y + d.len * h);
        g.addColorStop(0, 'rgba(' + d.color + ',0)');
        g.addColorStop(1, 'rgba(' + d.color + ',' + d.a + ')');
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + d.len * h);
        ctx.stroke();
      }
    });
  }

  /* Illustrative dashboard data */
  function dashboard() {
    var bars = document.getElementById('bars');
    var rows = document.getElementById('rows');
    if (!bars || !rows) return;
    var data = [
      ['Olaya', 412, -12.4, 'Below range'], ['Al Malqa', 388, 4.1, 'On track'],
      ['Hittin', 351, 2.3, 'On track'], ['Al Nakheel', 336, 9.8, 'Above range'],
      ['Jeddah Corniche', 298, -3.2, 'Watch'], ['Al Khobar', 274, 1.1, 'On track'],
      ['Dammam', 241, -6.7, 'Channel shift'], ['Al Yasmin', 226, 0.4, 'On track'],
      ['Qurtubah', 198, 5.6, 'On track'], ['Madinah', 173, -1.9, 'On track'],
    ];
    var mix = [[0.2, 0.48, 0.32], [0.16, 0.4, 0.44], [0.22, 0.36, 0.42], [0.14, 0.52, 0.34], [0.2, 0.44, 0.36]];
    data.forEach(function (d, i) {
      var bar = document.createElement('div');
      bar.style.height = (d[1] / 412) * 92 + '%';
      bar.style.transitionDelay = i * 0.05 + 's';
      mix[i % mix.length].forEach(function (m) {
        var seg = document.createElement('i');
        seg.style.height = m * 100 + '%';
        bar.appendChild(seg);
      });
      bars.appendChild(bar);

      var tr = document.createElement('tr');
      var delta = (d[2] > 0 ? '+' : '') + d[2].toFixed(1) + '%';
      [d[0], d[1], delta, d[3]].forEach(function (v, c) {
        var td = document.createElement('td');
        td.textContent = v;
        if (c === 2) td.className = d[2] <= -3 ? 'down' : d[2] >= 3 ? 'up' : '';
        tr.appendChild(td);
      });
      rows.appendChild(tr);
    });
  }

  function reveals() {
    var els = document.querySelectorAll('.reveal, .head > *');
    if (reduced || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(els, function (el) {
      el.classList.add('reveal');
      var sibs = el.parentNode.children;
      el.style.setProperty('--d', Array.prototype.indexOf.call(sibs, el) % 4 * 0.09 + 's');
      io.observe(el);
    });
  }

  dashboard();
  reveals();
  vortex();
  rain();
})();
