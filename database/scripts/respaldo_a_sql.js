#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   respaldo_a_sql.js · Respaldo .json (de la app) → SQL
   ════════════════════════════════════════════════════════════
   Uso:
     node respaldo_a_sql.js <respaldo.json> [--sql salida.sql] [--sqlite salida.db]

   Sin --sql ni --sqlite, genera "<respaldo>.sql" al lado del archivo
   de entrada (MySQL 8 / MariaDB, compatible con database/schema.sql).
   --sqlite crea además (o en su lugar) una base SQLite real, útil
   para probar sin necesitar un servidor MySQL ni credenciales —
   node:sqlite viene incluido en Node 22+, no requiere instalar nada.

   No necesita ninguna credencial: lee un archivo local y escribe
   archivos locales.
   ════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { datosAFilas } = require('./mapeo');
const { ORDEN_TABLAS, crearEsquema, insertarFilas } = require('./sqlite-schema');

function uso() {
  console.error('Uso: node respaldo_a_sql.js <respaldo.json> [--sql salida.sql] [--sqlite salida.db]');
  process.exit(1);
}

function escSQL(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function filasAInsert(tabla, filas) {
  if (!filas.length) return '';
  const cols = Object.keys(filas[0]);
  const valores = filas.map(f => '(' + cols.map(c => escSQL(f[c])).join(', ') + ')');
  return `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES\n  ${valores.join(',\n  ')};\n\n`;
}

function generarSQL(payload, filas) {
  const academiaId = payload._academia || 'tecno';
  let sql = `-- Generado por respaldo_a_sql.js a partir de un respaldo de "${academiaId}"\n`;
  sql += `-- Exportado por la app en: ${payload._exportadoEn || '(desconocido)'}\n\n`;
  sql += `INSERT INTO academias (id, nombre) VALUES (${escSQL(academiaId)}, ${escSQL(academiaId)})\n  ON DUPLICATE KEY UPDATE nombre = nombre;\n\n`;
  ORDEN_TABLAS.filter(t => t !== 'academias').forEach(tabla => {
    sql += filasAInsert(tabla, filas[tabla] || []);
  });
  return sql;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) uso();
  const entrada = args[0];
  let salidaSQL = null, salidaSQLite = null;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--sql') salidaSQL = args[++i];
    else if (args[i] === '--sqlite') salidaSQLite = args[++i];
  }
  if (!salidaSQL && !salidaSQLite) {
    salidaSQL = entrada.replace(/\.json$/i, '') + '.sql';
  }

  const payload = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  const filas = datosAFilas(payload);

  if (salidaSQL) {
    fs.writeFileSync(salidaSQL, generarSQL(payload, filas), 'utf8');
    console.log('SQL generado:', path.resolve(salidaSQL));
  }

  if (salidaSQLite) {
    const { DatabaseSync } = require('node:sqlite');
    if (fs.existsSync(salidaSQLite)) fs.unlinkSync(salidaSQLite);
    const db = new DatabaseSync(salidaSQLite);
    crearEsquema(db);
    const academiaId = payload._academia || 'tecno';
    insertarFilas(db, 'academias', [{ id: academiaId, nombre: academiaId, subtitulo: null, email_dominio: null }]);
    ORDEN_TABLAS.filter(t => t !== 'academias').forEach(tabla => insertarFilas(db, tabla, filas[tabla] || []));
    db.close();
    console.log('SQLite generado:', path.resolve(salidaSQLite));
  }
}

if (require.main === module) main();
module.exports = { generarSQL };
