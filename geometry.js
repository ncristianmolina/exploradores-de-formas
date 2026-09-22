/* Reglas puras: no dependen del navegador, del audio ni del almacenamiento. */
(function (root) {
  'use strict';
  const EPS = 1e-7;
  const shapes = {
    circle: { name: 'círculo', sides: 0, corners: 0, curved: true },
    triangle: { name: 'triángulo', sides: 3, corners: 3, curved: false },
    square: { name: 'cuadrado', sides: 4, corners: 4, curved: false },
    rectangle: { name: 'rectángulo no cuadrado', sides: 4, corners: 4, curved: false }
  };
  const predicates = {
    corners: k => shapes[k].corners > 0,
    noCorners: k => shapes[k].corners === 0,
    three: k => shapes[k].sides === 3,
    four: k => shapes[k].sides === 4,
    curved: k => shapes[k].curved,
    straight: k => !shapes[k].curved,
    equalFour: k => k === 'square',
    unequalFour: k => k === 'rectangle',
    circle: k => k === 'circle', triangle: k => k === 'triangle',
    square: k => k === 'square', rectangle: k => k === 'rectangle',
    rightFour: k => k === 'square' || k === 'rectangle'
  };
  function rng(seed) {
    let n = seed >>> 0;
    return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
  }
  function shuffle(array, random = Math.random) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const sqDist = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const samePoint = (a, b) => sqDist(a, b) < EPS;
  function isRectangle(points) {
    if (points.length !== 4 || new Set(points.map(p => p.join(','))).size !== 4) return false;
    for (let i = 0; i < 4; i++) {
      const a = points[i], b = points[(i + 1) % 4], c = points[(i + 2) % 4];
      if (sqDist(a, b) < EPS) return false;
      if (Math.abs((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) > EPS) return false;
    }
    return true;
  }
  function isSquare(points) {
    return isRectangle(points) && points.every((p, i) => Math.abs(sqDist(p, points[(i + 1) % 4]) - sqDist(points[0], points[1])) < EPS);
  }
  function polygonArea(p) {
    return Math.abs(p.reduce((sum, a, i) => { const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  }
  function inside(point, polygon) {
    let pos = false, neg = false;
    polygon.forEach((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      const v = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
      if (v > EPS) pos = true; if (v < -EPS) neg = true;
    });
    return !(pos && neg);
  }
  const piecePolygons = {
    square: [[0, 0], [1, 0], [1, 1], [0, 1]],
    domino: [[0, 0], [2, 0], [2, 1], [0, 1]],
    triangle: [[0, 0], [1, 0], [0, 1]],
    bigTriangle: [[0, 0], [2, 0], [0, 2]]
  };
  function rotatePoints(points, rotation) {
    let p = points.map(a => a.slice());
    for (let r = 0; r < ((rotation % 4) + 4) % 4; r++) p = p.map(([x, y]) => [-y, x]);
    const minX = Math.min(...p.map(a => a[0])), minY = Math.min(...p.map(a => a[1]));
    return p.map(([x, y]) => [x - minX, y - minY]);
  }
  const piecePolygon = (piece, x = 0, y = 0, rotation = 0) => rotatePoints(piecePolygons[piece], rotation).map(([a, b]) => [a + x, b + y]);
  /* Cada casilla contiene cuatro triángulos atómicos. Todas las piezas tienen
     bordes sobre esta partición: contar átomos es cobertura exacta, no píxeles. */
  function atoms(w, h) {
    const result = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      [[.5, 1 / 6], [5 / 6, .5], [.5, 5 / 6], [1 / 6, .5]].forEach(([a, b], i) => result.push({ id: `${x},${y},${i}`, point: [x + a, y + b] }));
    }
    return result;
  }
  function coverage(w, h, type, placement) {
    const p = piecePolygon(type, placement.x, placement.y, placement.r);
    if (p.some(([x, y]) => x < 0 || y < 0 || x > w || y > h)) return null;
    const covered = atoms(w, h).filter(a => inside(a.point, p)).map(a => a.id);
    return Math.abs(covered.length / 4 - polygonArea(p)) < EPS ? covered : null;
  }
  function mosaicStatus(ch, placements) {
    const seen = new Set();
    for (const piece of ch.pieces) {
      const pos = placements[piece.id]; if (!pos) continue;
      const cells = coverage(ch.w, ch.h, piece.type, pos);
      if (!cells) return { valid: false, reason: 'outside' };
      if (cells.some(c => seen.has(c))) return { valid: false, reason: 'overlap' };
      cells.forEach(c => seen.add(c));
    }
    return { valid: true, complete: seen.size === ch.w * ch.h * 4, covered: seen.size };
  }
  function solveMosaic(ch, placements = {}) {
    if (!mosaicStatus(ch, placements).valid) return null;
    const todo = ch.pieces.filter(p => !placements[p.id]);
    const go = (index, placed) => {
      if (index === todo.length) return mosaicStatus(ch, placed).complete ? placed : null;
      const p = todo[index];
      for (let r = 0; r < 4; r++) for (let y = 0; y < ch.h; y++) for (let x = 0; x < ch.w; x++) {
        const next = { ...placed, [p.id]: { x, y, r } };
        if (!mosaicStatus(ch, next).valid) continue;
        const result = go(index + 1, next); if (result) return result;
      }
      return null;
    };
    return go(0, { ...placements });
  }
  const adjacent = (a, b, w) => Math.abs(a % w - b % w) + Math.abs(Math.floor(a / w) - Math.floor(b / w)) === 1;
  function neighbors(i, w, h) { return Array.from({ length: w * h }, (_, n) => n).filter(n => adjacent(i, n, w)); }
  function pathStep(ch, path, next) {
    if (!Number.isInteger(next) || next < 0 || next >= ch.cells.length) return 'outside';
    if (!adjacent(path[path.length - 1], next, ch.w)) return 'neighbor';
    return ch.cells[next] === ch.pattern[path.length % ch.pattern.length] ? null : 'shape';
  }
  /* BFS de casilla + fase: admite alternativas, desvíos y revisitas válidas. */
  function solvePath(ch, path = [ch.start]) {
    const phase = path.length % ch.pattern.length;
    const queue = [{ cell: path[path.length - 1], phase, route: [] }];
    const visited = new Set([`${queue[0].cell}:${phase}`]);
    for (let q = 0; q < queue.length; q++) {
      const state = queue[q];
      if (state.cell === ch.goal) return state.route;
      for (const next of neighbors(state.cell, ch.w, ch.h)) {
        if (ch.cells[next] !== ch.pattern[state.phase]) continue;
        const nextPhase = (state.phase + 1) % ch.pattern.length, key = `${next}:${nextPhase}`;
        if (visited.has(key)) continue;
        visited.add(key); queue.push({ cell: next, phase: nextPhase, route: [...state.route, next] });
      }
    }
    return null;
  }
  function clueCandidates(options, clues) { return options.filter(o => clues.every(c => predicates[c.rule](o.kind))); }
  function segmentPoints(segment, rotation, origin) {
    const p = rotatePoints([[0, 0], segment.vector], rotation);
    return p.map(([x, y]) => [x + origin[0], y + origin[1]]);
  }
  function segmentFits(ch, id, rotation) {
    const segment = ch.segments.find(s => s.id === id); if (!segment) return false;
    const a = ch.target[ch.missing], b = ch.target[(ch.missing + 1) % ch.target.length];
    const p = segmentPoints(segment, rotation, [Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
    return (samePoint(p[0], a) && samePoint(p[1], b)) || (samePoint(p[1], a) && samePoint(p[0], b));
  }
  function describe(kind) {
    const s = shapes[kind];
    return s.curved ? 'Tiene un borde curvo y no tiene puntas.' : `Tiene ${s.sides} lados rectos y ${s.corners} puntas.`;
  }
  root.Geometry = { shapes, predicates, rng, shuffle, isSquare, isRectangle, polygonArea, inside, piecePolygon, rotatePoints, coverage, mosaicStatus, solveMosaic, adjacent, neighbors, pathStep, solvePath, clueCandidates, segmentPoints, segmentFits, describe };
})(typeof window !== 'undefined' ? window : globalThis);
