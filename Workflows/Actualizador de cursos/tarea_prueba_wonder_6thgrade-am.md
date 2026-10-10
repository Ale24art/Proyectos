# Tarea de PRUEBA: Importar Tema 3 y Tema 4 de Wonder en un solo curso

Esta tarea se ejecuta siguiendo las reglas, el flujo y la conexión de `actualizador-de-cursos.md` (token en `copiador-de-cursos.md`).

## Objetivo
Probar el comportamiento de la importación en **un solo curso** antes de aplicarla a todos. **No proceses ningún otro curso.**

## Curso staging (origen)

- **Nombre completo:** Wonder copia 1
- **Nombre corto:** wonderestudiante_1   <!-- si no coincide, busca por ID y avísame -->
- **ID:** 428
- **Categoría:** Cursos Staging
- **Contenido esperado:** sección "1 Momento" con las subsecciones **Tema 3** y **Tema 4** (cada una con una actividad H5P "Clase N: ¡Misión...!" y una tarea "Clase N: Reto microbit...").
- Busca este curso por **`field=id`, `value=428`** y confirma su nombre corto.

## Curso destino (único)

| Nombre completo | Nombre corto | ID de referencia | Categoría |
|---|---|---|---|
| 6to Grado-AM | 6thgrade-am | 383 | TecnoCleveland Colegios / Arturo Michelena |

- **Estado actual del destino (referencia):** sección 0 "General" con un Foro; sección 1 "1 Momento" con las subsecciones **Tema 1** (visible) y **Tema 2** (oculta a estudiantes).

## Resultado esperado

- En "1 Momento" del destino aparecen **Tema 3** y **Tema 4** después de Tema 2, ocultas a estudiantes (como están en el staging).
- **Tema 1, Tema 2 y el Foro** siguen intactos, con los mismos `id`, nombres y visibilidad.
- **No** se crea una segunda sección "1 Momento" ni otra sección suelta.
- No se copia ningún dato de usuario.

## Instrucciones de ejecución

1. Haz primero una **simulación**: Paso 0, preparación y pasos 4-6. Muéstrame la "lista esperada" del staging y la foto previa del destino. **Espera mi confirmación.**
2. Con mi confirmación, ejecuta la importación (pasos 7-9) **solo en `6thgrade-am`**.
3. Al terminar, muéstrame:
   - la foto **previa** y la foto **posterior** del destino, lado a lado (secciones y actividades con sus `id`),
   - la tabla de resumen,
   - cualquier diferencia no esperada, incluyendo: secciones duplicadas, nombre de sección distinto ("1 Momento" vs. "1er Momento"), cambios de visibilidad, actividades de Tema 1/Tema 2 que cambiaron.

## Notas para mí (no son instrucciones para Claude Code)
- Antes de ejecutar, haz una copia de seguridad de `6thgrade-am` desde Moodle (Copia de seguridad del curso) por si hay que revisar algo.
- Las fechas de las tareas del staging (14 a 21 de septiembre de 2026) ya pasaron. Si quieres que lleguen con fechas nuevas, cámbialas en el staging antes de importar.
- Si el resultado es correcto, el siguiente paso es una tarea con la lista completa de cursos destino.
