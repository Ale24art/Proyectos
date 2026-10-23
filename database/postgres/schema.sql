-- ══════════════════════════════════════════════════════════════════
-- ESQUEMA POSTGRESQL v2.6 — Sistema de control de estudio
-- Objetivo: PostgreSQL 15+
-- Para probar localmente sin instalar PostgreSQL:
--   docker run --rm --name pg_test \
--     -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres:16
--   psql -h localhost -U postgres -c "CREATE DATABASE control_estudio;"
--   psql -h localhost -U postgres -d control_estudio -f database/postgres/schema.sql
--   psql -h localhost -U postgres -d control_estudio \
--     -f database/postgres/tests/test_integridad.sql
--   docker stop pg_test
-- ══════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════
-- TIPOS ENUM
-- tipo_modulo se eliminó: ahora es TEXT con el modname de Moodle
-- (h5pactivity, quiz, assign, forum, resource, label, url, page, …)
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE rol_usuario   AS ENUM ('admin', 'asesor', 'gerente');
CREATE TYPE nivel_curso   AS ENUM ('media', 'primaria');
CREATE TYPE tipo_papelera AS ENUM ('lote', 'individual');
CREATE TYPE estado_sync   AS ENUM ('en_progreso', 'completado', 'error');
CREATE TYPE operacion_auditoria AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE tipo_cuarentena AS ENUM ('huerfano_sin_asig', 'course1_divergente', 'username_duplicado', 'otro');

-- ══════════════════════════════════════════════════════════════════
-- NÚCLEO: academias, usuarios, roles, permisos, sesiones
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE academias (
  id            TEXT        NOT NULL,
  nombre        TEXT        NOT NULL,
  subtitulo     TEXT,
  email_dominio TEXT,
  moodle_url    TEXT,
  activa        BOOLEAN     DEFAULT TRUE,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id)
);

-- El token de API de Moodle NO se almacena aquí: vive en variables de
-- entorno del servidor (MOODLE_TOKEN_TECNO, MOODLE_TOKEN_CLEVELAND).
CREATE TABLE usuarios_app (
  id              SERIAL      PRIMARY KEY,
  email           TEXT        NOT NULL UNIQUE,
  nombre          TEXT        NOT NULL,
  password_hash   TEXT        NOT NULL,   -- argon2id: '$argon2id$v=19$…'
  activo          BOOLEAN     DEFAULT TRUE,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  ultima_sesion   TIMESTAMPTZ
);

-- admin  → lectura + escritura completa en su academia.
-- asesor → lectura de sus colegios asignados; puede disparar "Actualizar avance"
--          con límite de frecuencia (ver §12 del documento de diseño).
-- gerente → lectura en ambas academias; puede disparar "Actualizar avance"
--           con límite de frecuencia.
CREATE TABLE roles_academia (
  usuario_id    INT         NOT NULL,
  academia_id   TEXT        NOT NULL,
  rol           rol_usuario NOT NULL,
  activo        BOOLEAN     DEFAULT TRUE,
  asignado_en   TIMESTAMPTZ DEFAULT NOW(),
  -- Límite de frecuencia para "Actualizar avance" (NULL = sin límite adicional)
  ultimo_actualizar_avance TIMESTAMPTZ DEFAULT NULL,
  PRIMARY KEY (usuario_id, academia_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios_app(id) ON DELETE RESTRICT,
  FOREIGN KEY (academia_id) REFERENCES academias(id)   ON DELETE RESTRICT
);

-- Permisos granulares adicionales al rol base.
CREATE TABLE permisos_usuario (
  usuario_id    INT         NOT NULL,
  academia_id   TEXT        NOT NULL,
  permiso       TEXT        NOT NULL,
  otorgado_por  INT,
  otorgado_en   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (usuario_id, academia_id, permiso),
  FOREIGN KEY (usuario_id)   REFERENCES usuarios_app(id) ON DELETE CASCADE,
  FOREIGN KEY (academia_id)  REFERENCES academias(id)    ON DELETE RESTRICT,
  FOREIGN KEY (otorgado_por) REFERENCES usuarios_app(id) ON DELETE SET NULL
);

CREATE TABLE sesiones (
  id            TEXT        PRIMARY KEY,
  usuario_id    INT         NOT NULL,
  academia_ids  TEXT        NOT NULL,  -- CSV: 'tecno' o 'tecno,cleveland' para gerente
  creada_en     TIMESTAMPTZ DEFAULT NOW(),
  expira_en     TIMESTAMPTZ NOT NULL,
  ip_origen     INET,
  user_agent    TEXT,
  activa        BOOLEAN     DEFAULT TRUE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios_app(id) ON DELETE CASCADE
);

CREATE TABLE intentos_login (
  id            BIGSERIAL   PRIMARY KEY,
  email         TEXT        NOT NULL,
  ip            INET        NOT NULL,
  exitoso       BOOLEAN     NOT NULL,
  intentado_en  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_intentos_email_ip ON intentos_login(email, ip, intentado_en DESC);

-- ══════════════════════════════════════════════════════════════════
-- COLEGIOS Y ASESORES
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE colegios (
  id            TEXT        NOT NULL,
  academia_id   TEXT        NOT NULL,
  nombre        TEXT        NOT NULL,
  orden         INT         DEFAULT 0,
  eliminado_en  TIMESTAMPTZ DEFAULT NULL,
  legacy_id     TEXT        UNIQUE,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);
CREATE INDEX idx_colegios_academia ON colegios(academia_id) WHERE eliminado_en IS NULL;

CREATE TABLE asesores_colegios (
  usuario_id    INT         NOT NULL,
  academia_id   TEXT        NOT NULL,
  colegio_id    TEXT        NOT NULL,
  activo        BOOLEAN     DEFAULT TRUE,
  desde         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (usuario_id, academia_id, colegio_id),
  FOREIGN KEY (usuario_id, academia_id) REFERENCES roles_academia(usuario_id, academia_id) ON DELETE CASCADE,
  FOREIGN KEY (colegio_id, academia_id) REFERENCES colegios(id, academia_id)               ON DELETE CASCADE
);

-- ══════════════════════════════════════════════════════════════════
-- CURSOS MODELO Y ASIGNACIONES
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE cursos_modelo (
  id               TEXT        NOT NULL,
  academia_id      TEXT        NOT NULL,
  nombre           TEXT        NOT NULL,
  nivel            nivel_curso NOT NULL,
  moodle_course_id INT,
  orden            INT         DEFAULT 0,
  eliminado_en     TIMESTAMPTZ DEFAULT NULL,
  legacy_id        TEXT        UNIQUE,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);

CREATE TABLE asignaciones_moodle (
  id               TEXT        NOT NULL,
  academia_id      TEXT        NOT NULL,
  colegio_id       TEXT        NOT NULL,
  curso_id         TEXT        NOT NULL,
  anio             TEXT        NOT NULL,
  fecha_copia      DATE,
  nombre_completo  TEXT,
  nombre_corto     TEXT,
  moodle_course_id INT,
  clases           INT         DEFAULT 0,
  notas            TEXT,
  orden            INT         DEFAULT 0,
  eliminado_en     TIMESTAMPTZ DEFAULT NULL,
  legacy_id        TEXT        UNIQUE,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  FOREIGN KEY (academia_id)             REFERENCES academias(id)                     ON DELETE RESTRICT,
  FOREIGN KEY (colegio_id, academia_id) REFERENCES colegios(id, academia_id)         ON DELETE RESTRICT,
  FOREIGN KEY (curso_id,   academia_id) REFERENCES cursos_modelo(id, academia_id)    ON DELETE RESTRICT
);
CREATE INDEX idx_asig_colegio_anio ON asignaciones_moodle(colegio_id, anio) WHERE eliminado_en IS NULL;

-- Impide dos asignaciones activas para el mismo (colegio, curso modelo, año) en la misma academia.
-- Evaluación del punto 3e: una asignación representa una copia única de un curso en un colegio
-- para un año. Permitir dos copias activas de la misma combinación causaría ambigüedad en la
-- generación de usuarios y en la sincronización. El índice es correcto para este modelo.
CREATE UNIQUE INDEX uk_asig_activa
  ON asignaciones_moodle(colegio_id, academia_id, curso_id, anio)
  WHERE eliminado_en IS NULL;

-- ══════════════════════════════════════════════════════════════════
-- SECCIONES Y ACTIVIDADES DE MOODLE
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE secciones_moodle (
  id                  BIGSERIAL   PRIMARY KEY,
  asignacion_id       TEXT        NOT NULL,
  academia_id         TEXT        NOT NULL,
  moodle_section_id   INT         NOT NULL,
  numero_seccion      INT         NOT NULL,   -- número de sección en Moodle (0-based o 1-based)
  -- numero_unidad es distinto de numero_seccion: agrupa secciones en rangos
  -- (p. ej. las secciones 1–4 de Moodle forman la "Unidad 1" del programa).
  -- NULL = sin mapeo a unidad todavía.
  numero_unidad       INT         DEFAULT NULL,
  titulo              TEXT,
  termino             TEXT,
  visible             BOOLEAN     DEFAULT TRUE,
  -- Primera vez que visible=TRUE; nunca se borra aunque la sección se oculte de nuevo.
  -- Define "elegible alguna vez": las consultas de avance usan publicada_en IS NOT NULL
  -- para no dejar de contar actividades que el docente oculta temporalmente.
  publicada_en        TIMESTAMPTZ DEFAULT NULL,
  orden               INT         DEFAULT 0,
  ultima_consulta     TIMESTAMPTZ,
  -- Llenado por el sync cuando la sección desaparece de core_course_get_contents.
  -- Las secciones con ausente_en IS NOT NULL se excluyen del cálculo de elegibles.
  ausente_en          TIMESTAMPTZ DEFAULT NULL,
  -- Contador de syncs consecutivos en que la sección no apareció en la respuesta.
  -- Se marca ausente_en solo cuando llega a 2 (salvaguarda b).
  -- Se resetea a 0 cuando la sección reaparece en la respuesta (salvaguarda c).
  ausencias_consecutivas SMALLINT DEFAULT 0 NOT NULL,
  -- Invariante: ausente_en solo puede ser NOT NULL cuando el contador ya llegó a 2.
  -- Impide que sync_worker (o código directo) marque ausente sin pasar por el umbral.
  CONSTRAINT chk_sec_ausente CHECK (ausente_en IS NULL OR ausencias_consecutivas >= 2),
  UNIQUE (asignacion_id, moodle_section_id),
  -- UNIQUE (id, academia_id) necesario para FK compuesta desde actividades_moodle
  UNIQUE (id, academia_id),
  -- UNIQUE (id, asignacion_id) necesario para FK compuesta desde actividades_moodle
  UNIQUE (id, asignacion_id),
  FOREIGN KEY (asignacion_id, academia_id) REFERENCES asignaciones_moodle(id, academia_id) ON DELETE CASCADE
);
CREATE INDEX idx_secciones_asig ON secciones_moodle(asignacion_id);

-- tipo_modulo es TEXT con el modname de Moodle (h5pactivity, quiz, assign, forum,
-- resource, label, url, page, …). Se almacena el string exacto para que nuevos
-- tipos de módulos de Moodle no requieran migración de ENUM.
CREATE TABLE actividades_moodle (
  id                  BIGSERIAL   PRIMARY KEY,
  seccion_id          BIGINT      NOT NULL,
  asignacion_id       TEXT        NOT NULL,
  academia_id         TEXT        NOT NULL,
  moodle_cmid         INT         NOT NULL,
  tipo_modulo         TEXT        DEFAULT 'otro',  -- modname de Moodle: h5pactivity, quiz, assign, …
  titulo              TEXT,
  visible             BOOLEAN     DEFAULT TRUE,
  -- Primera vez que visible=TRUE; nunca se borra aunque la actividad se oculte de nuevo.
  -- El sync conserva el último progreso leído cuando una actividad pasa a visible=FALSE.
  publicada_en        TIMESTAMPTZ DEFAULT NULL,
  tiene_finalizacion  BOOLEAN     DEFAULT FALSE,
  nota_minima_aprobacion NUMERIC(5,2) DEFAULT NULL,
  orden               INT         DEFAULT 0,
  ultima_consulta     TIMESTAMPTZ,
  -- Llenado por el sync cuando la actividad desaparece de core_course_get_contents.
  -- Las actividades con ausente_en IS NOT NULL se excluyen de los elegibles.
  ausente_en          TIMESTAMPTZ DEFAULT NULL,
  -- Contador de syncs consecutivos en que la actividad no apareció en la respuesta.
  -- Se marca ausente_en solo cuando llega a 2 (salvaguarda b).
  -- Se resetea a 0 cuando la actividad reaparece en la respuesta (salvaguarda c).
  ausencias_consecutivas SMALLINT DEFAULT 0 NOT NULL,
  -- Invariante: ausente_en solo puede ser NOT NULL cuando el contador ya llegó a 2.
  -- Impide que sync_worker (o código directo) marque ausente sin pasar por el umbral.
  CONSTRAINT chk_act_ausente CHECK (ausente_en IS NULL OR ausencias_consecutivas >= 2),
  UNIQUE (asignacion_id, moodle_cmid),
  -- UNIQUE (id, academia_id) y UNIQUE (id, asignacion_id): permiten FKs compuestas desde progreso
  UNIQUE (id, academia_id),
  UNIQUE (id, asignacion_id),
  -- FK compuesta seccion ↔ academia (evita actividad en sección de otra academia)
  FOREIGN KEY (seccion_id, academia_id)    REFERENCES secciones_moodle(id, academia_id)          ON DELETE CASCADE,
  -- FK compuesta seccion ↔ asignacion (evita actividad en sección de otra asignación)
  FOREIGN KEY (seccion_id, asignacion_id)  REFERENCES secciones_moodle(id, asignacion_id)         ON DELETE CASCADE,
  FOREIGN KEY (asignacion_id, academia_id) REFERENCES asignaciones_moodle(id, academia_id)        ON DELETE CASCADE
);
CREATE INDEX idx_actividades_seccion ON actividades_moodle(seccion_id);

-- ══════════════════════════════════════════════════════════════════
-- ESTUDIANTES (identidad de la persona)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE estudiantes (
  id            TEXT        NOT NULL,
  academia_id   TEXT        NOT NULL,
  nombres       TEXT        NOT NULL,
  apellidos     TEXT        NOT NULL,
  eliminado_en  TIMESTAMPTZ DEFAULT NULL,
  legacy_id     TEXT        UNIQUE,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);
CREATE INDEX idx_estudiantes_nombre ON estudiantes(academia_id, apellidos, nombres)
  WHERE eliminado_en IS NULL;

-- ══════════════════════════════════════════════════════════════════
-- GRUPOS
-- ══════════════════════════════════════════════════════════════════

-- unidad_actual se deriva de las secciones publicadas (visibles) por el docente:
-- la última sección visible en Moodle determina la unidad actual. Ver §3.6 del
-- documento de diseño para la lógica completa y el caso de visibilidad por grupo.
CREATE TABLE grupos (
  id                   TEXT        NOT NULL,
  academia_id          TEXT        NOT NULL,
  asignacion_id        TEXT        NOT NULL,
  nombre_grupo         TEXT        DEFAULT '',
  unidad_actual_auto   INT         DEFAULT 1,
  unidad_actual_manual INT         DEFAULT NULL,
  activo               BOOLEAN     DEFAULT TRUE,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  -- UNIQUE (id, asignacion_id): permite FK compuesta desde matriculas (mismo asignacion)
  UNIQUE (id, asignacion_id),
  FOREIGN KEY (asignacion_id, academia_id) REFERENCES asignaciones_moodle(id, academia_id) ON DELETE RESTRICT
);

-- ══════════════════════════════════════════════════════════════════
-- MATRÍCULAS
-- Puntos corregidos en v2.2:
--  · anio y nivel eliminados: se derivan por JOIN a asignaciones_moodle
--  · grupo_id FK: ON DELETE RESTRICT (no SET NULL) porque los grupos usan
--    soft-delete (activo=FALSE). Si se quiere eliminar físicamente un grupo con
--    matrículas, primero hay que reasignar o dar de baja los estudiantes. Esto
--    evita que un ON DELETE SET NULL anule academia_id accidentalmente (defecto
--    del v2.1). Con RESTRICT la acción explícita previene el error.
--  · enc_iv: 12 bytes (96-bit nonce para AES-256-GCM, no 16 bytes/128-bit)
--  · enc_version + enc_etiqueta (AAD/label): para rotación de clave y GCM label
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE matriculas (
  id               TEXT        NOT NULL,
  academia_id      TEXT        NOT NULL,
  estudiante_id    TEXT        NOT NULL,
  asignacion_id    TEXT        NOT NULL,
  grupo_id         TEXT        DEFAULT NULL,
  -- Credenciales Moodle:
  username         TEXT,
  -- Cifrado AES-256-GCM a nivel de aplicación.
  -- password_enc: ciphertext en Base64.
  -- enc_iv: nonce GCM de 12 bytes (96 bits) en hex (24 caracteres). No 16 bytes.
  -- enc_version: número de versión de la clave APP_ENCRYPTION_KEY activa al cifrar.
  --   Permite rotar la clave sin re-cifrar todo de inmediato.
  -- AAD de GCM: se RECALCULA en la app como (academia_id || ':' || id); NO se guarda.
  -- La etiqueta de autenticación GCM (16 bytes) se CONCATENA al ciphertext:
  --   password_enc = Base64(ciphertext || tag_16_bytes)
  -- NO usar enc_version = 0 como convenio de "clave obsoleta": usar clave_obsoleta.
  password_enc     TEXT,
  enc_iv           TEXT,       -- nonce GCM 12 bytes en hex (24 chars)
  enc_version      SMALLINT    DEFAULT 1,
  clave_obsoleta   BOOLEAN     DEFAULT FALSE,  -- TRUE cuando se confirma que el estudiante cambió su clave en Moodle
  -- Nota sobre claves obsoletas (v2.3): si un estudiante cambia su contraseña
  -- en Moodle directamente, password_enc queda como "clave inicial" posiblemente
  -- obsoleta. La API NO informa cambios de clave. Usar clave_obsoleta=TRUE para
  -- marcar explícitamente cuando se sabe que la clave cambió. La UI puede mostrar
  -- "⚠ clave inicial — puede haber cambiado" cuando primer_acceso IS NOT NULL.
  email            TEXT,
  city             TEXT,
  country          TEXT        DEFAULT 'Venezuela',
  role1            TEXT        DEFAULT 'student',
  enrolperiod1     TEXT        DEFAULT '365d',
  suspended        CHAR(1)     DEFAULT '0',
  moodle_user_id   INT         DEFAULT NULL,
  primer_acceso    TIMESTAMPTZ DEFAULT NULL,
  ultimo_acceso    TIMESTAMPTZ DEFAULT NULL,
  ultimo_acceso_curso TIMESTAMPTZ DEFAULT NULL,
  fecha_consulta_moodle TIMESTAMPTZ DEFAULT NULL,
  -- anio y nivel eliminados en v2.2: derivar por:
  --   JOIN asignaciones_moodle a ON a.id = m.asignacion_id → a.anio
  --   JOIN cursos_modelo c ON c.id = a.curso_id → c.nivel
  fecha_generacion DATE,
  agregado_en      TIMESTAMPTZ DEFAULT NULL,
  course1_legacy   TEXT,
  eliminado_en     TIMESTAMPTZ DEFAULT NULL,
  lote_baja        TEXT        DEFAULT NULL,
  tipo_papelera    tipo_papelera DEFAULT NULL,
  orden            INT         DEFAULT 0,
  legacy_id        TEXT        UNIQUE,
  PRIMARY KEY (id),
  -- UNIQUE (id, academia_id) y UNIQUE (id, asignacion_id): para FKs compuestas
  UNIQUE (id, academia_id),
  UNIQUE (id, asignacion_id),
  FOREIGN KEY (academia_id)                            REFERENCES academias(id)                         ON DELETE RESTRICT,
  FOREIGN KEY (estudiante_id, academia_id)             REFERENCES estudiantes(id, academia_id)           ON DELETE RESTRICT,
  FOREIGN KEY (asignacion_id, academia_id)             REFERENCES asignaciones_moodle(id, academia_id)   ON DELETE RESTRICT,
  -- FK grupo_id: RESTRICT (no SET NULL) para evitar anular academia_id accidentalmente.
  -- Los grupos se dan de baja con activo=FALSE, no borrándolos físicamente.
  FOREIGN KEY (grupo_id, academia_id)                  REFERENCES grupos(id, academia_id)                ON DELETE RESTRICT,
  -- Garantiza que el grupo pertenezca a la misma asignación que la matrícula.
  FOREIGN KEY (grupo_id, asignacion_id)                REFERENCES grupos(id, asignacion_id)              ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uk_username_activo
  ON matriculas(academia_id, username)
  WHERE eliminado_en IS NULL;

CREATE INDEX idx_matriculas_asignacion ON matriculas(asignacion_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_matriculas_estudiante ON matriculas(estudiante_id);
CREATE INDEX idx_matriculas_grupo      ON matriculas(grupo_id)      WHERE eliminado_en IS NULL;

-- ══════════════════════════════════════════════════════════════════
-- PROGRESO (fuente: API de Moodle — finalización de actividad)
--
-- moodle_completado sigue los estados de la API:
--   0 = no completado
--   1 = completado (COMPLETION_COMPLETE)
--   2 = completado y aprobado (COMPLETION_COMPLETE_PASS)
--   3 = completado no aprobado (COMPLETION_COMPLETE_FAIL)
-- Criterio del sistema: 1 y 2 suman como "completada" en el % de avance.
-- El estado 3 no suma pero se muestra aparte (completada sin aprobar).
-- La función de la API es: core_completion_get_activities_completion_status
--   (parámetros: userid, courseid) → devuelve completionstate por cmid.
--   Es una llamada POR ESTUDIANTE POR CURSO, no por actividad individual.
--
-- asignacion_id: denormalizado para las FKs cruzadas de integridad.
--   Garantiza que la matrícula y la actividad pertenezcan a la misma asignación.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE progreso_actividades (
  matricula_id      TEXT        NOT NULL,
  actividad_id      BIGINT      NOT NULL,
  asignacion_id     TEXT        NOT NULL,   -- denorm para constraint cross-asignación
  academia_id       TEXT        NOT NULL,
  moodle_completado SMALLINT    DEFAULT 0 CHECK (moodle_completado BETWEEN 0 AND 3),
  nota              NUMERIC(5,2) DEFAULT NULL,
  fecha_completado  TIMESTAMPTZ DEFAULT NULL,
  fecha_consulta    TIMESTAMPTZ DEFAULT NULL,
  PRIMARY KEY (matricula_id, actividad_id),
  -- Integridad de academia:
  FOREIGN KEY (matricula_id,  academia_id) REFERENCES matriculas(id, academia_id)         ON DELETE CASCADE,
  FOREIGN KEY (actividad_id,  academia_id) REFERENCES actividades_moodle(id, academia_id) ON DELETE CASCADE,
  -- Integridad de asignación: matrícula y actividad deben ser de la misma asignación.
  FOREIGN KEY (matricula_id,  asignacion_id) REFERENCES matriculas(id, asignacion_id)         ON DELETE CASCADE,
  FOREIGN KEY (actividad_id,  asignacion_id) REFERENCES actividades_moodle(id, asignacion_id) ON DELETE CASCADE
);
CREATE INDEX idx_progreso_actividad ON progreso_actividades(actividad_id);
CREATE INDEX idx_progreso_matricula  ON progreso_actividades(matricula_id);

-- ══════════════════════════════════════════════════════════════════
-- CARNETS
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE carnet_listas (
  id            TEXT        NOT NULL,
  academia_id   TEXT        NOT NULL,
  nivel         nivel_curso NOT NULL,
  grado         SMALLINT    NOT NULL,
  seccion       TEXT,
  clave         TEXT        NOT NULL,
  orden         INT         DEFAULT 0,
  eliminado_en  TIMESTAMPTZ DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE (id, academia_id),
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);

CREATE TABLE carnet_estudiantes (
  id            BIGSERIAL   PRIMARY KEY,
  lista_id      TEXT        NOT NULL,
  academia_id   TEXT        NOT NULL,
  usuario       TEXT,
  apellidos     TEXT,
  nombres       TEXT,
  orden         INT         DEFAULT 0,
  -- FK compuesta: garantiza que el estudiante del carnet pertenezca a la misma academia que la lista
  FOREIGN KEY (lista_id, academia_id) REFERENCES carnet_listas(id, academia_id) ON DELETE CASCADE
);
CREATE INDEX idx_carnet_est_lista ON carnet_estudiantes(lista_id);

CREATE TABLE carnet_opciones (
  academia_id   TEXT        NOT NULL PRIMARY KEY,
  layout        TEXT        DEFAULT 'big',
  url           TEXT,
  upper         BOOLEAN     DEFAULT TRUE,
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);

-- ══════════════════════════════════════════════════════════════════
-- SINCRONIZACIÓN CON MOODLE
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE moodle_sync_log (
  id                   BIGSERIAL   PRIMARY KEY,
  academia_id          TEXT        NOT NULL,
  asignacion_id        TEXT        NOT NULL,
  iniciado_en          TIMESTAMPTZ NOT NULL,
  finalizado_en        TIMESTAMPTZ,
  estado               estado_sync NOT NULL DEFAULT 'en_progreso',
  error_detalle        TEXT,
  estudiantes_procesados   INT     DEFAULT 0,
  actividades_procesadas   INT     DEFAULT 0,
  progreso_actualizado     INT     DEFAULT 0,
  -- FK compuesta: garantiza que el log pertenezca a la academia correcta
  FOREIGN KEY (asignacion_id, academia_id) REFERENCES asignaciones_moodle(id, academia_id) ON DELETE CASCADE,
  FOREIGN KEY (academia_id)                REFERENCES academias(id)                        ON DELETE RESTRICT
);
CREATE INDEX idx_sync_asig ON moodle_sync_log(asignacion_id, iniciado_en DESC);

-- ══════════════════════════════════════════════════════════════════
-- COLA DE SINCRONIZACIÓN
--
-- El worker del VPS usa SELECT ... FOR UPDATE SKIP LOCKED para tomar
-- un trabajo sin bloquear a otros workers concurrentes:
--   SELECT * FROM public.sync_queue
--   WHERE estado = 'pendiente' AND programado_para <= NOW()
--   ORDER BY programado_para
--   LIMIT 1
--   FOR UPDATE SKIP LOCKED;
--
-- Paso de despliegue recomendado (reducir superficie de ataque de tablas
-- temporales que podrían interferir con funciones SECURITY DEFINER):
--   REVOKE TEMPORARY ON DATABASE control_estudio FROM PUBLIC;
-- Efecto: PUBLIC ya no puede crear tablas temporales. El dueño de la BD
-- y cualquier rol con el privilegio TEMPORARY explícito conservan ese permiso.
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE sync_queue (
  id              BIGSERIAL   PRIMARY KEY,
  asignacion_id   TEXT        NOT NULL,
  academia_id     TEXT        NOT NULL,
  tipo            TEXT        NOT NULL DEFAULT 'progreso',  -- 'progreso' | 'estructura' | 'completo'
  programado_para TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intentos        SMALLINT    DEFAULT 0,
  estado          TEXT        NOT NULL DEFAULT 'pendiente', -- pendiente | en_proceso | completado | error
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  -- FK compuesta: garantiza que el trabajo pertenezca a la academia correcta
  FOREIGN KEY (asignacion_id, academia_id) REFERENCES asignaciones_moodle(id, academia_id) ON DELETE CASCADE,
  FOREIGN KEY (academia_id)                REFERENCES academias(id)                        ON DELETE RESTRICT
);

-- Impide trabajos en vuelo duplicados por (asignacion_id, tipo).
-- Cubre estado IN ('pendiente', 'en_proceso'): previene que dos workers tomen
-- simultáneamente la misma (asignacion_id, tipo), y también que se encole un
-- trabajo nuevo mientras el anterior aún está siendo procesado.
-- El historial (completado / error) de la misma combinación sí se permite.
CREATE UNIQUE INDEX uk_sync_queue_pendiente
  ON sync_queue(asignacion_id, tipo)
  WHERE estado IN ('pendiente', 'en_proceso');

CREATE INDEX idx_sync_queue_despacho
  ON sync_queue(programado_para, estado)
  WHERE estado = 'pendiente';

-- ══════════════════════════════════════════════════════════════════
-- AUDITORÍA
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE auditoria (
  id            BIGSERIAL   PRIMARY KEY,
  academia_id   TEXT        NOT NULL,
  usuario_id    INT,
  tabla         TEXT        NOT NULL,
  operacion     operacion_auditoria NOT NULL,
  registro_id   TEXT        NOT NULL,
  datos_antes   JSONB       DEFAULT NULL,
  datos_despues JSONB       DEFAULT NULL,
  realizado_en  TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (usuario_id)  REFERENCES usuarios_app(id) ON DELETE SET NULL,
  FOREIGN KEY (academia_id) REFERENCES academias(id)    ON DELETE RESTRICT
);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla, registro_id);
CREATE INDEX idx_auditoria_fecha ON auditoria(academia_id, realizado_en DESC);

-- ══════════════════════════════════════════════════════════════════
-- MIGRACIÓN — tabla de cuarentena
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE migracion_cuarentena (
  id             BIGSERIAL       PRIMARY KEY,
  tipo           tipo_cuarentena NOT NULL,
  academia_id    TEXT            NOT NULL,
  legacy_id      TEXT,
  datos_originales JSONB         NOT NULL,
  motivo         TEXT            NOT NULL,
  creado_en      TIMESTAMPTZ     DEFAULT NOW(),
  resuelto_en    TIMESTAMPTZ,
  resolucion     TEXT,
  resuelto_por   INT             REFERENCES usuarios_app(id) ON DELETE SET NULL,
  FOREIGN KEY (academia_id) REFERENCES academias(id) ON DELETE RESTRICT
);

-- ══════════════════════════════════════════════════════════════════
-- ROL DE APLICACIÓN (mínimo privilegio)
-- La contraseña real se configura en el deployment, no aquí.
-- ══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;

-- USAGE en el schema es necesario para que app_user pueda ver las tablas.
-- En PG15+ el GRANT de PUBLIC sobre el schema public ya no se otorga por defecto.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_user;
GRANT USAGE, SELECT                   ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- app_user NO tiene CREATEROLE, CREATEDB ni ownership de ninguna tabla.

-- ── Restricciones de mínimo privilegio ──────────────────────────────────────
-- auditoria: solo INSERT — el registro de auditoría es inmutable.
REVOKE UPDATE, DELETE ON auditoria       FROM app_user;
-- intentos_login: solo INSERT.
REVOKE UPDATE, DELETE ON intentos_login  FROM app_user;
-- usuarios_app: sin acceso a password_hash — el login usa login_usuario() SECURITY DEFINER.
REVOKE ALL ON usuarios_app FROM app_user;
GRANT SELECT (id, email, nombre, activo, creado_en, ultima_sesion) ON usuarios_app TO app_user;
GRANT UPDATE (ultima_sesion, activo)                                ON usuarios_app TO app_user;
GRANT INSERT                                                        ON usuarios_app TO app_user;

-- ── Propuesta: rol de solo lectura para asesor/gerente ────────────────────────
-- HOY el modo solo-lectura de asesor/gerente lo impone ÚNICAMENTE la API, no la BD.
-- Para defensa en profundidad, crear un rol app_reader con solo SELECT:
--   CREATE ROLE app_reader NOLOGIN;
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_reader;
--   -- Añadir políticas RLS para app_reader en cada tabla (mismas que app_user).
-- Pendiente de implementar cuando se defina el flujo de autenticación del VPS.

-- ── Rol del worker de sincronización (sync_worker) ───────────────────────────
-- El proceso worker del VPS que llama a la API de Moodle y escribe el progreso
-- DEBE usar su propio rol de BD, distinto de app_user. Propuesta:
--
--   CREATE ROLE sync_worker NOLOGIN;
--   GRANT USAGE ON SCHEMA public TO sync_worker;
--   GRANT SELECT, INSERT, UPDATE ON sync_queue      TO sync_worker;
--   GRANT SELECT, INSERT, UPDATE ON moodle_sync_log TO sync_worker;
--   GRANT SELECT, INSERT, UPDATE ON secciones_moodle, actividades_moodle TO sync_worker;
--   GRANT SELECT, INSERT, UPDATE ON progreso_actividades TO sync_worker;
--   GRANT SELECT ON asignaciones_moodle, matriculas, cursos_modelo TO sync_worker;
--   -- El worker NO necesita: password_enc, carnet_listas, usuarios_app, sesiones.
--
-- Por qué un rol separado del de la API (app_user):
--   1. El worker accede a varias academias en paralelo (sync nocturno completo).
--      Con app_user habría que setear app.academia_ids = 'tecno,cleveland', lo que
--      daría la misma vista que un gerente y debilitaría la defensa en profundidad.
--      sync_worker no usa RLS de academia: su acceso está acotado por las tablas
--      que tiene concedidas, no por la variable de sesión.
--   2. Mínimo privilegio: el worker no lee password_enc, carnets ni auditoría.
--   3. Separación de vectores de ataque: comprometer la API no otorga permisos del
--      worker, y viceversa.
--   4. Trazabilidad: los logs de la BD distinguen operaciones del worker vs. la API.
-- ── IMPORTANTE: SET LOCAL por request ────────────────────────────────────────
-- La variable app.academia_ids es modificable por cualquiera que ejecute SQL.
-- La API DEBE usar SET LOCAL (no SET) dentro de una transacción por request:
--   BEGIN;
--   SET LOCAL "app.academia_ids" = 'tecno';   ← scoped a esta transacción
--   -- queries de la API
--   COMMIT;  -- o ROLLBACK; al terminar, el valor se revierte automáticamente
-- Con SET (sin LOCAL), el valor persiste en la conexión de pool y puede filtrar
-- al siguiente request. SET LOCAL garantiza que al COMMIT/ROLLBACK se revierte,
-- y que si la API olvida setearlo el próximo request obtiene 0 filas (fail-safe).

-- ══════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- La API llama set_config('app.academia_ids', '<csv>', true) al inicio
-- de cada request. Ejemplos:
--   Admin Tecno:  set_config('app.academia_ids', 'tecno', true)
--   Gerente:      set_config('app.academia_ids', 'tecno,cleveland', true)
--   Sin setear:   current_setting devuelve NULL → ANY(NULL) = NULL → 0 filas
--
-- FORCE ROW LEVEL SECURITY: aplica RLS incluso al dueño de las tablas.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE colegios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE colegios             FORCE ROW LEVEL SECURITY;
ALTER TABLE cursos_modelo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_modelo        FORCE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_moodle  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_moodle  FORCE ROW LEVEL SECURITY;
ALTER TABLE secciones_moodle     ENABLE ROW LEVEL SECURITY;
ALTER TABLE secciones_moodle     FORCE ROW LEVEL SECURITY;
ALTER TABLE actividades_moodle   ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividades_moodle   FORCE ROW LEVEL SECURITY;
ALTER TABLE estudiantes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiantes          FORCE ROW LEVEL SECURITY;
ALTER TABLE grupos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos               FORCE ROW LEVEL SECURITY;
ALTER TABLE matriculas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriculas           FORCE ROW LEVEL SECURITY;
ALTER TABLE progreso_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE progreso_actividades FORCE ROW LEVEL SECURITY;
ALTER TABLE carnet_listas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE carnet_listas        FORCE ROW LEVEL SECURITY;
ALTER TABLE carnet_estudiantes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE carnet_estudiantes   FORCE ROW LEVEL SECURITY;
ALTER TABLE moodle_sync_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE moodle_sync_log      FORCE ROW LEVEL SECURITY;
ALTER TABLE sync_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue           FORCE ROW LEVEL SECURITY;
ALTER TABLE auditoria            ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria            FORCE ROW LEVEL SECURITY;
ALTER TABLE migracion_cuarentena ENABLE ROW LEVEL SECURITY;
ALTER TABLE migracion_cuarentena FORCE ROW LEVEL SECURITY;
ALTER TABLE roles_academia       ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles_academia       FORCE ROW LEVEL SECURITY;
ALTER TABLE permisos_usuario     ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_usuario     FORCE ROW LEVEL SECURITY;
ALTER TABLE asesores_colegios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE asesores_colegios    FORCE ROW LEVEL SECURITY;
ALTER TABLE carnet_opciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE carnet_opciones      FORCE ROW LEVEL SECURITY;

-- Macro reutilizable: academia_id ∈ lista pasada en la sesión
-- Se repite en cada política porque PG no permite funciones en USING sin
-- searchpath fijo; la duplicación es intencional y explícita.

CREATE POLICY pol_colegios
  ON colegios FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_cursos_modelo
  ON cursos_modelo FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_asignaciones
  ON asignaciones_moodle FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_secciones
  ON secciones_moodle FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_actividades
  ON actividades_moodle FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_estudiantes
  ON estudiantes FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_grupos
  ON grupos FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_matriculas
  ON matriculas FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_progreso
  ON progreso_actividades FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_carnet_listas
  ON carnet_listas FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_carnet_estudiantes
  ON carnet_estudiantes FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_sync_log
  ON moodle_sync_log FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_sync_queue
  ON sync_queue FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_auditoria
  ON auditoria FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_cuarentena
  ON migracion_cuarentena FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_roles_academia
  ON roles_academia FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_permisos_usuario
  ON permisos_usuario FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_asesores_colegios
  ON asesores_colegios FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_carnet_opciones
  ON carnet_opciones FOR ALL TO app_user
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

-- ══════════════════════════════════════════════════════════════════
-- VISTA v_moodle_upload
-- firstname se construye exactamente como buildUsuariosCSV() en script.js:
--   firstname = username + ' ' + nombres   (línea 1657)
--   lastname  = apellidos                   (línea 1658)
-- group1 devuelve el nombre del grupo (no su id). El descifrado de
-- password_enc lo hace la capa de aplicación (permiso ver_claves_moodle).
-- ══════════════════════════════════════════════════════════════════

CREATE VIEW v_moodle_upload
  WITH (security_invoker = true)  -- RLS del llamante aplica; requiere PG 15+. Sin esto,
                                  -- la vista correría con permisos del creador y bypassearía RLS.
AS
  SELECT
    m.username,
    NULL AS password,             -- descifrar en app (permiso ver_claves_moodle)
    m.username || ' ' || e.nombres   AS firstname,
    e.apellidos                       AS lastname,
    m.email,
    m.city,
    m.country,
    a.nombre_corto                    AS course1,
    COALESCE(g.nombre_grupo, '')      AS group1,
    m.role1,
    m.enrolperiod1,
    m.suspended
  FROM  matriculas            m
  JOIN  estudiantes           e ON e.id = m.estudiante_id
  JOIN  asignaciones_moodle   a ON a.id = m.asignacion_id
  LEFT JOIN grupos            g ON g.id = m.grupo_id
  WHERE m.eliminado_en IS NULL;

-- ON ALL TABLES solo cubre las relaciones existentes en el momento del GRANT.
-- Estas relaciones se crean después de ese GRANT, así que necesitan GRANTs explícitos.
GRANT SELECT ON v_moodle_upload TO app_user;
-- sync_queue: el worker necesita SELECT, INSERT y UPDATE (para cambiar estado e intentos).
-- No necesita DELETE: los trabajos completados/error se conservan como historial.
GRANT SELECT, INSERT, UPDATE ON sync_queue TO app_user;

-- ══════════════════════════════════════════════════════════════════
-- FUNCIÓN DE LOGIN (SECURITY DEFINER)
-- Resuelve las academias del usuario SIN depender de app.academia_ids (variable de
-- sesión que aún no está definida al momento del login — problema huevo-gallina).
--
-- Flujo de uso en la API:
--   1. Recibe email + password (plaintext) del formulario de login.
--   2. Llama login_usuario(email) → obtiene id, nombre, activo, hash, academia_ids.
--   3. Verifica el password localmente con argon2 (no en BD: sin extensión nativa).
--   4. Si OK: INSERT en sesiones y luego, por cada request:
--        BEGIN;
--        SET LOCAL "app.academia_ids" = <academia_ids>;
--        -- queries normales (RLS filtra por academia)
--        COMMIT;
--
-- SECURITY DEFINER: la función corre como el propietario (superusuario) y bypasea
-- RLS. Esto es necesario para leer usuarios_app.password_hash y roles_academia
-- antes de que exista una sesión activa.
-- SET search_path = public: fija el search_path para evitar ataques de hijacking.
-- ══════════════════════════════════════════════════════════════════

CREATE FUNCTION login_usuario(p_email TEXT)
RETURNS TABLE(
  usuario_id    INT,
  nombre        TEXT,
  activo        BOOLEAN,
  password_hash TEXT,    -- hash argon2id; la verificación real ocurre en la app
  academia_ids  TEXT     -- CSV: 'tecno' o 'tecno,cleveland' para gerente
)
LANGUAGE sql
SECURITY DEFINER
STABLE
-- search_path fijo: evita que el llamante inyecte objetos en schemas que se
-- buscan antes que public. 'public' primero garantiza que public.usuarios_app
-- y public.roles_academia se usen aunque existan tablas temporales con el mismo
-- nombre. 'pg_temp' al final permite crear tablas temporales dentro de la función
-- si fuera necesario en el futuro, sin riesgo de shadowing.
-- Los nombres de tabla se califican con public. como defensa en profundidad.
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id,
    u.nombre,
    u.activo,
    u.password_hash,
    (SELECT string_agg(ra.academia_id, ',' ORDER BY ra.academia_id)
     FROM   public.roles_academia ra
     WHERE  ra.usuario_id = u.id
       AND  ra.activo     = TRUE)
  FROM public.usuarios_app u
  WHERE u.email = p_email;
$$;

REVOKE ALL    ON FUNCTION login_usuario(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_usuario(TEXT) TO app_user;

-- ══════════════════════════════════════════════════════════════════
-- ROL DEL WORKER DE SINCRONIZACIÓN (sync_worker)
--
-- Separación de la API (app_user): el worker accede a las tablas de
-- estructura y progreso; nunca a password_enc, enc_iv, carnets,
-- usuarios_app, sesiones ni auditoría.
--
-- La separación de academias la impone la RLS (igual que app_user),
-- no los GRANTs de tabla. Cada trabajo se procesa con:
--   BEGIN;
--   SET LOCAL "app.academia_ids" = '<academia del trabajo>';
--   -- operaciones del sync
--   COMMIT;
-- Sin SET LOCAL → current_setting devuelve NULL → 0 filas (fail-safe).
-- ══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sync_worker') THEN
    CREATE ROLE sync_worker NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO sync_worker;

-- Cola de trabajos: tomar, actualizar estado e insertar reagendamientos
GRANT SELECT, INSERT, UPDATE ON sync_queue      TO sync_worker;
GRANT USAGE, SELECT ON SEQUENCE sync_queue_id_seq TO sync_worker;

-- Registro de sincronización: crear al iniciar, actualizar al terminar
GRANT SELECT, INSERT, UPDATE ON moodle_sync_log TO sync_worker;
GRANT USAGE, SELECT ON SEQUENCE moodle_sync_log_id_seq TO sync_worker;

-- Estructura del curso: insertar y actualizar secciones y actividades
GRANT SELECT, INSERT, UPDATE ON secciones_moodle  TO sync_worker;
GRANT USAGE, SELECT ON SEQUENCE secciones_moodle_id_seq TO sync_worker;
GRANT SELECT, INSERT, UPDATE ON actividades_moodle TO sync_worker;
GRANT USAGE, SELECT ON SEQUENCE actividades_moodle_id_seq TO sync_worker;

-- Progreso: insertar y actualizar estados de finalización por estudiante
GRANT SELECT, INSERT, UPDATE ON progreso_actividades TO sync_worker;

-- Asignaciones: leer datos del curso; actualizar solo moodle_course_id (§3.4 paso 0a)
GRANT SELECT                  ON asignaciones_moodle TO sync_worker;
GRANT UPDATE (moodle_course_id) ON asignaciones_moodle TO sync_worker;

-- Grupos: leer y actualizar unidad actual automática (§3.4 paso 1f)
GRANT SELECT                   ON grupos TO sync_worker;
GRANT UPDATE (unidad_actual_auto) ON grupos TO sync_worker;

-- Cursos modelo: solo lectura (para obtener nivel y datos del catálogo)
GRANT SELECT ON cursos_modelo TO sync_worker;

-- Matrículas: columnas autorizadas SIN password_enc NI enc_iv.
-- UPDATE restringido a los campos que el sync escribe (§3.4 paso 0b y 1b).
-- "consultado_en" del §3.4 corresponde a fecha_consulta_moodle en el esquema.
GRANT SELECT (
  id, academia_id, estudiante_id, asignacion_id, grupo_id,
  username, enc_version, clave_obsoleta,
  email, city, country, role1, enrolperiod1, suspended,
  moodle_user_id, primer_acceso, ultimo_acceso,
  ultimo_acceso_curso, fecha_consulta_moodle,
  fecha_generacion, agregado_en, course1_legacy,
  eliminado_en, lote_baja, tipo_papelera, orden, legacy_id
) ON matriculas TO sync_worker;
GRANT UPDATE (moodle_user_id, primer_acceso, ultimo_acceso,
              ultimo_acceso_curso, fecha_consulta_moodle) ON matriculas TO sync_worker;

-- sync_worker NO tiene acceso a:
--   password_enc, enc_iv en matriculas
--   usuarios_app, sesiones, intentos_login, auditoria
--   colegios, estudiantes, roles_academia, permisos_usuario, asesores_colegios
--   carnet_listas, carnet_estudiantes, carnet_opciones
--   migracion_cuarentena

-- ── Políticas RLS para sync_worker ───────────────────────────────
-- Mismo patrón que app_user: la separación de academias la impone la RLS,
-- no los GRANTs. El worker pone SET LOCAL app.academia_ids = '<academia>'
-- antes de cada operación (una academia por transacción).

CREATE POLICY pol_secciones_worker
  ON secciones_moodle FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_actividades_worker
  ON actividades_moodle FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_asignaciones_worker
  ON asignaciones_moodle FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_matriculas_worker
  ON matriculas FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_progreso_worker
  ON progreso_actividades FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_grupos_worker
  ON grupos FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_sync_log_worker
  ON moodle_sync_log FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_sync_queue_worker
  ON sync_queue FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

CREATE POLICY pol_cursos_worker
  ON cursos_modelo FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));

-- ══════════════════════════════════════════════════════════════════
-- FUNCIONES DEL WORKER DE SINCRONIZACIÓN
-- ══════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- sync_aplicar_estructura: implementa las tres salvaguardas de ausencias
-- en actividades_moodle después de recibir core_course_get_contents.
--
-- Salvaguarda (a): si p_cmids está vacío o p_token_ok es FALSE → no hace
--   nada. Una respuesta vacía puede ser error de red o falta de permisos
--   del token; procesarla como "todo borrado" marcaría actividades que
--   simplemente no se pudieron leer.
-- Salvaguarda (b): incrementa ausencias_consecutivas por cada miss.
--   ausente_en se fija solo cuando llega a 2.
-- Salvaguarda (c): si un cmid reaparece en la respuesta Y la actividad
--   tiene visible=TRUE → limpia ausencias_consecutivas y ausente_en.
--   Si visible=FALSE, nunca se marca la actividad oculta como presente.
--   (Recuperación: el docente vuelve a hacer visible la actividad; el
--   próximo sync la ve con visible=TRUE y la función la reactiva.)
--
-- El CHECK (ausente_en IS NULL OR ausencias_consecutivas >= 2) en la tabla
-- garantiza la consistencia incluso ante UPDATEs directos fuera de la función.
--
-- SECURITY INVOKER: RLS y GRANTs del llamante aplican.
-- ──────────────────────────────────────────────────────────────────
CREATE FUNCTION sync_aplicar_estructura(
  p_asignacion TEXT,
  p_cmids      BIGINT[],
  p_token_ok   BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Salvaguarda (a)
  IF p_token_ok IS NOT TRUE
     OR p_cmids IS NULL
     OR array_length(p_cmids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Salvaguarda (c): reaparición — resetear solo actividades visibles presentes en la respuesta
  UPDATE actividades_moodle
  SET ausencias_consecutivas = 0,
      ausente_en = NULL
  WHERE asignacion_id = p_asignacion
    AND moodle_cmid = ANY(p_cmids)
    AND visible = TRUE
    AND (ausencias_consecutivas > 0 OR ausente_en IS NOT NULL);

  -- Salvaguarda (b): incrementar contador para actividades ausentes de la respuesta
  UPDATE actividades_moodle
  SET ausencias_consecutivas = ausencias_consecutivas + 1
  WHERE asignacion_id = p_asignacion
    AND NOT (moodle_cmid = ANY(p_cmids))
    AND ausente_en IS NULL;

  -- Marcar ausente_en cuando el contador llega a 2 (el CHECK permite este UPDATE)
  UPDATE actividades_moodle
  SET ausente_en = NOW()
  WHERE asignacion_id = p_asignacion
    AND ausencias_consecutivas >= 2
    AND ausente_en IS NULL;
END;
$$;

-- ──────────────────────────────────────────────────────────────────
-- sync_inicializar_publicada_en: fija publicada_en en actividades y
-- secciones que tienen evidencia de completados pero publicada_en IS NULL.
-- Aplica al lanzar el sistema por primera vez o al integrar datos históricos.
--
-- Regla: moodle_completado > 0 es evidencia de que la actividad estuvo
-- visible alguna vez. La propagación sección ← actividad garantiza que
-- la sección también quede marcada si algún hijo tiene publicada_en.
--
-- SECURITY INVOKER: RLS y GRANTs del llamante aplican.
-- ──────────────────────────────────────────────────────────────────
CREATE FUNCTION sync_inicializar_publicada_en(p_asignacion TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Fijar publicada_en en actividades con evidencia de completados
  UPDATE actividades_moodle a
  SET publicada_en = NOW()
  WHERE a.asignacion_id = p_asignacion
    AND a.publicada_en IS NULL
    AND EXISTS (
      SELECT 1 FROM progreso_actividades pa
      WHERE pa.actividad_id = a.id
        AND pa.moodle_completado > 0
    );

  -- 2. Propagar publicada_en a secciones con al menos una actividad publicada.
  UPDATE secciones_moodle s
  SET publicada_en = NOW()
  WHERE s.asignacion_id = p_asignacion
    AND s.publicada_en IS NULL
    AND EXISTS (
      SELECT 1 FROM actividades_moodle a
      WHERE a.seccion_id = s.id
        AND a.publicada_en IS NOT NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION sync_aplicar_estructura(TEXT, BIGINT[], BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION sync_inicializar_publicada_en(TEXT)               FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sync_aplicar_estructura(TEXT, BIGINT[], BOOLEAN) TO sync_worker;
GRANT EXECUTE ON FUNCTION sync_inicializar_publicada_en(TEXT)               TO sync_worker;
