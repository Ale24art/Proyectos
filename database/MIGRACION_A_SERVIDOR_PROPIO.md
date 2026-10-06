# Guía — Mudar el Organizador Moodle a un dominio y servidor propios

Esta app se diseñó para que la mudanza fuera de Firebase sea, en lo posible,
**cambiar un solo archivo**: `Organizador_moodle/sync-firebase.js`. Todo lo
demás (`sync.js`, `sync-core.js`, `script.js`, `carnets.js`, etc.) habla
siempre con la interfaz genérica `window.Sync`, nunca con `firebase.*`
directamente — ver "Capa abstracta" en `nueva documentacion.md` §3.

## Qué se copia tal cual

`Organizador_moodle/` es una app estática (HTML + CSS + JS, sin build, sin
backend). Se puede servir desde cualquier servidor web (Nginx, Apache,
Caddy, un bucket con CDN, etc.) copiando la carpeta completa. No depende de
Firebase para abrir ni para funcionar en modo local — ver §3.3.5 / ajuste (e)
de la instrucción de Fase 2: si `window.Sync` no tiene un adaptador
registrado, la app funciona exactamente igual que sin nube.

Archivos que NO cambian en una mudanza:
- `academias.js`, `login.html`, `index.html` (salvo los `<script src>` del
  bloque de sincronización, ver abajo), `script.js`, `carnets.js`,
  `carnets-pdf.js`, `carnets.css`, `styles.css`, `sync-core.js`, `sync.js`.

## Qué se reemplaza

1. **El adaptador de nube.** `sync-firebase.js` implementa un contrato de 7
   funciones (ver el bloque `window.Sync._registrarAdaptador({...})` al
   final del archivo):

   ```js
   {
     autenticar(email, password) -> {uid, email, academiaId, nombre}
     cerrarSesion()
     sesionActiva() -> {uid, email, academiaId, nombre} | null
     primeraVezEnLaNube() -> boolean
     leerRevRaiz() -> number | null        // 1 lectura liviana del documento raíz
     leerTodasLasColecciones() -> { coleccionesRemotas, tombstones, rev }
     escribirLote({ cambios, eliminados, tombstonesNuevos, autor, academiaId, schemaVersion })
   }
   ```

   Un adaptador REST equivalente (`sync-rest.js`, por ejemplo) implementa las
   mismas 7 funciones contra tu API propia:
   - `autenticar` → `POST /api/login` (correo + contraseña del servidor propio, o el método de tu elección).
   - `leerRevRaiz` → `GET /api/academias/:id/rev` (debe ser 1 sola lectura barata).
   - `leerTodasLasColecciones` → `GET /api/academias/:id/estado` devolviendo las mismas colecciones que hoy viven en Firestore (`colegios`, `cursos`, `asignaciones`, `carnetListas`, `carnetOpciones`, `listas_part`, `trash_*`, y los tombstones).
   - `escribirLote` → `POST /api/academias/:id/lote` con el mismo payload `{cambios, eliminados, tombstonesNuevos}` — tu API decide cómo lo persiste (la base SQL de `database/schema.sql` es un buen punto de partida).

   Al final, reemplaza la llamada:
   ```js
   window.Sync._registrarAdaptador({ autenticar, cerrarSesion, ... });
   ```
   por tu propia implementación. **Nada en `sync.js` ni en `script.js` necesita cambiar.**

2. **Los `<script>` de `index.html`.** Quita las líneas del SDK de Firebase
   (`lib/firebase-*-compat.min.js`, `firebase-config.js`, `sync-firebase.js`)
   y agrega tu `sync-rest.js` en su lugar, después de `sync.js`:
   ```html
   <script src="academias.js?v=2"></script>
   <script src="sync-core.js?v=1"></script>
   <script src="sync.js?v=1"></script>
   <script src="sync-rest.js?v=1"></script>   <!-- tu adaptador -->
   ...
   ```

3. **La autenticación de acceso a la app** (`login.html`, los códigos
   `2026`/`1010`/`ruben`) es independiente de la nube y no cambia con esta
   mudanza — sigue siendo local al navegador. Si tu servidor propio también
   va a validar esos códigos (en vez de solo guardar los datos), la tabla
   `usuarios_app` de `database/schema.sql` ya está pensada para eso
   (`codigo_hash` con bcrypt/argon2, nunca el código en claro).

## Cómo cargar los datos actuales en tu base SQL

1. Descarga un respaldo `.json` desde la app (vista Respaldo) para cada
   academia.
2. `node database/scripts/respaldo_a_sql.js respaldo_tecno_2026-10-06.json --sql tecno.sql`
3. Revisa `tecno.sql` y ejecútalo contra tu servidor MySQL/MariaDB real:
   `mysql -u tu_usuario -p tu_base < tecno.sql`
4. Repite para `cleveland` (y cualquier academia futura).
5. Tu API propia lee/escribe esa misma base de datos.

## Lista de verificación de la mudanza

- [ ] El nuevo servidor sirve `Organizador_moodle/` tal cual (prueba abrir
      `login.html` y entrar con un código existente — debe funcionar
      exactamente igual, sin nube).
- [ ] `sync-rest.js` (o el nombre que le pongas) implementa las 7 funciones
      del contrato y se registra con `window.Sync._registrarAdaptador(...)`.
- [ ] Las reglas de autorización de tu API separan `tecno` y `cleveland` al
      menos tan estrictamente como lo hacían `firestore.rules` (ninguna
      cuenta puede leer o escribir la academia de otra).
- [ ] Los respaldos `.json` existentes se migraron a la base SQL con
      `respaldo_a_sql.js` y se verificó con un `sql_a_respaldo.js` (o
      el equivalente contra tu motor real) que la ida y vuelta no pierde
      datos (ver `database/scripts/test_idavuelta.js` como referencia).
- [ ] Multi-organización (si se activa en el futuro): `sync-core.js`, las
      reglas de autorización y el esquema SQL ya usan un identificador
      genérico de organización (`academiaId` / `academia_id`) en vez de
      comparaciones fijas como `=== 'tecno'` — una organización nueva no
      debería requerir tocar la lógica de sincronización, solo agregar sus
      datos (ver `nueva documentacion.md` §9a para lo que sí sigue
      hardcodeado hoy del lado de `script.js`, como el catálogo base).
- [ ] `firebase.json`, `firestore.rules`, `firebase-config.js` y
      `lib/firebase-*-compat.min.js` se pueden borrar una vez confirmado
      que el adaptador nuevo funciona (o conservarlos como referencia).
