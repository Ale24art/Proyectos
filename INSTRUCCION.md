# INSTRUCCIÓN para Claude Code — Organizador Moodle
## Mejoras en Generador de usuarios, Colegios, Buscar y Papelera

**Repositorio:** `Proyectos/` (ruta local: `Documentos\GitHub\Proyectos`)
**Código a modificar:** únicamente `Organizador_moodle/` y, al final, `documentacion_organizador_moodle.md` (raíz del repo).
**Idioma:** todo en español (comentarios, mensajes, textos de interfaz).

---

## 0. Antes de escribir una sola línea

1. Lee completo `documentacion_organizador_moodle.md` (raíz del repo). Describe el modelo de datos real, la numeración de usuarios, el multi-academia y el Generador de carnets. **Si algo del documento no coincide con el código, manda el código** y lo anotas en tu reporte final.
2. Lee `Organizador_moodle/index.html`, `script.js`, `styles.css` y `carnets.js`. Ubica las funciones **por nombre** (con grep), no por número de línea, porque las líneas del documento son aproximadas. Funciones/ids relevantes que debes localizar primero:
   - Generador de usuarios: `renderGenerador`, `fillGenAnioSelect`, `renderGenYearsSummary`, `generarListaUsuarios`, `guardarListaUsuarios`, `onGenUsernameEdit`, `eliminarGenLista`, `parseUsername`, `buildUsuariosCSV`, y la función que se ejecuta al pulsar **Ver/Editar**.
   - Colegios: `renderColegios`, el detalle del colegio (tablas Media/Primaria de cursos copiados) y la tarjeta **Participantes** (selector año → grupo, buscador, tabla, copiar, "Descargar XLSX").
   - Buscar: la vista `#view-buscar`, su input, sus sugerencias y el resumen/tabla de resultados.
   - Papelera: `renderTrash`, `restore*`, `permaDelete*`, "Vaciar papelera" y el badge de conteo.
   - Eliminaciones: todo lugar donde se quite algo de `data.*` (`splice`, `filter` que reasigna, etc.), incluidos `deleteManualList`, "Eliminar todas las listas" (carnets), `resetCatalogs`, y los reemplazos de `guardarListaUsuarios` y del guardado de listas de carnets.
3. Reutiliza el sistema de modales, toasts (`showToast`), `esc()`, `normalize()`, `uid()`, `todayStr()` y las variables CSS que ya existen. No introduzcas librerías nuevas.

### Reglas inquebrantables
- **No tocar ni renombrar** `tc_organizador_data` (clave real de TecnoCleveland en producción). Cleveland usa `cc_organizador_data`.
- **Retrocompatibilidad total:** toda clave nueva del esquema se agrega en **los tres sitios**: `freshData()`, `loadData()` e `importBackup()`, con el patrón `parsed.x || default`. Un `localStorage` o respaldo `.json` antiguo (sin las claves nuevas) debe cargar sin errores.
- Las dos academias siguen separadas: nada de lo nuevo puede filtrar datos entre `tecno` y `cleveland`.
- **No ejecutes `git push` ni `firebase deploy`.** Tampoco hagas `git commit` salvo que yo lo pida.
- No cambies el orden de carga de scripts de `index.html`.
- No cambies comportamientos que no estén listados aquí (por ejemplo el orden actual de años/grados en los selectores: se mantiene tal cual).
- Si tocas `carnets-pdf.js` (no debería hacer falta), revisa si aplica también a `stickers/js/stickers.js`.

---

## 1. Orden de trabajo

1. **Fase A — Base:** esquema de Papelera ampliado (sección 5) y helper de acordeón (sección 2.0).
2. **Fase B — Generador de usuarios** (sección 2).
3. **Fase C — Colegios** (sección 3).
4. **Fase D — Buscar** (sección 4).
5. **Fase E — Papelera general** (sección 5): auditoría de eliminaciones y UI de restauración.
6. **Fase F — Cierre** (sección 7): cache-busting, documentación, reporte.

Haz cada fase completa y verifica que la app sigue cargando (sin errores de consola) antes de pasar a la siguiente.

---

## 2. Generador de usuarios

### 2.0 Componente reutilizable de acordeón (se usa también en Colegios)
Crea un helper pequeño y genérico (JS + CSS en `styles.css`, clases con prefijo `acc-`):
- Cabecera clicable (`<button>` con `aria-expanded`) con título, contador opcional y un chevron (▾ abierto / ▸ cerrado, con rotación suave).
- Cuerpo que se oculta/muestra.
- **El estado abierto/cerrado se guarda en memoria** en un objeto de módulo (por ejemplo `uiAcordeones = { 'gen-media': true, ... }` con una clave única por acordeón), **no en `data`** ni en `localStorage`. Esto es obligatorio porque las vistas se re-renderizan con `innerHTML` y sin ese objeto el acordeón se reabriría solo con cada acción.
- Por defecto **abiertos**.
- Debe verse bien en modo claro y oscuro y en móvil (usar las variables CSS existentes, no colores fijos).

### 2.1 Acordeón en "Años ya generados" (Educación Media / Educación Primaria)
En `renderGenYearsSummary()`: cada bloque de nivel (Media y Primaria) pasa a ser un acordeón con botón para retraer/expandir. La cabecera muestra el nombre del nivel y cuántos años/grupos contiene (ej. "Educación Media · 7 listas"). Claves de estado: `gen-media`, `gen-primaria`.

### 2.2 Eliminar un estudiante desde Ver/Editar
En la vista editable que se abre con **Ver/Editar** (tabla celda por celda), agrega una columna final con un botón 🗑 "Eliminar estudiante" por fila.

Al pulsarlo se abre un **modal** (nuevo, `#modal-eliminar-estudiante`, con el mismo markup/estilo de los 4 modales existentes) que muestra el usuario y nombre del estudiante y ofrece:

- **Conservar el orden actual:** se elimina solo ese estudiante; los demás mantienen sus usuarios (queda un "hueco" en la numeración).
- **Reestructurar el orden:** se elimina al estudiante y los usuarios **posteriores** se reasignan de forma consecutiva para cerrar el hueco.
- **Cancelar.**

El modal debe mostrar, para la opción de reestructurar, una **vista previa de los cambios** (ej. "ah0004 → ah0003, ah0005 → ah0004 … (+N más)") y esta advertencia visible: *"Si estos usuarios ya fueron cargados a Moodle, cambiar sus nombres de usuario aquí NO los actualiza en Moodle."*

**Algoritmo de "Reestructurar" (implementar como función pura y testeable, p. ej. `calcularReestructura(lista, eliminado)`):**
1. Trabaja solo con los participantes de **la misma lista** (mismo `colegioId + cursoId + anio + group1`) cuyo `username` cumpla `parseUsername()` (`^([a-zA-Z]+)(\d+)$`) **con el mismo prefijo** (sin distinguir mayúsculas) que el eliminado.
2. Ordénalos por su número (valor numérico, no por posición de fila).
3. Los que tengan número **mayor** al eliminado se reasignan en orden, de forma consecutiva, **empezando por el número del eliminado** (el eliminado ya no existe). Los anteriores no se tocan.
4. Conserva los ceros a la izquierda con los mismos dígitos del sistema: **3 dígitos en Primaria, 4 en Media** (igual que `generarListaUsuarios`).
5. **Evita colisiones:** si un número destino ya lo usa otro participante del mismo colegio + prefijo (de otra lista/grupo), sáltalo y usa el siguiente libre. El `username` final nunca debe repetirse en `data.participantes` (comparación sin distinguir mayúsculas).
6. Por cada usuario reasignado, actualiza también `email` (`${username}@${ACADEMIA_ACTUAL.emailDominio}`) y cualquier campo derivado que se guarde en el participante (revisa si `firstname` se guarda o solo se arma al exportar el CSV; si es lo segundo, no hay nada que hacer). La contraseña y demás campos no cambian.
7. Si el eliminado **no tiene username parseable**, o **no hay usuarios posteriores**, la opción "Reestructurar" aparece **deshabilitada** con una explicación corta; "Conservar" sigue funcionando.

**Comportamiento según el origen de la lista:**
- **Lista ya guardada** (abierta con Ver/Editar): la eliminación se aplica **de inmediato y de forma persistente** (`saveData()`): el estudiante se quita de `data.participantes` y va a la **Papelera** (ver 5.2, `trash.estudiantes`). Si se eligió reestructurar, se actualizan los usuarios reasignados tanto en `data.participantes` como en la copia en pantalla, **sin perder las ediciones de celdas que el usuario ya tenía sin guardar**. Revisa cómo trabaja hoy Ver/Editar con su copia en memoria y asegúrate de que, al pulsar "Guardar lista" después, no se "resucite" al estudiante eliminado ni se pisen los usuarios reasignados.
- **Lista recién generada y aún no guardada:** el modal funciona igual, pero solo modifica la vista previa en memoria (el estudiante nunca existió en `data`, por eso no va a la Papelera).
- Si se elimina al último estudiante de una lista guardada, la lista desaparece de "Años ya generados" y se cierra la vista editable con un toast informativo.

Tras cada eliminación: `saveData()` (si aplica), re-render de `renderGenYearsSummary()`, actualizar el badge de la Papelera, y un `showToast` ("Estudiante eliminado. Puedes restaurarlo desde la Papelera.").

Efectos colaterales a verificar (no deberían requerir cambios, pero confírmalo): el Generador de carnets **Modo 2** lee `data.participantes` en vivo, así que refleja los cambios; el **Modo 1** (`carnetListas`) es independiente y no se toca.

### 2.3 Acordeón en la vista editable (Ver/Editar)
El panel de la vista editable tiene su propio botón para retraer/expandir (clave `gen-editor`). Al retraer se oculta **solo la tabla**; el título (colegio · año · grupo · N estudiantes), el botón de acordeón y los botones de acción (Guardar lista, Descargar CSV, etc.) siguen visibles.

---

## 3. Colegios

### 3.1 Participantes separados por Media y Primaria
En la tarjeta **Participantes** del detalle de un colegio, el selector de año/grado debe estar **agrupado por Educación Media y Educación Primaria**, igual que el selector "Año/Grado" del Generador de usuarios. Revisa cómo lo construye `fillGenAnioSelect()` y reproduce **la misma estructura y el mismo orden** (no unifiques ni cambies el orden existente). Solo deben aparecer años/grados que tengan participantes. El título de la tabla debe indicar el nivel (ej. "Educación Media · 4to Año · Grupo A").

### 3.2 Acordeón en "Cursos copiados"
Las dos tablas del detalle del colegio (Media y Primaria) llevan el helper de acordeón (claves `col-cursos-media`, `col-cursos-primaria`). Como el detalle se re-renderiza al editar/eliminar, el estado debe sobrevivir al re-render (ver 2.0). Si cambias de colegio, el estado puede reiniciarse a "abierto".

### 3.3 Paginación de Participantes (20 por página, estilo Moodle)
- Constante `PARTICIPANTES_POR_PAGINA = 20`.
- Flujo: **lista del año/grupo seleccionado → filtro por búsqueda → total → recorte de la página → render**.
- Controles bajo la tabla, estilo Moodle: `‹ Anterior  1  2  3 … 9  Siguiente ›`, con la página actual resaltada (color de acento de la academia) y puntos suspensivos cuando hay muchas páginas (mostrar primera, última y la actual ±2). Texto de apoyo: "Mostrando 21–40 de 57".
- Si hay **20 o menos** resultados, no se muestran controles de paginación.
- **El buscador es general para el año/grado/grupo que se está viendo:** filtra sobre **toda** la lista de esa selección (no solo la página visible), sin distinguir mayúsculas ni acentos (`normalize()`), por usuario, nombres, apellidos y correo. Al escribir, vuelve a la página 1. Al cambiar de año/grado o de grupo, también vuelve a la página 1.
- Al re-renderizar por la búsqueda **no pierdas el foco ni el cursor del input** (actualiza solo el cuerpo de la tabla y el paginador, no el input).
- Si la página actual queda fuera de rango (por ejemplo tras filtrar), ajústala al último valor válido.
- Si la tabla tiene columna de número (#), la numeración **continúa entre páginas** (21, 22, …).
- "Copiar al portapapeles" y "⬇ Descargar XLSX" trabajan sobre **toda** la lista (sin paginar). Mantén lo que hacen hoy respecto al filtro de búsqueda y déjalo anotado en el reporte.
- Mensaje claro cuando no hay coincidencias ("Ningún participante coincide con la búsqueda").

---

## 4. Buscar (corrección de un bug)

**Síntoma reportado:** en la vista *Buscar* (menú lateral, debajo de "Cursos modelo"), al escribir el nombre de un colegio no pasa nada y no se carga la información que la vista promete (resumen del colegio con insignias de nivel, años trabajados, clases subidas y tabla de detalle).

**Pasos:**
1. **Diagnostica primero, no adivines.** Reproduce el problema leyendo el código y verifica, en este orden: que los `id` del input/contenedores en `index.html` coincidan con los que usa `script.js`; que el evento (`oninput`/`addEventListener`) esté realmente enlazado al input correcto; que la función que se llama exista y no lance excepciones; que `showView('buscar')` no necesite un render propio (hoy la cadena de `showView` no tiene rama para `buscar`); que el desplegable de sugerencias no quede oculto por CSS (`display`, `z-index`, `overflow` del contenedor); que `normalize()` se use bien; y que el cruce `colegioId` ↔ `data.asignaciones` ↔ `data.cursos` funcione.
2. Reporta en el resumen final **la causa raíz exacta** encontrada.
3. Corrige y deja el comportamiento esperado:
   - Al escribir, aparecen sugerencias de colegios (coincidencia parcial, sin distinguir mayúsculas ni acentos).
   - Al elegir una sugerencia con clic, **o** al pulsar Enter (toma la primera sugerencia), **o** cuando lo escrito coincide exactamente con un solo colegio, se carga el resumen: insignias de nivel, años trabajados, clases subidas y tabla de detalle de ese colegio.
   - Sin coincidencias: mensaje "No se encontró ningún colegio con ese nombre". Sin colegios registrados (caso normal de Cleveland al inicio): mensaje "Aún no hay colegios registrados".
   - Las sugerencias se cierran al hacer clic fuera.
   - Al entrar de nuevo a la vista, no debe quedar en un estado roto.
4. Prueba con **ambas academias** (Tecno con su catálogo base de 28 colegios y Cleveland vacía).
5. Mantén sin cambios el botón "⬇ Exportar reporte completo (CSV)".

---

## 5. Papelera: todo lo eliminado debe poder restaurarse

### 5.1 Auditoría (hazla antes de implementar)
Recorre **todos** los puntos donde la app quita o sobrescribe datos y haz una tabla en tu reporte final: *acción → ¿pasaba por Papelera antes? → qué hiciste*. Como mínimo revisa:
- Eliminar colegio, curso modelo, asignación (curso copiado) y lista de participantes: ya van a papelera. **Verifica las cascadas**: ¿qué pasa con las asignaciones y participantes de un colegio/curso/asignación eliminado? Al restaurar, debe volver todo lo que desapareció junto con el elemento; si hoy queda huérfano o se pierde, corrígelo.
- **Listas de carnets Modo 1:** `deleteManualList` y "Eliminar todas las listas" hoy borran de forma permanente → deben ir a Papelera (ver 5.2).
- **Estudiante individual** (función nueva de la sección 2.2) → Papelera.
- **Listas reemplazadas por sobrescritura** (`guardarListaUsuarios` cuando ya existía la lista; guardar una lista de carnets sobre una existente del mismo nivel+grado+sección): la versión que se pisa debe ir a Papelera antes de reemplazar.
- **`resetCatalogs`** ("Restablecer colegios y cursos modelo"): los colegios y cursos que se pierdan con el reemplazo deben ir a Papelera. Revisa además qué ocurre con las asignaciones/participantes que apuntaban a los ids anteriores y descríbelo en el reporte (no lo cambies más allá de enviar a Papelera, solo reporta).
- No tocar (eliminación definitiva **intencional**, mantener sus confirmaciones): "Eliminar para siempre", "Vaciar papelera" e "Importar respaldo" (reemplazo total, ya pide doble confirmación).

### 5.2 Esquema nuevo (ampliar `data.trash`)
```jsonc
"trash": {
  "colegios": [], "cursos": [], "asignaciones": [], "participantes": [],   // existentes, sin cambios
  "estudiantes": [
    { "id": "idxxxxxxxx", "fechaEliminacion": "2026-10-04", "participante": { /* objeto participante completo, tal cual estaba */ } }
  ],
  "carnetListas": [
    { /* objeto de lista completo tal cual estaba: id, nivel, grado, seccion, clave, estudiantes */ "fechaEliminacion": "2026-10-04" }
  ]
}
```
- Agrega `estudiantes: []` y `carnetListas: []` a `freshData()`, y léelos con `trash.estudiantes || []` / `trash.carnetListas || []` en **`loadData()` e `importBackup()`**.
- "Eliminar todas las listas" crea **una entrada por lista** (para poder restaurarlas individualmente).
- `exportBackup()` no necesita cambios (ya exporta `data` completo).

### 5.3 UI de la Papelera
- Dos secciones nuevas en `renderTrash()`: **"Estudiantes eliminados"** y **"Listas de carnets eliminadas"**, con el mismo estilo de las existentes, cada ítem con **Restaurar** y **Eliminar para siempre**.
- Etiquetas legibles: estudiante → `usuario — Apellidos Nombres · Colegio · Curso · Año · Grupo · eliminado el dd/mm/aaaa` (si el colegio/curso ya no existe, mostrar "(colegio eliminado)"); lista de carnets → `Media/Primaria · grado · sección · N estudiantes · eliminada el …`.
- El **badge de conteo** del sidebar y **"Vaciar papelera"** deben incluir las dos secciones nuevas.

### 5.4 Reglas de restauración
- **Estudiante:**
  - Si su colegio o su curso ya no existen en `data.colegios` / `data.cursos` (están en la Papelera), **no restaurar** y avisar: "Primero restaura el colegio/curso de este estudiante."
  - Si su `username` ya lo usa otro participante (por ejemplo porque se reestructuró el orden), restaurarlo con un **username nuevo**: el siguiente libre del pool del mismo colegio + prefijo (con los dígitos correctos 3/4), recalculando `email`, y avisar con un toast: "Se restauró como ah0012 porque ah0003 ya estaba ocupado."
  - Si el username está libre, se restaura tal cual.
- **Lista de carnets:** si ya existe una lista con el mismo `nivel + grado + seccion`, pedir confirmación para reemplazarla (la existente va a Papelera). Quitar el campo `fechaEliminacion` al restaurar. Si el `id` ya existe en `data.carnetListas`, generar uno nuevo con `uid()`.
- Restaurar siempre: quitar de `data.trash.*`, insertar en el arreglo activo, `saveData()`, re-render de las vistas afectadas y toast de confirmación.

---

## 6. Criterios de aceptación (verifícalos y repórtalos)

**Generador de usuarios**
- [ ] Media y Primaria en "Años ya generados" se pueden retraer/expandir y **no se reabren solos** al ejecutar acciones (ver/editar, eliminar año, etc.).
- [ ] La vista editable se puede retraer sin perder el título ni los botones de acción.
- [ ] Eliminar estudiante → modal con "Conservar / Reestructurar / Cancelar".
- [ ] Ejemplo: lista `ah0001…ah0010`, elimino `ah0004`: *Conservar* deja `ah0001-3, ah0005-10`; *Reestructurar* deja `ah0001…ah0009` (los antiguos 5→4, 6→5 … 10→9), con `email` actualizado.
- [ ] Reestructurar no genera usernames duplicados en el colegio, aunque haya otras listas del mismo prefijo.
- [ ] El estudiante eliminado aparece en la Papelera y se puede restaurar (incluido el caso de username ocupado).
- [ ] "Guardar lista" después de eliminar no revive al estudiante.

**Colegios**
- [ ] Selector de participantes agrupado en Media/Primaria como en el Generador.
- [ ] Tablas de cursos copiados con acordeón que conserva su estado al editar/eliminar.
- [ ] Una lista de 57 participantes muestra 3 páginas (20/20/17), con el paginador estilo Moodle.
- [ ] Buscar un estudiante que está en la página 3 mientras estoy en la página 1 lo encuentra, y la búsqueda solo aplica al año/grado/grupo seleccionado.
- [ ] Copiar y XLSX incluyen todos los participantes, no solo los de la página.

**Buscar**
- [ ] Escribir parte del nombre de un colegio muestra sugerencias y al elegirlo carga resumen + tabla. Probado en Tecno y en Cleveland.

**Papelera / compatibilidad**
- [ ] Cada eliminación listada en 5.1 termina en Papelera y se restaura correctamente.
- [ ] Un `localStorage`/respaldo antiguo (sin `trash.estudiantes` ni `trash.carnetListas`) carga sin errores en ambas academias. Pruébalo simulando `loadData()`/`importBackup()` con un JSON antiguo (puede ser un script temporal de Node que no se deja en el repo).
- [ ] Sin errores en la consola del navegador en ninguna vista, en modo claro y oscuro.
- [ ] Probar las funciones puras (`calcularReestructura`, paginación) con un script temporal de Node y reportar los casos probados.

---

## 7. Cierre

1. **Cache-busting:** agrega `?v=2` a `script.js` y `styles.css` en `index.html` (hoy no llevan versión) y sube a `?v=2` los que ya tengan `?v=1` y hayas modificado (`carnets.js`, `carnets.css`, etc.). Así el navegador y Firebase no sirven archivos viejos tras el despliegue.
2. **Actualiza `documentacion_organizador_moodle.md`:** sube a versión v4, actualiza fecha y commit verificado (`git rev-parse --short HEAD`), y revisa al menos §4.1 (esquema con `trash.estudiantes` y `trash.carnetListas`), §4.2 y §9g (migración en los tres sitios), §5.2 (vistas: acordeones, paginación, eliminar estudiante, Buscar), §6 (eliminar estudiante y reestructurar), §7.3 (listas de carnets ahora con Papelera) y §11 (quita lo resuelto: §11.2 queda resuelto; deja anotado lo que sigue pendiente).
3. **No ejecutes `git push` ni `firebase deploy`.**

### Reporte final que debes entregarme (en español, conciso)
- Lista de archivos modificados y funciones nuevas/cambiadas.
- **Causa raíz** del bug de Buscar.
- Tabla de la auditoría de eliminaciones (5.1).
- Qué hacen Copiar/XLSX respecto al filtro de búsqueda en Participantes.
- Resultado de cada criterio de la sección 6 (cumplido / no verificado y por qué).
- Cualquier decisión que hayas tenido que tomar y que no esté en este documento.
- Lo que **no** pudiste probar en un navegador real, para que yo lo pruebe manualmente.
