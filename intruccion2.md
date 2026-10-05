# INSTRUCCIÓN para Claude Code — Nombres de archivo en las descargas CSV y XLSX

**Repositorio:** `Proyectos/` · **Código a modificar:** solo `Organizador_moodle/` (más una nota breve en `documentacion_organizador_moodle.md`).
**Idioma:** todo en español.

## 0. Contexto y reglas

Lee antes `documentacion_organizador_moodle.md` (§5.2, §6) y ubica las funciones **por nombre** con grep, no por número de línea.

- No tocar ni renombrar `tc_organizador_data`. **Este cambio no toca el esquema de datos**, así que no se modifica `freshData()`, `loadData()` ni `importBackup()`.
- No ejecutes `git push`, `git commit` ni `firebase deploy`.
- No cambies ningún otro comportamiento (contenido de los archivos, columnas, codificación, orden de años, etc.). Solo cambia **el nombre del archivo descargado**.

## 1. Qué se quiere

### 1.1 Generador de usuarios → "Descargar CSV"
El archivo debe llamarse con el **año/grado + el grupo**, por ejemplo:

- `5to año A.csv`
- `1er grado B.csv`
- Si la lista no tiene grupo: `5to año.csv`

Aplica a **todos** los puntos donde el Generador de usuarios descarga un CSV: el botón de la vista previa (lista recién generada) y el botón de descarga por año+grupo en "Años ya generados" (incluida la vista Ver/Editar si tiene el suyo). Localízalos todos con grep (`buildUsuariosCSV`, `.csv`, `download`, `Blob`) y que usen **la misma función de nombrado**.

### 1.2 Colegios → Participantes → "⬇ Descargar XLSX"
El archivo debe llamarse con el **año/grado seleccionado**, por ejemplo:

- `5to año.xlsx`
- `1er grado.xlsx`

Si en el selector hay un **grupo específico** elegido (no "todos los grupos"), añade el grupo igual que en el CSV: `5to año A.xlsx`. Con "todos los grupos" o sin grupos, solo el año/grado. (Esto evita que dos grupos del mismo año se descarguen con el mismo nombre.)

## 2. Cómo hacerlo

Crea **una sola función auxiliar** en `script.js`, reutilizada por los dos casos, por ejemplo:

```js
// nombreArchivoDescarga('5to Año', 'A', 'csv') -> '5to año A.csv'
function nombreArchivoDescarga(anio, grupo, extension) { ... }
```

Reglas de la función:
1. El año/grado va en **minúsculas** (`toLocaleLowerCase('es')`): `"5to Año"` → `5to año`, `"1er Grado"` → `1er grado`. Conserva acentos y la ñ.
2. El grupo se agrega después de un espacio **tal cual está guardado** (no lo cambies a mayúsculas ni minúsculas). Si está vacío, no se agrega nada ni queda un espacio sobrante.
3. Limpia caracteres no permitidos en nombres de archivo de Windows (`\ / : * ? " < > |`): reemplázalos por `-`. Colapsa espacios dobles y recorta espacios al inicio y al final.
4. Si tras limpiar el año/grado queda vacío, usa un respaldo razonable (por ejemplo `participantes` o `usuarios`, el prefijo que usaba antes).
5. Devuelve `<nombre>.<extensión>`.

Después reemplaza el nombre fijo que hoy usa cada descarga por una llamada a esta función. **No cambies** el contenido, el formato ni la codificación de los archivos.

## 3. Criterios de aceptación (verifícalos por lectura/trace y repórtalos)

- [ ] `('5to Año', 'A', 'csv')` → `5to año A.csv`
- [ ] `('1er Grado', '', 'csv')` → `1er grado.csv`
- [ ] `('4to Año', 'A/B', 'csv')` → `4to año A-B.csv`
- [ ] `('5to Año', '', 'xlsx')` → `5to año.xlsx`; `('1er Grado', '', 'xlsx')` → `1er grado.xlsx`
- [ ] Todos los botones de descarga CSV del Generador de usuarios usan el mismo nombrado.
- [ ] El XLSX de Participantes usa el año/grado seleccionado (y el grupo solo si hay uno específico elegido).
- [ ] "Buscar → Exportar reporte completo (CSV)" y los respaldos `.json` **no cambian**.
- [ ] Sin errores de consola; funciona en ambas academias.

## 4. Cierre

1. Sube a `?v=3` el parámetro de versión de `script.js` en `index.html` (hoy `?v=2`) para evitar caché vieja tras el deploy. Haz lo mismo con cualquier otro archivo que modifiques y ya lleve `?v=`.
2. En `documentacion_organizador_moodle.md`, añade una nota breve donde se describe "Descargar CSV" (§5.2/§6) y "Descargar XLSX" (§5.2) con la convención de nombres nueva y el nombre de la función auxiliar.
3. **No ejecutes `git push` ni `firebase deploy`.**

### Reporte final (conciso, en español)
- Archivos y funciones modificados.
- Lista de todos los puntos de descarga CSV/XLSX encontrados y cuáles se cambiaron.
- Resultado de cada criterio de la sección 3.
- Qué no pudiste probar en un navegador real.
