# INSTRUCCIÓN — Sincronización con Firebase (acceso desde cualquier dispositivo) + base de datos portable estilo Moodle

Lee COMPLETO el archivo `nueva documentacion.md` de la raíz del repo (documento vigente). Es tu contexto: describe el modelo de datos (`data`), el multi-academia, el login por código, el Respaldo y las reglas que nunca se deben romper. Respeta todas las reglas de trabajo de su §12.

Esta tarea es grande y toca producción, así que se hace en **dos fases con una pausa obligatoria**.

---

## 0. Metodología: dos fases

### Fase 1 — Auditoría y plan (SOLO LECTURA, no modifiques código)
1. Audita el código actual: `loadData()`, `saveData()`, `freshData()`, `importBackup()`, `exportBackup()`, `resetCatalogs()`, `login.html`, `academias.js`, el guardia de sesión de `index.html`, `firebase.json`, `.firebaserc` y el tamaño real aproximado de `data` (estima cuánto pesa una academia con cientos o miles de participantes).
2. Entrega un archivo **`PLAN_sincronizacion_firebase.md`** en la raíz con:
   - Arquitectura elegida (Firestore vs Realtime Database) y **por qué**, considerando: límite de 1 MiB por documento de Firestore, cuotas del plan gratuito (Spark), y que `data` crece con `participantes` y `trash`.
   - Estructura de datos en la nube (colecciones/documentos o rutas) y cómo se divide `data` para no exceder límites ni reescribirlo completo en cada guardado.
   - Estrategia de sincronización y de conflictos (ver §3.3).
   - Estrategia de autenticación y reglas de seguridad (ver §3.4), explicando con honestidad **qué nivel real de seguridad se logra**.
   - Lista exacta de archivos a crear y modificar, y orden de carga de scripts.
   - Cómo cumples la **Parte C** (contenido del respaldo, restauración desde cero, estimación del tamaño frente al límite de `localStorage`).
   - Riesgos y cómo se mitigan.
   - **Pasos manuales que tengo que hacer yo** en la consola de Firebase y en la terminal (ver §5).
3. **DETENTE y espera mi confirmación explícita ("adelante")** antes de pasar a la Fase 2. No modifiques ningún archivo existente en la Fase 1.

### Fase 2 — Implementación
Solo después de mi aprobación. Implementa lo aprobado en el plan (con los ajustes que yo indique).

---

## 1. Objetivo

1. **Parte A — Sincronización en la nube.** Los datos de las dos academias (`tecno`: códigos `2026` y `1010`; `cleveland`: código `ruben`) se guardan también en Firebase, para abrir el organizador desde **cualquier dispositivo** y ver la información cargada. **Sin eliminar** la forma actual de almacenamiento: `localStorage` sigue funcionando exactamente como hoy.
2. **Parte B — Base de datos portable.** Dentro de la carpeta del proyecto, crear una **base de datos relacional (SQL) que modele los datos como los maneja Moodle** (campos de usuario con los mismos nombres que el CSV de carga masiva de Moodle), con scripts de migración, para poder **mudar la app a un dominio y servidor propios** sin depender de Firebase.
3. **Parte C — Respaldo completo y restauración desde cero.** Los datos **siguen guardándose en el navegador**. El botón **"Descargar respaldo (.json)"** de la vista Respaldo debe descargar **TODA** la data de la academia, de modo que si algo pasa (se borra el navegador, cambio de equipo, la app queda en blanco) el botón **"Importar respaldo"** restaure todo. Aplica igual a las dos academias (ver "Parte C" más abajo).

---

## 2. Requisitos no negociables

- **Local-first:** `localStorage` sigue siendo la fuente inmediata. `saveData()` guarda local de inmediato (como hoy) y la nube se actualiza **de forma asíncrona**. Si Firebase falla o no hay internet, la app debe funcionar igual que hoy y sincronizar después.
- **No renombrar ni tocar** `tc_organizador_data` ni `cc_organizador_data`.
- **Retrocompatibilidad total:** respaldos `.json` y `localStorage` antiguos deben seguir cargando. Si agregas campos de control (versión, revisión, marcas de tiempo), que no rompan nada (patrón `parsed.x || default` en `loadData()` e `importBackup()`, más `freshData()`).
- **Separación de academias (regla 3 del §1):** los datos de Tecno y Cleveland nunca se mezclan, ni en la nube ni en SQL. La separación en la nube debe estar **garantizada por las reglas de seguridad**, no solo por el código del cliente.
- **Sin build ni backend propio:** la app sigue siendo HTML/CSS/JS estático. Si usas el SDK de Firebase, que sea sin bundler (SDK "compat" vendorizado en `lib/`, o módulos ESM desde el CDN oficial `gstatic`); justifica la elección en el plan.
- **Preferencias de interfaz** (`tc_dark`, clave del sidebar) **no se sincronizan**: son del navegador.
- **Seguridad de datos personales:** los datos incluyen nombres de menores de edad y claves iniciales de Moodle. **Nunca** subas a git: claves de cuentas de servicio, respaldos `.json`, CSV con estudiantes ni bases de datos con datos reales. Agrega los patrones necesarios a `.gitignore`.
- **Reglas de seguridad por defecto en "denegar":** nada de reglas abiertas (`allow read, write: if true`) ni modo de prueba.
- **No hagas `git commit`, `git push` ni `firebase deploy`.** Tú preparas los archivos; yo ejecuto los comandos.
- Todo en español (comentarios, mensajes y textos de interfaz).

---

## 3. Parte A — Sincronización con Firebase

### 3.1 Capa de almacenamiento abstracta (clave para poder mudarse después)
Introduce una capa de persistencia con una interfaz mínima (por ejemplo `cargar()`, `guardar(cambios)`, `suscribir()`), con **dos implementaciones**: `localStorage` (la actual) y Firebase. El resto de la app (`script.js`, `carnets.js`) no debe llamar al SDK de Firebase directamente. Así, mudarse a un servidor propio en el futuro significa escribir **un solo adaptador nuevo** (por ejemplo contra una API REST + la base de datos de la Parte B). Crea un archivo nuevo para el adaptador de Firebase (por ejemplo `sync-firebase.js`) y deja el código existente lo más intacto posible.

### 3.2 Modelo en la nube
- Sincroniza todo `data` (colegios, cursos, asignaciones, participantes, carnetListas, carnetOpciones, trash) **por academia**.
- Respeta el límite de 1 MiB por documento: **no** guardes todo `data` en un único documento. Divide por colección y, si hace falta, por entidad o por lote (por ejemplo participantes por lista año+grupo).
- Escribe **solo lo que cambió** (diff contra el último estado sincronizado) y agrupa escrituras con *debounce* para no gastar la cuota diaria de escrituras.
- Cada documento en la nube lleva metadatos: `rev` o `updatedAt`, quién lo modificó (código/nombre de sesión) y `schemaVersion`.

### 3.3 Flujo de sincronización
1. **Arranque:** carga local inmediata (la app abre rápido como hoy) y, en paralelo, autentica con Firebase y descarga el estado de la nube.
2. **Primera vez (nube vacía):** si la nube de esa academia está vacía y hay datos locales, ofrece "Subir los datos de este equipo a la nube" con confirmación. Esto es la migración inicial de los datos que hoy viven en el navegador.
3. **Nube con datos y local distinto:** **nunca pierdas datos en silencio.** Antes de reemplazar datos locales con los de la nube (o al revés), descarga automáticamente un respaldo `.json` local y muestra un aviso claro con opciones: usar la nube / subir lo de este equipo / cancelar. Propón en el plan cómo mezclar cambios cuando se tocan entidades distintas, y qué hacer cuando se toca la misma entidad desde dos dispositivos.
4. **Escrituras:** `saveData()` sigue guardando local al instante; luego encola la subida. Reintentos con espera si falla.
5. **Otros dispositivos:** propón en el plan si conviene escucha en tiempo real o solo actualizar al abrir, al volver a la pestaña y con un botón manual. Si usas tiempo real, **no debe pisar lo que la persona está editando** (por ejemplo la vista previa editable del Generador de usuarios).
6. **Indicador visible de estado** (por ejemplo en el pie del sidebar o junto al nombre de usuario): "Sincronizado ✓", "Sincronizando…", "Sin conexión (cambios pendientes)", "Error de sincronización", con `title`/`aria-label` en español, y un botón "Sincronizar ahora". Debe funcionar en modo claro/oscuro y con el sidebar ocultable.
7. **Funciones que reemplazan datos masivamente** (`importBackup()`, `resetCatalogs()`, "Vaciar papelera", restaurar desde papelera, eliminar listas, etc.) deben propagarse correctamente a la nube, incluidas las eliminaciones. Revisa cada una y documenta cómo se sincroniza.
8. **Cerrar sesión** no borra los datos locales ni los de la nube (comportamiento actual).
9. **Sin internet al iniciar sesión:** el login por código sigue funcionando localmente; la sincronización se reintenta cuando haya conexión.

### 3.4 Autenticación y reglas de seguridad (parte crítica)
Hoy el login es solo del lado del cliente (`USERS` en `login.html`) y cualquier persona puede leer ese código en el navegador. Si Firebase se abre sin autenticación real, **cualquiera podría leer los datos de los estudiantes**. Por eso:

- Usa **Firebase Authentication**. Cada código de acceso (`2026`, `1010`, `ruben`) debe corresponder a una cuenta de Firebase, y las **reglas de Firestore/Realtime Database** deben permitir leer/escribir `academias/<id>` **únicamente** a las cuentas autorizadas para esa academia (por ejemplo, con un documento de autorización por `uid` que solo se pueda crear desde la consola o un script de administración, nunca desde el cliente).
- `2026` y `1010` (ambos Tecno) deben acceder a los mismos datos de Tecno; `ruben` solo a los de Cleveland.
- Los códigos actuales son cortos (4 dígitos / una palabra) y Firebase exige contraseñas de mínimo 6 caracteres. **No uses el código en claro como contraseña sin analizarlo.** En el plan, compara al menos estas opciones y recomienda una, explicando el riesgo real de cada una (incluido el riesgo de fuerza bruta y que el código fuente es visible):
  - derivar la contraseña de Firebase a partir del código + un secreto largo;
  - pedir un correo + contraseña reales en `login.html`, manteniendo el código como acceso rápido solo local;
  - alargar los códigos de acceso (te recomendaré subirlos a 8+ caracteres);
  - Cloud Functions (requiere plan Blaze) — solo mencionarla como alternativa futura.
- Mantén el flujo y la apariencia actuales de `login.html` y las claves `tcUser` / `tcAcademia` de `sessionStorage`, salvo lo estrictamente necesario.
- Entrega `firestore.rules` (o `database.rules.json`) con **denegar por defecto**, y un listado de pruebas manuales (o con el emulador de Firebase si es viable) que demuestre: usuario de Tecno **no** lee Cleveland, usuario de Cleveland **no** lee Tecno, y sin sesión no se lee nada.
- Si recomiendas activar App Check, descríbelo como paso opcional, no obligatorio.

### 3.5 Archivos e infraestructura de Firebase
- `firebase-config.js` (configuración web pública del proyecto `moodle-organizador`): **no inventes los valores**. Deja el archivo con marcadores claros e indícame el comando exacto para obtenerlos (por ejemplo `firebase apps:sdkconfig web`) o dónde copiarlos en la consola. Aclara que esos valores no son secretos y que la protección real son las reglas.
- Ubicación: los archivos que la web necesita deben quedar **dentro de `Organizador_moodle/`** (es lo único que se publica). Las reglas (`firestore.rules`, etc.) y scripts de administración van **fuera** de esa carpeta, en la raíz o en `database/`.
- Actualiza `firebase.json` **sin romper** `"public": "Organizador_moodle"` ni el bloque `hosting`: solo agrega lo necesario para publicar las reglas. No cambies `.firebaserc`.

### 3.6 Cache-busting y orden de carga
Sube +1 el `?v=` de cada archivo que modifiques en `index.html` y define el orden de carga de los scripts nuevos (SDK → configuración → adaptador → `script.js`, o como justifiques en el plan). Verifica que `academias.js` siga cargando primero.

---

## 4. Parte B — Base de datos portable estilo Moodle

Crea la carpeta **`database/`** en la raíz del repo (fuera de `Organizador_moodle/`, para que **no** se publique en Firebase Hosting).

### 4.1 Esquema SQL
- **`database/schema.sql`** compatible con **MySQL 8 / MariaDB** (la familia que usa Moodle), con `utf8mb4`. Incluye comentarios en español y, en `database/README.md`, notas para adaptarlo a PostgreSQL.
- Tablas mínimas (ajusta nombres y relaciones en el plan):
  - `academias` (id, nombre, subtitulo, email_dominio, etc.).
  - `usuarios_app` (accesos a la app: id, academia, nombre, **hash** del código — nunca el código en claro —, activo, fechas).
  - `colegios`, `cursos_modelo`, `asignaciones` (con `nombre_completo`, `nombre_corto`, `clases`, `notas`).
  - `participantes`: **usa los nombres de columna de la carga masiva de Moodle** (`username`, `password`, `firstname`, `lastname`, `email`, `city`, `country`, `course1`, `group1`, `role1`, `enrolperiod1`, `suspended`) y conserva además los campos propios de la app (`nombres`, `apellidos`, `anio`, `nivel`, `colegio_id`, `curso_id`, `fecha`). Verifica en el código cómo se arman `firstname`/`lastname` hoy (el `firstname` lleva el usuario antepuesto) y reproduce esa lógica en la vista de abajo. **No impongas `UNIQUE` sobre `username` si la app hoy permite duplicados**; usa índices y documenta la decisión.
  - `carnet_listas` + `carnet_estudiantes` y `carnet_opciones`.
  - La **Papelera** debe representarse de forma fiel y reversible (por ejemplo con columna `eliminado_en` y un identificador de lote para las eliminaciones por lista o individuales). Explica el mapeo.
- Una **VISTA** (por ejemplo `v_moodle_upload`) que devuelva exactamente las columnas que Moodle espera en la carga masiva de usuarios, lista para exportar a CSV.
- Todas las tablas con `academia_id` para mantener la separación Tecno/Cleveland.

### 4.2 Scripts de migración (Node.js, sin credenciales en el repo)
En `database/scripts/`:
1. **`respaldo_a_sql.js`**: lee un archivo de Respaldo `.json` exportado por la app (`respaldo_<academia>_<fecha>.json`) y genera un `.sql` con los `INSERT` (o importa directo a SQLite para pruebas). Esta es la vía principal porque no requiere credenciales.
2. **`sql_a_respaldo.js`**: el camino inverso, genera un Respaldo `.json` que la app pueda importar con "Importar respaldo". Requisito de calidad: **ida y vuelta sin pérdida** (JSON → SQL → JSON debe devolver datos equivalentes, incluida la papelera).
3. (Opcional, solo si no complica) `firestore_a_sql.js` que use `firebase-admin` y una clave de servicio **que yo coloco fuera del repo**; si lo incluyes, `.gitignore` debe impedir subir la clave.
4. Un **JSON de ejemplo ficticio** (nombres inventados, ningún dato real) para probar los scripts.

### 4.3 Documentación para la mudanza
- **`database/README.md`**: cómo crear la base de datos, importar un respaldo, exportar el CSV de carga de Moodle desde la vista, y notas de PostgreSQL.
- **`database/MIGRACION_A_SERVIDOR_PROPIO.md`**: guía para mudar la app a un dominio y servidor propios: qué se copia (la carpeta `Organizador_moodle/` es estática y portable), qué parte hay que reemplazar (el adaptador de Firebase por otro contra una API propia) y cómo cargar los datos actuales en la base SQL. Incluye una lista de verificación.

### 4.4 `.gitignore`
Crea o actualiza el `.gitignore` de la raíz para excluir: respaldos `.json` reales, CSV de estudiantes, archivos `.db`/`.sqlite`, volcados `.sql` con datos reales, claves de servicio (`*serviceAccount*.json`, `*-adminsdk-*.json`) y `node_modules/`. Conserva en git solo el esquema, los scripts y el ejemplo ficticio.

---

## Parte C — Respaldo completo y restauración desde cero (ambas academias)

**Requisito:** la información sigue guardándose en el navegador (`localStorage`), como hoy. Además, el botón **"Descargar respaldo (.json)"** (vista Respaldo) debe producir un archivo con **TODA** la data de la academia de la sesión activa, y **"Importar respaldo"** debe poder restaurarla completa **incluso si la app está en blanco** (navegador nuevo, `localStorage` vacío, sin internet y sin Firebase). Debe funcionar igual para `tecno` y `cleveland`.

### C.1 Qué debe contener el respaldo
- **Todo el objeto `data`**: `colegios`, `cursos`, `asignaciones`, `participantes`, `carnetListas`, `carnetOpciones` y las 6 secciones de `trash` (`colegios`, `cursos`, `asignaciones`, `participantes`, `estudiantes`, `carnetListas`).
- Audita `exportBackup()` y confirma qué incluye hoy. Exporta el objeto `data` **completo** (no una lista fija de claves), de modo que cualquier clave presente o futura entre automáticamente. Reporta si hoy faltaba algo.
- Metadatos nuevos: `_academia` (ya existe), `_versionEsquema` (número de versión del formato del respaldo), `_exportadoEn` (fecha/hora ISO), `_exportadoPor` (nombre de la sesión) y `_resumen` con conteos (colegios, cursos, asignaciones, participantes, listas de carnets, ítems en papelera).
- **No incluir:** preferencias de interfaz (`tc_dark`, clave del sidebar) ni datos transitorios de sincronización (colas, revisiones locales). Nunca datos de la otra academia.
- Nombre de archivo: se mantiene `respaldo_<academiaId>_<YYYY-MM-DD>.json`.
- Este formato es el **formato de intercambio** que usan los scripts de `database/` (Parte B): documenta `_versionEsquema` y no cambies la estructura sin versionarla.

### C.2 Restaurar desde una app en blanco
- `importBackup()` debe funcionar con sesión recién iniciada y `localStorage` vacío (en ese estado `freshData()` da el catálogo base en Tecno y vacío en Cleveland): el respaldo **reemplaza todo `data`**, incluido ese catálogo base, sin mezclar ni duplicar.
- Debe funcionar **sin internet y sin Firebase**: la restauración local nunca depende de la nube.
- Mantén las confirmaciones actuales (incluida la advertencia si el respaldo es de otra academia). Si los datos actuales **no están vacíos**, descarga automáticamente un respaldo de seguridad del estado previo antes de reemplazarlo.
- Valida que el archivo sea realmente un respaldo (mensaje claro en español si no lo es), pero tolera respaldos antiguos sin las claves nuevas (patrón `parsed.x || default`).
- Al terminar, muestra un **resumen de lo restaurado** (conteos por tipo) y re-renderiza toda la app.
- Si la sincronización con Firebase está activa, el reemplazo debe propagarse a la nube (ver §3.3.7) **pidiendo confirmación explícita**, porque afecta a los demás dispositivos: "esto también reemplazará los datos guardados en la nube".

### C.3 Tamaño y límites de `localStorage`
`localStorage` suele permitir alrededor de 5 MB por origen. Estima en el plan el tamaño real de `data` con miles de participantes más papelera, indica cuánto margen hay y qué pasa cuando `saveData()` falla por cuota. Si hay riesgo real, propón una mitigación (aviso al acercarse al límite o, a futuro, IndexedDB como almacén local) sin implementarla salvo que yo la apruebe.

### C.4 Vista Respaldo (textos y recordatorio)
- Actualiza los textos de la vista Respaldo para que reflejen la realidad (hoy dice que la información se guarda solo en el navegador; con la nube activa, aclara que el respaldo `.json` sigue siendo la copia de seguridad personal y descargable).
- El texto de "Exportar respaldo" debe decir que descarga **toda** la información de la academia (incluida la papelera).
- Si es simple: muestra **"Último respaldo descargado: <fecha>"** (guardado como preferencia local de interfaz, fuera de `data`) y un aviso suave si nunca se descargó o han pasado más de 7 días. Si complica el diseño, omítelo y dilo.

### C.5 Prueba de ida y vuelta (obligatoria)
Para **ambas** academias: exportar → vaciar el `localStorage` de esa academia → recargar → importar → comparar `data` antes y después (igualdad profunda, ignorando metadatos). Si hay Node.js, automatízalo con un script que simule `localStorage`; si no, haz el trace manual y dilo. Incluye un caso con un conjunto grande (≥ 5.000 participantes simulados) para medir tamaño del archivo y tiempo.

---

## 5. Pasos manuales míos (lístalos al final con comandos exactos)

Tu plan y tu reporte final deben incluir una lista numerada de lo que **yo** debo hacer, por ejemplo: habilitar Firestore/Realtime Database en la consola (región), habilitar Authentication (proveedor correspondiente), crear las cuentas de Firebase para `2026`, `1010` y `ruben`, crear los documentos de autorización por academia, copiar la configuración web a `firebase-config.js`, publicar reglas con el comando que corresponda, y `firebase deploy --only hosting` (más lo necesario para las reglas). Indica el orden correcto y qué verificar tras cada paso. Si algo requiere el plan Blaze, díselo claramente.

---

## 6. Verificación (sin navegador)

No dependas de abrir un navegador. Verifica leyendo/trazando el código y, si hay Node.js, ejecutando los scripts con el JSON de ejemplo. Reporta:
- La app sigue funcionando con `localStorage` si Firebase no carga o no hay internet.
- `loadData()` / `importBackup()` siguen aceptando respaldos antiguos sin los campos nuevos.
- `data` de Tecno y Cleveland no se cruzan en ninguna ruta de código ni en las reglas.
- Cada función que reemplaza o elimina datos masivamente se propaga a la nube.
- Las reglas deniegan por defecto y los casos de prueba de §3.4.
- Ida y vuelta JSON → SQL → JSON sin pérdida (si pudiste ejecutarlo; si no, dilo).
- `schema.sql` se ejecuta sin errores en SQLite/MariaDB si hay motor disponible; si no, indícalo.
- **Parte C:** el respaldo exportado contiene todo `data` (incluida la papelera) y los metadatos; la prueba de ida y vuelta (exportar → vaciar → importar) devuelve datos idénticos en `tecno` y en `cleveland`; la restauración funciona con app en blanco, sin internet y sin Firebase; un respaldo antiguo sin metadatos sigue importando; tamaño y tiempo con ≥ 5.000 participantes.
- Qué **no** pudiste probar (Firebase real, navegador, ChromeOS).

## 7. Documentación

Actualiza `nueva documentacion.md` en el mismo archivo: §1 (nuevas reglas: datos en la nube, secretos), §2 (archivos nuevos, `?v=`, orden de carga), §3 (autenticación con Firebase), §4 (metadatos de sincronización y flujo de datos), §3.5 y §5 (formato nuevo del respaldo `.json`, `_versionEsquema`, restauración desde cero y vista Respaldo), §5 (indicador de estado y botón de sincronizar), §8 (despliegue: reglas y pasos manuales), §9 (guía "cómo mudar a servidor propio" apuntando a `database/`), §11 (deuda técnica y riesgos nuevos), §12 (prompt de arranque) y la sección "Cambios". No toques la documentación histórica.

## 8. Entrega

**Fase 1:** entrega `PLAN_sincronizacion_firebase.md`, resume en pocas líneas las decisiones clave y las preguntas que necesiten mi respuesta, y espera.
**Fase 2 (tras mi "adelante"):** resume archivos creados/modificados, resultado de cada verificación, lo que no se pudo probar, y la lista numerada de mis pasos manuales.
