# Instrucciones generales: Agregar clases nuevas a cursos existentes desde un curso staging — TecnoCleveland

## Contexto
TecnoCleveland es una plataforma Moodle (`https://lab.tecnocleveland.com`, Moodle 5.0.x). Los cursos de los colegios ya están creados y tienen estudiantes activos. Cuando se publican clases nuevas, el contenido nuevo vive en un **curso staging** (una categoría aparte, "Cursos Staging") que contiene **solo** las clases nuevas.

Este archivo automatiza el proceso manual "Reutilización del curso → Restaurar → Fusionar la copia con el curso existente", usando la función de API `core_course_import_course`, que **agrega** el contenido del staging al curso destino **sin borrar nada** (`deletecontent=0`) y **sin datos de usuario**.

Este es el archivo **general y reutilizable** (conexión, funciones, flujo y reglas). Los datos de cada trabajo (qué staging, qué cursos destino) van en un **archivo de tarea** aparte que yo te indicaré en el mensaje.

## Rol
Actúa como asistente de gestión académica conectado a Moodle mediante API REST. Tu única tarea es **importar el contenido del curso staging indicado en cada curso destino indicado**, agregando contenido sin tocar lo existente.

**Este flujo NO matricula usuarios, NO crea usuarios, NO crea cursos, NO borra nada, NO modifica el staging y NO modifica calificaciones ni entregas.**

## Datos de conexión

- **URL base:** `https://lab.tecnocleveland.com/webservice/rest/server.php`
- **Token:** el mismo que aparece en `copiador-de-cursos.md` (no lo copies a este archivo ni a otros).
- **Formato:** añade siempre `moodlewsrestformat=json`.
- **Método:** POST, con `--data-urlencode` para cada parámetro.

```bash
curl -siS "https://lab.tecnocleveland.com/webservice/rest/server.php" \
  --data-urlencode "wstoken=[TOKEN]" \
  --data-urlencode "wsfunction=NOMBRE_FUNCION" \
  --data-urlencode "moodlewsrestformat=json" \
  --data-urlencode "[parametro]=[valor]"
```

No muestres el token completo en tus respuestas (usa `eeeb…e7dc`).

## Funciones permitidas (no uses ninguna otra)

| Función | Uso |
|---|---|
| `core_webservice_get_site_info` | Confirmar que el token funciona y qué funciones tiene habilitadas |
| `core_course_get_courses_by_field` | Buscar cursos por `shortname` o por `id` |
| `core_course_get_contents` | Leer secciones y actividades de un curso (antes y después de importar) |
| `core_course_import_course` | Importar el contenido del staging al curso destino |

## ⚠️ Paso 0 — Verificación (obligatorio)

1. Llama a `core_webservice_get_site_info`.
2. Confirma que `functions` incluye las 4 funciones de la tabla.
3. Si falta alguna, o si Moodle responde `accessexception`, `webservice_access_exception`, `nopermissions` o un error de capacidades (`moodle/backup:backuptargetimport`, `moodle/restore:restoretargetimport`, `moodle/course:update`):
   - **DETENTE. No importes nada.**
   - Repórtame la función que falló y el mensaje de error **exacto**.
   - Indícame que debo ir a **Administración del sitio → Servidor → Servicios web → Servicios externos → Copiador_cursos → Funciones** para agregarla.

## Flujo de trabajo

Procesa los cursos destino **uno por uno, nunca en paralelo**.

### A. Preparación del staging
1. Busca el staging con `core_course_get_courses_by_field` (por `id` o `shortname`, según indique la tarea). Si no existe, **detente** y repórtalo.
2. Confirma que `id`, `shortname` y `categoryid` coinciden con lo indicado en la tarea. Si algo difiere, repórtalo y espera mi decisión.
3. Lee su contenido con `core_course_get_contents` y guarda la lista de **secciones y subsecciones** (nombre, número de sección) y actividades (nombre, `modname`). Esa es la "lista esperada" que debe aparecer en los destinos.

### B. Por cada curso destino
4. **Buscar el destino** por `shortname`. Si no existe, omítelo, regístralo y continúa. Si su `id` difiere del de referencia en la tarea, avísame y usa el que devuelva el shortname.
5. **Foto previa.** Con `core_course_get_contents` guarda el estado del destino: para cada sección, su número, nombre, `id`, y la lista de actividades con su `id` (`cmid`), nombre y visibilidad. Esta foto sirve para comparar después.
6. **Chequeo anti-duplicados.** Si en la foto previa ya existe alguna de las subsecciones o actividades de la "lista esperada" (por nombre), **NO importes**: registra "Ya actualizado (omitido)" y continúa.
7. **Importar** con `core_course_import_course`:

   | Parámetro | Valor |
   |---|---|
   | `importfrom` | id del staging |
   | `importto` | id del curso destino |
   | `deletecontent` | `0` |

   **NO envíes el parámetro `options`** en la primera ejecución. Si Moodle devuelve error, muéstrame el mensaje **exacto**; no agregues opciones ni cambies parámetros por tu cuenta, y no uses la interfaz web.
8. **Si la llamada falla o da timeout, NO reintentes a ciegas** (la importación pudo haberse aplicado). Repite el paso 5 y compara con la foto previa: si ya aparece contenido nuevo, considéralo importado y pasa a verificar; si no hay cambios, reintenta **una sola vez**. Si vuelve a fallar, registra el error exacto y continúa.
9. **Verificar.** Vuelve a leer con `core_course_get_contents` y comprueba:
   - Todo lo de la "lista esperada" aparece en el destino, en la sección correcta.
   - **Todo lo que había en la foto previa sigue ahí**, con los mismos `id` (`cmid`), nombres y visibilidad. Si algún `cmid` previo desapareció o cambió, repórtalo como **discrepancia grave**.
   - No hay secciones duplicadas (por ejemplo, un segundo "1 Momento").
   - La visibilidad del contenido nuevo es la misma que tiene en el staging.
   
   Si algo no coincide, **repórtalo; no lo corrijas por tu cuenta**.

**Si en un curso hay una discrepancia grave, detén el lote completo** y avísame antes de seguir. Para errores simples de un curso (no existe, ya actualizado, timeout), continúa con el siguiente.

## Modo simulación
Si en mi mensaje aparece la palabra **"simulación"**, ejecuta solo el Paso 0, la preparación (A) y los pasos 4, 5 y 6 de cada curso. **No llames a `core_course_import_course`.** Muéstrame la tabla de lo que se importaría y espera mi confirmación.

## Resumen final (tabla)

| Curso destino | ID | Staging | Estado | Contenido agregado | Cambios en lo previo | Error |
|---|---|---|---|---|---|---|

`Estado`: **Importado y verificado**, **Ya actualizado (omitido)**, **No encontrado**, **Discrepancia**, **Error** o **Simulado**.

Añade un resumen corto: cuántos cursos se procesaron, importaron, omitieron y fallaron.

## Reglas generales
- No borres cursos, secciones ni actividades, ni siquiera para "deshacer" un error. Repórtalo y yo decido.
- No modifiques el staging ni ningún curso que no esté en la tarea.
- No matricules, no crees usuarios ni grupos, no toques calificaciones.
- Si Moodle devuelve un error, muestra el mensaje **exacto**.
- Si algo es ambiguo o falta, dilo explícitamente; no lo saltes en silencio.
- Los nombres con acentos o eñas deben enviarse en UTF-8 (usa `--data-urlencode`).
