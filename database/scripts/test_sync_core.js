/* ════════════════════════════════════════════════════════════
   test_sync_core.js · Pruebas unitarias de Organizador_moodle/sync-core.js
   ════════════════════════════════════════════════════════════
   Cubre casos que test_sync_dos_dispositivos.js no ejercita
   directamente: diff inicial, distinción traslado-a-papelera vs.
   borrado real (tombstone), y conflicto real (misma entidad editada
   en dos dispositivos) con resolución last-write-wins.
   Uso: node test_sync_core.js
   ════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');
const SyncCore = require(path.join(__dirname, '..', '..', 'Organizador_moodle', 'sync-core.js'));

function dataBase() {
  return {
    colegios: [{ id: 'c1', nombre: 'Colegio A' }, { id: 'c2', nombre: 'Colegio B' }],
    cursos: [{ id: 'k1', nombre: 'Robotica 1', nivel: 'media' }],
    asignaciones: [{ id: 'a1', colegioId: 'c1', cursoId: 'k1', anio: '1er Año', fecha: '2026-01-01', nombreCompleto: '1er Año-CA', nombreCorto: '1styear-ca', clases: 5, notas: '' }],
    participantes: [
      { id: 'p1', colegioId: 'c1', cursoId: 'k1', anio: '1er Año', nivel: 'media', username: 'ca0001', password: '1234', nombres: 'Juan', apellidos: 'Perez', email: 'ca0001@tecno.com', city: '', country: 'Venezuela', course1: '1styear-ca', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' },
      { id: 'p2', colegioId: 'c1', cursoId: 'k1', anio: '1er Año', nivel: 'media', username: 'ca0002', password: '1234', nombres: 'Ana', apellidos: 'Gomez', email: 'ca0002@tecno.com', city: '', country: 'Venezuela', course1: '1styear-ca', group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: '2026-01-01' }
    ],
    carnetListas: [],
    carnetOpciones: { layout: 'big', url: 'x.com', upper: true },
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] }
  };
}

// 1) round-trip: data -> entidades -> datos debe ser equivalente (ignorando orden de claves)
let data = dataBase();
let ent = SyncCore.construirIndiceLocal(data);
let reconstruido = SyncCore.entidadesADatos(ent);
assert.deepStrictEqual(reconstruido.colegios, data.colegios, 'colegios round-trip');
assert.deepStrictEqual(reconstruido.participantes, data.participantes, 'participantes round-trip (orden incluido)');
console.log('OK: round-trip básico');

// 2) diff: sin baseline, todo es "cambio"
let baseline = {};
let diff1 = SyncCore.calcularDiff(ent, baseline);
assert.strictEqual(diff1.cambios.length, ent.length, 'todo debe subir la primera vez');
assert.strictEqual(diff1.eliminados.length, 0);
console.log('OK: diff inicial (todo nuevo)');

baseline = SyncCore.construirBaseline(ent);

// 3) simular dispositivo A: borra el colegio c2 (sin participantes asociados)
let dataA = dataBase();
dataA.colegios = dataA.colegios.filter(c => c.id !== 'c2'); // borrado permanente directo (sin pasar por trash) para simular permaDelete tras mover+vaciar
let entA = SyncCore.construirIndiceLocal(dataA);
let diffA = SyncCore.calcularDiff(entA, baseline);
assert.strictEqual(diffA.eliminados.length, 1);
assert.strictEqual(diffA.eliminados[0].docId, 'c2');
let tombstonesA = SyncCore.calcularTombstonesNuevos(diffA.eliminados, entA);
assert.strictEqual(tombstonesA.length, 1, 'c2 desaparecio sin pasar a trash_colegios -> debe tombstonarse');
console.log('OK: borrado permanente genera tombstone');

// 4) simular traslado a papelera (no debe tombstonarse)
let dataA2 = dataBase();
const removed = dataA2.colegios.pop(); // c2
dataA2.trash.colegios.push(removed);
let entA2 = SyncCore.construirIndiceLocal(dataA2);
let diffA2 = SyncCore.calcularDiff(entA2, baseline);
let tombstonesA2 = SyncCore.calcularTombstonesNuevos(diffA2.eliminados, entA2);
assert.strictEqual(tombstonesA2.length, 0, 'traslado a papelera NO debe generar tombstone');
console.log('OK: traslado a papelera no genera tombstone falso');

// 5) Escenario pedido: A borra (c2 a papelera), B edita otra cosa (c1) y sincroniza.
//    B no debe perder su edición, y debe recibir el borrado de A.
let entidadesRemotasTrasA = entA2; // lo que A subió
let tombstonesRemotos = new Set(); // A hizo un traslado, no un borrado real -> sin tombstones

let dataB = dataBase();
dataB.colegios.find(c => c.id === 'c1').nombre = 'Colegio A (editado por B)';
let entB = SyncCore.construirIndiceLocal(dataB);

let fusion = SyncCore.fusionarEntidades(entB, baseline, entidadesRemotasTrasA, tombstonesRemotos);
let datosFusion = SyncCore.entidadesADatos(fusion.entidades);
assert.strictEqual(datosFusion.colegios.find(c => c.id === 'c1').nombre, 'Colegio A (editado por B)', 'la edicion de B se conserva');
assert.strictEqual(datosFusion.colegios.some(c => c.id === 'c2'), false, 'c2 ya no esta activo (se fue a la papelera via A)');
assert.strictEqual(datosFusion.trash.colegios.length, 1, 'c2 debe aparecer en la papelera de B tras fusionar');
assert.strictEqual(fusion.sobrescritos.length, 0, 'no hay conflicto real (entidades distintas)');
console.log('OK: escenario A borra / B edita otra cosa y sincroniza');

// 6) Escenario: ambos dispositivos editan LA MISMA entidad -> gana remoto, se reporta
let dataA3 = dataBase();
dataA3.colegios.find(c => c.id === 'c1').nombre = 'Nombre de A';
let entA3 = SyncCore.construirIndiceLocal(dataA3);

let dataB3 = dataBase();
dataB3.colegios.find(c => c.id === 'c1').nombre = 'Nombre de B';
let entB3 = SyncCore.construirIndiceLocal(dataB3);

let fusion3 = SyncCore.fusionarEntidades(entB3, baseline, entA3, new Set());
let datos3 = SyncCore.entidadesADatos(fusion3.entidades);
assert.strictEqual(datos3.colegios.find(c => c.id === 'c1').nombre, 'Nombre de A', 'last-write-wins: gana el remoto ya confirmado');
assert.strictEqual(fusion3.sobrescritos.length, 1);
console.log('OK: conflicto real resuelto last-write-wins + reportado');

// 7) Offline -> online: cola de cambios locales se sube integra cuando regresa la conexion
//    (simulado como: varias ediciones seguidas sin "subir", luego una sola subida)
let dataOffline = dataBase();
dataOffline.colegios.push({ id: 'c3', nombre: 'Nuevo sin conexion' });
dataOffline.asignaciones[0].clases = 9;
let entOffline = SyncCore.construirIndiceLocal(dataOffline);
let diffOffline = SyncCore.calcularDiff(entOffline, baseline);
assert.ok(diffOffline.cambios.some(c => c.docId === 'c3'));
assert.ok(diffOffline.cambios.some(c => c.docId === 'a1'));
console.log('OK: diff tras reconexion incluye todos los cambios acumulados offline');

console.log('\nTODOS LOS SMOKE TESTS DE sync-core.js PASARON');
