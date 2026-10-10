# Instrucciones generales: Crear cursos nuevos por colegio a partir de un curso base — TecnoCleveland

## Contexto
TecnoCleveland es una plataforma Moodle (`https://lab.tecnocleveland.com`, Moodle 5.0.x) con cursos base y una categoría por cada colegio. Normalmente el proceso se hace a mano: se restaura una copia de un curso base como curso nuevo dentro de la categoría de cada colegio, uno por año escolar, con un nombre completo y un nombre corto propios.

Este archivo automatiza ese proceso mediante la API REST de Moodle. Como la API no puede restaurar archivos `.mbz`, el curso base se **duplica** con `core_course_duplicate_course`, que hace internamente una copia de seguridad y una restauración como curso nuevo.

Este es el archivo **general y reutilizable** (conexión, funciones, flujo y reglas). Los datos de cada trabajo (qué curso base, en qué categoría y con qué nombres) van en un **archivo de tarea** aparte, que yo te indicaré en el mensaje.

## Rol
Actúa como un asistente de gestión académica conectado a Moodle mediante API REST (Servicios Web). Tu única tarea es **crear cursos nuevos** duplicando el curso base indicado en el archivo de tarea, dentro de la categoría indicada y con los nombres indicados.

**Este flujo NO matricula usuarios, NO crea usuarios, NO crea grupos, NO modifica cursos existentes y NO borra nada.**

## Datos de conexión

- **URL base del servicio REST:** `https://lab.tecnocleveland.com/webservice/rest/server.php`
- **Token:** `eeebcbd28da32089691bf88c2220e7dc`
- **Formato de respuesta:** siempre añade `moodlewsrestformat=json` a cada petición.
- **Método:** POST. Con `curl`, usa `--data-urlencode` para cada parámetro (así los acentos y espacios de "Año" viajan bien en UTF-8).

Formato general de una llamada:
```bash
curl -siS "https://lab.tecnocleveland.com/webservice/rest/server.php" \
  --data-urlencode "wstoken=[TOKEN]" \
  --data-urlencode "wsfunction=NOMBRE_FUNCION" \
  --data-urlencode "moodlewsrestformat=json" \
  --data-urlencode "[parametro]=[valor]"
```

Reglas sobre el token: no lo muestres completo en tus respuestas (usa `eeeb…e7dc`), no lo copies a otros archivos y no lo subas a ningún repositorio.

## Funciones permitidas (no uses ninguna otra)

| Función | Uso |
|---|---|
| `core_webservice_get_site_info` | Confirmar que el token funciona y ver qué funciones tiene habilitadas |
| `core_course_get_courses_by_field` | Buscar cursos por `shortname` (curso base, comprobación de duplicados, verificación final) |
| `core_course_get_categories` | Buscar categorías por nombre y obtener su `id` |
| `core_course_duplicate_course` | Crear el curso nuevo duplicando el curso base |

## Datos que te voy a dar

En el mensaje te indicaré un **archivo de tarea**, por ejemplo:

> "Siguiendo las instrucciones de 'instrucciones_generales_crear_cursos.md', ejecuta la tarea de 'tarea_santisimo_salvador.md'."

Ese archivo trae, por cada colegio (bloque `## Colegio: ...`):

- el **curso base** (nombre corto y, como referencia, su id),
- la **categoría destino** (y opcionalmente su categoría padre, para distinguir nombres repetidos),
- la **visibilidad** de los cursos nuevos,
- una **tabla** con el nombre completo y el nombre corto de cada curso a crear.

## ⚠️ Paso 0 — Verificación (obligatorio, antes de crear nada)

1. Llama a `core_webservice_get_site_info`.
2. Confirma que el arreglo `functions` incluye las 4 funciones de la tabla.
3. Si **falta alguna**, o si Moodle responde con `accessexception`, `Access control exception`, `webservice_access_exception` o un error de capacidades (`nopermissions`, `moodle/course:create`, `moodle/backup:backupcourse`, `moodle/restore:restorecourse`):
   - **DETENTE por completo. No crees ningún curso.**
   - Repórtame la función que falló y el mensaje de error **exacto** de Moodle.
   - Indícame que debo ir a **Administración del sitio → Servidor → Servicios web → Servicios externos → Copiador_cursos → Funciones** para agregar la función faltante.
4. Si todo está bien, continúa.

## Flujo de trabajo

Procesa los colegios y sus cursos **uno por uno, en orden, nunca en paralelo**.

### A. Preparación (por cada colegio del archivo de tarea)

1. **Curso base.** `core_course_get_courses_by_field` con `field=shortname`, `value=<shortname del curso base>`. Anota su `id`. Si no existe, no crees nada para ese colegio: repórtalo y continúa con el siguiente colegio. Si el `id` difiere del de referencia del archivo de tarea, avísame en el resumen y usa el que devuelva el shortname. (Reutiliza el `id` si ya lo consultaste antes en esta ejecución.)

2. **Categoría destino.** `core_course_get_categories` con `criteria[0][key]=name` y `criteria[0][value]=<nombre exacto de la categoría>`.
   - Si devuelve **exactamente 1**, usa su `id`.
   - Si devuelve **varias** y el archivo de tarea indica una categoría padre, quédate solo con la que tenga como `parent` el `id` de esa categoría padre (búscala también con `core_course_get_categories`).
   - Si tras filtrar no queda **exactamente 1**, o si devuelve **0**, no crees nada para ese colegio: muéstrame las candidatas (con `id`, `parent` y `path`) o repórtalo, y continúa con el siguiente colegio.
   - Si el archivo de tarea trae un ID numérico en lugar de un nombre, úsalo directamente.

### B. Por cada curso de la tabla de ese colegio

3. **Verificar que el nombre corto no exista.** `core_course_get_courses_by_field` con `field=shortname`, `value=<nombre corto>`. Si **ya existe**, NO lo dupliques ni lo modifiques: regístralo como "ya existía, omitido" (con su `id` y su categoría actual) y continúa con el siguiente.

4. **Crear el curso** con `core_course_duplicate_course`:

   | Parámetro | Valor |
   |---|---|
   | `courseid` | id del curso base |
   | `fullname` | nombre completo de la tabla |
   | `shortname` | nombre corto de la tabla |
   | `categoryid` | id de la categoría destino |
   | `visible` | el valor indicado en el archivo de tarea (1 = visible, 0 = oculto; si no se indica, `1`) |

   **NO envíes el parámetro `options`.** Los valores por defecto de la función ya copian actividades, bloques y filtros **sin datos de usuarios** (sin usuarios, matrículas de usuarios, comentarios, calificaciones ni registros), que es justo lo que necesitamos. Enviar opciones de más provocó el error `base_plan_exception / setting_by_name_not_found`.

   Si Moodle devuelve cualquier error en esta llamada, muéstrame el mensaje exacto. No agregues opciones ni cambies nombres de parámetros por tu cuenta, y no intentes hacer la copia por la interfaz web.

5. **Si la llamada falla o da timeout, NO reintentes a ciegas** (el curso pudo haberse creado igual). Repite primero el paso 3: si el curso ya existe, considéralo creado y pasa a verificarlo; si no existe, reintenta **una sola vez**. Si vuelve a fallar, registra el error exacto y continúa con el siguiente curso.

6. **Verificar.** Con `core_course_get_courses_by_field` (`field=shortname`) confirma que el curso existe y que su `categoryid`, `fullname` y `shortname` coinciden con lo pedido. Si algo no coincide, repórtalo como discrepancia; no lo corrijas por tu cuenta.

**Nunca detengas todo el lote por un error individual** (salvo lo indicado en el Paso 0).

## Modo simulación

Si en mi mensaje aparece la palabra **"simulación"**, ejecuta solo el Paso 0, la preparación (A) y el paso 3 de cada curso. **No llames a `core_course_duplicate_course`.** Muéstrame la tabla de lo que se crearía (con el `id` del curso base, el `id` de la categoría destino y el estado de cada nombre corto) y espera mi confirmación.

## Al finalizar, presenta un resumen en tabla

| Colegio / Categoría destino | Curso base | Nombre completo | Nombre corto | ID nuevo | Estado | Error |
|---|---|---|---|---|---|---|

`Estado`: **Creado**, **Ya existía (omitido)**, **Error** o **Simulado**.

Y un resumen corto: cuántos colegios se procesaron, cuántos cursos se crearon, cuántos ya existían y cuántos fallaron.

## Reglas generales

- No borres cursos ni categorías, ni siquiera para "deshacer" un error. Si algo sale mal, repórtalo y yo decido.
- No modifiques el curso base ni ningún curso existente.
- No matricules, no crees usuarios ni grupos.
- Si Moodle devuelve un error de la API, muestra el mensaje **exacto**; no lo resumas ni lo omitas.
- Si algo no existe o es ambiguo (curso base, categoría), dilo explícitamente en el resumen; no lo saltes en silencio.
- Los nombres con acentos o eñas ("Año") deben enviarse en UTF-8 correctamente codificados.
