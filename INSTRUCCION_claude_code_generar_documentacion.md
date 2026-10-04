# Instrucción para Claude Code — Revisar el código y generar la documentación definitiva

> Trabaja en el repositorio clonado `Proyectos` (en Windows/Debian: `~/Documentos/GitHub/Proyectos`; en Chromebook: `~/GitHub/Proyectos`). La app en producción vive en `Organizador_moodle/`.
>
> **Esta tarea NO modifica código.** Solo lees, verificas y escribes documentación.

---

## 1. Objetivo

Generar la documentación **definitiva y verificada contra el código real** del proyecto "Organizador Moodle" (TecnoCleveland + Cleveland English Institute), en un único archivo **`documentacion_organizador_moodle.md`** en la raíz del repo, pensado para que **un chat nuevo de Claude (sin ningún contexto previo) entienda el programa a la perfección** y pueda continuar desarrollándolo sin romper nada.

En la raíz del repo hay un **borrador** (`documentacion_organizador_moodle.md`, versión 2). Fue escrito por otra sesión de IA **sin acceso al código**, a partir de las especificaciones, así que puede contener nombres, claves o comportamientos que no coinciden con lo implementado. Tu trabajo es **comprobar cada afirmación contra el código y corregir el borrador**, no confiar en él.

**Principio rector: el código manda.** Describe solo lo que realmente existe. Si algo del borrador no está en el código, quítalo o márcalo como "NO IMPLEMENTADO". Si algo existe en el código y no está en el borrador, agrégalo. No inventes nada: si no encuentras un dato, escribe "no encontrado en el código".

---

## 2. Qué leer (en este orden)

Dentro de `Organizador_moodle/`: `login.html`, `academias.js`, `index.html`, `script.js`, `carnets.js`, `carnets-pdf.js`, `carnets.css`, `styles.css`, `LEEME.txt`, y el contenido de `lib/`.
En la raíz: `firebase.json`, `.firebaserc`, `README.md`, y los archivos `INSTRUCCION_*.md` (son las especificaciones con las que se construyó cada fase; úsalas como contexto histórico, **no como verdad**).
Además `stickers/` (generador independiente original: confirma qué es, qué comparte con `carnets-pdf.js`/`carnets.js` y si sigue siendo necesario) y revisa `git log --oneline` para reconstruir el historial de fases. **No toques `Organizador/`** (solo anota si parece relacionada o no).

---

## 3. Qué verificar y documentar (checklist)

### 3.1 Acceso y multi-academia
- Contenido real de `USERS` en `login.html`: códigos, nombres, academia; cómo se normaliza el código (mayúsculas, trim); claves de `sessionStorage` usadas (`tcUser`, `tcAcademia`, otras); qué pasa con sesiones antiguas y al cerrar sesión.
- `academias.js`: copia **fielmente** la estructura del objeto de configuración (todos los campos y valores reales: `storageKey`, dominio de email, flags como importar CSV, idiomas, colores, textos). Lista **todos los lugares** de `script.js`, `carnets.js` e `index.html` donde se consume esa configuración.
- Dónde y cómo se elige la `storageKey`; confirma que `tc_organizador_data` se conserva para Tecno y cuál es la de Cleveland.
- Cómo se inicializan los datos por defecto de cada academia (catálogo de Tecno vs Cleveland), y qué hace "Restablecer catálogo base".
- Respaldo: nombre real del archivo exportado, estructura del JSON (¿existe `_academia`?), validaciones al importar, confirmación entre academias.
- Marca visual dinámica: qué elementos cambian por academia, `data-*` en `<body>`, variables CSS sobrescritas (valores reales en claro y oscuro).

### 3.2 Modelo de datos
- Reconstruye el **esquema real completo** del objeto de datos: todas las claves de primer nivel, sus tipos y campos, incluyendo `trash`, y las claves nuevas de carnets (nombre exacto, forma de cada elemento). Indica qué función hace la carga/migración y cómo asegura la compatibilidad hacia atrás.
- Documenta las **funciones centrales** de `script.js` (carga, guardado, generación de ids, navegación entre vistas, render de cada vista, CRUD, numeración de usuarios, importación CSV, exportación XLSX/CSV, papelera): nombre, qué hace, quién la llama. No hace falta documentar cada función menor; sí las que alguien necesitaría tocar o reutilizar.
- Confirma las reglas de negocio de numeración de usuarios (prefijo, 4 dígitos media / 3 primaria, pools independientes por nivel, regex) tal como están en el código, y el comportamiento exacto del dominio del email.

### 3.3 Vistas e interfaz
- Lista real de vistas del sidebar (orden, ids `view-*`, iconos, cómo se conmuta de vista) y las funciones/ganchos para añadir una vista nueva.
- Para cada vista: qué muestra y qué acciones tiene, **según el código** (compara con la sección 6 del borrador).

### 3.4 Generador de carnets (`carnets.js`, `carnets-pdf.js`, `carnets.css`)
- Cómo se expone/inicializa el módulo (nombre global, `init`, `render`), cómo se engancha a `showView`, y cómo evita colisiones (IIFE, prefijo CSS).
- **Persistencia**: dónde y bajo qué clave se guardan las listas y las opciones; si pasan por las funciones de datos del organizador; si el Respaldo las incluye.
- **Modo 1 (crear desde cero)**: campos, validaciones y mensajes, reemplazo por duplicado, orden de guardado, agrupación por grado, PDF por grado / por sección, editar, eliminar, eliminar todas, ZIP.
- **Modo 2 (desde participantes)**: cómo agrupa participantes (`cursoId + anio + group1`), cómo obtiene nivel y número de año (función de parseo y qué formatos tolera), regla real del valor por defecto de "Sección a imprimir", mapeo de campos por estudiante (de dónde sale cada dato), manejo de años no interpretables, si es efímero o guarda algo.
- **PDF**: constantes reales de geometría (márgenes, columnas/filas, separaciones, tamaños), proporciones del diseño del carnet, colores por academia, etiquetas e idioma por academia, ordinales, sanitización de caracteres (`clean`), nombres de archivo (PDF y ZIP), pie de página.
- Textos de interfaz: estructura del diccionario de idiomas y qué parámetro decide el idioma de la UI.
- Cómo se escapa el HTML de datos de estudiantes (verifica que realmente se haga en todos los puntos donde se pinta texto de usuario; **si encuentras un punto sin escapar, anótalo como hallazgo**, no lo corrijas).

### 3.5 Despliegue
- Contenido real de `firebase.json` (¿incluye `headers` de caché?) y `.firebaserc`.
- Versionado de scripts en `index.html`/`login.html` (`?v=`).
- Qué carpeta publica Firebase y qué NO se publica (`stickers/`, `Organizador/`, `INSTRUCCION_*`).

### 3.6 Calidad (solo informar, no corregir)
Haz una pasada rápida y reporta en el resumen final (no en el documento principal, salvo la sección "Deuda técnica conocida"): errores de consola evidentes al leer el código, duplicación de lógica entre `stickers/` y `carnets-pdf.js`, puntos sin escapar, claves que podrían colisionar, y cualquier riesgo para la compatibilidad de datos antiguos.

---

## 4. Estructura que debe tener el documento final

Conserva y actualiza la estructura del borrador (secciones 1–12) y **agrega/ajusta** lo siguiente:

1. **Resumen ejecutivo (máx. 15 líneas)** al inicio: qué es, para quién, cómo se despliega, dónde viven los datos y las 5 reglas que nunca se deben romper.
2. **Mapa del código**: tabla por archivo (propósito, tamaño aproximado, globales/funciones clave, dependencias, qué cargarlo y en qué orden en `index.html`).
3. **Modelo de datos real** (copiado del código, con ejemplo JSON completo) y **flujo de datos**: cómo se carga, se modifica, se guarda, se respalda y se restaura.
4. **Guía "cómo se hace…"** con pasos concretos y archivos a tocar para: agregar una academia nueva; agregar una vista nueva al sidebar; agregar un código de acceso; cambiar los colores/diseño del carnet; cambiar las medidas del PDF; agregar un curso modelo base; migrar el esquema de datos sin romper respaldos antiguos.
5. **Glosario** (año/grado, grupo vs sección, asignación, participante, curso modelo, lista de carnets, pool de numeración, etc.).
6. **Deuda técnica conocida y decisiones asumidas** (qué quedó sin confirmar con el usuario y por qué).
7. **Prompt de arranque para un chat nuevo** (al final): un bloque listo para copiar, de 10–15 líneas, que diga cómo usar el documento (pegarlo completo primero) y las reglas de trabajo con Claude Code (instrucciones en `.md`, sin push ni deploy, español, retrocompatibilidad).

Estilo: español, claro, con tablas y bloques de código; sin relleno. Prioriza exactitud sobre extensión. Incluye al inicio la fecha de verificación y el hash del commit sobre el que se verificó (`git rev-parse --short HEAD`).

---

## 5. Reglas
- **No modifiques ningún archivo de código, HTML, CSS, configuración ni datos.** Solo creas/actualizas `documentacion_organizador_moodle.md` (y, si lo ves útil, actualizas `README.md` con un párrafo que apunte a la documentación; en tal caso, sin tocar nada más).
- No ejecutes `git push` ni `firebase deploy`.
- Si ejecutas pruebas, que sean de solo lectura (por ejemplo, abrir la app en un navegador headless con datos sembrados); no dejes archivos temporales en el repo.
- Si hay una discrepancia importante entre el borrador y el código, **prevalece el código** y la registras en el resumen final.

## 6. Cierre
1. Haz **un commit local** con el mensaje: `Documentación v3: verificada contra el código real`.
2. Entrégame un resumen con: (a) lista de **discrepancias** encontradas entre el borrador y el código (qué decía y qué es realmente), (b) cosas implementadas que el borrador no mencionaba, (c) hallazgos de calidad/riesgo de la sección 3.6, (d) cualquier dato que no pudiste verificar.
3. Recuerda: el `git push` y el `firebase deploy` los hago yo manualmente (el documento no se publica en Firebase; solo vive en el repo).
