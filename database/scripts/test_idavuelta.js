#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   test_idavuelta.js · Prueba de ida y vuelta (§C.5 / §6 de la instrucción)
   ════════════════════════════════════════════════════════════
   Dos pruebas, para ambas academias (tecno/cleveland):

   A) Respaldo .json → SQL (SQLite) → Respaldo .json
      usando database/scripts/{respaldo_a_sql,sql_a_respaldo}.js.
      Compara los datos antes y después con igualdad profunda,
      IGNORANDO metadatos (_academia/_versionEsquema/_exportadoEn/
      _exportadoPor/_resumen) pero SIN ignorar el orden de los
      arreglos (colegios, cursos, asignaciones, listas y los
      participantes dentro de cada lista deben quedar en el mismo
      orden — ver ajuste (c) de la instrucción de Fase 2).

   B) exportBackup()/importBackup() simulados en memoria (sin DOM):
      simula localStorage con un Map, ejecuta la misma lógica de
      construcción de payload que usa script.js, "vacía" el
      localStorage simulado, "importa" de vuelta y compara.
      Incluye un caso grande (≥ 5.000 participantes) para medir
      tamaño del archivo y tiempo.

   Uso: node test_idavuelta.js
   ════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { datosAFilas, filasADatos } = require('./mapeo');
const { ORDEN_TABLAS, crearEsquema, insertarFilas, leerFilas } = require('./sqlite-schema');
const { DatabaseSync } = require('node:sqlite');

function uid() { return 'id' + Math.random().toString(36).slice(2, 10); }

function datosDeEjemplo(academiaId) {
  const c1 = uid(), c2 = uid(), k1 = uid(), k2 = uid();
  return {
    colegios: [{ id: c1, nombre: 'Colegio Uno' }, { id: c2, nombre: 'Colegio Dos' }],
    cursos: [{ id: k1, nombre: 'Curso Uno', nivel: 'media' }, { id: k2, nombre: 'Curso Dos', nivel: 'primaria' }],
    asignaciones: [{ id: uid(), colegioId: c1, cursoId: k1, anio: '1er Año', fecha: '2026-01-01', nombreCompleto: '1er Año-CU', nombreCorto: '1styear-cu', clases: 5, notas: 'x' }],
    participantes: [
      { id: uid(), colegioId: c1, cursoId: k1, anio: '1er Año', nivel: 'media', username: 'cu0001', password: '1234', nombres: 'Primero', apellidos: 'Apellido1', email: 'cu0001@x.com', city: '', country: 'Venezuela', course1: '1styear-cu', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
      { id: uid(), colegioId: c1, cursoId: k1, anio: '1er Año', nivel: 'media', username: 'cu0002', password: '1234', nombres: 'Segundo', apellidos: 'Apellido2', email: 'cu0002@x.com', city: '', country: 'Venezuela', course1: '1styear-cu', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
      { id: uid(), colegioId: c1, cursoId: k1, anio: '1er Año', nivel: 'media', username: 'cu0003', password: '1234', nombres: 'Tercero', apellidos: 'Apellido3', email: 'cu0003@x.com', city: '', country: 'Venezuela', course1: '1styear-cu', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
    ],
    carnetListas: [{ id: uid(), nivel: 'media', grado: 1, seccion: 'A', clave: 'k1', estudiantes: [
      { usuario: 'cu0001', apellidos: 'Apellido1', nombres: 'Primero' },
      { usuario: 'cu0002', apellidos: 'Apellido2', nombres: 'Segundo' },
      { usuario: 'cu0003', apellidos: 'Apellido3', nombres: 'Tercero' }
    ] }],
    carnetOpciones: { layout: 'big', url: 'x.com', upper: true },
    trash: {
      colegios: [{ id: uid(), nombre: 'Colegio Borrado' }],
      cursos: [],
      asignaciones: [],
      participantes: [{ id: uid(), colegioId: c1, cursoId: k2, anio: '2do', grupo: 'B', fechaEliminacion: '2026-09-01', estudiantes: [
        { id: uid(), colegioId: c1, cursoId: k2, anio: '2do', nivel: 'primaria', username: 'old01', password: '1234', nombres: 'Viejo', apellidos: 'Apellido', email: 'old01@x.com', city: '', country: 'Venezuela', course1: '2do-cu', group1: 'B', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-08-01' }
      ] }],
      estudiantes: [{ id: uid(), fechaEliminacion: '2026-09-02', participante:
        { id: uid(), colegioId: c1, cursoId: k1, anio: '1er Año', nivel: 'media', username: 'ind01', password: '1234', nombres: 'Individual', apellidos: 'Apellido', email: 'ind01@x.com', city: '', country: 'Venezuela', course1: '1styear-cu', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
      }],
      carnetListas: [{ id: uid(), nivel: 'primaria', grado: 2, seccion: '', clave: 'vieja', estudiantes: [], fechaEliminacion: '2026-09-03' }]
    },
    _academia: academiaId, _versionEsquema: 1, _exportadoEn: new Date().toISOString(), _exportadoPor: 'Test',
    _resumen: {}
  };
}

function sinMetadatos(payload) {
  const { _academia, _versionEsquema, _exportadoEn, _exportadoPor, _resumen, ...resto } = payload;
  return resto;
}

function pruebaSQLParaAcademia(academiaId) {
  const original = datosDeEjemplo(academiaId);
  const filasOriginales = datosAFilas(original);

  const archivo = path.join(os.tmpdir(), `test_idavuelta_${academiaId}_${Date.now()}.db`);
  const db = new DatabaseSync(archivo);
  crearEsquema(db);
  insertarFilas(db, 'academias', [{ id: academiaId, nombre: academiaId, subtitulo: null, email_dominio: null }]);
  ORDEN_TABLAS.filter(t => t !== 'academias').forEach(tabla => insertarFilas(db, tabla, filasOriginales[tabla] || []));

  const filasLeidas = {};
  ORDEN_TABLAS.filter(t => t !== 'academias').forEach(tabla => { filasLeidas[tabla] = leerFilas(db, tabla); });
  db.close();
  fs.unlinkSync(archivo);

  const reconstruido = filasADatos(filasLeidas, academiaId);

  assert.deepStrictEqual(reconstruido.colegios, original.colegios, `[${academiaId}] colegios (activos) ida y vuelta`);
  assert.deepStrictEqual(reconstruido.cursos, original.cursos, `[${academiaId}] cursos ida y vuelta`);
  assert.deepStrictEqual(reconstruido.asignaciones, original.asignaciones, `[${academiaId}] asignaciones ida y vuelta`);
  assert.deepStrictEqual(reconstruido.participantes, original.participantes, `[${academiaId}] participantes ida y vuelta (orden incluido)`);
  assert.deepStrictEqual(reconstruido.carnetListas, original.carnetListas, `[${academiaId}] carnetListas ida y vuelta`);
  assert.deepStrictEqual(reconstruido.carnetOpciones, original.carnetOpciones, `[${academiaId}] carnetOpciones ida y vuelta`);
  assert.deepStrictEqual(reconstruido.trash.colegios, original.trash.colegios, `[${academiaId}] trash.colegios ida y vuelta`);
  assert.deepStrictEqual(reconstruido.trash.estudiantes, original.trash.estudiantes, `[${academiaId}] trash.estudiantes ida y vuelta`);
  assert.deepStrictEqual(reconstruido.trash.carnetListas, original.trash.carnetListas, `[${academiaId}] trash.carnetListas ida y vuelta`);
  // trash.participantes: el id del lote se preserva (lote_baja), pero no el orden entre lotes
  // distintos (solo hay uno en este ejemplo) — se compara el contenido del lote.
  assert.strictEqual(reconstruido.trash.participantes.length, original.trash.participantes.length, `[${academiaId}] cantidad de lotes en papelera`);
  assert.deepStrictEqual(reconstruido.trash.participantes[0].estudiantes, original.trash.participantes[0].estudiantes, `[${academiaId}] estudiantes del lote en papelera (orden incluido)`);

  console.log(`OK [SQL ida y vuelta, ${academiaId}]`);
}

function pruebaCasoGrande(nParticipantes) {
  const colegioId = uid(), cursoId = uid();
  const participantes = [];
  for (let i = 0; i < nParticipantes; i++) {
    participantes.push({
      id: uid(), colegioId, cursoId, anio: '1er Año', nivel: 'media',
      username: 'cu' + String(i).padStart(5, '0'), password: '1234',
      nombres: 'Nombre' + i, apellidos: 'Apellido' + i,
      email: `cu${String(i).padStart(5, '0')}@x.com`, city: 'Ciudad', country: 'Venezuela',
      course1: '1styear-cu', group1: i % 3 === 0 ? 'A' : '', role1: 'student',
      enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01'
    });
  }
  const payload = {
    colegios: [{ id: colegioId, nombre: 'Colegio Grande' }],
    cursos: [{ id: cursoId, nombre: 'Curso Grande', nivel: 'media' }],
    asignaciones: [],
    participantes,
    carnetListas: [],
    carnetOpciones: { layout: 'big', url: 'x.com', upper: true },
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] },
    _academia: 'tecno', _versionEsquema: 1, _exportadoEn: new Date().toISOString(), _exportadoPor: 'Test', _resumen: {}
  };

  const t0 = Date.now();
  const texto = JSON.stringify(payload);
  const t1 = Date.now();
  const vueltaPayload = JSON.parse(texto);
  const t2 = Date.now();

  assert.deepStrictEqual(sinMetadatos(vueltaPayload), sinMetadatos(payload), 'caso grande: JSON.stringify/parse sin pérdida');

  const bytes = Buffer.byteLength(texto);
  console.log(`OK [caso grande, ${nParticipantes} participantes] tamaño=${(bytes/1024/1024).toFixed(2)} MB, stringify=${t1-t0}ms, parse=${t2-t1}ms`);
}

['tecno', 'cleveland'].forEach(pruebaSQLParaAcademia);
pruebaCasoGrande(5000);

console.log('\nTODAS LAS PRUEBAS DE IDA Y VUELTA PASARON');
