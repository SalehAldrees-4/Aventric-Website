(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var easeIO = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  var range = function (p, a, b) { return clamp((p - a) / (b - a)); };

  /* ---------- Split headings into masked words ---------- */
  function splitNode(node, counter) {
    $$('*', node).length; // noop: keep live NodeList out of the loop below
    Array.prototype.slice.call(node.childNodes).forEach(function (child) {
      if (child.nodeType === 3) {
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'w';
          var wi = document.createElement('span'); wi.className = 'wi';
          wi.style.setProperty('--i', counter.n++);
          wi.textContent = part;
          w.appendChild(wi); frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') {
        splitNode(child, counter);
      }
    });
  }
  $$('[data-split]').forEach(function (el) {
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    splitNode(el, { n: 0 });
    $$('.w', el).forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
  });

  var footWord = $('#footWord');
  if (footWord) {
    footWord.innerHTML = footWord.textContent.split('').map(function (c, i) {
      return '<span style="--i:' + i + '">' + c + '</span>';
    }).join('');
  }
  $$('#feed li').forEach(function (li, i) { li.style.setProperty('--n', i); });

  /* ---------- In-view reveals (started after the intro) ---------- */
  function startReveals() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    $$('[data-split], .reveal, .footer__word').forEach(function (el) { io.observe(el); });
  }

  /* ---------- Intro curtain ---------- */
  var intro = $('.intro');
  var heroStart = 0; // timestamp the lattice starts assembling
  function endIntro() {
    if (intro) intro.classList.add('done');
    heroStart = performance.now();
    setTimeout(startReveals, intro && !reduced ? 350 : 0);
  }
  if (!intro || reduced) {
    endIntro();
  } else {
    var count = $('#introCount'), bar = $('.intro__bar i'), t0 = performance.now(), DUR = 1150;
    (function tick(now) {
      var t = clamp((now - t0) / DUR), e = easeIO(t);
      count.textContent = ('00' + Math.round(e * 100)).slice(-3);
      bar.style.transform = 'scaleX(' + e + ')';
      if (t < 1) requestAnimationFrame(tick); else endIntro();
    })(t0);
  }

  /* ---------- Hero lattice (trellis grid + convoy travellers) ---------- */
  (function () {
    var canvas = $('#lattice');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, S = 64, cols = 0, rows = 0, pts = [], travellers = [], pings = [];
    var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    var visible = true;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S = W < 700 ? 44 : 64;
      cols = Math.ceil(W / S) + 2; rows = Math.ceil(H / (S / 2)) + 2;
      pts = [];
      for (var j = 0; j < rows; j++) {
        for (var i = 0; i < cols; i++) {
          pts.push({
            rx: (i - 1) * S + (j % 2 ? S / 2 : 0), ry: (j - 1) * S / 2,
            sx: (Math.random() - 0.5) * W * 0.9, sy: (Math.random() - 0.5) * H * 0.9,
            d: Math.random() * 0.5, x: 0, y: 0, a: 0
          });
        }
      }
      travellers = [];
      var n = W < 700 ? 4 : 9;
      for (var k = 0; k < n; k++) travellers.push(spawn(true));
    }
    function idx(i, j) { return j * cols + i; }
    function spawn(anywhere) {
      return { i: Math.floor(Math.random() * cols), j: anywhere ? Math.floor(Math.random() * rows) : 0, t: Math.random(), ni: 0, speed: 0.012 + Math.random() * 0.018, trail: [] };
    }
    function nextOf(tr) {
      // step to the row below, drifting left or right along the lattice
      var right = Math.random() < 0.5;
      var ni = tr.j % 2 ? (right ? tr.i + 1 : tr.i) : (right ? tr.i : tr.i - 1);
      return clamp(ni, 0, cols - 1);
    }

    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || !heroStart) return;
      var t = now / 1000;
      var asm = reduced ? 1 : clamp((now - heroStart) / 2400);
      mouse.x = lerp(mouse.x, mouse.tx, 0.12); mouse.y = lerp(mouse.y, mouse.ty, 0.12);
      ctx.clearRect(0, 0, W, H);

      var p, k;
      for (k = 0; k < pts.length; k++) {
        p = pts[k];
        var a = 1 - ease(clamp((asm - p.d * 0.5) / 0.75));
        var wave = Math.sin(p.rx * 0.0042 + t * 0.7) * Math.cos(p.ry * 0.0058 - t * 0.5);
        var x = p.rx + p.sx * a, y = p.ry + p.sy * a + wave * 9;
        var dx = x - mouse.x, dy = y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
        var near = 0;
        if (dist < 190) { near = 1 - dist / 190; x += (dx / (dist || 1)) * near * 26; y += (dy / (dist || 1)) * near * 26; }
        p.x = x; p.y = y;
        p.a = clamp(0.2 + wave * 0.14 + near * 0.6 + (p.rx / W) * 0.2) * (1 - a * 0.8);
      }

      // lattice segments, batched into alpha buckets to keep stroke calls low
      var B = 5, buckets = [];
      for (k = 0; k < B; k++) buckets.push([]);
      for (var j = 0; j < rows - 1; j++) {
        for (var i = 0; i < cols; i++) {
          p = pts[idx(i, j)];
          var li = j % 2 ? i : i - 1, ri = li + 1;
          var q;
          if (li >= 0) { q = pts[idx(li, j + 1)]; buckets[Math.min(B - 1, Math.floor((p.a + q.a) * 0.5 * B * 1.6))].push(p, q); }
          if (ri < cols) { q = pts[idx(ri, j + 1)]; buckets[Math.min(B - 1, Math.floor((p.a + q.a) * 0.5 * B * 1.6))].push(p, q); }
        }
      }
      ctx.lineWidth = 1;
      for (k = 0; k < B; k++) {
        var seg = buckets[k];
        if (!seg.length) continue;
        ctx.strokeStyle = 'rgba(124,139,255,' + (0.06 + k * 0.11) + ')';
        ctx.beginPath();
        for (var s = 0; s < seg.length; s += 2) { ctx.moveTo(seg[s].x, seg[s].y); ctx.lineTo(seg[s + 1].x, seg[s + 1].y); }
        ctx.stroke();
      }
      // nodes
      ctx.fillStyle = 'rgba(190,198,255,0.55)';
      for (k = 0; k < pts.length; k++) { p = pts[k]; if (p.a > 0.16) ctx.fillRect(p.x - 1, p.y - 1, 2, 2); }

      if (asm < 1 || reduced) return;

      // travellers: lots moving down the lattice
      for (k = 0; k < travellers.length; k++) {
        var tr = travellers[k];
        if (!tr.set) { tr.ni = nextOf(tr); tr.set = true; }
        tr.t += tr.speed;
        var from = pts[idx(tr.i, tr.j)], to = pts[idx(tr.ni, tr.j + 1)];
        if (!from || !to) { travellers[k] = spawn(false); continue; }
        var hx = lerp(from.x, to.x, tr.t), hy = lerp(from.y, to.y, tr.t);
        tr.trail.push(hx, hy);
        if (tr.trail.length > 44) tr.trail.splice(0, 2);
        for (var q2 = 2; q2 < tr.trail.length; q2 += 2) {
          ctx.strokeStyle = 'rgba(255,255,255,' + (q2 / tr.trail.length) * 0.75 + ')';
          ctx.beginPath(); ctx.moveTo(tr.trail[q2 - 2], tr.trail[q2 - 1]); ctx.lineTo(tr.trail[q2], tr.trail[q2 + 1]); ctx.stroke();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, 6.283); ctx.fill();
        if (tr.t >= 1) {
          tr.i = tr.ni; tr.j += 1; tr.t = 0; tr.set = false;
          if (Math.random() < 0.12) pings.push({ x: to.x, y: to.y, t: 0 });
          if (tr.j >= rows - 1) travellers[k] = spawn(false);
        }
      }
      // pings: a signal detected at a node
      for (k = pings.length - 1; k >= 0; k--) {
        var pg = pings[k]; pg.t += 0.014;
        if (pg.t >= 1) { pings.splice(k, 1); continue; }
        ctx.strokeStyle = 'rgba(151,162,255,' + (1 - pg.t) * 0.9 + ')';
        var sz = 6 + ease(pg.t) * 30;
        ctx.save(); ctx.translate(pg.x, pg.y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-sz / 2, -sz / 2, sz, sz); ctx.restore();
      }
    }

    build();
    window.addEventListener('resize', build);
    if (finePointer) {
      window.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
      }, { passive: true });
    }
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(canvas);
    requestAnimationFrame(frame);
  })();

  /* ---------- Ticker ---------- */
  var tickers = $$('.ticker__row').map(function (row) {
    var track = $('.ticker__track', row);
    for (var i = 0; i < 3; i++) row.appendChild(track.cloneNode(true));
    return { row: row, tracks: $$('.ticker__track', row), dir: +row.dataset.dir || 1, x: 0, w: 0 };
  });

  /* ---------- Converge scene ---------- */
  var stage = $('#stage'), conv = null;
  if (stage) {
    var names = ['Sales', 'Channels', 'Menus', 'Suppliers', 'Kitchens', 'Branches', 'Teams', 'Guests'];
    var scatter = [[0.04, 0.1, -9], [0.52, 0.02, 6], [0.3, 0.3, -4], [0.7, 0.26, 10], [0.08, 0.56, 7], [0.5, 0.6, -8], [0.74, 0.76, 5], [0.24, 0.84, -6]];
    var lines = $('#stageLines'), core = $('#stageCore'), card = $('#stageOut'), cards = $$('.stage__card', card), steps = $$('#steps li');
    var chips = names.map(function (n, i) {
      var el = document.createElement('div');
      el.className = 'chip';
      el.innerHTML = '<span style="--bd:' + (-i * 0.6) + 's">' + n + '</span>';
      stage.appendChild(el);
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('pathLength', '1');
      lines.appendChild(path);
      return { el: el, path: path, s: scatter[i] };
    });
    var outs = cards.map(function () {
      var o = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      o.setAttribute('pathLength', '1'); lines.appendChild(o);
      return o;
    });
    conv = { cx: 0, cy: 0, step: -1, measure: function () {
      var w = stage.clientWidth, h = stage.clientHeight, small = w < 520;
      lines.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      conv.w = w; conv.h = h;
      conv.cx = small ? w * 0.5 : w * 0.4; conv.cy = small ? h * 0.56 : h * 0.5;
      conv.coreScale = small ? 0.66 : 1;
      card.classList.toggle('is-small', small);
      card.style.top = small ? '' : (h - card.offsetHeight) / 2 + 'px';
      chips.forEach(function (c, i) {
        var cw = c.el.offsetWidth, ch = c.el.offsetHeight;
        c.ax = c.s[0] * (w - cw); c.ay = c.s[1] * (h - ch);
        if (small) {
          c.bx = (i % 2) * (w / 2); c.by = Math.floor(i / 2) * (ch + 8);
          c.px = c.bx + cw / 2; c.py = c.by + ch;
          c.path.setAttribute('d', 'M' + c.px + ' ' + c.py + 'C' + c.px + ' ' + (c.py + 40) + ' ' + conv.cx + ' ' + (conv.cy - 70) + ' ' + conv.cx + ' ' + conv.cy);
        } else {
          c.bx = 0; c.by = i * ((h - ch) / (chips.length - 1));
          c.px = cw; c.py = c.by + ch / 2;
          var mx = lerp(c.px, conv.cx, 0.55);
          c.path.setAttribute('d', 'M' + c.px + ' ' + c.py + 'C' + mx + ' ' + c.py + ' ' + mx + ' ' + conv.cy + ' ' + conv.cx + ' ' + conv.cy);
        }
      });
      cards.forEach(function (c, i) {
        var x = card.offsetLeft + c.offsetLeft, y = card.offsetTop + c.offsetTop;
        if (small) { x += c.offsetWidth / 2; outs[i].setAttribute('d', 'M' + conv.cx + ' ' + conv.cy + 'C' + conv.cx + ' ' + (y - 10) + ' ' + x + ' ' + (conv.cy + 20) + ' ' + x + ' ' + y); }
        else { y += c.offsetHeight / 2; var m = lerp(conv.cx, x, 0.5); outs[i].setAttribute('d', 'M' + conv.cx + ' ' + conv.cy + 'C' + m + ' ' + conv.cy + ' ' + m + ' ' + y + ' ' + x + ' ' + y); }
      });
      core.style.left = conv.cx + 'px'; core.style.top = conv.cy + 'px';
    }, update: function (p) {
      chips.forEach(function (c, i) {
        var t = easeIO(range(p, 0.04 + i * 0.022, 0.36 + i * 0.022));
        c.el.style.transform = 'translate(' + lerp(c.ax, c.bx, t) + 'px,' + lerp(c.ay, c.by, t) + 'px) rotate(' + lerp(c.s[2], 0, t) + 'deg)';
        c.el.firstChild.style.animationPlayState = t >= 1 ? 'paused' : 'running';
        c.path.style.strokeDashoffset = 1 - easeIO(range(p, 0.42 + i * 0.015, 0.62 + i * 0.015));
      });
      var k = ease(range(p, 0.3, 0.46));
      core.style.opacity = k; core.style.transform = 'scale(' + lerp(0.5, conv.coreScale, k) + ')';
      cards.forEach(function (c, i) {
        outs[i].style.strokeDashoffset = 1 - easeIO(range(p, 0.64 + i * 0.05, 0.76 + i * 0.05));
        var c2 = ease(range(p, 0.72 + i * 0.07, 0.86 + i * 0.07));
        c.style.opacity = c2; c.style.transform = 'translateY(' + (1 - c2) * 30 + 'px)';
      });
      var step = p < 0.34 ? 0 : p < 0.7 ? 1 : 2;
      if (step !== conv.step) { conv.step = step; steps.forEach(function (li, i) { li.classList.toggle('is-on', i === step); }); }
    } };
  }

  /* ---------- Convoy journey ---------- */
  var route = $('#route'), journey = null;
  if (route) {
    var track = $('#routeTrack'), fill = $('#routeFill'), lot = $('#routeLot'), stops = $$('.stop', track);
    journey = { measure: function () {
      var gut = parseFloat(getComputedStyle(track).paddingLeft);
      journey.over = Math.max(0, track.scrollWidth - window.innerWidth);
      journey.lineW = track.scrollWidth - gut * 2;
      journey.at = stops.map(function (s) { return (s.offsetLeft - gut + 28) / journey.lineW; });
    }, update: function (p) {
      var q = clamp(range(p, 0.04, 0.94));
      track.style.transform = 'translate3d(' + -q * journey.over + 'px,0,0)';
      fill.style.transform = 'scaleX(' + q + ')';
      lot.style.transform = 'translateX(' + q * journey.lineW + 'px)';
      var hazard = false;
      stops.forEach(function (s, i) {
        var on = q >= journey.at[i] - 0.004;
        s.classList.toggle('is-on', on);
        if (on && s.classList.contains('stop--hazard')) hazard = !(stops[i + 1] && q >= journey.at[i + 1] - 0.004);
      });
      route.classList.toggle('is-hazard', hazard);
    } };
  }

  /* ---------- Trellis: lattice that grows as you scroll ---------- */
  var grow = $('#grow'), growPaths = [];
  if (grow) {
    grow.setAttribute('viewBox', '0 0 100 100');
    for (var g = -8; g <= 20; g++) {
      [1, -1].forEach(function (dir) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var x = g * 9;
        path.setAttribute('d', dir > 0 ? 'M' + x + ' 100L' + (x + 60) + ' 0' : 'M' + (x + 60) + ' 100L' + x + ' 0');
        path.setAttribute('pathLength', '1');
        grow.appendChild(path);
        growPaths.push({ el: path, d: (g + 8) / 28 * 0.5 + (dir > 0 ? 0 : 0.08) });
      });
    }
  }

  /* ---------- Scroll loop ---------- */
  var nav = $('#nav'), themed = $$('[data-theme]'), pins = $$('[data-pin]'), trellis = $('#trellis'), heroInner = $('.hero__inner');
  var lastY = window.scrollY, vel = 0, navTheme = '', lastT = performance.now();

  function measure() {
    if (conv) conv.measure();
    if (journey) journey.measure();
    tickers.forEach(function (t) { t.w = t.tracks[0].offsetWidth; });
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  function loop(now) {
    requestAnimationFrame(loop);
    var y = window.scrollY, vh = window.innerHeight, dt = Math.min(50, now - lastT); lastT = now;
    var dy = y - lastY; lastY = y;
    vel = lerp(vel, dy, 0.12);

    // nav: hide on the way down, flip colours over light sections
    nav.classList.toggle('is-stuck', y > 40);
    if (Math.abs(dy) > 2) nav.classList.toggle('is-hidden', dy > 0 && y > vh * 0.6);
    var theme = 'dark';
    for (var i = 0; i < themed.length; i++) {
      var r = themed[i].getBoundingClientRect();
      if (r.top <= 38 && r.bottom > 38) { theme = themed[i].dataset.theme; break; }
    }
    if (theme !== navTheme) { navTheme = theme; nav.classList.toggle('is-light', theme === 'light'); nav.classList.toggle('is-navy', theme === 'navy'); }

    if (reduced) {
      if (conv) conv.update(1);
      if (journey) journey.update(0);
      growPaths.forEach(function (gp) { gp.el.style.strokeDashoffset = 0; });
      return;
    }

    // hero drifts back as you leave it
    if (heroInner && y < vh * 1.2) {
      var hp = clamp(y / vh);
      heroInner.style.transform = 'translate3d(0,' + hp * 90 + 'px,0) scale(' + (1 - hp * 0.06) + ')';
      heroInner.style.opacity = 1 - hp * 1.25;
    }

    // tickers: constant drift, pushed by scroll velocity
    tickers.forEach(function (t) {
      if (!t.w) return;
      t.x = (t.x + t.dir * (dt * 0.045 + vel * 0.9)) % t.w;
      if (t.x < 0) t.x += t.w;
      var tx = 'translate3d(' + -t.x + 'px,0,0) skewX(' + clamp(vel * -0.18, -9, 9) + 'deg)';
      t.tracks.forEach(function (tr) { tr.style.transform = tx; });
    });

    pins.forEach(function (pin) {
      var r = pin.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var p = clamp(-r.top / (r.height - vh));
      if (pin.dataset.pin === 'converge' && conv) conv.update(p);
      if (pin.dataset.pin === 'convoy' && journey) journey.update(p);
    });

    if (trellis && growPaths.length) {
      var tr = trellis.getBoundingClientRect();
      if (tr.top < vh && tr.bottom > 0) {
        var gp = clamp((vh - tr.top) / (vh + tr.height * 0.45));
        growPaths.forEach(function (o) { o.el.style.strokeDashoffset = 1 - easeIO(range(gp, o.d * 0.6, o.d * 0.6 + 0.4)); });
      }
    }
  }
  requestAnimationFrame(loop);

  /* ---------- Trellis UI: chart draws in, feed cycles ---------- */
  var ui = $('#trellisUi');
  if (ui) {
    var feed = $$('#feed li'), live = 0;
    setInterval(function () {
      if (!ui.classList.contains('in')) return;
      feed.forEach(function (li, i) { li.classList.toggle('is-live', i === live); });
      live = (live + 1) % feed.length;
    }, 2200);
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduced) {
    $$('.magnetic').forEach(function (el) {
      var strength = el.classList.contains('cta__btn') ? 0.35 : 0.22;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transition = 'transform 0.15s';
        el.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * strength + 'px,' + (e.clientY - r.top - r.height / 2) * strength + 'px)';
      });
      el.addEventListener('pointerleave', function () {
        el.style.transition = 'transform 0.7s cubic-bezier(0.22,1,0.36,1)';
        el.style.transform = '';
      });
    });
  }
})();
