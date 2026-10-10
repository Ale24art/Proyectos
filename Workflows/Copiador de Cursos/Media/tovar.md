# Tarea: Crear cursos en varios colegios a partir de "Robotica I" y "STEAMakers ESP32"

Esta tarea se ejecuta siguiendo las reglas, el flujo y la conexión de `copiador-de-cursos.md`.

## Cómo leer este archivo

- Cada bloque `## Colegio: ...` tiene **un solo curso base**, **una sola categoría destino** y su tabla de cursos a crear.
- Un mismo colegio puede aparecer en **dos bloques** (uno por cada curso base). Trátalos como bloques independientes, pero reutiliza el `id` de la categoría y del curso base si ya los resolviste antes en esta ejecución.


## Configuración general

- **Visibilidad de los cursos nuevos:** 1        <!-- 1 = visibles, 0 = ocultos -->

---
## Colegio: La Presentación Tovar — 1er a 3er año (Robotica I)

- **Curso base (shortname):** robotica1estudiante
- **Curso base (nombre completo, referencia):** Robotica I
- **Curso base (ID de referencia):** 110
- **Categoría destino:** La Presentación Tovar
- **Categoría padre de la destino:** TecnoCleveland Colegios      <!-- para distinguir si hay nombres repetidos -->

| Nombre completo | Nombre corto |
|---|---|
| 1er Año-PT | 1styear-pt |
| 2do Año-PT | 2ndyear-pt |
| 3er Año-PT | 3rdyear-pt |

---

## Colegio: La Presentación Tovar — 4to a 5to año (STEAMakers ESP32)

- **Curso base (shortname):** esp32_estudiante
- **Curso base (nombre completo, referencia):** STEAMakers ESP32
- **Curso base (ID de referencia):** 119
- **Categoría destino:** La Presentación Tovar
- **Categoría padre de la destino:** TecnoCleveland Colegios      <!-- para distinguir si hay nombres repetidos -->

| Nombre completo | Nombre corto |
|---|---|
| 4to Año-PT | 4thyear-pt |
| 5to Año-PT | 5thyear-pt |

---
---

<!--
Para agregar otro colegio: copia un bloque "## Colegio" completo, cambia la categoría destino,
el sufijo de los nombres y, si aplica, el curso base. El nombre corto debe ser ÚNICO en toda la plataforma.
-->
