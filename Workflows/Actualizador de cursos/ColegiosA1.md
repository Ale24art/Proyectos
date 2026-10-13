# Tarea: Importar la Clase 2 en cursos de 1er a 5to Año (Robotica I, ESP32 y STEAMakersBlocks)

Esta tarea se ejecuta siguiendo las reglas, el flujo y la conexión de `actualizador-de-cursos.md` (token en `copiador-de-cursos.md`).

## Cómo leer este archivo

- Cada bloque `## Bloque N` tiene **un solo curso staging** (origen) y su tabla de cursos destino.
- Trata cada bloque como independiente: el staging de un bloque **nunca** se importa en los cursos de otro bloque.
- En cada bloque el contenido a importar es la **Clase 2** del staging (la subsección "Clase 2" con todas sus actividades).
- **Busca todos los cursos (staging y destinos) por `field=id`.** Confirma que el nombre completo devuelto coincide con el de la tabla; si no coincide, **no importes** en ese curso y repórtalo.
- Antes de importar, registra la estructura completa de cada staging (secciones, subsecciones y actividades, con el número de sección). Esa es la "lista esperada" de ese bloque. **Si el staging contiene también la Clase 1 u otro contenido además de la Clase 2, repórtalo y espera mi decisión antes de importar**, porque se duplicaría contenido en los cursos con estudiantes.

---

## Bloque 1 — Robotica I (1er a 3er Año)

- **Staging:** Robotica I copia 1 — **ID 440**

| Nombre completo (referencia) | ID |
|---|---|
| 1er Año-JMV | 122 |
| 2do Año-JMV | 123 |
| 3er Año-JMV | 124 |
| 1er Año-TJQ | 127 |
| 2do Año-TJQ | 128 |
| 3er Año-TJQ | 129 |
| 1er Año-MONFIH | 132 |
| 2do Año-MONFIH | 133 |
| 3er Año-MONFIH | 134 |
| 1er Año-SS | 137 |
| 2do Año-SS | 138 |
| 3er Año-SS | 139 |
| 1er Año-PAL | 142 |
| 2do Año-PAL | 143 |
| 3er Año-PAL | 144 |
| 1er Año-LM | 147 |
| 2do Año-LM | 148 |
| 3er Año-LM | 149 |
| 1er Año-CS | 152 |
| 2do Año-CS | 153 |
| 3er Año-CS | 154 |
| 1er Año-MIDC | 157 |
| 2do Año-MIDC | 158 |
| 1er Año-RS | 162 |
| 2do Año-RS | 163 |
| 3er Año-RS | 164 |
| 1er Año-DCA | 167 |
| 2do Año-DCA | 168 |
| 3er Año-DCA | 169 |
| 1er Año-EA | 172 |
| 2do Año-EA | 173 |
| 3er Año-EA | 427 |
| 1er Año-CR | 175 |
| 1er Año-PT | 420 |
| 2do Año-PT | 421 |
| 3er Año-PT | 422 |

---

## Bloque 2 — STEAMakers ESP32 (4to y 5to Año)

- **Staging:** STEAMakers ESP32 copia 1 — **ID 436**

| Nombre completo (referencia) | ID |
|---|---|
| 4to Año-JMV | 125 |
| 5to Año-JMV | 126 |
| 4to Año-TJQ | 130 |
| 5to Año-TJQ | 131 |
| 4to Año-MONFIH | 135 |
| 5to Año-MONFIH | 136 |
| 4to Año-SS | 140 |
| 5to Año-SS | 141 |
| 4to Año-PAL | 145 |
| 4to Año-LM | 150 |
| 5to Año-LM | 151 |
| 4to Año-CS | 155 |
| 5to Año-CS | 156 |
| 4to Año-MIDC | 160 |
| 5to Año-MIDC | 161 |
| 4to Año-RS | 165 |
| 5to Año-RS | 166 |
| 4to Año-DCA | 170 |
| 5to Año-DCA | 171 |

---

## Bloque 3 — STEAMakersBlocks

- **Staging:** STEAMakersBlocks copia 1 — **ID 437**

| Nombre completo (referencia) | ID |
|---|---|
| 3er Año-MIDC | 245 |
| 4to Año-PT | 425 |
| 5to Año-PT | 426 |

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

   **Compara la estructura de secciones del staging con la de cada destino.** Si el número o el nombre de la sección que contiene la Clase 2 no coincide (por ejemplo "1 Momento" vs. "1er Momento"), márcalo como **advertencia**. **Espera mi confirmación.**
2. **Prueba primero con un solo curso por bloque**: el primero de la tabla de cada bloque (ids 122, 125 y 245). Muéstrame el resultado de esos 3 y **espera mi confirmación** antes de seguir con el resto.
3. Con mi confirmación, importa el resto curso por curso, bloque por bloque, verificando cada uno antes de pasar al siguiente.
4. **Si en algún curso hay una discrepancia grave** (desaparece o cambia algo previo, secciones duplicadas, contenido en una sección equivocada), **detén el bloque en curso** y repórtalo antes de continuar con cualquier otro.
5. Al terminar, entrégame la tabla de resumen (con una columna "Bloque") y, por cada curso, la foto previa y posterior de la sección afectada.

## Notas para mí (no son instrucciones para Claude Code)
- Son 58 cursos en total (36 + 19 + 3). Haz copia de seguridad de los que tengan estudiantes con entregas activas.
- Las tareas de la Clase 2 en Robótica tenían apertura el 21 y cierre el 28 de septiembre de 2026, ya vencidas. Si quieres fechas nuevas, ajústalas en cada staging antes de importar.
- Si un destino ya tiene "Clase 2", se omite el curso completo como "Ya actualizado". Avísame y lo resolvemos caso por caso.
