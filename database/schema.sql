-- ════════════════════════════════════════════════════════════
-- schema.sql · Organizador Moodle — base de datos portable
-- Compatible con MySQL 8 / MariaDB (la familia que usa Moodle).
-- Para adaptarlo a PostgreSQL, ver las notas en database/README.md.
--
-- Este esquema modela los mismos datos que hoy vive en `data` dentro
-- del localStorage de la app (ver nueva documentacion.md §4.1) y en
-- Firestore (ver sync-firebase.js). NO modela conceptos exclusivos
-- de la capa de sincronización en la nube (_rev, tombstones, línea
-- base) — esos son responsabilidad de la capa de sync que se elija
-- en un futuro servidor propio (ver MIGRACION_A_SERVIDOR_PROPIO.md).
-- ════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── academias ──────────────────────────────────────────────────
CREATE TABLE academias (
  id              VARCHAR(32)  NOT NULL PRIMARY KEY,   -- 'tecno', 'cleveland', futuras academias
  nombre          VARCHAR(128) NOT NULL,
  subtitulo       VARCHAR(128),
  email_dominio   VARCHAR(128),
  creado_en       DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── usuarios_app (accesos a la app, NO los códigos en claro) ───
-- Hoy el acceso es un código corto verificado en el cliente
-- (login.html). Esta tabla es para un futuro backend propio con
-- login real contra un servidor: el código NUNCA se guarda en claro.
-- codigo_hash usa bcrypt o argon2 (nunca SHA-256 sin sal: un hash
-- rápido sin sal es trivialmente atacable por fuerza bruta/diccionario
-- contra códigos cortos como los actuales).
CREATE TABLE usuarios_app (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(128) NOT NULL,
  codigo_hash     VARCHAR(255) NOT NULL,   -- bcrypt ($2b$...) o argon2 (argon2id$...)
  activo          TINYINT(1)   DEFAULT 1,
  creado_en       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  ultima_sesion   DATETIME,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── colegios ─────────────────────────────────────────────────────
CREATE TABLE colegios (
  id              VARCHAR(24)  NOT NULL PRIMARY KEY,  -- mismo id que genera uid() en la app
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256) NOT NULL,
  orden           INT UNSIGNED DEFAULT 0,             -- preserva el orden del arreglo original (_orden)
  eliminado_en    DATETIME     DEFAULT NULL,          -- NULL = activo; no NULL = en Papelera
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── cursos_modelo ────────────────────────────────────────────────
CREATE TABLE cursos_modelo (
  id              VARCHAR(24)  NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256) NOT NULL,
  nivel           ENUM('media','primaria') NOT NULL,
  orden           INT UNSIGNED DEFAULT 0,
  eliminado_en    DATETIME     DEFAULT NULL,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── asignaciones (un curso modelo copiado a un colegio) ─────────
CREATE TABLE asignaciones (
  id              VARCHAR(24)  NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24)  NOT NULL REFERENCES colegios(id),
  curso_id        VARCHAR(24)  NOT NULL REFERENCES cursos_modelo(id),
  anio            VARCHAR(32),
  fecha           DATE,
  nombre_completo VARCHAR(256),
  nombre_corto    VARCHAR(128),
  clases          INT UNSIGNED DEFAULT 0,
  notas           TEXT,
  orden           INT UNSIGNED DEFAULT 0,
  eliminado_en    DATETIME     DEFAULT NULL,
  INDEX idx_colegio (colegio_id),
  INDEX idx_curso (curso_id),
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── participantes ────────────────────────────────────────────────
-- Las columnas username..suspended usan EXACTAMENTE los nombres que
-- Moodle espera en su CSV de carga masiva de usuarios. `firstname`
-- reproduce la convención ya usada por generarListaUsuarios() en
-- script.js: "<username> <nombres>" (el usuario antepuesto al nombre).
--
-- NO se impone UNIQUE sobre `username`: la app hoy permite duplicados
-- si la persona edita el usuario a mano en la vista previa sin pasar
-- por el pool de numeración (ver §6.1 de la documentación). Forzar
-- unicidad aquí rompería una importación real con datos existentes;
-- ver database/README.md para una guía de limpieza antes de endurecer
-- esta restricción si se decide hacerlo más adelante.
CREATE TABLE participantes (
  id              VARCHAR(24)  NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24),
  curso_id        VARCHAR(24),
  anio            VARCHAR(32),
  nivel           ENUM('media','primaria'),

  -- Columnas de la carga masiva de Moodle (nombres exactos del CSV):
  username        VARCHAR(128),
  password        VARCHAR(128),
  firstname       VARCHAR(256),   -- "<username> <nombres>"
  lastname        VARCHAR(256),   -- apellidos
  email           VARCHAR(256),
  city            VARCHAR(128),
  country         VARCHAR(128),
  course1         VARCHAR(256),
  group1          VARCHAR(128),
  role1           VARCHAR(32)  DEFAULT 'student',
  enrolperiod1    VARCHAR(16)  DEFAULT '365d',
  suspended       CHAR(1)      DEFAULT '0',

  -- Campos propios de la app (no van al CSV de Moodle):
  nombres         VARCHAR(256),   -- nombres sin el username antepuesto
  apellidos       VARCHAR(256),
  fecha           DATE,

  -- Papelera: la app distingue dos formas de eliminar un participante
  -- (ver nueva documentacion.md §4.1): como parte de una LISTA completa
  -- (trash.participantes) o de forma INDIVIDUAL desde Ver/Editar
  -- (trash.estudiantes). `tipo_papelera` guarda cuál de las dos fue,
  -- y `lote_baja` es el id del "lote" de baja (el id que tenía la
  -- entrada de papelera original) — agrupa varias filas cuando
  -- tipo_papelera='lote', o identifica una baja individual cuando
  -- tipo_papelera='individual'. Ambos NULL = participante activo.
  eliminado_en    DATETIME     DEFAULT NULL,
  lote_baja       VARCHAR(24)  DEFAULT NULL,
  tipo_papelera   ENUM('lote','individual') DEFAULT NULL,
  orden           INT UNSIGNED DEFAULT 0,

  INDEX idx_colegio_curso_anio (colegio_id, curso_id, anio),
  INDEX idx_username (username),
  INDEX idx_academia (academia_id),
  INDEX idx_lote_baja (lote_baja)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── carnet_listas (Modo 1 del Generador de carnets) ─────────────
CREATE TABLE carnet_listas (
  id              VARCHAR(24)  NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  nivel           ENUM('media','primaria') NOT NULL,
  grado           TINYINT UNSIGNED NOT NULL,
  seccion         VARCHAR(8),
  clave           VARCHAR(64)  NOT NULL,
  orden           INT UNSIGNED DEFAULT 0,
  eliminado_en    DATETIME     DEFAULT NULL,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── carnet_estudiantes (filas de una carnet_lista) ──────────────
CREATE TABLE carnet_estudiantes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lista_id        VARCHAR(24)  NOT NULL REFERENCES carnet_listas(id),
  academia_id     VARCHAR(32)  NOT NULL REFERENCES academias(id),
  usuario         VARCHAR(128),
  apellidos       VARCHAR(256),
  nombres         VARCHAR(256),
  orden           INT UNSIGNED DEFAULT 0,
  INDEX idx_lista (lista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── carnet_opciones (una fila por academia) ─────────────────────
CREATE TABLE carnet_opciones (
  academia_id     VARCHAR(32)  NOT NULL PRIMARY KEY REFERENCES academias(id),
  layout          VARCHAR(16)  DEFAULT 'big',
  url             VARCHAR(256),
  upper           TINYINT(1)   DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Vista lista para exportar el CSV de carga masiva de Moodle ──
CREATE VIEW v_moodle_upload AS
SELECT
  username, password, firstname, lastname, email,
  city, country, course1, group1, role1, enrolperiod1, suspended
FROM participantes
WHERE eliminado_en IS NULL;
