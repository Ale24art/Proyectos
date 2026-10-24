# Tarea: Importar la Clase 2 en cursos de AM, EP, AO, MTC y AN (1er a 5to Año)

Esta tarea se ejecuta siguiendo las reglas, el flujo y la conexión de `actualizador-de-cursos.md` (token en `copiador-de-cursos.md`).

## Cómo leer este archivo

- Cada bloque `## Bloque N` tiene **un solo curso staging** (origen) y su tabla de cursos destino.
- Trata cada bloque como independiente: el staging de un bloque **nunca** se importa en los cursos de otro bloque.
- En cada bloque el contenido a importar es la **Clase 2** del staging (la subsección "Clase 2" con todas sus actividades).
- **Busca todos los cursos (staging y destinos) por `field=id`.** Confirma que el nombre completo devuelto coincide con el de la tabla; si no coincide, **no importes** en ese curso y repórtalo.
- Antes de importar, registra la estructura completa de cada staging (secciones, subsecciones y actividades, con el número de sección). Esa es la "lista esperada" de ese bloque. **Si el staging contiene también la Clase 1 u otro contenido además de la Clase 2, repórtalo y espera mi decisión antes de importar**, porque se duplicaría contenido en los cursos con estudiantes.
- **Comprobación de coherencia (importante):** en una ejecución anterior se importó por error el staging equivocado. Por eso, en la simulación compara el contenido de la **Clase 1 de cada destino** con el contenido que tendría la clase anterior del staging (nombres de las actividades, temática). Si la Clase 1 del destino parece pertenecer a **otro curso base** distinto del staging del bloque, márcalo como **advertencia** y no importes hasta mi confirmación.

---

## Bloque 1 — Robotica II (1er Año)

- **Staging:** Robotica II copia 1 — **ID 439**

| Nombre completo (referencia) | ID |
|---|---|
| 1er Año-AM | 185 |
| 1er Año-EP | 177 |
| 1er Año-AO | 189 |
| 1er Año-MTC | 192 |
| 1er Año-AN | 197 |

---

## Bloque 2 — STEAMakersBlocks (2do a 4to Año)

- **Staging:** STEAMakersBlocks copia 1 — **ID 437**

| Nombre completo (referencia) | ID |
|---|---|
| 2do Año-AM | 186 |
| 3er Año-AM | 187 |
| 2do Año-EP | 178 |
| 3er Año-EP | 179 |
| 2do Año-AO | 190 |
| 3er Año-AO | 191 |
| 2do Año-MTC | 193 |
| 3er Año-MTC | 194 |
| 2do Año-AN | 198 |
| 3er Año-AN | 199 |
| 4to Año-AN | 184 |

---

## Bloque 3 — Electronica I (4to Año)

- **Staging:** Electronica I copia 1 — **ID 435**

| Nombre completo (referencia) | ID |
|---|---|
| 4to Año-AM | 188 |
| 4to Año-EP | 180 |
| 4to Año-AO | 182 |
| 4to Año-MTC | 195 |

---

## Bloque 4 — Electronica II (5to Año)

- **Staging:** Electronica II copia 1 — **ID 434**

| Nombre completo (referencia) | ID |
|---|---|
| 5to Año-AM | 176 |
| 5to Año-EP | 181 |
| 5to Año-AO | 183 |
| 5to Año-MTC | 196 |

---

## Resultado esperado en cada curso destino

- La **Clase 2** aparece en la **misma sección** donde el staging la tiene (emparejada por número de sección), a continuación de la Clase 1, con la misma visibilidad que en el staging.
- Todo lo que ya había (Clase 1 y demás) sigue intacto, con los mismos `id`, nombres y visibilidad.
- No se crea una sección duplicada (por ejemplo, un segundo "1er Momento") ni una sección suelta.
- No se copia ningún dato de usuario.

## Instrucciones de ejecución

1. Haz primero una **simulación** de todos los bloques: Paso 0, preparación y pasos 4-6. Muéstrame, por bloque:
   - la estructura del staging (lista esperada),
   - por cada destino: id, nombre, resumen de su estructura actual y si ya tiene "Clase 2".

   **Compara la estructura de secciones del staging con la de cada destino.** Si el número o el nombre de la sección que contiene la Clase 2 no coincide (por ejemplo "1 Momento" vs. "1er Momento"), márcalo como **advertencia**. Aplica también la comprobación de coherencia de arriba. **Espera mi confirmación.**
2. **Prueba primero con un solo curso por bloque**: el primero de la tabla de cada bloque (ids 185, 186, 188 y 176). Muéstrame el resultado de esos 4 y **espera mi confirmación** antes de seguir con el resto.
3. Con mi confirmación, importa el resto curso por curso, bloque por bloque, verificando cada uno antes de pasar al siguiente.
4. **Si en algún curso hay una discrepancia grave** (desaparece o cambia algo previo, secciones duplicadas, contenido en una sección equivocada), **detén el bloque en curso** y repórtalo antes de continuar con cualquier otro.
5. Al terminar, entrégame la tabla de resumen (con una columna "Bloque") y, por cada curso, la foto previa y posterior de la sección afectada.

## Notas para mí (no son instrucciones para Claude Code)
- Son 24 cursos en total (5 + 11 + 4 + 4). Haz copia de seguridad de los que tengan estudiantes con entregas activas.
- Las fechas de las tareas de la Clase 2 pueden estar vencidas. Si quieres fechas nuevas, ajústalas en cada staging antes de importar.
- Si un destino ya tiene "Clase 2", se omite el curso completo como "Ya actualizado". Avísame y lo resolvemos caso por caso.
