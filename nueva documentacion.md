# Organizador Moodle — Documentación (versión 5, verificada contra el código)

**Fecha de verificación:** 2026-10-06
**Commit base (v5):** `2759783` — árbol limpio al comienzo de esta versión del documento.
**Cambios en árbol de trabajo (2026-10-06, pendientes de commit):** habilitar "Importar CSV" para Cleveland con carga fiel (`importarCSVConservarDatos`). Ver sección "Cambios — 2026-10-06" abajo.
**Commit base de la v4:** `be0f135`. Entre esos dos puntos se aplicaron y confirmaron tres commits:
- `7479d08` — Generador: acordeones + eliminar estudiante; Colegios: paginación; fix Buscar; Papelera ampliada.
- `a47a813` — Descargas: nombre de archivo por año/grado y grupo (CSV y XLSX).
- `2759783` — Limpieza de instrucciones (borró `INSTRUCCION.md`, `INSTRUCCION_claude_code_generar_documentacion.md`, `INSTRUCCION_claude_code_multiacademia_carnets.md`; agregó `intruccion2.md` y `courseid_871_participants.csv`).
**Documento vigente:** este archivo (`nueva documentacion.md`). La v4 (`documentacion_organizador_moodle.md`) queda como referencia histórica pero no es la fuente de verdad a partir de hoy.
**Verificado por:** lectura directa de todos los archivos de `Organizador_moodle/` y diff completo contra `be0f135`. La v4 ya documentaba correctamente las funciones de los commits `7479d08` y `a47a813`; esta versión actualiza las referencias de estado de commit, elimina menciones a archivos INSTRUCCION borrados, corrige el fragmento de código de `showView()`, y actualiza tablas de líneas y §12.

> **Principio rector: el código manda.** Este documento describe lo que está implementado en el código actual (árbol de trabajo), no lo que se intentó implementar ni lo que dice un documento más viejo.

---

## Cambios respecto a la v4

Esta sección cataloga solo las diferencias entre la v4 y el estado actual. La v4 ya era precisa en las funciones — los cambios son principalmente de estado y contexto, no de comportamiento del código.

### Estado de commits
La v4 decía "cambios de la sesión de 2026-10-04 aplicados en el árbol de trabajo pero todavía sin `git commit`". Esos cambios están ahora en `7479d08` y `a47a813`. Todo el código que la v4 describía está confirmado en el repositorio.

### Archivos de instrucción eliminados
Los archivos `INSTRUCCION.md`, `INSTRUCCION_claude_code_generar_documentacion.md` y `INSTRUCCION_claude_code_multiacademia_carnets.md` fueron borrados en `2759783`. El archivo `intruccion2.md` (instrucción para el nombre de archivos de descarga CSV/XLSX, implementada en `a47a813`) sí existe en la raíz.

### Afirmaciones de la v4 que resultaron inexactas o desactualizadas
- **§1.5, §11.0** — la v4 decía "ver reporte de cierre" refiriéndose a un archivo de instrucción que ya no existe.
- **§2 (tabla de archivos)** — los recuentos de líneas han crecido: `script.js` pasó de 1624 a 2121 líneas, `index.html` de 831 a 898, `styles.css` de 527 a 548, `carnets.js` de 693 a 702. Actualizado en §2 de este documento.
- **§5.1 (fragmento de `showView`)** — el fragmento de código de la v4 omitía la línea `if (id === 'buscar') renderBuscar();`. Corregido en §5.1.
- **§11.0** — el párrafo de "el borrador v2 no existe" ya no es relevante (los archivos INSTRUCCION están borrados). Reemplazado por una nota histórica breve.

### Funciones nuevas desde la v3 (ya documentadas en la v4, confirmadas aquí)
`calcularReestructura`, `accOpen`/`applyAccState`/`toggleAcordeon`, `paginaInfo`/`paginaBotones`/`renderPaginacionHTML`, `renderGenPreviewTitle`, `nombreArchivoDescarga`, `abrirEliminarEstudiante`/`actualizarPreviewReestructura`/`confirmarEliminarEstudiante`, `onCdPartGrupoChange`/`onCdPartSearchInput`/`cdPartSeleccion`/`renderCdPartTitle`, `irAPaginaCdPart`, `buscarEmptyMessage`, `onSearchKeydown`, `renderBuscar`, `trashTotal`, `restoreEstudiante`/`permaDeleteEstudiante`, `restoreCarnetLista`/`permaDeleteCarnetLista`.

### Deuda técnica resuelta desde la v3 (ya señalado en la v4)
- §11.2 (papelera para carnets Modo 1) — **resuelto en `7479d08`**.
- Bug de `onSearchInput` (`display:''` vs `display:'block'`) — **resuelto en `7479d08`**.
- `guardarListaUsuarios` descartaba la versión anterior — **resuelto en `7479d08`** (ahora va a Papelera).
- `resetCatalogs` descartaba colegios/cursos — **resuelto en `7479d08`** (ahora van a Papelera).

---

## Cambios — 2026-10-08 (pendientes de commit)

### Modo agregar estudiantes a una lista existente (Generador de usuarios)

**Archivos modificados:** `script.js` (v6→v7), `styles.css` (v4→v5), `index.html` (versiones actualizadas), `database/schema.sql`, `database/scripts/mapeo.js`, `database/scripts/sqlite-schema.js`, `database/scripts/ejemplo_ficticio.json`.

**Archivo nuevo:** `database/scripts/test_agregar_estudiantes.js`.

**Flujo:** Al pulsar "Ver/Editar" en una lista de "Años ya generados", el Generador entra en **modo agregar**: los selectores de colegio, año y grupo quedan bloqueados; las textareas de Apellidos y Nombres se rellenan con los estudiantes existentes; se muestra un banner informativo con el conteo y un botón "Salir del modo agregar". El usuario escribe los apellidos y nombres de los nuevos estudiantes al final de los cuadros y pulsa "Generar lista". El sistema compara cada par (apellido, nombre) con los existentes (sin distinguir mayúsculas ni espacios), omite los que ya están y genera usuarios solo para los nuevos. La tabla de vista previa muestra los existentes + los nuevos con el badge `Nuevo` y fondo de color. Al pulsar "Guardar lista" en modo agregar, los nuevos se **agregan** a la lista existente (la Papelera no recibe nada); cada participante nuevo lleva el campo opcional `agregadoEn` (ISO 8601). Un botón "⬇ CSV solo de los nuevos" aparece al guardar y también al abrir con Ver/Editar cualquier lista que tenga participantes con `agregadoEn`.

**Reglas de negocio aplicadas:**
- El pool de numeración se calcula igual que en el modo normal: máximo del colegio + nivel + prefijo en `data.participantes` (sin contar la Papelera). El prefijo sale del `nombreCorto` de la asignación (`slice(lastDash + 1)`).
- El ancho de dígitos se mantiene igual: 4 para media, 3 para primaria.
- Filas con prefijo distinto al dominante (docentes importados de Cleveland) no afectan la numeración.
- Lista sin usuarios de formato válido: cae al comportamiento normal de generación.
- Contador en vivo "N existentes · M nuevos" visible mientras se escribe.
- Si se elimina la lista mientras está en modo agregar, se sale del modo con aviso.
- El "Rango de usuarios" de "Años ya generados" ahora muestra rangos no continuos correctamente (p. ej. `ag0001–ag0014, ag0086–ag0090`).

**Campo `agregadoEn` (esquema):**
- Campo **opcional** en `data.participantes[]`: `agregadoEn: string (ISO 8601)`. Su ausencia significa "generado en la creación de la lista". Retrocompatible: `loadData()` e `importBackup()` no requieren cambios (campo extra ignorado por `parsed.x || default`).
- En `database/schema.sql`: columna `agregado_en DATETIME NULL`.
- En `database/scripts/mapeo.js`: `filaParticipante` mapea `p.agregadoEn → agregado_en`; `participante` mapea `p.agregado_en → agregadoEn` (solo si no null).
- En `database/scripts/sqlite-schema.js`: columna `agregado_en TEXT` añadida.
- En `database/scripts/ejemplo_ficticio.json`: un participante con `agregadoEn` de ejemplo.

**Funciones nuevas en `script.js`:**
`salirModoAgregar`, `_entrarModoAgregar`, `_generarListaEnModoAgregar`, `_guardarListaEnModoAgregar`, `actualizarContadorModoAgregar`, `onGenTextareaInput`, `calcularRangos`, `descargarCSVNuevos`.

**Variables de estado nuevas:** `genModoAgregar` (boolean), `genModoAgregarExistentes` (array snapshot de genPreviewRows al entrar en modo agregar).

**Nuevo acordeón/elemento:** no se agregaron acordeones nuevos. El banner de modo agregar (`#gen-modo-agregar-banner`) y el contador (`#gen-modo-contador`) son elementos inline del card principal del Generador.

**Secciones actualizadas en este documento:** §2 (versiones `?v=`), §4.1 (campo `agregadoEn`), §6 (modo agregar, reglas de numeración en modo agregar, CSV de nuevos), §9 (guía para agregar estudiantes), §11 (riesgos nuevos).

---

## Cambios — 2026-10-06 (pendientes de commit)

### Habilitar "Importar CSV" para Cleveland con carga fiel

**Archivos modificados:** `academias.js` (v1→v2), `script.js` (v3→v4), `index.html` (versiones actualizadas).

**`academias.js`:** se agregó el flag `importarCSVConservarDatos` a ambas academias (`tecno: false`, `cleveland: true`) y se cambió `importarCSV: false` a `importarCSV: true` en `cleveland`.

**`script.js` — `importarCSVArchivo()`:** se añade `const conservar = ACADEMIA_ACTUAL.importarCSVConservarDatos === true;` antes del bucle. Cuando `conservar` es `true`:
- El `email` se toma del CSV tal cual (campo "Email address"), sin recalcular con `emailDominio`. Correos externos (hotmail, gmail) quedan intactos.
- Los `nombres` se conservan literales — sin `.trim()` sobre la porción después del primer espacio — de modo que tabulaciones internas se preservan.

Cuando `conservar` es `false` (Tecno): comportamiento exactamente igual al anterior.

**Secciones actualizadas en este documento:** §2 (versiones `?v=`), §3.3 (nuevo flag en tabla), §5.2 (botón ya visible para ambas academias), §6.2 (comportamiento del import según academia), §11.3 (un hardcode menos en el import).

---

## Cambios — 2026-10-06 (correcciones scroll y sidebar, pendientes de commit)

### A — Scroll horizontal en la tabla editable + columna 🗑 sticky

**Causa raíz:** `.acc-body { overflow: hidden; }` en `styles.css` bloqueaba el scroll horizontal de todos los contenedores `.table-wrap` dentro de acordeones (tanto cuando `table-wrap` y `acc-body` coincidían en el mismo `div`, como cuando `acc-body` era el padre de `table-wrap`). El acordeón usa `display:none/block`, no animación de altura, así que el `overflow:hidden` no era necesario.

**Fix en `styles.css`:** `.acc-body` queda sin `overflow` (vacío). Resultado: `.table-wrap { overflow-x: auto; }` funciona correctamente. Se agregaron estilos de scrollbar siempre visible (`::-webkit-scrollbar` 12px + `scrollbar-width: thin`) con colores que usan las variables CSS (`var(--text-muted)`, `var(--surface2)`) y que funcionan en claro, oscuro y ambas academias.

La columna del botón 🗑 es `position: sticky; right: 0;` (selector `#gen-preview-card .data-table th:last-child, td:last-child`) con `background: var(--surface)` y `box-shadow` lateral para separación visual. La tabla editable tiene `min-width: 1200px` para no comprimirse.

**Otras tablas revisadas:**
- `cd-participantes-card .table-wrap`: tiene `.table-wrap` directo sin `.acc-body` padre → ya funcionaba.
- `col-cursos-media` / `col-cursos-primaria`: acordeones en el detalle del colegio → ahora funcionan (mismo fix de `.acc-body`).
- `gen-years-media-wrap` / `gen-years-primaria-wrap`: mismo fix.
- Tablas de Cursos modelo, Papelera, Respaldo: no son tablas anchas con inputs, no necesitaban sticky.

### B — Sidebar ocultable

**Clave de preferencia:** `tc_sidebar_collapsed` en `localStorage` del navegador del usuario. Valor `'1'` = colapsado. **No va dentro de `data`** y no forma parte del Respaldo.

**Clase CSS:** `html.sidebar-collapsed` (en el elemento `<html>`). Se aplica en el script inline del `<head>` de `index.html` antes del primer pintado (mismo patrón que `loader-dark`), evitando el parpadeo al recargar.

**Botones:**
- `#sidebar-toggle-btn` (`.sidebar-toggle-btn`): botón `«` dentro del `.logo` del sidebar; siempre visible cuando el menú está abierto.
- `#sidebar-show-btn` (`.sidebar-show-btn`): botón `☰` fijo en `top:14px; left:14px; z-index:11`; oculto por defecto, visible solo cuando `html.sidebar-collapsed` (escritorio).

**CSS colapsado** (solo `@media (min-width: 781px)`):
- `.sidebar { transform: translateX(-100%); }` — desliza fuera de pantalla.
- `.main { margin-left: 0; }` — ocupa todo el ancho.
- Transiciones: `transform 0.25s` en `.sidebar` y `margin-left 0.25s` en `.main`.
- `prefers-reduced-motion`: anula las transiciones.

**Móvil (≤ 780px):** los botones de escritorio (`sidebar-toggle-btn`, `sidebar-show-btn`) se ocultan. El sistema existente de hamburguesa + `sidebar-active` no se toca.

**Accesibilidad:** `aria-expanded` en `#sidebar-toggle-btn` se actualiza en `toggleSidebar()` y se inicializa en `applyAcademiaBranding()`. Ambos botones tienen `title` y `aria-label` en español. Alcanzables con Tab; `focus-visible` definido.

---

## Cambios — 2026-10-06 (Fase 2: sincronización con Firebase + base de datos portable)

Implementación de `INSTRUCCION_sincronizacion_firebase_y_base_de_datos.md`, Fase 2, sobre el plan aprobado en `PLAN_sincronizacion_firebase.md`, con los ajustes que el dueño del proyecto indicó al aprobar (ver ese mensaje de aprobación): códigos de acceso sin alargar, vínculo de nube por correo/contraseña real en vez de contraseña derivada del código, polling (sin listener en tiempo real), capa abstracta estricta, preservación de orden, borrados con línea base + tombstones, modo "solo local" si el SDK no carga, y `codigo_hash` con bcrypt/argon2 en el esquema SQL.

**Archivos nuevos en `Organizador_moodle/` (se publican):**
- `sync-core.js` — lógica pura de sincronización (diff, fusión, tombstones), sin DOM ni `firebase.*`. La usan `sync.js`/`sync-firebase.js` y también los scripts de prueba en `database/scripts/` vía `require()`.
- `sync.js` — define `window.Sync`, la única interfaz que usa `script.js` para hablar de "la nube" (`autenticar`, `cargar`, `encolar`, `sincronizarAhora`, `estado`, y los eventos de UI). Nunca llama a `firebase.*`.
- `sync-firebase.js` — el ÚNICO archivo que llama a `firebase.*`. Si el SDK no cargó o `firebase-config.js` no tiene credenciales reales, no registra ningún adaptador y `window.Sync` queda en modo "solo local" sin lanzar errores (ver §9a).
- `firebase-config.js` — configuración pública del proyecto Firebase, con marcadores a rellenar (no son secretos; ver §8.4).
- `lib/firebase-app-compat.min.js`, `lib/firebase-auth-compat.min.js`, `lib/firebase-firestore-compat.min.js` — SDK compat v10 vendorizado (sin CDN en producción).

**Archivos nuevos fuera de `Organizador_moodle/` (NO se publican):**
- `firestore.rules` — reglas de Firestore, denegar por defecto.
- `database/schema.sql`, `database/README.md`, `database/MIGRACION_A_SERVIDOR_PROPIO.md`, `database/scripts/*.js`, `database/scripts/ejemplo_ficticio.json` — base de datos portable estilo Moodle (Parte B). Ver §9b.
- `.gitignore` (raíz) — excluye respaldos reales, CSV de estudiantes, `.db`/`.sql` con datos reales y claves de servicio.

**Archivos modificados:**
- `script.js` (`?v=6`): `saveData()` ahora llama a `Sync.encolar()` al final (si `window.Sync` existe); reescritura completa de `exportBackup()`/`importBackup()` (Parte C: metadatos, sin pretty-print, respaldo automático antes de reemplazar, resumen, confirmación extra si la nube está vinculada); nuevas funciones de UI de sincronización (`renderRespaldoView`, `renderSyncStatus`, `abrirConectarNube`, `confirmarConectarNube`, `desconectarNube`, `sincronizarAhoraClick`, etc.); dos puentes globales (`window.__syncAplicarDataRemota`, `window.__syncRespaldoSilencioso`) para que `sync.js` pueda pedirle a `script.js` que aplique datos fusionados o descargue un respaldo silencioso, sin que `sync.js` toque el DOM de la app.
- `index.html` (`styles.css?v=4`, `script.js?v=6`): nuevo orden de carga de `<script>` (ver §2); indicador de estado en el pie del sidebar; tres modales nuevos (`modal-conectar-nube`, `modal-primera-subida`, `modal-conflicto-nube`); tarjeta "☁ Sincronización en la nube" y tarjeta de aviso de cuota en la vista Respaldo.
- `styles.css` (`?v=4`): estilos de `.sync-status-bar` (icono + texto, colores por estado, animación de "sincronizando" respetando `prefers-reduced-motion`).
- `firebase.json`: se agregó el bloque `"firestore": { "rules": "firestore.rules" }`; `"hosting"` no se tocó.

**Lo que NO cambió a propósito:** `login.html` (el vínculo con la nube es un paso separado, dentro de la app, no en el login — ver §3.7); `academias.js` (los códigos `2026`/`1010`/`ruben` siguen igual); `.firebaserc`; el esquema de `data` en `localStorage` (los metadatos de sincronización viven en claves de `localStorage` aparte, nunca dentro de `data` ni del respaldo — ver §4.4).

---

## 1. Resumen ejecutivo

**Qué es:** app web estática (HTML+CSS+JS puro, sin build ni backend) para que TecnoCleveland (robótica) y Cleveland English Institute (inglés) controlen qué curso modelo de Moodle han copiado a cada colegio, en qué año/grado, cuántas clases tiene subidas, generen usuarios Moodle en bloque y generen carnets de acceso imprimibles.

**Para quién:** dos academias independientes que comparten el mismo código fuente pero nunca ven los datos de la otra. El acceso es por código (no hay usuarios/contraseñas de verdad).

**Cómo se despliega:** Firebase Hosting, proyecto `moodle-organizador` (`.firebaserc`), publicando únicamente la carpeta `Organizador_moodle/` (`firebase.json`). El despliegue es manual (`firebase deploy --only hosting`); este documento no lo ejecuta.

**Dónde viven los datos:** principalmente en el `localStorage` del navegador de cada usuario, en una clave distinta por academia (`tc_organizador_data` / `cc_organizador_data`). **Desde la Fase 2, esos mismos datos se pueden sincronizar además con Firestore** si el dispositivo se vincula una vez con una cuenta de nube (ver §3.7) — pero `localStorage` sigue siendo la fuente inmediata: la app abre y guarda local primero, siempre, con o sin nube. La otra forma de mover datos entre equipos (y la única si nunca se usa la nube) es el archivo de Respaldo (.json) exportado/importado manualmente.

**Las reglas que nunca se deben romper:**
1. `tc_organizador_data` es la clave real de TecnoCleveland en producción — **nunca** cambiarla ni renombrarla.
2. Cualquier cambio al esquema de `data` debe seguir cargando respaldos y `localStorage` antiguos sin `carnetListas`/`carnetOpciones`/`participantes`/`trash.estudiantes`/`trash.carnetListas` (ver §4.2, patrón `parsed.x || valorPorDefecto`).
3. Las dos academias deben quedar siempre con datos y catálogos separados: nada de `script.js`, `carnets.js`, `carnets-pdf.js`, `sync.js`, `sync-firebase.js`, `firestore.rules` ni el esquema SQL debe filtrar datos entre `tecno` y `cleveland`. En la nube esa separación la garantizan las reglas de Firestore (`firestore.rules` + `auth_map`), no solo el código del cliente.
4. `carnets-pdf.js` y `stickers/js/stickers.js` son hoy dos copias del mismo motor de PDF (ver §11.1): un cambio de diseño/colores en uno no se refleja en el otro a menos que se edite a mano.
5. Nada de código genera `git push`, `firebase deploy` ni `firebase deploy --only firestore:rules` automáticamente; esos pasos los ejecuta la persona dueña del repo.
6. Nada de `script.js`, `carnets.js` ni `login.html` llama a `firebase.*` directamente — solo hablan con `window.Sync` (`sync.js`). El único archivo que toca `firebase.*` es `sync-firebase.js` (ver §3.7 y §9a). Esto es lo que permite mudarse a un servidor propio reemplazando un solo archivo.
7. Nunca se sube a git un respaldo `.json` real, un CSV con datos de estudiantes, una clave de cuenta de servicio de Firebase, ni una base `.db`/`.sql` con datos reales — el `.gitignore` de la raíz ya los excluye; no lo debilites.

---

## 2. Mapa del código

Carpeta publicada en producción: `Organizador_moodle/`. Todo lo que está fuera de esa carpeta (`stickers/`, `Organizador/`, `intruccion2.md`, `documentacion_organizador_moodle.md`, este mismo documento) **no se sube a Firebase** porque `firebase.json` declara `"public": "Organizador_moodle"` (no es por la lista `ignore`, es porque Firebase solo mira dentro de esa carpeta).

| Archivo | Líneas (aprox.) | Propósito | Globales / funciones clave que expone | Depende de |
|---|---|---|---|---|
| `academias.js` | 36 | Config multi-academia. Debe cargar **primero**. | `ACADEMIAS`, `getAcademiaActual()`, `ACADEMIA_ACTUAL` | `sessionStorage.tcAcademia` |
| `login.html` | 186 | Pantalla de login, independiente (su propio `<style>`/`<script>` inline). Sin cambios en la Fase 2: el vínculo con la nube se hace dentro de la app, no aquí. | `USERS`, `doLogin()`, `toggleEye()` | nada (standalone) |
| `sync-core.js` | 314 | Lógica pura de sincronización (diff, fusión, tombstones). Sin DOM ni `firebase.*`. También la usan los scripts de `database/scripts/` vía `require()`. | `window.SyncCore` (y `module.exports` en Node) | nada |
| `sync.js` | 338 | `window.Sync`: interfaz genérica que usa `script.js` para hablar de la nube (autenticar, cargar, encolar, sincronizar, estado, eventos de UI). Modo "solo local" si nadie se registra como adaptador. | `window.Sync` | `academias.js`, `sync-core.js` |
| `sync-firebase.js` | 144 | Adaptador de Firebase. **Único archivo que llama a `firebase.*`.** Si el SDK no cargó, no hace nada (ver §9a). | se registra en `window.Sync._registrarAdaptador(...)` | SDK de Firebase (`lib/firebase-*-compat.min.js`), `firebase-config.js`, `sync.js` |
| `firebase-config.js` | 44 | Configuración pública del proyecto Firebase (marcadores a rellenar). | `firebase.initializeApp(...)` | SDK de Firebase |
| `index.html` | 977 | Shell de la app: sidebar (con el indicador de sincronización), las 8 vistas, 8 modales (incluidos los 3 de sincronización), carga de scripts. | — (solo markup + loader inline) | todos los `.js`/`.css` siguientes |
| `script.js` | 2373 | Núcleo del organizador: datos, navegación, Colegios, Cursos modelo, Asignaciones, Generador de usuarios, Buscar, Respaldo (ahora con sincronización), Papelera. | `data`, `loadData/saveData`, `showView`, `esc/uid/normalize/slugify`, `renderRespaldoView/renderSyncStatus`, `ACADEMIA_ACTUAL` (de academias.js) | `academias.js`, `window.Sync` (opcional) |
| `carnets-pdf.js` | 179 | Motor de dibujo del carnet en PDF (jsPDF). IIFE aislado. | `window.CarnetsPDF = {buildPDF, gradeLabel, academias, levels, layouts}` | `lib/jspdf.umd.min.js` |
| `carnets.js` | 702 | Vista "Generador de carnets" (los 2 modos + opciones de impresión). IIFE aislado. | `window.Carnets = {init, render, closePreview}` | `script.js` (datos y utilidades globales), `carnets-pdf.js`, `lib/jszip.min.js` |
| `carnets.css` | 197 | Estilos de `#view-carnets`, todo con prefijo `.cn-`. | — | `styles.css` (variables) |
| `styles.css` | 638 | Estilos de toda la app + modo oscuro + variables por academia. Incluye clases `.acc-*` (acordeón), `.pg-*` (paginación) y `.sync-status-bar` (indicador de nube). | — | — |
| `lib/jspdf.umd.min.js` | 394 | jsPDF 2.5.2, vendored (sin CDN). | `window.jspdf` | — |
| `lib/jszip.min.js` | 9 | JSZip 3.10.1, vendored. | `window.JSZip` | — |
| `lib/xlsx.full.min.js` | 24 | SheetJS (xlsx), vendored. | `window.XLSX` | — |
| `lib/firebase-app-compat.min.js` | 1 (minificado) | SDK Firebase App compat v10.14.1, vendorizado desde `gstatic.com` (no CDN en producción). | `window.firebase` | — |
| `lib/firebase-auth-compat.min.js` | 1 (minificado) | SDK Firebase Auth compat v10.14.1, vendorizado. | `firebase.auth()` | `lib/firebase-app-compat.min.js` |
| `lib/firebase-firestore-compat.min.js` | 1 (minificado) | SDK Firebase Firestore compat v10.14.1, vendorizado. | `firebase.firestore()` | `lib/firebase-app-compat.min.js` |
| `LEEME.txt` | 118 | Manual de usuario final (no técnico). Algo desactualizado: no menciona Generador de usuarios, paginación, papelera ampliada ni la nube. | — | — |

**Orden de carga en `index.html`** (obligatorio, no se puede reordenar):
```
academias.js?v=2  →  sync-core.js?v=1  →  sync.js?v=1
  →  lib/firebase-app-compat.min.js  →  lib/firebase-auth-compat.min.js  →  lib/firebase-firestore-compat.min.js
  →  firebase-config.js?v=1  →  sync-firebase.js?v=1
  →  lib/xlsx.full.min.js  →  lib/jspdf.umd.min.js  →  lib/jszip.min.js
  →  script.js?v=6  →  carnets-pdf.js?v=1  →  carnets.js?v=2
```
`script.js` lee `ACADEMIA_ACTUAL` al vuelo (`const STORAGE_KEY = ACADEMIA_ACTUAL.storageKey;`), por eso `academias.js` tiene que ir antes que todo. `sync.js` también lee `ACADEMIA_ACTUAL` (para `STORAGE_KEY`/`ACADEMIA_ID`) y `SyncCore` (de `sync-core.js`), por eso va justo después. Los tres `<script>` del SDK de Firebase llevan `onerror` inline que solo deja un `console.info` — si no cargan (sin internet, bloqueados), el resto de la carga continúa sin lanzar errores. `firebase-config.js` y `sync-firebase.js` comprueban `typeof firebase !== 'undefined'` antes de usarlo; si no está, no registran ningún adaptador y `window.Sync` queda en modo solo local (ver §9a). `carnets.js` usa funciones globales de `script.js` (`data`, `saveData`, `esc`, `uid`, `showToast`, `extractAnioNum`, `slugify`, `normalize`, `showView`, `todayStr`, `renderTrash`, `updateTrashBadge`) y el objeto `window.CarnetsPDF`, por eso va al final.

**Cache-busting (estado actual):** `script.js?v=7`, `academias.js?v=2`, `styles.css?v=5`, `carnets.js?v=2`, `carnets-pdf.js?v=1`, `carnets.css?v=1`, `sync-core.js?v=1`, `sync.js?v=1`, `firebase-config.js?v=1`, `sync-firebase.js?v=1`. Los archivos de `lib/` y `login.html` siguen sin parámetro de versión — inconsistencia conocida (ver §11.3), ahora con tres archivos más en esa misma situación (los tres SDK de Firebase).

**`Organizador/` (fuera de alcance, no tocado):** proyecto distinto y anterior. Usa su propio login, su propio `script.js`, y un `firebase-config.js` (ese proyecto sí usa o usó Firebase real). No comparte nada de código con `Organizador_moodle/`.

**`stickers/` (generador de carnets independiente original):** ver §11.1 — es el predecesor del Modo 1 del Generador de carnets. Sigue existiendo intacto, completamente desconectado del organizador.

---

## 3. Acceso y multi-academia

### 3.1 Login (`login.html`)
```js
const USERS = {
  '2026':  { nombre: 'Administrador',  academia: 'tecno' },
  '1010':  { nombre: 'Asistente',      academia: 'tecno' },
  'ruben': { nombre: 'Ruben Mogollon',  academia: 'cleveland' }
};
```
- `doLogin()` normaliza el código tecleado con `.trim().toLowerCase()` y lo compara contra las claves de `USERS` también en minúsculas → **no distingue mayúsculas ni espacios sobrantes**.
- Si coincide, guarda en `sessionStorage`: `tcUser` (el `nombre`) y `tcAcademia` (`'tecno'` o `'cleveland'`), y redirige a `index.html`.
- Si no coincide, muestra "Código incorrecto. Intenta de nuevo." y selecciona el input.
- Si ya hay `tcUser` en sessionStorage al cargar `login.html`, redirige directo a `index.html` (solo verifica `tcUser`, no `tcAcademia`; el guardia de `index.html` en §3.2 cubre el caso en que falte `tcAcademia`).

### 3.2 Guardia de sesión en `index.html`
Script inline antes de pintar el `<body>`:
```js
if (!sessionStorage.getItem('tcUser') || !sessionStorage.getItem('tcAcademia')) {
  sessionStorage.removeItem('tcUser');
  sessionStorage.removeItem('tcAcademia');
  window.location.replace('login.html');
} else {
  document.documentElement.classList.add('auth-ok'); // revela el <body>
  ...
}
```
Si falta cualquiera de las dos claves, limpia ambas y manda a login. `logout()` (en `script.js`) también borra ambas claves.

**No existe forma de cambiar de academia sin cerrar sesión**: `ACADEMIA_ACTUAL` se calcula una sola vez al cargar `academias.js` (`const ACADEMIA_ACTUAL = getAcademiaActual();`), leyendo `sessionStorage.tcAcademia` en ese instante.

### 3.3 Configuración por academia (`academias.js`)
```js
const ACADEMIAS = {
  tecno: {
    id: 'tecno', nombre: 'TecnoCleveland', subtitulo: 'Academia de Robótica',
    storageKey: 'tc_organizador_data',
    emailDominio: 'tecno.com', importarCSV: true,
    idiomaCarnet: 'es', idiomaUI: 'es'
  },
  cleveland: {
    id: 'cleveland', nombre: 'Cleveland English Institute', subtitulo: 'English Program',
    storageKey: 'cc_organizador_data',
    emailDominio: 'cleve.com', importarCSV: false,
    idiomaCarnet: 'en', idiomaUI: 'es'
  }
};
function getAcademiaActual() {
  const id = sessionStorage.getItem('tcAcademia');
  return ACADEMIAS[id] || ACADEMIAS.tecno; // tecno es el fallback si falta/no existe el id
}
```

**Dónde se consume `ACADEMIA_ACTUAL` / `ACADEMIAS`:**
| Campo | Dónde se usa |
|---|---|
| `storageKey` | `script.js`: `const STORAGE_KEY = ACADEMIA_ACTUAL.storageKey;` — única fuente de la clave de `localStorage` |
| `emailDominio` | `script.js`: `generarListaUsuarios()`, `importarCSVArchivo()` (solo cuando `importarCSVConservarDatos` es `false`), `onGenUsernameEdit()`, `confirmarEliminarEstudiante()`, `restoreEstudiante()` — para armar `email` |
| `importarCSV` | `script.js`: `applyAcademiaBranding()` muestra/oculta `#gen-import-btn` (ambas academias: `true`) |
| `importarCSVConservarDatos` | `script.js`: `importarCSVArchivo()` — `true` → carga fiel (email del CSV, nombres literales); `false` → recalcula email con `emailDominio` |
| `idiomaUI` | `carnets.js`: `L()` elige el diccionario `T.es`/`T.en`; `window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, ...)` |
| `idiomaCarnet` | `carnets.js`/`carnets-pdf.js`: idioma impreso en el PDF |
| `id` | `script.js`: `applyAcademiaBranding()`, `document.body.setAttribute('data-academia', ...)`; `carnets-pdf.js`: `CN_ACADEMIAS[opts.academiaId]` |
| `nombre`, `subtitulo` | `script.js`: textos del sidebar, `document.title`, tira de bienvenida del Panel |

### 3.4 Catálogo base por academia
`DEFAULT_COLEGIOS` (28 nombres) y `DEFAULT_CURSOS` (17: 7 de media, 10 de primaria) están **hardcodeados en `script.js`**, no en `academias.js`. `freshData()` decide si los usa con una comparación literal:
```js
const esTecno = ACADEMIA_ACTUAL.id === 'tecno';
colegios: esTecno ? DEFAULT_COLEGIOS.map(...) : [],
cursos:   esTecno ? DEFAULT_CURSOS.map(...)   : [],
```
**Solo Tecno arranca con catálogo precargado; Cleveland arranca siempre con `colegios: []` y `cursos: []`.** Agregar una tercera academia con catálogo propio exige tocar `script.js`, no solo `academias.js`.

`resetCatalogs()` ("Restablecer colegios y cursos modelo" en Respaldo):
1. Mueve todos los colegios y cursos actuales a `data.trash.colegios` / `data.trash.cursos` (así se pueden restaurar si fue un error).
2. Reemplaza `data.colegios` / `data.cursos` con `freshData().colegios` / `.cursos`.
3. **No toca** `asignaciones`, `participantes`, `carnetListas` ni el resto de `trash`.

El texto del botón en pantalla cambia según `esTecno` (ver `applyAcademiaBranding()`), pero el comportamiento es el mismo para ambas academias.

### 3.5 Respaldo (export/import JSON) — formato ampliado en la Fase 2
- **Exportar** (`exportBackup()`, vía `construirPayloadRespaldo()`): `{ ...data, _academia, _versionEsquema: 1, _exportadoEn: new Date().toISOString(), _exportadoPor: sessionStorage.tcUser, _resumen: {colegios, cursos, asignaciones, participantes, carnetListas, itemsEnPapelera} }` → descarga `respaldo_<academiaId>_<YYYY-MM-DD>.json`, **sin pretty-print** (`JSON.stringify(payload)`, no `(..., null, 2)` — archivos más chicos). El spread de `data` ya incluía la papelera completa desde antes de la Fase 2; lo nuevo son solo los campos `_*`. Actualiza `tc_last_backup_<academiaId>` (preferencia de UI, fuera de `data`) y vuelve a pintar la vista Respaldo.
- **Importar** (`importBackup(event)`):
  1. Valida que `parsed.colegios` y `parsed.cursos` sean arrays (si no, rechaza con "Formato no válido") — igual que antes; sigue tolerando respaldos antiguos sin `_versionEsquema` ni el resto de los metadatos `_*`.
  2. Si `parsed._academia` existe y **no coincide** con `ACADEMIA_ACTUAL.id`, pide confirmación explícita.
  3. Pide una segunda confirmación genérica ("esto reemplazará todos los datos actuales…").
  4. **Nueva en la Fase 2:** si la nube está vinculada, pide una tercera confirmación ("esto también reemplazará los datos guardados en la nube…") antes de continuar.
  5. **Nueva en la Fase 2:** si `data` actual no está vacío (`estaDataVacia()`), descarga automáticamente `respaldo_<academiaId>_<fecha>_previo-a-importar.json` antes de reemplazar — red de seguridad silenciosa.
  6. Reconstruye `data` con el mismo patrón de *defaults* que `loadData()` (ver §4.2).
  7. **Nueva en la Fase 2:** muestra un toast-resumen con los conteos de lo importado (`resumenDe(data)`), en vez de un simple "✓".
- No hay validación estructural más allá de que `colegios`/`cursos` sean arrays — sigue siendo así tras la Fase 2; no se agregó validación de esquema más estricta.

### 3.6 Marca visual dinámica y preferencias de UI
- `document.body.setAttribute('data-academia', ACADEMIA_ACTUAL.id)` (en `applyAcademiaBranding()`).
- `styles.css` sobrescribe variables de acento solo para `cleveland`:
  ```css
  body[data-academia="cleveland"]       { --accent:#1280B3; --accent-light:#E3F3FA; --accent2:#7EBD3E; --accent2-light:#EDF6E3; }
  body.dark[data-academia="cleveland"]  { --accent:#25A5DE; --accent-light:#15283A; --accent2:#7EBD3E; --accent2-light:#1C2A14; }
  ```
  Para `tecno` no hay bloque `[data-academia="tecno"]`: usa los valores base de `:root`/`body.dark` (azul `#1E5FBF`/`#4C8DFF`, naranja `#E8912B`/`#F0A94E`).
- Elementos que cambian por academia (todos en `applyAcademiaBranding()`): logo del sidebar (🤖 vs 🪪), nombre partido con `<span class="logo-accent">`, subtítulo, pie del sidebar, frase + emojis de bienvenida, texto bajo el stat de Colegios, visibilidad de "Importar CSV", texto de "Restablecer catálogo base".

**Preferencias de UI del navegador (fuera de `data`):**
| Clave localStorage | Valor | Aplicación |
|---|---|---|
| `tc_dark` | `'1'` = oscuro | `body.dark` — aplica en `DOMContentLoaded` de `script.js` |
| `tc_sidebar_collapsed` | `'1'` = colapsado | `html.sidebar-collapsed` — aplica en script inline del `<head>` (sin flash); función `toggleSidebar()` en `script.js` |

Ambas son preferencias visuales del navegador: **no se incluyen en el Respaldo**, no tocan `data`, y no usan `tc_organizador_data` ni `cc_organizador_data`.

### 3.7 Vínculo con la nube (opcional, por dispositivo)

**El código de acceso de `login.html` NO cambió y sigue siendo el único requisito para abrir la app.** La nube es un paso **adicional y opcional**, que se hace una sola vez por dispositivo desde dentro de la app (sidebar → "☁ Conectar con la nube", o la tarjeta "☁ Sincronización en la nube" en la vista Respaldo) — nunca desde `login.html`.

**Por qué no es una contraseña derivada del código:** la Fase 1 planteó derivar la contraseña de Firebase a partir del código (`2026`, `1010`, `ruben`) más un secreto fijo en el código fuente. Se decidió explícitamente **no** usar ese camino: cualquier secreto guardado en `login.html`/`script.js` es legible por quien inspeccione el sitio publicado, así que una contraseña derivada de ahí nunca es más segura que el código mismo. En su lugar:
- El código de acceso (`2026`/`1010`/`ruben`) sigue siendo exactamente igual que antes — **no se alargó** — y sigue siendo solo local (nunca se envía a Firebase).
- Cada dispositivo que quiera sincronizar se vincula una vez con un **correo y una contraseña reales de Firebase Authentication** (no derivados de nada, los define la persona dueña del proyecto directamente en la consola de Firebase — ver §5 del plan / pasos manuales al final de este documento). Ese vínculo se guarda con persistencia local de Firebase (`firebase.auth().setPersistence(LOCAL)`), así que no hay que repetirlo en cada visita, solo si se borra el almacenamiento del navegador o se usa un dispositivo nuevo.
- Hay **tres cuentas de Firebase**, una por código: `admin@tecno.organizador` (código `2026`), `asistente@tecno.organizador` (código `1010`), `ruben@cleveland.organizador` (código `ruben`). Un documento `auth_map/{uid}` (creado solo desde la consola de Firebase, nunca desde el cliente) le dice a las reglas de Firestore a qué academia pertenece cada cuenta.

**Flujo (`sync.js` / `sync-firebase.js`):**
1. `Sync.autenticar(correo, contraseña)` llama al adaptador, que hace `signInWithEmailAndPassword` y lee `auth_map/{uid}`. Si la academia de esa cuenta no coincide con `ACADEMIA_ACTUAL.id`, se cierra la sesión inmediatamente y se rechaza — así, con el código `ruben` (academia `cleveland`) nunca se puede vincular una cuenta de `tecno`, aunque alguien conociera esa contraseña.
2. Primera vinculación de un dispositivo **cuando la nube ya tiene datos de otro dispositivo y este equipo también tiene datos propios**: no se fusiona en silencio. Se descarga un respaldo de seguridad del estado local y se muestra el modal "⚠ La nube ya tiene datos de esta academia" con tres opciones: usar los datos de la nube, subir los de este equipo, o cancelar (desvincula el dispositivo sin tocar nada). Ver `modal-conflicto-nube` en `index.html` y `resolverConflicto*` en `sync.js`.
3. Primera vinculación **cuando la nube está vacía y este equipo tiene datos**: modal "☁ Subir los datos de este equipo" (`modal-primera-subida`) con las opciones "Subir ahora" / "Más tarde".
4. En el uso normal (ninguno de los dos casos anteriores, o ya resuelto una vez): la sincronización es automática y silenciosa — ver §3.7.1.

**3.7.1 Cuándo se sincroniza (polling, sin tiempo real):**
- Al abrir la app (`Sync.cargar()`, en paralelo a que la app ya se muestra con los datos locales — nunca bloquea el arranque).
- Al volver a la pestaña (`visibilitychange`): primero se lee **solo** el `_rev` del documento raíz de la academia (1 lectura); si no cambió desde la última vez, no se descarga nada más.
- Con el botón "↺ Sincronizar ahora" (sidebar / vista Respaldo): sube lo pendiente y luego hace la misma revisión de `_rev`.
- **No hay listener en tiempo real** (`onSnapshot`): con 3 usuarios que raramente coinciden, el polling es más barato en lecturas y evita el riesgo de que un cambio remoto le pise la vista previa editable del Generador de usuarios a alguien que está escribiendo en ese momento.

**3.7.2 Qué se sincroniza y cómo (ver también §4.4):** todo `data` se reparte en varias colecciones de Firestore bajo `academias/{academiaId}/` (una por `colegios`, `cursos`, `asignaciones`, `carnetListas`, `carnetOpciones`, las listas de participantes agrupadas por colegio+curso+año+grupo, y las 6 colecciones de papelera), nunca en un único documento — un documento de Firestore tiene un límite de 1 MiB, y `data` completo puede superarlo con miles de participantes. Cada subida solo escribe los documentos que cambiaron (diff contra una línea base local), nunca todo de una vez.

**3.7.3 Indicador de estado:** pie del sidebar, botón `#sync-status-btn` (`renderSyncStatus()` en `script.js`, suscrito a `Sync.onCambioEstado()`): "Nube no disponible" (sin adaptador — SDK bloqueado o sin internet), "Conectar con la nube" (adaptador disponible, dispositivo no vinculado), "Sincronizado ✓", "Sincronizando…", "Cambios pendientes ●", "Sin conexión ✕", "Error de sincronización ⚠". Funciona en claro/oscuro con las variables CSS existentes.

**3.7.4 Si el SDK de Firebase no carga:** `window.Sync` existe igual (lo define `sync.js`, que no depende de Firebase) pero sin ningún adaptador registrado — `Sync.nubeDisponible()` devuelve `false`, el indicador muestra "Nube no disponible", y todo lo demás (login, Colegios, Generador, Carnets, Respaldo local) funciona exactamente igual que si este archivo no existiera. Nunca se lanza una excepción por esto (ver `firebase-config.js` y el inicio de `sync-firebase.js`).

---

## 4. Modelo de datos real

### 4.1 Esquema completo
Objeto global `data` (vive en memoria + se serializa a `localStorage[STORAGE_KEY]`):

```jsonc
{
  "colegios": [
    { "id": "idabc123xy", "nombre": "Alejandro Humboldt" }
  ],
  "cursos": [
    { "id": "idc8f2k0qz", "nombre": "Robotica 1", "nivel": "media" }
  ],
  "asignaciones": [
    {
      "id": "ida91b2cde", "colegioId": "idabc123xy", "cursoId": "idc8f2k0qz",
      "anio": "1er Año", "fecha": "2026-02-10",
      "nombreCompleto": "1er Año-AH", "nombreCorto": "1styear-ah",
      "clases": 8, "notas": ""
    }
  ],
  "participantes": [
    {
      "id": "idpq7r8stu", "colegioId": "idabc123xy", "cursoId": "idc8f2k0qz",
      "anio": "1er Año", "nivel": "media",
      "username": "ah0001", "password": "1234",
      "nombres": "JOSE ALEJANDRO", "apellidos": "MONTILLA VALERO",
      "email": "ah0001@tecno.com", "city": "Acarigua", "country": "Venezuela",
      "course1": "1styear-ah", "group1": "", "role1": "student",
      "enrolperiod1": "365d", "suspended": "0", "fecha": "2026-02-10"
      // opcional: "agregadoEn": "2026-10-08T10:30:00.000Z"  — solo en participantes añadidos con modo agregar
    }
  ],
  "carnetListas": [
    {
      "id": "idwx12yz34", "nivel": "media", "grado": 4, "seccion": "A", "clave": "1234",
      "estudiantes": [
        { "usuario": "sje227", "apellidos": "ANGEL LEAL", "nombres": "ARIADNA SOFÍA" }
      ]
    }
  ],
  "carnetOpciones": { "layout": "big", "url": "cursoscleveland.com", "upper": true },
  "trash": {
    "colegios": [ /* objetos de colegio completos */ ],
    "cursos":   [ /* objetos de curso modelo completos */ ],
    "asignaciones": [ /* objetos de asignación completos */ ],
    "participantes": [
      {
        "id": "idtr1a2sh3", "colegioId": "idabc123xy", "cursoId": "idc8f2k0qz",
        "anio": "1er Año", "grupo": "", "fechaEliminacion": "2026-10-01",
        "estudiantes": [ /* array de participantes de esa lista */ ]
      }
    ],
    "estudiantes": [
      {
        "id": "idxxxxxxxx", "fechaEliminacion": "2026-10-04",
        "participante": { /* objeto participante completo, tal cual estaba */ }
      }
    ],
    "carnetListas": [
      { "id": "idwx12yz34", "nivel": "media", "grado": 4, "seccion": "A", "clave": "1234",
        "estudiantes": [ /* ... */ ], "fechaEliminacion": "2026-10-04" }
    ]
  }
}
```

**Notas clave del esquema:**
- `asignaciones.clases` y `carnetListas.grado` se guardan como **número** (`Number(...)`), no string.
- `trash.participantes` son lotes completos (una entrada por año+grupo), no estudiantes sueltos. Restaurar (`restoreGenLista`) hace `data.participantes.push(...item.estudiantes)`.
- `trash.estudiantes` son estudiantes individuales eliminados desde la vista Ver/Editar del Generador. Cada entrada envuelve el objeto `participante` completo con `id` y `fechaEliminacion` propios de la entrada de papelera.
- `trash.carnetListas` son listas del Generador de carnets Modo 1 eliminadas o pisadas por sobrescritura. Contienen el objeto lista completo más `fechaEliminacion`.
- `carnetListas[].estudiantes[].usuario/apellidos/nombres` — sin `clave` individual; la clave es una sola por lista (`carnetListas[].clave`). El Modo 2 (participantes) sí tiene clave por estudiante (`participantes[].password`).

### 4.2 Carga, migración y compatibilidad hacia atrás
`loadData()` e `importBackup()` (`script.js`) usan el mismo patrón de *defaults*:

```js
data = {
  colegios: parsed.colegios || [],
  cursos: parsed.cursos || [],
  asignaciones: parsed.asignaciones || [],
  participantes: parsed.participantes || [],
  carnetListas: parsed.carnetListas || [],
  carnetOpciones: { ...CARNET_OPCIONES_DEFAULT, ...(parsed.carnetOpciones || {}) },
  trash: {
    colegios: trash.colegios || [],
    cursos: trash.cursos || [],
    asignaciones: trash.asignaciones || [],
    participantes: trash.participantes || [],
    estudiantes: trash.estudiantes || [],   // nueva en 7479d08
    carnetListas: trash.carnetListas || []  // nueva en 7479d08
  }
};
```

Un `localStorage` o respaldo de cualquier versión anterior (sin `carnetListas`, sin `carnetOpciones`, sin `trash.estudiantes`, sin `trash.carnetListas`) carga sin romperse. **Importante:** `loadData()` e `importBackup()` NO están factorizados en una función compartida — si se agrega una clave nueva al esquema, hay que editar **ambas** funciones, más `freshData()`.

### 4.3 Flujo de datos
1. **Carga:** `DOMContentLoaded` → `loadData()` → `applyAcademiaBranding()` → `renderAll()` → `Carnets.init()` → (en paralelo, si `window.Sync` existe) `Sync.cargar()`.
2. **Modificación:** cada acción muta `data` en memoria y llama a `saveData()` de inmediato (sin debounce local).
3. **Guardado:** `saveData()` → `localStorage.setItem(STORAGE_KEY, JSON.stringify(data))` (con `try/catch`; si falla, toast de advertencia) → `Sync.encolar()` (si hay nube vinculada, sube el diff con un debounce de 3 s; si no, no hace nada).
4. **Respaldo:** `exportBackup()` descarga `data` actual + metadatos (`_academia`, `_versionEsquema`, `_exportadoEn`, `_exportadoPor`, `_resumen` — ver §3.5 y §C). `importBackup()` reemplaza `data` completo (con respaldo automático del estado previo si no estaba vacío, y confirmación extra si la nube está vinculada).
5. **Restauración desde Papelera:** `restore*()` saca el ítem de `data.trash.*` y lo devuelve al array activo; `permaDelete*()` lo quita definitivamente. Ambos pasan por `saveData()`, así que se sincronizan igual que cualquier otro cambio (ver §4.4).
6. **Bajada de la nube** (`revisarYBajar()` en `sync.js`): fusiona lo remoto con `data` local entidad por entidad (nunca un reemplazo total) y llama a `window.__syncAplicarDataRemota(nuevaData, {sobrescritos})`, que `script.js` implementa como `data = nuevaData; saveData(); renderAll();`.

### 4.4 Metadatos de sincronización (fuera de `data`, fuera del Respaldo)

Ningún dato de la capa de sincronización vive dentro de `data` ni se incluye en el Respaldo `.json` — serían "datos transitorios de sincronización" que la instrucción de Fase 2 pide excluir explícitamente. Viven en claves de `localStorage` aparte, con el mismo prefijo que `STORAGE_KEY` (así nunca se mezclan entre `tecno` y `cleveland`):

| Clave | Contenido | La escribe |
|---|---|---|
| `<STORAGE_KEY>__sync_baseline` | Línea base: hash + orden (+ clave natural, para listas) de cada entidad ya sincronizada. Permite calcular el diff sin releer la nube completa. | `sync.js` |
| `<STORAGE_KEY>__sync_rev` | Último `_rev` del documento raíz de la academia que este dispositivo ya descargó. | `sync.js` |
| `<STORAGE_KEY>__sync_cloud_email` | Correo con el que este dispositivo está vinculado (solo para mostrarlo en la UI — nunca la contraseña). | `sync.js` |
| `tc_last_backup_<academiaId>` | Fecha (`YYYY-MM-DD`) del último respaldo `.json` descargado, para el aviso de la vista Respaldo (§C.4). | `script.js` (`marcarUltimoRespaldo()`) |

Si se agrega una clave nueva de este tipo en el futuro, debe seguir este mismo patrón: prefijo `STORAGE_KEY + '__sync_...'`, nunca dentro de `data`, nunca copiada al Respaldo.

---

## 5. Vistas e interfaz

### 5.1 Sidebar (orden real en `index.html`)
Sección **Programas**: Panel (`dashboard`) · Colegios (`colegios`) · Generador de usuarios (`generador`) · Generador de carnets (`carnets`) · Cursos modelo (`cursos`) · Buscar (`buscar`).
Sección **Sistema**: Respaldo (`respaldo`) · Papelera (`trash`, con badge de conteo).
Cada botón: `<button class="nav-item" onclick="showView('id')" data-view="id">`.

`showView(id)` centraliza el cambio de vista y dispara el render específico:
```js
if (id === 'colegios')  { closeCollegeDetail(); renderColegios(); }
if (id === 'generador') renderGenerador();
if (id === 'carnets' && window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
if (id === 'cursos')    renderCursos();
if (id === 'buscar')    renderBuscar();      // ← esta línea faltaba en la v4
if (id === 'trash')     renderTrash();
if (id === 'dashboard') renderDashboard();
```
**Para agregar una vista nueva hay que tocar esta cadena.** El array `NAV_VIEWS` (línea 354 de `script.js`) está declarado pero no se usa en ningún otro punto del código y está incompleto (no incluye `'carnets'`) — es código muerto (ver §11.3).

### 5.2 Qué hace cada vista (verificado contra el código)

- **Panel (`dashboard`):** saludo con nombre de sesión, fecha de hoy, botón "+ Registrar copia de curso". 4 tarjetas de estadística (colegios activos, cursos copiados, clases subidas, promedio clases/curso). Barra comparativa Media vs Primaria. Lista de los 6 últimos cursos copiados.

- **Colegios (`colegios`):** grilla filtrable por nombre + tarjeta "+ Nuevo colegio". Click en tarjeta → **detalle del colegio**: insignias de nivel, dos tablas (Media/Primaria) de cursos copiados con editar/eliminar — cada una dentro de un **acordeón** (`col-cursos-media`/`col-cursos-primaria`) cuyo título incluye el conteo de cursos —, botón "+ Agregar año/curso", botón "✎ Editar colegio", y la tarjeta de **Participantes** (ver detalles en §6.5).

- **Generador de usuarios (`generador`):** elegir Colegio → Año/Grado (agrupado Media/Primaria por `<optgroup>`, solo años con asignación) → pegar Apellidos/Nombres → Contraseña/Ciudad/Grupo opcional → "Generar lista" (vista previa editable en **acordeón** `gen-editor`, con botón 🗑 por fila para eliminar estudiante individual) → "Guardar lista" o "⬇ Descargar CSV". Debajo: resumen "Años ya generados" en dos **acordeones** (`gen-media`/`gen-primaria`) con Ver/Editar, ⬇ CSV, 🗑 Eliminar. El botón "⬆ Importar CSV" aparece si `ACADEMIA_ACTUAL.importarCSV` es `true` (ambas academias: Tecno y Cleveland). El comportamiento al importar varía según `ACADEMIA_ACTUAL.importarCSVConservarDatos` (ver §6.2). La tabla editable (Vista previa y Ver/Editar) tiene scroll horizontal siempre visible y la columna del botón 🗑 es sticky a la derecha (ver §6.4 y sección "Cambios 2026-10-06 — A").

- **Generador de carnets (`carnets`):** ver §7.

- **Cursos modelo (`cursos`):** pestañas Media/Primaria, tabla con nombre, colegios que lo usan, promedio de clases, editar/eliminar. Botón "+ Nuevo curso modelo".

- **Buscar (`buscar`):** input con `oninput` (sugerencias en vivo) y `onkeydown` (Enter selecciona la primera coincidencia). Normaliza acentos con `normalize()`. Mejoras del 2026-10-04 (bug original corregido): sugerencias con `display:'block'` en vez de `display:''`; coincidencia exacta con un único colegio carga el resumen directo sin desplegable; `renderBuscar()` controla el mensaje de vacío según si hay colegios en la academia. Resumen del colegio elegido: insignias de nivel, años trabajados, clases subidas + tabla detalle. Botón "⬇ Exportar reporte completo (CSV)" exporta **todas** las asignaciones de todos los colegios (no solo el buscado), con `exportReportCSV()`.

- **Nombre de archivo en descargas CSV/XLSX:** la función auxiliar `nombreArchivoDescarga(anio, grupo, extension)` produce nombres como `5to año A.csv`, `1er grado.xlsx`. Reglas: año/grado en minúsculas (`toLocaleLowerCase('es')`), grupo se agrega tal cual si no está vacío, caracteres no permitidos en Windows se reemplazan por `-`. Usada por: "⬇ Descargar CSV" de la vista previa, "⬇ CSV" de "Años ya generados", "⬇ CSV" de Ver/Editar, y "⬇ Descargar XLSX" de Participantes en Colegios. El reporte completo de Buscar y los respaldos `.json` **no** usan esta función.

- **Respaldo (`respaldo`):** `renderRespaldoView()` (nueva en la Fase 2) dibuja esta vista según `Sync.estadoVinculo()`. Tarjeta "☁ Sincronización en la nube" (estado + botones "Conectar con la nube" / "Desconectar este dispositivo" / "↺ Sincronizar ahora", según corresponda). Tarjeta "⬇ Exportar respaldo" con el texto actualizado ("descarga **toda** la información… incluida la papelera") y la línea "Último respaldo descargado: [fecha]" (aviso naranja si pasaron más de 7 días o nunca se descargó). Tarjeta "⬆ Importar respaldo" (ahora con respaldo automático del estado previo y confirmación extra si la nube está activa). Tarjeta "📦 Espacio usado" (solo visible si `data` supera ~4 MB serializado). Y "Restablecer colegios y cursos modelo" (ver §3.4 — sigue enviando a Papelera antes de reemplazar; sin cambios de comportamiento en la Fase 2, pero ahora se sincroniza igual que cualquier otro cambio vía `saveData()` → `Sync.encolar()`).

- **Papelera (`trash`):** 6 secciones con Restaurar / Eliminar para siempre: colegios, cursos copiados (asignaciones), listas de participantes del Generador, **estudiantes eliminados individualmente**, **listas de carnets eliminadas**, y cursos modelo. Botón global "Vaciar papelera" y el badge del sidebar cubren las 6 secciones (`trashTotal()` suma los 6 arrays).

---

## 6. Generador de usuarios — reglas de negocio verificadas

### 6.1 Numeración de usuarios ("Generar lista")
En `generarListaUsuarios()` (`script.js`):
1. El **prefijo** sale del `nombreCorto` de la asignación: todo lo que va **después del último `-`** (p. ej. `1styear-ah` → `ah`). Si no hay `-` o termina en `-`, se rechaza.
2. **Dígitos:** `nivel === 'primaria' ? 3 : 4`.
3. **Pool:** se recorre `data.participantes` filtrando por `colegioId` igual **y** por nivel igual; se toma el máximo número visto para el mismo prefijo. El siguiente usuario empieza en `maxNum + 1`.
4. `email = \`${username}@${ACADEMIA_ACTUAL.emailDominio}\``.
5. `firstname = "<username> <nombres>"`, `lastname = apellidos` (convención de Moodle bulk-upload).
6. País fijo `"Venezuela"`; `role1: 'student'`; `enrolperiod1: '365d'`; `suspended: '0'`.
7. Al editar el username en vista previa (`onGenUsernameEdit`), se recalculan `firstname` y `email`, pero **no** se revalida contra el pool (se puede crear una colisión manual).

### 6.2 Importar CSV (`importarCSVArchivo`, solo si `importarCSV: true`)
- Espera columnas `First name`, `Last name` (obligatorias) y opcionalmente `Email address`, `Groups`.
- El `username` se toma como la primera palabra de `First name` (separada por el primer espacio). Si no matchea `^[a-zA-Z]+\d+$`, intenta usar la parte antes del `@` del email como fallback.
- **El CSV importado NO pasa por el pool de numeración** — el username queda como viene.
- El grupo (`group1`) sale de la columna `Groups` tal cual, sin procesar.
- El BOM UTF-8 (`﻿`) se elimina antes de parsear, por lo que el encabezado `First name` se reconoce correctamente.

**Comportamiento según `importarCSVConservarDatos`:**

| Flag | Academia | `email` | `nombres` (resto de `First name`) |
|---|---|---|---|
| `false` | Tecno | recalculado: `${username}@${emailDominio}` | `.trim()` aplicado |
| `true` | Cleveland | tomado literalmente del CSV (correos externos válidos) | literal sin `.trim()` — tabulaciones internas preservadas |

**Filas de docentes en el CSV de Cleveland:** es normal que el CSV incluya filas de docentes (`First name` sin usuario, correo externo). Se importan igual que las de estudiantes: no se omiten, no se marcan y no bloquean el import. El fallback `username = parte antes del @` aplica para esas filas (ej. `moisesleal92`). La persona encargada las elimina después con el botón 🗑 de Ver/Editar (modal `#modal-eliminar-estudiante`). Al usar "Reestructurar" sobre un docente, `calcularReestructura` devuelve `posible: false` porque no hay usuarios posteriores con el mismo prefijo; "Reestructurar" queda deshabilitado y los estudiantes `sje…` no se tocan.

### 6.3 Guardado de listas (`guardarListaUsuarios`)
Si ya existe una lista para el mismo `colegioId + cursoId + anio + group1`:
1. Pide confirmación.
2. **Empaqueta la versión existente en `trash.participantes`** (mismo formato que `eliminarGenLista()`, con `id`, `fechaEliminacion` y el array `estudiantes` dentro) antes de filtrarla.
3. Quita las filas del conflicto de `data.participantes` y agrega las nuevas.
4. Marca `genPreviewSaved = true`.
5. Re-renderiza "Años ya generados", Papelera y (si aplica) Participantes del colegio actual.

### 6.4 Eliminar un estudiante individual y "Reestructurar"
En la vista editable (Ver/Editar) de una lista, cada fila tiene un botón 🗑 que abre el modal `#modal-eliminar-estudiante` con dos opciones:

- **Conservar:** quita solo esa fila; los demás usernames no cambian.
- **Reestructurar:** además de quitar la fila, renumera consecutivamente a los participantes **posteriores** de la misma lista y mismo prefijo, empezando por el número del eliminado. Implementado como función pura `calcularReestructura(lista, eliminadoUsername, digits, usernamesOcupados)`:
  - `lista`: todos los participantes de ese colegio+curso+año+grupo, incluido el eliminado.
  - `usernamesOcupados`: usernames de **otras** listas/grupos del mismo colegio+prefijo (el llamador excluye toda la lista actual, porque sus números están a punto de desplazarse).
  - Devuelve `{ posible, motivo?, cambios:[{usernameAnterior, usernameNuevo}] }`.
  - Se deshabilita si el username del eliminado no tiene formato `letras+números`, o si no hay nadie posterior en la lista.

**Comportamiento según el estado de la lista:**
- **Lista ya guardada** (`genPreviewSaved === true`, fijado por `verEditarGenYear` o `guardarListaUsuarios`): el estudiante se quita de `data.participantes`, va a `trash.estudiantes`, y los renombres se aplican tanto en `data.participantes` como en `genPreviewRows`.
- **Lista recién generada** (`genPreviewSaved === false`): todo ocurre solo en `genPreviewRows` (nunca existió en `data`, por eso no pasa por Papelera).
- Si se elimina el último estudiante de una lista guardada, la lista desaparece de "Años ya generados" y el editor se cierra.

### 6.5 Modo agregar estudiantes a una lista existente

Al pulsar **Ver/Editar** en "Años ya generados", el Generador entra en **modo agregar** (estado `genModoAgregar = true`):

1. Los selectores de colegio, año y grupo quedan deshabilitados (`disabled`); los campos de información (curso modelo, nombre corto, nivel) siguen siendo solo lectura.
2. Los cuadros de Apellidos y Nombres se rellenan con los estudiantes de la lista, en el mismo orden en que están guardados (ordenados por `username`).
3. La contraseña y la ciudad se rellenan desde el primer estudiante existente y siguen siendo editables (aplican solo a los nuevos).
4. Se muestra el banner `#gen-modo-agregar-banner` con el conteo y el botón "Salir del modo agregar" (llama a `salirModoAgregar()`).
5. El contador en vivo `#gen-modo-contador` muestra "N existentes · M nuevos" y se actualiza con `oninput` de los cuadros.

**Al pulsar "Generar lista" en modo agregar** (`_generarListaEnModoAgregar(prefix)`):
- Se compara cada par (apellido, nombre) del formulario contra los existentes usando `normalize()` (sin mayúsculas ni acentos ni espacios sobrantes).
- Los pares que coinciden con un existente se omiten (`countEx`); los demás son nuevos.
- Si no hay nuevos, muestra un aviso y no hace nada.
- Los nuevos se generan con el pool de numeración idéntico al modo normal (máximo de `data.participantes` filtrando por `colegioId` + `nivel` + `prefix`; **no** cuenta la Papelera). El prefijo y el ancho de dígitos salen del `nombreCorto` de la asignación.
- `genPreviewRows` resulta: `[...existentes_snapshot, ...nuevasFilas]`. Las filas nuevas llevan `esNuevo: true`.
- La tabla de vista previa marca las filas nuevas con clase CSS `.gen-row-nuevo` y badge `.badge-nuevo` "Nuevo" en la celda del usuario.
- El título de la tabla muestra "N existentes · M nuevos".

**Al pulsar "Guardar lista" en modo agregar** (`_guardarListaEnModoAgregar()`):
- Solo las filas con `esNuevo: true` se insertan en `data.participantes`, cada una con el campo `agregadoEn: new Date().toISOString()`.
- **No** se mueve nada a la Papelera ni se crea una nueva lista.
- Se actualiza "Años ya generados" y la vista de Participantes del colegio.
- El botón "⬇ CSV solo de los nuevos" (`#gen-csv-nuevos-btn`) queda visible.

**Campo `agregadoEn`:** `string ISO 8601`, presente solo en participantes añadidos mediante el modo agregar. Al cargar una lista con Ver/Editar, los participantes con `agregadoEn` en `data.participantes` se marcan con `esNuevo: true` en `genPreviewRows`, lo que activa el badge y el botón "⬇ CSV solo de los nuevos".

**"Rango de usuarios" en "Años ya generados":** ahora usa `calcularRangos(rows)` en vez de `first – last`. Si los números son continuos, produce el mismo resultado de antes. Si son no continuos (por ejemplo lista con `ag0001–ag0014` a la que se agregaron `ag0086–ag0090`), muestra los tramos separados por comas: `ag0001–ag0014, ag0086–ag0090`.

**"⬇ CSV solo de los nuevos"** (`descargarCSVNuevos()`): exporta con el mismo formato de carga masiva de Moodle que el CSV completo, pero solo con las filas donde `esNuevo === true`. El nombre de archivo sigue la convención de `nombreArchivoDescarga()` más el sufijo `_nuevos`.

### 6.7 Participantes en el detalle de un colegio
Tarjeta de Participantes en la vista Colegios (`renderCollegeParticipantes`, `renderCollegeParticipantesTable`):
- Selector de Año/Grado con `<optgroup>` Media/Primaria (misma estructura y orden que `fillGenAnioSelect()`), solo con años que tienen participantes.
- Si hay más de un grupo en el año elegido, aparece selector de Grupo (con opción "Todos").
- Buscador en tiempo real por usuario, nombres, apellidos y **correo** (normaliza acentos).
- Título dinámico: `renderCdPartTitle()` muestra nivel + año + grupo + total de participantes filtrados.
- Tabla **paginada de 20 en 20** (`PARTICIPANTES_POR_PAGINA = 20`, estado `cdPartPage`): `renderPaginacionHTML()` con botones ‹ Anterior / páginas / Siguiente ›.
- "Mostrando X–Y de Z" bajo la paginación.
- El estado de página se resetea a 1 cada vez que cambia año, grupo o búsqueda.
- **Descarga XLSX** (`descargarXLSXParticipantesColegio`): exporta **toda** la selección de año/grupo sin paginar ni filtrar por búsqueda. Nombre de archivo generado por `nombreArchivoDescarga(anio, grupo, 'xlsx')`.
- Copiar al portapapeles por fila (formato: `"Estudiante: nombres apellidos\nUSUARIO: ...\nCLAVE: ..."`).

### 6.8 Sistema de acordeón reutilizable
(`uiAcordeones`, `accOpen`, `applyAccState`, `toggleAcordeon` — `script.js`; clases `.acc-*` — `styles.css`)

Estado abierto/cerrado en memoria (no en `data` ni `localStorage`) para no perder el estado al re-renderizar con `innerHTML`. Por defecto todos empiezan abiertos. Claves activas:
- `gen-editor` — tabla editable de la vista previa del Generador.
- `gen-media` / `gen-primaria` — acordeones de "Años ya generados".
- `col-cursos-media` / `col-cursos-primaria` — cursos copiados en el detalle de colegio.

### 6.9 Sistema de paginación reutilizable
(`paginaInfo`, `paginaBotones`, `renderPaginacionHTML` — `script.js`; clases `.pg-*` — `styles.css`)

Usado hoy solo en la tabla de Participantes de Colegios. `paginaInfo` clampa la página a rango válido y devuelve `{page, totalPages, start, end}`. `paginaBotones` produce primera, última y actual ±2 con "…" en los huecos. `renderPaginacionHTML(containerId, page, totalPages, onClickFnName)` inyecta el HTML de los botones en el elemento con `id=containerId`.

---

## 7. Generador de carnets

### 7.1 Arquitectura e inicialización
- `carnets-pdf.js` es un IIFE que solo expone `window.CarnetsPDF`. No depende de `script.js`; solo de `window.jspdf`.
- `carnets.js` es un IIFE que solo expone `window.Carnets = { init, render, closePreview }`. `window.Carnets.init()` se llama una sola vez, en `DOMContentLoaded` de `script.js`, después de `renderAll()`. `render()` se llama desde `showView('carnets')`.
- Todo el CSS de `carnets.css` está prefijado `.cn-`; todo el JS vive dentro de las dos IIFE.

### 7.2 Persistencia
- **Modo 1 (listas manuales):** se guardan en `data.carnetListas` → incluidas en el Respaldo, respetan `STORAGE_KEY` por academia.
- **Opciones de impresión** (`layout`, `url`, `upper`): `data.carnetOpciones` → también en el Respaldo.
- **Modo 2 (desde participantes):** resultados efímeros en `let pResultLists = []`, recalculados cada vez al pulsar "Generar carnets". No se guarda nada nuevo en `data`.

### 7.3 Modo 1 — Crear desde cero
- Selector de nivel (Media 1º–5º / Primaria 1º–6º) → Año/Grado → Sección opcional (guardada en mayúsculas, `toLocaleUpperCase()`) → Clave única para la lista → 3 cajas de texto pegables (Usuario/Apellidos/Nombres).
- `smartPasteManual()`: si el texto pegado contiene tabulaciones, se reparte entre las cajas a la derecha (formato de copiar desde Excel/Sheets).
- Validaciones en `saveManualList`: grado obligatorio, clave obligatoria, al menos una línea, las 3 columnas deben tener el mismo número de líneas, ninguna línea con campo vacío.
- Si ya existe una lista con el mismo `nivel+grado+seccion`, pide confirmar reemplazo. La lista existente **va a `trash.carnetListas`** antes de ser reemplazada.
- Acciones: vista previa + PDF por grado completo (`gradeJob`) o lista/sección individual (`listJob`), editar, eliminar (confirma), ZIP de todos los grados, "Eliminar todas las listas".
- **Papelera para Modo 1:** `deleteManualList()`, "Eliminar todas las listas" (una entrada por lista), y la sobrescritura en `saveManualList` — todos empaquetan la lista con `fechaEliminacion` en `trash.carnetListas` antes de quitarla de `data.carnetListas`. Restaurar desde Papelera (`restoreCarnetLista()`, en `script.js`): si ya existe una lista con el mismo `nivel+grado+sección`, pide confirmación (la actual se manda a Papelera); genera un `id` nuevo si el original ya está en uso; llama a `Carnets.render()` al terminar.

### 7.4 Modo 2 — Desde participantes de un colegio
- `computeParticipantGroups(colegioId)` agrupa por `cursoId + '|' + anio + '|' + (group1||'')`.
- **Nivel:** del curso modelo de cada grupo (`cursoMap[p.cursoId].nivel`).
- **Número de año/grado:** `extractAnioNum(anio)`. Si no hay número o excede el máximo del nivel, la lista se omite con un aviso (no aborta el proceso completo).
- **"Sección a imprimir":** `(g.grupo && g.grupo.length <= 3) ? g.grupo.toLocaleUpperCase() : ''` — solo se usa como sección si mide ≤3 caracteres.
- **Clave del estudiante:** el `password` propio de cada `participante` (no una clave global de la lista).
- Resultado: mismo formato de presentación que el Modo 1, pero sin edición/eliminación (vista de solo lectura sobre `data.participantes`).

### 7.5 Motor de PDF (`carnets-pdf.js`)
- **Página:** carta en mm: `{ w: 215.9, h: 279.4, mx: 10, top: 9, bottom: 12 }`.
- **Layouts:** `big` = 2×7 (14/pág), `gapX 5 / gapY 4`; `compact` = 3×8 (24/pág), `gapX 4 / gapY 3.5`.
- **Proporciones internas** (fracciones de `h` dentro de `drawSticker`): cabecera de color `hh = h*0.26`, bloque de nombre `nh = h*0.28`, pie `fh = h*0.13`, bloque de credenciales = resto.
- **Colores por academia** (`CN_ACADEMIAS`):
  - `tecno`: primario `#EA5A1E`, secundario `#84BC24`, franja `['#976FB0','#3A6BB5','#EA5A1E','#84BC24']`.
  - `cleveland`: primario `#25A5DE`, secundario `#7EBD3E`, franja `['#25A5DE','#7EBD3E']`.
  - Fallback silencioso a `tecno` si `opts.academiaId` no coincide.
- **Ordinales:** `ORDINALS.es = {1:'1er',2:'2do',...,6:'6to'}`, `ORDINALS.en = {1:'1st',...,6:'6th'}`.
- **Sanitización de texto (`clean()`):** jsPDF con fuentes estándar solo entiende Latin-1 (código ≤ 255). `clean()` deja pasar tal cual cualquier carácter ≤ 255 (incluye á é í ó ú ñ Á…Ñ). Lo que excede Latin-1 y no tiene forma NFD ≤255 se convierte en `'?'` (comillas tipográficas, guiones em-dash, emoji).
- **Nombre de archivo:** `"<prefijo>_<academia-slug>_<Media|Primaria>_<grado-slug>[_Seccion-X].pdf"`, `prefijo = 'Carnets'` (es) o `'ID-Cards'` (en). ZIP: `"<prefijo>_<academia-slug>.zip"`.
- **Pie de página:** `"<Nombre academia> · <grado/sección> · <pág>/<total>"`, gris claro, 6.5pt.

### 7.6 Textos de interfaz (i18n de la vista)
`carnets.js` tiene diccionario `T = { es: {...}, en: {...} }` con ~40 claves. `L()` elige según `ACADEMIA_ACTUAL.idiomaUI` (hoy `'es'` para ambas academias, así que `T.en` existe pero no se usa).

### 7.7 Escape de HTML
En `carnets.js` y `script.js`, todos los valores dinámicos se pasan por `esc()` antes de interpolarse en `innerHTML`. Para los `onclick` que necesitan texto libre se usa el patrón `data-*` + `this.dataset.x`. No se encontró ningún punto de datos de estudiantes sin escapar.

---

## 8. Despliegue

### 8.1 Firebase Hosting
```json
{
  "hosting": {
    "public": "Organizador_moodle",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```
El bloque `"firestore"` se agregó en la Fase 2 para poder publicar `firestore.rules` con `firebase deploy --only firestore:rules`. **`"hosting"` no se tocó** — sigue publicando únicamente `Organizador_moodle/`, así que `firestore.rules`, `database/` y este documento nunca llegan a producción vía Hosting. No hay `headers` (sin caché explícita), ni `rewrites`/`redirects`. `.firebaserc` no se tocó: `{ "projects": { "default": "moodle-organizador" } }`.

### 8.2 Versionado de assets
Ver tabla de §2. Los archivos de `lib/` (incluidos los tres nuevos del SDK de Firebase) y `login.html` siguen sin parámetro `?v=` — inconsistencia conocida, no crítica (ver §11.3).

### 8.3 Reglas de Firestore (nuevo en la Fase 2)
`firestore.rules` (raíz del repo, fuera de `Organizador_moodle/`) deniega todo por defecto y solo abre `academias/{id}/**` a una cuenta autorizada para esa `id` exacta (vía `auth_map/{uid}`, ver §3.7 y §5 de los pasos manuales más abajo). Se publica por separado de Hosting:
```bash
firebase deploy --only firestore:rules --project moodle-organizador
```
Un cambio en las reglas **nunca** se aplica solo. Hay que: (1) crear/mantener los documentos `auth_map/{uid}` correctos en la consola, (2) publicar las reglas con el comando de arriba, y (3) verificar los 5 casos de prueba de la lista de pasos manuales antes de confiar en que la separación tecno/cleveland funciona en producción.

### 8.4 `firebase-config.js` no es secreto
Los valores de `Organizador_moodle/firebase-config.js` (`apiKey`, `authDomain`, `projectId`, etc.) son la configuración pública de un proyecto Firebase — cualquier app web de Firebase los expone en el navegador. La protección real de los datos son las reglas de Firestore (§8.3), no mantener este archivo en secreto. Mientras tenga los marcadores `TU_..._AQUI`, la app arranca en modo solo local (ver §9a).

### 8.5 Pasos manuales
`git push`, `firebase deploy --only hosting` y `firebase deploy --only firestore:rules` los ejecuta la persona dueña del repo. La lista numerada completa (consola de Firebase + terminal, en orden) está al final de este documento, después de §12.

---

## 9. Guía "cómo se hace…"

**a) Agregar una academia nueva**
1. `academias.js`: agregar entrada a `ACADEMIAS` con `id`, `nombre`, `subtitulo`, `storageKey` (nueva y única — nunca reutilizar una existente), `emailDominio`, `importarCSV`, `idiomaCarnet`, `idiomaUI`.
2. `login.html`: agregar código(s) a `USERS` con `academia: '<nuevoId>'`.
3. `carnets-pdf.js`: agregar entrada a `CN_ACADEMIAS` con `colors` y `labels`. Si se omite, el PDF saldrá con los colores de Tecno.
4. `styles.css`: agregar bloque `body[data-academia="<nuevoId>"]` (y su versión `body.dark[...]`).
5. `script.js` → `freshData()`: la condición `id === 'tecno'` hace que la academia nueva arranque vacía. Para un catálogo propio hay que generalizar esa condición.
6. `script.js` → `applyAcademiaBranding()`: hoy es un `if/else` binario; para una tercera marca hay que extenderlo.

**b) Agregar una vista nueva al sidebar**
1. `index.html`: nuevo `<button class="nav-item" onclick="showView('miVista')" data-view="miVista">` + bloque `<div class="view" id="view-miVista">...</div>`.
2. `script.js` → `showView(id)`: agregar `if (id === 'miVista') renderMiVista();`.
3. Para lógica no trivial, seguir el patrón de `carnets.js` (IIFE que expone `window.MiModulo = { init, render }`).

**c) Agregar un código de acceso**
Editar `USERS` en `login.html`: `'codigo': { nombre: 'Nombre', academia: 'tecno'|'cleveland' }`.

**d) Cambiar los colores/diseño del carnet**
Editar `CN_ACADEMIAS[id].colors`/`.labels` en `carnets-pdf.js`. **Recordar que `stickers/js/stickers.js` tiene una copia separada de los mismos valores** — hay que replicar el cambio ahí también si `stickers/` sigue en uso (ver §11.1).

**e) Cambiar las medidas del PDF**
Editar `PAGE` y `LAYOUTS.big`/`LAYOUTS.compact` en `carnets-pdf.js`. Las proporciones internas de cada carnet son fracciones de `h` dentro de `drawSticker()`.

**f) Agregar un curso modelo base (Tecno)**
Opción normal: botón "+ Nuevo curso modelo" en la vista Cursos modelo (`saveCurso()`).
Para que aparezca en el arranque/restablecimiento: agregar a `DEFAULT_CURSOS` en `script.js`. Esto solo afecta a Tecno.

**g) Migrar el esquema de datos sin romper respaldos antiguos**
1. Agregar la clave nueva a `freshData()` con su valor por defecto.
2. Agregar la misma clave con el mismo patrón `parsed.nuevaClave || default` en **ambos**: `loadData()` y `importBackup()`.
3. `exportBackup()` no necesita cambios (usa `construirPayloadRespaldo()`, que hace `{ ...data, _academia, ... }`).
4. Si la nube está activa, revisar si la clave nueva necesita su propio mapeo en `SyncCore.construirIndiceLocal()`/`entidadesADatos()` (`Organizador_moodle/sync-core.js`) — de lo contrario, esa clave nueva no se sincronizará.
5. Actualizar el ejemplo de esquema de §4.1 de este documento, y las columnas correspondientes en `database/schema.sql` + `database/scripts/mapeo.js` si el dato también debe viajar a la base SQL portable.

**i_agregar) Agregar estudiantes nuevos a una lista ya existente**
1. En "Generador de usuarios → Años ya generados", pulsa **Ver/Editar** en la lista a la que quieres agregar.
2. El formulario entra en **modo agregar** automáticamente: los selectores quedan bloqueados y los cuadros de Apellidos y Nombres se rellenan con los estudiantes existentes.
3. En los cuadros, agrega (al final) los apellidos y nombres de los estudiantes nuevos, uno por línea, en el mismo orden en ambos cuadros.
4. El contador "N existentes · M nuevos" muestra cuántos ya están y cuántos se generarán.
5. Pulsa **Generar lista**: el sistema genera usuarios solo para los nuevos y los muestra con el badge "Nuevo" en la tabla.
6. Revisa la tabla y pulsa **Guardar lista** para agregar los nuevos a la lista existente. La Papelera no recibe nada.
7. Después de guardar, usa **⬇ CSV solo de los nuevos** para descargar el CSV listo para subir a Moodle (sin los usuarios que ya existen allí). El botón "⬇ CSV" completo sigue descargando toda la lista.
8. Para volver al modo normal sin agregar nada, pulsa **Salir del modo agregar**.

**h) Mudar la app a un servidor propio (sin Firebase)**
Ver `database/MIGRACION_A_SERVIDOR_PROPIO.md` para la guía completa. En resumen: `Organizador_moodle/` es estática y se copia tal cual; lo único que hay que reemplazar es `sync-firebase.js` por un adaptador nuevo (p. ej. `sync-rest.js`) que implemente las mismas 7 funciones contra una API propia, y registrarlo con `window.Sync._registrarAdaptador(...)`. `sync.js`, `sync-core.js` y `script.js` no cambian. `database/schema.sql` + `database/scripts/respaldo_a_sql.js` sirven para cargar los datos actuales (vía un Respaldo `.json` exportado desde la app) en la base SQL que use ese servidor nuevo.

**i) Agregar una academia nueva que use la nube**
Además de los pasos de (a): crear su cuenta de Firebase Authentication, agregar su documento `auth_map/{uid}` con el `academiaId` nuevo (consola de Firebase, nunca desde el cliente), y confirmar que `firestore.rules` no necesita cambios (la regla `estaAutorizadoParaAcademia()` ya es genérica por `academiaId`, no hay nada hardcodeado a `tecno`/`cleveland` ahí). Si se llega a implementar soporte multi-organización en la UI (no implementado hoy, ver §11), revisar también que no se haya colado un nuevo `=== 'tecno'` en `script.js` o `sync.js`.

---

## 10. Glosario

| Término | Significado en este código |
|---|---|
| **Academia** | `tecno` o `cleveland`; cada una con su propio `storageKey`, catálogo, idioma de carnet y colores. |
| **Colegio** | Institución cliente. `data.colegios[]`. |
| **Curso modelo** | Plantilla de curso en Moodle que se copia a cada colegio. `data.cursos[]`, con `nivel`. |
| **Nivel** | `'media'` (1º–5º año) o `'primaria'` (1º–6º grado). |
| **Asignación** | Registro de "este curso fue copiado a este colegio, en este año, con tantas clases". `data.asignaciones[]`. La UI lo llama "curso copiado". |
| **Año / Grado** | Texto libre (ej. "1er Año") asociado a una asignación; `extractAnioNum()` extrae el número cuando el código lo necesita. |
| **Nombre completo / Nombre corto** | Los dos nombres del curso copiado en Moodle; el corto termina en `-<iniciales>` y de ahí sale el prefijo de usuario. |
| **Participante** | Estudiante generado (usuario/clave de Moodle) para un colegio+curso+año+grupo. `data.participantes[]`. |
| **Grupo (`group1`)** | Subdivisión opcional dentro de un año (ej. "A"). Viene del CSV o se escribe a mano. |
| **Sección (carnets)** | Texto que se imprime en el carnet como subtítulo del grado. En Modo 2 se pre-llena desde `group1` solo si mide ≤3 caracteres. |
| **Lista de carnets** | Conjunto de estudiantes con clave en común para un nivel+grado+sección. `data.carnetListas[]` (Modo 1) o `pResultLists` efímero (Modo 2). |
| **Pool de numeración** | Rango de números ya usados para un colegio+prefijo, de donde se calcula el siguiente al generar una lista. |
| **Papelera** | `data.trash.{colegios, cursos, asignaciones, participantes, estudiantes, carnetListas}`. La única eliminación permanente inmediata es "Eliminar para siempre" / "Vaciar papelera" / importar un respaldo. |
| **Respaldo** | Archivo `.json` con todo `data` + `_academia`, único mecanismo de portabilidad entre navegadores/equipos. |

---

## 11. Deuda técnica conocida y decisiones asumidas

### 11.1 Duplicación `stickers/` ↔ `carnets-pdf.js`
`carnets-pdf.js` es, función por función, casi una copia literal del motor de `stickers/js/stickers.js` (`drawSticker`, `clean`, `hex2rgb`, `tint`, `shade`, `PAGE`, `LAYOUTS`, `ORDINALS`, `gradeLabel`), solo renombrado para exponerse como `window.CarnetsPDF`, y con los colores/labels de academia repetidos en dos objetos distintos (`CN_ACADEMIAS` vs `ACADEMIES`). **Riesgo:** un cambio de diseño en uno no se propaga al otro. `stickers/` se conserva por decisión explícita ("respaldo del generador independiente").

### 11.2 Papelera para carnets Modo 1 — **RESUELTO en `7479d08`**
Hasta el commit `1ff425c`, `deleteManualList()` y "Eliminar todas las listas" quitaban listas de forma permanente. El commit `7479d08` agregó `trash.carnetListas` y conectó las tres rutas de eliminación/sobrescritura a la Papelera con restauración. Ver §7.3.

### 11.3 Código muerto / inconsistencias menores
- `NAV_VIEWS` (`script.js`, línea 354) está declarado pero no se usa en ningún punto del código, y no incluye `'carnets'`. Vestigio de una versión anterior.
- `buildUsuariosCSV()` no escapa comas ni comillas en los campos (hace `.join(',')`), a diferencia de `exportReportCSV()` que sí lo hace. Si un apellido tiene coma, el CSV de usuarios queda con columnas corridas.
- Ningún exportador de CSV neutraliza campos que empiecen con `=`, `+`, `-` o `@` (riesgo teórico de "CSV injection" en Excel). Riesgo bajo dado el uso interno.
- Orden inconsistente de años entre dos pantallas: `fillGenAnioSelect()` ordena Media ascendente y Primaria **descendente** dentro del mismo `<select>`; `renderGenYearsSummary()` ordena **ambos** niveles descendente. No está claro si es intencional; no se corrigió.
- `freshData()` y `applyAcademiaBranding()` usan `ACADEMIA_ACTUAL.id === 'tecno'` en vez de un flag de `ACADEMIAS`. Agregar una tercera academia exige tocar `script.js` en ambos puntos. (`importarCSVArchivo()` ya no usa el `id` — lee `importarCSVConservarDatos` del flag, resuelto en el cambio de 2026-10-06.)
- `login.html` solo verifica `tcUser` para la redirección directa; `index.html` verifica tanto `tcUser` como `tcAcademia`. El guardia de `index.html` cubre el caso de sesión incompleta.
- Los archivos de `lib/` y `login.html` no llevan parámetro `?v=` de cache-busting (inconsistencia conocida pero no crítica).
- `LEEME.txt` no menciona el Generador de usuarios, la paginación de Participantes, ni la Papelera ampliada. Solo describe el flujo original de colegios y carnets.

### 11.4 Decisiones heredadas de instrucciones anteriores, confirmadas vigentes en el código
- Interfaz en español para ambas academias (`idiomaUI: 'es'`); solo el contenido *impreso* de los carnets de Cleveland sale en inglés.
- Cleveland arranca siempre con catálogo vacío.
- `localStorage` sigue siendo la fuente inmediata de datos (local-first); **desde la Fase 2 existe además sincronización opcional con Firestore** si el dispositivo se vincula — ver §3.7. `firebase-config.js` SÍ existe ahora en `Organizador_moodle/` (con marcadores hasta que se completen los valores reales).
- El carnet-PDF `clean()` convierte a `'?'` cualquier carácter fuera de Latin-1 que no tenga forma NFD ≤255 (comillas tipográficas, guiones largos, emoji). Acentos y eñe español no se ven afectados (están dentro de Latin-1).

### 11.6 Deuda técnica y riesgos nuevos de la Fase 2 (sincronización)
- **Límite de 500 operaciones por batch de Firestore** (`sync-firebase.js` → `escribirLote()`): con los volúmenes actuales (participantes agrupados por lista, no un documento por estudiante) un solo batch alcanza en el uso normal de 3 personas. Si algún día una sola sincronización necesitara tocar más de 500 documentos de golpe (por ejemplo, una importación de un respaldo gigantesco con la nube ya vinculada), el `batch.commit()` fallaría. No se implementó división en varios batches — está documentado como límite conocido, no como bug silencioso.
- **La fusión automática (`SyncCore.fusionarEntidades`) es por entidad completa, no por campo.** Si dos dispositivos editan el **mismo** colegio/curso/asignación/lista mientras ambos están desconectados entre sí, gana la versión que se sube primero a la nube cuando ambos sincronizan después (*last-write-wins*, con aviso "☁ Se actualizaron N registro(s) desde otro dispositivo"). No hay fusión de campos individuales (por ejemplo, si A cambia el nombre de un colegio y B cambia sus clases en la misma asignación, no se combinan — una de las dos ediciones completas se pierde). Para 3 usuarios que casi nunca editan la misma entidad en simultáneo, se consideró un riesgo aceptable frente a la complejidad de una fusión por campo.
- **El respaldo automático "por si acaso" no se descarga en cada sincronización rutinaria**, solo en los dos momentos de mayor riesgo: la primera vinculación de un dispositivo cuando hay datos distintos en ambos lados (§3.7, paso 2), y `importBackup()`. Descargarlo en cada fusión silenciosa (que puede ocurrir varias veces por sesión, cada vez que se vuelve a la pestaña) sería más una molestia que una protección real.
- **`eliminado_en` aproximado para colegios/cursos/asignaciones en `database/scripts/mapeo.js`**: el formato del Respaldo no guarda la fecha exacta en que esos tres tipos fueron enviados a la Papelera (a diferencia de `trash.estudiantes` y `trash.carnetListas`, que sí la llevan). Los scripts de `database/` usan la fecha de exportación del respaldo como aproximación — ver `database/README.md`.
- **No se implementó `firestore_a_sql.js`** (decisión explícita: no es necesario por ahora; el camino principal es Respaldo `.json` → SQL, que no requiere credenciales de Admin SDK).
- **Multi-organización:** `sync-core.js`, `firestore.rules` (vía `auth_map`) y `database/schema.sql` ya usan un identificador genérico de organización (`academiaId`/`academia_id`) en vez de comparaciones fijas a `'tecno'`/`'cleveland'`. Esto no significa que la Fase 2 implemente soporte multi-organización en la UI — `script.js` sigue teniendo comparaciones `ACADEMIA_ACTUAL.id === 'tecno'` heredadas (§3.4, §9a) que una tercera academia con catálogo propio seguiría necesitando resolver a mano.

### 11.8 Riesgos del modo agregar

- **Coincidencia por nombre/apellido:** la detección de existentes se hace por comparación `normalize(apellido) || normalize(nombre)` sin distinguir mayúsculas ni acentos. Si dos estudiantes distintos tienen exactamente el mismo nombre y apellido, el segundo se considera "existente" y no se genera (falso positivo). El usuario debe revisar el contador y la tabla antes de guardar.
- **Rangos no continuos:** si se agregan usuarios y los números del pool no son consecutivos con los anteriores (por ejemplo porque hay estudiantes en otras listas del mismo colegio con números intermedios), el rango mostrado en "Años ya generados" será no contiguo (`ag0001–ag0014, ag0086–ag0090`). Esto es correcto y esperado, pero puede confundir a quien espera siempre un rango simple.
- **Reestructurar con nuevos:** si se elimina un estudiante y se elige "Reestructurar" en una lista que ya tiene estudiantes agregados (con `agregadoEn`), los nuevos también se renumeran. El badge "Nuevo" en la tabla se perderá (la fila ya no tiene `esNuevo`) hasta que se vuelva a cargar con Ver/Editar.
- **CSV solo de nuevos fuera de sesión:** el botón "⬇ CSV solo de los nuevos" depende de `genPreviewRows` en memoria. Si el usuario recarga la página después de guardar, el botón no estará visible hasta que abra la lista con Ver/Editar (que detecta los participantes con `agregadoEn` y muestra el botón). El CSV completo siempre está disponible desde "Años ya generados".

### 11.7 Lo que no se pudo verificar
- No se probó la app en un navegador real durante esta revisión. Todo lo listado en el checklist se verificó por lectura directa del código, más pruebas automatizadas en Node para la lógica de sincronización y de la base de datos (ver `database/scripts/test_*.js`).
- No se pudo determinar si el campo `notas` de las asignaciones se usa en algún punto de la UI más allá del modal de edición y el CSV de reporte (`exportReportCSV`). No aparece en ninguna tabla de la UI. Puede ser intencional (campo "solo para el reporte") o un olvido; no hay evidencia concluyente en el código.
- **Fase 2 — no se pudo probar contra un proyecto Firebase real:** no hay credenciales de un proyecto Firebase en este entorno (y no correspondía inventarlas). `firebase-config.js` tiene marcadores; `sync-firebase.js` se verificó por lectura y porque su contrato (7 funciones) se probó exhaustivamente contra una "nube" falsa en memoria (`database/scripts/test_sync_dos_dispositivos.js`), pero nunca se ejecutó contra Firestore real ni se probaron las reglas con el emulador de Firebase. Los pasos manuales para verificarlo en producción están al final de este documento.
- **Fase 2 — no se pudo ejecutar `database/schema.sql` contra un motor MySQL/MariaDB real** (no hay uno disponible en este entorno). Se verificó por lectura y, en su lugar, se probó un esquema estructuralmente equivalente en SQLite (`database/scripts/sqlite-schema.js`, con `node:sqlite`) con la prueba de ida y vuelta completa (`database/scripts/test_idavuelta.js`), incluido un caso con 5.000 participantes.

---

## 12. Prompt de arranque para un chat nuevo

```
Voy a darte el archivo "nueva documentacion.md" del repo Proyectos (carpeta
Organizador_moodle/, app TecnoCleveland + Cleveland English Institute). Es el
documento vigente a partir del 2026-10-06, verificado contra el commit 2759783.
La v4 (documentacion_organizador_moodle.md) queda como referencia histórica
pero ya no es la fuente de verdad.

Lee todo el documento antes de proponer cualquier cambio: describe el modelo
de datos real, las reglas de numeración de usuarios, el multi-academia, el
Generador de carnets y la sincronización con Firebase (Fase 2, §3.7 y §4.4),
todo verificado contra el código fuente.

Reglas de trabajo:
- No hagas git push, git commit, firebase deploy ni firebase deploy --only
  firestore:rules bajo ninguna circunstancia; eso lo hago yo manualmente.
- Todo en español (comentarios, mensajes, textos de interfaz), salvo el
  contenido impreso de los carnets de Cleveland English Institute, que va en
  inglés.
- Retrocompatibilidad obligatoria: cualquier cambio al esquema de datos
  (data.colegios/cursos/asignaciones/participantes/carnetListas/
  carnetOpciones/trash) tiene que seguir cargando localStorage y respaldos
  .json antiguos sin romperse (patrón `parsed.x || default` en loadData() e
  importBackup(), más el default en freshData()). Ver §9g.
- tc_organizador_data es la clave real de TecnoCleveland en producción:
  no se toca, no se renombra.
- Capa abstracta: script.js, carnets.js y login.html solo hablan con
  window.Sync (sync.js). Nunca llames a firebase.* fuera de sync-firebase.js.
  Ver §3.7 y §9h.
- Nunca subas a git un respaldo .json real, un CSV de estudiantes, una clave
  de cuenta de servicio de Firebase, ni una base .db/.sql con datos reales
  (el .gitignore de la raíz ya los excluye).
- Antes de tocar carnets-pdf.js, revisa si el cambio también aplica a
  stickers/js/stickers.js (son dos copias del mismo motor de PDF, ver §11.1).
- Si agregas una función de utilidad nueva (acordeón, paginación, etc.),
  documenta aquí qué claves de `uiAcordeones` están activas y qué vistas
  usan la paginación.

[Pega aquí el contenido completo de "nueva documentacion.md"]
```

---

## Pasos manuales pendientes (consola de Firebase + terminal)

Nada de lo anterior ejecuta estos pasos — los hace la persona dueña del repo, en este orden. Ver también §8.3–§8.5.

**Antes de que la nube funcione en producción:**
1. **Habilitar Firestore** — consola Firebase → `moodle-organizador` → Build → Firestore Database → "Crear base de datos" → región más cercana → modo "Producción".
2. **Habilitar Firebase Authentication** — Build → Authentication → "Comenzar" → proveedor "Correo electrónico/contraseña" → Activar.
3. **Crear las 3 cuentas de nube** (tú eliges las contraseñas; no se guardan en ningún archivo de este repo):
   - `admin@tecno.organizador` (academia `tecno`, corresponde al código `2026`)
   - `asistente@tecno.organizador` (academia `tecno`, corresponde al código `1010`)
   - `ruben@cleveland.organizador` (academia `cleveland`, corresponde al código `ruben`)
   Anota el UID que Firebase le asigna a cada una (Authentication → Usuarios).
4. **Crear los documentos `auth_map`** — Firestore → colección `auth_map` → un documento por UID del paso 3, con los campos `academiaId` (`"tecno"` o `"cleveland"`) y `nombre`.
5. **Obtener la configuración web** — `firebase apps:sdkconfig web --project moodle-organizador` (o consola → Configuración del proyecto → tu app web → "Configuración del SDK") y copiar los valores en `Organizador_moodle/firebase-config.js`, reemplazando los marcadores `TU_..._AQUI`.
6. **Publicar las reglas de Firestore** — `firebase deploy --only firestore:rules --project moodle-organizador`.
7. **Verificar las reglas** con las cuentas del paso 3 (consola Firestore → "Reglas" → "Playground", o manualmente desde la consola del navegador ya logueado): cuenta de `tecno` no puede leer `academias/cleveland/**`; cuenta de `cleveland` no puede leer `academias/tecno/**`; sin sesión no se lee nada.
8. **Desplegar la app actualizada** — `firebase deploy --only hosting --project moodle-organizador`.
9. **Vincular cada dispositivo** — abrir la app, iniciar sesión con el código de siempre, ir a la vista Respaldo → "☁ Conectar con la nube" → correo + contraseña del paso 3. La primera vez que haya datos en ambos lados (equipo + nube), seguir el modal de decisión (ver §3.7, paso 2).

Todo lo anterior requiere el plan **Spark (gratuito)** de Firebase — no se necesita el plan Blaze para nada de lo implementado en esta fase.
