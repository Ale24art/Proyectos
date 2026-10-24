# Tarea: Importar Tema 4 y Tema 5 de Knex (A1, A2 y A3) en cursos de 1er y 2do Grado

Esta tarea se ejecuta siguiendo las reglas, el flujo y la conexión de `actualizador-de-cursos.md` (token en `copiador-de-cursos.md`).

## Cómo leer este archivo

- Cada bloque `## Bloque N` tiene **un solo curso staging** (origen) y su tabla de cursos destino.
- Trata cada bloque como independiente: el staging de un bloque **nunca** se importa en los cursos de otro bloque.
- En cada bloque el contenido a importar son las subsecciones **Tema 4** y **Tema 5** del staging.
- **Busca todos los cursos (staging y destinos) por `field=id`.** Confirma que el nombre completo devuelto coincide con el de la tabla; si no coincide, **no importes** en ese curso y repórtalo.
- Antes de importar, registra la estructura completa de cada staging (secciones, subsecciones y actividades, con el número de sección). Esa es la "lista esperada" de ese bloque.
- **El staging debe contener solo Tema 4 y Tema 5.** Los cursos destino ya tienen Tema 1, 2 y 3 (u otros temas anteriores). Si un staging contiene además cualquiera de esos temas u otro contenido, repórtalo y **espera mi decisión antes de importar**, porque se duplicaría contenido en cursos con estudiantes.
- **Comprobación de coherencia:** en la simulación compara el contenido de los temas anteriores de cada destino (nombres de las actividades, temática) con el del staging de su bloque. Si los temas previos del destino parecen pertenecer a **otro curso base** (por ejemplo, un destino de Knex A1 en un bloque de Knex A2), márcalo como **advertencia** y no importes hasta mi confirmación.

---

## Bloque 1 — Knex A2, 1er Grado

- **Staging:** Knex A2 1er grado copia 1 — **ID 461**

| Nombre completo (referencia) | ID |
|---|---|
| 1er Grado-AO | 324 |
| 1er Grado-AN | 330 |
| 1er Grado-EP | 336 |
| 1er Grado-MTC | 342 |
| 1er Grado-SCA | 348 |
| 1er Grado-SM | 354 |

---

## Bloque 2 — Knex A2, 2do Grado

- **Staging:** Knex A2 2do grado copia 1 — **ID 462**

| Nombre completo (referencia) | ID |
|---|---|
| 2do Grado-AO | 325 |
| 2do Grado-AN | 331 |
| 2do Grado-EP | 337 |
| 2do Grado-MTC | 343 |
| 2do Grado-SCA | 349 |
| 2do Grado-SM | 355 |

---

## Bloque 3 — Knex A1, 1er Grado

- **Staging:** Knex A1 1er grado copia 1 — **ID 459**

| Nombre completo (referencia) | ID |
|---|---|
| 1er Grado-JMV | 246 |
| 1er Grado-TJQ | 252 |
| 1er Grado-SS | 258 |
| 1er Grado-PAL | 264 |
| 1er Grado-LM | 270 |
| 1er Grado-SRL | 276 |
| 1er Grado-CS | 282 |
| 1er Grado-MIDC | 288 |
| 1er Grado-EA | 294 |
| 1er Grado-MONFIH | 300 |
| 1er Grado-RS | 306 |
| 1er Grado-DCA | 312 |
| 1er Grado-PT | 318 |

---

## Bloque 4 — Knex A1, 2do Grado

- **Staging:** Knex A1 2do grado copia 1 — **ID 460**

| Nombre completo (referencia) | ID |
|---|---|
| 2do Grado-JMV | 247 |
| 2do Grado-TJQ | 253 |
| 2do Grado-SS | 259 |
| 2do Grado-PAL | 265 |
| 2do Grado-LM | 271 |
| 2do Grado-SRL | 277 |
| 2do Grado-CS | 283 |
| 2do Grado-MIDC | 289 |
| 2do Grado-EA | 295 |
| 2do Grado-MONFIH | 301 |
| 2do Grado-RS | 307 |
| 2do Grado-DCA | 313 |
| 2do Grado-PT | 319 |

---

## Bloque 5 — Knex A3, 1er Grado

- **Staging:** Knex A3 1er grado copia 1 — **ID 463**

| Nombre completo (referencia) | ID |
|---|---|
| 1er Grado-AH | 360 |
| 1er Grado-AG | 366 |
| 1er Grado-FM | 372 |
| 1er Grado-AM | 378 |
| 1er Grado-CR | 384 |
| 1er Grado-GM | 390 |
| 1er Grado-DC | 396 |
| 1er Grado-RC | 402 |
| 1er Grado-SA | 408 |
| 1er Grado-SJE | 414 |

---

## Resultado esperado en cada curso destino

- Tema 4 y Tema 5 aparecen en la **misma sección** donde el staging los tiene (emparejada por número de sección), a continuación de los temas ya existentes, con la misma visibilidad que en el staging.
- Todo lo que ya había (Tema 1, 2, 3, foros y demás) sigue intacto, con los mismos `id`, nombres y visibilidad.
- No se crea una sección duplicada ni una sección suelta.
- No se copia ningún dato de usuario.

## Instrucciones de ejecución

1. Haz primero una **simulación** de todos los bloques: Paso 0, preparación y pasos 4-6. Muéstrame, por bloque:
   - la estructura del staging (lista esperada),
   - por cada destino: id, nombre, resumen de su estructura actual y si ya tiene Tema 4 o Tema 5.

   **Compara la estructura de secciones del staging con la de cada destino.** Si el número o el nombre de la sección que contiene los temas no coincide, márcalo como **advertencia**. Aplica también la comprobación de coherencia de arriba. **Espera mi confirmación.**
2. **Prueba primero con un solo curso por bloque**: el primero de la tabla de cada bloque (ids 324, 325, 246, 247 y 360). Muéstrame el resultado de esos 5 y **espera mi confirmación** antes de seguir con el resto.
3. Con mi confirmación, importa el resto curso por curso, bloque por bloque, verificando cada uno antes de pasar al siguiente.
4. **Si en algún curso hay una discrepancia grave** (desaparece o cambia algo previo, secciones duplicadas, contenido en una sección equivocada), **detén el bloque en curso** y repórtalo antes de continuar con cualquier otro.
5. Al terminar, entrégame la tabla de resumen (con una columna "Bloque") y, por cada curso, la foto previa y posterior de la sección afectada.

## Notas para mí (no son instrucciones para Claude Code)
- Son 48 cursos en total (6 + 6 + 13 + 13 + 10). Haz copia de seguridad de los que tengan estudiantes con entregas activas.
- Revisa las fechas de las tareas en cada staging antes de importar; si ya vencieron, ajústalas allí.
- Si un destino ya tiene Tema 4 o Tema 5, se omite el curso completo como "Ya actualizado". Avísame y lo resolvemos caso por caso.
- Esta tarea no incluye Knex A3 2do grado, porque no lo indicaste.
