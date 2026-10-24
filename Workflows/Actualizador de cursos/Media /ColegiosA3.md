# Tarea: Importar la Clase 2 en cursos de AG, AH, FM, RC, SJE, GM, SCA, SM y DC (1er a 5to Año)

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
| 1er Año-AG | 200 |
| 1er Año-AH | 205 |
| 1er Año-FM | 210 |
| 1er Año-RC | 215 |
| 1er Año-SJE | 220 |
| 1er Año-GM | 225 |
| 1er Año-SCA | 230 |
| 1er Año-SM | 235 |
| 1er Año-DC | 240 |

---

## Bloque 2 — Diseño 3D (2do Año; en RC, 3er Año)

- **Staging:** Diseño 3D copia 1 — **ID 438**

| Nombre completo (referencia) | ID |
|---|---|
| 2do Año-AG | 201 |
| 2do Año-AH | 206 |
| 2do Año-FM | 211 |
| 3er Año-RC | 217 |
| 2do Año-SJE | 221 |
| 2do Año-GM | 226 |
| 2do Año-SCA | 231 |
| 2do Año-SM | 236 |
| 2do Año-DC | 241 |

---

## Bloque 3 — STEAMakersBlocks (3er Año; en RC, 2do Año)

- **Staging:** STEAMakersBlocks copia 1 — **ID 437**

| Nombre completo (referencia) | ID |
|---|---|
| 3er Año-AG | 202 |
| 3er Año-AH | 207 |
| 3er Año-FM | 212 |
| 2do Año-RC | 216 |
| 3er Año-SJE | 222 |
| 3er Año-GM | 227 |
| 3er Año-SCA | 232 |
| 3er Año-SM | 237 |
| 3er Año-DC | 242 |

---

## Bloque 4 — Electronica I (4to Año)

- **Staging:** Electronica I copia 1 — **ID 435**

| Nombre completo (referencia) | ID |
|---|---|
| 4to Año-AG | 203 |
| 4to Año-AH | 208 |
| 4to Año-FM | 213 |
| 4to Año-RC | 218 |
| 4to Año-SJE | 223 |
| 4to Año-GM | 228 |
| 4to Año-SCA | 233 |
| 4to Año-SM | 238 |
| 4to Año-DC | 243 |

---

## Bloque 5 — Electronica II (5to Año)

- **Staging:** Electronica II copia 1 — **ID 434**

| Nombre completo (referencia) | ID |
|---|---|
| 5to Año-AG | 204 |
| 5to Año-AH | 209 |
| 5to Año-FM | 214 |
| 5to Año-RC | 219 |
| 5to Año-SJE | 224 |
| 5to Año-GM | 229 |
| 5to Año-SCA | 234 |
| 5to Año-SM | 239 |
| 5to Año-DC | 244 |

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
2. **Prueba primero con un solo curso por bloque**: el primero de la tabla de cada bloque (ids 200, 201, 202, 203 y 204). Muéstrame el resultado de esos 5 y **espera mi confirmación** antes de seguir con el resto.
3. Con mi confirmación, importa el resto curso por curso, bloque por bloque, verificando cada uno antes de pasar al siguiente.
4. **Si en algún curso hay una discrepancia grave** (desaparece o cambia algo previo, secciones duplicadas, contenido en una sección equivocada), **detén el bloque en curso** y repórtalo antes de continuar con cualquier otro.
5. Al terminar, entrégame la tabla de resumen (con una columna "Bloque") y, por cada curso, la foto previa y posterior de la sección afectada.

## Notas para mí (no son instrucciones para Claude Code)
- Son 45 cursos en total (9 por bloque). Haz copia de seguridad de los que tengan estudiantes con entregas activas.
- Las fechas de las tareas de la Clase 2 pueden estar vencidas. Si quieres fechas nuevas, ajústalas en cada staging antes de importar.
- Si un destino ya tiene "Clase 2", se omite el curso completo como "Ya actualizado". Avísame y lo resolvemos caso por caso.
- El colegio RC es el único donde el 2do Año (id 216) va con STEAMakersBlocks y el 3er Año (id 217) con Diseño 3D; en los demás colegios es al revés. Lo dejé como lo indicaste.
