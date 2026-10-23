# Diseño de base de datos v2.6 — Sistema de control de estudio

**Versión:** 2.6 · **Fecha:** 2026-10-23 · **Autor:** Claude Code (CHECK constraints, sync_aplicar_estructura, sync_inicializar_publicada_en, sync_worker real DDL + RLS)
**Estado:** borrador para revisión del dueño del proyecto

> **Principio:** el código manda. Lo documentado aquí se verificó contra el código real del repositorio. Las secciones marcadas con ⚠ "Pendiente de confirmar" requieren decisión del dueño antes de implementar; el resto refleja decisiones ya tomadas o propuestas aceptadas en la revisión v2.

---

## Cambios respecto a v2.5

| Sección | Qué cambió en v2.6 |
|---|---|
| `database/postgres/schema.sql` | `v2.6`; `CONSTRAINT chk_sec_ausente CHECK (ausente_en IS NULL OR ausencias_consecutivas >= 2)` en `secciones_moodle`; `CONSTRAINT chk_act_ausente ...` en `actividades_moodle`; función `sync_aplicar_estructura(p_asignacion, p_cmids BIGINT[], p_token_ok)` SECURITY INVOKER; función `sync_inicializar_publicada_en(p_asignacion)` SECURITY INVOKER; `sync_worker` DDL real (CREATE ROLE + GRANTs por columna + 9 políticas RLS) — ya no es propuesta comentada; REVOKE/GRANT EXECUTE en funciones |
| `database/postgres/tests/test_integridad.sql` | Part 1: actividad 15 fija `ausencias_consecutivas=2` (requerido por CHECK); `setval` para sincronizar secuencias tras INSERTs explícitos; PRE-TEST A (verifica CHECK activo), PRE-TEST B (verifica función existe); TESTS 23-25 reescritos para llamar `sync_aplicar_estructura` con entradas reales; TEST 26 reescrito para llamar `sync_inicializar_publicada_en`; PARTE 3b: TESTS 27-32 para `sync_worker` (0 filas sin academia, aislamiento de academia, 5 operaciones del §3.4, password_enc/enc_iv denegados, tablas sensibles denegadas); 58 NOTICEs totales, todos OK contra PostgreSQL 16 |
| §3.3 | `sync_worker` pasa de propuesta comentada a DDL real; corrección del razonamiento: la separación de academias la impone la RLS (igual que `app_user`), no los GRANTs de tabla; `consultado_en` del §3.4 mapeado a `fecha_consulta_moodle` en el esquema; CHECK constraints documentados en ambas tablas de estructura |
| §3.6 | Lógica del worker reemplazada por llamadas reales a `sync_aplicar_estructura` y `sync_inicializar_publicada_en`; invariante CHECK documentado |
| §6 | Salida psql actualizada a v2.6: 58 NOTICEs, todos OK |

---

## Cambios respecto a v2.4

| Sección | Qué cambió en v2.5 |
|---|---|
| `database/postgres/schema.sql` | `v2.5`; `ausencias_consecutivas SMALLINT DEFAULT 0 NOT NULL` añadida a `secciones_moodle` y `actividades_moodle`; `uk_sync_queue_pendiente` extendido a `estado IN ('pendiente', 'en_proceso')`; corrección frase REVOKE TEMPORARY; documentación del rol `sync_worker` con DDL propuesto |
| `database/postgres/tests/test_integridad.sql` | TEST 22 extendido a (a/b/c) cubriendo `en_proceso`; nuevos TEST 23 (1 miss no marca, 2 sí marcan), TEST 24 (reaparición limpia ausente_en), TEST 25 (visible=FALSE no marca ausente), TEST 26 (publicada_en propaga a sección); 46 NOTICEs, todos OK contra PostgreSQL 16 |
| §3.3 | REVOKE TEMPORARY corregido: bloquea PUBLIC, el dueño de BD y roles con TEMPORARY explícito conservan el permiso; nueva sección rol `sync_worker` con justificación de separación |
| §3.6 | Salvaguardas (a)/(b)/(c) para `ausente_en` documentadas con lógica completa del worker; propagación de `publicada_en` a la sección cuando se inicializa por evidencia de completados |
| §4.4 | Etiquetas "v2.2" corregidas a "v2.5" |
| §6 | Cabecera y salida de psql actualizadas a v2.5 (46 NOTICEs, todos OK) |
| Mensaje de commit | Actualizado a v2.5 |

---

## Cambios respecto a v2.3

| Sección | Qué cambió en v2.4 |
|---|---|
| `database/postgres/schema.sql` | `v2.4`; `ausente_en TIMESTAMPTZ` en `secciones_moodle` y `actividades_moodle`; `login_usuario()` → `SET search_path = public, pg_temp` + nombres cualificados `public.usuarios_app`/`public.roles_academia`; tabla `sync_queue` con FK compuesta `(asignacion_id, academia_id)`, índice parcial `uk_sync_queue_pendiente` (estado='pendiente'), RLS, GRANT SELECT/INSERT/UPDATE; comentario de despliegue `REVOKE TEMPORARY ON DATABASE`; GRANT explícito para `sync_queue` |
| `database/postgres/tests/test_integridad.sql` | Tests 9, 9b, 9c reescritos con aserciones concretas. TEST 9: LEFT JOIN en lugar de CROSS JOIN (reproduce bug de 0 filas con rango vacío), valores esperados Ana=2/4/50.0 y Carlos=1/4/25.0. TEST 9b: verifica promedio=37.5. TEST 9c: CTE con INNER JOIN (corrige el bug de rango de unidades), verifica CEU=3/25.0 y CEJ=1/0.0. Nuevos: TEST 9_EMPTY_RANGO (bug: CROSS JOIN con rango vacío), TEST 9_RANGO_COLEGIO (bug: LEFT JOIN no filtraba por rango), TEST 20 (temp table hijacking en login_usuario()), TEST 21 (ausente_en excluye de elegibles), TEST 22 (sync_queue índice parcial). Datos de prueba: actividad 15 con ausente_en=NOW(). TEST 6 actualizado a 19 tablas. |
| §3.3 | Eliminada `enc_etiqueta` de la tabla de cambios v2.2 (ya no existe); `v_moodle_upload` con `security_invoker=true` y GRANT documentados; `login_usuario()` con hardening search_path documentado; GRANT/REVOKE reales listados |
| §3.4 | Advertencia de privacidad a la alternativa de BD de Moodle; sync completo periódico (nocturno) documentado; bug incremental por último acceso detallado |
| §3.5 | Consultas corregidas: CROSS JOIN → LEFT JOIN en avance por estudiante; CTE con INNER JOIN en desglose por colegio; `ausente_en IS NULL` en criterio de elegibilidad |
| §3.6 | `publicada_en` documentada como fecha de observación, no de publicación real; inicialización al lanzar el sistema; `ausente_en` para actividades/secciones borradas en Moodle |
| §6 | Cifras 112 y 193 marcadas como verificadas contra el respaldo real |

---

## Cambios respecto a v2.2

| Sección | Qué cambió en v2.3 |
|---|---|
| `database/postgres/schema.sql` | `v_moodle_upload` con `security_invoker=true`; GRANT SELECT sobre la vista después de crearla (no la cubre el GRANT previo); REVOKE UPDATE/DELETE en `auditoria` e `intentos_login`; restricción de columnas en `usuarios_app` (sin acceso directo a `password_hash`); función `login_usuario()` SECURITY DEFINER para el camino de login; `publicada_en` en `secciones_moodle` y `actividades_moodle`; columna `clave_obsoleta BOOLEAN` en lugar de convenio `enc_version=0`; eliminado `enc_etiqueta` (el AAD de GCM se recalcula, no se guarda; la etiqueta de autenticación de 16 bytes se concatena al ciphertext en `password_enc`); documentación del patrón `SET LOCAL` obligatorio por request |
| `database/postgres/tests/test_integridad.sql` | Reestructurado en 4 partes: datos base en COMMIT separado (un superusuario bypasea RLS y no puede probar las políticas reales); pruebas estructurales como superusuario; pruebas de RLS con `SET LOCAL ROLE app_user` sin WHERE manual (prueban las políticas reales); limpieza. Tests 6/6b/6c reescritos. Nuevos: test 9b (promedio de grupo completo), 9c (desglose por colegio con `el2.id` correcto y rango `numero_unidad`), 12b (`unidad_actual_auto` igual para todos los grupos de una asignación), 13 (0 filas ajenas con academia=tecno), 14 (INSERT entre academias bloqueado), 15 (UPDATE entre academias → 0 filas), 16 (DELETE entre academias → 0 filas), 17 (vista sin fugas), 18 (auditoría inmutable), 19 (camino de login con función SECURITY DEFINER) |
| §3.3 RLS (límites) | Límites documentados: el solo-lectura de asesor/gerente lo impone la API, no la BD (propuesta de rol `app_reader` de solo lectura en la BD); la RLS depende de una variable de sesión modificable por quien ejecute SQL → la API DEBE usar `SET LOCAL` dentro de una transacción por request |
| §3.4 Sincronización | Estimación rehecha con datos reales de Tecno (301 asignaciones, 8.732 participantes); eliminado el límite inventado de "30 req/min"; ritmo como parámetro configurable con tiempos calculados; `primer_acceso` ← `firstaccess` (no `lastcourseaccess`); `core_availability_info` eliminado (no aparece en la documentación oficial de Moodle); `availabilityinfo` y `uservisible` de `core_course_get_contents` documentados (texto, no condiciones estructuradas); bug MDL-85036 documentado (no usar `core_completion_get_activities_completion_status` para eligibilidad); token de servicio necesita capacidad para ver secciones y actividades ocultas; alternativa de usuario de solo lectura a la BD de Moodle evaluada |
| §3.5 Consultas | `el2.actividad_id` → `el2.id` (columna correcta); desglose acepta rango de `numero_unidad`; promedio de grupo completado (ya no es CTE de relleno) |
| §3.6 Progreso | `publicada_en` en secciones y actividades; elegible = "publicada alguna vez" (no "visible ahora"); el sync conserva el último progreso leído cuando una actividad se oculta; `unidad_actual_auto` es la misma para todos los grupos de una asignación (la diferencia por grupo solo existe vía `unidad_actual_manual`) |
| §5.2 Cifrado | Separación de conceptos: el AAD de GCM (`academia_id:id`) se recalcula en la app y NO se guarda; la etiqueta de autenticación GCM de 16 bytes se concatena al ciphertext en `password_enc`; columna `clave_obsoleta BOOLEAN` en lugar del convenio `enc_version=0` |

---

## Cambios respecto a v2.1

| Sección | Qué cambió en v2.2 |
|---|---|
| `database/postgres/schema.sql` (nuevo) | DDL extraído al archivo |
| `database/postgres/tests/test_integridad.sql` (nuevo) | 12 pruebas escritas (no ejecutadas en v2.2) |
| §3.3 DDL | `tipo_modulo` ENUM → TEXT (modname de Moodle); `moodle_completado` CHECK 0..3; `secciones_moodle.numero_unidad` añadido; `UNIQUE (id, academia_id)` y `UNIQUE (id, asignacion_id)` en todas las tablas que lo necesitan |
| §3.3 FK compuesta `grupo_id` | Cambiada a `ON DELETE RESTRICT` (evita anular `academia_id` accidentalmente); nueva FK `(grupo_id, asignacion_id)` garantiza mismo grupo-asignación |
| §3.3 `matriculas` | `anio` y `nivel` eliminados (se derivan por JOIN); `enc_iv` → 12 bytes; añadido `enc_version`; `enc_etiqueta` **no existe** (AAD se recalcula, no se guarda — ver §5.2); `UNIQUE (id, asignacion_id)` |
| §3.3 `progreso_actividades` | `asignacion_id` añadido; FKs compuestas por academia y por asignación; evita cruzar matrícula y actividad de distinta asignación |
| §3.3 FKs faltantes | `moodle_sync_log`, `carnet_estudiantes`, `auditoria`, `migracion_cuarentena` añaden FK compuesta con `academia_id` |
| §3.3 Índice `uk_asig_activa` | Nuevo índice parcial: impide dos asignaciones activas para `(colegio, academia, curso, año)` |
| §3.3 RLS | Extendida a **todas** las tablas con `academia_id`; `FORCE ROW LEVEL SECURITY`; rol `app_user` sin ownership; gerente usa lista CSV en `app.academia_ids`; sin `academia_ids` → 0 filas |
| §3.3 `v_moodle_upload` | `firstname` corregido a `username \|\| ' ' \|\| nombres` (igual que `buildUsuariosCSV()`); `group1` devuelve nombre del grupo, no su id |
| §3.4 Sincronización | Funciones de API Moodle confirmadas; paso inicial de resolución de IDs; lectura de último acceso; finalización por estudiante+curso; estimación de llamadas para Tecno (v2.2: supuestos ficticios); sincronización incremental con cola |
| §3.5 Consultas | Corregidas para aceptar rango de unidades; usan estados 0-3; no usan `anio`/`nivel` de `matriculas` |
| §3.6 Unidad actual | Derivada de secciones publicadas (visibles) por el docente, no de mayoría de completados |
| §3.7 Permisos | Asesor y gerente pueden pulsar "Actualizar avance" con límite de frecuencia; actualizado en tabla y en `roles_academia` |
| §4.2(b) | Resolución contra matrícula real de Moodle (no solo nombre corto) |
| §4.2(c) | Duplicado de username buscado por academia (no por colegio) |
| §4.3 | Migración 1:1 elegida (sin deduplicar); eliminada frase que decía lo contrario |
| §5.2 Claves de Moodle | Eliminada afirmación incorrecta de poner NULL al detectar cambio; marcadas como "clave inicial" posiblemente obsoleta tras primer acceso; IV 12 bytes documentado; `enc_version` (versión de clave de cifrado); `enc_etiqueta` **no existe** (ver §5.2) |
| §5.5 Códigos de acceso | Codes redactados con `<código actual>` en texto del documento |

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

## 3. Esquema v2.4

### 3.1 Motor de base de datos: PostgreSQL (elegido)

**Comparativa para este caso:**

| Criterio | PostgreSQL | MariaDB |
|---|---|---|
| Índice único parcial (`WHERE eliminado_en IS NULL`) | ✅ Nativo | ❌ No disponible; requiere columna generada + índice o trigger |
| FKs compuestas con `(id, academia_id)` | ✅ Estándar SQL | ✅ Con misma sintaxis |
| Row-Level Security (`CREATE POLICY`) | ✅ Sí — separación Tecno/Cleveland a nivel de BD | ❌ No existe; debe hacerse en la app |
| JSONB para auditoría | ✅ Con índices GIN | Parcial: JSON sin índices binarios en MariaDB ≤11 |
| Tipo `TIMESTAMPTZ` con zona horaria | ✅ | Parcial: `DATETIME` sin zona |
| Encriptación con `pgcrypto` en el servidor | ✅ Extensión nativa | Requiere plugin externo |
| Familiaridad con el proyecto | Nuevo | `schema.sql` v1 es MariaDB; `database/README.md` tiene notas de adaptación |

**Decisión: PostgreSQL.** El índice parcial para username-único-entre-activos es por sí solo argumento suficiente; RLS añade defensa en profundidad para la separación de academias sin depender solo de la app.

**Adaptaciones requeridas en `database/scripts`:**

- `sqlite-schema.js` y `respaldo_a_sql.js` generan SQLite/MySQL: siguen siendo útiles para pruebas locales sin servidor. Para producción hay que añadir un `respaldo_a_pg.js` que genere `COPY ... FROM STDIN` o sentencias `INSERT` compatibles con PostgreSQL.
- `mapeo.js` no produce SQL directamente — produce objetos en memoria — y no necesita cambios.
- `sql_a_respaldo.js` usa `node:sqlite`; para PostgreSQL se necesitaría una variante con `pg` (driver de Node para PostgreSQL). Los tests de ida y vuelta seguirían funcionando via SQLite para verificar la lógica de mapeo.
- `test_idavuelta.js`, `test_sync_core.js` y `test_sync_dos_dispositivos.js` no tocan SQL de producción: siguen aplicando sin cambio.

### 3.2 Diagrama de entidades principales

```
academias ──< usuarios_app >── roles_academia
                │                      │
                │               permisos_usuario  (p.ej. ver_claves_moodle)
                │
colegios ───────< asesores_colegios (asesor ↔ colegio, con academia_id compuesta)
   │
asignaciones_moodle (colegio × curso_modelo × año, nombre_corto Moodle)
   │            │
   │      secciones_moodle (secciones/unidades de ESTA copia)
   │            └── actividades_moodle (módulos con moodle_cmid)
   │
matriculas ──── estudiantes (identidad de la persona)
   │     └── grupo_id → grupos (unidad actual auto/manual)
   │
progreso_actividades (por matrícula × actividad, desde API Moodle)

moodle_sync_log (registro de sincronizaciones con Moodle por asignación)
auditoria
sesiones / intentos_login
migracion_cuarentena
```

### 3.3 DDL completo (PostgreSQL 15+)

> **El DDL canónico vive en `database/postgres/schema.sql`.** Este apartado documenta las decisiones de diseño; para ejecutar el esquema usar ese archivo directamente.

**Cómo probar sin instalar PostgreSQL (Docker):**
```bash
docker run --rm --name pg_test \
  -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres:16
psql -h localhost -U postgres -c "CREATE DATABASE control_estudio;"
psql -h localhost -U postgres -d control_estudio -f database/postgres/schema.sql
psql -h localhost -U postgres -d control_estudio \
  -f database/postgres/tests/test_integridad.sql
docker stop pg_test
```

**Cambios de tipos respecto a v2.1:**

- `tipo_modulo` **ya no es ENUM** — es `TEXT`. Motivo: el modname de Moodle varía por versión y por plugins instalados (`h5pactivity`, `quiz`, `assign`, `forum`, `resource`, `label`, `url`, `page`, …). Usar TEXT evita migraciones de ENUM cada vez que aparece un tipo nuevo.
- `moodle_completado` admite **0–3** (no solo 0/1), siguiendo los estados de la API `core_completion_get_activities_completion_status`:
  - 0 = no completado
  - 1 = completado (`COMPLETION_COMPLETE`)
  - 2 = completado y aprobado (`COMPLETION_COMPLETE_PASS`)
  - 3 = completado no aprobado (`COMPLETION_COMPLETE_FAIL`)
  - **Criterio acordado:** estados 1 y 2 suman como "completada" en el % de avance. El estado 3 no suma pero se muestra aparte (completada sin aprobar).

**Cambios estructurales respecto a v2.1 (resumen):**

| Tabla / elemento | Cambio en v2.2 |
|---|---|
| `tipo_modulo` ENUM | Eliminado; campo pasa a `TEXT` en `actividades_moodle` |
| `secciones_moodle` | + `numero_unidad INT` · + `UNIQUE (id, academia_id)` · + `UNIQUE (id, asignacion_id)` |
| `actividades_moodle` | `tipo_modulo TEXT`; FK `seccion_id` compuesta por academia y asignación; + `UNIQUE (id, academia_id)` · + `UNIQUE (id, asignacion_id)` |
| `grupos` | + `UNIQUE (id, asignacion_id)` |
| `matriculas` | `anio` y `nivel` eliminados (derivar por JOIN); FK `grupo_id` → `RESTRICT`; + FK `(grupo_id, asignacion_id)`; + `UNIQUE (id, academia_id)` · + `UNIQUE (id, asignacion_id)`; `enc_iv` → 12 bytes; + `enc_version SMALLINT`; `enc_etiqueta` **no existe** — el AAD de GCM (`academia_id:id`) se recalcula en la app y nunca se guarda (ver §5.2) |
| `progreso_actividades` | + `asignacion_id TEXT NOT NULL`; `moodle_completado CHECK BETWEEN 0 AND 3`; FKs compuestas por academia y por asignación |
| `carnet_listas` | + `UNIQUE (id, academia_id)` |
| `carnet_estudiantes` | FK `(lista_id, academia_id)` compuesta |
| `moodle_sync_log` | FK `(asignacion_id, academia_id)` compuesta |
| `auditoria` | + FK `(academia_id)` a `academias` |
| `migracion_cuarentena` | + FK `(academia_id)` a `academias` |
| `roles_academia` | + `ultimo_actualizar_avance TIMESTAMPTZ` |
| `sesiones` | + `academia_ids TEXT` (CSV de academias activas) |
| `uk_asig_activa` (nuevo) | Índice parcial: impide dos asignaciones activas para `(colegio, academia, curso, año)` |
| RLS | Extendida a todas las tablas con `academia_id`; `FORCE ROW LEVEL SECURITY`; `app_user` sin ownership; política usa `string_to_array(current_setting('app.academia_ids', TRUE), ',')` |
| `v_moodle_upload` | `firstname = username || ' ' || nombres`; `group1 = grupos.nombre_grupo` |

**Punto 3a — FK compuesta `grupo_id` (justificación de RESTRICT vs SET NULL):**

```sql
-- v2.1 (incorrecto):
FOREIGN KEY (grupo_id, academia_id) REFERENCES grupos(id, academia_id) ON DELETE SET NULL
-- Problema: ON DELETE SET NULL pondría NULL en AMBAS columnas, incluyendo academia_id
-- que es NOT NULL. Borrar un grupo fallaría o anularía academia_id.

-- v2.2 (correcto):
FOREIGN KEY (grupo_id, academia_id) REFERENCES grupos(id, academia_id) ON DELETE RESTRICT
FOREIGN KEY (grupo_id, asignacion_id) REFERENCES grupos(id, asignacion_id) ON DELETE RESTRICT
-- RESTRICT: no permite borrar físicamente un grupo con matrículas activas.
-- Los grupos se dan de baja con activo=FALSE (soft-delete).
-- Elegimos RESTRICT porque: (1) no existe caso de uso donde borrar un grupo con estudiantes
-- sea correcto sin reasignarlos primero; (2) la FK compuesta (grupo_id, asignacion_id)
-- además garantiza que el grupo pertenezca a la misma asignación que la matrícula.
-- En PG15+ también existe ON DELETE SET NULL (grupo_id) que solo nullifica esa columna,
-- pero RESTRICT es más seguro para este modelo de datos.
```

**Punto 3b — UNIQUE (id, academia_id) en matriculas y secciones (para FK compuestas):**

```sql
-- Necesario para que otras tablas puedan referenciar (id, academia_id) como FK compuesta.
-- Sin este UNIQUE, PostgreSQL rechaza la FK. Se añade también UNIQUE (id, asignacion_id)
-- para las constraints de integridad de asignación en progreso_actividades.
ALTER TABLE matriculas ADD UNIQUE (id, academia_id);
ALTER TABLE matriculas ADD UNIQUE (id, asignacion_id);
ALTER TABLE secciones_moodle ADD UNIQUE (id, academia_id);
ALTER TABLE secciones_moodle ADD UNIQUE (id, asignacion_id);
ALTER TABLE actividades_moodle ADD UNIQUE (id, academia_id);
ALTER TABLE actividades_moodle ADD UNIQUE (id, asignacion_id);
ALTER TABLE grupos ADD UNIQUE (id, asignacion_id);
ALTER TABLE carnet_listas ADD UNIQUE (id, academia_id);
```

**Punto 3c — Integridad cruzada matrícula/actividad:**

```sql
-- progreso_actividades.asignacion_id (denorm.) + FKs compuestas impiden que
-- una matrícula apunte a una actividad de otra asignación.
FOREIGN KEY (matricula_id, asignacion_id) REFERENCES matriculas(id, asignacion_id)
FOREIGN KEY (actividad_id, asignacion_id) REFERENCES actividades_moodle(id, asignacion_id)
-- Test 3 en test_integridad.sql confirma que la FK rechaza el cruce.
```

**Punto 3d — Eliminación de matriculas.anio y matriculas.nivel:**

```sql
-- v2.1 tenía: anio TEXT y nivel nivel_curso en matriculas (copias desincronizables)
-- v2.2: eliminados. Derivar via JOIN:
SELECT m.id, a.anio, c.nivel
FROM   matriculas          m
JOIN   asignaciones_moodle a ON a.id = m.asignacion_id
JOIN   cursos_modelo       c ON c.id = a.curso_id;
-- Test 11 en test_integridad.sql confirma que este JOIN funciona.
```

**Punto 3e — Índice único de asignaciones activas:**

```sql
CREATE UNIQUE INDEX uk_asig_activa
  ON asignaciones_moodle(colegio_id, academia_id, curso_id, anio)
  WHERE eliminado_en IS NULL;
-- Evaluación: correcto. Una combinación (colegio, academia, curso modelo, año)
-- debe tener como máximo una asignación activa — de lo contrario la generación de
-- usuarios y la sincronización son ambiguas. La misma combinación en papelera
-- (eliminado_en != NULL) sí se permite (Test 5b lo confirma).
```

**Punto 4 — RLS completo:**

```sql
-- La clave es usar LISTA de academias (csv) en lugar de un solo valor.
-- Esto permite al gerente ver ambas academias sin duplicar políticas.
-- set_config('app.academia_ids', 'tecno', true)           -- admin/asesor
-- set_config('app.academia_ids', 'tecno,cleveland', true) -- gerente
-- Sin llamar set_config → current_setting devuelve NULL
--   → string_to_array(NULL, ',') = NULL
--   → academia_id = ANY(NULL) = NULL (falso) → 0 filas ← seguro

-- FORCE ROW LEVEL SECURITY: aplica RLS incluso al dueño de la tabla.
-- app_user NO es dueño de ninguna tabla → FORCE añade defensa en profundidad.

-- Tablas con RLS habilitado en v2.2 (todas las que tienen academia_id):
-- colegios, cursos_modelo, asignaciones_moodle, secciones_moodle,
-- actividades_moodle, estudiantes, grupos, matriculas, progreso_actividades,
-- carnet_listas, carnet_estudiantes, moodle_sync_log, auditoria,
-- migracion_cuarentena, roles_academia, permisos_usuario,
-- asesores_colegios, carnet_opciones
-- (v2.1 solo tenía 5 tablas)
```

**Punto 9 — Vista `v_moodle_upload` corregida:**

**Definición real de `v_moodle_upload` (del archivo `schema.sql`):**

```sql
-- firstname verificado contra buildUsuariosCSV() en script.js línea 1657:
--   firstname = username + ' ' + nombres
-- security_invoker = true: la vista corre con RLS del LLAMANTE, no del creador.
-- Sin security_invoker, la vista bypassearía RLS y expondría filas de otras academias.
CREATE VIEW v_moodle_upload
  WITH (security_invoker = true)
AS
  SELECT
    m.username,
    NULL AS password,              -- descifrar en app (permiso ver_claves_moodle)
    m.username || ' ' || e.nombres   AS firstname,
    e.apellidos                       AS lastname,
    m.email, m.city, m.country,
    a.nombre_corto                    AS course1,
    COALESCE(g.nombre_grupo, '')      AS group1,  -- nombre del grupo, no su id
    m.role1, m.enrolperiod1, m.suspended
  FROM  matriculas            m
  JOIN  estudiantes           e ON e.id = m.estudiante_id
  JOIN  asignaciones_moodle   a ON a.id = m.asignacion_id
  LEFT JOIN grupos            g ON g.id = m.grupo_id
  WHERE m.eliminado_en IS NULL;

-- La vista se crea DESPUÉS del GRANT ON ALL TABLES, así que necesita GRANT propio.
GRANT SELECT ON v_moodle_upload TO app_user;
```

**Función `login_usuario()` — SECURITY DEFINER con hardening de search_path:**

```sql
-- Resuelve las academias del usuario SIN depender de app.academia_ids
-- (huevo-gallina: la variable no existe todavía al momento del login).
CREATE FUNCTION login_usuario(p_email TEXT)
RETURNS TABLE(usuario_id INT, nombre TEXT, activo BOOLEAN, password_hash TEXT, academia_ids TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
-- SET search_path = public, pg_temp:
--   · 'public' primero → public.usuarios_app y public.roles_academia se encuentran antes
--     que cualquier tabla temporal con el mismo nombre (defensa contra shadowing).
--   · 'pg_temp' al final → las tablas temporales siguen siendo accesibles dentro
--     de la función si se necesitan en el futuro, sin riesgo de shadowing.
-- Los nombres de tabla se cualifican con 'public.' como segunda línea de defensa.
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.nombre, u.activo, u.password_hash,
    (SELECT string_agg(ra.academia_id, ',' ORDER BY ra.academia_id)
     FROM   public.roles_academia ra
     WHERE  ra.usuario_id = u.id AND ra.activo = TRUE)
  FROM public.usuarios_app u
  WHERE u.email = p_email;
$$;

REVOKE ALL    ON FUNCTION login_usuario(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION login_usuario(TEXT) TO app_user;
```

**Camino de login completo (API → BD):**

```
1. La API recibe { email, password } del formulario.
2. Llama login_usuario(email) → obtiene { usuario_id, nombre, activo, password_hash, academia_ids }.
3. Verifica el password localmente con argon2id (nunca en BD — sin extensión nativa).
4. Si OK: INSERT en sesiones (genera token de sesión).
5. Por cada request posterior:
     BEGIN;
     SET LOCAL "app.academia_ids" = <academia_ids>;  ← SET LOCAL, nunca SET
     -- queries (RLS filtra por academia)
     COMMIT;
```

**GRANTs/REVOKEs reales aplicados en `schema.sql`:**

```sql
-- app_user tiene SELECT,INSERT,UPDATE,DELETE sobre TODAS las tablas (excepto las que se revocan):
REVOKE UPDATE, DELETE ON auditoria       FROM app_user;  -- solo INSERT (inmutable)
REVOKE UPDATE, DELETE ON intentos_login  FROM app_user;  -- solo INSERT
REVOKE ALL            ON usuarios_app    FROM app_user;  -- sin password_hash directo
GRANT SELECT (id, email, nombre, activo, creado_en, ultima_sesion) ON usuarios_app TO app_user;
GRANT UPDATE (ultima_sesion, activo)                                ON usuarios_app TO app_user;
GRANT INSERT                                                        ON usuarios_app TO app_user;
-- Relaciones creadas DESPUÉS del GRANT ON ALL TABLES (necesitan GRANT propio):
GRANT SELECT ON v_moodle_upload TO app_user;
GRANT SELECT, INSERT, UPDATE ON sync_queue TO app_user;  -- sin DELETE (historial)
```

**Paso de despliegue recomendado (reducir superficie de ataque de tablas temporales):**

```sql
REVOKE TEMPORARY ON DATABASE control_estudio FROM PUBLIC;
-- Efecto: PUBLIC ya no puede crear tablas temporales. El dueño de la BD
-- y cualquier rol al que se haya concedido el privilegio TEMPORARY explícitamente
-- conservan ese permiso sin cambios.
-- Motivación: sin este REVOKE, cualquier usuario autenticado puede crear
-- tablas temporales con los mismos nombres que tablas reales. Aunque
-- login_usuario() está protegida por SET search_path y nombres cualificados,
-- este REVOKE elimina el vector de ataque por completo.
```

**Rol del worker de sincronización (`sync_worker`) — DDL real en `schema.sql`:**

El proceso worker del VPS que llama a la API de Moodle y escribe el progreso en la BD usa su propio rol de base de datos, **distinto de `app_user`** (el rol de la API). Justificación:

1. **Mínimo privilegio.** El worker no necesita leer `password_enc`, `enc_iv`, `carnet_listas`, `auditoria` ni `sesiones`. `sync_worker` tiene GRANTs columna a columna en `matriculas` (excluye explícitamente esas columnas) y GRANTs UPDATE solo sobre los campos que el §3.4 exige (`moodle_user_id`, `primer_acceso`, `ultimo_acceso`, `ultimo_acceso_curso`, `fecha_consulta_moodle`).

2. **Separación de vectores de ataque.** Si se compromete la API (`app_user`), el atacante no obtiene permisos del worker. El inverso también aplica.

3. **Trazabilidad.** Los logs de PostgreSQL distinguen operaciones del worker vs. de la API.

**Corrección del razonamiento respecto a v2.5:** el razonamiento anterior decía que `sync_worker` no usa RLS, que su acceso está acotado "por las tablas que tiene concedidas, no por la variable de sesión". Eso era incorrecto. **La separación de academias la impone la RLS, igual que para `app_user`.** `sync_worker` tiene políticas RLS en las 9 tablas que accede, con el mismo patrón (`app.academia_ids`). La diferencia con `app_user` está en los GRANTs de tabla y columna (mínimo privilegio), no en saltarse la RLS.

El worker procesa **un trabajo por transacción** con `SET LOCAL`:
```sql
BEGIN;
SET LOCAL "app.academia_ids" = 'tecno';   -- una academia por trabajo
-- operaciones del sync para esa academia (secciones, actividades, progreso, etc.)
COMMIT;
```
Sin `SET LOCAL` → `current_setting` devuelve NULL → `ANY(NULL)` = NULL → 0 filas (fail-safe).

**GRANTs reales en `schema.sql` (resumen):**

| Tabla | Operaciones | Restricciones |
|---|---|---|
| `sync_queue` | SELECT, INSERT, UPDATE | — |
| `moodle_sync_log` | SELECT, INSERT, UPDATE | — |
| `secciones_moodle` | SELECT, INSERT, UPDATE | — |
| `actividades_moodle` | SELECT, INSERT, UPDATE | — |
| `progreso_actividades` | SELECT, INSERT, UPDATE | — |
| `asignaciones_moodle` | SELECT; UPDATE (moodle_course_id) | Solo columna moodle_course_id |
| `grupos` | SELECT; UPDATE (unidad_actual_auto) | Solo columna unidad_actual_auto |
| `cursos_modelo` | SELECT | Solo lectura |
| `matriculas` | SELECT (27 columnas†); UPDATE (5 columnas) | Sin password_enc ni enc_iv |

†`password_enc` y `enc_iv` **no** están en el GRANT SELECT → cualquier SELECT que los incluya falla con `insufficient_privilege`.

**Políticas RLS de `sync_worker` (9 tablas, mismo patrón):**
```sql
CREATE POLICY pol_secciones_worker ON secciones_moodle FOR ALL TO sync_worker
  USING (academia_id = ANY(string_to_array(current_setting('app.academia_ids', TRUE), ',')));
-- (Igual para actividades_moodle, asignaciones_moodle, matriculas, progreso_actividades,
--  grupos, moodle_sync_log, sync_queue, cursos_modelo)
```

---

### 3.4 Sincronización con la API de Moodle (completo)

**Funciones de la API REST de Moodle utilizadas (nombres exactos):**

| Paso | Función wsfunction | Parámetros | Resultado |
|---|---|---|---|
| Resolver moodle_course_id | `core_course_get_courses_by_field` | `field=shortname`, `value=nombre_corto` | ID numérico del curso copiado |
| Resolver moodle_user_id (nuevos) | `core_user_get_users_by_field` | `field=username`, `values[]=…` | ID numérico del usuario; puede batceharse |
| Leer estructura (secciones + actividades) | `core_course_get_contents` | `courseid=moodle_course_id` | Árbol de secciones con cmids y visibility |
| Leer usuarios inscritos con acceso | `core_enrol_get_enrolled_users` | `courseid=moodle_course_id` | Lista de usuarios con `id`, `username`, `firstaccess`, `lastaccess`, `lastcourseaccess` (ver nota †) |
| Leer estado de finalización | `core_completion_get_activities_completion_status` | `userid`, `courseid` | `completionstate` (0–3) por cmid; **UNA llamada por estudiante, no por actividad** (ver nota ‡) |
| Leer notas | `gradereport_user_get_grade_items` | `userid`, `courseid` | Notas por ítem de calificación |

**Flujo completo de sincronización (paso inicial + incremental):**

```
PASO 0 — Solo en la primera sincronización de cada asignación:
  a. core_course_get_courses_by_field(shortname) → moodle_course_id
     Guardar en asignaciones_moodle.moodle_course_id
  b. core_enrol_get_enrolled_users(courseid) → lista de usuarios inscritos
     Por cada usuario: si username está en matriculas pero moodle_user_id es NULL
       → guardar moodle_user_id en matriculas
     Campos de acceso (†):
       primer_acceso  ← firstaccess       (primer acceso al sitio Moodle, no solo al curso)
       ultimo_acceso  ← lastaccess        (último acceso al sitio Moodle)
       ultimo_acceso_curso ← lastcourseaccess (último acceso a este curso específico)
     ⚠ NO usar lastcourseaccess para primer_acceso — lastcourseaccess es el ÚLTIMO
       acceso al curso, no el primero. El campo correcto es firstaccess.
  c. core_course_get_contents(courseid) → estructura de secciones y actividades
     Guardar/actualizar secciones_moodle y actividades_moodle
     (visible, numero_seccion, moodle_cmid, tiene_finalizacion, tipo_modulo)
     Al poner visible=TRUE por primera vez: fijar publicada_en = NOW() (nunca borrar)
     ⚠ REQUISITO DEL TOKEN: el usuario del token de servicio necesita la capacidad
       moodle/course:viewhiddensections y moodle/course:viewhiddenactivities (o rol
       de gestor en el curso). Sin ella, core_course_get_contents omite las secciones
       y actividades ocultas, lo que impide rastrear publicada_en correctamente.
       Verificación: llamar al endpoint y contar las secciones; si el número difiere
       del total visible en la interfaz del docente, el token no tiene los permisos.

PASO 1 — Cada sincronización (periódica o disparada manualmente):
  a. core_course_get_contents → actualizar visible/orden de secciones y actividades
  b. core_enrol_get_enrolled_users → actualizar ultimo_acceso y ultimo_acceso_curso
  c. Por cada matrícula activa con moodle_user_id conocido:
       core_completion_get_activities_completion_status(userid, courseid)
       → actualizar progreso_actividades.moodle_completado (0-3) y fecha_completado
       (UNA llamada por estudiante por curso; devuelve completionstate de TODOS los cmids)
  d. [Opcional] gradereport_user_get_grade_items → actualizar progreso_actividades.nota
  e. Actualizar moodle_sync_log (estado, conteos)
  f. Recalcular grupos.unidad_actual_auto (ver §3.6)

PASO 2 — Sincronización incremental (optimización):
  Solo llamar a completion para estudiantes cuyo ultimo_acceso_curso
  sea mayor que el iniciado_en del último moodle_sync_log completado.
  Reducción estimada: ~80-90% de llamadas en un sync diario.
```

**Notas sobre las funciones de la API:**

> **† `core_enrol_get_enrolled_users` — campos confirmados** (documentación Moodle oficial):
> `id`, `username`, `fullname`, `email`, `firstaccess` (primer acceso al sitio), `lastaccess` (último acceso al sitio), `lastcourseaccess` (último acceso a este curso).
> `primer_acceso` en nuestro esquema ← `firstaccess`. `ultimo_acceso` ← `lastaccess`. `ultimo_acceso_curso` ← `lastcourseaccess`.

> **‡ Bug MDL-85036 — no usar `core_completion_get_activities_completion_status` para eligibilidad:**
> Este endpoint reporta `uservisible = true` en actividades restringidas por grupo (group restriction). Eso significa que si usamos `uservisible` para decidir si una actividad es "elegible" para un estudiante, podemos incluir actividades a las que el estudiante no tiene acceso real. La eligibilidad debe determinarse exclusivamente por `publicada_en IS NOT NULL` (secciones/actividades que el docente publicó al menos una vez), no por el campo `uservisible` de este endpoint.

> **`core_availability_info`** — esta función wsfunction no aparece en la documentación oficial de Moodle. No usarla sin confirmar que existe en la versión instalada. La información de restricciones de acceso viene en los campos `availabilityinfo` (texto legible, no condiciones estructuradas) y `uservisible` de `core_course_get_contents`. Como el texto de `availabilityinfo` no es parseable de forma confiable, las restricciones por grupo en Moodle no se pueden determinar programáticamente desde la API en versiones estándar.

**Estimación de llamadas para TecnoCleveland (Tecno) — datos reales:**

Datos reales de Tecno: **301 asignaciones activas · 8.732 participantes** (≈ 29 por asignación).

| Etapa | Llamadas | Total |
|---|---|---|
| Estructura de curso (`core_course_get_contents`) | 1 por asig. | 301 |
| Usuarios inscritos (`core_enrol_get_enrolled_users`) | 1 por asig. | 301 |
| Finalización (`core_completion_get_activities`) | 1 por participante | 8.732 |
| **Total sync completo (sin notas)** | | **~9.334 ≈ 9.300** |
| Notas (`gradereport_user_get_grade_items`, opcional) | 1 por participante | 8.732 |
| **Total sync completo con notas** | | **~18.066 ≈ 18.000** |
| **Total sync incremental** (solo participantes con actividad reciente, ~20%) | | **~2.000** |

**Sin límite fijo de la API:** el ritmo es configurable según la capacidad del servidor Moodle. No hay un límite oficial de 30 req/min publicado por Moodle; el valor real depende de la configuración del servidor y del hosting. Se recomienda un parámetro configurable (`MOODLE_RATE_LIMIT_RPS`):

| Ritmo (req/s) | Sync completo sin notas (~9.300) | Con notas (~18.000) | Incremental (~2.000) |
|---|---|---|---|
| 1 req/s | ~155 min | ~300 min | ~33 min |
| 2 req/s | ~78 min | ~150 min | ~17 min |
| 5 req/s | ~31 min | ~60 min | ~7 min |
| 10 req/s | ~16 min | ~30 min | ~3 min |

Para Tecno con su carga real (301 asig., 8.732 part.), un sync completo diario nocturno a 5 req/s tomaría ~31 min (sin notas) o ~60 min (con notas). El incremental (varias veces al día) tomaría ~7 min a 5 req/s.

**Limitación del sync incremental por último acceso:**

El sync incremental filtra estudiantes cuyo `ultimo_acceso_curso` sea mayor que el último sync. Este criterio pierde cambios en los siguientes casos:
- **Notas puestas después por el docente:** un docente puede añadir/editar una calificación en Moodle sin que el estudiante vuelva a entrar. La nota no se sincronizará hasta el próximo sync completo.
- **Finalización por calificación:** si una actividad usa "Completado cuando se obtiene la nota mínima" (`COMPLETION_COMPLETE_PASS`), el estado puede cambiar a 2 cuando el docente ingresa la nota, sin acceso del estudiante.

**Solución: sync completo periódico (nocturno):**

Combinar ambos tipos de sync:
- **Sync incremental:** varias veces al día (p. ej. cada 4 horas). Solo estudiantes con actividad reciente. ~2.000 llamadas.
- **Sync completo nocturno:** una vez al día (p. ej. a las 3:00 AM). Todos los estudiantes de todas las asignaciones. ~9.300 llamadas sin notas.

```
Cron VPS:
  0  */4 * * *   worker sync --tipo=incremental    # cada 4h, solo activos
  0    3 * * *   worker sync --tipo=completo        # 3 AM, todos
```

El sync completo garantiza consistencia. El incremental da frescura intradiaria. Ambos usan `sync_queue` (ver §3.3 y DDL en `schema.sql`).

**`sync_queue` — worker con `FOR UPDATE SKIP LOCKED`:**

```sql
-- El worker toma el siguiente trabajo disponible sin bloquear a otros workers:
SELECT * FROM public.sync_queue
WHERE  estado = 'pendiente' AND programado_para <= NOW()
ORDER  BY programado_para
LIMIT  1
FOR UPDATE SKIP LOCKED;
-- SKIP LOCKED: si el row está bloqueado por otro worker, lo salta.
-- Permite múltiples workers en paralelo sin deadlocks.
-- uk_sync_queue_pendiente impide encolar el mismo (asignacion_id, tipo) dos veces como 'pendiente'.
```

**Alternativa: usuario de solo lectura a la BD de Moodle:**

> ⚠ **Advertencia de privacidad:** la base de datos de Moodle contiene correos electrónicos, hashes de contraseñas y datos de perfil de **todos los usuarios del sitio**, no solo de los estudiantes de estas academias. Si se configura acceso directo a esa BD:
> - Crear un usuario de BD de solo lectura **limitado estrictamente** a las tablas y columnas necesarias (`mdl_course_modules_completion`, `mdl_user.id`/`username`, `mdl_grade_grades`). Sin acceso a `mdl_user.email` ni `mdl_user.password`.
> - Conexión cifrada (TLS/SSL habilitado en el cliente).
> - IP fija del VPS en el ACL del servidor de BD de Moodle.
> - No almacenar las credenciales del usuario de BD en el repositorio — solo en variables de entorno.

En lugar de la API REST (1 llamada por estudiante por curso), un usuario con acceso directo podría leer `mdl_course_modules_completion` en bloque. Esto reduciría ~8.732 llamadas a 1 consulta SQL.

Preguntas que hay que hacer al hosting de Moodle:
- ¿El hosting permite un usuario de BD de solo lectura con restricción por tabla/columna?
- ¿Cuál es el motor de BD y versión (MySQL/MariaDB/PostgreSQL)?
- ¿La BD está en el mismo servidor o en uno separado accesible por red privada?
- ¿Hay firewall o ACL que restrinja el acceso desde el VPS?
- ¿El hosting acepta conexiones desde una IP fija del VPS?

Si el hosting lo permite, esta alternativa es significativamente más eficiente. Si no, la API REST con cola es la única opción.

---

### 3.5 Cálculo de porcentaje de avance

**Definición:** `% avance = actividades en estado 1 o 2 / actividades elegibles × 100`

- **Actividades elegibles:** `publicada_en IS NOT NULL AND tiene_finalizacion = TRUE` dentro del rango de **unidades** evaluado (campo `numero_unidad` en secciones, no `numero_seccion`). Ver §3.6 para la justificación de usar `publicada_en` en lugar de `visible`.
- **Completada (cuenta para %):** `moodle_completado IN (1, 2)`.
- **Completada no aprobada (no suma pero se muestra):** `moodle_completado = 3`.
- **Aprobada:** `nota >= actividades_moodle.nota_minima_aprobacion` cuando aplica.
- El rango de unidades es configurable por consulta (p. ej. unidades 1–4).
- `anio` se deriva de `asignaciones_moodle.anio`; `nivel` de `cursos_modelo.nivel`. Ya no están en `matriculas`.

**Consulta de avance por estudiante (rango de unidades parametrizable, datos ficticios):**

```sql
-- Parámetros: :asig_id = 'asig_r3_ceu_26', :grupo_id = 'grp_3a',
--             :unidad_desde = 1, :unidad_hasta = 2
-- (usamos los mismos ids ficticios del archivo de pruebas)

WITH elegibles AS (
  SELECT a.id AS actividad_id
  FROM   actividades_moodle a
  JOIN   secciones_moodle   s ON s.id = a.seccion_id
  WHERE  s.asignacion_id      = :asig_id
    AND  s.numero_unidad BETWEEN :unidad_desde AND :unidad_hasta
    AND  a.publicada_en        IS NOT NULL   -- elegible = publicada alguna vez (no visible ahora)
    AND  a.tiene_finalizacion   = TRUE
    AND  a.ausente_en          IS NULL       -- excluir actividades borradas en Moodle
),
avance AS (
  SELECT
    m.id                                      AS matricula_id,
    e.apellidos || ', ' || e.nombres          AS estudiante,
    COUNT(pa.actividad_id)
      FILTER (WHERE pa.moodle_completado IN (1,2)) AS completadas,
    COUNT(pa.actividad_id)
      FILTER (WHERE pa.moodle_completado = 3)       AS completas_no_aprobadas,
    COUNT(el.actividad_id)                          AS elegibles
  FROM  matriculas              m
  JOIN  estudiantes             e  ON e.id  = m.estudiante_id
  -- LEFT JOIN (no CROSS JOIN): si elegibles es vacía (rango sin actividades),
  -- los estudiantes siguen apareciendo con elegibles=0 y porcentaje=NULL.
  -- Con CROSS JOIN, un rango vacío produciría 0 filas (bug corregido en v2.4).
  LEFT JOIN elegibles           el ON TRUE
  LEFT JOIN progreso_actividades pa
         ON pa.matricula_id = m.id AND pa.actividad_id = el.actividad_id
  WHERE m.grupo_id      = :grupo_id
    AND m.eliminado_en IS NULL
  GROUP BY m.id, e.apellidos, e.nombres
)
SELECT
  estudiante,
  completadas,
  completas_no_aprobadas,
  elegibles,
  CASE WHEN elegibles > 0
       THEN ROUND(100.0 * completadas / elegibles, 1)
       ELSE NULL
  END AS porcentaje_avance
FROM avance
ORDER BY estudiante;

-- Resultado ficticio esperado (datos de prueba, unidades 1-2, 4 elegibles por student):
-- Gomez Perez, Ana     | 2 | 1 | 4 | 50.0  (estado 1+2=2 cuentan; estado 3=1 no suma)
-- Lopez Torres, Carlos | 1 | 0 | 4 | 25.0
-- (Si rango 8-9: elegibles=0, porcentaje=NULL para ambos — aparecen igualmente)
```

*Promedio del grupo (completo, basado en la CTE avance de arriba):*
```sql
-- Añadir esta CTE al WITH anterior y reemplazar el SELECT final:
, promedio AS (
  SELECT ROUND(AVG(100.0 * completadas / NULLIF(elegibles, 0)), 1) AS promedio_grupo
  FROM avance
)
SELECT
  (SELECT promedio_grupo FROM promedio) AS promedio_grupo,
  *
FROM avance
ORDER BY estudiante;
-- Con datos de prueba (grp_3a, rango 1-2): promedio = 37.5
```

*Desglose por año y colegio (rango de numero_unidad — consulta corregida v2.4):*
```sql
-- Parámetros: :unidad_desde, :unidad_hasta (ej. 1 y 2)
-- Bug corregido: la versión anterior usaba LEFT JOIN de actividades con secciones,
-- colocando el filtro de numero_unidad en la cláusula ON. Esto hacía que
-- COUNT(el2.id) contara TODAS las actividades publicadas aunque estuvieran fuera
-- del rango (el2.id no era NULL aunque s2 sí lo fuera). La corrección usa una CTE
-- con INNER JOIN para que solo las actividades del rango entren como elegibles.
WITH rango_elegibles AS (
  SELECT a.id AS actividad_id, a.asignacion_id
  FROM   actividades_moodle a
  JOIN   secciones_moodle   s ON s.id = a.seccion_id   -- INNER JOIN: filtra por rango
  WHERE  s.numero_unidad BETWEEN :unidad_desde AND :unidad_hasta
    AND  a.publicada_en IS NOT NULL
    AND  a.tiene_finalizacion = TRUE
    AND  a.ausente_en IS NULL   -- excluir borradas
)
SELECT
  c.nombre                       AS colegio,
  a.anio,
  cm.nivel::TEXT                 AS nivel,
  COUNT(DISTINCT m.id)           AS estudiantes,
  ROUND(AVG(sub.porcentaje), 1)  AS promedio_avance
FROM (
  SELECT m2.id, m2.asignacion_id,
    CASE WHEN COUNT(el.actividad_id) > 0
         THEN 100.0 * COUNT(pa2.actividad_id)
              FILTER (WHERE pa2.moodle_completado IN (1,2))
              / COUNT(el.actividad_id)
         ELSE NULL
    END AS porcentaje
  FROM  matriculas m2
  LEFT JOIN rango_elegibles el ON el.asignacion_id = m2.asignacion_id
  LEFT JOIN progreso_actividades pa2
         ON pa2.matricula_id = m2.id AND pa2.actividad_id = el.actividad_id
  WHERE m2.eliminado_en IS NULL
  GROUP BY m2.id, m2.asignacion_id
) sub
JOIN matriculas           m  ON m.id  = sub.id
JOIN asignaciones_moodle  a  ON a.id  = sub.asignacion_id
JOIN cursos_modelo        cm ON cm.id = a.curso_id
JOIN colegios             c  ON c.id  = a.colegio_id
WHERE a.eliminado_en IS NULL
GROUP BY c.nombre, a.anio, cm.nivel
ORDER BY c.nombre, a.anio;
-- Con rango 8-9: promedio=NULL en todos los colegios (0 elegibles → no promedian)
```

---

### 3.6 Unidad actual del grupo y elegibilidad

**Problema con "visible ahora" como criterio de elegibilidad:**

El docente oculta la Unidad 1 en Moodle al activar la Unidad 2 para limpiar la vista del estudiante. Si "elegible" fuera `visible = TRUE`, las actividades de la Unidad 1 desaparecerían del cálculo de avance exactamente cuando más avance habrían acumulado. El asesor perdería el progreso histórico.

**Solución (v2.3/v2.4): campo `publicada_en`**

Se agregan `publicada_en TIMESTAMPTZ DEFAULT NULL` a `secciones_moodle` y `actividades_moodle`:
- Se fija la **primera vez** que el sync observa `visible = TRUE`.
- **Nunca se borra**, aunque la sección/actividad se oculte de nuevo.
- Define "elegible": `publicada_en IS NOT NULL AND tiene_finalizacion = TRUE AND ausente_en IS NULL`.

> **`publicada_en` es una fecha de observación, no de publicación real.** Registra cuándo el sync *observó por primera vez* que la sección o actividad estaba visible. Si el docente publicó la unidad antes de que el sistema existiera, o si el sistema no tenía el token correcto en ese momento, `publicada_en` se fijará en el primer sync que la encuentre visible — no en el momento real en que el docente la activó. Esta limitación es aceptable: la elegibilidad es un criterio de negocio (¿el sistema sabe que fue publicada alguna vez?), no un registro histórico preciso.

**Inicialización al lanzar el sistema por primera vez:**

Al arrancar el sistema, algunas secciones ya ocultas (visible=FALSE) pueden tener completados registrados en Moodle porque el docente las publicó y luego las ocultó antes de que el sync existiera. El sync normal nunca las verá como `visible=TRUE` y `publicada_en` nunca se fijará, pero sí tienen completados.

Se proponen dos mecanismos de inicialización (no excluyentes):

1. **Automático al importar completados — función `sync_inicializar_publicada_en` (v2.6):** si hay registros de `moodle_completado > 0` para actividades con `publicada_en IS NULL`, eso es evidencia de que esas actividades estuvieron visibles. La función fija `publicada_en = NOW()` en esas actividades y propaga a sus secciones si también tienen `publicada_en IS NULL`.

   ```sql
   -- Ejemplo de llamada al inicializar el sistema:
   SELECT sync_inicializar_publicada_en('asig_r3_ceu_26');
   ```

   La función itera por asignación (no actividad a actividad), lo que evita N+1 UPDATEs:
   ```sql
   -- 1. Actividades con evidencia de completados
   UPDATE actividades_moodle a SET publicada_en = NOW()
   WHERE a.asignacion_id = p_asignacion AND a.publicada_en IS NULL
     AND EXISTS (SELECT 1 FROM progreso_actividades pa
                 WHERE pa.actividad_id = a.id AND pa.moodle_completado > 0);
   -- 2. Propagar a secciones
   UPDATE secciones_moodle s SET publicada_en = NOW()
   WHERE s.asignacion_id = p_asignacion AND s.publicada_en IS NULL
     AND EXISTS (SELECT 1 FROM actividades_moodle a
                 WHERE a.seccion_id = s.id AND a.publicada_en IS NOT NULL);
   ```

2. **Acción manual del admin "Marcar como publicada":** la interfaz del admin permite seleccionar secciones/actividades y marcar explícitamente `publicada_en = NOW()`. Útil cuando el docente confirma que una unidad fue efectivamente impartida aunque el sistema no la vio nunca como visible.

**Actividades borradas en Moodle — columna `ausente_en`:**

Cuando el docente borra una actividad en Moodle, desaparece de `core_course_get_contents`. El sync debe detectar esta ausencia y registrarla. Se añade `ausente_en TIMESTAMPTZ DEFAULT NULL` a `actividades_moodle` y `secciones_moodle`:

```sql
-- En actividades_moodle y secciones_moodle:
ausente_en TIMESTAMPTZ DEFAULT NULL
-- El sync la rellena cuando la actividad/sección desaparece de core_course_get_contents.
```

**Lógica del sync para detectar ausentes — función `sync_aplicar_estructura` (v2.6):**

Las salvaguardas de ausentes están implementadas en la función SQL `sync_aplicar_estructura(p_asignacion TEXT, p_cmids BIGINT[], p_token_ok BOOLEAN)` en `schema.sql`. El worker la llama después de recibir la respuesta de `core_course_get_contents`:

```sql
-- Ejemplo de llamada en el worker:
SELECT sync_aplicar_estructura(
  'asig_r3_ceu_26',
  ARRAY[1001, 1002, 1003]::BIGINT[],   -- moodle_cmid recibidos
  TRUE                                   -- token verificado
);
```

**Implementación de las tres salvaguardas:**

```
(Salvaguarda a) Si p_token_ok IS NOT TRUE OR p_cmids IS NULL OR array vacío → RETURN.

(Salvaguarda c) Para actividades con moodle_cmid = ANY(p_cmids) AND visible=TRUE:
  → SET ausencias_consecutivas=0, ausente_en=NULL
    WHERE (ausencias_consecutivas > 0 OR ausente_en IS NOT NULL)
  → Si visible=FALSE: NUNCA se resetea (nunca se marca una actividad oculta como presente).
    Recuperación: el docente vuelve a hacer visible la actividad; el próximo sync la ve
    con visible=TRUE y la función la reactiva.

(Salvaguarda b) Para actividades con moodle_cmid NOT IN p_cmids AND ausente_en IS NULL:
  → SET ausencias_consecutivas = ausencias_consecutivas + 1
  → Si ausencias_consecutivas >= 2: SET ausente_en = NOW()
```

**Invariante del esquema (v2.6):** el CHECK constraint garantiza consistencia a nivel de BD incluso ante UPDATEs directos (fuera de la función):
```sql
CONSTRAINT chk_act_ausente CHECK (ausente_en IS NULL OR ausencias_consecutivas >= 2)
-- también: chk_sec_ausente en secciones_moodle
```

El mismo patrón aplica a `secciones_moodle` (tiene `ausencias_consecutivas` y `ausente_en`), aunque la función implementada en v2.6 opera sobre `actividades_moodle`. Una función análoga para secciones seguiría el mismo diseño.

El progreso acumulado en `progreso_actividades` se conserva como historial cuando una actividad se marca ausente.

Las actividades con `ausente_en IS NOT NULL` se **excluyen de los elegibles** en todas las consultas de avance. El progreso ya registrado en `progreso_actividades` no se borra (es historial).

**Comportamiento del sync al ocultar una actividad:**
- El sync actualiza `visible = FALSE` en la fila.
- `publicada_en` permanece intacto.
- `moodle_completado` en `progreso_actividades` se conserva tal cual (no se borra ni se pone a 0). El progreso es histórico, no depende de la visibilidad actual.

**Unidad actual — lógica:**
```sql
-- unidad_actual_auto = unidad más alta entre secciones publicadas alguna vez
UPDATE grupos g
SET    unidad_actual_auto = (
  SELECT MAX(s.numero_unidad)
  FROM   secciones_moodle s
  WHERE  s.asignacion_id = g.asignacion_id
    AND  s.publicada_en IS NOT NULL         -- publicada alguna vez, aunque hoy esté oculta
    AND  s.numero_unidad IS NOT NULL
)
WHERE g.activo = TRUE;
```

**`unidad_actual_auto` es la misma para todos los grupos de una asignación.** El UPDATE anterior aplica a todos los grupos de `asignacion_id`, que comparten las mismas secciones. La diferencia por grupo solo existe cuando el admin fija explícitamente `unidad_actual_manual` en un grupo concreto (p. ej. un grupo que va más rápido o más lento).

La app muestra `COALESCE(unidad_actual_manual, unidad_actual_auto)`.

**Caso de visibilidad por grupo en Moodle:**
Moodle permite restringir el acceso por grupo (Restriction: Group). `core_course_get_contents` devuelve la sección como visible globalmente, pero la restricción por grupo no es accesible de forma estructurada desde la API (ver nota sobre `core_availability_info` en §3.4). El campo `availabilityinfo` del endpoint es texto legible, no parseable de forma confiable. En este caso:
- `visible` en `secciones_moodle` refleja la visibilidad global del curso.
- `unidad_actual_manual` en `grupos` permite al admin anular el valor automático cuando hay restricciones por grupo que el sync no puede detectar.

---

### 3.7 Matriz de permisos

| Operación | admin | asesor | gerente |
|---|:---:|:---:|:---:|
| Ver colegios de su academia | ✅ todos | ✅ solo los asignados | ✅ ambas academias |
| Crear / editar / eliminar colegios | ✅ | ❌ | ❌ |
| Ver estudiantes y matrículas | ✅ | ✅ solo sus colegios | ✅ lectura |
| Crear / editar / eliminar matrículas y estudiantes | ✅ | ❌ | ❌ |
| Ver progreso de avance | ✅ | ✅ solo sus colegios | ✅ lectura |
| **Pulsar "Actualizar avance"** | ✅ sin límite | ✅ con límite de frecuencia | ✅ con límite de frecuencia |
| Crear / editar otros datos | ✅ | ❌ | ❌ |
| Ver credenciales Moodle (password descifrado) | ✅ | Solo con `ver_claves_moodle` | ❌ |
| Generar usuarios y carnets | ✅ | ❌ | ❌ |
| Administrar cursos modelo | ✅ | ❌ | ❌ |
| Disparar sincronización completa | ✅ | ❌ | ❌ |
| Ver datos de otra academia | ❌ | ❌ | ✅ lectura |
| Crear / editar usuarios de la app | ✅ | ❌ | ❌ |
| Asignar roles y permisos | ✅ | ❌ | ❌ |
| Ver log de auditoría | ✅ | ❌ | ❌ |

**"Actualizar avance":** permite a asesor y gerente disparar una sincronización de progreso para sus colegios/asignaciones asignadas. El límite de frecuencia (p. ej. una vez cada 30 minutos por usuario) se controla con `roles_academia.ultimo_actualizar_avance`. La API verifica que `NOW() - ultimo_actualizar_avance > INTERVAL '30 min'` antes de encolar el job. El admin no tiene límite.

**Implementación en la API del backend VPS:**
1. Cada request incluye el token de sesión → `sesiones` → `usuario_id`.
2. Se consulta `roles_academia` para obtener el rol en la academia del recurso solicitado.
3. Para asesor: verificar además `asesores_colegios`.
4. Para gerente: `sesiones.academia_ids` incluye ambas academias; solo se permiten operaciones de lectura + "Actualizar avance".
5. Para descifrar `password_enc`: verificar `permisos_usuario` con `permiso='ver_claves_moodle'`.
6. RLS de PostgreSQL actúa como segunda barrera:
   ```sql
   BEGIN;
   SET LOCAL "app.academia_ids" = 'tecno';   -- SET LOCAL, no SET (ver límites abajo)
   -- queries del request
   COMMIT;
   ```

**Límites documentados (no depender solo de RLS ni solo de la API):**

**Límite A — El solo-lectura de asesor/gerente lo impone la API, no la BD.**
Hoy `app_user` tiene `SELECT, INSERT, UPDATE, DELETE` sobre casi todas las tablas (con revocaciones puntuales para `auditoria`). Un asesor autenticado como `app_user` solo no puede modificar datos gracias a que la API verifica el rol antes de ejecutar la escritura. Si la API tiene un bug o se bypassea, la BD no rechaza la escritura.

Propuesta para mayor defensa: un rol de BD `app_reader` con solo `SELECT`:
```sql
CREATE ROLE app_reader NOLOGIN;
GRANT USAGE ON SCHEMA public TO app_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_reader;
-- Añadir políticas RLS para app_reader (mismas que app_user) en cada tabla.
```
Asesor y gerente usarían `app_reader` en la conexión; solo el admin usaría `app_user`. Pendiente de implementar cuando se defina el flujo de autenticación del VPS.

**Límite B — La RLS depende de una variable de sesión modificable.**
`app.academia_ids` es una variable de configuración personalizada. Cualquiera que pueda ejecutar SQL en la conexión puede hacer `SET "app.academia_ids" = 'tecno,cleveland'` y ver datos de ambas academias. La RLS no es una barrera criptográfica; es una segunda línea de defensa que asume que la API controla quién ejecuta SQL.

Por eso la API **siempre** debe usar `SET LOCAL` (no `SET`) dentro de una transacción por request:
- `SET LOCAL`: el valor se revierte al COMMIT/ROLLBACK de la transacción. Si el pool reutiliza la conexión, el siguiente request empieza con la variable no seteada → 0 filas (fail-safe).
- `SET` (sin LOCAL): el valor persiste en toda la conexión. Si el pool reutiliza la conexión sin resetear la variable, el siguiente request hereda la academia del anterior → fuga de datos.

---

## 4. Plan de migración desde respaldo .json → esquema v2.4

### 4.1 Paso 0 — Exportar y validar el respaldo actual

```bash
# Desde la app (vista Respaldo → "Descargar respaldo")
# Verificar con el script existente:
node database/scripts/respaldo_a_sql.js respaldo_tecno_FECHA.json --sqlite /tmp/tecno_v1.db
# Confirmar que test_idavuelta.js pasa con ese respaldo (requiere Node ≥ 22):
node database/scripts/test_idavuelta.js
```

### 4.2 Reglas de limpieza y cuarentena

`asignacion_id` en `matriculas` es `NOT NULL` en v2.2. El script de migración debe resolver todos los registros antes de escribir en producción.

**Hallazgo (a) — 112 participantes sin asignación activa:**

```
Para cada participante huérfano (colegioId, cursoId, anio sin asignación activa):
  candidatas = asignaciones donde colegio+año coinciden (distintos cursoId)
  si len(candidatas) == 1:
    → re-vincular automáticamente a esa asignación
    → conservar legacy_id original
  si len(candidatas) == 0 o len(candidatas) > 1:
    → insertar en migracion_cuarentena
       tipo='huerfano_sin_asig',
       motivo='Colegio X + año Y tiene N asignaciones candidatas o ninguna',
       datos_originales=<fila JSON completa>
```

**Hallazgo (b) — 193 participantes con course1 divergente:**

El campo `course1_legacy` en `matriculas` preserva el valor original. La resolución es:

1. **Verificar contra Moodle:** antes de migrar, llamar `core_course_get_courses_by_field(shortname=course1_legacy)` para comprobar si ese shortname existe en Moodle como curso real.
   - Si existe: comparar con `asignaciones_moodle.moodle_course_id` de la asignación apuntada por la matrícula. Si difieren, el estudiante puede estar inscrito en el curso equivocado en Moodle → insertar en cuarentena con `tipo='course1_divergente'`.
   - Si no existe: el shortname es histórico; registrar en cuarentena igualmente.
2. Si `course1_legacy == asignacion.nombre_corto` actual: migrar normalmente; `course1_legacy` queda como referencia histórica.
3. La divergencia **no bloquea la migración**: todos los registros se migran, pero los divergentes quedan también en cuarentena para revisión.

> La resolución usa la matrícula real de Moodle (via API), no solo el nombre corto local, para determinar si hay un desajuste real en la plataforma.

**Hallazgo (c) — 1 username duplicado:**

```sql
-- Identificar duplicados buscando por academia (no por colegio — el username
-- es único a nivel de academia, no a nivel de colegio):
SELECT username, academia_id, COUNT(*) AS n
FROM participantes
WHERE eliminado_en IS NULL
GROUP BY username, academia_id
HAVING COUNT(*) > 1;
```

El duplicado va a `migracion_cuarentena` con `tipo='username_duplicado'`. Solo el registro que el admin marque como "correcto" se migra a `matriculas`; el otro se inserta con `eliminado_en = NOW()` y también queda en cuarentena.

**Hallazgo (d) — pares de mismo nombre+colegio:**

Solo informativo. Ambos registros se migran normalmente. Ver §4.3 para la política 1:1.

**Campos `legacy_id` para trazabilidad:**

Toda fila migrada lleva el `uid()` original del respaldo en su columna `legacy_id`.

### 4.3 Reconstruir `estudiantes` a partir de `participantes`

**Decisión (v2.2): migración 1:1 — sin deduplicar.**

Cada participante del respaldo se migra como un `estudiante` distinto y una `matricula` distinta. No se intenta deduplicar automáticamente por nombre.

**Razón:** la app nunca garantizó unicidad de nombres. La deduplicación automática tiene riesgo real de fusionar personas distintas (hermanos con mismo apellido, mismo estudiante en dos colegios). La deduplicación se deja como tarea posterior manual si el dueño lo requiere, usando `legacy_id` para rastrear el origen.

### 4.4 Tratar la papelera en la migración

Los dos tipos de papelera de v1 se mapean a campos en `matriculas` (v2.5):

| v1 trash | v2.5 matriculas |
|---|---|
| `trash.participantes` (lote) | `eliminado_en` = `fechaEliminacion`, `lote_baja` = id del lote, `tipo_papelera='lote'` |
| `trash.estudiantes` (individual) | `eliminado_en` = `fechaEliminacion`, `lote_baja` = id del registro, `tipo_papelera='individual'` |

Colegios y cursos en papelera usan `eliminado_en` aproximada (`_exportadoEn` del respaldo, como ya hace `mapeo.js`).

### 4.5 Retrocompatibilidad con respaldos .json antiguos

El formato del Respaldo v1 (`data` + metadatos `_academia`, `_versionEsquema:1`, etc.) sigue importándose igual en la app cliente. El backend VPS recibirá ese mismo JSON desde `importBackup()` y lo procesará con la lógica de `mapeo.js` (adaptada a v2.2). El campo `_versionEsquema` permite bifurcar la lógica en el servidor si surge un esquema v3.

---

## 5. Riesgos y decisiones

### 5.1 Menores de edad

Los nombres y apellidos de los estudiantes son potencialmente datos de menores de edad. Implicaciones:

- En muchos países (incluyendo Venezuela) existe legislación sobre protección de datos de menores aunque no sea tan específica como el GDPR europeo.
- El servidor VPS debe tener acceso restringido: HTTPS obligatorio, sin exposición a internet pública de la base de datos, sin logs que contengan nombres.
- Los respaldos `.json` locales contienen estos datos en texto plano — no cifrados. El `.gitignore` los excluye; no comprometerlos nunca.
- **`fecha_nacimiento` se eliminó del esquema** — no aporta valor funcional y añade riesgo de privacidad. Si en el futuro se necesita, se agrega con justificación explícita.
- ⚠ **Pendiente de confirmar:** ¿política de retención de datos? ¿Por cuánto tiempo conservar registros de estudiantes que ya terminaron el programa?

### 5.2 Claves de Moodle de estudiantes y auditoría

**Decisión tomada — cifrado reversible a nivel de aplicación (AES-256-GCM):**

Las contraseñas de Moodle se generan masivamente para carga inicial. Una vez cargadas en Moodle, el valor en el sistema sirve para imprimir carnets o recargar usuarios. Se cifran con AES-256-GCM en la capa de aplicación:

- `APP_ENCRYPTION_KEY` vive en variables de entorno del servidor, nunca en la BD.
- Columnas en `matriculas`:
  - `password_enc TEXT` — almacena **Base64(ciphertext || tag_16_bytes)**. La etiqueta de autenticación GCM de 16 bytes se concatena al ciphertext antes de codificar en Base64. Es la práctica estándar: al descifrar, la app extrae los últimos 16 bytes como tag y el resto como ciphertext.
  - `enc_iv TEXT` — nonce GCM de **12 bytes (96 bits)** en hex (24 chars). **No 16 bytes.** NIST SP 800-38D recomienda 96 bits para GCM; usar 128 bits requiere cálculo adicional del contador.
  - `enc_version SMALLINT DEFAULT 1` — número de versión de la clave `APP_ENCRYPTION_KEY` activa al cifrar. Permite rotar la clave sin re-cifrar todo inmediatamente: registros antiguos se descifran con la clave de su versión, los nuevos usan la actual.
  - `clave_obsoleta BOOLEAN DEFAULT FALSE` — columna explícita para marcar que se **sabe** que la clave cambió en Moodle. Reemplaza el convenio de `enc_version = 0` que mezclaba dos conceptos distintos (versión de clave de cifrado y estado de la clave de Moodle).
- El descifrado ocurre solo en la API, y solo si el usuario tiene `ver_claves_moodle`.

**Separación de conceptos GCM (v2.3):**

| Componente | ¿Se guarda? | Dónde | Descripción |
|---|---|---|---|
| Nonce (IV) | Sí | `enc_iv` (24 chars hex) | Número aleatorio de 96 bits, único por cifrado |
| AAD | **No** | — | Se **recalcula** en la app: `academia_id || ':' || matricula_id`. Ata el ciphertext a esta fila específica; si se copia el ciphertext a otra fila, GCM detecta la manipulación al descifrar. |
| Authentication tag | Sí, **concatenado** | `password_enc` (últimos 16 bytes antes del B64) | Los 16 bytes finales del resultado de `AES-256-GCM-Encrypt`. Garantiza integridad del ciphertext. |
| Ciphertext | Sí | `password_enc` (primeros bytes) | Resultado del cifrado AES-256-GCM |

**Claves posiblemente obsoletas (v2.3):**

La API REST de Moodle **NO informa** cuando un estudiante cambia su contraseña. Por tanto:
- `password_enc` **no se pone NULL automáticamente** — no hay mecanismo para detectar el cambio.
- El valor almacenado es la **"clave inicial"** generada masivamente, posiblemente obsoleta.
- Si `primer_acceso IS NOT NULL`, la clave puede estar obsoleta. La UI puede mostrar "⚠ clave inicial — puede haber cambiado".
- El admin puede marcar explícitamente `clave_obsoleta = TRUE` cuando sabe que el estudiante cambió su clave. **No usar `enc_version = 0`** para esto: `enc_version` tiene un significado criptográfico (versión de la clave de cifrado del servidor), no sobre el estado de la clave en Moodle.
- La única forma de confirmar que la clave sigue vigente sería intentar autenticarse en Moodle, lo que **no se recomienda** hacer de forma automatizada.

**Campos excluidos de la tabla `auditoria`:**

| Tabla | Campos excluidos |
|---|---|
| `usuarios_app` | `password_hash` |
| `matriculas` | `password_enc`, `enc_iv` (el AAD se recalcula, no se guarda) |
| Cualquier tabla | `nombres`, `apellidos` en logs de operaciones masivas; solo incluir `matricula_id` o `legacy_id` |

### 5.3 Unicidad de `username` en `matriculas`

Resuelta con índice parcial de PostgreSQL:

```sql
CREATE UNIQUE INDEX uk_username_activo
  ON matriculas(academia_id, username)
  WHERE eliminado_en IS NULL;
```

Permite que el mismo username exista en la papelera sin violar la restricción. Antes de activar el índice hay que resolver el duplicado del hallazgo (c) (ver §4.2).

La restricción es sobre `(academia_id, username)` — Tecno y Cleveland pueden tener el mismo shortname sin conflicto.

### 5.4 Integración con la API de Moodle — decisión tomada

**Decisión:** sí se integra la API REST de Moodle. El token de servicio se almacena exclusivamente como variable de entorno por academia:

```
MOODLE_URL_TECNO=https://moodle.ejemplo-tecno.ve    ← URL ficticia de ejemplo
MOODLE_TOKEN_TECNO=<token_servicio_generado_en_moodle>
MOODLE_URL_CLEVELAND=https://moodle.ejemplo-cei.ve  ← URL ficticia de ejemplo
MOODLE_TOKEN_CLEVELAND=<token_servicio_generado_en_moodle>
```

El token **nunca se transmite al navegador ni se almacena en la BD**. La columna `academias.moodle_url` guarda la URL base para referencia; el token no tiene columna.

Para generar el token en Moodle: Administración del sitio → Plugins → Servicios web → Tokens → Agregar token. Los `moodle_user_id` se pueblan via `core_user_get_users_by_field(username)` en el paso inicial.

### 5.5 Roles y acceso — decisión tomada

**Roles definidos:**

| Rol | Quién | Academias | Permisos |
|---|---|---|---|
| `admin` | Dueño del proyecto (cada academia tiene el suyo) | Su academia | Lectura + escritura completa; genera usuarios, carnets; sincronización completa |
| `asesor` | Docente o coordinador de uno o varios colegios | Su academia, sus colegios | Lectura; "Actualizar avance" con límite de frecuencia; no ve claves de Moodle salvo permiso explícito |
| `gerente` | Persona que supervisa ambas academias | Ambas | Lectura; "Actualizar avance" con límite de frecuencia; sin auditoría |

**Usuarios iniciales al migrar:**

- Admin de TecnoCleveland: usuario actual "Administrador" (código `<código actual>` — no reproducido aquí por seguridad).
- Admin de Cleveland: usuario actual con código `<código actual>`.
- El "Asistente" (código `<código actual>`): ⚠ **Pendiente de confirmar** — ¿se migra como `admin` o `asesor` de Tecno? ¿Es la misma persona que el Administrador o alguien distinto?

**Inicio de sesión en el VPS:** correo + contraseña hasheada con argon2id. El código corto de `login.html` se reemplaza. Recuperación de contraseña por email (enlace de un solo uso, 30 min de expiración).

### 5.6 Progreso y actividades — decisión tomada

**Decisión:** el sistema registra el avance por **finalización de actividad de Moodle** con estados 0–3. Los estados 1 y 2 suman como "completada" en el % de avance. El estado 3 (completado no aprobado) no suma pero se muestra aparte para señalar actividades que necesitan refuerzo.

El backend VPS sincroniza el progreso via cron o disparado manualmente por admin/asesor/gerente (con límite de frecuencia). La vista del asesor muestra: % de avance (estados 1+2), actividades completadas_no_aprobadas (estado 3), y aprobadas (nota ≥ mínima cuando hay nota_minima_aprobacion).

### 5.7 Tecnología del backend VPS

**Decisión:** PostgreSQL 15+ (ver §3.1). Se instala en el servidor Contabo junto con el backend de la API (Node.js o el lenguaje que se elija).

⚠ **Pendiente de confirmar:** configuración exacta del servidor Contabo (RAM, disco, OS), dominio, y si PostgreSQL corre en el mismo servidor que la API o en uno separado.

### 5.8 Deuda técnica que afecta la migración

- `deleteAsig()` (script.js línea 1345) no actualiza ni elimina participantes. Si antes de migrar se desea corregir el hallazgo (a), hay que decidir la política.
- El panel muestra "de 28 registrados" hardcodeado — en v2.2, el backend devuelve el conteo real.
- `course1` en la app cliente no es la fuente de verdad en v2.2 — lo es `asignaciones_moodle.nombre_corto`.

---

## 6. Lo que se leyó y verificó / lo que NO se pudo verificar

### Verificado contra el código o ejecutado (v2.6)

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
| `login.html` — flujo de sesión, USERS (sin reproducir códigos) | `login.html` líneas 141–184 | ✅ |
| `buildUsuariosCSV()` — firstname = `username + ' ' + nombres` | `script.js` líneas 2127–2131 y 1657–1658 | ✅ |
| `schema.sql` v1 — tablas, índices, ausencias | `database/schema.sql` completo | ✅ |
| `mapeo.js` — conversión bidireccional JSON ↔ SQL | `database/scripts/mapeo.js` completo | ✅ |
| `database/README.md` — decisiones del esquema | `database/README.md` completo | ✅ |
| `ejemplo_ficticio.json` — formato real del respaldo | `database/scripts/ejemplo_ficticio.json` completo | ✅ |
| Tests de `database/scripts/` | `test_agregar_estudiantes` (32/32), `test_cambiar_sufijo` (18/18), `test_sync_core` (7/7), `test_sync_dos_dispositivos` (2/2) | ✅ (en el entorno Linux con Node 20) |
| `test_idavuelta.js` | `database/scripts/test_idavuelta.js` | ❌ Falla en Node 20 con `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`. Requiere Node ≥ 22. Correr desde Windows (Node 24.19.0). |
| `database/postgres/schema.sql` (v2.6) | `database/postgres/schema.sql` | ✅ **ejecutado contra PostgreSQL 16** (Docker, sin errores) |
| `database/postgres/tests/test_integridad.sql` (v2.6) | `database/postgres/tests/test_integridad.sql` | ✅ **ejecutado contra PostgreSQL 16**: 58 NOTICEs, **todos OK** — ver salida real abajo |
| `test_idavuelta.js` (en Node 20) | `database/scripts/test_idavuelta.js` | ❌ **FALLA en Node 20.19.2**: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`. Requiere Node ≥ 22. No hay Node 22+ disponible en este entorno (Linux/Crostini). El entorno Windows tiene Node 24.19.0 — correr el test desde Windows. |

**Salida real de psql — tests/test_integridad.sql contra PostgreSQL 16 (v2.6):**
```
TEST 1 OK: moodle_completado=4 rechazado por CHECK (0..3)
TEST 2 OK: FK (grupo_id, asignacion_id) impide cruzar asignaciones
TEST 3 OK: FK (actividad_id, asignacion_id) impide cruzar asignaciones en progreso
TEST 4 OK: uk_username_activo impide username duplicado entre activos
TEST 4b OK: username duplicado en papelera permitido (eliminado_en IS NOT NULL)
TEST 5 OK: uk_asig_activa impide dos asignaciones activas para mismo (colegio, curso, año)
TEST 5b OK: asignación eliminada con mismo (colegio, curso, año) permitida
TEST 7 OK: mat_ana → completadas=2, aprobadas=1, no_aprobadas=1, %=66.7
TEST 8 OK: firstname="rob3ceu01 Ana", lastname="Gomez Perez", group1="Grupo 3A", course1="3erROB-CEU-26"
TEST 9_EMPTY_RANGO OK: rango 8-9 → 2 estudiantes visibles, elegibles=0 (no desaparecen)
TEST 9 OK: Gomez Perez, Ana | completadas=2 elegibles=4 porcentaje=50.0
TEST 9 OK: Lopez Torres, Carlos | completadas=1 elegibles=4 porcentaje=25.0
TEST 9b OK: promedio del grupo grp_3a = %37.5
TEST 9_RANGO_COLEGIO OK: rango 8-9 → elegibles=0, promedio=NULL en ambos colegios (4 filas en sub)
TEST 9c: colegio=Colegio Ejemplo Uno anio=2026 nivel=media estudiantes=3 promedio=%25.0
TEST 9c: colegio=Colegio Ejemplo Junior anio=2026 nivel=media estudiantes=1 promedio=%0.0
TEST 9c OK: desglose por colegio con rango numero_unidad y CTE corregida
TEST 10 OK: RESTRICT impide borrar grupo con matrículas → usar activo=FALSE
TEST 11 OK: anio="2026" nivel="media" derivados por JOIN
TEST 12 OK: FK (colegio_id, academia_id) impide cruzar academias
TEST 12b OK: unidad_actual_auto=2 es la misma para grp_3a y grp_3b (misma asignación)
TEST 21 OK: ausente_en excluye actividad 15 → elegibles=4 (acto 15 no cuenta)
TEST 22 OK (a): pendiente+pendiente rechazado por uk_sync_queue_pendiente
TEST 22 OK (b): encolar mientras hay uno en_proceso rechazado
TEST 22 OK (c): encolar tras completado permitido (2 filas en historial)
PRE-TEST A OK: CHECK chk_act_ausente activo — ausente_en NOT NULL con consecutivas=0 rechazado
PRE-TEST B OK: sync_aplicar_estructura existe y acepta array vacío (salvaguarda a: no hace nada)
TEST 23 OK (a): 1 miss → ausencias_consecutivas=1, ausente_en IS NULL (salvaguarda b: no marca aún)
TEST 23 OK (b): 2 misses → ausente_en IS NOT NULL, consecutivas=2 (salvaguarda b: marcada)
TEST 24 OK: reaparición (visible=TRUE) → ausente_en=NULL, consecutivas=0 (salvaguarda c)
TEST 25 OK: visible=FALSE en respuesta → no reseteada (ausente_en IS NOT NULL, consecutivas=2)
TEST 26 OK: sync_inicializar_publicada_en propagó publicada_en a actividad y sección
TEST 6 OK: academia_ids vacío → 0 filas en las 19 tablas con RLS
TEST 6b OK: academia=tecno → 2 colegios visibles, 0 de cleveland
TEST 6b OK: academia=tecno → 4 estudiantes visibles
TEST 6b OK: matriculas visibles = 4
TEST 6c OK: gerente (tecno,cleveland) → 3 colegios, 2 cursos modelo
TEST 13 OK: academia=tecno → 0 filas ajenas en colegios, cursos, asignaciones, estudiantes, matriculas, secciones
TEST 14 OK: INSERT en academia ajena rechazado por RLS (insufficient_privilege)
TEST 15 OK: UPDATE en col_cei (cleveland) con sesión tecno → 0 filas afectadas
TEST 16 OK: DELETE en col_cei (cleveland) con sesión tecno → 0 filas afectadas
TEST 17 OK: v_moodle_upload con academia=tecno → 4 filas, 0 de otra academia
TEST 18a OK: app_user puede INSERT en auditoria (id=1)
TEST 18b OK: UPDATE en auditoria rechazado (sin privilegio)
TEST 18c OK: DELETE en auditoria rechazado (sin privilegio)
TEST 19 OK: login_usuario() devuelve academia_ids="tecno" sin depender de la sesión
TEST 20 OK: login_usuario() usa public.usuarios_app (nombre="Admin Tecno"), no la tabla temporal
TEST 27 OK: sync_worker sin academia → 0 filas en las 7 tablas accesibles
TEST 28 OK: sync_worker academia=tecno → 4 secciones, 6 actividades, 4 matrículas, 0 ajenas
TEST 29a OK: sync_worker puede UPDATE moodle_course_id en asignaciones_moodle
TEST 29b OK: sync_worker puede UPDATE moodle_user_id en matriculas
TEST 29c OK: sync_worker puede INSERT en secciones_moodle (id=6)
TEST 29d OK: sync_worker puede INSERT en actividades_moodle (id=21)
TEST 29e OK: sync_worker puede UPDATE en progreso_actividades
TEST 30 OK: password_enc denegado para sync_worker
TEST 31 OK: enc_iv denegado para sync_worker
TEST 32 OK: sync_worker no puede leer usuarios_app, sesiones ni auditoria (3 denegados)
```

### NO se pudo verificar

- **test_idavuelta.js falla en Node 20** (ver arriba). Correr desde Windows con Node 24.19.0.
- Las cifras del hallazgo (a)/(b) de participantes — **verificadas contra el respaldo real**: 112 participantes sin asignación activa (§2.1) y 193 con `course1` divergente (§2.2). Los conteos son correctos; las causas también verificadas contra el código.
- Si hay datos de Cleveland English Institute en el respaldo actual.
- Si `moodle_user_id` ya existe en algún registro exportado de Moodle real.
- Si los shortnames reales coinciden con los del respaldo (necesario para hallazgo b).
- Comportamiento real en navegador.
- Si el servidor Contabo ya está adquirido y configurado.
- Si `firstaccess` y `lastcourseaccess` vienen en `core_enrol_get_enrolled_users` en la versión específica de Moodle instalada — confirmar con una llamada real al endpoint.
- El ritmo real máximo que soporta el hosting de Moodle sin errores (requiere prueba real).

---

**ESPERANDO APROBACIÓN**

### Mensaje de commit sugerido para v2.6 (no ejecutar)

```
docs+sql: diseño de BD v2.6 — CHECK ausente_en, sync_aplicar_estructura, sync_worker real

Schema v2.6: CONSTRAINT chk_sec_ausente / chk_act_ausente en secciones_moodle y
actividades_moodle (ausente_en IS NULL OR ausencias_consecutivas >= 2);
función sync_aplicar_estructura(asignacion, cmids BIGINT[], token_ok) SECURITY
INVOKER con salvaguardas (a)/(b)/(c): respuesta vacía o token inválido → no op;
incrementa contador de ausentes; marca ausente_en al llegar a 2; nunca resetea
actividades ocultas (visible=FALSE); función sync_inicializar_publicada_en para
propagación de publicada_en desde evidencia de completados.

sync_worker DDL real (era propuesta comentada): CREATE ROLE + GRANTs por columna
en matriculas (sin password_enc ni enc_iv) + UPDATE restringido a 5 columnas del
§3.4 + 9 políticas RLS (mismo patrón que app_user, usa SET LOCAL app.academia_ids
una academia por transacción). Corrección del razonamiento: la separación de
academias la impone la RLS, no los GRANTs de tabla.

Tests (58 NOTICEs, todos OK contra PostgreSQL 16):
- Part 1: actividad 15 ausencias_consecutivas=2 (CHECK lo requiere); setval para
  sincronizar secuencias tras INSERTs explícitos.
- PRE-TEST A: verifica CHECK activo. PRE-TEST B: verifica función existe.
- TEST 23-25 reescritos: llaman sync_aplicar_estructura con entradas reales.
- TEST 26 reescrito: llama sync_inicializar_publicada_en.
- TEST 27-32: sync_worker (0 filas sin academia; aislamiento RLS; 5 ops §3.4;
  password_enc/enc_iv denegados; usuarios_app/sesiones/auditoria denegados).

Docs: §3.3 sync_worker DDL real + razonamiento RLS corregido; §3.6 funciones
reales documentadas; §6 salida psql actualizada a 58 NOTICEs.
```
