#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   test_agregar_estudiantes.js · Prueba de lógica pura del modo agregar
   (§6 de agregar_estudiantes_a_lista.md)

   Prueba la lógica sin navegador ni DOM: pool, comparación de
   existentes/nuevos, numeración, CSV de nuevos y compatibilidad
   del campo agregadoEn con el ciclo ida/vuelta SQL.

   Uso: node test_agregar_estudiantes.js
   ════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const { datosAFilas, filasADatos } = require('./mapeo');
const { crearEsquema, insertarFilas, leerFilas, ORDEN_TABLAS } = require('./sqlite-schema');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_) { DatabaseSync = null; }

let passed = 0, failed = 0;
function ok(label, fn) {
  try { fn(); console.log(`  ✓  ${label}`); passed++; }
  catch (e) { console.error(`  ✗  ${label}\n     ${e.message}`); failed++; }
}

// ── Helpers mínimos que replican la lógica pura de script.js ────

function uid() { return 'id' + Math.random().toString(36).slice(2, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function parseUsername(username) {
  const m = /^([a-zA-Z]+)(\d+)$/.exec(String(username || '').trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Extrae el prefijo y los dígitos de relleno dominantes de una lista.
 * Ignora filas con prefijo distinto al más frecuente (p. ej. docentes importados).
 * Devuelve null si no hay ninguna fila con formato válido.
 */
function detectarPrefijoDominante(participantes) {
  const conteo = {};
  participantes.forEach(p => {
    const parsed = parseUsername(p.username);
    if (parsed) conteo[parsed.prefix.toLowerCase()] = (conteo[parsed.prefix.toLowerCase()] || 0) + 1;
  });
  if (!Object.keys(conteo).length) return null;
  const prefix = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0];
  const ejemplo = participantes.find(p => {
    const parsed = parseUsername(p.username);
    return parsed && parsed.prefix.toLowerCase() === prefix;
  });
  const parsed = parseUsername(ejemplo.username);
  const digits = String(parsed.num).length <= 3 ? 3 : 4;
  return { prefix, digits };
}

/**
 * Calcula el máximo número del pool para colegio+nivel+prefijo.
 * Replica la lógica de generarListaUsuarios() en script.js:
 * - Solo cuenta data.participantes (NO la papelera).
 * - Filtra por colegioId y nivel.
 */
function calcularMaxPool(todosParticipantes, colegioId, nivel, prefix, cursoMap) {
  let maxNum = 0;
  todosParticipantes
    .filter(p => p.colegioId === colegioId)
    .forEach(p => {
      const pNivel = p.nivel || (cursoMap[p.cursoId] || {}).nivel;
      if (pNivel !== nivel) return;
      const parsed = parseUsername(p.username);
      if (parsed && parsed.prefix.toLowerCase() === prefix.toLowerCase()) {
        maxNum = Math.max(maxNum, parsed.num);
      }
    });
  return maxNum;
}

/**
 * Simula generarListaEnModoAgregar():
 * - Recibe la lista existente y las nuevas líneas (apellidos/nombres).
 * - Devuelve { nuevos, countEx, error? }
 */
function simularModoAgregar(opts) {
  const { existentes, apLines, noLines, todosParticipantes, colegioId, nivel, prefix, digits, nombreCorto, group1, password, city, emailDominio, cursoMap } = opts;

  if (apLines.length !== noLines.length) {
    return { error: `Líneas de apellidos (${apLines.length}) y nombres (${noLines.length}) no coinciden.` };
  }

  const existentesSet = new Set(
    existentes.map(r => {
      const nombres = r.nombres || '';
      return normalize(r.apellidos || '') + '||' + normalize(nombres);
    })
  );

  const nuevosAp = [], nuevosNo = [];
  let countEx = 0;
  apLines.forEach((ap, i) => {
    const no = noLines[i];
    const key = normalize(ap) + '||' + normalize(no);
    if (existentesSet.has(key)) { countEx++; }
    else { nuevosAp.push(ap); nuevosNo.push(no); }
  });

  if (!nuevosAp.length) {
    return { error: `No hay estudiantes nuevos (${countEx} ya existen).`, countEx, nuevos: [] };
  }

  const maxNum = calcularMaxPool(todosParticipantes, colegioId, nivel, prefix, cursoMap || {});
  const start = maxNum + 1;
  const fecha = todayStr();
  const agregadoEn = new Date().toISOString();

  const nuevos = nuevosAp.map((ap, i) => {
    const num = String(start + i).padStart(digits, '0');
    const username = prefix + num;
    return {
      id: uid(), colegioId, cursoId: existentes[0]?.cursoId || '', anio: existentes[0]?.anio || '',
      nivel, username, password, nombres: nuevosNo[i], apellidos: ap,
      email: `${username}@${emailDominio}`,
      city, country: 'Venezuela', course1: nombreCorto, group1, role1: 'student',
      enrolperiod1: '365d', suspended: '0', fecha, agregadoEn
    };
  });

  return { nuevos, countEx };
}

function buildCSV(rows) {
  const cols = ['username','password','firstname','lastname','email','city','country','course1','group1','role1','enrolperiod1','suspended'];
  const header = cols.join(',');
  const lines = rows.map(r => cols.map(c => r[c] ?? '').join(','));
  return [header, ...lines].join('\n');
}

function calcularRangos(rows) {
  if (!rows.length) return '';
  const sorted = [...rows].sort((a, b) => a.username.localeCompare(b.username));
  if (sorted.length === 1) return sorted[0].username;
  const withP = sorted.map(r => ({ u: r.username, p: parseUsername(r.username) }));
  if (!withP.every(x => x.p)) return `${sorted[0].username} – ${sorted[sorted.length-1].username}`;
  const prefix0 = withP[0].p.prefix.toLowerCase();
  if (!withP.every(x => x.p.prefix.toLowerCase() === prefix0)) return `${sorted[0].username} – ${sorted[sorted.length-1].username}`;
  const byNum = [...withP].sort((a, b) => a.p.num - b.p.num);
  const segs = []; let segStart = 0;
  for (let i = 1; i <= byNum.length; i++) {
    if (i === byNum.length || byNum[i].p.num !== byNum[i-1].p.num + 1) {
      segs.push({ from: byNum[segStart].u, to: byNum[i-1].u });
      segStart = i;
    }
  }
  if (segs.length === 1) return `${segs[0].from} – ${segs[0].to}`;
  return segs.map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
}

// ── Datos de prueba ──────────────────────────────────────────────

const COLEGIO_ID = 'idcol001';
const CURSO_ID_MEDIA = 'idcur001';
const NOMBRE_CORTO = '5thyr-ag';
const EMAIL_DOMINIO = 'tecno.com';

function mkParticipante(username, anio, nivel) {
  return {
    id: uid(), colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio, nivel,
    username, password: '1234', nombres: 'NOMBRE', apellidos: 'APELLIDO',
    email: `${username}@${EMAIL_DOMINIO}`, city: '', country: 'Venezuela',
    course1: NOMBRE_CORTO, group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0',
    fecha: '2026-01-01'
  };
}

// ── Prueba 1: Pool con máximo ag0300 en 2do Año; agregar 3 a 5to Año → ag0301,ag0302,ag0303 ──

console.log('\n1) Pool ag0300 en 2do Año → primero nuevo de 5to Año es ag0301:');
ok('primero nuevo: ag0301', () => {
  const existentes5to = [
    { id: uid(), colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '5to Año', nivel: 'media',
      username: 'ag0001', password: '1234', nombres: 'ANA', apellidos: 'MORA', email: 'ag0001@tecno.com', city: '', country: 'Venezuela', course1: NOMBRE_CORTO, group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
  ];
  const todos = [
    ...existentes5to,
    mkParticipante('ag0300', '2do Año', 'media'),
  ];
  const r = simularModoAgregar({
    existentes: existentes5to,
    apLines: ['MORA', 'GARCIA', 'LOPEZ', 'RUIZ'],
    noLines: ['ANA', 'CARLOS', 'MARIA', 'PEDRO'],
    todosParticipantes: todos,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '5678', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.countEx, 1, 'ANA MORA debe detectarse como existente');
  assert.strictEqual(r.nuevos.length, 3);
  assert.strictEqual(r.nuevos[0].username, 'ag0301');
  assert.strictEqual(r.nuevos[1].username, 'ag0302');
  assert.strictEqual(r.nuevos[2].username, 'ag0303');
});

ok('relleno 4 dígitos mantenido', () => {
  const todos = [mkParticipante('ag0300', '2do Año', 'media')];
  const r = simularModoAgregar({
    existentes: [],
    apLines: ['GARCIA'], noLines: ['NUEVO'],
    todosParticipantes: todos,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.strictEqual(r.nuevos[0].username, 'ag0301');
  assert.strictEqual(r.nuevos[0].username.length, 6, 'ag + 4 dígitos = 6 chars');
});

// ── Prueba 2: Usuarios de 3 dígitos ──────────────────────────────

console.log('\n2) Usuarios de 3 dígitos (ag300 → ag301…):');
ok('relleno 3 dígitos sin añadir ceros', () => {
  const todos = [mkParticipante('ag300', '2do grado', 'primaria')];
  const r = simularModoAgregar({
    existentes: [],
    apLines: ['TORRES', 'VIVAS'], noLines: ['LUIS', 'ELENA'],
    todosParticipantes: todos,
    colegioId: COLEGIO_ID, nivel: 'primaria', prefix: 'ag', digits: 3,
    nombreCorto: '2ndgrade-ag', group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.strictEqual(r.nuevos[0].username, 'ag301');
  assert.strictEqual(r.nuevos[1].username, 'ag302');
});

// ── Prueba 3: Existentes conservados, papelera no recibe nada ────

console.log('\n3) Los 14 existentes conservan id/orden; la papelera no recibe nada:');
ok('existentes se omiten correctamente', () => {
  const existentes = Array.from({ length: 14 }, (_, i) => ({
    id: `idex${String(i).padStart(3,'0')}`,
    colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '5to Año', nivel: 'media',
    username: `ag${String(i + 1).padStart(4, '0')}`,
    password: '1234', nombres: `NOMBRE${i}`, apellidos: `APELLIDO${i}`,
    email: `ag${String(i+1).padStart(4,'0')}@tecno.com`,
    city: '', country: 'Venezuela', course1: NOMBRE_CORTO,
    group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01'
  }));

  const apLines = existentes.map(e => e.apellidos);
  const noLines = existentes.map(e => e.nombres);

  const r = simularModoAgregar({
    existentes, apLines, noLines,
    todosParticipantes: existentes,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.ok(r.error, 'debe retornar error cuando no hay nuevos');
  assert.strictEqual(r.countEx, 14, '14 existentes detectados');
  assert.strictEqual((r.nuevos || []).length, 0);
});

ok('ids de existentes intactos (no se sobrescriben)', () => {
  const existentes = [
    { id: 'idconservado1', colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '5to Año', nivel: 'media',
      username: 'ag0001', password: '1234', nombres: 'ANA', apellidos: 'MORA',
      email: 'ag0001@tecno.com', city: '', country: 'Venezuela', course1: NOMBRE_CORTO,
      group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
  ];
  const r = simularModoAgregar({
    existentes,
    apLines: ['MORA', 'GARCIA'], noLines: ['ANA', 'NUEVO'],
    todosParticipantes: existentes,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.strictEqual(r.countEx, 1);
  assert.strictEqual(r.nuevos.length, 1);
  assert.notStrictEqual(r.nuevos[0].id, 'idconservado1', 'nuevo tiene id distinto');
  assert.strictEqual(r.nuevos[0].username, 'ag0002');
});

// ── Prueba 4: Cero nuevos → aviso y sin cambios ───────────────────

console.log('\n4) Cero nuevos → aviso, sin cambios:');
ok('0 nuevos retorna error descriptivo', () => {
  const existentes = [
    { id: 'id1', colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '3ro Año', nivel: 'media',
      username: 'ag0010', password: '1234', nombres: 'PEDRO', apellidos: 'GOMEZ',
      email: 'ag0010@tecno.com', city: '', country: 'Venezuela', course1: NOMBRE_CORTO,
      group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
  ];
  const r = simularModoAgregar({
    existentes,
    apLines: ['GOMEZ'], noLines: ['PEDRO'],
    todosParticipantes: existentes,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.ok(r.error, 'debe haber error');
  assert.strictEqual(r.countEx, 1);
  assert.strictEqual((r.nuevos || []).length, 0);
});

ok('duplicados se tratan como existentes', () => {
  const existentes = [
    { id: 'id1', colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '3ro Año', nivel: 'media',
      username: 'ag0010', password: '1234', nombres: 'PEDRO', apellidos: 'GOMEZ',
      email: 'ag0010@tecno.com', city: '', country: 'Venezuela', course1: NOMBRE_CORTO,
      group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
  ];
  // Enviar la misma persona dos veces + una nueva
  const r = simularModoAgregar({
    existentes,
    apLines: ['GOMEZ', 'GOMEZ', 'PEREZ'],
    noLines: ['PEDRO', 'PEDRO', 'LUIS'],
    todosParticipantes: existentes,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'ag', digits: 4,
    nombreCorto: NOMBRE_CORTO, group1: '', password: '1234', city: '',
    emailDominio: EMAIL_DOMINIO
  });
  assert.strictEqual(r.countEx, 2, 'GOMEZ PEDRO aparece 2 veces: ambas como existente');
  assert.strictEqual(r.nuevos.length, 1);
  assert.strictEqual(r.nuevos[0].apellidos, 'PEREZ');
});

// ── Prueba 5: Cleveland — docentes de otro prefijo se ignoran ────

console.log('\n5) Lista Cleveland con docentes de otro prefijo (detectarPrefijoDominante):');
ok('docentes ignorados para detectar prefijo', () => {
  const lista = [
    { id: 'id1', username: 'sje001', colegioId: COLEGIO_ID },
    { id: 'id2', username: 'sje002', colegioId: COLEGIO_ID },
    { id: 'id3', username: 'sje003', colegioId: COLEGIO_ID },
    { id: 'id4', username: 'moisesleal92', colegioId: COLEGIO_ID }, // docente importado
  ];
  const result = detectarPrefijoDominante(lista);
  assert.strictEqual(result.prefix, 'sje', 'prefijo dominante debe ser sje');
});

ok('numeración ignora docentes al calcular pool', () => {
  const estudiantes = [
    { id: uid(), colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '1er Año', nivel: 'media',
      username: 'sje001', password: '1234', nombres: 'ANA', apellidos: 'MORA',
      email: 'sje001@cleve.com', city: '', country: 'Venezuela', course1: '1styear-sje',
      group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
    { id: uid(), colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '1er Año', nivel: 'media',
      username: 'sje002', password: '1234', nombres: 'CARLOS', apellidos: 'GARCIA',
      email: 'sje002@cleve.com', city: '', country: 'Venezuela', course1: '1styear-sje',
      group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
  ];
  const docentes = [
    { id: uid(), colegioId: COLEGIO_ID, cursoId: CURSO_ID_MEDIA, anio: '1er Año', nivel: 'media',
      username: 'moisesleal92', password: '1234', nombres: 'MOISES', apellidos: 'LEAL',
      email: 'moisesleal92@gmail.com', city: '', country: 'Venezuela',
      course1: '1styear-sje', group1: '', role1: 'teacher', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
  ];
  const todos = [...estudiantes, ...docentes];
  // apLines/noLines: ANA MORA (existente), CARLOS GARCIA (existente), NUEVO EST (nuevo)
  const r = simularModoAgregar({
    existentes: estudiantes,
    apLines: ['MORA', 'GARCIA', 'PEREZ'],
    noLines: ['ANA', 'CARLOS', 'NUEVO'],
    todosParticipantes: todos,
    colegioId: COLEGIO_ID, nivel: 'media', prefix: 'sje', digits: 3,
    nombreCorto: '1styear-sje', group1: '', password: '1234', city: '',
    emailDominio: 'cleve.com'
  });
  assert.ok(!r.error, r.error);
  assert.strictEqual(r.countEx, 2, 'ANA MORA y CARLOS GARCIA son existentes');
  assert.strictEqual(r.nuevos.length, 1);
  assert.strictEqual(r.nuevos[0].username, 'sje003', 'continúa desde sje002 ignorando el docente moisesleal92');
});

// ── Prueba 6: Lista sin formato válido → cae a generación normal ─

console.log('\n6) Lista sin usuarios con formato válido:');
ok('detectarPrefijoDominante retorna null si no hay usuarios válidos', () => {
  const lista = [
    { username: 'no-format', colegioId: COLEGIO_ID },
    { username: 'otro-sin-num', colegioId: COLEGIO_ID },
  ];
  assert.strictEqual(detectarPrefijoDominante(lista), null);
});

// ── Prueba 7: Rango continuo y no continuo ────────────────────────

console.log('\n7) Rango de usuarios y conteo; CSV de nuevos vs CSV completo:');
ok('rango continuo muestra first–last', () => {
  const rows = [
    { username: 'ag0001' }, { username: 'ag0002' }, { username: 'ag0003' }
  ];
  assert.strictEqual(calcularRangos(rows), 'ag0001 – ag0003');
});

ok('rango no contiguo muestra tramos', () => {
  const rows = [
    { username: 'dc0001' }, { username: 'dc0002' }, { username: 'dc0003' },
    { username: 'dc0086' }, { username: 'dc0087' }, { username: 'dc0088' }
  ];
  const rango = calcularRangos(rows);
  assert.ok(rango.includes('dc0001'), `rango debe incluir dc0001, got: ${rango}`);
  assert.ok(rango.includes('dc0088'), `rango debe incluir dc0088, got: ${rango}`);
  assert.ok(rango.includes(','), `rango no contiguo debe incluir coma, got: ${rango}`);
});

ok('CSV de nuevos solo contiene los agregados', () => {
  const todos = [
    { username: 'ag0001', password: '1234', nombres: 'ANA', apellidos: 'MORA', apellidos_csv: 'MORA', email: 'ag0001@t.com', city: '', country: 'Venezuela', course1: 'x', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', firstname: 'ag0001 ANA', lastname: 'MORA' },
    { username: 'ag0002', password: '1234', nombres: 'LUIS', apellidos: 'GARCIA', email: 'ag0002@t.com', city: '', country: 'Venezuela', course1: 'x', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', firstname: 'ag0002 LUIS', lastname: 'GARCIA', agregadoEn: '2026-10-08T10:00:00Z' },
  ];
  const nuevos = todos.filter(r => r.agregadoEn);
  const csvNuevos = buildCSV(nuevos.map(r => ({ ...r, firstname: r.firstname || `${r.username} ${r.nombres}`, lastname: r.lastname || r.apellidos })));
  const csvTodos = buildCSV(todos.map(r => ({ ...r, firstname: r.firstname || `${r.username} ${r.nombres}`, lastname: r.lastname || r.apellidos })));
  assert.ok(csvNuevos.includes('ag0002'), 'CSV nuevos debe incluir ag0002');
  assert.ok(!csvNuevos.includes('ag0001'), 'CSV nuevos NO debe incluir ag0001');
  assert.ok(csvTodos.includes('ag0001'), 'CSV completo incluye ag0001');
  assert.ok(csvTodos.includes('ag0002'), 'CSV completo incluye ag0002');
});

// ── Prueba 8: Respaldo — agregadoEn viaja sin pérdida ─────────────

console.log('\n8) Respaldo: agregadoEn conservado en ida y vuelta SQL:');

function mkPayloadConAgregadoEn() {
  const cId = uid(), kId = uid();
  return {
    _academia: 'tecno',
    colegios: [{ id: cId, nombre: 'Col1' }],
    cursos: [{ id: kId, nombre: 'Cur1', nivel: 'media' }],
    asignaciones: [],
    participantes: [
      { id: uid(), colegioId: cId, cursoId: kId, anio: '1er Año', nivel: 'media',
        username: 'ag0001', password: '1234', nombres: 'ANA', apellidos: 'MORA',
        email: 'ag0001@t.com', city: '', country: 'Venezuela',
        course1: 'x', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0',
        fecha: '2026-01-01' },
      { id: uid(), colegioId: cId, cursoId: kId, anio: '1er Año', nivel: 'media',
        username: 'ag0002', password: '5678', nombres: 'LUIS', apellidos: 'GARCIA',
        email: 'ag0002@t.com', city: 'Val', country: 'Venezuela',
        course1: 'x', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0',
        fecha: '2026-10-08', agregadoEn: '2026-10-08T10:00:00.000Z' },
    ],
    carnetListas: [], carnetOpciones: { layout: 'big', url: '', upper: true },
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] }
  };
}

if (DatabaseSync) {
  ok('agregadoEn viaja Respaldo→SQL→Respaldo sin pérdida', () => {
    const payload = mkPayloadConAgregadoEn();
    const filas = datosAFilas(payload);
    const db = new DatabaseSync(':memory:');
    crearEsquema(db);
    ORDEN_TABLAS.forEach(t => { if (filas[t] && filas[t].length) insertarFilas(db, t, filas[t]); });
    const leido = {};
    ORDEN_TABLAS.forEach(t => { leido[t] = leerFilas(db, t); });
    const resultado = filasADatos(leido, 'tecno');
    const p0 = resultado.participantes.find(p => p.username === 'ag0001');
    const p1 = resultado.participantes.find(p => p.username === 'ag0002');
    assert.ok(!p0.agregadoEn, 'ag0001 no debe tener agregadoEn');
    assert.ok(p1.agregadoEn, 'ag0002 debe conservar agregadoEn');
    assert.strictEqual(p1.agregadoEn, '2026-10-08T10:00:00.000Z');
  });

  ok('respaldo antiguo sin agregadoEn importa sin romperse', () => {
    const cId = uid(), kId = uid();
    const respaldoAntiguo = {
      _academia: 'tecno',
      colegios: [{ id: cId, nombre: 'Antiguo' }],
      cursos: [{ id: kId, nombre: 'Cur', nivel: 'media' }],
      asignaciones: [],
      participantes: [
        { id: uid(), colegioId: cId, cursoId: kId, anio: '1er Año', nivel: 'media',
          username: 'old001', password: '1234', nombres: 'VIEJO', apellidos: 'USER',
          email: 'old001@t.com', city: '', country: 'Venezuela',
          course1: 'x', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0',
          fecha: '2025-01-01' }
      ],
      carnetListas: [], carnetOpciones: { layout: 'big', url: '', upper: true },
      trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] }
    };
    const filas = datosAFilas(respaldoAntiguo);
    const db = new DatabaseSync(':memory:');
    crearEsquema(db);
    ORDEN_TABLAS.forEach(t => { if (filas[t] && filas[t].length) insertarFilas(db, t, filas[t]); });
    const leido = {};
    ORDEN_TABLAS.forEach(t => { leido[t] = leerFilas(db, t); });
    const resultado = filasADatos(leido, 'tecno');
    assert.strictEqual(resultado.participantes.length, 1);
    assert.ok(!resultado.participantes[0].agregadoEn, 'sin agregadoEn en respaldo antiguo');
  });
} else {
  ok('mapeo: agregadoEn → agregado_en en filaParticipante (sin SQLite)', () => {
    const payload = mkPayloadConAgregadoEn();
    const filas = datosAFilas(payload);
    const p1 = filas.participantes.find(p => p.username === 'ag0002');
    const p0 = filas.participantes.find(p => p.username === 'ag0001');
    assert.strictEqual(p1.agregado_en, '2026-10-08T10:00:00.000Z', 'campo mapeado correctamente');
    assert.strictEqual(p0.agregado_en, null, 'sin agregadoEn → null');
  });
  ok('mapeo: agregado_en → agregadoEn en filasADatos (sin SQLite)', () => {
    const payload = mkPayloadConAgregadoEn();
    const filas = datosAFilas(payload);
    // Simular lo que haría la BD: devolver las mismas filas con los nombres en snake_case
    const resultado = filasADatos({
      colegios: filas.colegios, cursos_modelo: filas.cursos_modelo,
      asignaciones: filas.asignaciones, participantes: filas.participantes,
      carnet_listas: filas.carnet_listas, carnet_estudiantes: filas.carnet_estudiantes,
      carnet_opciones: filas.carnet_opciones
    }, 'tecno');
    const p1 = resultado.participantes.find(p => p.username === 'ag0002');
    const p0 = resultado.participantes.find(p => p.username === 'ag0001');
    assert.ok(p1.agregadoEn, 'agregadoEn restaurado correctamente');
    assert.ok(!p0.agregadoEn, 'ag0001 sin agregadoEn');
  });
  console.log('  (node:sqlite no disponible en Node.js <22; pruebas SQL omitidas)');
}

// ── Prueba 9: node --check sobre los archivos modificados ────────

console.log('\n9) Sintaxis JS verificada (node --check):');
const { execSync } = require('child_process');
const path = require('path');
const base = path.join(__dirname, '..', '..');

const archivos = [
  'database/scripts/mapeo.js',
  'database/scripts/sqlite-schema.js',
  'database/scripts/respaldo_a_sql.js',
  'database/scripts/sql_a_respaldo.js',
  'database/scripts/test_idavuelta.js',
  'database/scripts/test_sync_core.js',
  'database/scripts/test_sync_dos_dispositivos.js',
  'database/scripts/test_agregar_estudiantes.js',
  'Organizador_moodle/script.js',
];

archivos.forEach(rel => {
  const abs = path.join(base, rel);
  ok(`node --check ${rel}`, () => {
    execSync(`node --check "${abs}"`, { stdio: 'pipe' });
  });
});

// ── Resumen ──────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Resultado: ${passed} pasaron, ${failed} fallaron.\n`);
if (failed) {
  console.log('NO pudo probar (requiere navegador / DOM real):');
  console.log('  - El modo agregar en la interfaz (bloqueo de selectores,');
  console.log('    relleno de textareas, banner, contador en vivo, resaltado');
  console.log('    de filas "Nuevo" en la tabla editable).');
  console.log('  - El botón "⬇ CSV solo de los nuevos" desde Ver/Editar.');
  console.log('  - Sincronización de agregadoEn con Firebase.');
  process.exit(1);
} else {
  console.log('NO pudo probar (requiere navegador / DOM real):');
  console.log('  - El modo agregar en la interfaz (bloqueo de selectores,');
  console.log('    relleno de textareas, banner, contador en vivo, resaltado');
  console.log('    de filas "Nuevo" en la tabla editable).');
  console.log('  - El botón "⬇ CSV solo de los nuevos" desde Ver/Editar.');
  console.log('  - Sincronización de agregadoEn con Firebase.');
}
