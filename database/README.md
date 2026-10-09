# database/ — Base de datos portable del Organizador Moodle

Esta carpeta vive **fuera** de `Organizador_moodle/`, así que nunca se publica
en Firebase Hosting (`firebase.json` solo publica `Organizador_moodle/`).
Su propósito es poder mudar la app a un servidor propio sin depender de
Firebase (ver `MIGRACION_A_SERVIDOR_PROPIO.md`) y, de paso, dejar los datos
en un formato relacional que Moodle entiende de forma nativa.

No reemplaza nada de lo que la app hace hoy: `localStorage` sigue siendo la
fuente de datos de la app, y Firestore (si está vinculado) la copia en la
nube. Esto es un **tercer formato**, pensado para análisis, respaldo externo
o la futura migración.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `schema.sql` | Esquema MySQL 8 / MariaDB. Es la fuente de verdad del modelo relacional. |
| `scripts/mapeo.js` | Conversión Respaldo JSON ⇄ filas SQL. Lo usan los dos scripts de abajo. |
| `scripts/respaldo_a_sql.js` | Respaldo `.json` de la app → `.sql` (MySQL) y/o `.db` (SQLite, para pruebas). |
| `scripts/sql_a_respaldo.js` | Camino inverso: SQLite → Respaldo `.json` que la app puede importar. |
| `scripts/sqlite-schema.js` | Traducción del esquema a SQLite, solo para los scripts de prueba (`node:sqlite`, sin instalar nada). |
| `scripts/ejemplo_ficticio.json` | Respaldo de ejemplo con datos **inventados**, para probar los scripts sin tocar datos reales. |
| `scripts/test_idavuelta.js` | Prueba automática: Respaldo → SQL → Respaldo debe devolver los mismos datos (orden incluido), para ambas academias, más un caso con 5.000 participantes. |
| `scripts/test_sync_core.js` | Pruebas unitarias de la lógica de sincronización (`Organizador_moodle/sync-core.js`). |
| `scripts/test_sync_dos_dispositivos.js` | Simula dos dispositivos sincronizando contra una "nube" falsa en memoria (sin Firebase real). |

## Crear la base de datos (MySQL / MariaDB real)

```bash
mysql -u root -p -e "CREATE DATABASE organizador_moodle CHARACTER SET utf8mb4"
mysql -u root -p organizador_moodle < database/schema.sql
```

## Importar un respaldo real

```bash
node database/scripts/respaldo_a_sql.js respaldo_tecno_2026-10-06.json --sql salida.sql
mysql -u root -p organizador_moodle < salida.sql
```

`respaldo_a_sql.js` nunca necesita credenciales: lee un archivo local y
escribe un archivo `.sql` local. Tú decides cuándo y cómo correrlo contra
tu servidor real.

## Probar sin un servidor MySQL (SQLite local, con Node)

```bash
node database/scripts/respaldo_a_sql.js database/scripts/ejemplo_ficticio.json --sqlite /tmp/ejemplo.db
node database/scripts/sql_a_respaldo.js --sqlite /tmp/ejemplo.db --academia tecno --salida /tmp/vuelta.json
```

El `.json` resultante se puede importar directamente en la app con
"Importar respaldo" en la vista Respaldo.

Requiere Node 22 o más reciente (usa el módulo `node:sqlite`, incluido —
no hace falta instalar nada con `npm`).

## Exportar el CSV de carga masiva de Moodle desde SQL

```sql
SELECT * FROM v_moodle_upload WHERE academia_id = 'tecno'
  INTO OUTFILE '/tmp/usuarios_tecno.csv'
  FIELDS TERMINATED BY ',' ENCLOSED BY '"' LINES TERMINATED BY '\n';
```

(La ruta exacta de `INTO OUTFILE` depende de los permisos del servidor
MySQL; si no tienes acceso al sistema de archivos del servidor, exporta
el resultado de `SELECT * FROM v_moodle_upload` con el cliente que uses
— MySQL Workbench, DBeaver, `mysql --batch`, etc.)

## Correr las pruebas

```bash
node database/scripts/test_idavuelta.js
node database/scripts/test_sync_core.js
node database/scripts/test_sync_dos_dispositivos.js
node database/scripts/test_agregar_estudiantes.js
```

## Decisiones del esquema que conviene conocer

- **`username` no es `UNIQUE`.** La app permite hoy duplicados si alguien
  edita el usuario a mano en la vista previa sin pasar por el pool de
  numeración (ver `nueva documentacion.md` §6.1). Imponer `UNIQUE` aquí
  rompería una importación real con datos existentes. Si más adelante se
  decide exigir unicidad, primero hay que:
  1. `SELECT username, academia_id, COUNT(*) FROM participantes WHERE eliminado_en IS NULL GROUP BY username, academia_id HAVING COUNT(*) > 1;`
  2. Resolver cada duplicado a mano (renombrar o eliminar), y solo entonces
     agregar `ADD UNIQUE (academia_id, username)`.
- **`eliminado_en` en `colegios`/`cursos_modelo`/`asignaciones` para los
  registros que ya estaban en la Papelera al exportar es aproximado**: la
  app no guarda la fecha exacta en que un colegio o curso modelo fue
  enviado a la Papelera (`trash.colegios`/`trash.cursos`/`trash.asignaciones`
  no llevan `fechaEliminacion`, a diferencia de `trash.estudiantes` y
  `trash.carnetListas`, que sí la llevan). Los scripts usan la fecha de
  exportación del respaldo (`_exportadoEn`) como aproximación. Esto es una
  limitación del formato de origen, no de este esquema.
- **`agregado_en`** (columna opcional en `participantes`): `NULL` = participante generado en la creación de la lista; no `NULL` = añadido posteriormente mediante el "modo agregar" de la app. El valor es una cadena ISO 8601 (igual que en el campo `agregadoEn` del respaldo JSON). No requiere migración de datos existentes; los registros sin este campo en la app simplemente no producen ningún valor en esta columna al importar. Al exportar de SQL a respaldo JSON (`sql_a_respaldo.js`), si `agregado_en` es `NULL`, el campo `agregadoEn` se omite del objeto participante (retrocompatible con respaldos antiguos).
- **`tipo_papelera`** distingue si un participante en la Papelera llegó ahí
  como parte de una **lista completa** (`'lote'`, equivalente a
  `trash.participantes` en la app — varias filas comparten el mismo
  `lote_baja`) o **individualmente** desde Ver/Editar (`'individual'`,
  equivalente a `trash.estudiantes`). Es necesario para poder reconstruir
  el formato exacto del respaldo sin ambigüedad.
- **No hay tablas para `_rev`, tombstones ni línea base de sincronización.**
  Esos son conceptos de la capa de sincronización en la nube (ver
  `Organizador_moodle/sync-core.js` y `sync-firebase.js`), no del modelo de
  datos de Moodle. Un futuro backend propio puede resolver concurrencia con
  su propia estrategia (REST + control de versiones, WebSockets, lo que sea).

## Adaptar a PostgreSQL

- `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY` (o `SERIAL`).
- `ENUM('media','primaria')` → un `CHECK (nivel IN ('media','primaria'))` sobre una columna `TEXT`/`VARCHAR`, o un tipo `ENUM` nativo de Postgres (`CREATE TYPE nivel_curso AS ENUM (...)`).
- `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` → se elimina (Postgres no tiene motores de almacenamiento intercambiables; el charset se define a nivel de base de datos, normalmente `UTF8` por defecto).
- `TINYINT(1)` → `BOOLEAN`.
- `DATETIME` → `TIMESTAMP`.
- Los `REFERENCES` inline funcionan igual; revisa el orden de creación de tablas (Postgres es estricto con las referencias hacia adelante dentro de la misma transacción).
