# INSTRUCCIÓN — Agregar estudiantes nuevos a una lista existente (Generador de usuarios)

Lee COMPLETO el archivo `nueva documentacion.md` de la raíz del repo (documento vigente) y revisa el código real de `Organizador_moodle/script.js` y `styles.css` antes de tocar nada. **El código manda**: si algo de esta instrucción no coincide con el código (nombres de funciones, estructura de `data`, IDs del HTML), documenta la diferencia y adáptate. Respeta todas las reglas de trabajo del §12 de la documentación.

---

## 1. Para qué sirve (contexto del negocio)

Durante el año escolar se inscriben estudiantes nuevos y hay que crear sus usuarios de Moodle **dentro del mismo año/grado/grupo de una lista que ya existe**, sin tocar a los estudiantes ya generados. Hoy "Generar lista" crea una lista nueva y "Guardar lista" sobrescribe la anterior. Se necesita un modo para **agregar** estudiantes a una lista existente.

## 2. Comportamiento deseado (flujo del usuario)

1. En **Generador de usuarios → Años ya generados**, el usuario pulsa **Ver/Editar** en una lista (ejemplo: *5to Año*).
2. Se abre la vista editable de la lista (como hoy: tabla con los usuarios, botón 🗑, etc.) **y además el formulario de arriba entra en "modo agregar"**:
   - El **colegio, año/grado, grupo, curso modelo, nombre corto y nivel se detectan de la lista** y quedan bloqueados (solo lectura), porque los nuevos estudiantes pertenecen a esa misma lista.
   - Los cuadros **Apellidos** y **Nombres** se rellenan con los apellidos y nombres de los estudiantes que ya están en la lista (en el mismo orden), para que el usuario vea quiénes ya existen.
   - **Contraseña** y **Ciudad** se rellenan con los valores de la lista existente y siguen siendo editables (aplican solo a los nuevos).
   - Se muestra un aviso claro, por ejemplo: *"Modo agregar: 5to Año · Daniel Camejo Acosta · 14 estudiantes existentes. Escribe debajo los apellidos y nombres de los nuevos."* con un botón **"Salir del modo agregar"** que limpia el formulario y vuelve al modo normal.
3. El usuario añade, al final de los cuadros, los apellidos y nombres de los estudiantes nuevos (una línea por estudiante, mismo orden en ambos cuadros) y pulsa **Generar lista**.
4. El sistema genera **solo los usuarios de los estudiantes nuevos**, continuando la numeración, y los agrega a la lista que se está editando. La tabla editable muestra los existentes sin cambios y los nuevos **resaltados** (por ejemplo con una etiqueta "Nuevo" o un fondo distinto) al final.
5. El usuario pulsa **Guardar lista** y los nuevos quedan **añadidos** a la lista existente. **No se sobrescribe ni se modifica a nadie que ya estuviera.**

## 3. Reglas de negocio (obligatorias)

### 3.1 Qué es "nuevo" y qué es "existente"
- Un par (apellido, nombre) del formulario que **coincide con un estudiante ya existente de esa lista** (comparación sin distinguir mayúsculas/minúsculas ni espacios sobrantes, respetando orden y multiplicidad) se considera **existente y se omite**.
- Todo par que no coincida con un existente es **nuevo** y se genera.
- Muestra un contador en vivo cerca del botón: *"14 existentes · 3 nuevos"*. Antes de generar, si hay 0 nuevos, avisa en español y no hagas nada. Si alguna línea existente fue borrada o editada por el usuario en los cuadros, **no elimines ni cambies a nadie**: simplemente el cambio se interpreta como entrada nueva o como ausencia; informa con un aviso suave ("las líneas de estudiantes existentes que borres aquí no eliminan sus usuarios; para eliminarlos usa 🗑").
- Valida como hoy que haya el mismo número de apellidos que de nombres.
- Posibles duplicados (mismo apellido y nombre que uno existente) se tratan como existentes y se omiten, no como nuevos.

### 3.2 Numeración de usuarios (continuar desde el mayor)
- Se continúa desde el **número más alto de todo el pool del colegio con ese prefijo** (no solo de esta lista). Ejemplo: si el mayor es `ag0300` (aunque esté en 2do Año), el primer nuevo de 5to Año es `ag0301`, luego `ag0302`, etc.
- **Mantén el mismo ancho de dígitos del pool**: `ag0300 → ag0301` (4 dígitos) y `ag300 → ag301` (3 dígitos). No cambies el relleno de ceros. Si al sumar se excede el ancho (por ejemplo 9999 → 10000), amplía el ancho solo si es inevitable y avisa.
- **Reutiliza la lógica de pool que ya existe** en el Generador (prefijo + último número por colegio) en lugar de reescribirla. Verifica y reporta: (a) cómo detecta el prefijo, (b) si el pool cuenta los usuarios que están en la Papelera, y mantén ese comportamiento sin cambiarlo.
- Si la lista tiene filas con un prefijo distinto al dominante (por ejemplo docentes importados desde el CSV de Cleveland como `moisesleal92`), **ignóralas** para detectar prefijo y ancho; el prefijo y el ancho salen de los usuarios dominantes de la lista.
- Si la lista no tiene ningún usuario con formato válido (prefijo+número), cae al comportamiento normal de generación y avisa.

### 3.3 Qué se genera para cada estudiante nuevo
- Mismos campos y reglas que cualquier estudiante generado hoy: `username`, `password` (del formulario), `firstname` con el usuario antepuesto, `lastname`, `email` con la regla vigente de la academia (`@dominio` de la academia, **no** la regla de "carga fiel" del CSV), `city`, `country`, `course1` (nombre corto de la lista), `group1` (grupo de la lista), `role1`, `enrolperiod1`, `suspended`, `nombres`, `apellidos`, `fecha`, y los mismos `colegioId`, `cursoId`, `anio`, `nivel` de la lista.
- Los **nuevos van al final** de la lista (después de los existentes), con `id` nuevo. Los existentes conservan su `id`, su orden y sus valores (incluidas ediciones manuales de contraseña, ciudad, etc.).

### 3.4 Guardado: fusionar, no sobrescribir
- En modo agregar, "Guardar lista" **añade** los nuevos a la lista existente. **No** debe ejecutar la lógica actual de sobrescritura (la que manda la lista anterior a la Papelera y crea otra). La Papelera no debe recibir nada en esta operación.
- Se mantiene una sola lista por (colegio, curso, año, grupo): los nuevos se integran a ella; no se crea una lista duplicada.
- El conteo de estudiantes y el "Rango de usuarios" de la lista en "Años ya generados" deben actualizarse. Si el rango deja de ser continuo (por ejemplo `dc0001–dc0014` y los nuevos `dc0086–dc0090`), muéstralo sin engañar: por ejemplo los tramos `dc0001–dc0014, dc0086–dc0090`, o un resumen con tooltip.
- Registra qué estudiantes se agregaron después: añade un campo **opcional** `agregadoEn` (fecha ISO) a los participantes nuevos agregados mediante este modo (los existentes no lo tienen). Es retrocompatible: su ausencia significa "generado en la creación de la lista".

### 3.5 CSV solo de los nuevos (muy importante para Moodle)
Los usuarios existentes ya están creados en Moodle; volver a subirlos al importar el CSV completo de la lista generaría errores o duplicados. Por eso:
- Al guardar en modo agregar, ofrece un botón **"⬇ CSV solo de los nuevos"** (en el resultado y también disponible desde Ver/Editar mientras existan participantes con `agregadoEn`). Debe generar el CSV con el formato de carga masiva de Moodle y con el nombre de archivo siguiendo la convención vigente de descargas (año/grado y grupo), agregando un sufijo claro como `_nuevos`.
- El botón **CSV** completo de la fila sigue descargando toda la lista como hoy.
- Si solo se puede ofrecer la versión mínima (botón disponible justo al guardar), implementa esa primero y dime qué faltó.

## 4. Integración con el resto del sistema

- **Sincronización con Firebase:** todo cambio debe pasar por `saveData()` y la interfaz `window.Sync` existente (no llames a `firebase.*` fuera del adaptador). Como los existentes no cambian de `id` ni de orden y solo se añaden participantes, el diff debe reescribir únicamente el documento de esa lista. Verifica que el campo nuevo `agregadoEn` viaje correctamente a la nube y de vuelta.
- **Respaldo `.json`:** el respaldo exporta todo `data`, así que `agregadoEn` debe viajar sin cambios. Comprueba que `importBackup()` lo conserva y que un respaldo antiguo sin ese campo sigue importando.
- **Base de datos SQL (`database/`):** agrega la columna opcional correspondiente (por ejemplo `agregado_en DATETIME NULL`) en `database/schema.sql`, actualiza `respaldo_a_sql.js` y `sql_a_respaldo.js`, y asegúrate de que la prueba de ida y vuelta (`test_idavuelta.js`) siga pasando incluyendo participantes con y sin `agregadoEn`. Actualiza `ejemplo_ficticio.json` con al menos un caso agregado.
- **Cleveland (listas importadas por CSV):** el modo agregar debe funcionar también con listas cuyos usuarios vinieron de un CSV de Cleveland (usuarios de 3 o 4 dígitos, correos que no siguen el dominio de la academia, filas de docentes mezcladas). Los existentes **no se tocan**; los nuevos usan el correo con la regla de la academia.
- **Modo agregar vs. otras acciones:** Salir del modo agregar, cambiar de vista o pulsar "Generar lista" en modo normal debe dejar el formulario y la vista en un estado coherente (sin restos del modo agregar). Si la lista editada se elimina o cambia mientras se está en modo agregar, sal del modo con un aviso.
- **Reestructurar al eliminar un estudiante:** la lógica existente debe seguir funcionando con listas que contienen nuevos agregados (los nuevos conservan su numeración al agregarse; no se renumeran salvo que el usuario elija "Reestructurar" al eliminar, como hoy). Verifícalo.
- No cambies el comportamiento del Importar CSV de ninguna academia ni de "Generar lista" fuera del modo agregar.

## 5. Interfaz y detalles de implementación

- Textos en español; el aviso del modo agregar, los contadores y el botón de salida deben verse bien en modo claro y oscuro, con el sidebar abierto u oculto, y con la tabla que ya tiene scroll horizontal y la columna 🗑 fija.
- Accesibilidad básica (foco, `aria-label` en botones nuevos).
- Reutiliza los helpers y estilos existentes; no dupliques lógica de generación.
- Sube +1 el `?v=` en `index.html` solo de los archivos que modifiques.
- No cambies `freshData()`/`loadData()`/`importBackup()` salvo lo estrictamente necesario; `agregadoEn` es opcional y no requiere migración.

## 6. Verificación (sin navegador)

Si hay Node.js, escribe pruebas (por ejemplo en `database/scripts/test_agregar_estudiantes.js`) que simulen la lógica pura y reporta:
1. Pool con máximo `ag0300` en 2do Año; agregar 3 estudiantes a 5to Año → `ag0301`, `ag0302`, `ag0303`, con relleno de 4 dígitos.
2. Mismo caso con usuarios de 3 dígitos (`ag300`) → `ag301`… sin añadir ceros.
3. Los 14 existentes conservan `id`, orden y valores; ninguno se modifica; la Papelera no recibe nada.
4. Líneas del formulario que coinciden con existentes se omiten; el contador existentes/nuevos es correcto; cero nuevos → aviso y sin cambios.
5. Lista con filas de docentes de otro prefijo (estilo Cleveland): se ignoran para la numeración y no se modifican.
6. Lista sin usuarios con formato válido → cae a generación normal.
7. Rango de usuarios y conteo actualizados; CSV solo de nuevos contiene únicamente los agregados y el CSV completo contiene todos.
8. Respaldo: exportar → vaciar → importar conserva `agregadoEn`; un respaldo antiguo sin ese campo importa bien; ida y vuelta SQL sin pérdida.
9. `node --check` sobre todos los JS modificados y que las pruebas anteriores (`test_sync_core`, `test_sync_dos_dispositivos`, `test_idavuelta`) sigan pasando.
10. Qué **no** pudiste probar (navegador, interfaz real).

## 7. Documentación

Actualiza `nueva documentacion.md` en el mismo archivo: sección "Cambios" con fecha y commit, §2 (versiones `?v=`), §4 (campo opcional `agregadoEn`), §6 (Generador de usuarios: modo agregar, reglas de numeración y fusión, CSV de nuevos), §9 (guía "Cómo agregar estudiantes a una lista existente"), §11 (riesgos, por ejemplo coincidencia por nombre/apellido y rangos no contiguos) y §12 si aplica. Actualiza también `database/README.md` con la columna nueva.

## 8. Reglas

- No hagas `git commit`, `git push` ni `firebase deploy`.
- No toques `tc_organizador_data` ni `cc_organizador_data`.
- No incluyas datos reales de estudiantes en pruebas ni en el repositorio (usa nombres ficticios).
- Todo en español.
- Si algo es ambiguo, no lo adivines: déjalo en "Pendiente de confirmar" y pregúntame.

## 9. Entrega

Resume: archivos creados y modificados, decisiones tomadas (sobre todo si el pool cuenta la Papelera y cómo muestras el rango no continuo), resultado de cada verificación y lo que no pudiste probar.
