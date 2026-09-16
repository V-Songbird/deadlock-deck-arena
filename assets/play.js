/* Deadlock Deck Arena - side-by-side player.
   ?g=b        one build
   ?g=b,d,e    three builds in one grid, each in its own frame
   The URL is the whole state, so back, forward and a copied link all work. */
(function () {
  'use strict';

  var GAMES = {
    a: { slug: 'a-deepseek-x-opus', orch: 'DeepSeek-V4.1-Flash', work: 'Opus 5' },
    b: { slug: 'b-opus-x-deepseek', orch: 'Opus 5', work: 'DeepSeek-V4.1-Flash' },
    c: { slug: 'c-fable-x-deepseek-opus', orch: 'Fable 5.1', work: 'DeepSeek-V4.1-Flash + Opus 5' },
    d: { slug: 'd-opus-x-opus', orch: 'Opus 5', work: 'Opus 5' },
    e: { slug: 'e-astra', orch: 'Astra 6 Pro (Web)', work: 'Astra 6 Pro (Web)' },
    f: { slug: 'f-fable-x-fable', orch: 'Fable 5.1', work: 'Fable 5.1' },
    g: { slug: 'g-fable-x-opus', orch: 'Fable 5.1', work: 'Opus 5' }
  };

  var panes = document.getElementById('panes');
  var hudLabel = document.getElementById('hud-label');
  var reloadAll = document.getElementById('reload-all');

  function lang() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'es';
  }

  function wanted() {
    var raw = new URLSearchParams(location.search).get('g') || '';
    var seen = {}, out = [];
    raw.toLowerCase().split(',').forEach(function (id) {
      id = id.trim();
      if (GAMES[id] && !seen[id]) { seen[id] = 1; out.push(id); }
    });
    return out;
  }

  function both(es, en) {
    return '<span lang="es">' + es + '</span><span lang="en">' + en + '</span>';
  }

  function syncUrl(ids) {
    var url = new URL(location.href);
    url.searchParams.set('g', ids.join(','));
    url.searchParams.set('lang', lang());
    history.replaceState(null, '', url.pathname.split('/').pop() + url.search);
  }

  function render() {
    var ids = wanted(), l = lang();
    panes.innerHTML = '';
    panes.dataset.n = String(Math.min(ids.length, 7));
    reloadAll.hidden = ids.length < 2;

    if (!ids.length) {
      hudLabel.textContent = '';
      var empty = document.createElement('div');
      empty.className = 'player-empty';
      empty.innerHTML =
        '<p>' + both('No has elegido ninguna construcción.', 'You have not picked a build.') + '</p>' +
        '<p class="build-actions">' +
          '<a class="btn btn-primary" href="play.html?g=a,b,c,d,e,f,g">' +
            both('Abrir las siete', 'Open all seven') + '</a>' +
          '<a class="btn" href="index.html">' + both('Volver a la arena', 'Back to the arena') + '</a>' +
        '</p>';
      panes.appendChild(empty);
      return;
    }

    hudLabel.textContent = ids.length === 1
      ? ids[0].toUpperCase()
      : ids.length + ' × ' + ids.join(' ').toUpperCase();

    ids.forEach(function (id) {
      var g = GAMES[id];
      var pane = document.createElement('section');
      pane.className = 'pane';
      pane.dataset.id = id;
      pane.setAttribute('aria-label', 'Build ' + id.toUpperCase() + ': ' + g.orch + ' to ' + g.work);

      var bar = document.createElement('div');
      bar.className = 'pane-bar';
      bar.innerHTML =
        '<span class="pane-letter" aria-hidden="true">' + id.toUpperCase() + '</span>' +
        '<span class="pane-name"><b>' + g.orch + '</b> &rarr; ' + g.work + '</span>' +
        '<button class="btn btn-small" type="button" data-act="reload" title="' +
          (l === 'es' ? 'Reiniciar esta partida' : 'Restart this run') + '" aria-label="' +
          (l === 'es' ? 'Reiniciar la construcción ' : 'Restart build ') + id.toUpperCase() +
          '">&#8635;</button>' +
        '<a class="btn btn-small" href="games/' + g.slug + '/index.html?lang=' + l + '" title="' +
          (l === 'es' ? 'Abrir sola, a pantalla completa' : 'Open alone, full page') + '" aria-label="' +
          (l === 'es' ? 'Abrir sola la construcción ' : 'Open build alone ') + id.toUpperCase() +
          '">&#8599;</a>' +
        (ids.length > 1
          ? '<button class="btn btn-small" type="button" data-act="close" aria-label="' +
            (l === 'es' ? 'Cerrar la construcción ' : 'Close build ') + id.toUpperCase() +
            '">&#10005;</button>'
          : '');

      var frame = document.createElement('iframe');
      frame.className = 'pane-frame';
      frame.src = 'games/' + g.slug + '/index.html?lang=' + l;
      frame.title = 'Deadlock Deck ' + id.toUpperCase() + ' — ' + g.orch + ' / ' + g.work;
      frame.allow = 'autoplay; fullscreen';

      pane.appendChild(bar);
      pane.appendChild(frame);
      panes.appendChild(pane);
    });

    syncUrl(ids);
  }

  /* ------------------------------------------------------------- actions */

  panes.addEventListener('click', function (ev) {
    var btn = ev.target.closest('button[data-act]');
    var pane = ev.target.closest('.pane');
    if (!btn || !pane) return;
    if (btn.dataset.act === 'reload') {
      var frame = pane.querySelector('iframe');
      frame.src = frame.src;                       // same URL: a clean restart
    } else if (btn.dataset.act === 'close') {
      var left = wanted().filter(function (id) { return id !== pane.dataset.id; });
      syncUrl(left);
      render();
    }
  });

  // Marks which pane owns the keyboard. Clicking inside an iframe blurs the
  // parent window, so that event is where the focused pane really shows up.
  function markFocus(pane) {
    var all = panes.querySelectorAll('.pane');
    for (var i = 0; i < all.length; i++) all[i].classList.toggle('focused', all[i] === pane);
  }
  panes.addEventListener('pointerdown', function (ev) {
    markFocus(ev.target.closest('.pane'));
  });
  window.addEventListener('blur', function () {
    var el = document.activeElement;
    if (el && el.tagName === 'IFRAME') markFocus(el.closest('.pane'));
  });

  reloadAll.addEventListener('click', function () {
    var frames = panes.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) frames[i].src = frames[i].src;
  });

  // hub.js owns the language buttons; this rebuilds the frames afterwards so
  // each game reloads in the language that was just chosen.
  var box = document.querySelector('.lang');
  if (box) box.addEventListener('click', function (ev) {
    if (ev.target.closest('button[data-lang]')) render();
  });

  window.addEventListener('popstate', render);
  render();
})();
