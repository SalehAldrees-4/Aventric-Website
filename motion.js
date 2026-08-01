/* ==========================================================================
   Aventric motion layer
   - Staggered scroll reveals for headlines, copy, and list items
   - Subtle parallax on the hero constellation
   All motion is disabled under prefers-reduced-motion.
   ========================================================================== */

(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  /* ------------------------------------------------------------------
     Scroll reveals — elements get .reveal via JS (so content is never
     hidden if JS fails), then .in-view when they enter the viewport.
     Siblings within the same group stagger by 90ms.
     ------------------------------------------------------------------ */
  var groups = [
    '.hero__copy > *',
    '.section__headline > *',
    '.section__body > *',
    '.questions > .label, .questions__note',
    '.questions__list > li',
    '.solution__copy > *',
    '.solutions__more',
    '.cta > *',
  ];

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  groups.forEach(function (selector) {
    var els = document.querySelectorAll(selector);
    Array.prototype.forEach.call(els, function (el, i) {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', (i % 8) * 0.09 + 's');
      observer.observe(el);
    });
  });

  /* ------------------------------------------------------------------
     Hero parallax — the constellation drifts slower than the page.
     ------------------------------------------------------------------ */
  var heroVisual = document.querySelector('.hero__visual');
  if (heroVisual) {
    var ticking = false;
    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          if (y < window.innerHeight * 1.5) {
            heroVisual.style.transform = 'translateY(' + y * 0.12 + 'px)';
          }
          ticking = false;
        });
      },
      { passive: true }
    );
  }
})();
