#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   sql_a_respaldo.js · SQL (SQLite) → Respaldo .json (de la app)
   ════════════════════════════════════════════════════════════
   Uso:
     node sql_a_respaldo.js --sqlite archivo.db --academia tecno [--salida respaldo.json] [--autor "Nombre"]

   Camino inverso de respaldo_a_sql.js. El resultado es un archivo
   .json que la app puede importar directamente con "Importar
   respaldo" en la vista Respaldo — ver §C.1 de la documentación
   para el formato exacto (_versionEsquema, _resumen, etc.).

   Para generar el .json a partir de un MySQL/MariaDB real en vez de
   SQLite, hay que adaptar `leerDesdeSQLite()` para usar un cliente
   MySQL (p. ej. `mysql2`) — no incluido aquí para no requerir
   credenciales ni dependencias nuevas en este repo.
   ════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { filasADatos } = require('./mapeo');
const { ORDEN_TABLAS, crearEsquema, leerFilas } = require('./sqlite-schema');

const VERSION_ESQUEMA = 1;

function uso() {
  console.error('Uso: node sql_a_respaldo.js --sqlite archivo.db --academia <id> [--salida respaldo.json] [--autor "Nombre"]');
  process.exit(1);
}

function leerDesdeSQLite(archivo, academiaId) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(archivo, { readOnly: true });
  const filas = {};
  ORDEN_TABLAS.filter(t => t !== 'academias').forEach(tabla => {
    filas[tabla] = leerFilas(db, tabla).filter(f => f.academia_id === academiaId);
  });
  db.close();
  return filas;
}

function resumenDe(d) {
  const t = d.trash;
  return {
    colegios: d.colegios.length, cursos: d.cursos.length, asignaciones: d.asignaciones.length,
    participantes: d.participantes.length, carnetListas: d.carnetListas.length,
    itemsEnPapelera: t.colegios.length + t.cursos.length + t.asignaciones.length + t.participantes.length + t.estudiantes.length + t.carnetListas.length
  };
}

function main() {
  const args = process.argv.slice(2);
  let sqlite = null, academiaId = null, salida = null, autor = 'database/scripts';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sqlite') sqlite = args[++i];
    else if (args[i] === '--academia') academiaId = args[++i];
    else if (args[i] === '--salida') salida = args[++i];
    else if (args[i] === '--autor') autor = args[++i];
  }
  if (!sqlite || !academiaId) uso();
  if (!salida) salida = `respaldo_${academiaId}_${new Date().toISOString().slice(0, 10)}.json`;

  const filas = leerDesdeSQLite(sqlite, academiaId);
  const d = filasADatos(filas, academiaId);
  const payload = {
    ...d,
    _academia: academiaId,
    _versionEsquema: VERSION_ESQUEMA,
    _exportadoEn: new Date().toISOString(),
    _exportadoPor: autor,
    _resumen: resumenDe(d)
  };
  fs.writeFileSync(salida, JSON.stringify(payload), 'utf8');
  console.log('Respaldo generado:', path.resolve(salida));
}

if (require.main === module) main();
module.exports = { leerDesdeSQLite };
