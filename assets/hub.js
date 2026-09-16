/* Deadlock Deck Arena - hub behaviour.
   Everything here is an enhancement: with scripting off the page still reads,
   every build still has a working "play" link, and the 5-way compare link in
   the hero still works. */
(function () {
  'use strict';

  var STORE = 'dd-arena-lang';
  var doc = document.documentElement;

  /* ------------------------------------------------------------ language */

  function currentLang() {
    return doc.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  }

  // Internal links carry the language so a copied URL opens in the same one.
  function stampLinks(lang) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.dataset.href === undefined) {
        var raw = a.getAttribute('href');
        if (!raw || /^[a-z]+:/i.test(raw) || raw.charAt(0) === '#' || raw.charAt(0) === '/') continue;
        if (a.hasAttribute('data-keep-lang')) continue;   // the link's whole point is the other language
        a.dataset.href = raw;
      }
      var base = a.dataset.href.split('#');
      var path = base[0].split('?')[0];
      var query = base[0].split('?')[1];
      var keep = (query ? query.split('&').filter(function (p) { return p.indexOf('lang=') !== 0; }) : []);
      keep.push('lang=' + lang);
      a.setAttribute('href', path + '?' + keep.join('&') + (base[1] ? '#' + base[1] : ''));
    }
  }

  function setLang(lang) {
    doc.setAttribute('data-lang', lang);
    doc.setAttribute('lang', lang);
    try { localStorage.setItem(STORE, lang); } catch (e) { /* private mode */ }
    var buttons = document.querySelectorAll('.lang button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].dataset.lang === lang));
    }
    stampLinks(lang);
    drawTitle(lang);
    updateTray();
  }

  var langBox = document.querySelector('.lang');
  if (langBox) {
    langBox.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-lang]');
      if (b) setLang(b.dataset.lang);
    });
  }

  /* ----------------------------------------------------------- title art */

  var P = {
    bone: '#d9cdb4', brass: '#b08d3f', brassLit: '#e0c069',
    brassDark: '#7d6229', ember: '#d8622b', void: '#0d0b12'
  };

  var SUB = { es: 'EL RELOJ ANATOMICO', en: 'THE ANATOMICAL CLOCK' };
  var MOTES = [[14, 30], [34, 47], [222, 22], [239, 41], [96, 52], [176, 51], [58, 19]];

  function drawTitle(lang) {
    var cv = document.getElementById('title-art');
    if (!cv || !window.PixelFont) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, mid = W >> 1;
    ctx.clearRect(0, 0, W, cv.height);

    // brass pipe with bolts, straight out of the build B title screen
    ctx.fillStyle = P.brass; ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = P.brassDark; ctx.fillRect(0, 4, W, 1);
    ctx.fillStyle = P.brassLit;
    for (var x = 6; x < W - 2; x += 24) ctx.fillRect(x, 1, 3, 2);

    ctx.fillStyle = P.ember;
    for (var i = 0; i < MOTES.length; i++) ctx.fillRect(MOTES[i][0], MOTES[i][1], 1, 1);

    PixelFont.text(ctx, 'DEADLOCK DECK', mid, 12, 3, P.bone, 'center', P.void);
    PixelFont.text(ctx, SUB[lang] || SUB.es, mid, 34, 2, P.brassLit, 'center', P.void);

    ctx.fillStyle = P.brass; ctx.fillRect(mid - 63, 50, 126, 1);
    ctx.fillRect(mid - 66, 49, 2, 3); ctx.fillRect(mid + 64, 49, 2, 3);

    cv.hidden = false;
    var fallback = document.querySelector('.title-fallback');
    if (fallback) fallback.classList.add('sr-only');
  }

  /* ---------------------------------------------------------- compare tray */

  var tray = document.getElementById('tray');
  var trayCount = document.getElementById('tray-count');
  var trayOpen = document.getElementById('tray-open');
  var trayClear = document.getElementById('tray-clear');
  var picks = Array.prototype.slice.call(document.querySelectorAll('.pick input'));

  function selected() {
    return picks.filter(function (p) { return p.checked; }).map(function (p) { return p.value; });
  }

  function updateTray() {
    if (!tray) return;
    var ids = selected(), n = ids.length, lang = currentLang();
    tray.hidden = n === 0;
    if (n === 0) return;

    var stack = n > 1 && window.matchMedia('(max-width: 860px)').matches;
    var es = n === 1
      ? 'Elegida 1 construccion. Marca otra para verlas lado a lado.'
      : 'Elegidas <b>' + n + '</b> construcciones: ' + ids.join(', ').toUpperCase() + '.';
    var en = n === 1
      ? 'One build picked. Tick another to see them side by side.'
      : '<b>' + n + '</b> builds picked: ' + ids.join(', ').toUpperCase() + '.';
    if (stack) {
      es += ' <span class="tray-warn">En esta pantalla se apilan en vertical.</span>';
      en += ' <span class="tray-warn">On this screen they stack vertically.</span>';
    }
    trayCount.innerHTML = '<span lang="es">' + es + '</span><span lang="en">' + en + '</span>';

    trayOpen.href = 'play.html?g=' + ids.join(',') + '&lang=' + lang;
    trayOpen.innerHTML = n === 1
      ? '<span lang="es">Abrir 1</span><span lang="en">Open 1</span>'
      : '<span lang="es">Abrir ' + n + ' lado a lado</span><span lang="en">Open ' + n + ' side by side</span>';
  }

  picks.forEach(function (p) { p.addEventListener('change', updateTray); });
  if (trayClear) {
    trayClear.addEventListener('click', function () {
      picks.forEach(function (p) { p.checked = false; });
      updateTray();
    });
  }
  window.addEventListener('resize', updateTray);

  /* ------------------------------------------------------- hash targets */
  /* A link to #prompt should show the prompt, not a collapsed summary. The
     browser has already scrolled to it, so this only opens it; scrolling again
     on top of that jump races it and leaves the page half-painted. */
  function openHashTarget() {
    var id = location.hash.slice(1);
    var el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') el.open = true;
  }
  window.addEventListener('hashchange', openHashTarget);

  setLang(currentLang());
  openHashTarget();
})();
