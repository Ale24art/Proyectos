/* ════════════════════════════════════════════════════════════
   sqlite-schema.js · Equivalente en SQLite de database/schema.sql
   ════════════════════════════════════════════════════════════
   SQLite no entiende ENUM, ENGINE=InnoDB, CHARSET=utf8mb4 ni
   AUTO_INCREMENT (usa INTEGER PRIMARY KEY). Esta es una traducción
   estructural para poder probar el camino Respaldo→SQL→Respaldo
   con el módulo `node:sqlite` (sin instalar nada ni requerir
   credenciales), NO el esquema que se usa en producción — ese es
   siempre database/schema.sql (MySQL 8 / MariaDB).
   ════════════════════════════════════════════════════════════ */
'use strict';

const TABLAS = [
  `CREATE TABLE academias (
    id TEXT PRIMARY KEY, nombre TEXT, subtitulo TEXT, email_dominio TEXT
  )`,
  `CREATE TABLE colegios (
    id TEXT PRIMARY KEY, academia_id TEXT, nombre TEXT, orden INTEGER DEFAULT 0, eliminado_en TEXT
  )`,
  `CREATE TABLE cursos_modelo (
    id TEXT PRIMARY KEY, academia_id TEXT, nombre TEXT, nivel TEXT, orden INTEGER DEFAULT 0, eliminado_en TEXT
  )`,
  `CREATE TABLE asignaciones (
    id TEXT PRIMARY KEY, academia_id TEXT, colegio_id TEXT, curso_id TEXT, anio TEXT, fecha TEXT,
    nombre_completo TEXT, nombre_corto TEXT, clases INTEGER DEFAULT 0, notas TEXT,
    orden INTEGER DEFAULT 0, eliminado_en TEXT
  )`,
  `CREATE TABLE participantes (
    id TEXT PRIMARY KEY, academia_id TEXT, colegio_id TEXT, curso_id TEXT, anio TEXT, nivel TEXT,
    username TEXT, password TEXT, firstname TEXT, lastname TEXT, email TEXT, city TEXT, country TEXT,
    course1 TEXT, group1 TEXT, role1 TEXT, enrolperiod1 TEXT, suspended TEXT,
    nombres TEXT, apellidos TEXT, fecha TEXT,
    eliminado_en TEXT, lote_baja TEXT, tipo_papelera TEXT, orden INTEGER DEFAULT 0
  )`,
  `CREATE TABLE carnet_listas (
    id TEXT PRIMARY KEY, academia_id TEXT, nivel TEXT, grado INTEGER, seccion TEXT, clave TEXT,
    orden INTEGER DEFAULT 0, eliminado_en TEXT
  )`,
  `CREATE TABLE carnet_estudiantes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lista_id TEXT, academia_id TEXT,
    usuario TEXT, apellidos TEXT, nombres TEXT, orden INTEGER DEFAULT 0
  )`,
  `CREATE TABLE carnet_opciones (
    academia_id TEXT PRIMARY KEY, layout TEXT, url TEXT, upper INTEGER DEFAULT 1
  )`
];

const ORDEN_TABLAS = ['academias', 'colegios', 'cursos_modelo', 'asignaciones', 'participantes', 'carnet_listas', 'carnet_estudiantes', 'carnet_opciones'];

function crearEsquema(db) {
  TABLAS.forEach(sql => db.exec(sql));
}

function insertarFilas(db, tabla, filas) {
  if (!filas.length) return;
  const columnas = Object.keys(filas[0]);
  const stmt = db.prepare(`INSERT INTO ${tabla} (${columnas.join(',')}) VALUES (${columnas.map(() => '?').join(',')})`);
  filas.forEach(fila => {
    stmt.run(...columnas.map(c => {
      const v = fila[c];
      if (v === undefined || v === null) return null;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    }));
  });
}

function leerFilas(db, tabla) {
  return db.prepare(`SELECT * FROM ${tabla}`).all();
}

module.exports = { TABLAS, ORDEN_TABLAS, crearEsquema, insertarFilas, leerFilas };
