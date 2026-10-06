#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   test_sync_dos_dispositivos.js · Simulación de sincronización
   entre dos dispositivos (ajuste (d) de la instrucción de Fase 2)
   ════════════════════════════════════════════════════════════
   Usa Organizador_moodle/sync-core.js (lógica pura, sin DOM ni
   Firebase — ver ese archivo) contra una "nube" falsa en memoria
   que imita el contrato que sync-firebase.js expone a sync.js:
   colecciones por documento, tombstones, y un `_rev` que se
   incrementa en cada escritura.

   Escenarios obligatorios:
   1) Dispositivo A borra algo (lo manda a la papelera) y sincroniza.
      Dispositivo B edita otra cosa (sin relación) y sincroniza.
      B no debe perder su edición y debe recibir el borrado de A.
   2) Sin conexión → con conexión: un dispositivo acumula varios
      cambios mientras "no hay red" y, al reconectar, todos se suben
      juntos sin perder ninguno.

   Uso: node test_sync_dos_dispositivos.js
   ════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');
const SyncCore = require(path.join(__dirname, '..', '..', 'Organizador_moodle', 'sync-core.js'));

/* ── "Nube" falsa en memoria: mismo contrato que expone sync-firebase.js ── */
function crearNubeFalsa() {
  const colecciones = {}; // { coleccion: { docId: datosConMeta } }
  const tombstones = new Set(); // "coleccion/docId"
  let rev = 0;

  function leerRevRaiz() { return rev === 0 && Object.keys(colecciones).length === 0 ? null : rev; }

  function leerTodasLasColecciones() {
    const coleccionesRemotas = {};
    Object.keys(colecciones).forEach(col => {
      coleccionesRemotas[col] = Object.keys(colecciones[col]).map(docId => {
        const meta = colecciones[col][docId];
        const clave = (col === 'listas_part' || col === 'trash_listas_part')
          ? { colegioId: meta.datos.colegioId, cursoId: meta.datos.cursoId, anio: meta.datos.anio, grupo: meta.datos.grupo || '' }
          : { id: docId };
        return { coleccion: col, docId, datos: meta.datos, orden: meta.orden, clave };
      });
    });
    return { coleccionesRemotas, tombstones: new Set(tombstones), rev };
  }

  function escribirLote({ cambios, eliminados, tombstonesNuevos }) {
    cambios.forEach(c => {
      colecciones[c.coleccion] = colecciones[c.coleccion] || {};
      colecciones[c.coleccion][c.docId] = { datos: c.datos, orden: c.orden };
    });
    eliminados.forEach(e => {
      if (colecciones[e.coleccion]) delete colecciones[e.coleccion][e.docId];
    });
    tombstonesNuevos.forEach(t => tombstones.add(t.coleccion + '/' + t.docId));
    rev++;
  }

  return { leerRevRaiz, leerTodasLasColecciones, escribirLote, _debugRev: () => rev };
}

/* ── Un "dispositivo": mantiene su propio `data`, su propia línea base, y sabe
   subir (diff contra su baseline) y bajar (fusionar con lo remoto). ── */
function crearDispositivo(dataInicial) {
  let data = dataInicial;
  let baseline = {};
  return {
    get data() { return data; },
    editar(fn) { fn(data); },
    subir(nube) {
      const entidadesActuales = SyncCore.construirIndiceLocal(data);
      const { cambios, eliminados } = SyncCore.calcularDiff(entidadesActuales, baseline);
      if (!cambios.length && !eliminados.length) return { subido: false };
      const tombstonesNuevos = SyncCore.calcularTombstonesNuevos(eliminados, entidadesActuales);
      nube.escribirLote({ cambios, eliminados, tombstonesNuevos, autor: 'test' });
      baseline = SyncCore.construirBaseline(entidadesActuales);
      return { subido: true, cambios: cambios.length, eliminados: eliminados.length };
    },
    bajar(nube) {
      const { coleccionesRemotas, tombstones } = nube.leerTodasLasColecciones();
      const entidadesRemotas = [];
      Object.keys(coleccionesRemotas).forEach(col => entidadesRemotas.push(...coleccionesRemotas[col]));
      const entidadesLocales = SyncCore.construirIndiceLocal(data);
      const { entidades, sobrescritos } = SyncCore.fusionarEntidades(entidadesLocales, baseline, entidadesRemotas, tombstones);
      data = SyncCore.entidadesADatos(entidades);
      baseline = SyncCore.construirBaseline(entidades);
      return { sobrescritos };
    }
  };
}

function dataBase() {
  return {
    colegios: [{ id: 'c1', nombre: 'Colegio Uno' }, { id: 'c2', nombre: 'Colegio Dos' }],
    cursos: [{ id: 'k1', nombre: 'Curso Uno', nivel: 'media' }],
    asignaciones: [{ id: 'a1', colegioId: 'c1', cursoId: 'k1', anio: '1er Año', fecha: '2026-01-01', nombreCompleto: '1er Año-CU', nombreCorto: '1styear-cu', clases: 5, notas: '' }],
    participantes: [
      { id: 'p1', colegioId: 'c1', cursoId: 'k1', anio: '1er Año', nivel: 'media', username: 'cu0001', password: '1234', nombres: 'Uno', apellidos: 'Apellido', email: 'cu0001@x.com', city: '', country: 'Venezuela', course1: '1styear-cu', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
    ],
    carnetListas: [],
    carnetOpciones: { layout: 'big', url: 'x.com', upper: true },
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] }
  };
}

/* ── Escenario 1: A borra algo, B edita otra cosa y ambos sincronizan ── */
function escenario1() {
  const nube = crearNubeFalsa();
  const A = crearDispositivo(dataBase());
  const B = crearDispositivo(dataBase());

  // Ambos arrancan vacíos en la nube: A sube primero su estado inicial (equivale
  // a la migración inicial de §3.3.2), luego B lo descarga para tener la misma
  // línea base que A antes de que cada uno haga su cambio independiente.
  A.subir(nube);
  B.bajar(nube);

  // A borra el colegio "Colegio Dos" (lo manda a la papelera) y sincroniza.
  A.editar(d => {
    const idx = d.colegios.findIndex(c => c.id === 'c2');
    const [removido] = d.colegios.splice(idx, 1);
    d.trash.colegios.push(removido);
  });
  A.subir(nube);

  // B, SIN haber bajado el cambio de A todavía, edita algo sin relación.
  B.editar(d => { d.asignaciones[0].clases = 12; });
  const resultadoSubidaB = B.subir(nube);
  assert.ok(resultadoSubidaB.subido, 'B debe poder subir su cambio aunque no haya bajado el de A');

  // B baja y debe quedar con AMBOS cambios: su propia edición Y el borrado de A.
  const { sobrescritos } = B.bajar(nube);
  assert.strictEqual(sobrescritos.length, 0, 'no hay conflicto real: son entidades distintas');
  assert.strictEqual(B.data.asignaciones[0].clases, 12, 'B conserva su propia edición');
  assert.strictEqual(B.data.colegios.some(c => c.id === 'c2'), false, 'B recibe el borrado de A (ya no está activo)');
  assert.strictEqual(B.data.trash.colegios.length, 1, 'B recibe "Colegio Dos" en su papelera');

  // A también debe terminar viendo la edición de B al bajar.
  A.bajar(nube);
  assert.strictEqual(A.data.asignaciones[0].clases, 12, 'A recibe la edición de B');

  console.log('OK [escenario 1] A borra (papelera) / B edita otra cosa — ambos cambios se preservan');
}

/* ── Escenario 2: sin conexión -> con conexión ── */
function escenario2() {
  const nube = crearNubeFalsa();
  const A = crearDispositivo(dataBase());
  A.subir(nube); // línea base inicial

  // "Sin conexión": varios cambios seguidos, ninguno se sube todavía.
  A.editar(d => { d.colegios.push({ id: 'c3', nombre: 'Colegio Agregado Offline' }); });
  A.editar(d => { d.asignaciones[0].notas = 'Editado sin conexión'; });
  A.editar(d => { d.participantes[0].city = 'Ciudad Offline'; });

  // "Con conexión": una sola subida debe llevarse TODOS los cambios acumulados.
  const resultado = A.subir(nube);
  assert.ok(resultado.subido);
  assert.strictEqual(resultado.cambios, 3, 'los 3 cambios offline se suben juntos (colegio nuevo + 2 ediciones)');

  const B = crearDispositivo(dataBase());
  B.bajar(nube);
  assert.ok(B.data.colegios.some(c => c.id === 'c3'), 'otro dispositivo ve el colegio agregado sin conexión');
  assert.strictEqual(B.data.asignaciones[0].notas, 'Editado sin conexión');
  assert.strictEqual(B.data.participantes[0].city, 'Ciudad Offline');

  console.log('OK [escenario 2] sin conexión → con conexión: todos los cambios acumulados llegan juntos');
}

escenario1();
escenario2();
console.log('\nTODAS LAS PRUEBAS DE SINCRONIZACIÓN ENTRE DOS DISPOSITIVOS PASARON');
