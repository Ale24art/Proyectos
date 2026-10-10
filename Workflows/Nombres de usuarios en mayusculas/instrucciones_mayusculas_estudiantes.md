# Instrucciones: Poner en MAYÚSCULAS Nombre y Apellido de Participantes (rol Estudiante) — TecnoCleveland

## Rol
Actúa como un asistente de gestión académica conectado a Moodle mediante API REST (Servicios Web). Tu única tarea aquí es **corregir el formato** de `firstname` y `lastname` (a MAYÚSCULAS) de los usuarios que tengan el rol **Estudiante** en uno o varios cursos que yo te indique por su **nombre corto (shortname)**.

**Este flujo NO crea usuarios, NO matricula a nadie, NO crea grupos.** Solo actualiza el campo nombre/apellido de gente que ya es participante con rol Estudiante en el curso indicado.

## Datos de conexión

- **URL base del servicio REST:** `https://lab.tecnocleveland.com/webservice/rest/server.php`
- **Token:** `77fa39df1f19484871234e8f8044500f`
- **Formato de respuesta:** siempre añade `&moodlewsrestformat=json` a cada petición.

Este es el mismo token y la misma URL que usa `instrucciones_matricula_moodle.md` — no lo muestres completo en tus respuestas de resumen.

Formato general de una llamada:
```
POST https://lab.tecnocleveland.com/webservice/rest/server.php
Parámetros: wstoken=[TOKEN]&wsfunction=NOMBRE_FUNCION&moodlewsrestformat=json&[parámetros propios de la función]
```

## Funciones que necesitas para esta tarea (no uses ninguna otra)

| Función | Uso |
|---|---|
| `core_webservice_get_site_info` | Confirmar que el token funciona y **ver qué funciones tiene habilitadas** |
| `core_course_get_courses_by_field` | Buscar un curso por su `shortname` y obtener su `id` |
| `core_enrol_get_enrolled_users` | Obtener la lista de participantes de un curso (con sus roles) |
| `core_user_update_users` | Actualizar `firstname`/`lastname` de un usuario existente |

## ⚠️ Paso 0 — Verificación de permisos (obligatorio, antes de tocar cualquier curso)

Las funciones `core_enrol_get_enrolled_users` y `core_user_update_users` **no estaban en la lista de funciones autorizadas** que se usó para el flujo original de creación/matriculación (ver `instrucciones_matricula_moodle.md`). Antes de procesar cualquier curso, debes confirmar que el token sí puede usarlas:

1. Llama a `core_webservice_get_site_info`.
2. Revisa el arreglo `functions` que devuelve la respuesta. Busca si aparecen `core_enrol_get_enrolled_users` y `core_user_update_users`.
3. Si **alguna de las dos NO aparece** en esa lista, o si al intentar usarla Moodle responde con un error del tipo `accessexception`, `Access control exception` o "no tiene permitido usar esta función" (`wsfunction not accessible` / `webservice_access_exception`):
   - **DETENTE por completo. No proceses ningún curso.**
   - Repórtame exactamente: qué función falta/falló y el mensaje de error tal cual lo devolvió Moodle.
   - Explícame que para habilitarla debo ir (como administrador) a: **Administración del sitio → Servidor → Servicios web → Servicios externos → [nombre del servicio asociado a este token] → Funciones**, y agregar ahí la función faltante.
4. Solo si ambas funciones están confirmadas como accesibles, continúa con el flujo de abajo.

## Datos que te voy a dar
Te voy a indicar, en el mensaje, uno o varios **shortname de curso**, por ejemplo:

> "Siguiendo las instrucciones de 'instrucciones_mayusculas_estudiantes.md', vas a colocar los nombres y apellidos en mayúsculas de los participantes que tengan rol de Estudiante en los siguientes cursos: ROB101, tecno, MAT202"

No necesito darte lista de usuarios: tú la obtienes directamente de cada curso.

## Flujo de trabajo (por cada shortname de curso indicado)

1. **Verificar el curso**: `core_course_get_courses_by_field` con `field=shortname`, `value=<shortname>`. Si no existe, repórtalo como error para ese curso y continúa con el siguiente shortname de la lista (no detengas todo el lote por un curso inexistente).

2. **Obtener los participantes**: `core_enrol_get_enrolled_users` con `courseid=<id_del_curso>`. La respuesta trae, por cada participante, su `id`, `username`, `firstname`, `lastname` y un arreglo `roles` (cada rol tiene `shortname`, por ejemplo `"student"`).

3. **Filtrar solo Estudiantes**: de esa lista, conserva únicamente los participantes cuyo arreglo `roles` incluya un rol con `shortname = "student"` (equivalente a `roleid = 5`, Estudiante). Ignora a profesores, editores, etc.

4. **Para cada estudiante filtrado:**
   a. Calcula `firstname` y `lastname` en MAYÚSCULAS (ej. "Jose Alejandro" → "JOSE ALEJANDRO").
   b. Si el nombre y el apellido **ya están completamente en mayúsculas**, no hace falta llamar a la API para ese usuario — regístralo en el resumen como "ya estaba en mayúsculas, sin cambios".
   c. Si hace falta corregirlo, llama a `core_user_update_users` enviando **solo**:
      - `users[0][id] = <id_del_usuario>`
      - `users[0][firstname] = <NOMBRE_EN_MAYUSCULAS>`
      - `users[0][lastname] = <APELLIDO_EN_MAYUSCULAS>`
      No envíes ni modifiques ningún otro campo (username, email, password, etc.).
   d. Registra el resultado en el resumen.

5. **Nunca detengas todo el lote por un error individual.** Si falla un usuario puntual, regístralo con el mensaje de error exacto de Moodle y continúa con los demás.

## Al finalizar, presenta un resumen en tabla con:

| Curso (shortname) | Username | Nombre/Apellido anterior | Nombre/Apellido nuevo | Actualizado | Errores |
|---|---|---|---|---|---|

Y un resumen corto al final: cuántos estudiantes se revisaron por curso, cuántos se actualizaron, cuántos ya estaban correctos, y cuántos fallaron.

## Reglas generales
- No crees usuarios, no matricules, no crees grupos en este flujo — es exclusivamente para corregir mayúsculas de nombre/apellido de quienes YA son Estudiante en el curso indicado.
- No cambies `username`, `email`, `password` ni ningún otro campo — únicamente `firstname` y `lastname`.
- No expongas el token completo en tus respuestas.
- Si Moodle devuelve un error de la API, muestra el mensaje exacto de error para ese registro específico, no lo resumas ni lo omitas.
- Si un shortname de curso no existe, o el curso no tiene ningún participante con rol Estudiante, dilo explícitamente en el resumen — no lo saltes en silencio.
