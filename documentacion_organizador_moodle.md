# Organizador Moodle — Documentación definitiva (v4, verificada contra el código)

**Fecha de verificación:** 2026-10-04
**Commit base:** `be0f135` (`git rev-parse --short HEAD`) — esta versión documenta ese commit **más** los cambios de la sesión de 2026-10-04 (Generador de usuarios, Colegios, Buscar, Papelera) que estaban aplicados en el árbol de trabajo pero todavía sin `git commit` al cerrar la tarea (ver INSTRUCCION.md: no se hace `git commit` salvo pedido explícito).
**Verificado por:** lectura directa de todos los archivos de `Organizador_moodle/` tras aplicar los cambios de esta sesión (`index.html`, `script.js`, `styles.css`, `carnets.js`). La v3 (2026-10-03, commit `1ff425c`) sigue siendo válida como base para todo lo que esta versión no modifica; aquí solo se actualiza lo que cambió.

> **Principio rector de este documento: el código manda.** Si algo que se usaba antes (un `LEEME.txt`, una instrucción `INSTRUCCION_*.md`) no coincide con lo implementado, aquí se describe lo implementado y se señala la diferencia.

---

## 1. Resumen ejecutivo

**Qué es:** app web estática (HTML+CSS+JS puro, sin build ni backend) para que TecnoCleveland (robótica) y Cleveland English Institute (inglés) controlen qué curso modelo de Moodle han copiado a cada colegio, en qué año/grado, cuántas clases tiene subidas, generen usuarios Moodle en bloque y generen carnets de acceso imprimibles.

**Para quién:** dos academias independientes que comparten el mismo código fuente pero nunca ven los datos de la otra. El acceso es por código (no hay usuarios/contraseñas de verdad).

**Cómo se despliega:** Firebase Hosting, proyecto `moodle-organizador` (`.firebaserc`), publicando únicamente la carpeta `Organizador_moodle/` (`firebase.json`). El despliegue es manual (`firebase deploy --only hosting`); esta tarea no lo ejecuta.

**Dónde viven los datos:** exclusivamente en el `localStorage` del navegador de cada usuario, en una clave distinta por academia (`tc_organizador_data` / `cc_organizador_data`). **No hay Firebase Database ni ningún backend.** La única forma de mover datos entre equipos es el archivo de Respaldo (.json) exportado/importado manualmente.

**Las 5 reglas que nunca se deben romper:**
1. `tc_organizador_data` es la clave real de TecnoCleveland en producción — **nunca** cambiarla ni renombrarla.
2. Cualquier cambio al esquema de `data` debe seguir cargando respaldos y `localStorage` antiguos sin `carnetListas`/`carnetOpciones`/`participantes` (ver §4.3, patrón `parsed.x || valorPorDefecto`).
3. Las dos academias deben quedar siempre con datos y catálogos separados: nada de `script.js`, `carnets.js` ni `carnets-pdf.js` debe filtrar datos entre `ACADEMIAS.tecno` y `ACADEMIAS.cleveland`.
4. `carnets-pdf.js` y `stickers/js/stickers.js` son hoy dos copias del mismo motor de PDF (ver §11.1): un cambio de diseño/colores en uno no se refleja en el otro a menos que se edite a mano.
5. Nada de código genera `git push` ni `firebase deploy` automáticamente; esos pasos los ejecuta la persona dueña del repo.

---

## 2. Mapa del código

Carpeta publicada en producción: `Organizador_moodle/`. Todo lo que está fuera de esa carpeta (`stickers/`, `Organizador/`, los `INSTRUCCION_*.md`, este mismo documento) **no se sube a Firebase** porque `firebase.json` declara `"public": "Organizador_moodle"` (no es por la lista `ignore`, es porque Firebase solo mira dentro de esa carpeta).

| Archivo | Líneas (aprox.) | Propósito | Globales / funciones clave que expone | Depende de |
|---|---|---|---|---|
| `academias.js` | 31 | Config multi-academia. Debe cargar **primero**. | `ACADEMIAS`, `getAcademiaActual()`, `ACADEMIA_ACTUAL` | `sessionStorage.tcAcademia` |
| `login.html` | 187 | Pantalla de login, independiente (su propio `<style>`/`<script>` inline). | `USERS`, `doLogin()`, `toggleEye()` | nada (standalone) |
| `index.html` | 831 | Shell de la app: sidebar, las 8 vistas, 4 modales, carga de scripts. | — (solo markup + el loader inline) | todos los `.js`/`.css` siguientes |
| `script.js` | 1624 | Núcleo del organizador: datos, navegación, Colegios, Cursos modelo, Asignaciones, Generador de usuarios, Buscar, Respaldo, Papelera. | `data`, `loadData/saveData`, `showView`, `esc/uid/normalize/slugify`, `ACADEMIA_ACTUAL` (de academias.js) | `academias.js` |
| `carnets-pdf.js` | 180 | Motor de dibujo del carnet en PDF (jsPDF). IIFE aislado. | `window.CarnetsPDF = {buildPDF, gradeLabel, academias, levels, layouts}` | `lib/jspdf.umd.min.js` |
| `carnets.js` | 693 | Vista "Generador de carnets" (los 2 modos + opciones de impresión). IIFE aislado. | `window.Carnets = {init, render, closePreview}` | `script.js` (datos y utilidades globales), `carnets-pdf.js`, `lib/jszip.min.js` |
| `carnets.css` | 198 | Estilos de `#view-carnets`, todo con prefijo `.cn-`. | — | `styles.css` (variables) |
| `styles.css` | 527 | Estilos de toda la app + modo oscuro + variables por academia. | — | — |
| `lib/jspdf.umd.min.js` | 394 | jsPDF 2.5.2, vendored (sin CDN). | `window.jspdf` | — |
| `lib/jszip.min.js` | 9 | JSZip 3.10.1, vendored. | `window.JSZip` | — |
| `lib/xlsx.full.min.js` | 24 | SheetJS (xlsx), vendored. | `window.XLSX` | — |
| `LEEME.txt` | 118 | Manual de usuario final (no técnico). Coincide con el comportamiento actual. | — | — |

**Orden de carga en `index.html`** (obligatorio, no se puede reordenar):
```
academias.js?v=1  →  lib/xlsx.full.min.js  →  lib/jspdf.umd.min.js  →  lib/jszip.min.js
  →  script.js?v=2  →  carnets-pdf.js?v=1  →  carnets.js?v=2
```
`script.js` lee `ACADEMIA_ACTUAL` al vuelo (`const STORAGE_KEY = ACADEMIA_ACTUAL.storageKey;`), por eso `academias.js` tiene que ir antes. `carnets.js` usa funciones globales de `script.js` (`data`, `saveData`, `esc`, `uid`, `showToast`, `extractAnioNum`, `slugify`, `normalize`, `showView`, `todayStr`, `renderTrash`, `updateTrashBadge`) y el objeto `window.CarnetsPDF`, por eso va al final.

**Cache-busting (actualizado 2026-10-04):** `script.js` y `carnets.js` subieron a `?v=2` (se modificaron esta sesión); `styles.css` pasó de sin versión a `?v=2` (también se modificó). `academias.js`, `carnets.css`, `carnets-pdf.js` siguen en `?v=1` (sin cambios). `login.html` y los archivos de `lib/` siguen sin parámetro de versión — sigue siendo una inconsistencia conocida (no es obligatorio versionar todo, solo lo que cambia en cada despliegue), documentada aquí para la próxima vez que se toquen esos archivos. `firebase.json` no define `headers` de caché, así que esto depende del comportamiento por defecto de Firebase Hosting.

**`Organizador/` (fuera de alcance, no tocado):** proyecto distinto y anterior. Usa su propia sesión (`sessionStorage.orgUser`, no `tcUser`/`tcAcademia`), su propio `login.html`/`script.js`/`styles.css`, y un `firebase-config.js` (sugiere que ese proyecto sí usa o usó Firebase real, a diferencia de este). No comparte nada de código con `Organizador_moodle/`. Se confirma lo que decía la instrucción histórica: no tiene relación con esta app.

**`stickers/` (generador de carnets independiente original):** ver §11.1 — es el predecesor de la vista "Generador de carnets" (Modo 1). Sigue existiendo intacto, con su propia selección de academia (`pickAcademy`) y su propia clave de `localStorage` (`cleveland-carnets-lists-<academyId>`), completamente desconectada del organizador. Hoy es funcionalmente redundante frente al Modo 1 del organizador, pero el repo lo conserva a propósito como "respaldo" (así lo pedía la instrucción que lo originó).

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
- `doLogin()` normaliza el código tecleado con `.trim().toLowerCase()` y lo compara contra las claves de `USERS` también en minúsculas (`key.toLowerCase() === code`) → **no distingue mayúsculas ni espacios sobrantes**, tal como describe `LEEME.txt`.
- Si coincide, guarda en `sessionStorage`: `tcUser` (el `nombre`) y `tcAcademia` (`'tecno'` o `'cleveland'`), y redirige a `index.html`.
- Si no coincide, muestra "Código incorrecto. Intenta de nuevo." y selecciona el input.
- Si ya hay `tcUser` en sessionStorage al cargar `login.html`, redirige directo a `index.html` (sin pedir código de nuevo).

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
Esto es lo que resuelve el caso de "sesión antigua" (un `tcUser` guardado por una versión anterior sin `tcAcademia`): si falta cualquiera de las dos claves, limpia ambas y manda a login. `logout()` (en `script.js`) también borra ambas claves.

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
`getAcademiaActual()` cae a `tecno` si `tcAcademia` no está o no coincide con ninguna clave — esto nunca debería pasar en la práctica porque el guardia de §3.2 ya habría mandado a login, pero es el comportamiento real si se invoca a mano.

**Dónde se consume `ACADEMIA_ACTUAL` / `ACADEMIAS`:**
| Campo | Dónde se usa |
|---|---|
| `storageKey` | `script.js`: `const STORAGE_KEY = ACADEMIA_ACTUAL.storageKey;` — única fuente de la clave de `localStorage` |
| `emailDominio` | `script.js`: `generarListaUsuarios()`, `importarCSVArchivo()`, `onGenUsernameEdit()` — para armar `email` |
| `importarCSV` | `script.js`: `applyAcademiaBranding()` muestra/oculta `#gen-import-btn` |
| `idiomaUI` | `carnets.js`: `L()` elige el diccionario `T.es`/`T.en`; también `window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, ...)` para los textos de UI (no del carnet impreso) |
| `idiomaCarnet` | `carnets.js`/`carnets-pdf.js`: idioma impreso en el PDF (Usuario/Clave vs Username/Password, "4to Año" vs "4th Year") |
| `id` | `script.js`: `applyAcademiaBranding()` (rama `esTecno = ACADEMIA_ACTUAL.id === 'tecno'`), `document.body.setAttribute('data-academia', ...)`; `carnets-pdf.js`: `CN_ACADEMIAS[opts.academiaId]` para colores/labels del carnet |
| `nombre`, `subtitulo` | `script.js`: textos del sidebar, `document.title`, tira de bienvenida del Panel |

### 3.4 Catálogo base por academia
`DEFAULT_COLEGIOS` (28 nombres) y `DEFAULT_CURSOS` (17: 7 de media, 10 de primaria) están **hardcodeados en `script.js`**, no en `academias.js`. `freshData()` decide si los usa con una comparación literal:
```js
const esTecno = ACADEMIA_ACTUAL.id === 'tecno';
colegios: esTecno ? DEFAULT_COLEGIOS.map(...) : [],
cursos:   esTecno ? DEFAULT_CURSOS.map(...)   : [],
```
Es decir: **solo Tecno arranca con catálogo precargado; cualquier otra academia (incluida Cleveland) arranca siempre con `colegios: []` y `cursos: []`**, sin excepción y sin que `academias.js` tenga ningún flag para esto — está implícito en el `id === 'tecno'`. Importante para §9(a): agregar una tercera academia con catálogo propio exigiría tocar esta línea de `script.js`, no solo `academias.js`.

`resetCatalogs()` ("Restablecer colegios y cursos modelo" en Respaldo) llama a `freshData()` y solo reemplaza `data.colegios`/`data.cursos`; **no toca** `asignaciones`, `participantes`, `carnetListas` ni `trash`. El texto del botón en pantalla (`reset-catalog-text`) cambia de mensaje según `esTecno` (`applyAcademiaBranding()`), pero el comportamiento del botón es el mismo para ambas academias.

### 3.5 Respaldo (export/import JSON)
- **Exportar** (`exportBackup()`): `{ ...data, _academia: ACADEMIA_ACTUAL.id }` → descarga `respaldo_<academiaId>_<YYYY-MM-DD>.json`.
- **Importar** (`importBackup(event)`):
  1. Valida que `parsed.colegios` y `parsed.cursos` sean arrays (si no, rechaza con "Formato no válido").
  2. Si `parsed._academia` existe y **no coincide** con `ACADEMIA_ACTUAL.id`, pide confirmación explícita ("Este respaldo es de otra academia. ¿Importar de todos modos?"). Si el respaldo es viejo y no trae `_academia`, no pregunta esto.
  3. Pide una segunda confirmación genérica ("Esto reemplazará todos los datos actuales...").
  4. Reconstruye `data` con el mismo patrón de *defaults* que `loadData()` (ver §4.3) — por eso un respaldo viejo sin `carnetListas`/`carnetOpciones`/`participantes` igual carga bien.
- **No hay ninguna validación de que el respaldo importado sea compatible "estructuralmente" más allá de que `colegios`/`cursos` sean arrays** — un JSON con `colegios: []` pero `asignaciones` llenas de IDs inexistentes se importaría sin error (las vistas simplemente mostrarían "colegio eliminado" donde corresponda, como ya hacen con datos borrados).

### 3.6 Marca visual dinámica
- `document.body.setAttribute('data-academia', ACADEMIA_ACTUAL.id)` (en `applyAcademiaBranding()`, llamada una vez en `DOMContentLoaded`).
- `styles.css` sobrescribe variables de acento solo para `cleveland`, en claro y oscuro:
  ```css
  body[data-academia="cleveland"]       { --accent:#1280B3; --accent-light:#E3F3FA; --accent2:#7EBD3E; --accent2-light:#EDF6E3; }
  body.dark[data-academia="cleveland"]  { --accent:#25A5DE; --accent-light:#15283A; --accent2:#7EBD3E; --accent2-light:#1C2A14; }
  ```
  Para `tecno` no hay bloque `[data-academia="tecno"]`: usa directamente los valores base de `:root`/`body.dark` (azul `#1E5FBF`/`#4C8DFF`, naranja `#E8912B`/`#F0A94E`). Esto es intencional: Tecno "se ve exactamente igual que hoy", como pedía la instrucción histórica.
- Textos/iconos que cambian por academia (todos resueltos en `applyAcademiaBranding()`, `script.js`): logo del sidebar (🤖 vs 🪪), nombre con `<span class="logo-accent">` partido distinto ("Tecno**Cleveland**" vs "Cleveland **English**"), subtítulo, pie del sidebar, frase + emojis de la tira de bienvenida del Panel (🤖⚙️🔧 vs 🪪📘🌎), texto de "de 28 registrados" bajo el stat de Colegios, visibilidad del botón "Importar CSV", y el texto de "Restablecer catálogo base".
- El loader (`#app-loader`) de `index.html` **no** cambia de color por academia; solo cambia claro/oscuro vía la clase `loader-dark` (leída de `localStorage.tc_dark` antes de que cargue `script.js`, para evitar parpadeo).

---

## 4. Modelo de datos real

### 4.1 Esquema completo
Objeto global `data` (vive solo en memoria + se serializa a `localStorage[STORAGE_KEY]`):

```jsonc
{
  "colegios": [
    { "id": "idabc123xy", "nombre": "Alejandro Humboldt" }
  ],
  "cursos": [
    { "id": "idc8f2k0qz", "nombre": "Robotica 1", "nivel": "media" }      // nivel: "media" | "primaria"
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
    "colegios": [ /* objetos de colegio completos, tal cual estaban */ ],
    "cursos": [ /* objetos de curso modelo completos */ ],
    "asignaciones": [ /* objetos de asignación completos */ ],
    "participantes": [
      {
        "id": "idtr1a2sh3", "colegioId": "idabc123xy", "cursoId": "idc8f2k0qz",
        "anio": "1er Año", "grupo": "", "fechaEliminacion": "2026-10-01",
        "estudiantes": [ /* array de participantes de esa lista, objetos completos */ ]
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

**Novedades de esta sesión (2026-10-04) — esquema ampliado:**
- `trash.estudiantes[]`: estudiantes individuales eliminados desde la vista editable (Ver/Editar) del Generador de usuarios (§6.3). Cada entrada envuelve el objeto `participante` completo tal cual estaba, más `id` y `fechaEliminacion` propios de la entrada de papelera.
- `trash.carnetListas[]`: listas del Generador de carnets Modo 1 eliminadas (`deleteManualList`, "Eliminar todas las listas" — una entrada por lista) o pisadas por guardar otra lista con el mismo `nivel+grado+sección`. Es el mismo objeto de lista (`id`, `nivel`, `grado`, `seccion`, `clave`, `estudiantes`) con `fechaEliminacion` agregado. **Esto resuelve lo que la v3 documentaba en §11.2** (ver §11.2 más abajo, ahora marcado como resuelto).
- `trash.participantes[]` (listas de participantes del Generador de usuarios) ahora también recibe una entrada cuando `guardarListaUsuarios()` **sobrescribe** una lista existente del mismo `colegioId+cursoId+anio+group1` (antes, la versión pisada se descartaba sin pasar por Papelera).

**Notas de fidelidad al código que siguen vigentes de la v3:**
- `trash.participantes` no son participantes individuales sueltos: son **lotes/listas completas** eliminadas con `eliminarGenLista()` o pisadas al guardar (un registro por año+grupo, con su propio `id`, `fechaEliminacion` y el array `estudiantes` dentro). Restaurar (`restoreGenLista`) hace `data.participantes.push(...item.estudiantes)`.
- `asignaciones.clases` y `carnetListas.grado` se guardan como **número** (`Number(...)`), no como string.
- `carnetListas[].estudiantes[].usuario/apellidos/nombres` — sin `clave` individual; la clave es una sola por lista (`carnetListas[].clave`), compartida por todos los estudiantes de esa lista. Esto contrasta con el Modo 2 (participantes), donde cada estudiante **sí** tiene su propia clave (`participantes[].password`), y por eso `toCanonicalStudents()` en `carnets.js` resuelve la clave así: `s.clave !== undefined ? s.clave : list.clave` (los "resultados efímeros" del modo 2 sí llevan `clave` por estudiante; las listas guardadas del modo 1 no).

### 4.2 Carga, migración y compatibilidad hacia atrás
`loadData()` (`script.js`):
```js
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { data = freshData(); saveData(); return; }
    const parsed = JSON.parse(raw);
    const trash = parsed.trash || {};
    data = {
      colegios: parsed.colegios || [], cursos: parsed.cursos || [],
      asignaciones: parsed.asignaciones || [], participantes: parsed.participantes || [],
      carnetListas: parsed.carnetListas || [],
      carnetOpciones: { ...CARNET_OPCIONES_DEFAULT, ...(parsed.carnetOpciones || {}) },
      trash: {
        colegios: trash.colegios || [], cursos: trash.cursos || [],
        asignaciones: trash.asignaciones || [], participantes: trash.participantes || [],
        estudiantes: trash.estudiantes || [], carnetListas: trash.carnetListas || []
      }
    };
  } catch (e) { console.error(...); data = freshData(); saveData(); }
}
```
El patrón de compatibilidad es: **cada clave nueva se lee con `|| valorPorDefecto` (arrays) o `{...DEFAULT, ...parsed}` (objetos)**. Un `localStorage` o respaldo de antes de que existiera `carnetListas`/`carnetOpciones`/`participantes`/`trash.estudiantes`/`trash.carnetListas` carga sin romperse, exactamente como exige la instrucción histórica. `importBackup()` repite el mismo patrón línea por línea (no está factorizado en una función compartida — si se agrega una clave nueva al esquema, hay que tocar **ambas** funciones, más `freshData()`, más el ejemplo de este documento). Esta sesión no tuvo Node.js disponible en el entorno para correr un script de verificación (ver reporte de cierre); se verificó por lectura directa de `loadData()`/`importBackup()` que `trash.estudiantes || []` y `trash.carnetListas || []` cubren el caso de un JSON antiguo sin esas claves.

### 4.3 Flujo de datos
1. **Carga:** `DOMContentLoaded` → `loadData()` → `applyAcademiaBranding()` → `renderAll()` → `Carnets.init()` (si existe `window.Carnets`).
2. **Modificación:** cada acción de UI (guardar colegio, registrar asignación, generar usuarios, guardar lista de carnets…) muta el objeto `data` en memoria y llama a `saveData()` de inmediato (no hay "guardado diferido" ni debounce).
3. **Guardado:** `saveData()` hace `localStorage.setItem(STORAGE_KEY, JSON.stringify(data))`, envuelto en `try/catch` (si falla, p. ej. por cuota llena, muestra un toast de advertencia pero no revierte el cambio en memoria).
4. **Respaldo:** `exportBackup()` descarga el `data` actual + `_academia`. `importBackup()` reemplaza `data` completo, guarda, y vuelve a renderizar todo.
5. **Restauración desde Papelera:** `restore*()` saca el ítem de `data.trash.*` y lo vuelve a meter en el array activo correspondiente; `permaDelete*()` simplemente lo quita de `data.trash.*` sin posibilidad de recuperarlo.

---

## 5. Vistas e interfaz

### 5.1 Sidebar (orden real en `index.html`)
Sección **Programas**: Panel (`dashboard`) · Colegios (`colegios`) · Generador de usuarios (`generador`) · Generador de carnets (`carnets`) · Cursos modelo (`cursos`) · Buscar (`buscar`).
Sección **Sistema**: Respaldo (`respaldo`) · Papelera (`trash`, con badge de conteo).
Cada botón: `<button class="nav-item" onclick="showView('id')" data-view="id">`.

`showView(id)` (`script.js`) centraliza el cambio de vista: oculta todas las `.view`, muestra `#view-<id>`, marca el `.nav-item` activo, y dispara el render específico de esa vista con una cadena de `if`:
```js
if (id === 'colegios')  { closeCollegeDetail(); renderColegios(); }
if (id === 'generador') renderGenerador();
if (id === 'carnets' && window.Carnets?.render) window.Carnets.render();
if (id === 'cursos')    renderCursos();
if (id === 'trash')     renderTrash();
if (id === 'dashboard') renderDashboard();
```
**Para agregar una vista nueva hay que tocar esta cadena** (ver §9b). El array `NAV_VIEWS = ['dashboard','colegios','generador','cursos','buscar','respaldo','trash']` (línea 245 de `script.js`) está declarado pero **no se usa en ningún otro lugar del código** (ni siquiera incluye `'carnets'`) — es código muerto/obsoleto, ver §11.3.

### 5.2 Qué hace cada vista (verificado contra el código)
- **Panel (`dashboard`):** saludo con el nombre de sesión, fecha de hoy, botón "+ Registrar copia de curso" (abre el modal de asignación). 4 tarjetas de estadística (colegios activos, cursos copiados, clases subidas, promedio clases/curso). Barra comparativa Media vs Primaria. Lista de los 6 últimos cursos copiados (ordenados por `fecha` descendente).
- **Colegios (`colegios`):** grilla de tarjetas filtrable por nombre + tarjeta "+ Nuevo colegio". Click en una tarjeta abre el **detalle** del colegio: insignias de nivel, dos tablas (Media/Primaria) de cursos copiados con editar/eliminar —cada una dentro de un **acordeón** (`col-cursos-media`/`col-cursos-primaria`, ver §6.4) con el conteo en la cabecera—, botón "+ Agregar año/curso", botón "✎ Editar colegio", y la tarjeta de **Participantes**: selector Año/Grado **agrupado Media/Primaria** (misma estructura que `fillGenAnioSelect()`, solo con años que tienen participantes) → grupo → buscador (usuario/nombres/apellidos/correo, sin distinguir mayúsculas ni acentos) → título con el nivel ("Educación Media · 4to Año · Grupo A") → tabla **paginada de 20 en 20** estilo Moodle (`PARTICIPANTES_POR_PAGINA`, ver §6.4) → copiar al portapapeles (por fila) y botón "⬇ Descargar XLSX" (ambos sobre la selección completa de año/grupo, sin paginar ni filtrar por búsqueda — comportamiento preexistente, no cambiado).
- **Generador de usuarios (`generador`):** elegir Colegio → Año/Grado (solo años con asignación existente) → pegar Apellidos/Nombres (una columna cada uno) → Contraseña/Ciudad/Grupo opcional → "Generar lista" (vista previa editable, celda por celda, con un **acordeón** `gen-editor` que retrae solo la tabla) → "Guardar lista" o "⬇ Descargar CSV". Cada fila de la vista previa tiene un botón 🗑 para eliminar ese estudiante individualmente (ver §6.3). Debajo, resumen de "Años ya generados" separado en dos **acordeones** (`gen-media`/`gen-primaria`, con el conteo de listas en la cabecera) con Ver/Editar, descargar CSV y eliminar por año+grupo. El botón "⬆ Importar CSV" solo aparece si `ACADEMIA_ACTUAL.importarCSV` es `true` (hoy solo Tecno).
- **Generador de carnets (`carnets`):** ver §7 completa.
- **Cursos modelo (`cursos`):** pestañas Media/Primaria, tabla con nombre, colegios que lo usan, promedio de clases subidas, editar/eliminar. Botón "+ Nuevo curso modelo".
- **Buscar (`buscar`):** input con sugerencias en vivo (normaliza acentos con `normalize()`), resumen del colegio elegido (insignias de nivel, años trabajados, clases subidas) y tabla detalle. Botón "⬇ Exportar reporte completo (CSV)" exporta **todas** las asignaciones de todos los colegios (no solo el buscado). **Bug corregido en 2026-10-04** (ver reporte de cierre de esa sesión): las sugerencias nunca aparecían porque `onSearchInput()` mostraba el desplegable con `box.style.display = ''`, lo que solo limpia el estilo inline — como `styles.css` define `.search-suggestions { display: none; }` a nivel de clase, el elemento volvía a caer en ese `display:none` de la hoja de estilos. Ahora se usa `box.style.display = 'block'`. De paso se agregó: Enter toma la primera sugerencia, una coincidencia exacta con un único colegio carga el resumen directo sin desplegable, y un `renderBuscar()` nuevo (enganchado a `showView('buscar')` y a `renderAll()`) deja el mensaje correcto ("Aún no hay colegios registrados" vs. el texto de "empieza a escribir") según si la academia tiene colegios o no.
- **Respaldo (`respaldo`):** exportar/importar JSON, y "Restablecer colegios y cursos modelo" (ver §3.4). Desde 2026-10-04, los colegios/cursos reemplazados por el restablecimiento van a la Papelera en vez de perderse (ver §6.4).
- **Papelera (`trash`):** 6 secciones (colegios, cursos copiados, listas de participantes, **estudiantes eliminados**, **listas de carnets eliminadas**, cursos modelo eliminados), cada una con Restaurar / Eliminar para siempre. Botón global "Vaciar papelera" y el badge del sidebar cubren las 6 secciones.

---

## 6. Generador de usuarios — reglas de negocio verificadas

### 6.1 Numeración de usuarios ("Generar lista")
En `generarListaUsuarios()` (`script.js`):
1. El **prefijo** del usuario sale del `nombreCorto` de la asignación elegida, tomando todo lo que va **después del último `-`** (p. ej. `nombreCorto = "1styear-ah"` → `prefix = "ah"`). Si el `nombreCorto` no tiene `-` o termina en `-`, se rechaza con "Este curso no tiene un nombre corto válido para generar usuarios."
2. **Dígitos del número:** `nivel === 'primaria' ? 3 : 4` (3 dígitos en Primaria, 4 en Media).
3. **Pool de numeración:** se recorre `data.participantes` filtrando por `colegioId` igual **y** por nivel igual (`p.nivel || curso del participante`), y de esos se parsea el `username` con `parseUsername()` (regex `^([a-zA-Z]+)(\d+)$`); si el prefijo coincide (sin distinguir mayúsculas) con el prefijo actual, se guarda el máximo número visto. El siguiente usuario empieza en `maxNum + 1`. **Esto hace que el pool sea efectivamente independiente por colegio + prefijo** (y el prefijo normalmente es distinto por curso corto, así que en la práctica también es independiente por curso/nivel), no solo por nivel como una lectura superficial podría sugerir.
4. `email = \`${username}@${ACADEMIA_ACTUAL.emailDominio}\`` — por eso Tecno genera `...@tecno.com` y Cleveland `...@cleve.com`.
5. `firstname = "<username> <nombres>"`, `lastname = apellidos` — convención de Moodle bulk-upload (el nombre de usuario se antepone al nombre real en la columna `firstname`).
6. País fijo `"Venezuela"`; `role1: 'student'`; `enrolperiod1: '365d'`; `suspended: '0'`.
7. Al editar el usuario en la vista previa (`onGenUsernameEdit`), se recalculan `firstname` y `email` a partir del nuevo username, pero **no** se vuelve a validar contra el pool (se puede crear manualmente una colisión de username desde la vista previa).

### 6.2 Importar CSV (`importarCSVArchivo`, solo si `importarCSV: true`)
- Espera columnas `First name`, `Last name` (obligatorias) y opcionalmente `Email address`, `Groups` — formato típico de exportación de usuarios de Moodle.
- El `username` se toma como **la primera palabra de `First name`** (antes del primer espacio). Si ese texto no matchea `^[a-zA-Z]+\d+$`, intenta usar la parte antes del `@` del email como username.
- **Diferencia importante con "Generar lista": el CSV importado NO pasa por el pool de numeración** — el username queda exactamente como viene en el archivo (o derivado del email), así que usuarios importados y usuarios generados manualmente para el mismo curso pueden tener numeración no contigua o formatos distintos.
- `email` se **recalcula siempre** como `${username}@${ACADEMIA_ACTUAL.emailDominio}` (ignora el email del CSV salvo para derivar el username si hace falta).
- El grupo (`group1`) sale de la columna `Groups` del CSV tal cual, sin procesar.

### 6.3 Guardado de listas (`guardarListaUsuarios`)
Si ya existe una lista para el mismo `colegioId + cursoId + anio + group1`, pide confirmación y la **reemplaza** (`data.participantes` se filtra para quitar ese grupo antes de volver a insertar). Las listas nuevas quedan con `fecha: todayStr()`. **Desde 2026-10-04**, la versión que se reemplaza ya no se descarta: se empaqueta como una entrada de `trash.participantes` (mismo formato que `eliminarGenLista()`) antes de filtrarla, así que una sobrescritura accidental también se puede restaurar desde la Papelera.

### 6.4 Eliminar un estudiante individual y "Reestructurar" (nuevo, 2026-10-04)
En la vista editable (Ver/Editar) de una lista, cada fila tiene un botón 🗑 que abre el modal `#modal-eliminar-estudiante` con dos opciones:
- **Conservar:** quita solo esa fila; los demás usernames no cambian (queda un hueco en la numeración).
- **Reestructurar:** además de quitar la fila, renumera consecutivamente a los participantes **posteriores** de la misma lista y mismo prefijo, empezando por el número del eliminado. Implementado como función pura `calcularReestructura(lista, eliminadoUsername, digits, usernamesOcupados)` (`script.js`): ordena por número, reasigna en orden ascendente evitando colisiones con `usernamesOcupados` (usernames de OTRAS listas/grupos del mismo colegio+prefijo — el llamador excluye explícitamente a toda la lista actual, porque sus propios números están a punto de desplazarse), y conserva los dígitos (3 primaria / 4 media). Se deshabilita (con motivo visible) si el username del eliminado no tiene el formato `letras+números`, o si no hay nadie después de él en la lista.
- Comportamiento según el origen: si la lista ya estaba guardada (`genPreviewSaved === true`, fijado por `verEditarGenYear()`/`guardarListaUsuarios()`), el estudiante se quita de inmediato de `data.participantes` y va a `trash.estudiantes`, y los usernames reasignados se actualizan tanto ahí como en la copia en pantalla (`genPreviewRows`). Si la lista es recién generada y aún no guardada (`genPreviewSaved === false`), todo ocurre solo en `genPreviewRows` (nunca existió en `data`, por eso no pasa por Papelera). Si se elimina al último estudiante de una lista guardada, la lista desaparece de "Años ya generados" y el editor se cierra con un toast.
- Verificado por lectura/trace manual del código (sin Node.js disponible en este entorno, ver reporte de cierre) contra el ejemplo de aceptación: lista `ah0001…ah0010`, eliminar `ah0004` con Reestructurar deja `ah0001…ah0009` (antiguos `ah0005→ah0004 … ah0010→ah0009`), igual que pide la instrucción.

### 6.5 Acordeones y paginación reutilizables (nuevo, 2026-10-04)
- **Acordeón genérico** (`uiAcordeones` en `script.js`, clases `.acc-*` en `styles.css`): estado abierto/cerrado guardado en memoria por clave (`accOpen(key)`, `toggleAcordeon(key)`, `applyAccState(key)`), no en `data` ni `localStorage` — por diseño, ya que las vistas se re-renderizan con `innerHTML`. Por defecto todo empieza abierto. Usado en 5 lugares: "Años ya generados" (`gen-media`/`gen-primaria`, con el conteo de listas en el título), la vista editable (`gen-editor`, retrae solo la tabla y deja visibles el título y los botones de acción) y "Cursos copiados" del detalle de colegio (`col-cursos-media`/`col-cursos-primaria`, con el conteo de cursos en el título).
- **Paginación genérica** (`paginaInfo(total, page, perPage)`, `paginaBotones(page, totalPages)`, `renderPaginacionHTML(...)` en `script.js`): usada hoy solo en la tabla de Participantes de Colegios (`PARTICIPANTES_POR_PAGINA = 20`, estado `cdPartPage`). `paginaInfo` clampa la página a un rango válido y calcula "Mostrando X–Y de Z"; `paginaBotones` devuelve primera, última y la actual ±2 con "…" en los huecos, igual que pide la instrucción.

---

## 7. Generador de carnets

### 7.1 Arquitectura e inicialización
- `carnets-pdf.js` es un IIFE que solo expone `window.CarnetsPDF`. No depende de `script.js`; solo de `window.jspdf`.
- `carnets.js` es un IIFE que solo expone `window.Carnets = { init, render, closePreview }`. Se engancha a `showView('carnets')` vía `if (id === 'carnets' && window.Carnets?.render) window.Carnets.render();` en `script.js`. `window.Carnets.init()` se llama **una sola vez**, en `DOMContentLoaded` de `script.js` (`if (window.Carnets && typeof window.Carnets.init === 'function') window.Carnets.init();`), después de `renderAll()`.
- Aislamiento de colisiones: todo el CSS de `carnets.css` está prefijado `.cn-` y anidado bajo `#view-carnets`; todo el JS vive dentro de las dos IIFE — no hay variables sueltas en `window` salvo los dos objetos mencionados.

### 7.2 Persistencia
- **Modo 1 (listas manuales):** se guardan en `data.carnetListas` (parte del mismo objeto `data` del organizador) → **sí** se incluyen en el Respaldo, **sí** respetan `STORAGE_KEY` por academia.
- **Opciones de impresión** (`layout`, `url`, `upper`): `data.carnetOpciones`, también dentro de `data` → también van en el Respaldo.
- **Modo 2 (desde participantes):** los resultados (`pResultLists`) son **efímeros**, viven solo en una variable de módulo (`let pResultLists = []`) y se recalculan cada vez que se pulsa "Generar carnets" leyendo `data.participantes` en vivo. No se guarda nada nuevo en `data`.

### 7.3 Modo 1 — Crear desde cero
- Selector de nivel (Media 1º–5º año / Primaria 1º–6º grado) → Año/Grado → Sección opcional (se guarda en mayúsculas, `toLocaleUpperCase()`) → Clave única para toda la lista → 3 cajas de texto pegables (Usuario/Apellidos/Nombres).
- `smartPasteManual()`: si el texto pegado en la primera caja contiene tabulaciones, se interpreta como columnas copiadas de Excel/Sheets y se reparte automáticamente entre las cajas a su derecha.
- Validaciones antes de guardar (`saveManualList`): grado obligatorio, clave obligatoria, al menos una línea, **las 3 columnas deben tener el mismo número de líneas**, y ninguna línea puede tener un campo vacío (se listan los números de línea afectados).
- Si ya existe una lista con el mismo `nivel+grado+seccion`, pide confirmar reemplazo.
- Las listas se agrupan por `nivel+grado` con `groupByGrade()`, **conservando el orden de guardado dentro del grado** (no se reordenan alfabéticamente por sección).
- Acciones disponibles: vista previa y PDF por grado completo (`gradeJob`) o por lista/sección individual (`listJob`), editar, eliminar (con confirmación), ZIP de todos los grados, "Eliminar todas las listas".
- **Desde 2026-10-04, sí pasan por Papelera** (`trash.carnetListas`, ver §4.1 y §6.5): `deleteManualList()`, "Eliminar todas las listas" (crea **una entrada por lista**) y el reemplazo por sobrescritura en `saveManualList()` (misma `nivel+grado+sección`) empaquetan la lista con `fechaEliminacion` antes de quitarla de `data.carnetListas`. Esto resuelve lo que la v3 documentaba en §11.2 (ver nota ahí). Restaurar (`restoreCarnetLista()`, en `script.js`) pide confirmación si ya existe una lista con el mismo `nivel+grado+sección` (la actual se manda a Papelera) y genera un `id` nuevo si el original ya está en uso.

### 7.4 Modo 2 — Desde participantes de un colegio
- `computeParticipantGroups(colegioId)` agrupa `data.participantes` por clave `cursoId + '|' + anio + '|' + (group1||'')`.
- **Nivel:** se toma del curso modelo de cada grupo (`cursoMap[p.cursoId].nivel`), igual que en todo el resto del organizador.
- **Número de año/grado:** `extractAnioNum(anio)` — regex `\d+` sobre el string del año (tolera "1er Año", "4to Grado", cualquier texto con un número). Si no hay ningún número, o el número excede el máximo del nivel (5 para media, 6 para primaria, definidos en `CarnetsPDF.levels`), esa lista **no se aborta todo el proceso**: se omite y se agrega a un array de avisos ("No se pudo interpretar el año de: …") que se muestra en pantalla.
- **"Sección a imprimir" (valor por defecto):** `(g.grupo && g.grupo.length <= 3) ? g.grupo.toLocaleUpperCase() : ''` — es decir, el `group1` original solo se usa como sección sugerida si mide 3 caracteres o menos (p. ej. "A", "B1"); si es un texto largo tipo "2nd grade" importado de otra plataforma, el campo queda vacío y hay que escribirlo a mano. El campo es editable antes de generar.
- **Mapeo por estudiante:** nombre impreso = `nombres + ' ' + apellidos` (con la opción de mayúsculas aplicada), usuario = `username` tal cual está guardado, **clave = el `password` propio de cada participante** (no una clave global de la lista, a diferencia del Modo 1).
- Resultado: mismo formato de presentación que el Modo 1 (agrupado por grado, PDF por grado/lista, vista previa, ZIP), pero sin edición/eliminación (es una vista de solo lectura sobre datos que viven en Participantes).

### 7.5 Motor de PDF (`carnets-pdf.js`)
- **Página:** tamaño carta en mm: `{ w: 215.9, h: 279.4, mx: 10, top: 9, bottom: 12 }`.
- **Layouts:** `big` = 2×7 (14 por página), `gapX 5 / gapY 4`; `compact` = 3×8 (24 por página), `gapX 4 / gapY 3.5`.
- **Proporciones del carnet** (dentro de `drawSticker`, fracciones de la altura `h` de cada tarjeta): cabecera de color `hh = h*0.26`, bloque de nombre `nh = h*0.28`, pie `fh = h*0.13`, bloque de credenciales = el resto (`credH = h - hh - nh - fh`). Radio de esquina `r = 2.6mm`.
- **Colores por academia** (`CN_ACADEMIAS`, duplicado de `stickers/js/stickers.js`):
  - `tecno`: primario `#EA5A1E`, secundario `#84BC24`, franja `['#976FB0','#3A6BB5','#EA5A1E','#84BC24']`, labels `USUARIO`/`CLAVE`/`Sección`.
  - `cleveland`: primario `#25A5DE`, secundario `#7EBD3E`, franja `['#25A5DE','#7EBD3E']`, labels `USERNAME`/`PASSWORD`/`Section`.
  - Si `opts.academiaId` no coincide con ninguna clave de `CN_ACADEMIAS`, `buildPDF()` cae a `tecno` por defecto (`const base = CN_ACADEMIAS[opts.academiaId] || CN_ACADEMIAS.tecno;`).
- **Ordinales:** `ORDINALS.es = {1:'1er',2:'2do',3:'3er',4:'4to',5:'5to',6:'6to'}`, `ORDINALS.en = {1:'1st',...,6:'6th'}`. `gradeLabel()` compone `"<ordinal> <Año|Grado|Year|Grade>"`.
- **Sanitización de texto (`clean()`):** jsPDF con fuentes estándar solo entiende Latin-1 (código ≤ 255). `clean()` deja pasar tal cual cualquier carácter ≤ 255 (esto **incluye** á é í ó ú ñ Á…Ñ, que están en el rango Latin-1 Supplement) y para lo que esté por encima intenta la descomposición NFD y se queda con el primer carácter si también es ≤255; si ni eso funciona, lo reemplaza por `'?'`. **Consecuencia real:** acentos y eñe español se imprimen bien; lo que se rompe (se convierte en `?`) son comillas tipográficas, guiones largos/en-dash y emoji que a veces trae el texto pegado desde Word.
- **Nombre de archivo PDF/ZIP:** `"<prefijo>_<academia-slug>_<Media|Primaria>_<grado-slug>[_Seccion-X].pdf"`, con `prefijo = 'Carnets'` (es) o `'ID-Cards'` (en) según `ACADEMIA_ACTUAL.idiomaCarnet`. El ZIP se llama `"<prefijo>_<academia-slug>.zip"`.
- **Pie de página:** `"<Nombre academia> · <grado/sección> · <página>/<total>"`, en gris claro, tamaño 6.5pt.

### 7.6 Textos de interfaz (i18n de la vista, no del carnet)
`carnets.js` tiene su propio diccionario `T = { es: {...}, en: {...} }` con ~40 claves (textos de botones, mensajes de error, confirmaciones). `L()` elige el diccionario según `ACADEMIA_ACTUAL.idiomaUI` (hoy `'es'` para ambas academias, así que en la práctica siempre se usa `T.es`; `T.en` existe y está completo pero no se usa a menos que se cambie `idiomaUI` de Cleveland a `'en'` en `academias.js`). Esto es **independiente** de `idiomaCarnet`, que solo afecta el PDF.

### 7.7 Escape de HTML (verificación puntual, sin corregir nada)
Se revisaron los puntos donde `carnets.js` y `script.js` insertan datos de estudiantes/colegios/cursos en el DOM vía `innerHTML`/template strings: en ambos archivos, el patrón consistente es envolver cada valor dinámico en `esc()` (`script.js`, HTML-escape de `& < > " '`) antes de interpolarlo — incluidos nombres de colegio/curso, usuarios, apellidos, nombres, grupos y secciones. Para los `onclick` que necesitan pasar texto libre (año, grupo, sección) se usa el patrón `data-*` + `this.dataset.x` en vez de interpolar el valor directamente dentro del atributo `onclick`, evitando el riesgo de que una comilla en esos campos rompa el HTML. **No se encontró ningún punto de datos de estudiantes sin escapar** en esta pasada. (Nota: los textos que sí van *dentro del PDF* vía `clean()` no necesitan HTML-escape porque no se renderizan como HTML.)

---

## 8. Despliegue

### 8.1 Firebase Hosting
`firebase.json`:
```json
{
  "hosting": {
    "public": "Organizador_moodle",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```
No hay bloque `headers` (sin reglas de caché explícitas) ni `rewrites`/`redirects`. `.firebaserc`:
```json
{ "projects": { "default": "moodle-organizador" } }
```
**Qué se publica:** únicamente el contenido de `Organizador_moodle/` (por el valor de `public`, no por `ignore`). `stickers/`, `Organizador/`, los `INSTRUCCION_*.md` y este documento **nunca llegan a Firebase** porque están fuera de esa carpeta.

### 8.2 Versionado de assets
Ver tabla de §2 — inconsistente: solo 4 de los ~10 archivos estáticos llevan `?v=`.

### 8.3 Pasos manuales (no automatizados, no se ejecutan desde esta tarea)
`git push` y `firebase deploy --only hosting` los ejecuta la persona dueña del repo.

---

## 9. Guía "cómo se hace…"

**a) Agregar una academia nueva**
1. `academias.js`: agregar una entrada a `ACADEMIAS` con `id`, `nombre`, `subtitulo`, `storageKey` (nueva y única — nunca reutilizar una existente), `emailDominio`, `importarCSV`, `idiomaCarnet`, `idiomaUI`.
2. `login.html`: agregar código(s) a `USERS` con `academia: '<nuevoId>'`.
3. `carnets-pdf.js`: agregar una entrada a `CN_ACADEMIAS` con `colors` (`primary`/`secondary`/`stripe`) y `labels` (`user`/`pass`/`section`). **Si se omite, el PDF de esa academia saldrá con los colores de Tecno** (fallback silencioso).
4. `styles.css`: agregar un bloque `body[data-academia="<nuevoId>"]` (y su versión `body.dark[data-academia="<nuevoId>"]`) sobrescribiendo `--accent`/`--accent-light`/`--accent2`/`--accent2-light`.
5. Decidir si la nueva academia necesita catálogo precargado: hoy `freshData()` en `script.js` usa `ACADEMIA_ACTUAL.id === 'tecno'` como única condición — una tercera academia arrancará **vacía** a menos que generalices esa condición (por ejemplo agregando un flag `catalogoBase: boolean` a `ACADEMIAS` y leyendo `ACADEMIA_ACTUAL.catalogoBase` ahí).
6. `script.js` → `applyAcademiaBranding()`: hoy es un `if/else` binario (`esTecno`); para una tercera marca distinta (ícono, textos, mensajes) hay que extender esa función más allá de la bifurcación actual.

**b) Agregar una vista nueva al sidebar**
1. `index.html`: nuevo `<button class="nav-item" onclick="showView('miVista')" data-view="miVista">` en el sidebar, y un bloque `<div class="view" id="view-miVista">...</div>` dentro de `<main>`.
2. `script.js` → `showView(id)`: agregar `if (id === 'miVista') renderMiVista();` a la cadena existente si la vista necesita recalcular algo cada vez que se entra.
3. Si la vista tiene lógica propia no trivial, seguir el patrón de `carnets.js`: un IIFE que expone `window.MiModulo = { init, render }`, cargado al final de `index.html`, con `init()` llamado una vez en el `DOMContentLoaded` de `script.js` y `render()` llamado desde `showView()`.
4. (Opcional, hoy no se usa en ningún lado) actualizar `NAV_VIEWS` si en el futuro se decide darle algún uso real.

**c) Agregar un código de acceso**
Editar `USERS` en `login.html`: `'codigo': { nombre: 'Nombre', academia: 'tecno'|'cleveland' }`. No se necesita tocar nada más (la comparación case-insensitive ya está resuelta en `doLogin()`).

**d) Cambiar los colores/diseño del carnet**
Editar `CN_ACADEMIAS[id].colors`/`.labels` en `carnets-pdf.js`. **Recordar que `stickers/js/stickers.js` tiene una copia separada de estos mismos valores** (`ACADEMIES`) — si `stickers/` sigue en uso, hay que replicar el cambio ahí también a mano (ver §11.1).

**e) Cambiar las medidas del PDF**
Editar `PAGE` (márgenes de página) y `LAYOUTS.big`/`LAYOUTS.compact` (columnas/filas/separaciones) en `carnets-pdf.js`, todo en milímetros. Las proporciones internas de cada carnet (alto de cabecera/nombre/pie) son fracciones de `h` dentro de `drawSticker()`, no constantes sueltas — hay que editar esas fracciones si se quiere cambiar el reparto vertical.

**f) Agregar un curso modelo base**
Opción normal (sin tocar código): botón "+ Nuevo curso modelo" en la vista Cursos modelo (`saveCurso()`), que queda guardado en `data.cursos` para esa academia.
Si lo que se quiere es que el curso aparezca desde el primer arranque (antes de que exista `localStorage`) o tras "Restablecer catálogo base" en Tecno: agregar una entrada a `DEFAULT_CURSOS` en `script.js` (`{ nombre: "...", nivel: "media"|"primaria" }`). Recordar que esto solo afecta a Tecno (ver §3.4).

**g) Migrar el esquema de datos sin romper respaldos antiguos**
1. Agregar la clave nueva a `freshData()` con su valor por defecto.
2. Agregar la misma clave, con el mismo patrón `parsed.nuevaClave || default`, en **ambos** lugares: `loadData()` y `importBackup()` (no están factorizados en una función común — hay que editar los dos).
3. `exportBackup()` no necesita cambios: hace `{ ...data, _academia: ... }`, así que cualquier clave nueva de `data` se incluye automáticamente en el respaldo.
4. Actualizar el ejemplo de esquema de este documento (§4.1).

Ejemplo real de este patrón aplicado dos veces en la misma sesión (2026-10-04): `trash.estudiantes` y `trash.carnetListas` (ver §4.1, §4.2). Ambas claves se agregaron a `freshData()`, `loadData()` e `importBackup()` con `trash.x || []`, y no fue necesario tocar `exportBackup()`.

---

## 10. Glosario

| Término | Significado en este código |
|---|---|
| **Academia** | `tecno` o `cleveland`; cada una con su propio `storageKey`, catálogo, idioma de carnet y colores. |
| **Colegio** | Institución cliente donde se dictan los cursos. `data.colegios[]`. |
| **Curso modelo** | Plantilla de curso en Moodle que se copia a cada colegio (p. ej. "Robotica 1"). `data.cursos[]`, con `nivel`. |
| **Nivel** | `'media'` (Educación Media, 1º–5º año) o `'primaria'` (Educación Primaria, 1º–6º grado). |
| **Asignación** | Un registro de "este curso modelo fue copiado a este colegio, en este año/grado, con tantas clases subidas". `data.asignaciones[]`. Es lo que la UI llama "curso copiado". |
| **Año / Grado** | Texto libre (p. ej. "1er Año", "4to Grado") asociado a una asignación; `extractAnioNum()` le extrae el número cuando el código lo necesita (orden, Generador de carnets Modo 2). |
| **Nombre completo / Nombre corto** | Los dos nombres que se le pone al curso copiado en Moodle (`nombreCompleto`, `nombreCorto`); el nombre corto termina en `-<iniciales del colegio>` y de ahí sale el prefijo de usuario. |
| **Participante** | Un estudiante ya generado (con usuario/clave de Moodle) para un colegio+curso+año+grupo. `data.participantes[]`. Alimenta tanto la pestaña Participantes de Colegios como el Modo 2 del Generador de carnets. |
| **Grupo (`group1`)** | Subdivisión opcional dentro de un año/grado (p. ej. "A", o un texto importado como "2nd grade"). Viene del CSV de Moodle o se escribe a mano. |
| **Sección (carnets)** | Lo que se imprime en el carnet como subtítulo del grado (p. ej. "Sección A"). En el Modo 2 se pre-llena desde `group1` solo si mide ≤3 caracteres; si no, queda vacía y es editable. No es necesariamente lo mismo que "grupo". |
| **Lista de carnets** | Un conjunto de estudiantes con una clave en común, para un nivel+grado+sección. `data.carnetListas[]` (Modo 1) o un resultado efímero `pResultLists` (Modo 2). |
| **Pool de numeración** | El rango de números de usuario ya usados para un colegio + prefijo (ver §6.1), de donde se calcula el siguiente número al generar una lista nueva. |
| **Papelera** | `data.trash.{colegios,cursos,asignaciones,participantes,estudiantes,carnetListas}` — todo lo eliminado, incluidas las listas de carnets del Modo 1 y los estudiantes individuales desde 2026-10-04 (ver §4.1, §6.4, §6.5, §7.3; §11.2 queda resuelto). La única eliminación permanente e inmediata sigue siendo "Eliminar para siempre" / "Vaciar papelera" / reemplazo total por "Importar respaldo". |
| **Respaldo** | El archivo `.json` que exporta/importa todo `data` + `_academia`, único mecanismo de portabilidad entre navegadores/equipos. |

---

## 11. Deuda técnica conocida y decisiones asumidas

### 11.0 Sobre el borrador que debía existir
La instrucción de esta tarea asumía que en la raíz del repo ya existía un borrador `documentacion_organizador_moodle.md` (v2) escrito por otra sesión sin acceso al código. **Ese archivo no existe en el repositorio** (se verificó con una búsqueda exhaustiva antes de empezar). Por lo tanto este documento no es una corrección de un borrador: es la primera versión escrita directamente contra el código, y no hay "discrepancias contra el borrador" que reportar porque no hubo borrador con el que comparar.

### 11.1 Duplicación `stickers/` ↔ `carnets-pdf.js`
`carnets-pdf.js` es, función por función, casi una copia literal del motor de PDF de `stickers/js/stickers.js` (`drawSticker`, `clean`, `hex2rgb`, `tint`, `shade`, `PAGE`, `LAYOUTS`, `ORDINALS`, `gradeLabel`), solo renombrado para exponerse como `window.CarnetsPDF` en vez de funciones sueltas, y con los colores/labels de academia repetidos en dos objetos distintos (`CN_ACADEMIAS` en `carnets-pdf.js` vs `ACADEMIES` en `stickers/js/stickers.js`). **Riesgo concreto:** un cambio de diseño, color o medida hecho en uno de los dos archivos no se propaga al otro. `stickers/` sigue existiendo intacto por decisión explícita de una instrucción anterior ("queda como respaldo del generador independiente"), pero su Modo 1 es funcionalmente redundante con el del organizador.

### 11.2 Las listas de carnets (Modo 1) no usan Papelera — **RESUELTO el 2026-10-04**
Hasta el commit `1ff425c`, `deleteManualList()` y "Eliminar todas las listas" quitaban la(s) lista(s) de `data.carnetListas` de forma permanente, sin pasar por `data.trash`. La sesión de 2026-10-04 agregó `trash.carnetListas` (ver §4.1) y conectó las tres rutas de eliminación/sobrescritura (`deleteManualList`, "Eliminar todas las listas", el reemplazo por duplicado en `saveManualList`) a la Papelera, con restauración (`restoreCarnetLista`) incluida. Ver §7.3 y §6.5.

### 11.3 Código muerto / inconsistencias menores encontradas
- `NAV_VIEWS` (`script.js`, línea 245) está declarado pero no se referencia en ningún otro punto del código, y además está incompleto (no incluye `'carnets'`). Es un vestigio de una versión anterior a la vista de carnets.
- `buildUsuariosCSV()` (usada por "Descargar CSV" del Generador de usuarios) **no** escapa comas ni comillas en los campos (simplemente hace `.join(',')`), a diferencia de `exportReportCSV()` (usada por "Buscar" → "Exportar reporte completo"), que sí envuelve cada campo en comillas y escapa comillas internas (`"${String(v).replace(/"/g,'""')}"`). Si un apellido o nombre de estudiante trae una coma, el CSV de usuarios queda con columnas corridas. No se corrigió.
- Ninguno de los dos exportadores de CSV neutraliza campos que empiecen con `=`, `+`, `-` o `@` (riesgo clásico de "CSV injection" si el archivo se abre descuidadamente en Excel con fórmulas habilitadas). Riesgo bajo dado el uso interno de la herramienta, pero queda anotado.
- Orden de años/grados inconsistente entre dos pantallas parecidas: `fillGenAnioSelect()` (selector del Generador de usuarios) ordena Media ascendente pero Primaria **descendente** dentro del mismo `<select>`; `renderGenYearsSummary()` (tabla de "Años ya generados", misma vista) ordena **ambos** niveles descendente. No está claro si es intencional; no se corrigió.
- `freshData()` y `applyAcademiaBranding()` usan literalmente `ACADEMIA_ACTUAL.id === 'tecno'` en vez de leer un flag de `ACADEMIAS`, a pesar de que el comentario de cabecera de `academias.js` sugiere un diseño "todo configurable desde aquí". Agregar una tercera academia obliga a tocar `script.js` en ambos puntos (ver §9a).
- El carnet-PDF `clean()` convierte a `'?'` cualquier carácter fuera de Latin-1 que no tenga una forma NFD ≤255 — en la práctica, comillas tipográficas (" "), guiones en-dash/em-dash y emoji pegados desde Word se imprimen como `?`. Los acentos y la eñe españoles **no** se ven afectados (están dentro de Latin-1).

### 11.4 Decisiones heredadas de instrucciones anteriores, confirmadas vigentes en el código
(documentadas aquí porque el código las implementa exactamente así, sin que quede evidencia de que se haya discutido con la persona dueña del repo más allá de la instrucción original)
- Interfaz del organizador en español para ambas academias (`idiomaUI: 'es'` en ambas); solo el *contenido impreso* de los carnets de Cleveland sale en inglés.
- Cleveland arranca siempre con catálogo vacío (colegios y cursos modelo), nunca con el catálogo de 28/17 de Tecno.
- Cada código de acceso entra solo a su academia; no existe ningún control en la UI para cambiar de academia sin cerrar sesión.
- No hay backend/Firebase Database: todo vive en `localStorage` por navegador y por academia. `firebase-config.js` **no existe** en `Organizador_moodle/` (solo existe en el proyecto no relacionado `Organizador/`), confirmando que esta app nunca se conectó a Firebase más allá del Hosting.

### 11.5 Lo que no se pudo verificar
- No se probó la app en un navegador real durante esta revisión (la instrucción permite pruebas de solo lectura pero no fue necesario abrir un navegador para verificar lo pedido: todo lo listado en el checklist se pudo confirmar leyendo el código fuente). No hay, por tanto, confirmación visual del render de los carnets ni de la UI en modo oscuro/móvil más allá de lo que el CSS/JS deja ver por lectura.
- No se pudo determinar si el campo `notas` de las asignaciones se usa en algún punto fuera de el modal de edición y el CSV de reporte (`exportReportCSV`) — no aparece en ninguna tabla de la UI (ni en el detalle del colegio ni en Buscar). Puede ser intencional (campo "solo para el reporte") o un olvido de UI; no se encontró evidencia concluyente en el código para decidir cuál de las dos.
- **2026-10-04:** tampoco se pudo abrir un navegador real para probar la Fase B–E de esa sesión (acordeones, eliminar/reestructurar estudiante, paginación de Participantes, corrección de Buscar, Papelera ampliada). Se verificó todo por lectura/trace manual del código. Tampoco había Node.js instalado en el entorno de esa sesión, así que `calcularReestructura()`, `paginaInfo()`/`paginaBotones()` y la migración de esquema antiguo en `loadData()`/`importBackup()` se verificaron trazando el código a mano contra los ejemplos de aceptación, no ejecutando un script — ver el reporte de cierre de esa sesión para el detalle de cada traza.

---

## 12. Prompt de arranque para un chat nuevo

```
Voy a pegar completo el archivo documentacion_organizador_moodle.md del repo
Proyectos (carpeta Organizador_moodle/, app TecnoCleveland + Cleveland
English Institute). Lee todo el documento antes de proponer cualquier
cambio: describe el modelo de datos real, las reglas de numeración de
usuarios, el multi-academia y el Generador de carnets, todo verificado
contra el código fuente (no es una especificación aspiracional).

Reglas de trabajo:
- Dame instrucciones para Claude Code en archivos .md (como las
  INSTRUCCION_*.md que ya existen en la raíz del repo), no las ejecutes tú
  directamente salvo que te lo pida explícitamente.
- No hagas git push ni firebase deploy bajo ninguna circunstancia; eso lo
  hago yo manualmente.
- Todo en español (comentarios, mensajes, textos de interfaz), salvo el
  contenido impreso de los carnets de Cleveland English Institute, que va
  en inglés.
- Retrocompatibilidad obligatoria: cualquier cambio al esquema de datos
  (data.colegios/cursos/asignaciones/participantes/carnetListas/
  carnetOpciones/trash) tiene que seguir cargando localStorage y
  respaldos .json antiguos sin romperse (patrón `parsed.x || default`
  en loadData() e importBackup(), más el default en freshData()).
- tc_organizador_data es la clave real de TecnoCleveland en producción:
  no se toca, no se renombra.
- Antes de tocar carnets-pdf.js, revisa si el cambio también aplica a
  stickers/js/stickers.js (son dos copias del mismo motor de PDF).

[Pega aquí el contenido completo de documentacion_organizador_moodle.md]
```
