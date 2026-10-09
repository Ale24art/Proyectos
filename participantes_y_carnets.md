# INSTRUCCIÓN — Exportaciones: PDF de participantes, archivos por nivel (Media/Primaria) y nombres de archivo de carnets

Lee COMPLETO el archivo `nueva documentacion.md` de la raíz del repo (documento vigente) y revisa el código real (`Organizador_moodle/script.js`, `carnets.js`, `carnets-pdf.js`, `index.html`, `styles.css`, `carnets.css` y la carpeta `lib/`). **El código manda**: si algo de esta instrucción no coincide con el código (nombres de funciones, IDs, estructura de `data`), documenta la diferencia y adáptate. Respeta todas las reglas de trabajo del §12 de la documentación.

Estas funciones son **solo de lectura/exportación**: no cambian `data`, no tocan el esquema, no afectan la sincronización con Firebase ni el respaldo `.json`. Se aplican igual a las dos academias (Tecno y Cleveland).

---

## 0. Contexto

- **Colegios → detalle de un colegio → "Participantes"**: hay un selector **Año / Grado** (Educación Media: 1er a 5to Año; Educación Primaria: 1er a 6to Grado), un buscador, la tabla paginada y un botón **"⬇ Descargar XLSX"** que exporta la lista del año/grado seleccionado.
- **Generador de carnets → "Desde participantes de un colegio" → "Carnets generados"**: lista los carnets por año/grado, con **"Descargar PDF del grado"**, **"PDF"** por sección/lista y **"Descargar todos los grados (.zip)"**. Hoy el PDF de un grado se descarga con nombres del tipo `Carnets_tecnocleveland_Media_1er-ano.pdf`.

## 1. Función 1 — PDF de la lista de participantes seleccionada

- Junto al botón **Descargar XLSX** agrega **"⬇ Descargar PDF"**.
- El PDF debe tener **el mismo contenido y las mismas columnas, en el mismo orden**, que el XLSX actual de ese año/grado. Revisa el código del XLSX y replícalo exactamente (incluido cómo trata los grupos y el orden de los estudiantes). Como el XLSX, **ignora el buscador y la paginación**: exporta todos los participantes del año/grado.
- Diseño del PDF: encabezado con nombre de la academia, nombre del colegio, nivel, año/grado (y curso/grupo si el XLSX o el modelo de datos lo tienen), fecha de generación y total de estudiantes; tabla con encabezado repetido en cada página; numeración de páginas ("Página X de Y"); texto largo con ajuste de línea (sin cortar nombres); caracteres con tilde y **Ñ** deben verse bien.
- **Nombre del archivo:** usa la misma convención vigente del XLSX de ese año/grado (el commit "Descargas: nombre de archivo por año/grado y grupo"), solo cambiando la extensión a `.pdf`.

## 2. Función 2 — Descargar todo un nivel en un solo archivo (XLSX y PDF)

- En la tarjeta **Participantes** del colegio agrega un bloque **"Descargar todo el nivel"** con un selector **Educación Media / Educación Primaria** (solo los niveles que tengan participantes en ese colegio; si no hay ninguno, muestra un mensaje claro en español) y dos botones: **"⬇ XLSX"** y **"⬇ PDF"**.
- **Contenido:** todos los años de Media (1er a 5to Año) o todos los grados de Primaria (1er a 6to Grado), **en orden**, **en un solo archivo**. Omite los años/grados sin participantes (sin generar bloques vacíos).
- **Separación e indicación de inicio y fin de cada año/grado:**
  - **PDF:** cada año/grado **empieza en una página nueva** con un título destacado ("1er Año · Educación Media · Colegio X · N estudiantes", con el curso/grupo si están disponibles) y **termina con una línea de cierre** ("Fin de 1er Año · Total: N estudiantes"). Al final del documento, un resumen con el total por año/grado y el total general (puede ir en una última página o al final del último bloque). Si la biblioteca lo permite sin complicar, agrega marcadores/índice del PDF por año/grado.
  - **XLSX:** una **sola hoja** (`Estudiantes Media` / `Estudiantes Primaria`) con las mismas columnas del XLSX actual. Antes de cada año/grado, una **fila banda** destacada (negrita y fondo de color) con "1er Año · N estudiantes"; después de la última fila de cada bloque, una fila de cierre "Total 1er Año: N" y una fila en blanco de separación; al final, "TOTAL GENERAL: N". Los encabezados de columna se repiten debajo de cada banda. Congela la fila superior si es posible y ajusta anchos de columna. (Si el XLSX actual ya usa estilos, reutilízalos.)
- **Nombres de archivo exactos** (con espacio y mayúscula inicial, sin nombre del colegio, sin fecha):

| Botón | Archivo |
|---|---|
| Media, XLSX | `Estudiantes Media.xlsx` |
| Media, PDF | `Estudiantes Media.pdf` |
| Primaria, XLSX | `Estudiantes Primaria.xlsx` |
| Primaria, PDF | `Estudiantes Primaria.pdf` |

El nombre del colegio **sí** debe aparecer **dentro** del archivo (encabezado del PDF y celda de título en el XLSX) para poder distinguir archivos de colegios distintos.

## 3. Función 3 — Todos los carnets de un nivel en un solo PDF

- En **Generador de carnets → Carnets generados** (modo "Desde participantes de un colegio"), agrega un botón por nivel disponible: **"Descargar todos los carnets de Educación Media (PDF único)"** y **"… de Educación Primaria (PDF único)"** (solo los niveles que tengan carnets generados para el colegio seleccionado). Debe seguir existiendo "Descargar todos los grados (.zip)".
- El PDF único junta, **en orden** (1er a 5to Año en Media; 1er a 6to Grado en Primaria), los mismos carnets que hoy produce "Descargar PDF del grado", respetando las secciones/listas, las opciones de impresión elegidas (carnets por página, sitio web impreso, mayúsculas, etc.) y el diseño actual de los carnets. **No cambies el diseño de los carnets.**
- **Cada año/grado debe empezar en una hoja nueva** (nunca mezclar carnets de dos grados en la misma hoja). Para indicar inicio/fin de cada grado: si el diseño de la hoja deja un margen libre fuera del área de recorte, agrega un rótulo discreto y pequeño en la primera hoja de cada grado ("1er Año · N carnets"); si no hay margen, usa solo el salto de página y los marcadores del PDF (si el motor lo permite) y dime qué hiciste.
- **Nombre del archivo:** `Carnets Media.pdf` y `Carnets Primaria.pdf` (propuesta; si ya existe una convención incompatible, repórtala).
- Reutiliza el motor existente de `carnets-pdf.js` (las funciones que generan el PDF de un grado) y compón el PDF único con ellas; no dupliques la lógica de maquetación. Recuerda que el motor está duplicado en `stickers/js/stickers.js`: **no lo modifiques**, solo menciónalo en tu reporte si corresponde.
- Muestra un indicador de progreso ("Generando PDF…"), deshabilita el botón mientras se genera y maneja errores con un mensaje en español.

## 4. Función 4 — Nuevos nombres para los PDF de carnets por año/grado

Todos los PDF de carnets de **un año/grado** deben descargarse con estos nombres, sin nombre de academia, colegio ni nivel:

| Año / Grado | Archivo |
|---|---|
| 1er a 5to Año (Media) | `1er año.pdf`, `2do año.pdf`, `3er año.pdf`, `4to año.pdf`, `5to año.pdf` |
| 1er a 6to Grado (Primaria) | `1er grado.pdf`, `2do grado.pdf`, `3er grado.pdf`, `4to grado.pdf`, `5to grado.pdf`, `6to grado.pdf` |

- Usa el nombre real del año/grado tal como lo maneja la app (con ñ y espacio) en minúscula: `1er año`, `2do grado`, etc. Quita solo caracteres inválidos para nombres de archivo.
- Aplica el cambio al botón **"Descargar PDF del grado"** y a **los archivos dentro del `.zip` de "Descargar todos los grados"**. Reporta cuál es el nombre actual del `.zip` y mantenlo sin cambios (salvo que incluya algo incompatible).
- Los botones **"PDF" por sección/lista** pueden generar nombres repetidos cuando un grado tiene varias secciones: para esos usa `1er año - Sección A.pdf` (propuesta) y repórtalo.
- Si hay otras rutas de descarga de carnets por año/grado (por ejemplo desde el modo "Crear desde cero"), aplica la misma regla cuando el año/grado esté disponible y reporta los casos que no sigan este patrón.
- Cuida que el navegador respete la **ñ** y el espacio en el nombre de descarga.

## 5. Notas técnicas

- **Bibliotecas:** no uses CDN ni agregues build. Revisa `lib/` (jsPDF, SheetJS, JSZip, etc.). Si falta una biblioteca para tablas en PDF (por ejemplo `jspdf-autotable`), puedes vendorizar una versión **compatible con la versión de jsPDF ya incluida** dentro de `lib/` (indica nombre, versión y licencia) o dibujar la tabla manualmente; elige lo más simple y estable. Carga en `index.html` solo lo necesario, respetando el orden de scripts, y sube +1 el `?v=` de los archivos que modifiques.
- **Tamaño de página:** reutiliza el mismo que usa `carnets-pdf.js` (Carta o A4) para consistencia con lo ya impreso.
- **Fuentes:** las fuentes estándar de jsPDF cubren tildes y ñ; verifica con nombres reales como "MUÑOZ", "GIRÓN", "NÚÑEZ" y que un carácter no soportado no rompa la generación (sustitúyelo con seguridad).
- **Rendimiento:** con colegios de cientos de estudiantes la generación no debe congelar la interfaz de forma notable; cede el hilo con `setTimeout/await` entre grados si hace falta.
- **Estructura:** concentra la lógica de armado de datos (ordenar niveles, agrupar por año/grado, totales, nombres de archivo) en funciones puras reutilizables y testeables, separadas de la generación del archivo.
- **Interfaz:** botones nuevos coherentes con los estilos actuales, modo claro/oscuro, sidebar abierto u oculto, tabla con scroll horizontal ya existente; textos en español; accesibilidad básica (`aria-label`, foco).
- **Sin cambios de datos:** estas funciones no escriben en `data`, así que no deben disparar `saveData()` ni la sincronización.

## 6. Verificación (sin navegador)

Si hay Node.js, prueba con datos ficticios (nunca datos reales de estudiantes) y reporta:
1. Orden y contenido de los bloques: Media 1er→5to y Primaria 1er→6to; años/grados vacíos omitidos; totales por bloque y general correctos.
2. Nombres de archivo exactos: `Estudiantes Media.pdf/.xlsx`, `Estudiantes Primaria.pdf/.xlsx`, `Carnets Media.pdf`, `Carnets Primaria.pdf` y los doce nombres de año/grado con ñ.
3. XLSX por nivel: una hoja, filas banda, filas de cierre, fila TOTAL GENERAL y encabezados repetidos (léelo de vuelta con SheetJS en la prueba).
4. PDF por nivel: cada año/grado empieza en página nueva y la numeración es correcta (si jsPDF corre en Node, cuenta páginas).
5. PDF único de carnets: cada grado empieza en hoja nueva, el total de carnets coincide con la suma de los grados, y el diseño de cada carnet no cambia respecto al PDF por grado.
6. Los PDF y XLSX por año/grado conservan columnas y contenido del XLSX anterior.
7. `node --check` en todos los JS modificados y que las pruebas existentes (`test_sync_core`, `test_sync_dos_dispositivos`, `test_idavuelta`, y las de agregar estudiantes si existen) sigan pasando.
8. Qué **no** pudiste probar (navegador, descarga real, impresión).

## 7. Documentación

Actualiza `nueva documentacion.md` en el mismo archivo: sección "Cambios" (fecha y commit), §2 (archivos, versiones `?v=`, bibliotecas nuevas en `lib/` si las hay), la sección de Colegios/Participantes (PDF y exportación por nivel), la de Generador de carnets (PDF único por nivel y nuevos nombres de archivo), §9 (guía breve) y §11 (riesgos: por ejemplo nombres de archivo iguales entre colegios distintos, ya que los nombres no incluyen el colegio por pedido del usuario). No toques la documentación histórica.

## 8. Reglas

- No hagas `git commit`, `git push` ni `firebase deploy`.
- No toques `tc_organizador_data` ni `cc_organizador_data`.
- No modifiques `stickers/`.
- No incluyas datos reales de estudiantes en pruebas ni en el repositorio.
- Todo en español (comentarios, textos de interfaz y mensajes).
- Si algo es ambiguo, no lo adivines: déjalo en "Pendiente de confirmar" y pregúntame.

## 9. Entrega

Resume: archivos creados/modificados, bibliotecas agregadas (si hay), decisiones tomadas (sobre todo el nombre del `.zip`, el nombre de los PDF por sección, los rótulos en las hojas de carnets y cómo manejaste varios grupos en un mismo año), resultado de cada verificación y lo que no pudiste probar.
