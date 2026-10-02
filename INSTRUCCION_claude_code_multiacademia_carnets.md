# Instrucción para Claude Code — Organizador Moodle multi-academia + Generador de carnets

> Trabaja en `~/Documentos/GitHub/Proyectos`. La app en producción vive en `Organizador_moodle/` (Firebase Hosting, `public` = `Organizador_moodle`). La carpeta `stickers/` contiene el **Generador de carnets** ya terminado y probado (HTML + CSS + JS plano, jsPDF y JSZip locales). La carpeta `Organizador/` no tiene relación con esta tarea: **no la toques**.
>
> **Regla número 1: no romper nada de lo que ya funciona.** El organizador de TecnoCleveland está en uso con datos reales en `localStorage`.

---

## 1. Contexto y objetivo

La academia tiene **dos plataformas Moodle** y **dos administradores**:

| Academia | Administrador | Código de acceso | Idioma de los carnets |
|---|---|---|---|
| **TecnoCleveland** | Alejandro (dueño del repo) | `2026` (y `1010` Asistente) | Español (Usuario / Clave) |
| **Cleveland English Institute** | Ruben Mogollon | `ruben` | Inglés (Username / Password) |

Quiero **una sola app web** (la actual, `moodle-organizador.web.app`) donde convivan ambas academias:

1. **Multi-academia**: el código de acceso determina a qué academia entra el usuario. Cada academia tiene sus **datos completamente separados** (colegios, cursos modelo, asignaciones, participantes, papelera, carnets). Nadie ve los datos de la otra academia.
2. **Nueva sección "Generador de carnets"** en el menú lateral, que es el generador de `stickers/` integrado como módulo, con **dos modos**: crear listas desde cero (como ya funciona) y **generar carnets a partir de los Participantes de un colegio** (datos que ya existen en la pestaña Participantes de Colegios).

---

## 2. Antes de tocar nada

1. `git status` debe estar limpio. Si no, avísame y detente.
2. Lee completos: `Organizador_moodle/login.html`, `index.html`, `styles.css`, `script.js`, `LEEME.txt`, y de `stickers/`: `index.html`, `css/styles.css`, `js/stickers.js`, `js/app.js`, `LEEME.txt`.
3. Si existe `documentacion_organizador_moodle.md` en el repo, léelo (describe el modelo de datos, la numeración de usuarios y las reglas de negocio).
4. Haz el trabajo en **3 commits locales separados** (ver sección 9) para poder revertir por partes.

---

## 3. Parte A — Capa multi-academia (sin cambios visibles para TecnoCleveland)

### 3.1 Configuración por academia
Crea un objeto de configuración único (en `script.js` o en un archivo nuevo `academias.js` cargado antes de `script.js`):

```js
const ACADEMIAS = {
  tecno: {
    id: 'tecno',
    nombre: 'TecnoCleveland',
    subtitulo: 'Academia de Robótica',
    storageKey: 'tc_organizador_data',   // ¡NO cambiar! es la clave que ya usan los datos reales
    emailDominio: 'tecno.com',
    importarCSV: true,                    // la función "Importar CSV" del Generador de usuarios
    idiomaCarnet: 'es',
    idiomaUI: 'es'
  },
  cleveland: {
    id: 'cleveland',
    nombre: 'Cleveland English Institute',
    subtitulo: 'English Program',
    storageKey: 'cc_organizador_data',
    emailDominio: 'cleve.com',            // visto en el CSV de ejemplo (fm136@cleve.com)
    importarCSV: false,
    idiomaCarnet: 'en',
    idiomaUI: 'es'                        // cambiar a 'en' si se decide interfaz en inglés (ver sección 5.1)
  }
};
```
Reemplaza cualquier valor "quemado" del código que dependa de la academia (el dominio `tecno.com` del email generado, textos "TecnoCleveland", etc.) por lecturas de esta configuración. **La lógica de numeración de usuarios no se toca.**

### 3.2 Login (`login.html`)
- Cambia el objeto `USERS` a este formato y **conserva los códigos actuales**:
  ```js
  const USERS = {
    '2026':  { nombre: 'Administrador',   academia: 'tecno' },
    '1010':  { nombre: 'Asistente',       academia: 'tecno' },
    'ruben': { nombre: 'Ruben Mogollon',  academia: 'cleveland' }
  };
  ```
- Comparación **sin distinguir mayúsculas** y con `trim()` (`Ruben`, `RUBEN` y `ruben` deben entrar).
- Quita `inputmode="numeric"` del input (ahora hay códigos con letras; en móvil debe salir el teclado normal). Mantén el botón de ojo mostrar/ocultar.
- Al entrar correctamente guarda en `sessionStorage`: `tcUser` (nombre, como hoy) y **`tcAcademia`** (`'tecno'` | `'cleveland'`).
- Textos del login neutrales: "Organizador Moodle" y pie "TecnoCleveland · Cleveland English Institute". Mantén exactamente el diseño actual.
- `index.html` / `script.js`: si hay `tcUser` pero **no** hay `tcAcademia` (sesión antigua), limpia la sesión y redirige a `login.html`. Cerrar sesión limpia ambas claves.

### 3.3 Capa de datos
- Busca **todos** los usos de `'tc_organizador_data'` (carga, guardado, respaldo, restauración, "restablecer catálogo base", borrado) y reemplázalos por `ACADEMIA_ACTUAL.storageKey`. Para TecnoCleveland la clave es la misma de siempre → **los datos existentes siguen intactos**.
- Los datos por defecto (28 colegios y 17 cursos modelo) son **solo de `tecno`**. Para `cleveland` los arrays `colegios` y `cursos` arrancan **vacíos** (Ruben cargará los suyos desde la app; "Restablecer catálogo base" en Cleveland solo deja el catálogo vacío, sin borrar asignaciones ni participantes).
- Agrega al objeto de datos la clave nueva **`carnetListas: []`** (listas del modo "desde cero"), inicializada como array vacío si no existe, respetando la regla de **compatibilidad hacia atrás** (datos y respaldos antiguos sin esa clave deben cargar sin errores).
- **Respaldo (.json)**: incluir `carnetListas`; el nombre del archivo debe incluir la academia (`respaldo_tecno_2026-10-01.json`); guardar dentro del JSON un campo `_academia`. Al **importar** un respaldo cuyo `_academia` no coincida con la academia actual, pedir confirmación explícita ("Este respaldo es de otra academia. ¿Importar de todos modos?"). Los respaldos viejos (sin `_academia`) se importan como siempre.

### 3.4 Identidad visual por academia
- Sidebar: el logo/título, el subtítulo ("ORGANIZADOR MOODLE") y el pie ("TecnoCleveland · Academia de Robótica") salen de `ACADEMIA_ACTUAL`. También `document.title`.
- Agrega `data-academia="tecno|cleveland"` al `<body>`. TecnoCleveland se ve **exactamente igual que hoy**. Para `cleveland` sobrescribe solo las variables de acento (en claro y en oscuro): azul `#25A5DE` como acento principal (para texto/botones usa una variante más oscura, ~`#1280B3`, por contraste) y verde `#7EBD3E` como acento secundario.
- Un usuario de Cleveland no debe ver ninguna mención a TecnoCleveland en la interfaz (ni al revés).

---

## 4. Parte B — Vista "Generador de carnets"

### 4.1 Integración (reglas de aislamiento, muy importantes)
- Item nuevo en el sidebar, en **PROGRAMAS**, justo después de "Generador de usuarios": **🪪 Generador de carnets** (`data-view="carnets"`). Sigue la convención existente de `showView(...)`, vistas y estilos activos del menú.
- Archivos nuevos dentro de `Organizador_moodle/` (en la raíz, igual que `script.js`/`styles.css`): `carnets.js`, `carnets-pdf.js`, `carnets.css`. Copia (no muevas) las librerías a `Organizador_moodle/lib/`: `jspdf.umd.min.js` y `jszip.min.js` (desde `stickers/lib/`). **No uses CDN.** `firebase.json` publica solo `Organizador_moodle`, por eso todo debe vivir ahí.
- **`stickers/` NO se borra ni se modifica** (queda como respaldo del generador independiente).
- **Cero colisiones con el organizador**: 
  - JS: envuelve todo en un IIFE y expón solo `window.Carnets = { init, render }`. El código de `stickers/` usa nombres globales genéricos (`$`, `T`, `state`, `PAGE`, `LAYOUTS`, `ACADEMIES`, `tint`, `clean`…) que **chocarían** con `script.js`: renómbralos o encapsúlalos.
  - CSS: el CSS de `stickers/css/styles.css` usa clases genéricas (`.card`, `.btn`, `.field`, `.seg`, `.cols`, `.modal`, `.toast`, `.alert`, `.group`, `.pill`…) que pisarían el organizador. **No copies ese archivo.** Escribe `carnets.css` con prefijo `.cn-` y scope `#view-carnets`, y **reutiliza los componentes y variables CSS que ya existen en `styles.css`** (tarjetas, botones, inputs, selects, modal, toast) para que se vea nativo, incluyendo **modo oscuro**.
  - Datos: **no uses `localStorage` propio**; usa las funciones/objeto de datos que ya usa `script.js` (carga/guardado) para persistir `carnetListas`, de modo que el Respaldo las incluya.
  - Seguridad: todo texto de estudiantes (nombres, usuarios, grupos) que se pinte en HTML debe **escaparse** (los datos pueden venir de CSV importados).
  - Agrega los `<script>`/`<link>` nuevos con parámetro de versión (`carnets.js?v=1`) para evitar que Firebase sirva versiones en caché.

### 4.2 Estructura de la vista
Arriba, un selector segmentado de **dos modos**:
**[ Crear desde cero ]  [ Desde participantes de un colegio ]**

Debajo (compartido por ambos modos): tarjeta **"Opciones de impresión"** — carnets por página (**14 grandes 2×7** / **24 compactos 3×8**), sitio web impreso (default `cursoscleveland.com`), "Nombres en mayúsculas" (activo por defecto). Persistir estas opciones en el objeto de datos (`carnetOpciones`).

### 4.3 Modo 1 — Crear desde cero (igual a `stickers/`, ya aprobado)
Replica el comportamiento actual de `stickers/js/app.js`:
- Nivel (Educación Media 1.º–5.º año / Primaria 1.º–6.º grado) → Año/Grado (selector) → **Sección opcional** → **Clave única** para toda la lista → 3 columnas pegables (Usuario, Apellidos, Nombres; pegar desde Excel con tabuladores las reparte; contadores de líneas; validaciones con mensajes claros).
- **Guardar lista** (si ya existe grado+sección → confirmar reemplazo). Las listas se agrupan por grado **en el orden en que se guardaron**.
- Por grado: **Descargar PDF del grado** (todas sus secciones en orden de guardado) y vista previa. Por lista/sección: vista previa, **PDF individual**, **Editar**, **Eliminar** (con confirmación). Además: ZIP de todos los grados y "Eliminar todas las listas".
- Si la sección está vacía, el carnet **no muestra sección** (ya resuelto en `buildPDF`).

### 4.4 Modo 2 — Desde participantes de un colegio (NUEVO)
Genera carnets leyendo `participantes` (el array que alimenta la pestaña Participantes de Colegios). **No duplica ni modifica datos**: lee en vivo al pulsar "Generar".

1. **Selector de Colegio** (mismo estilo que el Generador de usuarios). Si el colegio no tiene participantes: estado vacío con texto claro y un botón que lleve al **Generador de usuarios**.
2. Tabla **"Listas de participantes de este colegio"**, agrupadas en dos secciones (**Educación Media** y **Educación Primaria**), ordenadas de menor a mayor (1er Año→5to; 1er Grado→6to). Cada fila es una lista (identidad `cursoId + anio + group1`) con:
   - ☑ casilla de selección (todas marcadas por defecto) + botones "Seleccionar todo / ninguno",
   - Año/Grado, Curso modelo, Grupo (el `group1` guardado), cantidad de estudiantes,
   - **"Sección a imprimir"**: campo editable. Valor por defecto = `group1` solo si no está vacío y tiene ≤ 3 caracteres (ej. "A"); en otro caso vacío. Motivo: los grupos importados de otra plataforma pueden ser textos como "2nd grade", que **no son una sección**. Vacío = el carnet sale sin sección.
3. Botón **"Generar carnets"** → panel de resultados con la **misma presentación del Modo 1**: agrupado por grado, **PDF del grado** (con sus listas en el orden de la tabla), **PDF por lista/sección**, vista previa y **ZIP** si hay varios grados. En cada fila de lista muestra también el curso modelo (un mismo año puede tener listas de distintos cursos).
4. Mapeo de campos por estudiante: nombre impreso = `nombres + ' ' + apellidos` (respetar la opción de mayúsculas); usuario = `username` **tal como está guardado**; clave = el `password` **propio de cada participante** (no una clave global); sección = la columna "Sección a imprimir" de su lista.
5. Nivel y número de año: el **nivel** se deriva del `nivel` del curso modelo (como en todo el organizador); el **número** (1–5 / 1–6) se extrae del campo `anio` (ej. "5to Año", "4to Grado"; tolera ordinales y dígitos). Si un `anio` no se puede interpretar o excede el rango del nivel, **no abortes**: omite esa lista y muéstrala en un aviso ("No se pudo interpretar el año de: …").
6. Estos resultados son efímeros (no se guardan en `carnetListas`); se regeneran leyendo los datos actuales cada vez.

### 4.5 Idioma
- **Contenido impreso del carnet** según academia: Tecno → español ("4to Grado", "Sección A", USUARIO / CLAVE); Cleveland → inglés ("4th Grade", "Section A", USERNAME / PASSWORD). Ya está resuelto en `stickers/js/stickers.js` (`ACADEMIES`, `ORDINALS`, `gradeLabel`); reutilízalo sin alterar el diseño del PDF (cabecera de color, nombre autoajustable, recuadro de credenciales, franja de color, pie con página). Colores por academia: Cleveland azul `#25A5DE`/verde `#7EBD3E`; Tecno naranja `#EA5A1E`, azul `#3A6BB5`, verde `#84BC24`, morado `#976FB0`.
- **Textos de la interfaz de la vista**: mantén el diccionario de dos idiomas que ya existe en `stickers/js/app.js` (`T.en` / `T.es`) y elige por `ACADEMIA_ACTUAL.idiomaUI` (ver 3.1). Por defecto `'es'` para ambas. Agrega las cadenas nuevas del Modo 2 en ambos idiomas.
- Nombres de archivo de los PDF: `Carnets_<Academia>_<Nivel>_<Grado>[ _Seccion-X].pdf` (en inglés: `ID-Cards_…`), como en `stickers/`.

---

## 5. Decisiones asumidas (si alguna es incorrecta, avísame antes de implementar)

1. **Interfaz del organizador en español para ambas academias.** Solo los carnets de Cleveland salen en inglés. (Ya queda parametrizado con `idiomaUI`.)
2. **Cleveland arranca con catálogo vacío** (sin los 28 colegios ni los 17 cursos de Tecno).
3. Cleveland usa el dominio de email **`cleve.com`** y **no muestra** el botón "Importar CSV" del Generador de usuarios (esa función es para el caso de primaria compartida que describe la documentación).
4. Cada código entra **solo a su academia**; no hay selector para cambiar de academia dentro de la sesión.
5. Los datos siguen en `localStorage` (por navegador y por academia). Migrar a Firebase queda **fuera de este alcance**.

---

## 6. Reglas generales
- Todo en **español** (comentarios, mensajes, textos), salvo el contenido en inglés de los carnets de Cleveland.
- Usar las **variables CSS existentes**; el modo oscuro debe verse bien en la nueva vista.
- Responsive (móvil y escritorio) como el resto de la app.
- **Compatibilidad hacia atrás obligatoria** con datos y respaldos existentes.
- No agregar dependencias externas ni CDNs; no cambiar la numeración de usuarios; no tocar el flujo de Papelera ni de Participantes salvo lo indicado.
- Actualiza `LEEME.txt` (nueva sección "Generador de carnets" y "Cómo entra cada academia", códigos en la sección de `USERS`) y, si existe en el repo, `documentacion_organizador_moodle.md` (nuevo capítulo de multi-academia y de carnets, y el nuevo campo `carnetListas`).

---

## 7. Pruebas obligatorias (usa un navegador headless, p. ej. Playwright, si está disponible; si no, deja la lista para que yo la ejecute)

**Regresión TecnoCleveland (lo más importante)**
1. Siembra en `localStorage` (`tc_organizador_data`) un objeto con la forma documentada (colegios, cursos, asignaciones, participantes, trash) **sin** `carnetListas`. Entra con `2026`: todo carga igual que antes, sin errores en consola.
2. Recorre cada vista existente: Panel, Colegios (detalle, Participantes, buscador, copiar, descargar XLSX), Generador de usuarios (generar, guardar, CSV, importar CSV), Cursos modelo, Buscar, Respaldo (exportar e importar un respaldo **antiguo**), Papelera.
3. `1010` entra a Tecno; un código inválido muestra el error.

**Multi-academia**
4. `ruben` / `Ruben` / `RUBEN` entran a Cleveland: catálogo vacío, marca visual de Cleveland, sin menciones a Tecno. Crear un colegio y una lista de participantes.
5. Cerrar sesión y entrar con `2026`: los datos de Tecno intactos y **sin** rastro de lo creado en Cleveland (y viceversa).
6. Importar en Cleveland un respaldo de Tecno → debe pedir la confirmación de "otra academia".

**Generador de carnets**
7. Modo 1: crear listas 4to Grado A, B, C y un 5to sin sección; verificar agrupación, orden de guardado, PDF por grado, PDF por sección, editar, eliminar, ZIP, persistencia al recargar y presencia en el respaldo.
8. Modo 2: con un colegio que tenga Media y Primaria, varios grupos, y una lista importada con grupo tipo "2nd grade": verificar la tabla, sección por defecto, edición de la sección a imprimir, clave individual por estudiante, PDFs correctos, y el aviso para un `anio` no interpretable.
9. Abrir los PDF generados (render a imagen) y confirmar: tamaño carta, 14 o 24 por página, sin sección cuando está vacía, textos en el idioma correcto de cada academia, tildes y ñ correctas.
10. Modo claro y oscuro, escritorio y ancho móvil, **cero errores en consola**.

---

## 8. Qué NO hacer
- **No corras `firebase deploy`** (lo hago yo manualmente después).
- **No hagas `git push`** (este entorno no tiene credenciales; el push lo hago yo desde GitHub Desktop).
- No renombres ni cambies la clave `tc_organizador_data`.
- No borres ni edites la carpeta `stickers/` ni `Organizador/`.

## 9. Cierre
Haz **3 commits locales** con mensajes claros en español:
1. `Multi-academia: login por código, datos separados por academia y marca dinámica` (Parte A).
2. `Generador de carnets: modo crear desde cero integrado al organizador` (Parte B, 4.3).
3. `Generador de carnets: modo desde participantes de un colegio` (Parte B, 4.4) + docs/LEEME.

Al terminar entrégame un resumen con: archivos creados/modificados, resultado de cada prueba, decisiones asumidas que cambiaste (si alguna), y los pasos manuales que me tocan: `git pull` + `firebase deploy --only hosting` desde `~/Documentos/GitHub/Proyectos`.
