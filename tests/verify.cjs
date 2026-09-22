/* Pruebas opcionales: node tests/verify.cjs. No requiere paquetes.
   Simula el DOM mínimo para probar reglas y transiciones; no es una prueba
   visual, de layout, de lector de pantalla ni de hardware táctil. */
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function equal(a, b, message) { assert.equal(JSON.stringify(a), JSON.stringify(b), message); checks++; }
function createHarness({ blockedStorage = false, voice = false, webmcp = false } = {}) {
  const elements = new Map(), events = {}, scheduled = new Map(), stored = new Map(), registrations = [];
  let now = 100000, id = 0, speakCalls = 0, cancelCalls = 0;
  function element(key) {
    if (elements.has(key)) return elements.get(key);
    const listeners = {};
    const e = { innerHTML: '', textContent: '', open: false, dataset: {}, isConnected: true,
      setAttribute() {}, removeAttribute() {}, focus() {}, remove() {},
      querySelector: () => ({ focus() {} }),
      addEventListener(n, fn) { listeners[n] = fn; },
      showModal() { e.open = true; }, close() { const was = e.open; e.open = false; if (was) listeners.close?.(); }
    };
    elements.set(key, e); return e;
  }
  const sandbox = {
    console, document: { activeElement: null, hidden: false, querySelector: element, querySelectorAll: () => [], addEventListener: (name, fn) => { events[name] = fn; }, body: { appendChild() {} } },
    localStorage: { getItem(k) { if (blockedStorage) throw new Error('Storage blocked'); return stored.get(k) || null; }, setItem(k, v) { if (blockedStorage) throw new Error('Storage blocked'); stored.set(k, v); }, removeItem(k) { if (blockedStorage) throw new Error('Storage blocked'); stored.delete(k); } },
    setTimeout: (fn, ms) => { scheduled.set(++id, { fn, at: now + ms, interval: false }); return id; },
    clearTimeout: key => scheduled.delete(key),
    setInterval: (fn, ms) => { scheduled.set(++id, { fn, at: now + ms, interval: ms }); return id; },
    clearInterval: key => scheduled.delete(key),
    Date: { now: () => now }, addEventListener: (n, fn) => { events[n] = fn; }, AbortController
  };
  sandbox.window = sandbox;
  if (voice) {
    sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
    sandbox.speechSynthesis = { cancel() { cancelCalls++; }, speak() { speakCalls++; }, getVoices: () => [], addEventListener() {} };
  }
  if (webmcp) sandbox.document.modelContext = { registerTool(tool) { registrations.push(tool); } };
  vm.createContext(sandbox);
  for (const name of ['geometry.js', 'challenges.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), sandbox, { filename: name });
  /* Instrumentar la copia en memoria, sin modificar el archivo entregado. */
  const code = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const instrumented = code.replace(/\}\)\(\);\s*$/, `window.TEST = { app, engines, handle, makeSession, render, complete, cleanup, help, practice, endPractice, scheduleMemory, tick, teacher, album, soundSettings, speak, demoArt, demoTexts, openDemo, closeModal, nextChallenge }; })();`);
  check(code !== instrumented, 'Punto de instrumentación encontrado');
  vm.runInContext(instrumented, sandbox, { filename: 'script.js' });
  const t = sandbox.TEST;
  function advance(ms) {
    now += ms;
    for (const [key, job] of [...scheduled]) if (job.at <= now) { if (job.interval) job.at = now + job.interval; else scheduled.delete(key); job.fn(); }
  }
  function activate(game, level = 1, variant = 0, seed = 42) {
    t.cleanup(); element('#dialog').open = false;
    const session = t.makeSession(game, level, variant, seed);
    t.app.game = session; t.app.view = 'game'; t.app.practiceReturn = null;
    t.app.sessions[`${game}:${level}`] = session; t.render(); return session;
  }
  const act = (action, value = '') => t.handle(action.startsWith('g:') ? action : 'g:' + action, String(value));
  return { ...sandbox, t, activate, act, advance, scheduled, stored, events, elements, registrations, audioCounts: () => ({ speakCalls, cancelCalls }) };
}
const h = createHarness(), { Geometry: G, Challenges: C, t } = h;
check(C.audit().length === 48, '48 retos base');
for (let seed = 0; seed < 100; seed++) for (const result of C.audit(seed)) check(result.valid, `Reto válido: ${result.id}, semilla ${seed}`);
check(G.isSquare([[0, 0], [2, 0], [2, 2], [0, 2]]), 'Cuadrado derecho');
check(G.isSquare([[2, 0], [4, 2], [2, 4], [0, 2]]), 'Cuadrado girado');
check(!G.isSquare([[0, 0], [2, 1], [4, 0], [2, -1]]), 'Rombo de lados iguales sin ángulos rectos rechazado');
check(!G.isSquare([[0, 0], [2, 2], [2, 0], [0, 2]]), 'Polígono cruzado rechazado');
check(!G.isSquare([[0, 0], [0, 0], [0, 0], [0, 0]]), 'Figura degenerada rechazada');
check(G.isRectangle([[0, 0], [3, 0], [3, 1], [0, 1]]), 'Rectángulo');
check(!G.isSquare([[0, 0], [3, 0], [3, 1], [0, 1]]), 'Rectángulo no cuadrado distinguido');
check(G.predicates.rightFour('square') && G.predicates.rightFour('rectangle'), 'Cuadrado incluido entre figuras con cuatro ángulos rectos');

function solve(harness, session) {
  const { act, Geometry: g } = harness, ch = session.ch, d = session.data;
  if (ch.game === 'mosaic') {
    const solution = g.solveMosaic(ch, d.placements); check(solution, 'Existe una construcción completa');
    for (const p of ch.pieces.filter(p => !p.fixed)) {
      act('select', p.id); for (let k = 0; k < 4 && d.rotations[p.id] !== solution[p.id].r; k++) act('rotate');
      act('place', solution[p.id].y * ch.w + solution[p.id].x);
    }
  } else if (ch.game === 'mail') {
    for (const p of ch.items) { act('select', p.id); act('deliver', ch.bins.findIndex(b => g.predicates[b.rule](p.kind))); }
    if (!ch.immediate) act('check');
  } else if (ch.game === 'detective') {
    for (let i = 0; i < ch.clues.length; i++) act('choose', ch.options.find(o => o.kind === ch.target).id);
  } else if (ch.game === 'intruder') {
    act('choose', ch.items.find(i => !g.predicates[ch.rule](i.kind)).id); act('reason', ch.reason);
  } else if (ch.game === 'memory') {
    for (const kind of new Set(ch.cards.map(c => c.kind))) for (const card of ch.cards.filter(c => c.kind === kind)) act('flip', card.id);
  } else if (ch.game === 'path') {
    const route = g.solvePath(ch, d.path); check(route, 'Existe ruta'); for (const cell of route) act('step', cell);
  } else if (ch.game === 'pattern') {
    for (const i of ch.holes) { act('select', ch.block[i % ch.block.length]); act('slot', i); } act('check');
  } else if (ch.game === 'repair') {
    if (ch.mode === 'corner') {
      act('corner', d.corner[1] * 5 + d.corner[0]); const dest = ch.target[ch.movable]; act('corner', dest[1] * 5 + dest[0]);
    } else {
      const seg = ch.segments.find(p => [0, 1, 2, 3].some(r => g.segmentFits(ch, p.id, r)));
      const rotation = [0, 1, 2, 3].find(r => g.segmentFits(ch, seg.id, r));
      act('select', seg.id); for (let i = 0; i < rotation; i++) act('rotate'); act('place');
    }
    act('check');
  }
}
const rendered = [];
for (const game of C.games) for (let level = 1; level <= 3; level++) for (let variant = 0; variant < 2; variant++) {
  const session = h.activate(game.id, level, variant);
  rendered.push({ id: session.ch.id, html: h.elements.get('#app').innerHTML });
  solve(h, session);
  check(session.completed, `Finalización mediante acciones: ${session.ch.id}`);
  const before = t.app.prefs.completed.length;
  t.complete(session, 'repetido'); h.act('check'); h.act('place', 0);
  equal(t.app.prefs.completed.length, before, 'No duplica descubrimientos después del éxito');
  t.handle('reset', ''); check(!t.app.game.completed, 'Reinicio limpia el tablero');
  equal(t.app.prefs.completed.length, before, 'Reinicio conserva el álbum');
  solve(h, t.app.game); equal(t.app.prefs.completed.length, before, 'Repetir reto no duplica la pieza');
}
equal(t.app.prefs.completed.length, 48, 'Álbum completo con 48 piezas únicas');

/* Construcciones alternativas y rechazo exacto de superposiciones/huecos. */
const tri = C.get('mosaic', 2, 0);
for (let r = 0; r < 4; r++) check(G.mosaicStatus(tri, { a: { x: 0, y: 0, r }, b: { x: 0, y: 0, r: (r + 2) % 4 } }).complete, 'Dos triángulos: diagonal u orden alternativo válidos');
check(!G.mosaicStatus(tri, { a: { x: 0, y: 0, r: 0 }, b: { x: 0, y: 0, r: 0 } }).valid, 'Superposición rechazada');
check(!G.mosaicStatus(tri, { a: { x: 1, y: 0, r: 0 } }).valid, 'Salida del modelo rechazada');
check(!G.mosaicStatus(tri, { a: { x: 0, y: 0, r: 0 } }).complete, 'Cobertura incompleta no da premio');
const decomposition = h.activate('mosaic', 2); solve(h, decomposition);
const mosaicAwards = t.app.prefs.completed.length;
h.act('takeApart'); check(!decomposition.completed && decomposition.data.disassemble, 'Activa la descomposición');
const previousA = { ...decomposition.data.placements.a }; h.act('select', 'a');
check(!decomposition.data.placements.a, 'Retira una pieza de la figura construida');
h.act('place', previousA.y * decomposition.ch.w + previousA.x); check(decomposition.completed, 'Permite reconstruir la figura');
equal(t.app.prefs.completed.length, mosaicAwards, 'Desarmar y reconstruir no duplica piezas del álbum');
h.act('takeApart'); h.act('select', 'a'); t.handle('undo', ''); check(decomposition.completed, 'Deshacer la descomposición reconoce cobertura completa');

/* Pistas compatibles: no se penaliza una alternativa aún indistinguible. */
let s = h.activate('detective'); const rect = s.ch.options.find(o => o.kind === 'rectangle');
h.act('choose', rect.id); equal(s.attempts, 0, 'Respuesta compatible no cuenta como fallo'); equal(s.data.clue, 2, 'Se añade pista');
h.act('choose', rect.id); equal(s.attempts, 0, 'Segunda pista todavía permite rectángulo'); equal(s.data.clue, 3, 'Tercera pista discrimina');
h.act('choose', rect.id); equal(s.attempts, 1, 'Ahora sí se explica la propiedad ausente');

/* Memoria: duplicados, bloqueo de tercera carta, calma, temporizadores. */
s = h.activate('memory', 3); const a = s.ch.cards[0], b = s.ch.cards.find(c => c.kind !== a.kind), third = s.ch.cards.find(c => c.id !== a.id && c.id !== b.id);
h.act('flip', a.id); h.act('flip', a.id); equal(s.data.open.length, 1, 'Doble toque no duplica carta');
h.act('flip', b.id); h.act('flip', third.id); equal(s.data.open.length, 2, 'Tercera carta bloqueada');
h.advance(10000); equal(s.data.open.length, 2, 'En calma no se ocultan solas');
h.act('hide'); equal(s.data.open.length, 0, 'Ocultar manual funciona');
t.app.prefs.calm = false; h.act('flip', a.id); h.act('flip', b.id); equal(h.Exploradores.snapshot().timers, 1, 'Espera de comparación programada');
h.advance(2999); equal(s.data.open.length, 2, 'Visible antes de 3 s'); h.advance(1); equal(s.data.open.length, 0, 'Se oculta al cumplir la espera');
h.act('flip', a.id); h.act('flip', b.id); t.handle('map', ''); equal(h.Exploradores.snapshot().timers, 0, 'Salir cancela temporizadores');
h.advance(5000); equal(s.data.open.length, 2, 'Temporizador cancelado no cambia partida inactiva');
h.Exploradores.openGame('memory', 3); t.closeModal(); t.scheduleMemory(s); t.scheduleMemory(s); equal(h.Exploradores.snapshot().timers, 1, 'Reanudar no acumula temporizadores'); t.cleanup();

/* Deshacer, cambio de juego, ayudas y práctica sin premios. */
for (const id of ['mosaic', 'mail', 'path', 'pattern', 'repair']) {
  s = h.activate(id, id === 'mosaic' || id === 'repair' ? 2 : 1);
  const initial = JSON.stringify(s.data);
  if (id === 'mosaic') { const p = s.ch.pieces[0], sol = G.solveMosaic(s.ch, s.data.placements); h.act('select', p.id); while (s.data.rotations[p.id] !== sol[p.id].r) h.act('rotate'); h.act('place', 0); }
  if (id === 'mail') { const p = s.ch.items[0]; h.act('select', p.id); h.act('deliver', s.ch.bins.findIndex(b => G.predicates[b.rule](p.kind))); }
  if (id === 'path') h.act('step', G.solvePath(s.ch)[0]);
  if (id === 'pattern') { h.act('select', 'circle'); h.act('slot', s.ch.holes[0]); }
  if (id === 'repair') { h.act('select', s.ch.segments[0].id); h.act('place'); }
  check(s.history.length > 0, `Historial registrado: ${id}`);
  const beforeUndo = JSON.stringify(s.history[s.history.length - 1]); t.handle('undo', ''); equal(JSON.stringify(s.data), beforeUndo, `Deshacer restaura: ${id}`);
  const saved = JSON.stringify(s.data); t.handle('map', ''); h.Exploradores.openGame(id, s.ch.level); t.closeModal(); equal(JSON.stringify(t.app.game.data), saved, `Cambio de juego conserva estado: ${id}`);
  const awards = t.app.prefs.completed.length; t.practice(); check(t.app.game.practice, 'Práctica iniciada'); solve(h, t.app.game); equal(t.app.prefs.completed.length, awards, 'Práctica no duplica premios'); t.endPractice(); equal(JSON.stringify(t.app.game.data), saved, 'Vuelve al reto original');
  t.handle('reset', ''); equal(JSON.stringify(t.app.game.data), initial, `Reinicio reconstruye: ${id}`);
}

/* Rutas alternativas, incluidas revisitas que respetan la secuencia. */
s = h.activate('path', 1);
const alternate = { ...s.ch, cells: Array(9).fill('triangle'), start: 0, goal: 8, pattern: ['triangle'], w: 3, h: 3 };
s.ch = alternate; s.data = t.engines.path.init(alternate);
for (const cell of [3, 0, 1, 2, 5, 8]) h.act('step', cell);
check(s.completed, 'Ruta alternativa con revisita válida aceptada');
s = h.activate('path', 2); const beforePath = s.data.path.slice(); h.act('step', s.ch.goal); equal(s.data.path, beforePath, 'Salto no vecino rechazado');

/* Editor de patrones y modo libre diferenciados. */
s = h.activate('pattern'); const awards = t.app.prefs.completed.length;
h.act('mode', 'partner'); h.act('length', 3);
for (const [i, kind] of ['circle', 'square', 'triangle'].entries()) { h.act('select', kind); h.act('block', i); }
h.act('handoff'); equal(s.data.phase, 'continue', 'Pasa un patrón verificable al compañero');
for (let i = 6; i < 12; i++) { h.act('select', s.data.block[i % 3]); h.act('slot', i); }
h.act('check'); check(s.completed, 'Patrón del compañero aceptado'); equal(t.app.prefs.completed.length, awards, 'Creación no altera piezas de los retos base');
h.act('mode', 'free'); check(!s.completed, 'Puede cambiar a libre después de terminar'); h.act('check'); check(!s.completed, 'Creación vacía no finaliza');
h.act('select', 'rectangle'); h.act('slot', 4); h.act('check'); check(s.completed, 'Serie libre finaliza sin regla inventada'); equal(t.app.prefs.completed.length, awards, 'Libre no concede premio por patrón inexistente');

/* Cada ayuda y cada demostración puede renderizarse. */
for (const game of C.games) {
  s = h.activate(game.id, 3); t.help(); t.help(); t.help(); check(h.elements.get('#dialog').open, `Tercera ayuda abre demostración: ${game.id}`);
  for (let i = 0; i < 3; i++) { check(t.demoArt(game.id, i).includes('<'), `Demostración visual ${game.id}, paso ${i}`); t.handle('demo-step', ''); }
  t.closeModal(); check(!h.elements.get('#dialog').open, 'Demostración cerrable');
}
t.teacher(); check(h.elements.get('#dialog').innerHTML.includes('38 minutos'), 'Guía de clase'); t.album(); check(h.elements.get('#dialog').innerHTML.includes('48') === false, 'Álbum renderiza sus piezas por juego'); t.soundSettings();
t.handle('clock-toggle', ''); check(t.app.clock.running, 'Inicia reloj'); h.advance(5000); check(t.app.clock.left <= 2275, 'Reloj avanza');
t.handle('clock-toggle', ''); const left = t.app.clock.left; h.advance(10000); equal(t.app.clock.left, left, 'Reloj en pausa');
t.handle('clock-toggle', ''); h.advance(2280000); check(!t.app.clock.running, 'Fin del reloj'); check(h.elements.get('#dialog').innerHTML.includes('compartir'), 'Cierre amable');
t.handle('clock-reset', ''); equal(t.app.clock.left, 2280, 'Reinicio del reloj');
s = h.activate('mail'); h.advance(500); t.handle('next', ''); const nextId = t.app.game.ch.id; t.handle('next', ''); equal(t.app.game.ch.id, nextId, 'Doble toque en siguiente no salta dos retos');

/* Arrastre: el evento entrega con la misma validación que los dos toques. */
s = h.activate('mail'); const mailPiece = s.ch.items[0], mailBin = s.ch.bins.findIndex(b => G.predicates[b.rule](mailPiece.kind));
const source = { dataset: { drag: mailPiece.id }, disabled: false, cloneNode: () => ({ className: '', style: {}, removeAttribute() {}, setAttribute() {}, remove() {} }) };
h.events.pointerdown({ pointerId: 1, button: 0, clientX: 10, clientY: 10, target: { closest: () => source } });
h.events.pointermove({ pointerId: 1, clientX: 100, clientY: 100, preventDefault() {} });
h.document.elementFromPoint = () => ({ closest: () => ({ dataset: { drop: 'g:deliver', dropValue: String(mailBin) }, disabled: false }) });
h.events.pointerup({ pointerId: 1, clientX: 100, clientY: 100 }); equal(s.data.bins[mailPiece.id], mailBin, 'Entrega mediante Pointer Events');

/* Sin almacenamiento ni audio: misma resolución de todos los retos. */
const blocked = createHarness({ blockedStorage: true });
for (const game of blocked.Challenges.games) { const session = blocked.activate(game.id, 3); solve(blocked, session); check(session.completed, `Funciona sin voz/almacenamiento: ${game.id}`); }
check(!blocked.Exploradores.snapshot().storageOK, 'Detecta almacenamiento bloqueado sin detener el juego');
blocked.t.handle('erase', ''); equal(blocked.Exploradores.snapshot().completed.length, 0, 'Borrar funciona con almacenamiento bloqueado');
const voiced = createHarness({ voice: true, webmcp: true });
voiced.activate('detective'); voiced.t.handle('listen', ''); voiced.t.handle('listen', ''); check(voiced.audioCounts().cancelCalls >= voiced.audioCounts().speakCalls, 'Cancela locución anterior antes de hablar');
const cancels = voiced.audioCounts().cancelCalls; voiced.t.handle('map', ''); check(voiced.audioCounts().cancelCalls > cancels, 'Salir cancela locución');
equal(voiced.registrations.length, 2, 'Registra las dos herramientas opcionales');
const tool = voiced.registrations.find(r => r.name === 'open_geometry_game');
equal(tool.execute({ game: 'repair', level: 3 }), { game: 'repair', level: 3 }, 'Herramienta comparte navegación real');
assert.throws(() => tool.execute({ game: 'fake', level: 99 })); checks++;

/* Controles de clase y persistencia. */
h.advance(1000); t.teacher();
const target = { dataset: { classGame: 'repair' }, checked: true };
h.events.change({ target }); check(!target.checked, 'No permite un quinto desafío de clase');
h.events.change({ target: { dataset: { classGame: t.app.prefs.selected[0] }, checked: false } });
target.checked = true; h.events.change({ target }); check(t.app.prefs.selected.includes('repair') && t.app.prefs.selected.length === 4, 'Puede reemplazar una actividad');
for (const mode of ['solo', 'pair', 'trio', 'group']) { h.events.change({ target: { dataset: { setting: 'mode' }, value: mode } }); equal(t.app.prefs.mode, mode, `Participación: ${mode}`); }
check(h.stored.size > 0, 'Preferencias y álbum se guardan');
t.handle('erase', ''); equal(t.app.prefs.completed.length, 0, 'Borrado del progreso'); equal(Object.keys(t.app.sessions).length, 0, 'Borrado de tableros'); equal(h.stored.size, 0, 'Borrado de almacenamiento');

/* Integridad estática: recursos relativos, sin fetch ni dependencias externas. */
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const name of ['styles.css', 'geometry.js', 'challenges.js', 'script.js']) check(html.includes('./' + name) && fs.existsSync(path.join(root, name)), `Recurso local: ${name}`);
check(!/\bfetch\s*\(/.test(fs.readFileSync(path.join(root, 'script.js'), 'utf8')), 'Sin fetch');
check(!/https?:\/\//.test(html.replace(/data:image\/svg\+xml,[^"]+/g, '')), 'Sin recursos web requeridos');
if (process.env.FORMAS_QA_HTML) fs.writeFileSync(process.env.FORMAS_QA_HTML, JSON.stringify(rendered));
console.log(JSON.stringify({ result: 'PASS', assertions: checks, baseChallenges: 48, seeds: 100, generatedConfigurations: 4800, note: 'Pruebas de reglas y transiciones en Node; no sustituyen pruebas visuales o en dispositivos reales.' }, null, 2));
