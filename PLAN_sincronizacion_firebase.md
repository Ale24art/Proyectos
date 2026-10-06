# PLAN — Sincronización Firebase + Base de datos portable + Respaldo completo

**Estado:** Fase 1 — solo lectura, pendiente de aprobación.
**Fecha:** 2026-10-06
**Basado en:** código verificado de `Organizador_moodle/` + documentación v5 (`nueva documentacion.md`).

---

## Índice

1. [Auditoría del estado actual](#1-auditoría-del-estado-actual)
2. [Parte A — Arquitectura Firebase: Firestore vs Realtime DB](#2-parte-a--arquitectura-firebase)
3. [Parte A — Estructura de datos en la nube](#3-parte-a--estructura-de-datos-en-la-nube)
4. [Parte A — Estrategia de sincronización y conflictos](#4-parte-a--estrategia-de-sincronización-y-conflictos)
5. [Parte A — Autenticación y reglas de seguridad](#5-parte-a--autenticación-y-reglas-de-seguridad)
6. [Parte A — SDK, archivos nuevos y orden de carga](#6-parte-a--sdk-archivos-nuevos-y-orden-de-carga)
7. [Parte B — Base de datos SQL portable](#7-parte-b--base-de-datos-sql-portable)
8. [Parte C — Respaldo completo y restauración desde cero](#8-parte-c--respaldo-completo-y-restauración-desde-cero)
9. [Riesgos y mitigaciones](#9-riesgos-y-mitigaciones)
10. [Pasos manuales (comandos exactos)](#10-pasos-manuales-comandos-exactos)

---

## 1. Auditoría del estado actual

### 1.1 `freshData()` — script.js:224
Genera la estructura vacía/base de `data`. Tecno arranca con 28 colegios y 17 cursos hardcodeados; Cleveland siempre vacío. **Para la nube:** cuando la nube de esa academia esté vacía y hay datos locales, se propone la migración inicial (§4).

### 1.2 `loadData()` — script.js:237
- Lee `localStorage[STORAGE_KEY]` y reconstruye `data` con el patrón `parsed.x || default`.
- Si el parse falla, llama `freshData()` + `saveData()`.
- **No hay debounce**: guarda de inmediato en cada mutación.
- Retrocompatibilidad: maneja `localStorage` sin `carnetListas`, `carnetOpciones`, `trash.estudiantes`, `trash.carnetListas`.

### 1.3 `saveData()` — script.js:266
```js
localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
```
Un `try/catch` muestra toast si falla. **No hay ninguna integración cloud.** Se llama ~30 veces en todo `script.js` (cada acción muta `data` y llama `saveData()` inmediatamente). La capa de sincronización deberá conectarse aquí sin romper este comportamiento.

### 1.4 `exportBackup()` — script.js:1829
```js
const payload = { ...data, _academia: ACADEMIA_ACTUAL.id };
downloadFile(JSON.stringify(payload, null, 2), ...);
```
- **Qué incluye:** spread de todo `data` → colegios ✓, cursos ✓, asignaciones ✓, participantes ✓, carnetListas ✓, carnetOpciones ✓, trash (con las 6 sub-arrays) ✓, `_academia` ✓.
- **Qué falta hoy:** `_versionEsquema`, `_exportadoEn`, `_exportadoPor`, `_resumen` con conteos.
- Usa `JSON.stringify(..., null, 2)` (pretty-print) → archivos más grandes que sin indentación.

### 1.5 `importBackup()` — script.js:1835
- Valida que `parsed.colegios` y `parsed.cursos` sean arrays (si no → rechaza).
- Avisa si el respaldo es de otra academia (confirmación).
- Confirmación genérica antes de reemplazar.
- Reconstruye `data` con el mismo patrón de defaults que `loadData()`.
- **Lo que falta hoy:**
  1. No descarga un respaldo de seguridad automático antes de sobrescribir.
  2. No muestra resumen de lo restaurado.
  3. No propaga a la nube (debe agregarse en Fase 2).
  4. Validación débil: solo verifica los dos arrays, no el resto de la estructura.

### 1.6 `resetCatalogs()` — script.js:1880
- Envía colegios y cursos actuales a `data.trash.colegios` / `data.trash.cursos`.
- Reemplaza con `freshData().colegios` / `.cursos`.
- Llama `saveData()` + `renderAll()`.
- **Sincronización cloud pendiente:** debe propagarse: escribir nuevos colegios/cursos, "eliminar" o marcar como trash en la nube los anteriores.

### 1.7 `emptyTrash()` — script.js:2125
- Reemplaza `data.trash` completo con arrays vacíos → `saveData()`.
- **Sincronización cloud pendiente:** debe eliminar todos los documentos de trash de la nube.

### 1.8 `login.html`
- `USERS` mapeado literalmente en el fuente: `'2026': {nombre, academia}`, `'1010'`, `'ruben'`.
- Los códigos están en claro y son visibles para cualquiera que inspeccione el HTML.
- `doLogin()` compara en minúsculas con `trim()`.
- Guarda `tcUser` y `tcAcademia` en `sessionStorage` → redirige a `index.html`.
- **Problema para Firebase:** los códigos son demasiado cortos (`2026` = 4 chars, `1010` = 4 chars) y Firebase Auth exige mínimo 6 caracteres de contraseña. Se deben alargar o derivar. Ver §5.

### 1.9 Guardia de sesión `index.html`
Script inline al inicio del `<head>` (antes del `<body>`): verifica `sessionStorage.tcUser` y `tcAcademia`; si falta alguno, redirige a `login.html`. Expone `html.auth-ok` al body. **No cambia con Firebase** salvo agregar la verificación del token de Firebase Auth (se puede hacer asíncronamente después del paint).

### 1.10 `academias.js`
Carga antes que `script.js`. Define `ACADEMIAS` (tecno y cleveland) y `ACADEMIA_ACTUAL` como constante calculada al cargar. Sin cambios de lógica necesarios para Firebase; solo se agrega la URL de configuración cloud implícitamente a través del nuevo `firebase-config.js`.

### 1.11 `firebase.json` y `.firebaserc`
```json
{ "hosting": { "public": "Organizador_moodle", "ignore": [...] } }
{ "projects": { "default": "moodle-organizador" } }
```
Se agregará el bloque `"firestore"` para publicar las reglas. No se toca `"hosting"` ni `.firebaserc`.

### 1.12 Estimación de tamaño de `data`

Cada participante en JSON:
```
id + colegioId + cursoId + anio + nivel + username + password +
nombres + apellidos + email + city + country + course1 + group1 +
role1 + enrolperiod1 + suspended + fecha
```
≈ **450–550 bytes** por participante (sin pretty-print), ≈ **600–750 bytes** (con pretty-print).

| Escenario | Participantes | Peso (sin PP) | Peso (con PP) |
|---|---|---|---|
| Pequeño | 500 | ~240 KB | ~320 KB |
| Mediano | 2.000 | ~960 KB | ~1,3 MB |
| Grande | 5.000 | ~2,4 MB | ~3,2 MB |
| Muy grande | 8.000 | ~3,8 MB | ~5 MB |

`localStorage` permite ~5 MB por origen. Con 8.000+ participantes activos + papelera acumulada, **hay riesgo real de alcanzar el límite**. Ver §8.4 y §9.

---

## 2. Parte A — Arquitectura Firebase

### Decisión: **Firestore** (no Realtime Database)

| Criterio | Firestore (Spark) | Realtime DB (Spark) |
|---|---|---|
| Límite por documento | 1 MiB | Sin límite por nodo, pero desempeño cae con árboles grandes |
| Lecturas/día gratis | 50.000 | Sin cuota por operación; límite por descarga: 10 GB/mes |
| Escrituras/día gratis | 20.000 | Idem |
| Estructura de datos | Colecciones/documentos jerárquicos | Árbol JSON plano |
| Soporte offline nativo | ✓ Sí, SDK lo maneja | ✓ Sí, básico |
| Reglas de seguridad | Expresivas, por colección/documento | Menos granulares |
| Writes parciales (solo lo que cambió) | ✓ `set()` / `update()` por documento | Solo con paths específicos |
| Fragmentación necesaria | Sí (no se puede guardar todo en 1 doc) | No estrictamente, pero sí recomendable |

**Por qué Firestore:**
1. Con `data` potencialmente > 1 MiB, guardar todo en un único nodo de Realtime DB sería ineficiente (leer/escribir el árbol completo siempre). Con Firestore, cada participante/lista es un documento y se escribe solo lo que cambió.
2. Las reglas de Firestore permiten proteger `academias/tecno/**` vs `academias/cleveland/**` de forma explícita y garantizada por el servidor, no solo por el cliente.
3. La cuota diaria de 50.000 lecturas es más que suficiente para 3 usuarios con uso normal (estimado: 100–300 lecturas/apertura, 10–50 escrituras/sesión).
4. La compensación: hay que partir `data` correctamente para no superar 1 MiB/documento. El plan siguiente lo resuelve.

---

## 3. Parte A — Estructura de datos en la nube

### 3.1 Árbol de colecciones

```
firestore (proyecto: moodle-organizador)
└── academias/
    ├── tecno/               ← documento: { schemaVersion, updatedAt, updatedBy }
    │   ├── colegios/        ← colección
    │   │   └── {colegioId}  ← { id, nombre, _updatedAt, _updatedBy, _schemaVersion }
    │   ├── cursos/          ← colección
    │   │   └── {cursoId}    ← { id, nombre, nivel, ... }
    │   ├── asignaciones/    ← colección
    │   │   └── {asigId}     ← { id, colegioId, cursoId, anio, fecha, ... }
    │   ├── listas_part/     ← colección (participantes agrupados por lista año+grupo)
    │   │   └── {listaKey}   ← { colegioId, cursoId, anio, grupo, nivel, estudiantes:[...], ... }
    │   ├── carnetListas/    ← colección
    │   │   └── {listaId}    ← { id, nivel, grado, seccion, clave, estudiantes:[...], ... }
    │   ├── carnetOpciones/
    │   │   └── main         ← { layout, url, upper }
    │   ├── trash_colegios/      ← colección: 1 doc por colegio eliminado
    │   ├── trash_cursos/        ← colección: 1 doc por curso eliminado
    │   ├── trash_asignaciones/  ← colección: 1 doc por asignación eliminada
    │   ├── trash_listas_part/   ← colección: 1 doc por lote eliminado (contiene array estudiantes)
    │   ├── trash_estudiantes/   ← colección: 1 doc por estudiante individual eliminado
    │   └── trash_carnetListas/  ← colección: 1 doc por lista de carnets eliminada
    └── cleveland/           ← misma estructura
```

### 3.2 `{listaKey}` en `listas_part`
La clave del documento es `{colegioId}_{cursoId}_{anio}_{grupo}` (después de sanitizar para que sea un Firestore ID válido, máx 1.500 bytes).

Una lista típica tiene 20–40 participantes:
- 40 participantes × 550 bytes = **22 KB por documento** → muy lejos del límite de 1 MiB.
- En el peor caso (500 participantes en una sola lista): 500 × 550 bytes = 275 KB → también bajo el límite.

### 3.3 Por qué no un único documento por academia
Con 5.000 participantes, el objeto `data` pesa ~2,4 MB → supera los 1 MiB de Firestore. Además, escribir todo `data` en cada `saveData()` gastaría ~1 escritura de 2 MB por acción, consumiendo la cuota rápidamente.

### 3.4 Metadatos por documento
Cada documento lleva:
```json
{
  "_updatedAt": "2026-10-06T14:30:00Z",
  "_updatedBy": "Administrador",
  "_schemaVersion": 1
}
```
El documento raíz `academias/{id}` lleva además `_rev` (contador entero que se incrementa en cada escritura masiva).

### 3.5 Cómo se mapea `data` a la nube

| `data.campo` | Firestore |
|---|---|
| `colegios[]` | Un doc por colegio en `colegios/` |
| `cursos[]` | Un doc por curso en `cursos/` |
| `asignaciones[]` | Un doc por asignación en `asignaciones/` |
| `participantes[]` | Agrupados por lista en `listas_part/` |
| `carnetListas[]` | Un doc por lista en `carnetListas/` |
| `carnetOpciones` | Doc único en `carnetOpciones/main` |
| `trash.colegios[]` | Un doc por ítem en `trash_colegios/` |
| `trash.cursos[]` | Un doc por ítem en `trash_cursos/` |
| `trash.asignaciones[]` | Un doc por ítem en `trash_asignaciones/` |
| `trash.participantes[]` | Un doc por lote en `trash_listas_part/` |
| `trash.estudiantes[]` | Un doc por ítem en `trash_estudiantes/` |
| `trash.carnetListas[]` | Un doc por ítem en `trash_carnetListas/` |

---

## 4. Parte A — Estrategia de sincronización y conflictos

### 4.1 Flujo de arranque

```
DOMContentLoaded
│
├─ [inmediato] loadData() → data desde localStorage → renderAll() (app lista)
│
└─ [asíncrono] SyncFirebase.iniciar()
     ├─ autenticar con Firebase (silent sign-in)
     ├─ si autenticación OK:
     │    └─ descargar estado de la nube (leer todas las colecciones de la academia)
     │         ├─ Nube vacía + datos locales → proponer "Subir datos a la nube" (§4.3)
     │         ├─ Nube == local (mismo _rev) → "Sincronizado ✓"
     │         └─ Nube ≠ local → resolver conflicto (§4.4)
     └─ si sin internet → "Sin conexión", reintentar en segundo plano
```

### 4.2 Escrituras (saveData modificado)

`saveData()` sigue guardando en `localStorage` de inmediato (sin cambios al comportamiento actual). Luego, si la sincronización está activa, encola la academia en la cola de escritura:

```
saveData() {
  localStorage.setItem(...)   // igual que hoy
  SyncFirebase.encolar()       // no bloquea
}
```

`SyncFirebase.encolar()` usa **debounce de 3 segundos**: si en 3 segundos no hay más cambios, ejecuta la subida. La subida:
1. Calcula un diff entre `data` actual y `ultimoEstadoSincronizado` (snapshot en memoria).
2. Escribe solo los documentos que cambiaron (con `batch.set()` / `batch.delete()`).
3. Actualiza `ultimoEstadoSincronizado`.
4. Reintentos con espera exponencial si falla (1 s → 2 s → 4 s → máx 30 s).

**Cuota estimada:** con debounce de 3 s y uso normal (10 acciones/minuto), son ~3 escrituras/minuto × 3 documentos promedio = ~9 escrituras/minuto. En 8 horas: ~4.300 escrituras. Dentro de la cuota de 20.000/día.

### 4.3 Primer sincronizado (nube vacía, datos locales)

Aparece un diálogo modal:
> "Los datos de esta academia aún no están en la nube. ¿Subir los datos de este dispositivo ahora?"
> [Subir] [Más tarde]

Si el usuario elige "Subir": se hace una escritura masiva de todo `data` a Firestore. Si elige "Más tarde": la app funciona solo local hasta que se sincronice.

### 4.4 Resolución de conflictos

**Caso: nube con datos y local con datos distintos** (mismo `_schemaVersion`, distinto `_rev` o `_updatedAt`).

El conflicto se detecta comparando el `_rev` del documento raíz de la academia en la nube con el `_rev` del último sincronizado en local.

Antes de hacer cualquier cosa: **descarga automática de un respaldo `.json` del estado local actual** (sin pedir confirmación, silenciosamente). Luego muestra:

> "Los datos de la nube son más recientes que los de este dispositivo.
> Última modificación en la nube: [fecha/hora] por [usuario].
> ¿Qué quieres hacer?"
> [Usar datos de la nube] [Conservar datos de este dispositivo] [Cancelar]

**Caso: entidades distintas modificadas desde dos dispositivos**
- Si un dispositivo modificó el colegio A y otro modificó el colegio B → merge automático (cada documento es independiente).
- Si ambos modificaron el mismo participante o la misma lista → se detecta conflicto a nivel de documento (`_updatedAt` del doc en la nube > `_updatedAt` del doc local). Se aplica **last-write-wins** del servidor (se usa el dato más reciente), con aviso al usuario: "Se actualizaron X registros desde otro dispositivo."

**Caso: vista previa del Generador abierta**
Si el usuario tiene la vista previa del Generador abierta y llegan cambios de la nube, **no se re-renderiza el Generador**. Los cambios entrantes se aplican a `data` silenciosamente. El Generador re-renderiza solo cuando el usuario navega a otra vista y vuelve.

### 4.5 Indicador de estado

Se agrega al pie del sidebar (debajo de `#sidebar-footer-academia`):
```html
<div id="sync-status" class="sync-status-bar">
  <span id="sync-status-icon">✓</span>
  <span id="sync-status-text">Sincronizado</span>
  <button id="sync-now-btn" onclick="SyncFirebase.sincronizarAhora()" title="Sincronizar ahora" aria-label="Sincronizar ahora">↺</button>
</div>
```

Estados posibles:
| Estado | Icono | Texto |
|---|---|---|
| Sincronizado | `✓` | "Sincronizado" |
| Sincronizando | spinner CSS | "Sincronizando…" |
| Sin conexión | `✕` | "Sin conexión" |
| Cambios pendientes | `●` | "Cambios pendientes" |
| Error | `⚠` | "Error de sincronización" |

Funciona en modo claro/oscuro (usa variables CSS ya definidas) y con sidebar colapsado (el indicador sigue visible en el sidebar).

### 4.6 Sincronización de operaciones masivas

| Operación | Cómo se propaga a la nube |
|---|---|
| `importBackup()` | Escribe todos los documentos de golpe (batch); pide confirmación explícita si Firebase está activo ("esto también reemplazará la nube") |
| `resetCatalogs()` | Borra docs de colegios/cursos viejos en `trash_colegios/trash_cursos`, escribe los nuevos |
| `emptyTrash()` | Elimina todos los documentos en las 6 colecciones `trash_*` |
| Restaurar desde papelera | Mueve doc de `trash_*` al array activo correspondiente |
| Eliminar para siempre | Elimina doc de `trash_*` en Firestore |
| `guardarListaUsuarios()` (sobrescritura) | Elimina el doc de `listas_part/{listaKey}` viejo + escribe nuevo; + crea doc en `trash_listas_part/` |
| `eliminarGenLista()` | Elimina doc de `listas_part/`, crea doc en `trash_listas_part/` |
| `deleteManualList()` / "Eliminar todas las listas" | Elimina docs de `carnetListas/`, crea docs en `trash_carnetListas/` |

### 4.7 Escucha en tiempo real vs polling

**Recomendación: polling** (no real-time listener). Razones:
1. Solo hay 3 usuarios (raramente dos en simultáneo).
2. Un listener en tiempo real que actualiza `data` mientras el Generador está en edición puede pisar datos del usuario.
3. El polling es más predecible y más barato en lecturas.

**Momentos de sincronización:**
- Al abrir la app (startup async, §4.1).
- Al volver a la pestaña (`document.addEventListener('visibilitychange')`).
- Al hacer clic en el botón "Sincronizar ahora" (sidebar).
- Opcional: cada 10 minutos si la pestaña está activa.

---

## 5. Parte A — Autenticación y reglas de seguridad

### 5.1 El problema honesto

Los códigos actuales (`2026`, `1010`, `ruben`) están en el código fuente de `login.html`, visible para cualquiera que inspeccione el HTML en producción (Firebase Hosting es público). Si se usa Firebase Authentication con email+contraseña derivada del código, **cualquiera que lea el código fuente puede derivar las credenciales de Firebase y, si las reglas no están bien escritas, leer los datos de los estudiantes**.

La protección real no viene del secreto de la contraseña sino de que:
1. Las reglas de Firestore deniegan todo por defecto.
2. Las cuentas de Firebase están asociadas a IDs específicos con permisos limitados.
3. Firebase limita los intentos de sign-in por IP (protección básica contra fuerza bruta).

### 5.2 Comparación de opciones de autenticación

**Opción A — Derivar contraseña con salt interno** *(recomendada)*
- `contraseñaFirebase = base64(código + ":" + SALT_INTERNO)`
- `SALT_INTERNO` es una cadena larga aleatoria (≥ 32 chars) guardada en el código fuente.
- Ventaja: el flujo de `login.html` no cambia visualmente para el usuario.
- Desventaja: el salt está en el fuente → la contraseña es derivable si se lee el código. El código `2026` expuesto + salt = contraseña conocida.
- Mitigación parcial: **alargar los códigos de acceso** (ver Opción C). Si el código pasa a ser `tecno2026@adm#9k`, la fuerza bruta es prácticamente imposible.
- Seguridad real alcanzada: **protección contra lectores casuales; no contra alguien que lea el código fuente detenidamente**. Acceptable para datos de uso interno de la organización.

**Opción B — Email + contraseña reales**
- `login.html` pide email y contraseña propios (no el código corto).
- Los códigos cortos siguen usándose solo para acceso local (sin Firebase).
- Ventaja: las credenciales de Firebase nunca están en el fuente.
- Desventaja: **rompe la experiencia de usuario actual** (flujo de código único). Requiere que cada usuario tenga un email recordable y contraseña segura.
- Recomendación: usar solo si el usuario exige máxima seguridad y acepta cambiar el flujo de login.

**Opción C — Alargar los códigos (complementaria)**
- `2026` → `tcadmin_2026Xk` (12+ chars)
- `1010` → `tcasistente_1010Zq` (12+ chars)
- `ruben` → `clvRuben_2026Km` (12+ chars)
- No cambia la UI (sigue siendo un campo de código).
- Se combina con la Opción A: el código largo ya no es trivialmente adivinable.
- **Recomendada como complemento a A.** Necesito que me confirmes los nuevos códigos.

**Opción D — Cloud Functions (token personalizado)**
- Una Cloud Function recibe el código, lo valida, y devuelve un custom token de Firebase Auth.
- Ventaja: el código nunca deja el servidor; máxima seguridad.
- Desventaja: **requiere plan Blaze (de pago)** y un backend. No compatible con el requisito de "app estática sin backend".
- Se documenta como alternativa futura.

**Decisión propuesta: Opción A + C** (salt interno + códigos más largos). Tú eliges los nuevos códigos; yo los hardcodeo en `login.html` y derivo las contraseñas de Firebase.

### 5.3 Estructura de autenticación en Firebase

Cada código de acceso tiene una cuenta de Firebase Auth con email "ficticio":

| Código actual | Email Firebase | Acceso a academia |
|---|---|---|
| `2026` | `admin@tecno.organizador` | `tecno` |
| `1010` | `asistente@tecno.organizador` | `tecno` |
| `ruben` | `ruben@cleveland.organizador` | `cleveland` |

Las contraseñas de Firebase se derivan: `base64(codigoNuevo + ":" + SALT_INTERNO)` (yo proporciono el salt a ti; no va al repo).

### 5.4 Autorización por academia (colección `auth_map`)

En Firestore se crea una colección `auth_map/{uid}` con un solo documento por usuario:
```json
{
  "academiaId": "tecno",
  "nombre": "Administrador"
}
```
Esta colección **solo se crea desde el Admin SDK o la consola Firebase**, nunca desde el cliente. Los documentos de `auth_map` son legibles solo por el propio UID (`request.auth.uid == uid`).

Los usuarios `admin` y `asistente` (2026 y 1010) tienen `academiaId: "tecno"`. `ruben` tiene `academiaId: "cleveland"`. Esto garantiza a nivel de servidor que Tecno no lee Cleveland y viceversa.

### 5.5 `firestore.rules`

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Denegar todo por defecto
    match /{document=**} {
      allow read, write: if false;
    }

    // Cada usuario puede leer su propio mapa de academia
    match /auth_map/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
    }

    // Datos de cada academia: solo el usuario autorizado para esa academia
    match /academias/{academiaId}/{document=**} {
      allow read, write: if estaAutorizadoParaAcademia(academiaId);
    }
  }

  function estaAutorizadoParaAcademia(academiaId) {
    return request.auth != null
      && exists(/databases/$(database)/documents/auth_map/$(request.auth.uid))
      && get(/databases/$(database)/documents/auth_map/$(request.auth.uid)).data.academiaId == academiaId;
  }
}
```

**Pruebas manuales a realizar (sin emulador si no está disponible):**
1. Usuario `admin` (tecno): puede leer `academias/tecno/colegios/*` → ✓
2. Usuario `admin` (tecno): intenta leer `academias/cleveland/colegios/*` → debe ser denegado
3. Usuario `ruben` (cleveland): puede leer `academias/cleveland/colegios/*` → ✓
4. Usuario `ruben`: intenta leer `academias/tecno/colegios/*` → debe ser denegado
5. Sin sesión: intenta leer cualquier cosa → debe ser denegado

**Seguridad real alcanzada:** acceso garantizado a nivel de servidor por las reglas de Firestore. Un atacante con el código fuente puede derivar las credenciales (Opción A), pero si no conoce los códigos reales (Opción C, códigos largos), el ataque es de fuerza bruta limitada por Firebase. Para datos de estudiantes de uso interno organizacional, este nivel es razonable.

**App Check (opcional, no implementar en Fase 2):** App Check añade una capa extra que verifica que las peticiones vengan de la web app real y no de scripts externos. Si se desea activar en el futuro, se describe en `MIGRACION_A_SERVIDOR_PROPIO.md`. No es obligatorio para el funcionamiento básico.

---

## 6. Parte A — SDK, archivos nuevos y orden de carga

### 6.1 Elección del SDK

**Recomendación: SDK compat v10 vendorizado en `lib/`** (no CDN en tiempo de ejecución).

Razones:
- Los scripts existentes son regulares (no módulos ESM). Si `firebase-config.js` y `sync-firebase.js` son módulos ESM, se ejecutan diferidos (después del documento), mientras que `script.js` es un script síncrono al final del `<body>` que corre antes. Esto crearía una condición de carrera donde `script.js` intenta usar `SyncFirebase` antes de que el módulo ESM haya cargado.
- Con compat vendorizado, todo son scripts regulares cargados en orden.
- El SDK compat v10 de Firebase sigue siendo soportado. Archivos a descargar (≈ 130 KB minificado total):
  - `lib/firebase-app-compat.min.js`
  - `lib/firebase-auth-compat.min.js`
  - `lib/firebase-firestore-compat.min.js`
- No hay dependencia de CDN en producción (la app funciona offline inmediatamente para la parte local).

**Alternativa ESM desde CDN** (si prefiere no vendorizar): usar `<script type="module">` para firebase-config.js y sync-firebase.js, exponer en `window.SyncFirebase`, y cargarlos con `defer` después de los scripts actuales. Viable pero con el riesgo de carrera descrito; requiere que `script.js` no use `SyncFirebase` hasta `DOMContentLoaded`. Es manejable pero más frágil.

### 6.2 Archivos a crear

| Archivo | Ubicación | Descripción |
|---|---|---|
| `lib/firebase-app-compat.min.js` | `Organizador_moodle/lib/` | SDK Firebase App compat v10 |
| `lib/firebase-auth-compat.min.js` | `Organizador_moodle/lib/` | SDK Firebase Auth compat v10 |
| `lib/firebase-firestore-compat.min.js` | `Organizador_moodle/lib/` | SDK Firebase Firestore compat v10 |
| `firebase-config.js` | `Organizador_moodle/` | Configuración pública del proyecto (marcadores; tú los llenas) |
| `sync-firebase.js` | `Organizador_moodle/` | Capa de sincronización: `window.SyncFirebase` |
| `firestore.rules` | raíz del repo | Reglas de Firestore (fuera de `Organizador_moodle/`) |
| `database/schema.sql` | `database/` | Esquema SQL compatible MySQL 8/MariaDB |
| `database/README.md` | `database/` | Guía de base de datos |
| `database/MIGRACION_A_SERVIDOR_PROPIO.md` | `database/` | Guía de mudanza |
| `database/scripts/respaldo_a_sql.js` | `database/scripts/` | Convierte respaldo JSON a SQL/SQLite |
| `database/scripts/sql_a_respaldo.js` | `database/scripts/` | Camino inverso |
| `database/scripts/ejemplo_ficticio.json` | `database/scripts/` | JSON de prueba con datos inventados |
| `.gitignore` | raíz del repo | Excluir secretos, respaldos, BD |

### 6.3 Archivos a modificar

| Archivo | Cambio |
|---|---|
| `index.html` | Agregar `<script>` del SDK + `firebase-config.js` + `sync-firebase.js` antes de `academias.js`; +1 en `?v=` de archivos modificados |
| `script.js` | Modificar `saveData()`, `importBackup()`, `exportBackup()`, `resetCatalogs()`, `emptyTrash()`, y las funciones `restore*`/`permaDelete*` para propagar a nube; agregar metadatos al respaldo; agregar UI del indicador de estado |
| `academias.js` | No se toca (salvo que decidas cambiar los códigos, lo cual requiere agregar la clave derivada de Firebase) |
| `login.html` | Agregar llamada a `firebase.auth().signInWithEmailAndPassword()` después del login exitoso; agregar el SALT y los emails derivados |
| `firebase.json` | Agregar bloque `"firestore"` para publicar `firestore.rules` |
| `nueva documentacion.md` | Actualizar §1, §2, §3, §4, §5, §8, §9, §11, §12 como indica la instrucción §7 |

### 6.4 Orden de carga en `index.html` (nuevo)

```
lib/firebase-app-compat.min.js      ← SDK base
lib/firebase-auth-compat.min.js     ← autenticación
lib/firebase-firestore-compat.min.js ← base de datos
firebase-config.js?v=1             ← config del proyecto (sin secrets)
sync-firebase.js?v=1               ← expone window.SyncFirebase
academias.js?v=2                   ← ACADEMIA_ACTUAL (igual que hoy)
lib/xlsx.full.min.js
lib/jspdf.umd.min.js
lib/jszip.min.js
script.js?v=6                      ← +1 por modificaciones
carnets-pdf.js?v=1
carnets.js?v=2
```

Los 3 archivos de Firebase se cargan primero porque `firebase-config.js` depende de `firebase.initializeApp` que expone el SDK. `sync-firebase.js` depende de `firebase-config.js`. Ambos van antes de `academias.js` para que `ACADEMIA_ACTUAL` ya exista cuando `sync-firebase.js` lo necesite... o bien `sync-firebase.js` puede leerlo desde `sessionStorage` directamente.

### 6.5 `firebase-config.js` (marcadores)

```js
// Obtén estos valores en la consola Firebase:
// Configuración del proyecto → "Tu aplicación" → "Configuración del SDK"
// O con: firebase apps:sdkconfig web --project moodle-organizador
// Estos valores NO son secretos; la protección real son las reglas de Firestore.
const FIREBASE_CONFIG = {
  apiKey:            "TU_API_KEY_AQUI",
  authDomain:        "moodle-organizador.firebaseapp.com",
  projectId:         "moodle-organizador",
  storageBucket:     "moodle-organizador.appspot.com",
  messagingSenderId: "TU_SENDER_ID_AQUI",
  appId:             "TU_APP_ID_AQUI"
};
firebase.initializeApp(FIREBASE_CONFIG);
```

El archivo no va a `.gitignore` (los valores de configuración web son públicos). La protección real son las reglas de Firestore.

---

## 7. Parte B — Base de datos SQL portable

### 7.1 Ubicación y propósito

Carpeta `database/` en la raíz del repo (fuera de `Organizador_moodle/`, no se publica en Firebase Hosting). Sirve para:
1. Modelar los datos en una base relacional compatible con MySQL 8/MariaDB (la que usa Moodle).
2. Habilitar una futura migración a servidor propio con API REST.
3. Exportar directamente el CSV de carga masiva de Moodle desde una vista SQL.

### 7.2 Esquema `database/schema.sql`

Tablas mínimas (esquema definitivo se finaliza en Fase 2, previa aprobación):

```sql
-- academias
CREATE TABLE academias (
  id              VARCHAR(32)  PRIMARY KEY,
  nombre          VARCHAR(128) NOT NULL,
  subtitulo       VARCHAR(128),
  email_dominio   VARCHAR(128),
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- usuarios_app (accesos a la app, hash del código — nunca el código en claro)
CREATE TABLE usuarios_app (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(128) NOT NULL,
  codigo_hash     VARCHAR(128) NOT NULL,  -- bcrypt o SHA-256 del código
  activo          TINYINT(1) DEFAULT 1,
  creado_en       DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultima_sesion   DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- colegios
CREATE TABLE colegios (
  id              VARCHAR(24) PRIMARY KEY,  -- mismo uid que en la app
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- cursos_modelo
CREATE TABLE cursos_modelo (
  id              VARCHAR(24) PRIMARY KEY,
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  nombre          VARCHAR(256) NOT NULL,
  nivel           ENUM('media','primaria') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- asignaciones (curso copiado a colegio)
CREATE TABLE asignaciones (
  id              VARCHAR(24) PRIMARY KEY,
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24) NOT NULL REFERENCES colegios(id),
  curso_id        VARCHAR(24) NOT NULL REFERENCES cursos_modelo(id),
  anio            VARCHAR(32),
  fecha           DATE,
  nombre_completo VARCHAR(256),
  nombre_corto    VARCHAR(128),
  clases          INT UNSIGNED DEFAULT 0,
  notas           TEXT,
  eliminado_en    DATETIME DEFAULT NULL,   -- NULL = activo; no NULL = en papelera
  lote_baja       VARCHAR(24) DEFAULT NULL -- ID de lote para eliminaciones grupales
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- participantes (nombres de columna compatibles con carga masiva Moodle)
-- No se aplica UNIQUE en username porque la app permite duplicados (ver nota en schema)
CREATE TABLE participantes (
  id              VARCHAR(24) PRIMARY KEY,
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  colegio_id      VARCHAR(24),
  curso_id        VARCHAR(24),
  anio            VARCHAR(32),
  nivel           ENUM('media','primaria'),
  -- Columnas Moodle (nombres exactos del CSV bulk-upload):
  username        VARCHAR(128),
  password        VARCHAR(128),
  firstname       VARCHAR(256),  -- formato app: "<username> <nombres>"
  lastname        VARCHAR(256),  -- apellidos
  email           VARCHAR(256),
  city            VARCHAR(128),
  country         VARCHAR(128),
  course1         VARCHAR(256),
  group1          VARCHAR(128),
  role1           VARCHAR(32)  DEFAULT 'student',
  enrolperiod1    VARCHAR(16)  DEFAULT '365d',
  suspended       CHAR(1)      DEFAULT '0',
  -- Campos propios de la app:
  nombres         VARCHAR(256),  -- nombres sin el username antepuesto
  apellidos       VARCHAR(256),
  fecha           DATE,
  -- Papelera:
  eliminado_en    DATETIME DEFAULT NULL,
  lote_baja       VARCHAR(24) DEFAULT NULL,  -- ID de lote al eliminar lista completa
  INDEX idx_colegio_curso_anio (colegio_id, curso_id, anio),
  INDEX idx_username (username),
  INDEX idx_academia (academia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- NOTA: sin UNIQUE en username porque la app hoy permite duplicados por error del operador.
-- Ver database/README.md para guía de limpieza de duplicados antes de imponer unicidad.

-- carnet_listas (Modo 1 del Generador de carnets)
CREATE TABLE carnet_listas (
  id              VARCHAR(24) PRIMARY KEY,
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  nivel           ENUM('media','primaria') NOT NULL,
  grado           TINYINT UNSIGNED NOT NULL,
  seccion         VARCHAR(8),
  clave           VARCHAR(64) NOT NULL,
  eliminado_en    DATETIME DEFAULT NULL,
  lote_baja       VARCHAR(24) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- carnet_estudiantes (filas de carnet_listas)
CREATE TABLE carnet_estudiantes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lista_id        VARCHAR(24) NOT NULL REFERENCES carnet_listas(id),
  academia_id     VARCHAR(32) NOT NULL REFERENCES academias(id),
  usuario         VARCHAR(128),
  apellidos       VARCHAR(256),
  nombres         VARCHAR(256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- carnet_opciones (una fila por academia)
CREATE TABLE carnet_opciones (
  academia_id     VARCHAR(32) PRIMARY KEY REFERENCES academias(id),
  layout          VARCHAR(16) DEFAULT 'big',
  url             VARCHAR(256),
  upper           TINYINT(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Vista para exportar a Moodle:**
```sql
CREATE VIEW v_moodle_upload AS
SELECT
  username, password, firstname, lastname, email,
  city, country, course1, group1, role1, enrolperiod1, suspended
FROM participantes
WHERE eliminado_en IS NULL;
```

### 7.3 Scripts en `database/scripts/`

1. **`respaldo_a_sql.js`**: acepta un `.json` de respaldo como argumento (`node respaldo_a_sql.js respaldo_tecno_2026-10-06.json`). Genera `INSERT` statements o importa directo a SQLite para prueba local. Lee el `_academia` del respaldo para poblar `academia_id`.

2. **`sql_a_respaldo.js`**: consulta la base de datos (SQLite o MySQL según configuración) y genera un `.json` en el formato exacto de la app (incluida la papelera), listo para importar con "Importar respaldo".

3. **`ejemplo_ficticio.json`**: respaldo con datos inventados (nombres ficticios, sin datos reales). Incluye ≥ 10 participantes, 2 colegios, 3 asignaciones, 1 carnetLista, e ítems en papelera, para poder probar los scripts.

### 7.4 Documentación

- **`database/README.md`**: cómo crear la BD, importar un respaldo, exportar CSV de Moodle, notas de PostgreSQL.
- **`database/MIGRACION_A_SERVIDOR_PROPIO.md`**: qué se copia (`Organizador_moodle/` es estática), qué se reemplaza (adaptador Firebase → adaptador REST propio), cómo cargar los datos en SQL, lista de verificación.

---

## 8. Parte C — Respaldo completo y restauración desde cero

### 8.1 Auditoría de `exportBackup()` actual

`{ ...data, _academia: ACADEMIA_ACTUAL.id }` — el spread incluye **todos** los campos de `data`, incluida `trash`. La papelera SÍ está en el respaldo hoy.

**Lo que falta y se agrega:**
```js
{
  ...data,
  _academia:        ACADEMIA_ACTUAL.id,        // ya existe
  _versionEsquema:  1,                          // nuevo
  _exportadoEn:     new Date().toISOString(),   // nuevo
  _exportadoPor:    sessionStorage.getItem('tcUser') || '',  // nuevo
  _resumen: {                                   // nuevo
    colegios:      data.colegios.length,
    cursos:        data.cursos.length,
    asignaciones:  data.asignaciones.length,
    participantes: data.participantes.length,
    carnetListas:  data.carnetListas.length,
    itemsEnPapelera: trashTotal()
  }
}
```

Los metadatos nuevos no rompen nada: `importBackup()` solo lee `parsed.colegios`, `parsed.cursos`, etc. Los campos `_*` no están en el esquema de `data` y se ignoran naturalmente.

Para ahorrar espacio se propone cambiar `JSON.stringify(payload, null, 2)` → `JSON.stringify(payload)` (sin pretty-print). Reduce el tamaño ~30%. Los metadatos legibles ya están en el objeto `_resumen` y `_exportadoEn`.

### 8.2 Mejoras a `importBackup()`

1. **Auto-backup previo:** antes de reemplazar, si `data` no está vacío, descarga silenciosamente `respaldo_{academia}_{fecha}_previo.json`.
2. **Validación mejorada:** verificar además que `parsed._versionEsquema` exista (o tolerar su ausencia con default 0 para respaldos antiguos).
3. **Resumen post-importación:** toast con conteos: "Importado: 28 colegios, 17 cursos, 150 asignaciones, 2.000 participantes, 20 listas de carnets."
4. **Propagación a nube:** si Firebase está activo, pedir confirmación explícita antes de reemplazar la nube ("también reemplazará los datos en la nube desde otros dispositivos").

### 8.3 Restauración desde app en blanco

`importBackup()` ya funciona con `localStorage` vacío hoy: `loadData()` habrá generado `freshData()`, y `importBackup()` lo reemplaza completamente. **No hay cambio de lógica aquí.** Las mejoras de §8.2 no rompen esto.

Sin internet y sin Firebase: la restauración local nunca depende de la nube → funciona igual.

### 8.4 Tamaño y límites de `localStorage`

| Escenario | Tamaño estimado sin PP | Margen hasta 5 MB |
|---|---|---|
| 500 participantes | ~260 KB | ~4,7 MB (holgado) |
| 2.000 participantes | ~1,0 MB | ~4,0 MB (cómodo) |
| 5.000 participantes | ~2,5 MB | ~2,5 MB (atención) |
| 5.000 part + papelera acumulada | ~3,5–4,5 MB | < 1,5 MB (riesgo) |
| 8.000 participantes | ~3,8 MB | ~1,2 MB (alto riesgo) |

**Riesgo real:** cuando `saveData()` falla, la app ya muestra un toast de advertencia (§1.3). No se implementa ninguna mitigación adicional en Fase 2 sin tu aprobación. Propongo dos acciones preventivas para aprobación:
1. **Aviso al acercarse al límite:** si el tamaño estimado de `JSON.stringify(data)` supera 4 MB, mostrar aviso suave en la vista Respaldo: "Tus datos ocupan X MB / ~5 MB. Considera vaciar la papelera."
2. **Opción futura:** migrar a IndexedDB como almacén local (sin límite de 5 MB). No se implementa en Fase 2.

¿Apruebas el aviso de cuota en Fase 2?

### 8.5 Vista Respaldo — textos actualizados

- "Exportar respaldo": "Descarga un archivo .json con **toda** la información de la academia (colegios, cursos, asignaciones, participantes, carnets y papelera). Es tu copia de seguridad personal."
- Con Firebase activo: "Además de guardarse en este navegador, tus datos están sincronizados en la nube. El respaldo .json sigue siendo tu copia personal descargable."
- "Último respaldo descargado: [fecha]" → se guarda en `localStorage` bajo la clave `tc_last_backup_{academiaId}` (fuera de `data`, no aparece en el respaldo). Si no se ha descargado o han pasado más de 7 días: aviso suave en naranja.

### 8.6 Prueba de ida y vuelta

Para ambas academias:
1. Exportar → vaciar la clave de `localStorage` → recargar → importar → comparar `data` antes y después (igualdad profunda ignorando metadatos `_*`).
2. Se automatiza con un script Node.js (`database/scripts/test_idavuelta.js`) que simula `localStorage` con un objeto en memoria y ejecuta la lógica de `exportBackup` / `importBackup` pura (sin DOM).
3. Caso grande: generar JSON ficticio con ≥ 5.000 participantes, medir tamaño y tiempo de parse/stringify.

---

## 9. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Credenciales Firebase derivables del código fuente | Media | Alto (datos de estudiantes) | Códigos largos + salt interno; reglas de Firestore bien escritas; la organización controla quién tiene acceso al repo |
| Cuota de escrituras de Firestore agotada | Baja | Medio (sync deja de funcionar; app sigue local) | Debounce de 3 s + diff por documento; alertar si la cuota cae al 80% |
| Conflicto de edición simultánea (dos dispositivos) | Baja (3 usuarios raramente simultáneos) | Medio | Backup auto antes de merge; last-write-wins con aviso |
| `localStorage` lleno (> 5 MB) | Media con crecimiento de datos | Alto (app no guarda nada) | Aviso de cuota; vaciar papelera; futura IndexedDB |
| SDK Firebase compat bloqueado por CSP | Baja (Firebase Hosting no tiene CSP restrictiva por defecto) | Alto | Ajustar `headers` en `firebase.json` si aplica |
| Reglas de Firestore mal escritas en deploy | Media | Muy alto | Verificar con emulador Firebase antes de deploy; lista de pruebas manuales en §5.5 |
| Módulos ESM vs scripts regulares (orden de carga) | Resuelto en §6.1 por el uso del SDK compat | — | — |
| Respaldo `.json` real subido a git accidentalmente | Baja | Alto | `.gitignore` cubre `respaldo_*.json`, `*.db`, `*serviceAccount*.json` |

---

## 10. Pasos manuales (comandos exactos)

Esta es la lista ordenada de lo que **tú** debes hacer, antes y durante la implementación. Algunos son pre-requisitos de Fase 2 y otros van después de que yo entregue los archivos.

### Pre-Fase 2: habilitación en la consola Firebase

**1. Habilitar Firestore en modo producción**
- Consola Firebase → moodle-organizador → Build → Firestore Database → "Crear base de datos" → Región recomendada: `us-east1` (o la más cercana a tus usuarios) → Modo "Producción" (reglas en denegar por defecto).

**2. Habilitar Firebase Authentication**
- Consola Firebase → Build → Authentication → "Comenzar" → Proveedores de inicio de sesión → "Email/contraseña" → Activar → Guardar.

**3. Crear las cuentas de usuario**
Después de que yo te dé las contraseñas derivadas (en Fase 2), en la consola Firebase → Authentication → Usuarios → "Agregar usuario":
```
Email: admin@tecno.organizador        Contraseña: [la que yo calcule]
Email: asistente@tecno.organizador    Contraseña: [la que yo calcule]
Email: ruben@cleveland.organizador    Contraseña: [la que yo calcule]
```
Copia los UIDs que aparecen al crear cada cuenta.

**4. Crear los documentos de autorización en Firestore**
En la consola Firebase → Firestore → Colecciones → "Nueva colección": `auth_map`.
Agrega un documento por UID (el que copiaste en el paso 3):

| ID del documento | Campo | Valor |
|---|---|---|
| `{uid_de_admin}` | `academiaId` | `tecno` |
| `{uid_de_admin}` | `nombre` | `Administrador` |
| `{uid_de_asistente}` | `academiaId` | `tecno` |
| `{uid_de_asistente}` | `nombre` | `Asistente` |
| `{uid_de_ruben}` | `academiaId` | `cleveland` |
| `{uid_de_ruben}` | `nombre` | `Ruben Mogollon` |

**5. Obtener la configuración web del proyecto**
```bash
firebase apps:sdkconfig web --project moodle-organizador
```
Copia el objeto `firebaseConfig` y pégalo en `Organizador_moodle/firebase-config.js` donde yo deje los marcadores.

### Post-Fase 2: despliegue de reglas y app

**6. Publicar las reglas de Firestore**
```bash
firebase deploy --only firestore:rules --project moodle-organizador
```

**7. Verificar las reglas (pruebas manuales)**
Con las cuentas del paso 3, verifica los 5 casos de §5.5 usando la consola Firestore → "Reglas" → "Probar reglas" (playground).

**8. Ejecutar la migración inicial de datos locales**
Abre la app en el navegador donde tienes los datos reales. Después de que el SDK cargue y se autentique, aparecerá el diálogo de §4.3 → "Subir los datos de este equipo a la nube". Ejecuta esto para Tecno y luego para Cleveland (con sesión de `ruben`).

**9. Verificar que Tecno no lee Cleveland (y viceversa)**
Con sesión de `ruben` (Cleveland), abre la consola del navegador e intenta:
```js
firebase.firestore().collection('academias/tecno/colegios').get()
```
Debe devolver error de permisos.

**10. Desplegar la app actualizada**
```bash
firebase deploy --only hosting --project moodle-organizador
```

**11. Verificar en producción**
Abrir la app desde otro dispositivo, iniciar sesión con `2026` (nuevo código largo), confirmar que los datos aparecen.

---

## Preguntas que necesitan tu respuesta antes de Fase 2

1. **¿Qué nuevos códigos de acceso quieres usar?** Necesito que sean de 8+ caracteres para mayor seguridad (ej: `tecno2026admin`, `tc1010asist`, `clvruben2026`). Puedes elegirlos libremente.

   Quiero que se siga manteniendo los mimos codigos. Por lo mometnos no tengo pensado añadir amas nadie

3. **¿Escucha en tiempo real o polling?** El plan propone polling (al abrir, al volver a la pestaña, botón manual). Si prefieres actualizaciones automáticas cada 5–10 min sin clic, puedo agregarlo. Pero no recomiendo listener en tiempo real por el riesgo de pisar la vista previa del Generador.

4. **¿Apruebas el aviso de cuota de `localStorage` (§8.4)?** Es una alerta suave en la vista Respaldo cuando los datos superen ~4 MB. Sin impacto en funcionalidad.

5. **¿Quieres incluir el script `firestore_a_sql.js` (Parte B §4.2 opcional)?** Requiere una clave de cuenta de servicio de Firebase Admin SDK que tú descargas y colocas fuera del repo. Útil para una migración inicial directa desde la nube, pero no es crítico si tienes el respaldo `.json`.

6. **¿Prefieres SDK vendorizado en `lib/` o ESM desde CDN?** El plan recomienda vendorizado por simplicidad. Si prefieres no descargar los archivos del SDK, la alternativa CDN es posible con un ajuste en el orden de carga.

   En respuestas a las preguntas anteriorio lo que estoy buscando es que se guarde la informacion de cada usuarios cleveland y tecno y que asu vez tenga la opcion de descargar el respaldo .json, recuerda que puede que mueva esta aplicacion a un dominio con vps. Y en un futuro quiero añadir funciones para que en vez que esta appweb sea espesifica (que esta resolviendo necesidades solo de esta academia) pueda ser usada de fomra general para cualquier administrador lms

---

*Cuando estés listo, responde "adelante" para iniciar la Fase 2. Puedes incluir tus respuestas a las preguntas anteriores en el mismo mensaje.*
