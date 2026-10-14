# INSTRUCCIÓN — Cambiar el sufijo de un colegio (genérico, para cualquier colegio)

> Esta instrucción **reemplaza** la versión anterior de "cambiar sufijo". Aplica a **cualquier colegio de cualquier academia**; el caso de Alejandro Humboldt (`ah` → `hum`) es solo el ejemplo que la motivó. **No hardcodees** nombres de colegios ni sufijos concretos.

## UBICACIÓN DEL PROYECTO (léelo primero)

- Raíz del repositorio: `C:\Users\Alejandro\Documents\GitHub\Proyectos`
- App web: `...\Proyectos\Organizador_moodle\` (`index.html`, `script.js`, `styles.css`, `academias.js`, `carnets.js`, `carnets-pdf.js`, `sync.js`, `sync-core.js`, `sync-firebase.js`, `firebase-config.js`, `lib\`).
- Otros: `database\` (esquema SQL y scripts), `firebase.json`, `firestore.rules`, `nueva documentacion.md` (documentación vigente, en la raíz).
- **No modifiques** `Organizador\`, `stickers\`, `Workflows\` ni `.firebase\`.

## COMPROBACIÓN PREVIA OBLIGATORIA (no modifiques nada todavía)

1. Ejecuta `git status`, `git log --oneline -5`, `git fetch` y `git status -sb`.
2. Si la copia está por detrás de `origin/main`, o le faltan las funciones recientes (exportación por nivel, modo agregar estudiantes, edición de nombres conservando usuario), **DETENTE y avísame**. No hagas `git pull` por tu cuenta.

Lee `nueva documentacion.md` y el código real antes de tocar nada. **El código manda**: si algo no coincide con esta instrucción, adáptate y repórtalo.

---

## 1. El problema (contexto)

Algunos colegios se registraron con un sufijo (prefijo de usuario) incorrecto o inconsistente. Caso real: el colegio "Alejandro Humboldt" (academia Tecno) debería usar `hum`, pero los usuarios de **Media** se crearon desde cero con `ah` (4 dígitos: `ah0001…`) mientras que los de **Primaria**, importados del CSV de Cleveland, ya usan `hum` (3 dígitos: `hum323`). Pasa en colegios compartidos con Cleveland y puede pasar en otros.

Se necesita poder **corregir el sufijo de cualquier colegio** y que todos sus datos se actualicen, **sin cambiar el dígito ni su ancho** (`ah0007` → `hum0007`, `ah12` → `hum12`).

## 2. Investigación obligatoria primero

Reporta cómo está modelado hoy el sufijo:
- Dónde vive (colegio, asignaciones/cursos copiados, participantes, `carnetListas`, Papelera) y cómo se arma cada derivado: nombre completo del curso (`1er Año-AH`), nombre corto (`1styear-ah`), `username` (`ah0001`), `firstname` (`ah0001 NOMBRES`), `email` (`ah0001@dominio`) y `course1` de los participantes.
- Cómo detecta el generador el prefijo del pool al crear o agregar usuarios, y qué usa "Agregar año/curso" para construir nombre completo y nombre corto.
- Si el colegio guarda un campo de sufijo/siglas propio (revisa también "Editar colegio").

## 3. Interfaz (disponible en TODOS los colegios)

En el detalle de **cada colegio**, en el encabezado de cada sección **"Cursos copiados · <Nivel>"** (Media y/o Primaria, solo las que existan), agrega un botón **"🔁 Cambiar sufijo"** que abre un modal (accesible, modo claro/oscuro, textos en español).

El modal debe ser **genérico y basarse en lo que realmente existe en ese colegio**:
- **Niveles:** casillas "Educación Media" / "Educación Primaria" (solo los que existan en el colegio); el de la sección donde se pulsó viene marcado; el otro es opcional.
- **Sufijo actual a reemplazar:** un selector con los sufijos **detectados** en los niveles marcados, con conteos, por ejemplo `ah (38 participantes · 5 cursos)` y `hum (330 participantes · 6 cursos)`. Se detectan a partir de los usernames con formato `^([a-zA-Z]+)(\d+)$` y de los nombres cortos de los cursos copiados (`…-xx`). Si hay un solo sufijo, viene preseleccionado. **Los sufijos no seleccionados no se tocan.**
- **Sufijo nuevo:** campo obligatorio, distinto del actual, solo letras y números, longitud 2 a 10. Se usa en **minúscula** en usernames, correos y nombres cortos, y en **MAYÚSCULA** en el nombre completo del curso (`-HUM`), igual que hoy.
- Si hay una vista editable o formulario del Generador con cambios sin guardar de ese colegio, avisa y cancela.
- Debe poder repetirse por nivel (por ejemplo cambiar solo Media y dejar Primaria como está).

## 4. Vista previa obligatoria antes de aplicar (sin escribir nada)

- Conteo de cursos copiados a renombrar, participantes a renombrar (por lista/año), carnets afectados y elementos de Papelera de ese colegio.
- 3 ejemplos "antes → después" (usuario y nombre corto).
- Elementos que **no** coinciden con el patrón (no se tocan) y por qué.
- **Choques:** si algún username resultante ya existe en la **academia** (en cualquier colegio, incluida la Papelera), **BLOQUEA** la operación y muestra cuántos y de qué listas (sin volcar datos personales). Si resultan nombres iguales salvo por el ancho (por ejemplo `hum001` y `hum0001`), **solo avisa** con el conteo.
- Si el sufijo nuevo ya existe en el mismo colegio (como `hum` en Primaria cuando se corrige Media), la operación está permitida mientras no haya choques exactos; muestra el aviso de números repetidos con distinto ancho.

## 5. Qué se cambia al confirmar

Todo en memoria, validado, con **un solo `saveData()`** al final; si algo falla, **no se guarda nada**.

- **Cursos copiados (asignaciones)** del colegio, en los niveles elegidos: nombre completo `…-AH` → `…-HUM` y nombre corto `…-ah` → `…-hum`, solo cuando terminan **exactamente** en el sufijo viejo (sin distinguir mayúsculas). Los demás se reportan y no se tocan.
- **Participantes** de esos niveles cuyo username cumple `^viejo(\d+)$` (sin distinguir mayúsculas):
  - `username` = nuevo + los **mismos dígitos con el mismo ancho**.
  - `firstname`: se reemplaza solo el prefijo de usuario al inicio (`ah0001 JUAN` → `hum0001 JUAN`); `nombres` y `apellidos` **no cambian**.
  - `email`: solo si es exactamente `<usuarioViejo>@<dominio de la academia>` (el generado) pasa a `<usuarioNuevo>@<mismo dominio>`; los correos distintos (por ejemplo los importados de Cleveland) **no se tocan**.
  - `course1`: el nombre corto viejo pasa al nuevo.
  - Contraseña, ciudad, país, grupo, rol, periodo, suspendido, `id`, orden y fecha **no cambian**.
- Usuarios que ya tienen el sufijo nuevo o que no cumplen el patrón se dejan intactos.
- **Carnets (`carnetListas`)**: si guardan copias de usuario/clave, actualízalas con el mismo mapeo (solo de ese colegio); si leen en vivo, no hagas nada. Repórtalo.
- **Papelera**: aplica el mismo renombre a los registros de ese colegio para que al restaurar no vuelva el sufijo viejo; si lo consideras arriesgado, no lo apliques y repórtalo con tu razón.
- Si el colegio guarda un campo de sufijo/siglas, actualízalo para que "Agregar año/curso", el generador y el modo agregar estudiantes usen el nuevo. Verifica que la numeración continúe con el prefijo nuevo y reporta cómo queda el pool cuando conviven números de 3 y 4 dígitos (**mantén la regla actual de ancho; no la cambies**).
- **No se escribe ningún campo nuevo en `data`.** Sin cambios de esquema.

## 6. Seguridad

- Antes de aplicar, descarga automáticamente un respaldo `.json` de la academia (como ya hace "Importar respaldo"), pide confirmación explícita y no permitas aplicar dos veces seguidas el mismo cambio.
- La operación debe poder revertirse ejecutándola al revés (nuevo → viejo) cuando no haya choques.

## 7. Resultado y CSV de renombre para Moodle

- Al terminar muestra un resumen (cursos y participantes actualizados, no coincidentes, avisos).
- Ofrece, en ese mismo diálogo y **solo ahí** (sin botón permanente ni campos guardados), una descarga única **"Renombrar usuarios en Moodle (.csv)"** con las filas renombradas en el formato de carga masiva de Moodle más la columna `oldusername` al inicio (para usar con la opción de permitir renombres de Moodle).
- Indica en el diálogo que el CSV normal de la lista desde ahora trae los usuarios nuevos, y que los usuarios y cursos **ya creados en Moodle deben renombrarse allí** (la app no se comunica con Moodle).
- No cambies los CSV ni los nombres de archivo habituales.

## 8. Propagación

Después de aplicar, deben mostrar los datos nuevos: tabla de Cursos copiados, Participantes, Generador de usuarios (rango de usuarios), Buscar, exportaciones XLSX/PDF (por año/grado y por nivel), CSV y carnets. La sincronización con Firebase y el respaldo no requieren cambios: usa `saveData()` y `window.Sync`; verifica que solo se reescriban los documentos de ese colegio.

## 9. Alcance

- Funciona para **cualquier colegio** y para **ambas academias**, solo con los datos de la academia activa.
- No toques Importar CSV, la numeración ni `stickers\`.

## 10. Verificación (sin navegador, con datos ficticios; nunca datos reales)

Escribe la lógica como **funciones puras** (plan de cambio + aplicación) y pruebas (por ejemplo `database\scripts\test_cambiar_sufijo.js`) con **al menos dos colegios ficticios distintos**:
1. Colegio A (replica el caso real): Media `ah0001–ah0038` (4 dígitos) y Primaria `hum001–hum330` (3 dígitos, con algunas filas con otros correos).
2. Colegio B con otro sufijo y ancho (por ejemplo `xy12` → `zk12`, 2 dígitos) en un solo nivel, para demostrar que nada está atado al caso de Humboldt.

Comprueba:
- `ah0007` → `hum0007` conserva dígitos y ancho; `firstname`, email generado y `course1` correctos; `nombres`/`apellidos` y demás campos intactos.
- Correos no generados y usernames que ya tienen el sufijo nuevo quedan intactos.
- Nombres completo y corto de los cursos cambian a `-HUM` / `-hum`.
- El selector detecta correctamente varios sufijos en un mismo nivel y solo cambia el elegido.
- Choque exacto de usernames (incluso contra otro colegio de la academia) → bloquea y no cambia nada; números iguales con distinto ancho → solo avisa.
- Aplicar dos veces el mismo cambio no corrompe nada; revertir (nuevo → viejo) devuelve exactamente los datos originales.
- Datos de Tecno y Cleveland no se cruzan.
- Generación posterior (modo agregar) continúa con el prefijo nuevo.
- El CSV de renombre contiene `oldusername` y solo las filas renombradas.
- Respaldo exportar → vaciar → importar e ida y vuelta SQL siguen pasando; `node --check` y todas las pruebas existentes pasan.
- Indica qué **no** pudiste probar (navegador real).

## 11. Reglas

- Sube +1 el `?v=` solo de los archivos que modifiques en `Organizador_moodle\index.html`.
- Actualiza `nueva documentacion.md`: Cambios, la sección de Colegios (cambio de sufijo, qué actualiza y qué no), §9 y §11 (riesgos: Moodle no se entera; números repetidos con distinto ancho).
- No hagas `git commit`, `git push` ni `firebase deploy`. No toques `tc_organizador_data` ni `cc_organizador_data`.
- Todo en español. Si algo es ambiguo, no lo adivines: déjalo en "Pendiente de confirmar" y pregúntame.

## 12. Entrega

Resume: dónde estaba modelado el sufijo, archivos modificados, decisiones tomadas (Papelera, carnets, convivencia de anchos), resultado de cada verificación y lo que no pudiste probar.
