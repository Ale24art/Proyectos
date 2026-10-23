# Diseño de base de datos v2 — Sistema de control de estudio

**Fecha:** 2026-10-23 · **Autor:** Claude Code (solo lectura + propuesta; sin tocar código)
**Estado:** borrador para revisión del dueño del proyecto

> **Principio:** el código manda. Todo lo documentado aquí se verificó contra el código real del repositorio. Las secciones marcadas con ⚠ o "Pendiente de confirmar" requieren decisión del dueño antes de implementar.

---

## 1. Almacenamiento actual — diagnóstico de solo lectura

### 1.1 Objeto `data` (fuente de verdad de la app hoy)

Definido en `Organizador_moodle/script.js` — función `freshData()` línea 257, `loadData()` línea 270.

```
data = {
  colegios:      [ { id, nombre } ]
  cursos:        [ { id, nombre, nivel:"media"|"primaria" } ]
  asignaciones:  [ { id, colegioId, cursoId, anio, fecha, nombreCompleto, nombreCorto,
                     clases, notas } ]
  participantes: [ { id, colegioId, cursoId, anio, nivel,
                     username, password, nombres, apellidos,
                     email, city, country,
                     course1, group1, role1, enrolperiod1, suspended,
                     fecha, agregadoEn? } ]
  carnetListas:  [ { id, nivel, grado, seccion, clave,
                     estudiantes: [ { usuario, apellidos, nombres } ] } ]
  carnetOpciones: { layout, url, upper }
  trash: {
    colegios:     [ { id, nombre } ]
    cursos:       [ { id, nombre, nivel } ]
    asignaciones: [ { id, colegioId, cursoId, ... } ]
    participantes:[ { id, colegioId, cursoId, anio, grupo,
                      fechaEliminacion, estudiantes:[] } ]   ← "lote"
    estudiantes:  [ { id, fechaEliminacion,
                      participante:{...} } ]                  ← individual
    carnetListas: [ { id, ..., fechaEliminacion } ]
  }
}
```

**Observaciones verificadas en el código:**

- `id` de colegios, cursos, asignaciones y participantes activos se genera con `uid()` (script.js ≈ línea 30): 10 caracteres alfanuméricos aleatorios, sin colisión garantizada por diseño (probabilidad bajísima, no un UUID formal).
- `nivel` en participantes viene de `nivelDe(p, cursoMap)` (script.js línea 67): prioriza `p.nivel` normalizado → `cursoMap[p.cursoId].nivel` → texto de `p.anio`. Puede estar ausente o no-canónico en registros viejos.
- `course1` se fija al momento de generar la lista: `course1: nombreCorto` (línea 1661) — tomado de `genAsig.nombreCorto` en ese instante. **No se actualiza automáticamente** cuando se edita la asignación ni cuando se agrega un estudiante en "modo agregar".
- `agregadoEn` es opcional: solo existe en participantes añadidos mediante "modo agregar" (`_guardarListaEnModoAgregar`, línea ≈ 1981).
- `trash.participantes` y `trash.estudiantes` son conceptos distintos (verificado en mapeo.js línea 60-66): papelera de lista completa vs. baja individual. La app los trata de forma diferente al restaurar/eliminar.

### 1.2 Claves de `localStorage`

| Clave | Contenido | Quién la escribe | ¿Va al Respaldo? |
|---|---|---|---|
| `tc_organizador_data` | JSON completo de `data` — TecnoCleveland | `saveData()` | No directamente (el Respaldo es otro JSON) |
| `cc_organizador_data` | Ídem — Cleveland English Institute | `saveData()` | No |
| `tc_dark` | `'1'` si modo oscuro | `toggleDark()` | No |
| `tc_sidebar_collapsed` | `'1'` si sidebar colapsado | `toggleSidebar()` | No |
| `tc_last_backup_tecno` / `_cleveland` | Fecha ISO de último respaldo descargado | `marcarUltimoRespaldo()` | No |
| `tc_organizador_data__sync_*` | Metadatos de sincronización (baseline, rev, email, subida pospuesta) — solo en navegadores que usaron la Fase 2 | `sync.js` (retirado) | No |

Las dos primeras son **intocables** (invariante 1 de CLAUDE.md §8).

### 1.3 Flujo de lectura/escritura

```
Arranque: localStorage[STORAGE_KEY] → JSON.parse → loadData() → data
Guardar:  data → JSON.stringify → saveData() → localStorage[STORAGE_KEY]
Exportar: construirPayloadRespaldo() → data + metadatos → archivo .json
Importar: importBackup() → JSON.parse → data = { ...parsed } → saveData()
```

`loadData()` e `importBackup()` usan el patrón `parsed.x || valorPorDefecto` (líneas 277-290 y 1082-1097) para retrocompatibilidad: cualquier respaldo antiguo carga sin errores aunque le falten claves nuevas.

**`_versionEsquema = 1`** (línea 3015): hoy todos los respaldos tienen versión 1. No hay lógica de migración por versión — todo lo resuelve el `|| valorPorDefecto`.

### 1.4 Papelera — dos patrones distintos

| Tipo | JSON (trash) | Se activa con | Contiene |
|---|---|---|---|
| Lote | `trash.participantes[]` | "Guardar lista" cuando ya existe una → reemplaza el grupo entero | `{ id, colegioId, cursoId, anio, grupo, fechaEliminacion, estudiantes:[] }` |
| Individual | `trash.estudiantes[]` | Botón 🗑 por fila en Ver/Editar | `{ id, fechaEliminacion, participante:{...} }` |

La fecha de eliminación de colegios, cursos modelo y asignaciones en papelera **no se guarda** — la app no tiene ese campo en esos objetos (verificado en freshData y mapeo.js líneas 27-28). Al migrar a SQL, `mapeo.js` usa `_exportadoEn` del respaldo como aproximación.

---

### 1.5 `database/schema.sql` — qué cubre y qué falta

Verificado contra el archivo `database/schema.sql`.

| Característica | Estado en schema.sql v1 |
|---|---|
| `academia_id` en toda tabla | ✅ Sí — todas las tablas la tienen |
| Borrado lógico (`eliminado_en`) | ✅ Sí — en colegios, cursos_modelo, asignaciones, participantes, carnet_listas |
| Claves cifradas (`codigo_hash`) | ✅ Sí — en `usuarios_app` con nota de bcrypt/argon2 |
| IDs de Moodle (course ID, user ID) | ❌ No — ninguna tabla guarda el ID numérico de Moodle ni el courseid real de la plataforma |
| IDs propios del VPS (usuario real con rol) | ❌ No — `usuarios_app` existe pero no tiene roles ni relación con colegios |
| Separación estudiante/matrícula | ❌ No — `participantes` mezcla identidad (nombre, apellidos) con matrícula Moodle y asignación a curso |
| Progreso, unidades, actividades | ❌ No — fuera del alcance actual |
| Auditoría / sync_log | ❌ No |
| Restricción `UNIQUE (academia_id, username)` | ❌ Deliberadamente ausente (ver database/README.md §decisiones) |
| Vista `v_moodle_upload` | ✅ Sí — genera el CSV de carga masiva de Moodle filtrando activos |

`mapeo.js` cubre la conversión bidireccional Respaldo JSON ↔ filas SQL, incluyendo papelera lote e individual.

---

### 1.6 Usuarios y sesión — estado actual

**`login.html`** contiene un objeto `USERS` literal con códigos cortos (1-6 caracteres). Verificado: los códigos son texto plano en el archivo, visibles en el código fuente publicado y en el historial de git.

**Flujo de sesión** (sin backend):
```
doLogin() → valida código contra USERS en el cliente
          → sessionStorage.setItem('tcUser', nombre)
          → sessionStorage.setItem('tcAcademia', 'tecno'|'cleveland')
          → redirige a index.html

index.html (script inline en <head>) → lee sessionStorage
          → si falta tcUser o tcAcademia → redirige a login.html
          → si existen → classList.add('auth-ok') → body visible

academias.js → getAcademiaActual() → sessionStorage.getItem('tcAcademia')
             → ACADEMIA_ACTUAL = ACADEMIAS['tecno'|'cleveland']
             → falla silencioso → default 'tecno' si tcAcademia no existe
```

**Roles hoy:** ninguno. Solo existe el `nombre` almacenado en `sessionStorage.tcUser` (p. ej. "Administrador", "Asistente", "Ruben Mogollon"). No hay diferencias de permisos entre usuarios — todos ven y modifican todo dentro de su academia.

**Separación Tecno/Cleveland:** garantizada únicamente por `storageKey` en el cliente. No hay verificación de servidor ni de base de datos hoy.

---

## 2. Análisis de hallazgos de calidad

### 2.1 Hallazgo (a) — 112 participantes sin asignación activa

**Causa probable (verificada en el código):**

`generarListaUsuarios()` (línea 1599) exige que exista `genAsig` — la asignación del selector al momento de generar. Pero `deleteAsig()` (línea 1345) solo mueve la asignación a `trash.asignaciones` — **no actualiza ni elimina los participantes** que apuntan a esa asignación. La ruptura (colegioId, cursoId, anio) → sin asignación activa ocurre cuando:

1. Se generaron estudiantes con Asignación A.
2. Luego Asignación A se eliminó (o se editó cambiando `cursoId`).
3. Los participantes conservan el `cursoId` antiguo que ya no tiene asignación activa.

También puede ocurrir si la misma (colegio, año) tiene dos asignaciones con distintos `cursoId` y `onGenAnioChange()` (línea 1427) usa `.find()` — el primer resultado — mientras los estudiantes se generaron contra el segundo.

**¿Bug o dato histórico?** Dato histórico. La app nunca tuvo cascade-delete; por diseño, los participantes son independientes de las asignaciones una vez guardados. No es un bug del código actual: es una consecuencia documentada de que la tabla `participantes` en SQL también carece de FK que fuerce la integridad hacia `asignaciones`.

**Cómo verificarlo sin datos reales:** Crear un `ejemplo_ficticio.json` con este patrón: generar participantes con `cursoId:"idA"`, luego mover esa asignación a `trash.asignaciones`, y verificar que el query `SELECT p.username FROM participantes p WHERE NOT EXISTS (SELECT 1 FROM asignaciones a WHERE a.colegio_id=p.colegio_id AND a.curso_id=p.curso_id AND a.anio=p.anio AND a.eliminado_en IS NULL)` devuelve esas filas.

### 2.2 Hallazgo (b) — 193 participantes con `course1` ≠ `nombreCorto` actual

**Causa probable (verificada en el código):**

`course1` se fija en la generación: `course1: nombreCorto` (línea 1661 de `generarListaUsuarios`) y `course1: genAsig.nombreCorto` (línea 1733 de `importarCSVArchivo`). Las siguientes operaciones posteriores **no actualizan `course1` en participantes existentes:**

- Editar la asignación vía modal (saveAsig) — no toca participantes.
- `_aplicarEdicionNombre()` (línea 1812) — solo toca `firstname`/`lastname`, no `course1`.
- "Modo agregar" (`_guardarListaEnModoAgregar`) — conserva `course1: r.course1` del estudiante original (línea ≈ 1981).

`aplicarPlanCambioSufijo()` (línea ≈ 871) SÍ actualiza `course1`, pero solo cuando:
```js
const course1Coincide = reDash.test(p.course1 || '');
// reDash = /-sufijoViejo$/i
// Solo coincide si course1 termina exactamente en -sufijoViejo
```
Si el `course1` tenía un formato ligeramente distinto (p. ej., mayúsculas, sufijo original distinto al que se quiso cambiar), la regex no lo toca.

**El patrón en 4to–6to grado** que menciona el dueño del proyecto es consistente con esto: si en primaria se usaron sufijos distintos entre distintos colegios o distintos años de creación, y `cambiarSufijo` se aplicó solo a uno, los demás quedan con `course1` divergente respecto al `nombreCorto` actual de la asignación.

**¿Bug o dato histórico?** En su mayor parte, dato histórico de uso. La funcionalidad `cambiarSufijo` llegó en `cf9e028` (2026-10-14); cualquier divergencia previa a esa fecha no se corrigió automáticamente. No es un bug del código actual: no hay contrato ni invariante documentado que garantice que `course1 == asignacion.nombreCorto` en todo momento.

**Cómo verificarlo sin datos reales:** Con datos ficticios: generar participantes con `course1:"1styear-abc"`, editar la asignación cambiando `nombreCorto` a `"1styear-xyz"` (sin usar cambiarSufijo), y verificar la divergencia con:
```sql
SELECT p.username, p.course1, a.nombre_corto
FROM participantes p
JOIN asignaciones a ON a.colegio_id=p.colegio_id AND a.curso_id=p.curso_id AND a.anio=p.anio
WHERE p.eliminado_en IS NULL AND a.eliminado_en IS NULL
  AND p.course1 != a.nombre_corto;
```

### 2.3 Hallazgo "29 colegios activos de 28 registrados"

**Causa:** `applyAcademiaBranding()` (script.js línea 337) pone el texto `'de 28 registrados'` hardcodeado en el `stat-colegios-sub`. `renderDashboard()` (línea 451) muestra `data.colegios.length` real. Si el usuario agregó un colegio más allá del catálogo base de 28, el contador real (29) supera el texto fijo (28).

**Esto no es un bug de datos** — es inconsistencia de UI. Los datos son correctos; la etiqueta estática quedó desactualizada.

### 2.4 Hallazgo (c) — 1 username repetido

`schema.sql` documenta explícitamente la ausencia de `UNIQUE (academia_id, username)`. Puede ocurrir si alguien editó manualmente el username en la vista previa editable del Generador sin pasar por el pool. **No es un error de la app** — es un caso de uso documentado como riesgo conocido.

### 2.5 Hallazgo (d) — 3 pares de mismo nombre+colegio

Pueden ser hermanos/as con el mismo apellido compuesto, o el mismo estudiante repetido en años distintos (p. ej., repitió año). Sin ver los datos no es posible distinguirlos. La app no impide duplicados de nombres.

---

## 3. Esquema v2 propuesto

> Supuestos confirmados por el dueño del proyecto (tomados del prompt): una sola base compartida; academia_id en toda tabla; entidades academias, usuarios, roles por academia (admin, asesor, gerente); colegios; asignaciones con ids de Moodle; estudiantes (persona) separados de matrículas; grupos con unidad actual; unidades, actividades, progreso; sync_log; auditoría; borrado lógico.

### 3.1 Diagrama de entidades principales

```
academias ──< usuarios_app >── roles_academia
              │
colegios ─────< asesores_colegios (asesor ↔ colegio)
   │
asignaciones_moodle (colegio × curso_modelo × año)
   │
matriculas ────< estudiantes (persona reutilizable)
   │
grupos (unidad actual)
   │
grupo_unidades_progreso ──< unidades ──< actividades ──< progreso_actividades
```

### 3.2 DDL completo propuesto (MySQL 8 / MariaDB)

```sql
SET NAMES utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- NÚCLEO: academias, usuarios, roles
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE academias (
  id              VARCHAR(32)   NOT NULL PRIMARY KEY,
  nombre          VARCHAR(128)  NOT NULL,
  subtitulo       VARCHAR(128),
  email_dominio   VARCHAR(128),
  activa          TINYINT(1)    DEFAULT 1,
  creado_en       DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un usuario puede tener distintos roles en distintas academias
-- (p. ej. "asesor" en tecno y "solo lectura" en cleveland).
CREATE TABLE usuarios_app (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(128)  NOT NULL,
  codigo_hash     VARCHAR(255)  NOT NULL,   -- bcrypt ($2b$12$...) o argon2id
  email           VARCHAR(256),             -- futuro: para recuperación
  activo          TINYINT(1)    DEFAULT 1,
  creado_en       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  ultima_sesion   DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ENUM de roles:
--   admin    → lectura+escritura completa en su academia
--   asesor   → lectura+escritura en sus colegios asignados (tabla asesores_colegios)
--   gerente  → solo lectura en ambas academias
CREATE TABLE roles_academia (
  usuario_id      INT UNSIGNED  NOT NULL REFERENCES usuarios_app(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  rol             ENUM('admin','asesor','gerente') NOT NULL,
  activo          TINYINT(1)    DEFAULT 1,
  asignado_en     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, academia_id),
  INDEX idx_academia_rol (academia_id, rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- COLEGIOS Y ASESORES
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE colegios (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256)  NOT NULL,
  orden           INT UNSIGNED  DEFAULT 0,
  eliminado_en    DATETIME      DEFAULT NULL,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Relación asesor ↔ colegio (un asesor puede tener varios colegios,
-- un colegio puede tener varios asesores, siempre dentro de la misma academia).
CREATE TABLE asesores_colegios (
  usuario_id      INT UNSIGNED  NOT NULL REFERENCES usuarios_app(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24)   NOT NULL REFERENCES colegios(id),
  activo          TINYINT(1)    DEFAULT 1,
  desde           DATETIME      DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usuario_id, academia_id, colegio_id),
  -- Garantía de cruce: el colegio debe pertenecer a la misma academia del rol
  INDEX idx_colegio_academia (colegio_id, academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- CURSOS MODELO Y ASIGNACIONES (con IDs de Moodle)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE cursos_modelo (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256)  NOT NULL,
  nivel           ENUM('media','primaria') NOT NULL,
  moodle_course_id INT UNSIGNED DEFAULT NULL,  -- ID numérico del curso en Moodle (si se conoce)
  orden           INT UNSIGNED  DEFAULT 0,
  eliminado_en    DATETIME      DEFAULT NULL,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE asignaciones_moodle (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24)   NOT NULL REFERENCES colegios(id),
  curso_id        VARCHAR(24)   NOT NULL REFERENCES cursos_modelo(id),
  anio            VARCHAR(32)   NOT NULL,   -- "1er Año", "3er Grado", etc.
  fecha_copia     DATE,
  nombre_completo VARCHAR(256),
  nombre_corto    VARCHAR(128),             -- shortname del curso en Moodle
  moodle_course_id INT UNSIGNED DEFAULT NULL, -- ID del curso COPIADO en Moodle
  clases          INT UNSIGNED  DEFAULT 0,
  notas           TEXT,
  orden           INT UNSIGNED  DEFAULT 0,
  eliminado_en    DATETIME      DEFAULT NULL,
  -- Un mismo (colegio, año) puede no tener asignación, pero si la tiene
  -- no debería repetirse el mismo curso_id para el mismo año (⚠ pendiente):
  INDEX idx_colegio_anio (colegio_id, anio),
  INDEX idx_academia (academia_id),
  INDEX idx_curso (curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- ESTUDIANTES (persona) SEPARADOS DE MATRÍCULAS
-- ══════════════════════════════════════════════════════════════════

-- "Estudiante" = identidad de la persona. Puede estar en varios colegios
-- y años (p. ej., si se transfiere o repite). El username de Moodle no
-- pertenece aquí: es parte de la matrícula.
CREATE TABLE estudiantes (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  nombres         VARCHAR(256)  NOT NULL,
  apellidos       VARCHAR(256)  NOT NULL,
  fecha_nacimiento DATE          DEFAULT NULL,  -- ⚠ pendiente: ¿se almacenará?
  eliminado_en    DATETIME      DEFAULT NULL,
  INDEX idx_academia (academia_id),
  INDEX idx_nombre (academia_id, apellidos, nombres)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "Matrícula" = la relación entre un estudiante y una asignación Moodle
-- para un año concreto, con su usuario/clave Moodle específicos.
CREATE TABLE matriculas (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  estudiante_id   VARCHAR(24)   NOT NULL REFERENCES estudiantes(id),
  asignacion_id   VARCHAR(24)   NOT NULL REFERENCES asignaciones_moodle(id),
  -- Campos Moodle (pueden cambiar con cambiarSufijo sin alterar la identidad):
  username        VARCHAR(128),
  password        VARCHAR(128),
  email           VARCHAR(256),
  city            VARCHAR(128),
  country         VARCHAR(128)  DEFAULT 'Venezuela',
  role1           VARCHAR(32)   DEFAULT 'student',
  enrolperiod1    VARCHAR(16)   DEFAULT '365d',
  suspended       CHAR(1)       DEFAULT '0',
  moodle_user_id  INT UNSIGNED  DEFAULT NULL,   -- ID del usuario en Moodle (si se conoce)
  -- Metadatos:
  fecha_generacion DATE,
  agregado_en     DATETIME      DEFAULT NULL,   -- solo si fue añadido con "modo agregar"
  eliminado_en    DATETIME      DEFAULT NULL,
  lote_baja       VARCHAR(24)   DEFAULT NULL,   -- agrupa bajas por lista (retrocompat)
  tipo_papelera   ENUM('lote','individual') DEFAULT NULL,
  orden           INT UNSIGNED  DEFAULT 0,
  UNIQUE KEY uk_username_academia (academia_id, username),  -- ⚠ ver §5.2
  INDEX idx_estudiante (estudiante_id),
  INDEX idx_asignacion (asignacion_id),
  INDEX idx_academia (academia_id),
  INDEX idx_lote_baja (lote_baja)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- GRUPOS, UNIDADES Y PROGRESO
-- ══════════════════════════════════════════════════════════════════

-- Un grupo agrupa matrículas de la misma asignación (p. ej. "Grupo A" de "3er Año").
-- group1 en la app actual ya existe como campo libre en los participantes.
CREATE TABLE grupos (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  asignacion_id   VARCHAR(24)   NOT NULL REFERENCES asignaciones_moodle(id),
  nombre_grupo    VARCHAR(64)   DEFAULT '',   -- vacío = sin grupo
  unidad_actual   TINYINT UNSIGNED DEFAULT 1,
  activo          TINYINT(1)    DEFAULT 1,
  INDEX idx_asignacion (asignacion_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE grupo_matriculas (
  grupo_id        VARCHAR(24)   NOT NULL REFERENCES grupos(id),
  matricula_id    VARCHAR(24)   NOT NULL REFERENCES matriculas(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  PRIMARY KEY (grupo_id, matricula_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE unidades (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  curso_id        VARCHAR(24)   NOT NULL REFERENCES cursos_modelo(id),
  numero          TINYINT UNSIGNED NOT NULL,
  titulo          VARCHAR(256),
  descripcion     TEXT,
  INDEX idx_curso (curso_id, numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE actividades (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  unidad_id       INT UNSIGNED  NOT NULL REFERENCES unidades(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  titulo          VARCHAR(256)  NOT NULL,
  tipo            ENUM('clase','tarea','evaluacion','otro') DEFAULT 'clase',
  orden           TINYINT UNSIGNED DEFAULT 0,
  visible         TINYINT(1)    DEFAULT 1,   -- publicada/visible para asesores
  INDEX idx_unidad (unidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Progreso por matrícula × actividad
CREATE TABLE progreso_actividades (
  matricula_id    VARCHAR(24)   NOT NULL REFERENCES matriculas(id),
  actividad_id    INT UNSIGNED  NOT NULL REFERENCES actividades(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  estado          ENUM('pendiente','en_progreso','completado') DEFAULT 'pendiente',
  nota            DECIMAL(5,2)  DEFAULT NULL,
  observaciones   TEXT,
  actualizado_en  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (matricula_id, actividad_id),
  INDEX idx_matricula (matricula_id),
  INDEX idx_actividad (actividad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- CARNETS (igual que v1, sin cambios estructurales)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE carnet_listas (
  id              VARCHAR(24)   NOT NULL PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  nivel           ENUM('media','primaria') NOT NULL,
  grado           TINYINT UNSIGNED NOT NULL,
  seccion         VARCHAR(8),
  clave           VARCHAR(64)   NOT NULL,
  orden           INT UNSIGNED  DEFAULT 0,
  eliminado_en    DATETIME      DEFAULT NULL,
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE carnet_estudiantes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lista_id        VARCHAR(24)   NOT NULL REFERENCES carnet_listas(id),
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  usuario         VARCHAR(128),
  apellidos       VARCHAR(256),
  nombres         VARCHAR(256),
  orden           INT UNSIGNED  DEFAULT 0,
  INDEX idx_lista (lista_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE carnet_opciones (
  academia_id     VARCHAR(32)   NOT NULL PRIMARY KEY REFERENCES academias(id),
  layout          VARCHAR(16)   DEFAULT 'big',
  url             VARCHAR(256),
  upper           TINYINT(1)    DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ══════════════════════════════════════════════════════════════════
-- AUDITORÍA Y SINCRONIZACIÓN
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE auditoria (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL,
  usuario_id      INT UNSIGNED,             -- NULL si fue operación del sistema
  tabla           VARCHAR(64)   NOT NULL,
  operacion       ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  registro_id     VARCHAR(64)   NOT NULL,   -- id del registro afectado
  datos_antes     JSON          DEFAULT NULL,
  datos_despues   JSON          DEFAULT NULL,
  realizado_en    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tabla_registro (tabla, registro_id),
  INDEX idx_academia_fecha (academia_id, realizado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Log de sincronización entre dispositivos (para cuando sync-rest.js se active)
CREATE TABLE sync_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academia_id     VARCHAR(32)   NOT NULL REFERENCES academias(id),
  dispositivo     VARCHAR(128),             -- nombre/agente del dispositivo
  tipo            ENUM('subida','descarga','conflicto') NOT NULL,
  rev_antes       INT UNSIGNED  DEFAULT 0,
  rev_despues     INT UNSIGNED  DEFAULT 0,
  cambios_count   INT UNSIGNED  DEFAULT 0,
  realizado_en    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_academia_fecha (academia_id, realizado_en)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

### 3.3 Matriz de permisos

| Operación | admin | asesor | gerente |
|---|:---:|:---:|:---:|
| Ver todos los colegios de su academia | ✅ | Solo los asignados en `asesores_colegios` | ✅ (ambas academias) |
| Crear/editar/eliminar colegios | ✅ | ❌ | ❌ |
| Ver participantes/matrículas de sus colegios | ✅ | ✅ | ✅ lectura |
| Crear/editar matrículas | ✅ | ✅ (sus colegios) | ❌ |
| Ver progreso de sus estudiantes | ✅ | ✅ (sus colegios) | ✅ lectura |
| Actualizar progreso | ✅ | ✅ (sus colegios) | ❌ |
| Ver datos de otra academia | ❌ | ❌ | ✅ lectura |
| Crear/editar usuarios_app | ✅ | ❌ | ❌ |
| Asignar roles | ✅ | ❌ | ❌ |
| Ver log de auditoría | ✅ | ❌ | ✅ lectura |

**Implementación en el backend VPS:** cada endpoint de la API verifica:
1. Token de sesión válido → obtiene `usuario_id`.
2. Rol del usuario en `roles_academia` para la `academia_id` de la entidad solicitada.
3. Para asesor: verifica además que el `colegio_id` esté en `asesores_colegios` para ese usuario.
4. Para gerente: solo permite operaciones GET.

La separación Tecno/Cleveland se garantiza en toda consulta con `WHERE academia_id = :academia_id` derivado del token, nunca del parámetro de la petición.

---

## 4. Plan de migración desde respaldo .json → esquema v2

### 4.1 Paso 0 — Exportar y validar el respaldo actual

```bash
# Desde la app (vista Respaldo → "Descargar respaldo")
# Verificar con el script existente:
node database/scripts/respaldo_a_sql.js respaldo_tecno_FECHA.json --sqlite /tmp/tecno_v1.db
# Confirmar que test_idavuelta.js pasa con ese respaldo (requiere Node ≥ 22):
node database/scripts/test_idavuelta.js
```

### 4.2 Reglas de limpieza antes de migrar

| Hallazgo | Regla propuesta | ⚠ Decisión pendiente |
|---|---|---|
| (a) 112 participantes sin asignación | Insertar en `matriculas` con `asignacion_id = NULL` (columna nullable), o crear asignaciones "fantasma" marcadas. | ¿Se quieren conservar o ignorar estos participantes? |
| (b) 193 con `course1` ≠ `nombreCorto` | Migrar con el `course1` real de la fila (dato histórico). En `matriculas`, `course1` ya no es la fuente de verdad — lo es `asignaciones_moodle.nombre_corto`. | Aceptar la divergencia histórica o corregirla manual antes de migrar. |
| (c) 1 username duplicado | Antes de activar `UNIQUE KEY uk_username_academia`: `SELECT username, COUNT(*) ... GROUP BY username HAVING COUNT(*)>1`. Resolver a mano (renombrar o marcar una como eliminada). | Decisión del dueño: ¿cuál de los dos registros es el correcto? |
| (d) Mismo nombre+colegio | Solo informativo. No bloquea la migración. | Verificar si son hermanos o duplicados reales. |
| Panel "29 de 28" | Dato correcto en v2 (no hay texto fijo). Sin acción en migración. | — |

### 4.3 Reconstruir `estudiantes` a partir de `participantes`

El respaldo v1 no tiene entidad "persona" — solo tiene participantes que mezclan identidad y matrícula. La migración debe **deduplicar por nombre**:

```sql
-- Estrategia simplificada (ficticia, solo como ejemplo de lógica):
-- 1. Insertar un "estudiante" único por (academia_id, nombres_normalizados, apellidos_normalizados)
-- 2. Insertar una "matricula" por cada participante, enlazada al estudiante correspondiente
-- Problema: si dos participantes tienen exactamente el mismo nombre, ¿son la misma persona?
```

⚠ **Pendiente de confirmar:** la app nunca garantizó unicidad de nombres. La deduplicación automática tiene riesgo de fusionar personas distintas. Propuesta segura: migrar cada participante como un `estudiante` distinto (1:1), sin deduplicar, y dejar la normalización como tarea posterior manual o con una herramienta de deduplicación asistida.

### 4.4 Tratar la papelera en v2

Los dos tipos de papelera de v1 se mapean a campos en `matriculas` (v2):

| v1 trash | v2 matriculas |
|---|---|
| `trash.participantes` (lote) | `eliminado_en` = `fechaEliminacion`, `lote_baja` = `id del lote`, `tipo_papelera='lote'` |
| `trash.estudiantes` (individual) | `eliminado_en` = `fechaEliminacion`, `lote_baja` = `id del registro`, `tipo_papelera='individual'` |

Colegios y cursos en papelera usan `eliminado_en` aproximada (`_exportadoEn` del respaldo, como ya hace `mapeo.js`).

### 4.5 Retrocompatibilidad con respaldos .json antiguos

El formato del Respaldo v1 (objeto `data` + metadatos `_academia`, `_versionEsquema:1`, etc.) sigue importándose igual en la app cliente. El backend VPS recibirá ese mismo JSON desde `importBackup()` y lo procesará con la lógica de `mapeo.js` (adaptada a v2). No se rompe ningún respaldo antiguo: el campo `_versionEsquema` permite bifurcar la lógica en el servidor si en el futuro se produce un esquema v3.

---

## 5. Riesgos y decisiones pendientes

### 5.1 Menores de edad

Los nombres y apellidos de los estudiantes son potencialmente datos de menores de edad. Implicaciones:

- En muchos países (incluyendo Venezuela) existe legislación sobre protección de datos de menores aunque no sea tan específica como el GDPR europeo.
- El servidor VPS debe tener acceso restringido: HTTPS obligatorio, sin exposición a internet pública de la base de datos, sin logs que contengan nombres.
- Los respaldos `.json` locales contienen estos datos en texto plano — no cifrados. El `.gitignore` los excluye; no comprometerlos nunca.
- ⚠ **Pendiente de confirmar:** ¿hay política de retención de datos? ¿Por cuánto tiempo se deben conservar los registros de estudiantes que ya terminaron el programa?

### 5.2 Almacenamiento de claves de Moodle

`password` se almacena en texto plano tanto en v1 como en el esquema SQL propuesto. Las contraseñas de Moodle no son contraseñas de la app — son credenciales generadas masivamente (p. ej. "1234") para carga inicial. Sin embargo:

- ⚠ Si algún estudiante cambió su contraseña en Moodle, el valor en la app quedó desactualizado. No hay sincronización inversa.
- **No cifrar `password`** en la BD si se necesita exportar el CSV de Moodle (Moodle necesita la clave en texto plano para la carga inicial). Si la clave fue cambiada en Moodle, la columna es irrelevante.
- Sí cifrar `codigo_hash` de `usuarios_app` (ya está previsto en el esquema v1 con bcrypt/argon2).

### 5.3 Unicidad de `username` en `matriculas`

El esquema v2 incluye `UNIQUE KEY uk_username_academia (academia_id, username)` — más estricto que v1. Antes de activarlo:
1. Ejecutar el query de duplicados del §4.2 hallazgo (c).
2. Resolver el duplicado.
3. Solo entonces crear la restricción.

⚠ La restricción debe ser `(academia_id, username)` y no solo `username`, para permitir que Tecno y Cleveland puedan tener el mismo username sin conflicto.

### 5.4 IDs de Moodle (`moodle_course_id`, `moodle_user_id`)

El esquema v2 tiene columnas opcionales `moodle_course_id` e `moodle_user_id` (ambas `DEFAULT NULL`). Hoy la app no los tiene — se populan si en el futuro la API VPS consulta Moodle para obtenerlos.

⚠ **Pendiente de confirmar:** ¿se va a integrar la API VPS con la API REST de Moodle? Los `Workflows/*.md` ya tienen runbooks para la API REST de Moodle; decidir si el VPS los automatiza o si siguen siendo procesos manuales.

### 5.5 Roles y acceso real

Hoy hay 3 usuarios fijos en `login.html` (2 de Tecno, 1 de Cleveland), sin roles diferenciados. El esquema v2 propone admin/asesor/gerente.

⚠ **Pendiente de confirmar:**
- ¿Cuántos usuarios reales habrá? ¿Solo los dueños del proyecto o también los asesores de cada colegio?
- ¿El rol "asesor" debe poder agregar estudiantes o solo ver progreso?
- ¿El rol "gerente" es para una persona que supervisa ambas academias? ¿Quién?

### 5.6 Progreso y actividades

La tabla `progreso_actividades` propuesta asume que la app va a registrar a qué unidad y actividad llegó cada estudiante. Hoy la app no tiene este concepto.

⚠ **Pendiente de confirmar:** ¿qué exactamente se va a controlar? (ver CLAUDE.md §14, pregunta 1). El esquema propone `estado` + `nota` por actividad, pero sin saber qué se quiere medir, puede ser demasiado o insuficiente.

### 5.7 Tecnología del backend VPS

⚠ **Pendiente de confirmar:** ¿MySQL/MariaDB en Contabo, o PostgreSQL? El esquema usa sintaxis MySQL/MariaDB (igual que `schema.sql` v1). `database/README.md` tiene notas de adaptación a PostgreSQL.

### 5.8 Deuda técnica que afecta la migración

- `deleteAsig()` (script.js línea 1345) no actualiza ni elimina participantes. Si antes de migrar se desea corregir el hallazgo (a), hay que decidir la política.
- El panel muestra "de 28 registrados" hardcodeado — en v2, el backend devuelve el conteo real. La app cliente deberá actualizarse para leer el número del servidor.
- `course1` en la app cliente no es la fuente de verdad en v2 — lo es `asignaciones_moodle.nombre_corto`. Cualquier "cambiarSufijo" futuro actualiza la BD directamente, sin depender del regex de la app.

---

## 6. Lo que se leyó y verificó / lo que NO se pudo verificar

### Verificado contra el código

| Elemento | Dónde | Verificado |
|---|---|---|
| Esquema completo de `data` (todas las claves, incluyendo papelera) | `script.js` líneas 257–297 y 1063–1112 | ✅ |
| `freshData()` — catálogos por defecto solo en Tecno | `script.js` línea 257 | ✅ |
| `loadData()` / `saveData()` / `importBackup()` — flujo, retrocompat | `script.js` líneas 270–306 y 1063–1112 | ✅ |
| `construirPayloadRespaldo()` — metadatos del respaldo | `script.js` líneas 3015–3042 | ✅ |
| `generarListaUsuarios()` — cómo se fija `course1` | `script.js` línea 1661 | ✅ |
| `construirPlanCambioSufijo()` — cuándo sí/no actualiza `course1` | `script.js` líneas 743–800 | ✅ |
| `deleteAsig()` — no actualiza participantes | `script.js` línea 1345 | ✅ |
| `_aplicarEdicionNombre()` — no toca `course1` | `script.js` línea 1812 | ✅ |
| Panel "28 hardcodeado" | `script.js` línea 337 y `index.html` línea 150 | ✅ |
| `academias.js` — estructura de ACADEMIAS, storageKey, emailDominio | `academias.js` líneas 1–36 | ✅ |
| `login.html` — flujo de sesión, `sessionStorage`, USERS (sin reproducir códigos) | `login.html` líneas 141–184 | ✅ |
| `schema.sql` v1 — tablas, índices, ausencias | `database/schema.sql` completo | ✅ |
| `mapeo.js` — conversión bidireccional JSON ↔ SQL | `database/scripts/mapeo.js` completo | ✅ |
| `database/README.md` — decisiones del esquema (username no UNIQUE, etc.) | `database/README.md` completo | ✅ |
| `ejemplo_ficticio.json` — formato real del respaldo | `database/scripts/ejemplo_ficticio.json` completo | ✅ |

### NO se pudo verificar (sin datos reales ni navegador)

- Confirmar que las 112 y 193 cifras del hallazgo (a)/(b) son exactas — se verificaron las causas de código, no los conteos específicos del respaldo del dueño.
- Confirmar la causa exacta del username duplicado (c) y los pares de nombre (d) — requieren ver los datos.
- Si hay datos de Cleveland English Institute en el respaldo (el dueño mencionó solo el de Tecno).
- Si `moodle_user_id` ya existe en algún registro exportado de la plataforma Moodle real.
- Comportamiento real en navegador de cualquier función que toca el DOM.
- El estado real del servidor Contabo (si ya está adquirido, configurado, etc.).

---

**ESPERANDO APROBACIÓN**

### Mensaje de commit sugerido (no ejecutar)

```
docs: añadir diseño de base de datos v2 para sistema de control de estudio

Diagnóstico de almacenamiento actual + análisis de hallazgos de calidad
(colegios huérfanos, course1 divergente, username duplicado) + esquema
SQL v2 propuesto con estudiantes separados de matrículas, roles/academia
y tablas de progreso. Sin cambios de código.
```
