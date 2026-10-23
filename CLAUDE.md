# CLAUDE.md — Proyectos (Organizador Moodle)

Memoria operativa para cualquier sesión de Claude Code en este repositorio. **Este archivo es el índice y las reglas.** El detalle técnico verificado línea por línea vive en [`nueva documentacion.md`](nueva%20documentacion.md) — ante cualquier duda técnica profunda (modelo de datos completo, reglas de negocio, sincronización, deuda técnica detallada), léelo primero. Si `CLAUDE.md` y `nueva documentacion.md` contradicen al código actual, **gana el código**, y hay que corregir ambos documentos.

Última revisión completa de este archivo: **2026-10-23**, por una sesión de Claude Code que retiró Firebase (Fase 3) y actualizó toda la documentación.

---

## 1. Qué es este proyecto

Nació como un **Organizador de Moodle**: una web estática (HTML+CSS+JS, sin build, sin backend) para que dos academias —**TecnoCleveland** (robótica) y **Cleveland English Institute** (inglés)— controlen qué curso modelo de Moodle se copió a cada colegio, generen usuarios de Moodle en bloque y generen carnets de acceso imprimibles. Hoy vive en `Organizador_moodle/`, se despliega en Firebase Hosting, y opera en modo **100% local** (localStorage + respaldo .json). La sincronización con Firebase (Fase 2, oct 2026) fue retirada en oct 2026 porque nunca llegó a funcionar; el plan es reactivarla contra un backend propio en el VPS (ver §9 y §10).

**Destino declarado por el dueño del proyecto:** convertirlo en un **sistema de control de estudio** para ambas academias, mudarlo a un **servidor Contabo con dominio propio**, desarrollando primero en local y migrando después. **No se ha definido todavía** qué va a controlar exactamente ese sistema nuevo, qué roles/permisos tendrá, ni los detalles del servidor/dominio — ver §14 "Pendiente de confirmar". No inventes funcionalidad de ese sistema nuevo: hoy solo existe el Organizador descrito arriba.

---

## 2. Estado actual (verificado 2026-10-22)

- **Rama:** `main`. **Al día con `origin/main`** (verificado 2026-10-23, quinta sesión: `git fetch` → sin cambios nuevos; `git status -sb` → `## main...origin/main`; cambios locales sin commit en `CLAUDE.md`, `docs/diseno_base_de_datos_v2.md`, `database/postgres/schema.sql`, `database/postgres/tests/test_integridad.sql`).
- **Commit actual (HEAD):** `4c3ac5b` — "Revision de mudanza a servidor" (pusheado desde Windows, posterior al retiro de Firebase).
- **Último commit de código de la app:** `7b635d2` (2026-10-23, misma sesión). Antes: `cf9e028` "nuevos cambios" (2026-10-14) — edición de nombre conservando usuario + cambio de sufijo de colegio.
- **Producción:** pendiente de deploy (Firebase Hosting) tras los cambios de la Fase 3. `.firebaserc` y el bloque `hosting` de `firebase.json` se conservan para seguir desplegando en Firebase Hosting hasta migrar al VPS.
- **Herramientas:** `node v24.19.0`, `npm 11.17.0`, `firebase-tools 15.32.1`, `git 2.55.0.windows.5`.

**Si al empezar una tarea nueva `git status -sb` muestra que `main` está detrás de `origin/main`: detente y avisa.** El dueño trabaja desde dos equipos (Windows y un Chromebook); seguir sin avisar puede pisar trabajo hecho en el otro equipo.

---

## 3. Mapa del repositorio

| Ruta | Propósito | Estado | ¿Se publica en Hosting? |
|---|---|---|---|
| `Organizador_moodle/` | App activa (ver §1 y §5) | **Activo** | **Sí** — `firebase.json` → `hosting.public` |
| `Organizador/` | Proyecto previo **totalmente distinto y no relacionado** ("Dreha", gestor de tareas personal). Firebase Realtime Database propio (proyecto `dreha-974dc`), login y `script.js` propios. **No comparte código con `Organizador_moodle/`.** | Heredado — no tocar sin orden expresa | No |
| `stickers/` | Generador de carnets independiente, predecesor de `carnets.js`. Su motor de PDF (`js/stickers.js`) es la base de la que se copió `carnets-pdf.js` (el propio comentario de cabecera de `carnets-pdf.js` dice "Adaptado de stickers/js/stickers.js") | Heredado / duplicado — se conserva a propósito como respaldo independiente | No |
| `Workflows/` | Prompts/runbooks en `.md` para que un asistente de IA ejecute tareas contra la **API REST de Moodle** (copiar cursos entre colegios, importar clases nuevas desde un curso staging, poner nombres en mayúsculas). No están conectados al código de la app — son instrucciones operativas manuales | Activo (como documentación operativa) | No |
| `database/` | Esquema SQL portable + scripts de migración/prueba, pensados para una futura base de datos propia (preparación para Contabo, ver §10) | Activo, en desarrollo — aún no usado en producción | No |
| `.firebase/`, `.firebaserc`, `firebase.json` | Config y caché de despliegue de Firebase Hosting (ver §9). `firebase.json` conserva solo el bloque `"hosting"` desde 2026-10-23. `firestore.rules` eliminado. | Activo (solo hosting) | `.firebase/` no debería estar versionado (ver §13) |
| `nueva documentacion.md` | Documentación técnica detallada y vigente, verificada contra el código | Activo — fuente de verdad técnica | No |
| `README.md` | — | **Desactualizado**: enlaza a `documentacion_organizador_moodle.md`, archivo que ya no existe (fue reemplazado por `nueva documentacion.md`) | No |
| `agregar_estudiantes_a_lista.md`, `cambiar_sufijo_colegio.md`, `participantes_y_carnets.md`, `INSTRUCCION_sincronizacion_firebase_y_base_de_datos.md`, `PLAN_sincronizacion_firebase.md` | Instrucciones históricas, una por funcionalidad | **Ya aplicadas** — cada una coincide con un commit real que implementa exactamente lo que pide (ver §12) | No |

`Organizador_moodle/LEEME.txt` y `stickers/LEEME.txt` son manuales de usuario final (no técnicos); el primero está incompleto (no menciona el Generador de usuarios, la paginación ni la nube) pero no contradice al código.

---

## 4. Cómo trabajar en local

```powershell
# Desde la raíz del repo
cd Organizador_moodle
python -m http.server 8743
# abrir http://localhost:8743/login.html
```
Probado en esta sesión: responde `200 OK` en `login.html` y `script.js`. Alternativa equivalente: `npx serve Organizador_moodle`.

**Por qué servir por `http://localhost` y no abrir `index.html` como archivo:** el código propio no usa módulos ES ni `fetch` (solo las librerías de `lib/` lo hacen internamente), así que abrir como `file://` no rompe la app — pero Chrome trata todas las páginas `file://` como un origen ambiguo/compartido para `localStorage`, y el SDK de Firebase Auth tiene soporte pobre sobre `file://`. Servir por HTTP da un origen propio, igual que tendrá el dominio real en producción.

**Pruebas y verificación de sintaxis:**
```powershell
node --check Organizador_moodle/script.js   # y cualquier otro .js propio que toques (no los de lib/)
node database/scripts/test_agregar_estudiantes.js
node database/scripts/test_cambiar_sufijo.js
node database/scripts/test_idavuelta.js
node database/scripts/test_sync_core.js
node database/scripts/test_sync_dos_dispositivos.js
```
Las 5 pruebas pasan al 100% hoy (ver resultado completo en §11). Cubren lógica pura (numeración, sufijos, sincronización, ida/vuelta SQL); **no** cubren interacción real de DOM/navegador ni Firebase real.

**Evitar escribir en producción mientras desarrollas:**
`firebase-config.js` tiene credenciales reales — la app (local o desplegada) se conecta siempre al mismo proyecto Firebase, no hay distinción de entorno ni emuladores configurados (`firebase.json` no tiene bloque `emulators`). Mientras no pulses **"☁ Conectar con la nube"** dentro de la app, todo queda en modo solo local (`localStorage`) y no se escribe nada en Firestore. **No inicies sesión con credenciales reales de Firebase Auth en una sesión de pruebas** salvo que quieras probar la sincronización a propósito y sepas que estás tocando la nube real. Si se necesita probar sync sin riesgo, hay que construir el soporte de Emulator Suite — no existe hoy (ver §14).

---

## 5. Arquitectura

**Capas:** login por código (`login.html`, standalone) → guardia de sesión (`index.html`, antes de pintar `<body>`) → config multi-academia (`academias.js`, debe cargar primero) → núcleo de la app (`script.js`) → módulos IIFE aislados (`carnets.js`+`carnets-pdf.js` para el generador de carnets) → capa de sincronización opcional (`sync.js` interfaz pública, `sync-core.js` lógica pura, `sync-firebase.js` único adaptador que toca `firebase.*`).

**Orden de carga obligatorio en `index.html`** (no reordenar):
```
academias.js?v=2 → sync-core.js?v=1
  → lib/xlsx.full.min.js → lib/jspdf.umd.min.js → lib/jszip.min.js
  → script.js?v=13 → carnets-pdf.js?v=2 → carnets.js?v=4
```
`script.js` lee `ACADEMIA_ACTUAL` al vuelo, por eso `academias.js` va primero. `sync-core.js` se mantiene en el HTML para que esté disponible cuando se reactive `sync.js` con el adaptador REST del VPS. **Cuando se active el backend VPS**, agregar después de `sync-core.js?v=1`: `<script src="sync.js?v=2">` y `<script src="sync-rest.js?v=1">`.

**Flujo de arranque:** `login.html` valida el código contra `USERS` (en el propio archivo) → guarda `tcUser`/`tcAcademia` en `sessionStorage` → `index.html` exige ambas claves o redirige a login → `script.js`: `loadData()` → `applyAcademiaBranding()` → `renderAll()` → `Carnets.init()`.

**Multi-academia (`academias.js`):** cada academia (`tecno`/`cleveland`) define `storageKey` (clave de `localStorage`, **"¡NO cambiar!" en el propio código**), `emailDominio`, `importarCSV`, `importarCSVConservarDatos`, `idiomaCarnet`, `idiomaUI`. Todo el resto del código lee estos flags — nunca hardcodea nada por academia salvo las excepciones ya señaladas en §8. Detalle completo: `nueva documentacion.md` §3.

---

## 6. Modelo de datos y almacenamiento

Objeto global `data` (memoria + `localStorage[STORAGE_KEY]`): `colegios`, `cursos` (catálogo modelo), `asignaciones` (curso copiado a un colegio), `participantes` (estudiantes/usuarios Moodle generados), `carnetListas` (Modo 1 de carnets), `carnetOpciones`, y `trash.{colegios,cursos,asignaciones,participantes,estudiantes,carnetListas}` (papelera de 6 secciones). Esquema completo con ejemplos: `nueva documentacion.md` §4.1.

**Claves de `localStorage` — las de datos son intocables:**
- `tc_organizador_data` / `cc_organizador_data` — datos reales de cada academia en producción. **Nunca renombrar.**
- `tc_dark`, `tc_sidebar_collapsed` — preferencias de UI del navegador, fuera de `data`, fuera del Respaldo.
- `<storageKey>__sync_baseline` / `__sync_rev` / `__sync_cloud_email` — metadatos de sincronización, fuera de `data`, fuera del Respaldo.

**Retrocompatibilidad:** `loadData()` e `importBackup()` (`script.js`, **no están factorizadas en una función común** — hay que editar ambas si se agrega una clave) usan el patrón `parsed.clave || valorPorDefecto` para que un `localStorage` o un respaldo `.json` de cualquier versión anterior cargue sin romperse. **Formato del respaldo:** el objeto `data` completo + `_academia`, `_versionEsquema`, `_exportadoEn`, `_exportadoPor`, `_resumen`.

---

## 7. Funcionalidades y dónde viven

| Funcionalidad | Archivo · función clave | Regla crítica |
|---|---|---|
| Panel | `script.js` → `renderDashboard()` | Solo lectura |
| Colegios / cursos copiados | `script.js` → `saveCollege`, `deleteCollege` (soft-delete a papelera) | — |
| Cambiar sufijo de colegio | `script.js` → `construirPlanCambioSufijo()` (pura) + `aplicarPlanCambioSufijo()` | Nunca cambia el dígito ni su ancho; se bloquea si hay choque de username en toda la academia (activos + papelera) |
| Cursos modelo | `script.js` → `saveCurso`/`deleteCurso` | Catálogo compartido entre colegios de la misma academia |
| Generador de usuarios — numeración | `script.js` → `generarListaUsuarios()` | Prefijo = texto tras el último `-` de `nombreCorto`; siguiente número = máximo visto + 1, nunca reutiliza huecos salvo "Reestructurar" explícito |
| Generador de usuarios — importar CSV | `script.js` → `importarCSVArchivo()` | Comportamiento depende de `importarCSVConservarDatos` (Cleveland conserva datos literales del CSV; Tecno recalcula) |
| Generador de usuarios — modo agregar | `script.js` → `_entrarModoAgregar`, `_generarListaEnModoAgregar`, `_guardarListaEnModoAgregar` | Compara por nombre/apellido normalizado; solo genera usuarios nuevos; no toca la papelera |
| Editar nombre conservando usuario | `script.js` → `_aplicarEdicionNombre()` | El prefijo de `firstname` nunca puede diferir del `username` real |
| Eliminar/reestructurar estudiante | `script.js` → `calcularReestructura()` (pura) | Renumera solo a los posteriores de la misma lista+prefijo |
| Generador de carnets (2 modos) | `carnets.js` + `carnets-pdf.js` | Modo 1 (`data.carnetListas`) sin `colegioId`; Modo 2 lee en vivo de `data.participantes`, sin persistir nada nuevo |
| Exportaciones XLSX/PDF | `script.js` → `descargarXLSXParticipantesColegio`, `descargarPDFParticipantesColegio`, `descargarNivelXLSX/PDF` | Nombres por nivel (`Estudiantes Media.pdf`, etc.) no incluyen el colegio — riesgo de sobrescritura si se descargan varios colegios (ver §13) |
| Buscar | `script.js` → `renderBuscar()`, `exportReportCSV()` | — |
| Respaldo (export/import `.json`) | `script.js` → `exportBackup`/`importBackup` | Respaldo automático antes de reemplazar si `data` no está vacío; confirmación extra si la nube está vinculada |
| Papelera (6 secciones) | `script.js` → `restoreX`/`permaDeleteX` simétricos | Nada se borra para siempre salvo "Eliminar para siempre" / "Vaciar papelera" explícitos |
| Sincronización con la nube | *Retirada en 2026-10-23. Ver §9 y §10.* | `sync-core.js` conservado en disco |

Detalle función por función, con líneas aproximadas: `nueva documentacion.md` §6–§7.

---

## 8. Invariantes (nunca romper)

1. `tc_organizador_data` / `cc_organizador_data` son las claves reales de producción — nunca cambiarlas ni renombrarlas.
2. Cualquier cambio al esquema de `data` debe seguir cargando `localStorage` y respaldos `.json` antiguos sin romperse (`parsed.x || default` en **ambos** `loadData()` e `importBackup()`, más el default en `freshData()`).
3. **Separación estricta Tecno/Cleveland**: ningún archivo del cliente debe leer datos de una academia mientras `ACADEMIA_ACTUAL` es la otra. En la nube, esa separación la garantizan las reglas de Firestore (`firestore.rules` + `auth_map`), no solo el cliente.
4. El cambio de sufijo de colegio nunca cambia el dígito del username ni su ancho, y se bloquea entero si hay un choque exacto de username en cualquier parte de la academia.
5. El prefijo de `firstname` nunca puede diferir del `username` real de la fila.
6. La numeración de usuarios nunca reutiliza números ya activos (solo "Reestructurar" explícito).
7. `script.js`, `carnets.js` y `login.html` no llaman a `firebase.*` ni a `window.Sync` — Firebase fue retirado en 2026-10-23. Cuando se active el backend VPS, solo `sync-rest.js` (adaptador REST) hablará con el servidor; `script.js` y `sync.js` no cambiarán (ver §10).
8. Nada de código ejecuta `git push`, `firebase deploy` ni `firebase deploy --only firestore:rules` automáticamente.
9. Nunca se sube a git un respaldo `.json` real, un CSV con datos de estudiantes, una clave de cuenta de servicio de Firebase, ni una base `.db`/`.sql` con datos reales — el `.gitignore` de la raíz ya los excluye; no debilitarlo.
10. Antes de tocar `carnets-pdf.js`, revisar si el cambio también aplica a `stickers/js/stickers.js` (dos copias del mismo motor de PDF, ver §3).

---

## 9. Sincronización y nube

**Firebase (Firestore + Auth) fue retirado completamente el 2026-10-23.** La app opera en modo 100% local: `localStorage` + respaldo `.json` manual. Los archivos `sync-firebase.js`, `firebase-config.js`, `lib/firebase-*-compat.min.js` y `firestore.rules` fueron eliminados. El bloque `"hosting"` de `firebase.json` y `.firebaserc` se conservan para seguir desplegando en Firebase Hosting.

**Lo que se conserva en disco para el VPS:**
- `sync-core.js` — lógica pura de diff/fusión/tombstones; se carga en `index.html` y lo usan las pruebas de `database/scripts/`.
- `sync.js` — interfaz genérica `window.Sync`; en disco pero **sin `<script>` en `index.html`**. Se reutiliza sin cambios cuando el VPS tenga su adaptador REST.
- El contrato de 7 funciones que cualquier adaptador debe implementar está documentado en `database/MIGRACION_A_SERVIDOR_PROPIO.md`.

Separación Tecno/Cleveland la garantiza hoy solo `storageKey` (cliente). Cuando exista el backend VPS deberá replicarse también en las reglas de autorización del servidor.

---

## 10. Preparación para Contabo (diagnóstico, sin diseñar nada nuevo)

- **Se copia tal cual:** todo `Organizador_moodle/` (HTML/CSS/JS propios + `lib/` de terceros) — es estático, sin build.
- **Se reemplaza:** `sync-firebase.js` (por un adaptador nuevo contra la API propia, mismo contrato de 7 funciones — la capa `window.Sync` ya está bien abstraída para esto), el login por código corto de `login.html` (hoy en texto plano en el HTML cliente, versionado en git), `firestore.rules` (por el mecanismo de autorización del backend nuevo), y Firestore (por el esquema SQL ya existente en `database/schema.sql`).
- **Falta construir:** una API/backend (hoy no existe — el navegador habla directo con Firebase), la base SQL corriendo en el servidor, usuarios/roles reales (hoy es solo "nombre + academia" por código), HTTPS con el dominio propio, copias de seguridad automatizadas en el servidor (hoy la única es el `.json` manual).
- **Riesgos del cambio:** autenticación actual basada en códigos cortos visibles en el navegador y en el historial de git; posibles datos de menores de edad (nombres de estudiantes); la separación Tecno/Cleveland debe replicarse estrictamente en cada tabla/consulta del backend nuevo, igual que hoy la garantizan `storageKey` + `firestore.rules`.
- Preguntas abiertas del dueño necesarias antes de diseñar esto: ver §14.

---

## 11. Pruebas y salud del código (verificado 2026-10-22)

**`node --check`:** pasa sin errores en **todos** los `.js` propios (`Organizador_moodle/*.js`, `Organizador/script.js`, `stickers/js/*.js`, `database/scripts/*.js`), excluyendo `lib/`. Verificado de nuevo en 2026-10-23 tras el retiro de Firebase.

**Pruebas de `database/scripts/` — las 5 pasan al 100%:** `test_agregar_estudiantes.js` (32/32), `test_cambiar_sufijo.js` (18/18), `test_idavuelta.js` (incluye caso de 5 000 participantes), `test_sync_core.js` (7/7), `test_sync_dos_dispositivos.js` (2/2). Cobertura fuerte en lógica pura de negocio; nula en interacción de DOM real y contra Firebase/MySQL reales (documentado como limitación conocida, no como bug).

**Motor de PDF duplicado — confirmado:** `carnets-pdf.js` (función `drawSticker` y utilidades) es copia adaptada de `stickers/js/stickers.js`, admitido en el propio comentario de cabecera del archivo. Un cambio de diseño en uno no se propaga al otro.

**Deuda técnica adicional observada:**
- `script.js` es un monolito de **3552 líneas**, ~150+ funciones globales en un único scope, sin módulos.
- Código muerto confirmado: `deleteCollege` y `slugify` (ambos en `script.js`) no se invocan desde ningún otro punto; `NAV_VIEWS` está declarado pero no se usa y no incluye `'carnets'`.
- `buildUsuariosCSV()` no escapa comas/comillas (a diferencia de `exportReportCSV()`); ningún exportador de CSV neutraliza `=`/`+`/`-`/`@` (riesgo teórico bajo de "CSV injection" en Excel, uso interno).
- Los archivos de `lib/` y `login.html` no llevan `?v=` de cache-busting (inconsistencia conocida, no crítica).

---

## 12. Reglas de trabajo para Claude Code

**Al empezar cualquier tarea**
- Leer este archivo completo; ejecutar `git status` y `git log --oneline -10`; si falta reconciliar el Registro de cambios (§15) con hashes nuevos, hazlo.
- Verificar que la copia está al día con `origin/main` (`git fetch` + `git status -sb`); si no, **detenerse y avisar** (el usuario trabaja en Windows y en un Chromebook).
- El código manda: si algo contradice a este archivo o a `nueva documentacion.md`, gana el código — corrige la documentación de paso.
- Para cambios grandes o que toquen datos/nube/seguridad: **plan primero y esperar aprobación** antes de modificar archivos.

**Durante la tarea**
- Todo en español (código, comentarios, textos de interfaz, mensajes), salvo el contenido impreso de los carnets de Cleveland English Institute (va en inglés).
- No tocar `Organizador/`, `stickers/`, `Workflows/` ni `.firebase/` salvo orden expresa.
- No renombrar ni tocar las claves de `localStorage` de datos de las academias (§6, §8).
- Mantener retrocompatibilidad con respaldos `.json` y datos antiguos; separación estricta Tecno/Cleveland.
- Subir +1 el `?v=` solo de los archivos modificados en `index.html`.
- Usar siempre datos ficticios en pruebas; nunca datos reales de estudiantes.
- Si algo es ambiguo, no adivinar: preguntar, o dejarlo en "Pendiente de confirmar" (§14).
- Cambios pequeños y enfocados; no refactorizar de paso (aunque la deuda técnica de §11 sea tentadora).

**Al terminar**
- `node --check` en lo modificado y las 5 pruebas existentes de `database/scripts/`; agregar pruebas nuevas para lógica pura nueva.
- Actualizar este archivo (§2 Estado actual y §15 Registro de cambios) y `nueva documentacion.md` (sección "Cambios" + las secciones afectadas).
- Reportar qué se probó y qué **no** se pudo probar (normalmente: interacción real en navegador y Firebase/MySQL real).
- **Nunca** ejecutar `git commit`, `git push`, `git tag` ni `firebase deploy` sin orden explícita del usuario. Al terminar, **sugerir** el mensaje de commit exacto y los comandos de deploy, pero no ejecutarlos.

---

## 13. Cómo revertir

- **Convención:** un cambio = un commit, mensaje en español `tipo: resumen` (`feat:`, `fix:`, `docs:`, `refactor:`), para que cada entrada del Registro de cambios (§15) apunte a un commit revertible.
- **Revertir un commit ya hecho:** `git log --oneline` para ubicarlo, luego `git revert <hash>` (crea un commit nuevo que deshace el cambio; se prefiere sobre `git reset` porque no reescribe historia ya compartida con `origin/main` ni con el otro equipo del usuario).
- **Descartar cambios sin commit:** `git restore <archivo>` (un archivo) o `git restore .` (todo) — seguro mientras no se haya hecho `git add`/`commit` de lo que se quiere descartar; revisa `git status` antes.
- **Volver a un punto estable con una etiqueta:** se propone la etiqueta `base-organizador-2026-10-22` para marcar el estado actual (commit `cb928be`, verificado en esta sesión). **El usuario debe crearla y subirla él mismo:**
  ```powershell
  git tag -a base-organizador-2026-10-22 -m "Estado verificado antes de crear CLAUDE.md"
  git push origin base-organizador-2026-10-22
  ```
  Para volver a ella más adelante: `git checkout base-organizador-2026-10-22` (o `git reset --hard` solo si el usuario lo pide explícitamente).
- **Ramas:** `main` se mantiene estable. Para trabajo grande y arriesgado (el sistema de control de estudio, la migración a Contabo), se propone abrir ramas dedicadas, p. ej. `control-estudio` y `servidor-propio`, y fusionarlas a `main` solo cuando estén verificadas — así un experimento largo nunca deja a `main` en un estado intermedio entre los dos equipos del usuario.
- **Revertir un despliegue de Firebase Hosting:** Firebase Console → proyecto `moodle-organizador` → Hosting → "Historial de versiones" → elegir una versión anterior → "Revertir" (instantáneo). Alternativa desde git: `git worktree add ../rollback-tmp <hash-anterior>` y `firebase deploy --only hosting` desde ahí; luego borrar el worktree temporal.
- **Datos:** el respaldo `.json` (vista Respaldo → "⬇ Exportar respaldo") es la copia de seguridad real de los datos. Expórtalo **antes** de cualquier cambio que toque el esquema de `data` o la numeración masiva (la propia app ya descarga uno automático antes de "Importar respaldo" y antes de "Cambiar sufijo"). Para restaurar: vista Respaldo → "⬆ Importar respaldo".
- **Lo que `git` nunca revierte:** los datos reales en `localStorage` del navegador de cada usuario y en Firestore (si hay nube vinculada). La única protección real es el respaldo `.json` exportado con frecuencia y, para la nube, los respaldos automáticos silenciosos que la app ya hace antes de operaciones riesgosas (ver `nueva documentacion.md` §11.6).

---

## 14. Pendiente de confirmar (preguntas para el dueño)

1. **Sistema de control de estudio:** ¿qué debe controlar exactamente (asistencia, calificaciones, progreso de cursos, pagos, otra cosa)? ¿Qué roles/permisos además de "nombre + academia"? ¿Quién debe poder acceder (solo las dos academias, también profesores/padres/estudiantes)?
2. **Volumen de datos** esperado (cuántos estudiantes/cursos) para dimensionar el servidor Contabo y la base SQL.
3. **Dominio y HTTPS:** ¿ya están decididos el dominio y el proveedor de certificado, o hay que elegirlos como parte de este trabajo?
4. **Copias de seguridad en el servidor nuevo:** ¿frecuencia y retención deseadas?
5. ~~**Estado real de los pasos manuales de Firebase**~~ — ya no aplica; Firebase fue retirado el 2026-10-23 (ver §9).
6. **Token de la API REST de Moodle expuesto en texto plano** en varios archivos de `Workflows/*.md` (commiteado en git, visible en el historial). No se reprodujo aquí por seguridad. Se recomienda **rotarlo en Moodle** y, de aquí en adelante, no volver a escribirlo en archivos versionados — fuera del alcance de esta tarea (no se tocó `Workflows/`), pero es un hallazgo crítico que el dueño debe resolver él mismo.
7. **Códigos de acceso de `login.html`** (`USERS`) son en texto plano, visibles en el código fuente publicado y en el historial de git — aceptado hoy como diseño simple, pero es el primer invariante a reemplazar si el sistema de control de estudio necesita autenticación más fuerte.
8. ¿Se quiere reorganizar los `.md` de instrucciones históricas de la raíz (ya aplicadas, ver §3) a una carpeta como `docs/instrucciones/`? Esta sesión no lo hizo — solo lo propone.

---

## 15. Registro de cambios

Reconstruido desde `git log` (historial real, hashes verificados). Agrupado por funcionalidad, más antiguo primero. La historia previa a `Organizador_moodle/` (commits del proyecto heredado "Dreha" en `Organizador/`, y un intento de plugin de modo oscuro para Moodle en `Moodle_local/`/`Plugins_moodle/`, ambos borrados en `a54cd4a` del 2026-09-22) se omite aquí por no ser parte de la app activa.

| Fecha | Commit | Tipo: resumen | Archivos principales | Cómo revertir |
|---|---|---|---|---|
| 2026-09-22 | `70f7de5` | feat: nace `Organizador_moodle/` (login, index, script, styles) | `Organizador_moodle/*` | `git revert 70f7de5` |
| 2026-09-25 | `bdae004`, `bc0fe66` | feat: generador de usuarios CSV, pestaña Participantes, eliminar listas, múltiples grupos | `Organizador_moodle/index.html`, `script.js` | `git revert <hash>` |
| 2026-09-27 | `23ed34e`, `a8f649e` | feat: numeración de primaria, importar CSV, separación Media/Primaria, XLSX, buscador | `script.js`, `index.html`, `lib/xlsx.full.min.js` | `git revert <hash>` |
| 2026-10-01 | `4463ba4` | feat: multi-academia — login por código, datos separados, marca dinámica | `academias.js` (nuevo), `login.html`, `script.js`, `styles.css` | `git revert 4463ba4` |
| 2026-10-01 | `8eda02e`, `5aaad2d` | feat: Generador de carnets (Modo 1 y Modo 2) | `carnets.js`, `carnets-pdf.js`, `carnets.css` (nuevos) | `git revert <hash>` |
| 2026-10-01 | `1ff425c` | refactor: `stickers/` se extrae como generador independiente | `stickers/*` (nuevo) | `git revert 1ff425c` |
| 2026-10-04 | `7479d08` | feat/fix: acordeones, eliminar estudiante, paginación de Colegios, fix Buscar, papelera ampliada (resuelve §11.2 y §11.3 de `nueva documentacion.md`) | `script.js`, `index.html`, `styles.css` | `git revert 7479d08` |
| 2026-10-04 | `a47a813` | feat: nombre de archivo de descargas por año/grado y grupo | `script.js`, `index.html` | `git revert a47a813` |
| 2026-10-04 | `2759783` | docs: limpieza de instrucciones viejas, primera versión de `nueva documentacion.md` | `*.md` | `git revert 2759783` |
| 2026-10-06 | `aa1b8e9` | fix/feat: scroll horizontal + columna 🗑 sticky, sidebar ocultable, Importar CSV para Cleveland con carga fiel | `academias.js`, `script.js`, `styles.css`, `index.html` | `git revert aa1b8e9` |
| 2026-10-06 | `c0e1e4b` | feat: **Fase 2** — sincronización con Firebase (`sync.js`/`sync-core.js`/`sync-firebase.js`) + esquema SQL portable (`database/`) + respaldo ampliado | `Organizador_moodle/sync*.js`, `firebase-config.js`, `database/*`, `firestore.rules`, `firebase.json` | `git revert c0e1e4b` (revisar impacto en `firestore.rules` si ya se publicó) |
| 2026-10-06 | `1aed6d5` | fix: valores reales en `firebase-config.js` | `Organizador_moodle/firebase-config.js` | `git revert 1aed6d5` |
| 2026-10-09 | `ff8bd17` | feat: modo agregar estudiantes a una lista existente (+ campo `agregadoEn`) | `script.js`, `styles.css`, `database/schema.sql`, `mapeo.js`, `test_agregar_estudiantes.js` (nuevo) | `git revert ff8bd17` |
| 2026-10-09 | `a38e43e` | feat: exportaciones PDF/XLSX por nivel, PDF de participantes, nombres de carnets por grado | `script.js`, `carnets.js`, `carnets-pdf.js` | `git revert a38e43e` |
| 2026-10-09 | `4dee9e5` | fix: detección de nivel Media cuando `p.nivel` falta o es no-canónico (`nivelDe()`) | `script.js`, `carnets.js` | `git revert 4dee9e5` |
| 2026-10-10 a 2026-10-14 | `1e1f30c`, `6f2030c`, `e840b3e`, `ea13c64` | docs: runbooks de `Workflows/` (automatización de Moodle, no toca la app) | `Workflows/*` | `git revert <hash>` |
| 2026-10-14 | `cf9e028` | feat: editar nombre/apellido conservando usuario + cambiar sufijo de colegio (genérico, cualquier academia) | `script.js`, `test_cambiar_sufijo.js` (nuevo), `test_agregar_estudiantes.js` | `git revert cf9e028` |
| 2026-10-14 | `cb928be` | merge: `main` con `origin/main` | — | no aplica (merge) |
| 2026-10-22 | sin commit | docs: creación de `CLAUDE.md` + actualización de `nueva documentacion.md` | `CLAUDE.md` (nuevo), `nueva documentacion.md` | `git restore CLAUDE.md "nueva documentacion.md"` (antes de `git add`) |
| 2026-10-23 | `bae980d` | cambios (incluye el commit de `CLAUDE.md` + `nueva documentacion.md` de la sesión anterior) | ver `git show bae980d` | `git revert bae980d` |
| 2026-10-23 | `7b635d2` | refactor: retiro completo de Firebase (Fase 3) — app 100% local | `Organizador_moodle/index.html`, `script.js`, `styles.css`; eliminados `sync-firebase.js`, `firebase-config.js`, `lib/firebase-*-compat.min.js`, `firestore.rules`; editados `firebase.json`, `LEEME.txt`, `CLAUDE.md`, `nueva documentacion.md`, `database/MIGRACION_A_SERVIDOR_PROPIO.md` | `git revert 7b635d2` |
| 2026-10-23 | sin commit | docs: diseño de base de datos v2.2 + DDL PostgreSQL + pruebas | `docs/diseno_base_de_datos_v2.md` (v2.1→v2.2), `database/postgres/schema.sql` (nuevo), `database/postgres/tests/test_integridad.sql` (nuevo), `CLAUDE.md` (§2+§15) | `git restore docs/diseno_base_de_datos_v2.md CLAUDE.md && rm -rf database/postgres/` (antes de `git add`) |
| **2026-10-23** | **sin commit** | **docs+sql: diseño de BD v2.3 — seguridad RLS, sync real, cifrado, progreso** | `docs/diseno_base_de_datos_v2.md` (v2.2→v2.3), `database/postgres/schema.sql` (v2.3), `database/postgres/tests/test_integridad.sql` (22 pruebas, ejecutadas en PG16), `CLAUDE.md` (§2+§15) | `git restore docs/diseno_base_de_datos_v2.md database/postgres/schema.sql database/postgres/tests/test_integridad.sql CLAUDE.md` (antes de `git add`) |
| **2026-10-23** | **sin commit** | **docs+sql: diseño de BD v2.4 — rango unidades, login hardening, ausente_en, sync periódico** | `docs/diseno_base_de_datos_v2.md` (v2.3→v2.4), `database/postgres/schema.sql` (v2.4: `ausente_en`, `login_usuario()` hardening, `sync_queue`), `database/postgres/tests/test_integridad.sql` (tests 9/9b/9c reescritos + 9_EMPTY_RANGO/9_RANGO_COLEGIO/20/21/22 nuevos, 33 checks totales ejecutados en PG16), `CLAUDE.md` (§2+§15) | `git restore docs/diseno_base_de_datos_v2.md database/postgres/schema.sql database/postgres/tests/test_integridad.sql CLAUDE.md` (antes de `git add`) |
| **2026-10-23** | **sin commit** | **docs+sql: diseño de BD v2.5 — ausente_en safeguards, sync_worker, publicada_en propagación** | `docs/diseno_base_de_datos_v2.md` (v2.4→v2.5), `database/postgres/schema.sql` (v2.5: `ausencias_consecutivas`, `uk_sync_queue_pendiente` extendido a `en_proceso`, REVOKE TEMPORARY corregido, `sync_worker` DDL), `database/postgres/tests/test_integridad.sql` (TEST 22 extendido + TEST 23/24/25/26 nuevos, 46 NOTICEs ejecutados en PG16), `CLAUDE.md` (§2+§15) | `git restore docs/diseno_base_de_datos_v2.md database/postgres/schema.sql database/postgres/tests/test_integridad.sql CLAUDE.md` (antes de `git add`) |

---

*Fin de `CLAUDE.md`. Para cualquier detalle no cubierto aquí, ver [`nueva documentacion.md`](nueva%20documentacion.md).*
