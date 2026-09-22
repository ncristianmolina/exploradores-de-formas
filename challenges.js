/* Catálogo declarativo: dos retos por nivel, ocho juegos, 48 retos base. */
(function (root) {
  'use strict';
  const G = root.Geometry;
  const kinds = ['circle', 'triangle', 'square', 'rectangle'];
  const games = [
    { id: 'mosaic', name: 'Taller de mosaicos', verb: 'Construí', skill: 'Unir y desarmar', color: '#3755b1', discovery: 'Las piezas pueden formar otra figura.', prompt: 'Elegí una pieza. Tocá dónde va.', hint: 'Mirá el contorno. Las piezas no pueden taparse entre sí.' },
    { id: 'mail', name: 'El correo de las formas', verb: 'Clasificá', skill: 'Encontrar lo que comparten', color: '#087f78', discovery: 'Podemos agrupar por lados o por puntas.', prompt: 'Repartí las figuras en los buzones.', hint: 'Recorré el borde y contá las puntas de cada figura.' },
    { id: 'detective', name: 'Detectives de las pistas', verb: 'Descubrí', skill: 'Usar pistas', color: '#8a4da4', discovery: 'Cada pista nos ayuda a distinguir.', prompt: 'Escuchá la pista. Buscá la figura.', hint: 'Una figura debe cumplir todas las pistas que ya vimos.' },
    { id: 'intruder', name: 'El intruso', verb: 'Compará', skill: 'Elegir y explicar', color: '#ad4b21', discovery: 'Una regla explica qué figuras van juntas.', prompt: 'Buscá quién no cumple la regla.', hint: 'Mirá la regla. El color y el tamaño no deciden.' },
    { id: 'memory', name: 'Memoria de formas', verb: 'Recordá', skill: 'Reconocer con cambios', color: '#ae3760', discovery: 'Girar o pintar una figura no cambia su tipo.', prompt: 'Destapá dos cartas del mismo tipo.', hint: 'Recordá la forma y el lugar; los colores pueden ser distintos.' },
    { id: 'path', name: 'Caminos de figuras', verb: 'Planeá', skill: 'Imaginar un recorrido', color: '#287441', discovery: 'Podemos planear, probar y volver atrás.', prompt: 'Tocá una casilla vecina para avanzar.', hint: 'Se avanza por un lado de la casilla, no en diagonal.' },
    { id: 'pattern', name: 'La máquina de series', verb: 'Continuá', skill: 'Encontrar lo que se repite', color: '#955b08', discovery: 'Un bloque que se repite forma un patrón.', prompt: 'Elegí una figura. Completá un hueco.', hint: 'Volvé al comienzo y buscá el bloque que se repite.' },
    { id: 'repair', name: 'El reparador de figuras', verb: 'Repará', skill: 'Observar y corregir', color: '#256b96', discovery: 'Un cuadrado tiene lados iguales y esquinas rectas.', prompt: 'Repará la figura para que cierre.', hint: 'Compará los lados y las esquinas, como la esquina de un cuaderno.' }
  ];
  const piece = (id, type, x, y, r = 0, fixed = false) => ({ id, type, solution: { x, y, r }, fixed });
  const mosaics = [
    { w: 2, h: 2, title: 'Completá el cuadrado.', pieces: [piece('a', 'square', 0, 0, 0, true), piece('b', 'square', 1, 0, 0, true), piece('c', 'square', 0, 1, 0, true), piece('d', 'square', 1, 1)] },
    { w: 3, h: 1, title: 'Cerrá este rectángulo.', pieces: [piece('a', 'square', 0, 0, 0, true), piece('b', 'square', 2, 0, 0, true), piece('c', 'square', 1, 0)] },
    { w: 2, h: 2, title: 'Hacé un cuadrado con dos triángulos.', pieces: [piece('a', 'bigTriangle', 0, 0), piece('b', 'bigTriangle', 0, 0, 2)] },
    { w: 2, h: 1, title: 'Uní un cuadrado y dos triángulos.', pieces: [piece('a', 'square', 1, 0), piece('b', 'triangle', 0, 0), piece('c', 'triangle', 0, 0, 2)] },
    { w: 3, h: 2, title: 'Llená el mosaico sin dejar huecos.', pieces: [piece('a', 'domino', 0, 0), piece('b', 'square', 2, 0), piece('c', 'triangle', 0, 1), piece('d', 'triangle', 0, 1, 2), piece('e', 'domino', 1, 1)] },
    { w: 2, h: 3, title: 'Armá este mosaico alto.', pieces: [piece('a', 'bigTriangle', 0, 0), piece('b', 'bigTriangle', 0, 0, 2), piece('c', 'domino', 0, 2)] }
  ];
  const bin = (rule, label, icon) => ({ rule, label, icon });
  const mail = [
    { bins: [bin('corners', 'Con puntas', 'triangle'), bin('noCorners', 'Sin puntas', 'circle')], items: ['square', 'circle', 'triangle', 'circle'], immediate: true },
    { bins: [bin('three', 'Tres lados', 'triangle'), bin('four', 'Cuatro lados', 'square')], items: ['triangle', 'rectangle', 'square', 'triangle'], immediate: true },
    { bins: kinds.map(k => bin(k, k === 'rectangle' ? 'Rectángulos no cuadrados' : G.shapes[k].name + 's', k)), items: ['square', 'triangle', 'rectangle', 'circle', 'square', 'rectangle'] },
    { bins: [bin('straight', 'Solo lados rectos', 'square'), bin('curved', 'Borde curvo', 'circle')], items: ['circle', 'rectangle', 'triangle', 'circle', 'square', 'triangle'] },
    { bins: [bin('equalFour', 'Cuatro lados iguales', 'square'), bin('unequalFour', 'Dos largos y dos cortos', 'rectangle')], items: ['square', 'rectangle', 'square', 'rectangle', 'square', 'rectangle'] },
    { bins: [bin('three', 'Tres puntas', 'triangle'), bin('four', 'Cuatro puntas', 'square'), bin('noCorners', 'Sin puntas', 'circle')], items: ['square', 'triangle', 'circle', 'rectangle', 'triangle', 'square', 'circle', 'rectangle'] }
  ];
  const clues = {
    straight: { rule: 'straight', text: 'Tengo lados rectos.', mark: 'sides' },
    four: { rule: 'four', text: 'Tengo cuatro lados.', mark: 'sides' },
    equalFour: { rule: 'equalFour', text: 'Mis cuatro lados miden lo mismo.', mark: 'sides' },
    curved: { rule: 'curved', text: 'Mi borde es curvo.', mark: 'sides' },
    noCorners: { rule: 'noCorners', text: 'No tengo puntas.', mark: 'corners' },
    three: { rule: 'three', text: 'Tengo tres puntas y tres lados.', mark: 'corners' },
    unequalFour: { rule: 'unequalFour', text: 'Tengo dos lados largos y dos cortos.', mark: 'sides' },
    rightFour: { rule: 'rightFour', text: 'Mis cuatro esquinas son como la de un cuaderno.', mark: 'corners' }
  };
  const detectives = [
    { target: 'square', clues: ['straight', 'four', 'equalFour'] },
    { target: 'circle', clues: ['noCorners', 'curved'] },
    { target: 'triangle', clues: ['straight', 'three'] },
    { target: 'rectangle', clues: ['four', 'rightFour', 'unequalFour'] },
    { target: 'square', clues: ['rightFour', 'equalFour'] },
    { target: 'triangle', clues: ['straight', 'three'] }
  ];
  const intruders = [
    { rule: 'four', label: 'Todas tienen cuatro lados.', items: ['square', 'triangle', 'rectangle'], reason: 'three' },
    { rule: 'straight', label: 'Todas tienen solo lados rectos.', items: ['triangle', 'square', 'circle', 'rectangle'], reason: 'curved' },
    { rule: 'three', label: 'Todas tienen tres puntas.', items: ['triangle', 'triangle', 'square', 'triangle'], reason: 'four' },
    { rule: 'curved', label: 'Todas tienen un borde curvo.', items: ['circle', 'circle', 'triangle', 'circle'], reason: 'three' },
    { rule: 'equalFour', label: 'Todas tienen cuatro lados iguales.', items: ['square', 'square', 'rectangle', 'square', 'square'], reason: 'unequalFour' },
    { rule: 'four', label: 'Todas tienen cuatro puntas.', items: ['rectangle', 'square', 'circle', 'square', 'rectangle', 'square'], reason: 'noCorners' }
  ];
  const reasons = { three: 'Tiene tres lados y tres puntas.', four: 'Tiene cuatro lados y cuatro puntas.', curved: 'Tiene un borde curvo.', noCorners: 'No tiene puntas.', unequalFour: 'Tiene dos lados largos y dos cortos.', equalFour: 'Tiene cuatro lados iguales.' };
  const memorySets = [['square', 'triangle'], ['circle', 'rectangle'], ['square', 'rectangle', 'triangle'], ['circle', 'square', 'rectangle'], kinds, kinds];
  const patternBlocks = [['circle', 'square'], ['triangle', 'rectangle'], ['square', 'square', 'triangle'], ['circle', 'circle', 'rectangle'], ['triangle', 'circle', 'square'], ['rectangle', 'triangle', 'circle']];
  const repairs = [
    { mode: 'segment', shape: 'square', title: 'Poné el lado que falta.', target: [[1, 1], [3, 1], [3, 3], [1, 3]], missing: 0, segments: [{ id: 'a', vector: [1, 0] }, { id: 'b', vector: [2, 0] }, { id: 'c', vector: [3, 0] }] },
    { mode: 'segment', shape: 'rectangle', title: 'Cerrá este rectángulo.', target: [[0, 1], [4, 1], [4, 3], [0, 3]], missing: 1, segments: [{ id: 'a', vector: [2, 0] }, { id: 'b', vector: [3, 0] }, { id: 'c', vector: [4, 0] }] },
    { mode: 'segment', shape: 'triangle', title: 'Completá el triángulo.', target: [[1, 1], [3, 1], [1, 3]], missing: 1, segments: [{ id: 'a', vector: [2, 2] }, { id: 'b', vector: [2, 0] }, { id: 'c', vector: [3, 3] }] },
    { mode: 'segment', shape: 'rectangle', title: 'Elegí y girá la barra que cierra.', target: [[1, 0], [3, 0], [3, 3], [1, 3]], missing: 3, segments: [{ id: 'a', vector: [2, 0] }, { id: 'b', vector: [3, 0] }, { id: 'c', vector: [1, 0] }] },
    { mode: 'corner', shape: 'square', title: 'Mové la punta para recuperar el cuadrado.', target: [[1, 1], [3, 1], [3, 3], [1, 3]], movable: 2, initial: [4, 2] },
    { mode: 'corner', shape: 'square', title: 'Repará este cuadrado girado.', target: [[2, 0], [4, 2], [2, 4], [0, 2]], movable: 1, initial: [4, 3] }
  ];
  function shapeItem(kind, i, rand, high = false) {
    const angles = high ? [0, 45, 90, 135, 180, 270] : [0, 0, 90];
    return { id: 'p' + i, kind, angle: angles[Math.floor(rand() * angles.length)], size: [.72, .86, 1][Math.floor(rand() * 3)], color: Math.floor(rand() * 6), variant: kind === 'triangle' ? i % 3 : 0 };
  }
  function makePath(level, variant, seed) {
    const rand = G.rng(seed), w = level === 1 ? 3 : 4, h = level === 3 ? 4 : 3;
    const pattern = level === 1 ? ['triangle'] : level === 2 ? (variant ? ['square', 'circle'] : ['circle', 'square']) : (variant ? ['circle', 'rectangle', 'triangle'] : ['triangle', 'square', 'circle']);
    const mirror = Boolean(variant), map = (x, y) => y * w + (mirror ? w - 1 - x : x);
    let x = 0, y = 0; const route = [map(x, y)];
    while (x < w - 1 || y < h - 1) {
      if (y === h - 1 || (x < w - 1 && rand() > .5)) x++; else y++;
      route.push(map(x, y));
    }
    const cells = Array.from({ length: w * h }, () => kinds[Math.floor(rand() * kinds.length)]);
    route.forEach((i, n) => { cells[i] = pattern[n % pattern.length]; });
    return { w, h, cells, pattern, start: route[0], goal: route[route.length - 1] };
  }
  function get(game, level = 1, variant = 0, seed = 42) {
    if (!games.some(g => g.id === game) || ![1, 2, 3].includes(level) || ![0, 1].includes(variant)) throw new Error('Reto desconocido');
    const n = (level - 1) * 2 + variant, rand = G.rng(seed + n * 123 + 19);
    let ch;
    if (game === 'mosaic') {
      ch = JSON.parse(JSON.stringify(mosaics[n]));
      ch.pieces.forEach(p => { p.initialRotation = p.fixed ? p.solution.r : Math.floor(rand() * 4); });
    } else if (game === 'mail') {
      ch = { ...mail[n], items: G.shuffle(mail[n].items.map((k, i) => shapeItem(k, i, rand, level > 1)), rand) };
    } else if (game === 'detective') {
      ch = { ...detectives[n], clues: detectives[n].clues.map(k => clues[k]), options: G.shuffle(kinds.map((k, i) => shapeItem(k, i, rand, true)), rand) };
      if (n === 4) ch.options.find(o => o.kind === 'square').angle = 45;
    } else if (game === 'intruder') {
      const source = intruders[n], reasonKeys = [source.reason, ...Object.keys(reasons).filter(k => k !== source.reason && !G.predicates[k](source.items.find(k => !G.predicates[source.rule](k)))).slice(0, 2)];
      ch = { ...source, items: G.shuffle(source.items.map((k, i) => shapeItem(k, i, rand, true)), rand), reasons: G.shuffle(reasonKeys.map(k => ({ rule: k, text: reasons[k] })), rand) };
    } else if (game === 'memory') {
      ch = { cards: G.shuffle(memorySets[n].flatMap((k, i) => [shapeItem(k, i * 2, rand, true), shapeItem(k, i * 2 + 1, rand, true)]), rand) };
      for (const k of memorySets[n]) {
        const pair = ch.cards.filter(c => c.kind === k); pair[0].angle = 0; pair[1].angle = k === 'rectangle' ? 90 : 45;
        pair[0].color = 0; pair[1].color = 3; pair[0].size = 1; pair[1].size = .75;
      }
    } else if (game === 'path') ch = makePath(level, variant, seed + n * 53);
    else if (game === 'pattern') {
      const block = patternBlocks[n], length = level === 1 ? 8 : level === 2 ? 12 : 12;
      const holes = level === 1 ? [5, 7] : level === 2 ? (variant ? [7, 9, 11] : [6, 8, 11]) : (variant ? [6, 8, 9, 11] : [7, 8, 10, 11]);
      ch = { block, length, holes };
    } else if (game === 'repair') ch = JSON.parse(JSON.stringify(repairs[n]));
    return { ...ch, game, level, variant, seed, id: `${game}:${level}:${variant}` };
  }
  function validate(ch) {
    if (ch.game === 'mosaic') {
      const solution = Object.fromEntries(ch.pieces.map(p => [p.id, p.solution]));
      return G.mosaicStatus(ch, solution).complete === true;
    }
    if (ch.game === 'mail') return ch.items.every(i => ch.bins.filter(b => G.predicates[b.rule](i.kind)).length === 1);
    if (ch.game === 'detective') { const all = G.clueCandidates(ch.options, ch.clues); return all.length === 1 && all[0].kind === ch.target; }
    if (ch.game === 'intruder') {
      const odd = ch.items.filter(i => !G.predicates[ch.rule](i.kind));
      return odd.length === 1 && ch.reasons.filter(r => G.predicates[r.rule](odd[0].kind)).length === 1;
    }
    if (ch.game === 'memory') return [...new Set(ch.cards.map(c => c.kind))].every(k => ch.cards.filter(c => c.kind === k).length === 2);
    if (ch.game === 'path') return ch.cells[ch.start] === ch.pattern[0] && G.solvePath(ch) !== null;
    if (ch.game === 'pattern') return ch.holes.every(i => i >= ch.block.length * 2 && i < ch.length) && ch.block.length >= 2;
    if (ch.game === 'repair') {
      if (ch.mode === 'corner') { const bad = ch.target.map(p => p.slice()); bad[ch.movable] = ch.initial; return G.isSquare(ch.target) && !G.isSquare(bad); }
      return ch.segments.some(s => [0, 1, 2, 3].some(r => G.segmentFits(ch, s.id, r))) && (ch.shape !== 'square' || G.isSquare(ch.target));
    }
    return false;
  }
  function audit(seed = 42) {
    const results = [];
    for (const g of games) for (let l = 1; l <= 3; l++) for (let v = 0; v < 2; v++) {
      const ch = get(g.id, l, v, seed); results.push({ id: ch.id, valid: validate(ch) });
    }
    return results;
  }
  root.Challenges = { games, kinds, get, validate, audit };
})(typeof window !== 'undefined' ? window : globalThis);
