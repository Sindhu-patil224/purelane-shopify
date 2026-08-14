/**
 * Purelane sections — shared behaviour.
 *
 * The prototype's script was a single IIFE that ran once on page load and
 * queried the whole document. That breaks the moment a merchant adds,
 * removes, or reorders a section in the theme editor, because the editor
 * injects/removes section markup via AJAX without a full page reload.
 *
 * This version re-scans on:
 *  - DOMContentLoaded (normal storefront)
 *  - shopify:section:load (a section was added, or re-rendered after a
 *    settings change in the editor)
 *  - shopify:section:block:select / block:deselect (so the hero slider
 *    jumps to the block currently focused in the editor)
 * and tears down intervals/observers on shopify:section:unload so nothing
 * leaks when a section is removed.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var registry = {}; // sectionId -> cleanup fn

  function cleanup(sectionId) {
    if (registry[sectionId]) {
      registry[sectionId]();
      delete registry[sectionId];
    }
  }

  /* ---------- reveal-on-scroll (all sections) ---------- */
  function initReveal(root) {
    var revs = root.querySelectorAll('.pl-rv:not([data-pl-rv-bound])');
    if (!revs.length) return;
    revs.forEach(function (el) { el.setAttribute('data-pl-rv-bound', 'true'); });

    if ('IntersectionObserver' in window && !reduce) {
      var ro = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('pl-in');
            ro.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
      revs.forEach(function (el) { ro.observe(el); });
    } else {
      revs.forEach(function (el) { el.classList.add('pl-in'); });
    }
  }

  /* ---------- hero product slider ---------- */
  function initHero(section) {
    var stage = section.querySelector('[data-pl-hstage]');
    if (!stage) return;
    var slides = [].slice.call(stage.querySelectorAll('.pl-hslide'));
    var dots = [].slice.call(section.querySelectorAll('[data-pl-hdots] button'));
    if (slides.length < 2) return; // nothing to rotate

    var i = 0;
    var timer = null;

    function go(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, idx) { s.classList.toggle('pl-on', idx === i); });
      dots.forEach(function (d, idx) { d.classList.toggle('pl-on', idx === i); });
    }
    function play() { if (!timer && !reduce) timer = setInterval(function () { go(i + 1); }, 3800); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, idx) {
      d.addEventListener('click', function () { stop(); go(idx); play(); });
    });
    stage.addEventListener('mouseenter', stop);
    stage.addEventListener('mouseleave', play);

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.isIntersecting ? play() : stop(); });
      }, { threshold: 0.2 });
      io.observe(stage);
    } else {
      play();
    }

    // Editor: jump to whichever slide block is being edited.
    function onBlockSelect(evt) {
      var idx = slides.findIndex(function (s) { return s.dataset.blockId === evt.detail.blockId; });
      if (idx > -1) { stop(); go(idx); }
    }
    section.addEventListener('shopify:block:select', onBlockSelect);

    registry[section.id + '-hero'] = function () {
      stop();
      if (io) io.disconnect();
      section.removeEventListener('shopify:block:select', onBlockSelect);
    };
  }

  /* ---------- init / teardown ---------- */
  function initAll(root) {
    initReveal(root);
    root.querySelectorAll('[data-pl-section="hero"]').forEach(initHero);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initAll(document);
  });

  document.addEventListener('shopify:section:load', function (evt) {
    initAll(evt.target);
  });

  document.addEventListener('shopify:section:unload', function (evt) {
    cleanup(evt.target.id + '-hero');
  });
})();
