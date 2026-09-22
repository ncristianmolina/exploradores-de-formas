/* Estado, controladores y presentación. Sin módulos ni fetch: funciona con file://. */
(function () {
  'use strict';
  const G = window.Geometry, C = window.Challenges;
  const $ = s => document.querySelector(s), clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const palette = ['#4670cf', '#e28c22', '#1f9387', '#bc5380', '#865dc2', '#527d37'];
  const KEY = 'exploradores-formas-v1';
  const defaults = () => ({ voice: true, effects: true, calm: true, mode: 'solo', selected: ['mosaic', 'mail', 'path', 'pattern'], completed: [], seen: [], turn: 0 });
  let storageOK = true;
  function load() {
    const base = defaults();
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!value || typeof value !== 'object') return base;
      for (const k of ['voice', 'effects', 'calm']) if (typeof value[k] === 'boolean') base[k] = value[k];
      if (['solo', 'pair', 'trio', 'group'].includes(value.mode)) base.mode = value.mode;
      if (Array.isArray(value.selected)) base.selected = [...new Set(value.selected.filter(id => C.games.some(g => g.id === id)))].slice(0, 4);
      if (Array.isArray(value.completed)) base.completed = [...new Set(value.completed.filter(id => typeof id === 'string' && /^(mosaic|mail|detective|intruder|memory|path|pattern|repair):[123]:[01]$/.test(id)))];
      if (Array.isArray(value.seen)) base.seen = value.seen.filter(id => C.games.some(g => g.id === id));
      base.turn = Number.isInteger(value.turn) && value.turn >= 0 ? value.turn : 0;
    } catch (_) { storageOK = false; }
    return base;
  }
  const app = { prefs: load(), view: 'map', game: null, sessions: {}, lastLevel: {}, practiceReturn: null, demo: null, clock: { left: 38 * 60, running: false, end: null, handle: null }, modal: null };
  const timers = new Set(); let audio = null, voices = [], drag = null, suppressClickUntil = 0, memoryTimer = null, navigationAfter = 0;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(app.prefs)); } catch (_) { storageOK = false; } }
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; }
  function stopAudio() {
    try { window.speechSynthesis?.cancel(); } catch (_) { /* mejora opcional */ }
    if (audio) { audio.close().catch(() => {}); audio = null; }
  }
  function cleanup() {
    timers.forEach(clearTimeout); timers.clear(); memoryTimer = null; stopAudio();
    if (drag?.ghost) drag.ghost.remove(); drag = null;
  }
  function speak(text) {
    stopAudio();
    if (!app.prefs.voice || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    try {
      const msg = new SpeechSynthesisUtterance(text); msg.lang = 'es-AR'; msg.rate = .86;
      const spanish = voices.find(v => /^es[-_]AR/i.test(v.lang)) || voices.find(v => /^es/i.test(v.lang) && v.localService) || voices.find(v => /^es/i.test(v.lang));
      if (spanish) msg.voice = spanish;
      window.speechSynthesis.speak(msg);
    } catch (_) { /* El texto y las demostraciones siguen disponibles. */ }
  }
  if ('speechSynthesis' in window) {
    const refresh = () => { try { voices = window.speechSynthesis.getVoices(); } catch (_) {} };
    refresh(); window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
  }
  function chime() {
    if (!app.prefs.effects) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return;
      if (audio) audio.close().catch(() => {}); audio = new Context();
      const ctx = audio, gain = ctx.createGain(); gain.connect(ctx.destination); gain.gain.value = .035;
      [523.25, 659.25].forEach((hz, i) => { const o = ctx.createOscillator(); o.frequency.value = hz; o.connect(gain); o.start(ctx.currentTime + i * .12); o.stop(ctx.currentTime + i * .12 + .15); });
    } catch (_) { /* Sin sonido también se puede jugar. */ }
  }
  const button = (action, label, value = '', cls = '', extra = '') => `<button type="button" class="${cls}" data-action="${action}" data-value="${esc(value)}" data-focus="${action}:${esc(value)}" ${extra}>${label}</button>`;
  function shape(item, mark = false) {
    const it = typeof item === 'string' ? { kind: item } : item;
    const k = it.kind, angle = it.angle || 0, size = it.size || 1, color = palette[it.color ?? 0];
    let poly = k === 'square' ? [[30, 30], [90, 30], [90, 90], [30, 90]] : k === 'rectangle' ? [[18, 39], [102, 39], [102, 81], [18, 81]] : (it.variant === 1 ? [[28, 28], [92, 28], [28, 92]] : it.variant === 2 ? [[20, 90], [48, 24], [100, 90]] : [[22, 93], [60, 25], [98, 93]]);
    const body = k === 'circle' ? `<circle cx="60" cy="60" r="35"/>` : `<polygon points="${poly.map(p => p.join(',')).join(' ')}"/>`;
    const marks = !mark || k === 'circle' ? '' : poly.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="white" stroke="#25366b" stroke-width="3"/>`).join('');
    const right = mark && ['square', 'rectangle'].includes(k) ? `<path d="M ${poly[0][0]} ${poly[0][1] + 10} h 10 v -10" fill="none" stroke="#25366b" stroke-width="3"/>` : '';
    return `<svg viewBox="0 0 120 120" class="shape-svg ${mark ? 'marked' : ''}" aria-hidden="true"><g transform="translate(60 60) rotate(${angle}) scale(${size}) translate(-60 -60)" fill="${color}" stroke="${mark ? '#25366b' : color}" stroke-width="${mark ? 5 : 2}" stroke-linejoin="round">${body}${marks}${right}</g></svg>`;
  }
  const itemLabel = i => `${G.shapes[i.kind].name}${i.angle ? ', girado' : ''}`;
  const shapeButton = (action, item, value, classes = '', extra = '', mark = false) => button(action, shape(item, mark), value, `shape-button ${classes}`, `aria-label="${esc(itemLabel(item))}" ${extra}`);
  function gameIcon(id) {
    const pairs = { mosaic: ['square', 'triangle'], mail: ['circle', 'square'], detective: ['triangle', 'circle'], intruder: ['square', 'triangle'], memory: ['square', 'square'], path: ['triangle', 'triangle'], pattern: ['circle', 'square'], repair: ['rectangle', 'square'] };
    return `<span class="game-icon" aria-hidden="true">${pairs[id].map((k, i) => shape({ kind: k, color: i ? 1 : 0, angle: id === 'memory' && i ? 45 : 0 })).join('')}</span>`;
  }
  function count(game) { return app.prefs.completed.filter(id => id.startsWith(game + ':')).length; }
  function header() {
    return `<header class="topbar"><button class="brand" data-action="map" aria-label="Exploradores de Formas: ir al mapa"><span class="brand-mark" aria-hidden="true">${shape({ kind: 'square', color: 1 })}${shape({ kind: 'circle', color: 2 })}</span><span>Exploradores<small>de Formas</small></span></button><nav aria-label="Opciones">${button('album', 'Mi álbum', '', 'quiet')}${button('sound', app.prefs.voice || app.prefs.effects ? 'Sonido' : 'Sin sonido', '', 'quiet', 'aria-label="Ajustes de voz y efectos"')}${button('teacher', 'Docentes', '', 'teacher-button')}</nav></header>`;
  }
  function roleBar() {
    const mode = app.prefs.mode, t = app.prefs.turn;
    if (mode === 'solo') return '';
    if (mode === 'group') return `<div class="role-bar"><span><strong>Todo el grupo:</strong> acuerden una idea. Después, una pareja la prueba.</span>${button('rotate-role', 'Cambiar pareja', '', 'small quiet')}</div>`;
    const n = mode === 'trio' ? 3 : 2;
    return `<div class="role-bar"><span><strong>${t % n + 1}</strong> manipula · <strong>${(t + 1) % n + 1}</strong> explica${n === 3 ? ` · <strong>${(t + 2) % n + 1}</strong> comprueba` : ''}</span>${button('rotate-role', 'Cambiar roles', '', 'small quiet')}</div>`;
  }
  function mapView() {
    const explored = C.games.filter(g => count(g.id) > 0).length;
    return `${header()}<main id="main" class="map-view" tabindex="-1"><div class="map-heading"><div><p class="eyebrow">TU EXPEDICIÓN GEOMÉTRICA</p><h1>¿Dónde exploramos hoy?</h1><p>Elegí un lugar. Tocá, probá y descubrí.</p></div><div class="album-meter"><strong>${explored}<span> / 8</span></strong><span>lugares explorados</span></div></div>
      <div class="map-layout"><section class="map-grid" aria-label="Mapa de ocho desafíos">${C.games.map((g, i) => `<button class="map-card ${count(g.id) ? 'explored' : ''}" style="--accent:${g.color}" data-action="open" data-value="${g.id}"><span class="card-top"><span class="station-number">${String(i + 1).padStart(2, '0')}</span><span class="station-status">${count(g.id) ? '✓ Exploramos' : 'Podés jugar'}</span></span>${gameIcon(g.id)}<span class="card-verb">${g.verb}</span><strong>${g.name}</strong><span class="card-skill">${g.skill}</span>${app.prefs.selected.includes(g.id) ? '<span class="class-mark">En nuestra clase</span>' : ''}</button>`).join('')}</section>
      <aside class="field-notes"><p class="eyebrow">CUADERNO DE EXPLORACIÓN</p><h2>Hoy descubrimos…</h2><div class="album-mini" aria-hidden="true">${C.games.map((g, i) => `<span class="${count(g.id) ? 'found' : ''}">${count(g.id) ? shape({ kind: C.kinds[i % 4], color: i % 6 }) : String(i + 1).padStart(2, '0')}</span>`).join('')}</div><p>Cada reto resuelto deja una pieza en tu álbum.</p>${button('album', 'Abrir mi álbum', '', 'outline wide')}<div class="note-divider"></div><h3>Probamos juntos</h3><p>¿Cómo lo sabés?<br>Contalo con palabras, con tu dedo o con una figura.</p></aside></div>
      <section class="class-route"><div><strong>Nuestra clase de hoy</strong><span>${app.prefs.selected.length} de 4 desafíos elegidos</span></div><div class="class-chips">${app.prefs.selected.map(id => { const g = C.games.find(g => g.id === id); return button('open', `<span aria-hidden="true">${C.games.indexOf(g) + 1}</span> ${g.verb}`, id, 'class-chip'); }).join('')}</div>${button('teacher', 'Elegir actividades', '', 'quiet')}</section>
      <footer class="map-footer"><span>Sin apuro. Pedir ayuda también es explorar.</span><span>Una partida por dispositivo.</span></footer></main>${clockBadge()}`;
  }
  function current() { return app.game; }
  function levelNav(s) { return `<div class="levels" role="group" aria-label="Dificultad">${[1, 2, 3].map(l => button('level', `${l === 1 ? 'Exploro' : l === 2 ? 'Conecto' : 'Investigo'} <span>${l}</span>`, l, l === s.ch.level ? 'active' : '', `aria-pressed="${l === s.ch.level}"`)).join('')}</div>`; }
  function gameView(s) {
    const meta = C.games.find(g => g.id === s.ch.game), engine = engines[s.ch.game];
    const undoable = ['mosaic', 'mail', 'path', 'pattern', 'repair'].includes(s.ch.game);
    const title = engine.instruction ? engine.instruction(s) : s.ch.title || meta.prompt;
    return `${header()}<main id="main" class="play-view" tabindex="-1" style="--accent:${meta.color}"><div class="play-top">${button('map', '← Mapa', '', 'quiet')}<div class="play-title"><span class="eyebrow">${s.practice ? 'EJEMPLO PARA PRACTICAR' : `RETO ${s.ch.variant + 1} DE 2 · NIVEL ${s.ch.level}`}</span><h1>${meta.name}</h1></div>${s.practice ? button('end-practice', 'Volver a mi reto', '', 'outline') : levelNav(s)}</div>${roleBar()}
      <section class="game-shell"><div class="instruction"><h2 id="game-instruction">${esc(title)}</h2>${button('listen', '▷ Escuchar', '', 'listen', 'aria-label="Escuchar la consigna"')}</div>
      <div class="game-workspace" aria-describedby="game-instruction">${engine.render(s)}</div>
      <div class="feedback ${s.feedback?.type || ''}" id="feedback">${s.feedback ? `<span aria-hidden="true">${s.feedback.type === 'success' ? '✓' : '◇'}</span><span>${esc(s.feedback.text)}</span>` : '<span class="gentle-note">Podés probar y cambiar de idea.</span>'}</div>
      ${s.completed ? `<div class="completion"><div><strong>${s.practice ? '¡Lo descubriste!' : s.data.creative ? '¡Una creación para compartir!' : '¡Descubrimiento para tu álbum!'}</strong><p>${s.data.creative === 'free' ? '¿Querés contar cómo la pensaste?' : esc(meta.discovery)}</p></div>${button(s.practice ? 'end-practice' : 'next', s.practice ? 'Volver a mi reto' : s.data.creative ? 'Volver a desafíos →' : 'Otro reto →', '', 'primary')}${s.ch.game === 'mosaic' ? button('g:takeApart', 'Desarmar la figura', '', 'outline') : ''}${!s.practice ? button('map', 'Elegir otro lugar', '', 'outline') : ''}</div>` : ''}
      <div class="game-toolbar"><div>${undoable ? button('undo', '↶ Deshacer', '', 'quiet', (!s.history.length || s.completed) ? 'disabled' : '') : ''}${button('reset', 'Reiniciar reto', '', 'quiet')}</div><div>${button('demo', 'Repetir ejemplo', '', 'quiet')}${button('help', 'Pedir ayuda', '', 'outline', s.completed ? 'disabled' : '')}${s.help >= 3 && !s.practice && !s.completed ? button('practice', 'Practicar parecido', '', 'quiet') : ''}</div></div></section>
      <div class="play-bottom"><span>${meta.skill} · ${count(meta.id)} de 6 descubrimientos</span>${!s.practice ? button('skip', 'Cambiar de reto →', '', 'text-button') : ''}</div></main>${clockBadge()}`;
  }
  function render(focusTitle = false) {
    const focused = document.activeElement?.dataset?.focus;
    $('#app').innerHTML = app.view === 'map' ? mapView() : gameView(current());
    if (focusTitle) $('#main h1')?.setAttribute('tabindex', '-1');
    if (focusTitle) $('#main h1')?.focus({ preventScroll: true });
    else if (focused) [...document.querySelectorAll('[data-focus]')].find(e => e.dataset.focus === focused)?.focus({ preventScroll: true });
  }
  function announce(text) { $('#announcer').textContent = text; }
  function feedback(s, text, type = 'info') { s.feedback = { text, type }; announce(text); }
  function remember(s) { s.history.push(clone(s.data)); if (s.history.length > 100) s.history.shift(); }
  function fail(s, text) {
    s.attempts++; s.help = Math.max(s.help, Math.min(3, s.attempts));
    feedback(s, text + (s.attempts === 3 ? ' Podés repetir el ejemplo.' : ''), 'observe');
  }
  function complete(s, text) {
    if (s.completed) return;
    s.completed = true; cleanup(); feedback(s, text, 'success');
    if (!s.practice && !s.data.creative) {
      if (!app.prefs.completed.includes(s.ch.id)) app.prefs.completed.push(s.ch.id);
      save();
    }
    chime();
  }
  function makeSession(game, level, variant, seed = 42, practice = false) {
    const ch = C.get(game, level, variant, seed);
    if (!C.validate(ch)) throw new Error('El reto no pasó su comprobación geométrica.');
    return { ch, data: engines[game].init(ch), history: [], attempts: 0, help: 0, feedback: null, completed: false, practice };
  }
  function openGame(id, level = app.lastLevel[id] || 1) {
    if (!C.games.some(g => g.id === id) || ![1, 2, 3].includes(level)) return;
    cleanup(); closeModal(); app.practiceReturn = null;
    const key = `${id}:${level}`;
    if (!app.sessions[key]) app.sessions[key] = makeSession(id, level, 0);
    app.game = app.sessions[key]; app.lastLevel[id] = level; app.view = 'game'; render(true);
    if (!app.prefs.seen.includes(id)) { app.prefs.seen.push(id); save(); openDemo(); }
    else resumeMemory();
  }
  function goMap() { cleanup(); closeModal(); app.practiceReturn = null; app.view = 'map'; render(true); }
  function nextChallenge() {
    const s = current(); cleanup();
    let level = s.ch.level, variant = s.ch.variant + 1;
    if (variant > 1) { variant = 0; level = level % 3 + 1; }
    app.prefs.turn++; save();
    const fresh = makeSession(s.ch.game, level, variant, s.ch.seed + 17);
    app.sessions[`${s.ch.game}:${level}`] = fresh; app.lastLevel[s.ch.game] = level; app.game = fresh; render(true);
  }
  function doGame(action, value) {
    const s = current(); if (!s || app.view !== 'game' || s.completed) return;
    engines[s.ch.game].act(s, action, value); render();
  }
  function help() {
    const s = current(); if (s.completed) return;
    s.help = Math.min(4, s.help + 1);
    const meta = C.games.find(g => g.id === s.ch.game);
    const hint = engines[s.ch.game].hint?.(s) || meta.hint;
    feedback(s, s.help === 1 ? meta.hint : hint);
    render(); if (s.help === 3) openDemo();
  }
  function practice() {
    cleanup(); const s = current(); app.practiceReturn = s;
    app.game = makeSession(s.ch.game, 1, s.ch.variant ? 0 : 1, s.ch.seed + 7, true);
    app.game.help = 2; feedback(app.game, 'Probemos un ejemplo sencillo. Después volvemos a tu reto.'); render(true);
  }
  function endPractice() { if (!app.practiceReturn) return; cleanup(); app.game = app.practiceReturn; app.practiceReturn = null; render(true); resumeMemory(); }

  /* A. Construcción con cobertura exacta sobre una retícula triangular. */
  function pieceSVG(type, rotation = 0, color = 0) {
    const p = G.piecePolygon(type, 0, 0, rotation);
    return `<svg viewBox="-0.18 -0.18 2.36 2.36" aria-hidden="true" class="piece-svg"><polygon points="${p.map(a => a.join(',')).join(' ')}" fill="${palette[color % 6]}" stroke="#25366b" stroke-width=".035"/></svg>`;
  }
  const engines = {};
  engines.mosaic = {
    init: ch => ({ selected: null, placements: Object.fromEntries(ch.pieces.filter(p => p.fixed).map(p => [p.id, clone(p.solution)])), rotations: Object.fromEntries(ch.pieces.map(p => [p.id, p.initialRotation])) }),
    render(s) {
      const { ch, data: d } = s;
      const solution = s.help >= 2 && !s.completed ? G.solveMosaic(ch, d.placements) : null;
      const next = solution && ch.pieces.find(p => !d.placements[p.id]);
      const ghost = next ? G.piecePolygon(next.type, solution[next.id].x, solution[next.id].y, solution[next.id].r) : null;
      const polygons = ch.pieces.filter(p => d.placements[p.id]).map((p, i) => `<polygon points="${G.piecePolygon(p.type, d.placements[p.id].x, d.placements[p.id].y, d.placements[p.id].r).map(a => a.join(',')).join(' ')}" fill="${p.fixed ? '#b3c1dc' : palette[ch.pieces.indexOf(p) % 6]}" stroke="#25366b" stroke-width=".028"/>`).join('');
      return `<div class="split-board"><section class="construction-area"><div class="board-caption">${ch.w === ch.h ? 'Modelo: cuadrado' : 'Modelo: rectángulo no cuadrado'}</div><div class="mosaic-board" style="--cols:${ch.w};--rows:${ch.h};width:min(100%,${300 * ch.w / ch.h}px);aspect-ratio:${ch.w}/${ch.h}"><svg viewBox="0 0 ${ch.w} ${ch.h}" aria-hidden="true"><rect width="${ch.w}" height="${ch.h}" fill="#edf2fb"/>${polygons}${ghost ? `<polygon class="ghost-piece" points="${ghost.map(a => a.join(',')).join(' ')}"/>` : ''}</svg><div class="mosaic-cells">${Array.from({ length: ch.w * ch.h }, (_, i) => button('g:place', `<span aria-hidden="true">${i + 1}</span>`, i, 'mosaic-cell', `data-drop="g:place" data-drop-value="${i}" aria-label="Colocar desde fila ${Math.floor(i / ch.w) + 1}, columna ${i % ch.w + 1}" ${s.completed ? 'disabled' : ''}`)).join('')}</div></div><p class="micro">${d.disassemble ? 'Tocá “Sacar” en una pieza. Después podés volver a construir.' : 'Tocá la casilla donde empieza la pieza. Encaja sola.'}</p></section><section class="piece-shelf"><h3>Tus piezas</h3><div class="pieces">${ch.pieces.filter(p => !p.fixed || d.disassemble).map(p => button('g:select', `${pieceSVG(p.type, d.rotations[p.id], ch.pieces.indexOf(p))}<span>${d.placements[p.id] ? d.disassemble ? `Sacar ${p.id.toUpperCase()}` : '✓ Colocada' : `Pieza ${p.id.toUpperCase()}`}</span>`, p.id, `piece ${d.selected === p.id ? 'selected' : ''}`, `aria-pressed="${d.selected === p.id}" ${(d.placements[p.id] && !d.disassemble) || s.completed ? 'disabled' : ''}`)).join('')}</div>${button('g:rotate', '↻ Girar pieza', '', 'outline wide', !d.selected || s.completed ? 'disabled' : '')}<p class="micro">Cada giro es un cuarto de vuelta.</p></section></div>`;
    },
    act(s, action, value) {
      const d = s.data, ch = s.ch;
      if (action === 'takeApart' && s.completed) {
        s.completed = false; d.disassemble = true; s.history = [];
        feedback(s, '¿Qué piezas forman tu figura? Tocá “Sacar” para descubrirlo y después volvé a construir.'); return;
      }
      if (action === 'select' && ch.pieces.some(p => p.id === value && (!p.fixed || d.disassemble))) {
        if (d.placements[value] && d.disassemble) { remember(s); d.rotations[value] = d.placements[value].r; delete d.placements[value]; d.selected = value; return; }
        if (!d.placements[value]) d.selected = value;
      }
      if (action === 'rotate' && d.selected) d.rotations[d.selected] = (d.rotations[d.selected] + 1) % 4;
      if (action !== 'place') return;
      if (!d.selected) return feedback(s, 'Primero elegí una pieza.');
      const cell = Number(value), p = ch.pieces.find(p => p.id === d.selected);
      if (!Number.isInteger(cell) || cell < 0 || cell >= ch.w * ch.h || !p || d.placements[p.id]) return;
      const placement = { x: cell % ch.w, y: Math.floor(cell / ch.w), r: d.rotations[p.id] };
      const next = { ...d.placements, [p.id]: placement }, result = G.mosaicStatus(ch, next);
      if (!result.valid) return fail(s, result.reason === 'outside' ? 'La pieza sale del contorno. Probá otro lugar o girala.' : 'Aquí una pieza tapa a otra. Buscá un hueco o girala.');
      remember(s); d.placements = next; d.selected = null; s.feedback = null;
      if (result.complete) complete(s, '¡Encajó! Cubriste todo el modelo sin huecos ni piezas superpuestas.');
    },
    hint(s) { return G.solveMosaic(s.ch, s.data.placements) ? 'El contorno punteado muestra una pieza posible. Buscá su forma y girala.' : 'Esta posición deja un hueco que no podemos llenar. Deshacé una pieza y probá de nuevo.'; }
  };

  /* B. Clasificación editable: arrastrar o elegir pieza y luego buzón. */
  engines.mail = {
    init: () => ({ selected: null, bins: {}, checked: false }),
    render(s) {
      const { ch, data: d } = s;
      const tile = item => shapeButton('g:select', item, item.id, `${d.selected === item.id ? 'selected' : ''} ${d.checked && d.bins[item.id] !== undefined && !G.predicates[ch.bins[d.bins[item.id]].rule](item.kind) ? 'needs-look' : ''}`, `data-drag="${item.id}" aria-pressed="${d.selected === item.id}" ${s.completed ? 'disabled' : ''}`, s.help >= 2 || s.completed);
      return `<div class="mail-area"><div class="mail-tray" aria-label="Figuras para repartir">${ch.items.filter(i => d.bins[i.id] === undefined).map(tile).join('') || '<p>Ya repartiste todas las figuras. Podés revisarlas.</p>'}</div><div class="mailboxes" style="--bins:${ch.bins.length}">${ch.bins.map((b, i) => `<section class="mailbox" data-drop="g:deliver" data-drop-value="${i}"><div class="mailbox-header">${shape(b.icon, s.help >= 2)}<h3>${b.label}</h3></div>${button('g:deliver', 'Colocar aquí ↓', i, 'mail-slot', `aria-label="Buzón: ${esc(b.label)}" ${s.completed ? 'disabled' : ''}`)}<div class="mail-items">${ch.items.filter(item => d.bins[item.id] === i).map(tile).join('')}</div></section>`).join('')}</div><div class="board-actions"><p class="micro">Tocá una figura y su buzón. También podés arrastrarla.</p>${!ch.immediate ? button('g:check', 'Comprobar reparto', '', 'primary', s.completed ? 'disabled' : '') : '<span class="micro">Revisamos cada entrega juntos.</span>'}</div></div>`;
    },
    act(s, action, value) {
      const d = s.data, ch = s.ch;
      if (action === 'select' && ch.items.some(i => i.id === value)) { d.selected = value; return; }
      if (action === 'deliver') {
        if (!d.selected) return feedback(s, 'Primero elegí la figura que querés repartir.');
        const i = Number(value), item = ch.items.find(p => p.id === d.selected); if (!ch.bins[i]) return;
        if (ch.immediate && !G.predicates[ch.bins[i].rule](item.kind)) return fail(s, `${G.describe(item.kind)} Este buzón dice: ${ch.bins[i].label.toLowerCase()}.`);
        remember(s); d.bins[item.id] = i; d.selected = null; d.checked = false; s.feedback = null;
        if (ch.immediate && ch.items.every(i => d.bins[i.id] !== undefined)) complete(s, '¡Correo entregado! Cada figura cumple la regla de su buzón.');
      }
      if (action === 'check') {
        if (ch.items.some(i => d.bins[i.id] === undefined)) return feedback(s, 'Todavía quedan figuras por repartir.');
        d.checked = true;
        const wrong = ch.items.find(i => !G.predicates[ch.bins[d.bins[i.id]].rule](i.kind));
        if (wrong) fail(s, `${G.describe(wrong.kind)} Revisá la figura con el borde punteado y la regla de su buzón.`);
        else complete(s, '¡Todas llegaron! Las agrupaste por sus propiedades.');
      }
    },
    hint: () => 'Las puntas están marcadas. Podés contarlas y cambiar una figura de buzón.'
  };

  /* C. Pistas acumulativas: una elección compatible nunca se penaliza. */
  engines.detective = {
    init: () => ({ clue: 1, chosen: null }),
    render(s) {
      const d = s.data, ch = s.ch;
      return `<div class="detective-area"><div class="clue-board"><span class="mystery-symbol" aria-hidden="true">?</span><ol class="clue-list">${ch.clues.slice(0, d.clue).map(c => `<li>${esc(c.text)}</li>`).join('')}</ol>${button('g:clue', 'Otra pista +', '', 'outline', d.clue >= ch.clues.length || s.completed ? 'disabled' : '')}</div><div class="detective-options">${ch.options.map(o => shapeButton('g:choose', o, o.id, `${d.chosen === o.id ? 'selected' : ''} ${s.help >= 2 && G.clueCandidates([o], ch.clues.slice(0, d.clue)).length ? 'hint-outline' : ''}`, s.completed ? 'disabled' : '', (s.completed && d.chosen === o.id) || s.help >= 2)).join('')}</div>${s.completed ? `<p class="explanation">${G.describe(ch.target)} ${ch.target === 'square' ? 'Sus cuatro lados son iguales y sus esquinas son rectas, aunque esté girado.' : ch.target === 'rectangle' ? 'Este rectángulo tiene dos lados largos y dos cortos.' : ''}</p>` : '<p class="micro center">Podés pedir todas las pistas que necesites.</p>'}</div>`;
    },
    act(s, action, value) {
      const d = s.data, ch = s.ch;
      if (action === 'clue' && d.clue < ch.clues.length) { d.clue++; feedback(s, ch.clues[d.clue - 1].text); return; }
      if (action !== 'choose') return;
      const item = ch.options.find(o => o.id === value); if (!item) return;
      const shown = ch.clues.slice(0, d.clue), compatible = G.clueCandidates(ch.options, shown);
      if (!compatible.some(o => o.id === item.id)) { const missed = shown.find(c => !G.predicates[c.rule](item.kind)); return fail(s, `${G.describe(item.kind)} La pista dice: ${missed.text}`); }
      if (compatible.length > 1) {
        d.clue = Math.min(ch.clues.length, d.clue + 1);
        return feedback(s, '¡Esa figura cumple! Todavía hay más de una posible. Sumemos otra pista.');
      }
      d.chosen = item.id; complete(s, '¡Misterio resuelto! Mirá los bordes y las puntas que explican tu elección.');
    },
    hint: () => 'Marcamos las figuras que todavía cumplen todas las pistas. Podés pedir otra.'
  };

  /* D. Comparación bajo una regla explícita y explicación en un segundo paso. */
  engines.intruder = {
    init: () => ({ chosen: null }),
    instruction: s => s.data.chosen ? '¿Qué característica lo explica?' : 'Buscá quién no cumple la regla.',
    render(s) {
      const d = s.data, ch = s.ch;
      return `<div class="intruder-area"><div class="rule-banner"><span>LA REGLA</span><strong>${ch.label}</strong></div><div class="intruder-collection">${ch.items.map(i => shapeButton('g:choose', i, i.id, d.chosen === i.id ? 'selected' : '', s.completed ? 'disabled' : '', s.help >= 2 || d.chosen === i.id)).join('')}</div>${d.chosen ? `<div class="reason-options" aria-label="Explicá tu decisión">${ch.reasons.map(r => button('g:reason', `<span class="reason-mark" aria-hidden="true">${r.rule === 'three' ? '3' : r.rule === 'four' || r.rule === 'equalFour' ? '4' : r.rule === 'noCorners' ? '0' : r.rule === 'curved' ? '◯' : '▭'}</span>${esc(r.text)}`, r.rule, 'reason', s.completed ? 'disabled' : '')).join('')}</div>` : '<p class="micro center">El tamaño, el color y el giro pueden cambiar.</p>'}</div>`;
    },
    act(s, action, value) {
      if (action === 'choose') {
        const item = s.ch.items.find(i => i.id === value); if (!item) return;
        if (G.predicates[s.ch.rule](item.kind)) return fail(s, `${G.describe(item.kind)} Esta figura sí cumple la regla. Busquemos la que no la cumple.`);
        s.data.chosen = value; feedback(s, 'La encontraste. Ahora señalá qué característica lo explica.');
      }
      if (action === 'reason' && s.data.chosen) {
        const item = s.ch.items.find(i => i.id === s.data.chosen), reason = s.ch.reasons.find(r => r.rule === value); if (!reason) return;
        if (G.predicates[reason.rule](item.kind)) complete(s, '¡Bien explicado! Comparaste la figura con la regla del grupo.');
        else fail(s, `${G.describe(item.kind)} Mirá sus bordes y sus puntas para explicarlo.`);
      }
    },
    hint: () => 'Recorré los bordes resaltados. Contá las puntas y compará con la regla.'
  };

  /* E. Memoria: dos cartas abiertas como máximo y comparación sin apuro. */
  engines.memory = {
    init: () => ({ open: [], matched: [], mismatch: false }),
    render(s) {
      const d = s.data, ch = s.ch;
      return `<div class="memory-area"><div class="memory-options"><span>${d.matched.length / 2} de ${ch.cards.length / 2} parejas</span><label><input type="checkbox" data-setting="calm" ${app.prefs.calm ? 'checked' : ''}> Modo tranquilo</label></div><div class="memory-grid cards-${ch.cards.length}">${ch.cards.map((card, i) => {
        const matched = d.matched.includes(card.id), up = matched || d.open.includes(card.id);
        return button('g:flip', up ? `${shape(card, s.help >= 2)}${matched ? '<span class="pair-tick" aria-hidden="true">✓</span>' : ''}` : `<span class="card-back-symbol" aria-hidden="true">◇</span><span class="card-position">${i + 1}</span>`, card.id, `memory-card ${up ? 'face-up' : ''} ${matched ? 'matched' : ''}`, `aria-label="Carta ${i + 1}: ${up ? esc(itemLabel(card)) + (matched ? ', pareja encontrada' : '') : 'tapada'}" ${matched || d.mismatch || s.completed ? 'disabled' : ''}`);
      }).join('')}</div><div class="memory-compare">${d.mismatch ? `${button('g:hide', 'Volver a tapar', '', 'primary')}<p>Observá las dos formas antes de seguir.</p>` : `<p class="micro">${app.prefs.calm ? 'Vos decidís cuándo tapar un par diferente.' : 'Un par diferente queda visible al menos 3 segundos.'}</p>`}</div></div>`;
    },
    act(s, action, value) {
      const d = s.data;
      if (action === 'hide' && d.mismatch) { cleanup(); d.open = []; d.mismatch = false; s.feedback = null; return; }
      if (action !== 'flip' || d.mismatch || d.open.length >= 2 || d.open.includes(value) || d.matched.includes(value) || !s.ch.cards.some(c => c.id === value)) return;
      d.open.push(value);
      if (d.open.length < 2) return;
      const [a, b] = d.open.map(id => s.ch.cards.find(c => c.id === id));
      if (a.kind === b.kind) {
        d.matched.push(...d.open); d.open = []; feedback(s, '¡Mismo tipo! El color, el tamaño y el giro pueden cambiar.');
        if (d.matched.length === s.ch.cards.length) complete(s, '¡Todas las parejas! Reconociste las figuras aunque cambiaron.');
      } else {
        d.mismatch = true; fail(s, `${G.shapes[a.kind].name} y ${G.shapes[b.kind].name}: observá sus bordes. Son tipos distintos.`);
        scheduleMemory(s);
      }
    },
    hint: () => 'Las puntas de las cartas visibles están marcadas. Antes de taparlas, recordá sus lugares.'
  };
  function scheduleMemory(s) {
    if (app.prefs.calm) return;
    if (memoryTimer !== null) { clearTimeout(memoryTimer); timers.delete(memoryTimer); }
    memoryTimer = later(() => { memoryTimer = null; if (app.view === 'game' && current() === s && s.data.mismatch && !$('#dialog').open) { s.data.open = []; s.data.mismatch = false; s.feedback = null; render(); } }, 3000);
  }
  function resumeMemory() { const s = current(); if (app.view === 'game' && s?.ch.game === 'memory' && s.data.mismatch) scheduleMemory(s); }

  /* F. Recorridos: validar cada transición, nunca comparar con una única ruta. */
  engines.path = {
    init: ch => ({ path: [ch.start] }),
    render(s) {
      const { ch, data: d } = s, end = d.path[d.path.length - 1], next = ch.pattern[d.path.length % ch.pattern.length];
      const route = s.help >= 2 ? G.solvePath(ch, d.path) : null, hintCell = route?.[0];
      const lines = d.path.slice(1).map((cell, i) => { const prev = d.path[i]; return `<line x1="${prev % ch.w + .5}" y1="${Math.floor(prev / ch.w) + .5}" x2="${cell % ch.w + .5}" y2="${Math.floor(cell / ch.w) + .5}"/>`; }).join('');
      return `<div class="path-area"><div class="path-rule"><span>${ch.pattern.length === 1 ? 'PASÁ SOLO POR' : 'REPETÍ ESTA SECUENCIA'}</span><div class="shape-sequence">${ch.pattern.map((k, i) => `${i ? '<span aria-hidden="true">→</span>' : ''}<span>${shape(k)}<small>${G.shapes[k].name}</small></span>`).join('')}</div></div><div class="path-layout"><div class="path-board" style="--cols:${ch.w};aspect-ratio:${ch.w}/${ch.h}"><svg class="route-lines" viewBox="0 0 ${ch.w} ${ch.h}" preserveAspectRatio="none" aria-hidden="true"><g stroke="#223669" stroke-width=".1" fill="none" stroke-linecap="round">${lines}</g></svg>${ch.cells.map((kind, i) => button('g:step', `${shape({ kind, color: 0, size: .8 })}<span class="cell-tag">${i === ch.start ? 'SALIDA' : i === ch.goal ? 'META' : d.path.includes(i) ? '✓' : ''}</span>${i === end ? '<span class="you-marker" aria-hidden="true">●</span>' : ''}`, i, `path-cell ${d.path.includes(i) ? 'visited' : ''} ${i === end ? 'current' : ''} ${hintCell === i ? 'hint-outline' : ''}`, `aria-label="Fila ${Math.floor(i / ch.w) + 1}, columna ${i % ch.w + 1}: ${G.shapes[kind].name}${i === end ? ', estás aquí' : ''}${i === ch.goal ? ', meta' : ''}${i === ch.start ? ', salida' : ''}" ${s.completed ? 'disabled' : ''}`)).join('')}</div><div class="path-next"><span>${s.completed ? '¡LLEGASTE!' : 'AHORA BUSCÁ'}</span>${shape(next)}<strong>${G.shapes[next].name}</strong><p class="micro">Casillas vecinas por un lado.<br>Podés deshacer y probar otro camino.</p></div></div></div>`;
    },
    act(s, action, value) {
      if (action !== 'step') return; const next = Number(value), d = s.data;
      if (next === d.path[d.path.length - 1]) return;
      const why = G.pathStep(s.ch, d.path, next);
      if (why) return fail(s, why === 'neighbor' ? 'Esa casilla no está al lado. Buscá una vecina por arriba, abajo o los costados.' : `Ahora buscamos ${G.shapes[s.ch.pattern[d.path.length % s.ch.pattern.length]].name}. Mirá la próxima forma de la secuencia.`);
      remember(s); d.path.push(next); s.feedback = null;
      if (next === s.ch.goal) complete(s, '¡Llegaste a la meta! Todo tu recorrido respeta la regla.');
    },
    hint(s) { return G.solvePath(s.ch, s.data.path) ? 'El borde punteado marca un paso posible. Después podés elegir tu propio recorrido.' : 'Desde aquí la secuencia no llega a la meta. Deshacé pasos para probar otra salida.'; }
  };

  /* G. Patrones verificables y creación explícitamente libre. */
  engines.pattern = {
    init: () => ({ selected: null, filled: {}, checked: false, creative: null, block: [null, null], phase: 'build', activeBlock: 0 }),
    instruction(s) {
      const d = s.data;
      if (d.creative === 'free') return 'Inventá una serie libre.';
      if (d.creative === 'partner' && d.phase === 'build') return 'Armá el bloque que se va a repetir.';
      return 'Elegí una figura. Completá un hueco.';
    },
    render(s) {
      const d = s.data, ch = s.ch, creative = d.creative;
      const block = creative === 'partner' ? d.block : ch.block;
      const length = creative === 'free' ? 12 : creative ? block.length * 4 : ch.length;
      const holes = creative === 'free' ? Array.from({ length }, (_, i) => i) : creative ? Array.from({ length: block.length * 2 }, (_, i) => i + block.length * 2) : ch.holes;
      const building = creative === 'partner' && d.phase === 'build';
      const hintSlot = s.help >= 2 && creative !== 'free' && !building ? holes.find(i => d.filled[i] !== block[i % block.length]) : undefined;
      const tray = `<div class="pattern-palette">${C.kinds.map(kind => shapeButton('g:select', { kind, color: 0 }, kind, `${d.selected === kind ? 'selected' : ''} ${hintSlot !== undefined && kind === block[hintSlot % block.length] ? 'hint-outline' : ''}`, `data-drag="${kind}" aria-pressed="${d.selected === kind}" ${s.completed ? 'disabled' : ''}`)).join('')}</div>`;
      const top = !s.practice ? `<div class="creative-tabs" role="group" aria-label="Tipo de serie">${button('g:mode', 'Desafío', 'challenge', !creative ? 'active' : '')}${button('g:mode', 'Crear para otro', 'partner', creative === 'partner' ? 'active' : '')}${button('g:mode', 'Serie libre', 'free', creative === 'free' ? 'active' : '')}</div>` : '';
      if (building) return `${top}<div class="pattern-area"><p class="micro">Primero elegí una figura y tocá un lugar del bloque.</p><div class="block-length">${button('g:length', '2 lugares', 2, 'quiet', `aria-pressed="${d.block.length === 2}"`)}${button('g:length', '3 lugares', 3, 'quiet', `aria-pressed="${d.block.length === 3}"`)}</div><div class="creator-block">${d.block.map((k, i) => button('g:block', k ? shape(k) : '+', i, 'pattern-slot editable', `data-drop="g:block" data-drop-value="${i}" aria-label="Lugar ${i + 1} del bloque${k ? ': ' + G.shapes[k].name : ', vacío'}"`)).join('')}</div>${tray}${button('g:handoff', 'Pasar al compañero →', '', 'primary', d.block.some(k => !k) ? 'disabled' : '')}<p class="micro">Tu compañero continuará este bloque. Comprobaremos la regla que inventaste.</p></div>`;
      return `${top}<div class="pattern-area">${creative === 'free' ? '<p class="free-label">Creación libre: no hay una única respuesta correcta.</p>' : `<div class="repeat-key"><span>BLOQUE QUE SE REPITE</span><div>${block.map(k => shape(k)).join('')}<span aria-hidden="true">↻</span></div></div>`}<div class="pattern-track" style="--block:${block.length}">${Array.from({ length }, (_, i) => {
        const editable = holes.includes(i), k = editable ? d.filled[i] : block[i % block.length];
        return button('g:slot', k ? shape({ kind: k, color: 0 }) : '<span aria-hidden="true">+</span>', i, `pattern-slot ${editable ? 'editable' : ''} ${hintSlot === i ? 'hint-outline' : ''} ${!creative && s.ch.level === 1 && i < block.length ? 'first-block' : ''} ${d.checked && editable && k !== block[i % block.length] && creative !== 'free' ? 'needs-look' : ''}`, `data-drop="g:slot" data-drop-value="${i}" aria-label="Lugar ${i + 1}${k ? ': ' + G.shapes[k].name : ', vacío'}${editable ? ', editable' : ''}" ${!editable || s.completed ? 'disabled' : ''}`);
      }).join('')}</div>${tray}<div class="board-actions"><p class="micro">La regla usa la forma. El color no cambia.</p>${button('g:check', creative === 'free' ? 'Terminar mi creación' : 'Comprobar serie', '', 'primary', s.completed ? 'disabled' : '')}</div></div>`;
    },
    act(s, action, value) {
      const d = s.data;
      if (action === 'mode') {
        if (!['challenge', 'partner', 'free'].includes(value)) return;
        cleanup(); s.data = this.init(); s.data.creative = value === 'challenge' ? null : value; s.history = []; s.completed = false; s.feedback = null; s.help = 0; return;
      }
      if (action === 'select' && C.kinds.includes(value)) { d.selected = value; return; }
      if (action === 'length' && d.creative === 'partner' && d.phase === 'build' && [2, 3].includes(Number(value))) { remember(s); d.block = Array.from({ length: Number(value) }, (_, i) => d.block[i] || null); return; }
      if (action === 'block' && d.creative === 'partner' && d.phase === 'build') {
        if (!d.selected) return feedback(s, 'Elegí primero una figura de la bandeja.');
        const i = Number(value); if (!Number.isInteger(i) || i < 0 || i >= d.block.length) return;
        remember(s); d.block[i] = d.selected; return;
      }
      if (action === 'handoff' && d.creative === 'partner' && d.phase === 'build' && d.block.every(k => C.kinds.includes(k))) {
        remember(s); d.phase = 'continue'; d.filled = {}; d.selected = null; app.prefs.turn++; save(); feedback(s, 'Ahora juega tu compañero. Repitan el bloque para continuar.'); return;
      }
      const block = d.creative === 'partner' ? d.block : s.ch.block, length = d.creative === 'free' ? 12 : d.creative ? block.length * 4 : s.ch.length;
      const holes = d.creative === 'free' ? Array.from({ length }, (_, i) => i) : d.creative ? Array.from({ length: block.length * 2 }, (_, i) => i + block.length * 2) : s.ch.holes;
      if (action === 'slot') {
        const i = Number(value); if (!holes.includes(i)) return;
        if (!d.selected) return feedback(s, 'Primero elegí una figura. Después tocá un hueco.');
        remember(s); d.filled[i] = d.selected; d.checked = false; s.feedback = null;
      }
      if (action === 'check') {
        if (d.creative === 'free') {
          if (!Object.keys(d.filled).length) return feedback(s, 'Colocá al menos una figura para crear.');
          s.completed = true; feedback(s, '¡Tu creación está lista! Contale a alguien cómo la pensaste. En una serie libre no comprobamos una regla.', 'success'); return;
        }
        if (holes.some(i => !d.filled[i])) return feedback(s, 'Todavía quedan huecos por completar.');
        d.checked = true;
        if (holes.every(i => d.filled[i] === block[i % block.length])) complete(s, d.creative ? '¡Continuaron el patrón inventado! Cada bloque respeta su regla.' : '¡La máquina sigue! El mismo bloque se repite en toda la serie.');
        else fail(s, 'Mirá el lugar con borde punteado. Comparalo con el mismo lugar del bloque que se repite.');
      }
    },
    hint: () => 'Señalá una figura del bloque y luego la que ocupa el mismo lugar en cada repetición.'
  };

  /* H. Reparar segmentos y vértices con posiciones discretas. */
  function repairPoints(s) {
    const p = s.ch.target.map(a => a.slice()); if (s.ch.mode === 'corner') p[s.ch.movable] = s.data.corner; return p;
  }
  function segmentSVG(segment, rotation) {
    const p = G.segmentPoints(segment, rotation, [0, 0]);
    return `<svg viewBox="-.5 -.5 5 5" aria-hidden="true"><line x1="${p[0][0]}" y1="${p[0][1]}" x2="${p[1][0]}" y2="${p[1][1]}" stroke="#3755b1" stroke-width=".2" stroke-linecap="round"/>${p.map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".14" fill="#e28c22"/>`).join('')}</svg>`;
  }
  engines.repair = {
    init: ch => ({ selected: null, rotation: 0, placed: null, corner: ch.initial?.slice() || null, cornerSelected: false }),
    instruction: s => s.ch.mode === 'corner' ? 'Tocá la punta móvil. Elegí su nuevo lugar.' : 'Elegí una barra. Colocala en el hueco.',
    render(s) {
      const { ch, data: d } = s, p = repairPoints(s);
      const lines = p.map((a, i) => { if (ch.mode === 'segment' && i === ch.missing) return ''; const b = p[(i + 1) % p.length]; return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`; }).join('');
      const a = ch.target[ch.missing ?? 0], b = ch.target[((ch.missing ?? 0) + 1) % ch.target.length], origin = [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
      let placed = '';
      if (d.placed) { const seg = ch.segments.find(k => k.id === d.placed.id), pts = G.segmentPoints(seg, d.placed.r, origin); placed = `<line x1="${pts[0][0]}" y1="${pts[0][1]}" x2="${pts[1][0]}" y2="${pts[1][1]}" stroke="#d87522" stroke-width=".14" stroke-linecap="round"/>`; }
      const ghost = s.help >= 2 && !s.completed ? ch.mode === 'corner' ? `<polygon points="${ch.target.map(p => p.join(',')).join(' ')}" class="repair-ghost"/>` : `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="repair-ghost"/>` : '';
      return `<div class="split-board repair-layout"><section><div class="board-caption">${ch.title}</div><div class="repair-board"><svg viewBox="-.65 -.65 5.3 5.3" aria-hidden="true"><g fill="#bac8df">${Array.from({ length: 25 }, (_, i) => `<circle cx="${i % 5}" cy="${Math.floor(i / 5)}" r=".035"/>`).join('')}</g>${ghost}<g stroke="#3755b1" stroke-width=".12" stroke-linecap="round" stroke-linejoin="round">${lines}</g>${placed}${p.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r=".12" fill="${ch.mode === 'corner' && i === ch.movable ? '#d87522' : '#25366b'}"/>`).join('')}</svg>${ch.mode === 'corner' ? `<div class="corner-grid">${Array.from({ length: 25 }, (_, i) => {
        const x = i % 5, y = Math.floor(i / 5), moving = d.corner[0] === x && d.corner[1] === y, dest = ch.target[ch.movable][0] === x && ch.target[ch.movable][1] === y;
        return button('g:corner', moving ? '<span aria-hidden="true">✥</span>' : '<span aria-hidden="true">·</span>', i, `corner-point ${moving ? 'movable' : ''} ${moving && d.cornerSelected ? 'selected' : ''} ${dest && s.help >= 2 ? 'hint-outline' : ''}`, `aria-label="${moving ? 'Punta móvil. ' : ''}Posición ${y + 1}, ${x + 1}" ${s.completed ? 'disabled' : ''}`);
      }).join('')}</div>` : button('g:place', '<span aria-hidden="true">+</span><span class="sr-only">Colocar en el hueco</span>', '', 'gap-target', `style="left:${((a[0] + b[0]) / 2 + .65) / 5.3 * 100}%;top:${((a[1] + b[1]) / 2 + .65) / 5.3 * 100}%" ${s.completed ? 'disabled' : ''}`)}</div></section><section class="piece-shelf">${ch.mode === 'corner' ? `<h3>Una punta se movió</h3><p>Los lados del cuadrado miden lo mismo.</p><div class="right-angle-demo" aria-hidden="true">∟</div><p>Las cuatro esquinas también deben ser rectas.</p>` : `<h3>Probá una barra</h3><div class="segment-shelf">${ch.segments.map(seg => button('g:select', `${segmentSVG(seg, d.selected === seg.id ? d.rotation : 0)}<span>Barra ${seg.id.toUpperCase()}</span>`, seg.id, `segment-piece ${d.selected === seg.id ? 'selected' : ''}`, `aria-pressed="${d.selected === seg.id}" ${s.completed ? 'disabled' : ''}`)).join('')}</div>${button('g:rotate', '↻ Girar barra', '', 'outline wide', !d.selected || s.completed ? 'disabled' : '')}<p class="micro">Elegí, girá y tocá el hueco. Podés cambiar de barra.</p>`}${button('g:check', 'Comprobar reparación', '', 'primary wide', s.completed ? 'disabled' : '')}</section></div>`;
    },
    act(s, action, value) {
      const d = s.data, ch = s.ch;
      if (action === 'select' && ch.mode === 'segment' && ch.segments.some(p => p.id === value)) { d.selected = value; d.rotation = 0; return; }
      if (action === 'rotate' && d.selected) { d.rotation = (d.rotation + 1) % 4; return; }
      if (action === 'place' && ch.mode === 'segment') { if (!d.selected) return feedback(s, 'Primero elegí una barra.'); remember(s); d.placed = { id: d.selected, r: d.rotation }; s.feedback = null; return; }
      if (action === 'corner' && ch.mode === 'corner') {
        const i = Number(value); if (!Number.isInteger(i) || i < 0 || i >= 25) return;
        const point = [i % 5, Math.floor(i / 5)];
        if (point[0] === d.corner[0] && point[1] === d.corner[1]) { d.cornerSelected = true; return; }
        if (!d.cornerSelected) return feedback(s, 'Tocá primero la punta que tiene una cruz.');
        remember(s); d.corner = point; d.cornerSelected = false; s.feedback = null; return;
      }
      if (action !== 'check') return;
      if (ch.mode === 'corner') {
        if (G.isSquare(repairPoints(s))) complete(s, '¡Cuadrado reparado! Cuatro lados iguales y cuatro esquinas rectas. Girado también es cuadrado.');
        else fail(s, 'Todavía no es un cuadrado. Compará los cuatro lados y sus esquinas: deben ser rectas.');
      } else {
        if (!d.placed) return feedback(s, 'Colocá una barra en el hueco antes de comprobar.');
        if (G.segmentFits(ch, d.placed.id, d.placed.r)) complete(s, '¡Figura cerrada! Los extremos de la barra se unieron con las dos puntas.');
        else fail(s, 'Esta barra no une las dos puntas. Compará su largo y su dirección; podés girarla o cambiarla.');
      }
    },
    hint: () => 'El trazo punteado muestra el contorno que buscamos. Comparalo con tu reparación.'
  };

  /* Demostraciones visuales, paso a paso, independientes de la partida real. */
  const demoTexts = {
    mosaic: ['Elegí un triángulo de la bandeja.', 'Tocá una casilla. La pieza encaja.', 'Girá el otro triángulo. Juntos forman un cuadrado.'],
    mail: ['Elegí una figura. Mirá su borde.', 'Tocá el buzón que cumple su regla.', 'Podés moverla otra vez. Después, comprobá el reparto.'],
    detective: ['Escuchá: “Tengo lados rectos”. Hay varias posibles.', 'Pedí otra pista: “Tengo cuatro lados iguales”.', 'El cuadrado cumple las dos. Mirá sus lados y puntas.'],
    intruder: ['La regla es: “Todas tienen cuatro lados”.', 'Este triángulo tiene tres. No cumple la regla.', 'Después explicá: “Tiene tres lados”.'],
    memory: ['Destapá una carta. Recordá su forma y su lugar.', 'Destapá otra. ¿Son del mismo tipo?', '¡Son cuadrados! El giro y el color pueden cambiar.'],
    path: ['Partimos de la salida. En este ejemplo, solo por triángulos.', 'Tocá un triángulo de una casilla vecina.', 'Seguí hasta la meta. Podés deshacer pasos.'],
    pattern: ['Mirá el bloque: círculo, cuadrado. Vuelve a empezar.', 'Elegí la forma que sigue y tocá el hueco.', 'Círculo, cuadrado, círculo, cuadrado. ¡Se repite!'],
    repair: ['Al cuadrado le falta un lado. Mirá las dos puntas.', 'Elegí una barra del mismo largo que el hueco.', 'Colocala. Las puntas se unen y el cuadrado cierra.'],
    repairCorner: ['Una punta se movió. Así todavía no es un cuadrado.', 'Tocá la punta móvil. Después tocá otro lugar de la grilla.', 'Los cuatro lados vuelven a ser iguales y las esquinas, rectas.']
  };
  function demoArt(id, step) {
    const sample = (kind, i = 0, marked = false) => shape({ kind, color: i, angle: i ? 45 : 0 }, marked);
    if (id === 'repairCorner') return `<div class="demo-repair"><svg viewBox="15 15 170 150" aria-hidden="true"><g fill="#a7b9d8">${Array.from({ length: 25 }, (_, i) => `<circle cx="${40 + i % 5 * 30}" cy="${40 + Math.floor(i / 5) * 22.5}" r="2"/>`).join('')}</g><polygon points="40,40 130,40 ${step === 2 ? '130,130' : '160,85'} 40,130" fill="#e0eaff" stroke="#3755b1" stroke-width="5"/>${step === 1 ? '<circle cx="130" cy="130" r="12" fill="none" stroke="#99620d" stroke-dasharray="4 3" stroke-width="3"/>' : ''}<circle cx="${step === 2 ? 130 : 160}" cy="${step === 2 ? 130 : 85}" r="10" fill="#f4b85e" stroke="#824600" stroke-width="3"/></svg></div>`;
    if (id === 'mosaic') return `<div class="demo-mosaic"><svg viewBox="-.1 -.1 2.2 2.2" aria-hidden="true"><rect width="2" height="2" fill="#edf2fb" stroke="#25366b" stroke-width=".04"/>${step >= 1 ? '<polygon points="0,0 2,0 0,2" fill="#4670cf"/>' : ''}${step >= 2 ? '<polygon points="2,0 2,2 0,2" fill="#e28c22"/>' : ''}</svg><span>${step === 0 ? pieceSVG('bigTriangle') : step === 1 ? pieceSVG('bigTriangle', 2, 1) : '✓'}</span></div>`;
    if (id === 'mail') return `<div class="demo-mail"><div>${step === 0 ? sample('circle') : step === 1 ? sample('triangle', 1, true) : '<strong>✓</strong>'}</div><div class="mini-bin"><strong>Sin puntas</strong>${step > 0 ? sample('circle', 0, true) : '<span>↓</span>'}</div><div class="mini-bin"><strong>Con puntas</strong>${step > 1 ? sample('triangle', 1, true) : '<span>↓</span>'}</div></div>`;
    if (id === 'detective') return `<div class="demo-detective"><p>${step === 0 ? 'Tengo lados rectos.' : 'Cuatro lados iguales.'}</p><div class="demo-shape-row">${['circle', 'square', 'triangle'].map((k, i) => `<span class="${step > 0 && k === 'square' ? 'selected' : ''}">${sample(k, i, step === 2 && k === 'square')}</span>`).join('')}</div></div>`;
    if (id === 'intruder') return `<div><p class="demo-rule">Todas tienen cuatro lados.</p><div class="demo-shape-row">${['rectangle', 'triangle', 'square'].map((k, i) => `<span class="${step > 0 && i === 1 ? 'selected' : ''}">${sample(k, i, step > 0 && i === 1)}</span>`).join('')}</div>${step === 2 ? '<strong>3 lados → no cumple la regla</strong>' : ''}</div>`;
    if (id === 'memory') return `<div class="demo-shape-row"><span class="mini-card">${sample('square')}</span><span class="mini-card">${step > 0 ? sample('square', 3) : '?'}</span>${step === 2 ? '<strong>✓</strong>' : ''}</div>`;
    if (id === 'path') return `<div class="demo-path">${['triangle', 'triangle', 'circle', 'square', 'triangle', 'triangle'].map((k, i) => `<span class="${(step === 0 ? [0] : step === 1 ? [0, 1] : [0, 1, 4, 5]).includes(i) ? 'selected' : ''}">${sample(k)}<small>${i === 0 ? 'SALIDA' : i === 5 ? 'META' : ''}</small></span>`).join('')}</div>`;
    if (id === 'pattern') return `<div class="demo-series">${['circle', 'square', 'circle', 'square', 'circle', 'square'].map((k, i) => `<span>${i < 4 || (step === 1 && i === 4) || step === 2 ? sample(k) : '+'}</span>`).join('')}</div>`;
    return `<div class="demo-repair"><svg viewBox="0 0 200 170" aria-hidden="true"><path d="M45 50 V140 H135 V50" fill="none" stroke="#4670cf" stroke-width="9" stroke-linecap="round"/>${step > 0 ? `<path d="M45 ${step === 1 ? 22 : 50} H135" stroke="#d87522" stroke-width="9" stroke-linecap="round"/>` : ''}<circle cx="45" cy="50" r="6" fill="#25366b"/><circle cx="135" cy="50" r="6" fill="#25366b"/></svg></div>`;
  }
  let modalReturnFocus = null;
  function modal(title, body, kind = 'generic') {
    cleanup(); const el = $('#dialog');
    if (!el.open) modalReturnFocus = document.activeElement;
    app.modal = kind;
    el.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2>${button('close', '×', '', 'close-button', 'aria-label="Cerrar"')}</div>${body}`;
    if (!el.open) el.showModal();
    el.querySelector('button, input, select')?.focus({ preventScroll: true });
  }
  function closeModal() {
    const el = $('#dialog'); if (el.open) el.close(); app.modal = null; stopAudio();
  }
  $('#dialog').addEventListener('close', () => {
    stopAudio(); app.modal = null;
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus({ preventScroll: true });
    resumeMemory();
  });
  function openDemo() { app.demo = { id: current().ch.game === 'repair' && current().ch.mode === 'corner' ? 'repairCorner' : current().ch.game, step: 0 }; renderDemo(); }
  function renderDemo() {
    const { id, step } = app.demo;
    modal('Mirá cómo se juega', `<div class="demo-content"><div class="demo-progress" aria-label="Paso ${step + 1} de 3">${[0, 1, 2].map(n => `<span class="${n === step ? 'active' : ''}">${n + 1}</span>`).join('')}</div><div class="demo-stage">${demoArt(id, step)}</div><p class="demo-caption">${demoTexts[id][step]}</p><div class="demo-actions">${button('demo-listen', '▷ Escuchar', '', 'outline')}${button('demo-step', step === 2 ? 'Ver desde el inicio' : 'Ver siguiente paso →', '', 'outline')}${button('close', '¡A jugar!', '', 'primary')}</div>${step === 2 && !current().practice ? button('demo-practice', 'Practicar un ejemplo parecido', '', 'text-button') : ''}</div>`, 'demo');
  }
  function album() {
    modal('Mi álbum de descubrimientos', `<p class="dialog-intro">Cada lugar tiene seis piezas por descubrir. Podés volver a jugar todas las veces que quieras.</p><div class="album-grid">${C.games.map((g, i) => `<section class="album-stamp ${count(g.id) ? 'earned' : ''}"><div class="album-stamp-icon">${count(g.id) ? shape({ kind: C.kinds[i % 4], color: i % 6, angle: i % 2 ? 45 : 0 }) : '<span aria-hidden="true">?</span>'}</div><h3>${g.name}</h3><p>${count(g.id) ? g.discovery : 'Este lugar está listo para explorar.'}</p><div class="discovery-pieces" aria-label="${count(g.id)} de 6 piezas">${[1, 2, 3].flatMap(l => [0, 1].map(v => `<span class="${app.prefs.completed.includes(`${g.id}:${l}:${v}`) ? 'earned' : ''}" title="Nivel ${l}, reto ${v + 1}">${app.prefs.completed.includes(`${g.id}:${l}:${v}`) ? '✓' : '·'}</span>`)).join('')}</div>${button('open', 'Explorar', g.id, 'text-button')}</section>`).join('')}</div><p class="micro">El álbum se guarda solo en este navegador.${!storageOK ? ' El almacenamiento está bloqueado: el avance se conserva mientras esta página siga abierta.' : ''}</p>`, 'album');
  }
  function soundSettings() {
    modal('Sonido a tu manera', `<div class="settings-list"><label><span><strong>Voz de las consignas</strong><small>Se activa con “Escuchar”.</small></span><input type="checkbox" data-setting="voice" ${app.prefs.voice ? 'checked' : ''}></label><label><span><strong>Efectos suaves</strong><small>Un sonido breve al completar un reto.</small></span><input type="checkbox" data-setting="effects" ${app.prefs.effects ? 'checked' : ''}></label></div><p>${'speechSynthesis' in window ? 'La voz depende de las voces disponibles en este dispositivo. Las consignas y los ejemplos visuales están siempre disponibles.' : 'Este navegador no tiene síntesis de voz. Podés jugar con las consignas y los ejemplos visuales.'}</p><div class="dialog-actions">${button('sound-test', 'Probar voz', '', 'outline')}${button('mute-all', 'Silenciar todo', '', 'quiet')}${button('close', 'Listo', '', 'primary')}</div>`, 'sound');
  }
  function teacher() {
    const selected = app.prefs.selected;
    modal('Una clase para explorar', `<p class="dialog-intro">38 minutos · Elegí cuatro actividades. Los ocho lugares quedan siempre disponibles.</p><div class="teacher-grid"><section><h3>1. Elegí los cuatro desafíos</h3><div class="activity-checks">${C.games.map((g, i) => `<label><input type="checkbox" data-class-game="${g.id}" ${selected.includes(g.id) ? 'checked' : ''}><span><strong>${i + 1}. ${g.name}</strong><small>${g.skill}</small></span></label>`).join('')}</div><p id="selection-message" role="status">${selected.length} de 4 elegidos.</p><h3>2. ¿Cómo participamos?</h3><select aria-label="Forma de participación" data-setting="mode"><option value="solo" ${app.prefs.mode === 'solo' ? 'selected' : ''}>Individual</option><option value="pair" ${app.prefs.mode === 'pair' ? 'selected' : ''}>Parejas</option><option value="trio" ${app.prefs.mode === 'trio' ? 'selected' : ''}>Tríos</option><option value="group" ${app.prefs.mode === 'group' ? 'selected' : ''}>Pantalla interactiva · todo el grupo</option></select><p>En parejas, una persona manipula y la otra explica. En tríos, la tercera comprueba. Al pasar a otro reto rotan los roles; también pueden cambiarlos con el botón visible.</p><p>En pantalla, todos acuerdan una respuesta antes de que una pareja pase a probarla. Renová la pareja en cada reto.</p></section>
      <section><h3>3. El recorrido de 38 minutos</h3><ol class="lesson-plan"><li><strong>5 min</strong><div><b>Exploración grupal</b><p>Mostrá un cuadrado, giralo y preguntá: “¿Cambió la figura? ¿Cómo lo sabés?”. Miren una demostración.</p></div></li><li><strong>24 min</strong><div><b>Cuatro desafíos · 6 min cada uno</b><p>Dejá tiempo para probar, conversar y cambiar de idea. No hace falta terminar todos los retos de un juego.</p></div></li><li><strong>6 min</strong><div><b>Buscamos formas en el aula</b><p>Busquen la forma de una cara, una superficie o un borde: la cara de una caja, la superficie de una hoja, el borde de una tapa.</p></div></li><li><strong>3 min</strong><div><b>Conversación final</b><p>¿Qué descubriste? ¿Qué hiciste cuando no encajó? ¿Cómo reconocés un cuadrado aunque esté girado?</p></div></li></ol>
      <div class="clock-panel"><h3>Reloj opcional del docente</h3><p>No mide respuestas ni afecta premios. Puede pausarse.</p><strong class="clock-time" data-clock-time>${formatTime(app.clock.left)}</strong><p data-clock-stage>${clockStage()}</p><div class="clock-controls">${button('clock-toggle', app.clock.running ? 'Pausar reloj' : 'Iniciar / continuar', '', 'outline')}${button('clock-reset', 'Volver a 38 min', '', 'quiet')}</div></div></section></div>
      <details class="teacher-details"><summary>Decisiones de geometría y acompañamiento</summary><p><strong>El cuadrado girado sigue siendo cuadrado.</strong> El tamaño, el color y la orientación no determinan su tipo. Tiene cuatro lados iguales y cuatro ángulos rectos; un rombo oblicuo no alcanza.</p><p><strong>El cuadrado es un tipo de rectángulo.</strong> En las actividades que separan los nombres habituales, los otros rectángulos son no cuadrados: dos lados largos y dos cortos. Las reglas dicen qué propiedad se compara; “cuatro esquinas rectas” acepta ambos tipos.</p><p>“Puntas” presenta de forma cercana los vértices. Las figuras son planas: hablamos de una cara, superficie o borde de los objetos, sin confundirlos con cuerpos geométricos.</p><p>Las pistas se acumulan. Si una elección cumple las pistas disponibles y todavía hay varias soluciones, se agrega otra sin marcar error. Los caminos admiten rutas alternativas. Los mosaicos comprueban cobertura y superposiciones.</p><p>Los colores de las series son iguales: la regla depende de la forma. “Crear para otro” repite un bloque elegido por un compañero y permite comprobarlo. “Serie libre” permite inventar sin una respuesta única; no suma piezas al álbum.</p><p>Después de los intentos, señalá una propiedad, usá la ayuda visual, repetí el ejemplo y ofrecé una práctica parecida. Pedir ayuda nunca quita descubrimientos. Invitá a justificar señalando y contando, sin exigir leer.</p></details>
      <details class="teacher-details"><summary>Uso, accesibilidad y datos del dispositivo</summary><p>Mouse, pantalla táctil o teclado: usá Tab para moverte y Enter o espacio para seleccionar. No se exige arrastrar: elegí una pieza y después su destino. En correo y series también se puede arrastrar.</p><p>Memoria inicia en modo tranquilo; el niño decide cuándo tapar un par distinto. Sin ese modo se muestran al menos 3 segundos. No hay límites por pregunta.</p><p>Cada dispositivo tiene su propia partida. No hay sincronización entre tablets. No se piden nombres, no se envían resultados y no hay cuentas de alumnos. La voz es opcional y depende del navegador.</p><p>El álbum y las preferencias se conservan cuando el navegador permite guardarlos. Los tableros en curso se mantienen al cambiar de juego durante esta visita. “Reiniciar reto” limpia el tablero actual; no borra el álbum. Al recargar, los tableros empiezan de nuevo.</p><p>Salir de un juego detiene su voz y sus esperas. El reloj de clase es independiente y sigue funcionando hasta que el docente lo pause o se cierre la página.</p>${button('erase-confirm', 'Borrar progreso local y reiniciar', '', 'danger-outline')}</details>
      <div class="dialog-actions">${button('class-start', 'Volver al mapa', '', 'primary')}${button('close', 'Cerrar guía', '', 'outline')}</div>`, 'teacher');
  }
  function formatTime(seconds) { const s = Math.max(0, Math.ceil(seconds)); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
  function clockStage() {
    const elapsed = 38 * 60 - app.clock.left;
    return app.clock.left <= 0 ? 'Tiempo de cerrar y compartir.' : elapsed < 300 ? 'Exploración grupal' : elapsed < 1740 ? `Desafío ${Math.min(4, Math.floor((elapsed - 300) / 360) + 1)} de la clase` : elapsed < 2100 ? 'Búsqueda de formas en el aula' : 'Conversación final';
  }
  function clockBadge() { return app.clock.running || app.clock.left !== 38 * 60 ? `<button class="clock-badge" data-action="teacher" aria-label="Abrir reloj del docente"><span aria-hidden="true">◷</span> <span data-clock-time>${formatTime(app.clock.left)}</span><span>${app.clock.running ? 'Clase' : 'En pausa'}</span></button>` : ''; }
  function updateClockUI() { document.querySelectorAll('[data-clock-time]').forEach(e => e.textContent = formatTime(app.clock.left)); document.querySelectorAll('[data-clock-stage]').forEach(e => e.textContent = clockStage()); }
  function tick() {
    if (!app.clock.running) return;
    app.clock.left = Math.max(0, (app.clock.end - Date.now()) / 1000); updateClockUI();
    if (app.clock.left <= 0) {
      clearInterval(app.clock.handle); app.clock.handle = null; app.clock.running = false;
      modal('¡Qué bueno lo que exploramos!', `<div class="closing"><div class="demo-shape-row">${shape('square')}${shape('circle')}${shape('triangle')}</div><p>Es momento de compartir un descubrimiento.</p><p><strong>¿Cómo reconocés un cuadrado aunque esté girado?</strong></p><p>Podés mostrarlo con tus manos o con una figura.</p>${button('close', 'Seguir sin reloj', '', 'primary')}${button('album', 'Ver descubrimientos', '', 'outline')}</div>`, 'closing'); render();
    }
  }
  function toggleClock() {
    if (app.clock.running) { app.clock.left = Math.max(0, (app.clock.end - Date.now()) / 1000); clearInterval(app.clock.handle); app.clock.handle = null; app.clock.running = false; }
    else { if (app.clock.left <= 0) app.clock.left = 38 * 60; app.clock.running = true; app.clock.end = Date.now() + app.clock.left * 1000; app.clock.handle = setInterval(tick, 500); }
    render(); teacher();
  }
  function readInstruction() {
    const s = current(), meta = C.games.find(g => g.id === s.ch.game), engine = engines[s.ch.game];
    let text = (engine.instruction ? engine.instruction(s) : s.ch.title || meta.prompt) + ' ';
    if (s.ch.game === 'mail') text += s.ch.bins.map(b => b.label).join('. ');
    if (s.ch.game === 'detective') text += s.ch.clues.slice(0, s.data.clue).map(c => c.text).join(' ');
    if (s.ch.game === 'intruder') text += s.ch.label + (s.data.chosen ? ' Elegí la explicación: ' + s.ch.reasons.map(r => r.text).join(' ') : '');
    if (s.ch.game === 'path') text += 'La regla es repetir: ' + s.ch.pattern.map(k => G.shapes[k].name).join(', ') + '. Ahora sigue: ' + G.shapes[s.ch.pattern[s.data.path.length % s.ch.pattern.length]].name;
    if (s.ch.game === 'pattern' && s.data.creative !== 'free') text += 'El bloque es: ' + (s.data.creative === 'partner' ? s.data.block : s.ch.block).filter(Boolean).map(k => G.shapes[k].name).join(', ');
    if (s.feedback) text += ' ' + s.feedback.text;
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { feedback(s, 'Este navegador no tiene voz. La consigna y el ejemplo visual están disponibles.'); render(); }
    else if (!app.prefs.voice) { feedback(s, 'La voz está silenciada. Podés activarla en Sonido.'); render(); }
    else speak(text);
  }
  function handle(action, value) {
    if (action.startsWith('g:')) {
      if (action === 'g:takeApart' && current()?.ch.game === 'mosaic') { engines.mosaic.act(current(), 'takeApart', value); render(); return; }
      /* Cambiar el modo de series también es válido después de terminar. */
      if (action === 'g:mode' && current()?.ch.game === 'pattern') { engines.pattern.act(current(), 'mode', value); render(); return; }
      doGame(action.slice(2), value); return;
    }
    if (action === 'open') return openGame(value);
    if (action === 'map' || action === 'class-start') return goMap();
    if (action === 'level') return openGame(current().ch.game, Number(value));
    if (action === 'close') return closeModal();
    if (action === 'teacher') return teacher();
    if (action === 'sound') return soundSettings();
    if (action === 'album') return album();
    if (action === 'sound-test') {
      if (!app.prefs.voice || !('speechSynthesis' in window)) { announce('Activá la voz si tu navegador tiene síntesis disponible.'); return; }
      return speak('Hola, exploradores. Elegí una figura y probemos juntos.');
    }
    if (action === 'mute-all') { app.prefs.voice = false; app.prefs.effects = false; save(); stopAudio(); render(); return soundSettings(); }
    if (action === 'rotate-role') { app.prefs.turn++; save(); render(); return; }
    if (action === 'clock-toggle') return toggleClock();
    if (action === 'clock-reset') { clearInterval(app.clock.handle); app.clock = { left: 2280, running: false, end: null, handle: null }; render(); return teacher(); }
    if (action === 'erase-confirm') return modal('¿Borrar el progreso de este dispositivo?', `<p>Se borran el álbum, las preferencias y los tableros. Podrán empezar otra aventura.</p><div class="dialog-actions">${button('erase', 'Sí, borrar y empezar', '', 'danger')}${button('teacher', 'Conservar mi progreso', '', 'outline')}</div>`, 'erase');
    if (action === 'erase') {
      cleanup(); clearInterval(app.clock.handle); app.clock = { left: 2280, running: false, end: null, handle: null };
      try { localStorage.removeItem(KEY); } catch (_) { storageOK = false; }
      app.prefs = defaults(); app.sessions = {}; app.lastLevel = {}; app.game = null; app.practiceReturn = null; goMap(); return;
    }
    if (app.view !== 'game') return;
    const s = current();
    if (action === 'listen') return readInstruction();
    if (action === 'help') return help();
    if (action === 'demo') return openDemo();
    if (action === 'demo-step') { app.demo.step = (app.demo.step + 1) % 3; return renderDemo(); }
    if (action === 'demo-listen') return speak(demoTexts[app.demo.id][app.demo.step]);
    if (action === 'demo-practice') { closeModal(); return practice(); }
    if (action === 'practice') return practice();
    if (action === 'end-practice') return endPractice();
    if (action === 'next' || action === 'skip') {
      if (Date.now() < navigationAfter) return;
      navigationAfter = Date.now() + 400; return nextChallenge();
    }
    if (action === 'reset') {
      cleanup(); const fresh = makeSession(s.ch.game, s.ch.level, s.ch.variant, s.ch.seed, s.practice);
      if (!s.practice) app.sessions[`${s.ch.game}:${s.ch.level}`] = fresh;
      app.game = fresh; render(true); return;
    }
    if (action === 'undo' && s.history.length && !s.completed) {
      cleanup(); s.data = s.history.pop(); s.feedback = null;
      if (s.ch.game === 'mosaic' && G.mosaicStatus(s.ch, s.data.placements).complete) complete(s, 'La figura vuelve a estar completa. Todas las piezas encajan.');
      render();
    }
  }
  document.addEventListener('click', e => {
    const target = e.target.closest('[data-action]');
    if (!target || target.disabled || Date.now() < suppressClickUntil) return;
    handle(target.dataset.action, target.dataset.value || '');
  });
  document.addEventListener('change', e => {
    const setting = e.target.dataset.setting, game = e.target.dataset.classGame;
    if (setting && ['voice', 'effects', 'calm', 'mode'].includes(setting)) {
      app.prefs[setting] = setting === 'mode' ? e.target.value : e.target.checked;
      save(); if (setting === 'voice' || setting === 'effects') stopAudio();
      if (setting === 'calm') { cleanup(); resumeMemory(); }
      render();
    }
    if (game) {
      if (e.target.checked && app.prefs.selected.length >= 4) { e.target.checked = false; $('#selection-message').textContent = 'Ya elegiste cuatro. Desmarcá uno para cambiarlo.'; return; }
      app.prefs.selected = app.prefs.selected.filter(id => id !== game);
      if (e.target.checked) app.prefs.selected.push(game);
      save(); $('#selection-message').textContent = `${app.prefs.selected.length} de 4 elegidos.`; render();
    }
  });

  /* Arrastre por Pointer Events. La misma acción se ejecuta con dos toques. */
  document.addEventListener('pointerdown', e => {
    const source = e.target.closest('[data-drag]');
    if (!source || source.disabled || e.button !== 0 || drag || $('#dialog').open) return;
    drag = { id: e.pointerId, value: source.dataset.drag, source, x: e.clientX, y: e.clientY, moving: false, ghost: null };
  });
  document.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.moving && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 10) {
      drag.moving = true; drag.ghost = drag.source.cloneNode(true); drag.ghost.className = 'drag-ghost'; drag.ghost.removeAttribute('id'); drag.ghost.setAttribute('aria-hidden', 'true'); document.body.appendChild(drag.ghost);
    }
    if (drag.moving) { e.preventDefault(); drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; }
  }, { passive: false });
  document.addEventListener('pointerup', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const pending = drag; drag = null; pending.ghost?.remove();
    if (!pending.moving) return;
    suppressClickUntil = Date.now() + 350;
    const dest = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]');
    if (!dest || dest.disabled || current().completed) return;
    engines[current().ch.game].act(current(), 'select', pending.value);
    doGame(dest.dataset.drop.slice(2), dest.dataset.dropValue || '');
  });
  document.addEventListener('pointercancel', () => { drag?.ghost?.remove(); drag = null; });
  window.addEventListener('blur', () => { drag?.ghost?.remove(); drag = null; stopAudio(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cleanup(); else { tick(); resumeMemory(); }
  });
  window.addEventListener('pagehide', () => { cleanup(); clearInterval(app.clock.handle); });

  /* API de lectura y navegación: comparte las mismas acciones que la interfaz. */
  function snapshot() {
    return clone({ view: app.view, game: app.view === 'game' ? { challenge: current().ch, state: current().data, completed: current().completed, attempts: current().attempts, help: current().help, practice: current().practice, historyLength: current().history.length } : null, completed: app.prefs.completed, selected: app.prefs.selected, mode: app.prefs.mode, timers: timers.size, clock: { running: app.clock.running, left: app.clock.left }, storageOK });
  }
  window.Exploradores = Object.freeze({ snapshot, openGame });
  const registry = document.modelContext;
  if (registry?.registerTool) {
    const lifecycle = new AbortController();
    const registrations = [
      { name: 'read_exploration_state', title: 'Leer la exploración', description: 'Lee el juego activo y los descubrimientos locales sin cambiar la partida.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => snapshot() },
      { name: 'open_geometry_game', title: 'Abrir un juego de formas', description: 'Navega a un juego y nivel; no completa retos ni concede descubrimientos.', inputSchema: { type: 'object', properties: { game: { type: 'string', enum: C.games.map(g => g.id) }, level: { type: 'integer', enum: [1, 2, 3] } }, required: ['game', 'level'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { if (!input || !C.games.some(g => g.id === input.game) || ![1, 2, 3].includes(input.level)) throw new Error('Elegí un juego y nivel existentes.'); openGame(input.game, input.level); return { game: current().ch.game, level: current().ch.level }; } }
    ];
    for (const tool of registrations) { try { Promise.resolve(registry.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) {} }
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
  const audit = C.audit();
  if (audit.some(c => !c.valid)) {
    $('#app').innerHTML = '<main><h1>No pudimos preparar los retos.</h1><p>Volvé a abrir la página para intentarlo otra vez.</p></main>';
    console.error('Retos inválidos', audit.filter(c => !c.valid));
  } else render();
})();
