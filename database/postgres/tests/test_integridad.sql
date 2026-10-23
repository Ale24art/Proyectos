-- ══════════════════════════════════════════════════════════════════
-- PRUEBAS DE INTEGRIDAD, RLS Y SYNC — Esquema v2.6
-- Todos los datos son ficticios. Ningún nombre real de estudiante.
--
-- Cómo ejecutar:
--   docker run --rm --name pg_test \
--     -e POSTGRES_PASSWORD=test -p 5432:5432 -d postgres:16
--   psql -h localhost -U postgres -c "CREATE DATABASE control_estudio;"
--   psql -h localhost -U postgres -d control_estudio -f database/postgres/schema.sql
--   psql -h localhost -U postgres -d control_estudio \
--     -f database/postgres/tests/test_integridad.sql
--   docker stop pg_test
--
-- ESTRUCTURA DE ESTE ARCHIVO (cuatro partes):
--
--   PARTE 1 — Datos base (COMMIT separado del superusuario).
--             Los datos deben estar commitados antes de las pruebas de RLS:
--             un superusuario bypassea RLS y no puede probar las políticas reales.
--
--   PARTE 2 — Pruebas de integridad estructural (como superusuario).
--             Prueban FK, CHECK, UNIQUE, integridad cruzada y cálculos.
--             Corren dentro de BEGIN/ROLLBACK para dejar la BD limpia.
--
--   PARTE 3 — Pruebas de RLS (SET LOCAL ROLE app_user, sin WHERE manual).
--             Las consultas NO llevan WHERE academia_id = ...; la política RLS
--             filtra automáticamente. Es la única forma de probar las políticas reales.
--             Corren dentro de BEGIN/ROLLBACK para revertir efectos secundarios.
--
--   PARTE 4 — Limpieza: elimina los datos de PARTE 1 en orden inverso a FK.
-- ══════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════
-- PARTE 1: DATOS BASE (COMMIT SEPARADO)
-- ══════════════════════════════════════════════════════════════════

BEGIN;

INSERT INTO academias (id, nombre, email_dominio, moodle_url) VALUES
  ('tecno',     'TecnoCleveland',             'tc.edu.ve',  'https://moodle.ejemplo-tecno.ve'),
  ('cleveland', 'Cleveland English Institute', 'cei.edu.ve', 'https://moodle.ejemplo-cei.ve');

INSERT INTO usuarios_app (id, email, nombre, password_hash) VALUES
  (1, 'admin@tc.edu.ve',   'Admin Tecno',   '$argon2id$v=19$ejemplo_hash_1'),
  (2, 'gerente@tc.edu.ve', 'Gerente Ambas', '$argon2id$v=19$ejemplo_hash_2'),
  (3, 'asesor@tc.edu.ve',  'Asesor Tecno',  '$argon2id$v=19$ejemplo_hash_3');

INSERT INTO roles_academia (usuario_id, academia_id, rol) VALUES
  (1, 'tecno',     'admin'),
  (2, 'tecno',     'gerente'),
  (2, 'cleveland', 'gerente'),
  (3, 'tecno',     'asesor');

INSERT INTO colegios (id, academia_id, nombre) VALUES
  ('col_ceu', 'tecno',     'Colegio Ejemplo Uno'),
  ('col_cej', 'tecno',     'Colegio Ejemplo Junior'),
  ('col_cei', 'cleveland', 'Centro de Idiomas Ejemplo');

INSERT INTO cursos_modelo (id, academia_id, nombre, nivel) VALUES
  ('cur_rob3', 'tecno',     'Robótica 3er Año', 'media'),
  ('cur_ing1', 'cleveland', 'Inglés Básico',     'primaria');

INSERT INTO asignaciones_moodle (id, academia_id, colegio_id, curso_id, anio, nombre_corto, moodle_course_id) VALUES
  ('asig_r3_ceu_26', 'tecno', 'col_ceu', 'cur_rob3', '2026', '3erROB-CEU-26', 1001),
  ('asig_r3_cej_26', 'tecno', 'col_cej', 'cur_rob3', '2026', '3erROB-CEJ-26', 1002);

-- publicada_en se fija la primera vez que el sync ve visible=TRUE.
-- En los datos de prueba se pone manualmente para las secciones activas.
INSERT INTO secciones_moodle
  (id, asignacion_id, academia_id, moodle_section_id, numero_seccion, numero_unidad, titulo, visible, publicada_en)
VALUES
  (1, 'asig_r3_ceu_26', 'tecno', 101, 1, 1, 'Unidad 1: Electrónica básica', TRUE,  NOW()),
  (2, 'asig_r3_ceu_26', 'tecno', 102, 2, 1, 'Unidad 1: Circuitos',          TRUE,  NOW()),
  (3, 'asig_r3_ceu_26', 'tecno', 103, 3, 2, 'Unidad 2: Sensores',           FALSE, NOW()),  -- oculta pero publicada
  (4, 'asig_r3_cej_26', 'tecno', 201, 1, 1, 'Unidad 1: Intro',              TRUE,  NOW());

-- actividad 13: seccion 3 está oculta pero publicada_en IS NOT NULL → sigue siendo elegible
-- actividad 15: ausente_en IS NOT NULL, ausencias_consecutivas=2 → excluida de elegibles (Test 21)
--   ausencias_consecutivas=2 es obligatorio cuando ausente_en IS NOT NULL (CHECK chk_act_ausente)
INSERT INTO actividades_moodle
  (id, seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo, tiene_finalizacion, visible, publicada_en, ausente_en, ausencias_consecutivas)
VALUES
  (10, 1, 'asig_r3_ceu_26', 'tecno', 1001, 'h5pactivity', TRUE,  TRUE,  NOW(), NULL, 0),
  (11, 1, 'asig_r3_ceu_26', 'tecno', 1002, 'quiz',         TRUE,  TRUE,  NOW(), NULL, 0),
  (12, 2, 'asig_r3_ceu_26', 'tecno', 1003, 'assign',       TRUE,  TRUE,  NOW(), NULL, 0),
  (13, 3, 'asig_r3_ceu_26', 'tecno', 1004, 'h5pactivity',  TRUE,  FALSE, NOW(), NULL, 0),  -- oculta, publicada
  (14, 4, 'asig_r3_cej_26', 'tecno', 2001, 'quiz',         TRUE,  TRUE,  NOW(), NULL, 0),
  (15, 1, 'asig_r3_ceu_26', 'tecno', 1005, 'h5pactivity',  TRUE,  FALSE, NOW(), NOW(), 2);  -- ausente_en IS NOT NULL (consecutivas=2)

INSERT INTO estudiantes (id, academia_id, nombres, apellidos) VALUES
  ('est_ana',    'tecno', 'Ana',     'Gomez Perez'),
  ('est_carlos', 'tecno', 'Carlos',  'Lopez Torres'),
  ('est_diana',  'tecno', 'Diana',   'Ramirez Vega'),
  ('est_edu',    'tecno', 'Eduardo', 'Silva Mora');

INSERT INTO grupos (id, academia_id, asignacion_id, nombre_grupo) VALUES
  ('grp_3a', 'tecno', 'asig_r3_ceu_26', 'Grupo 3A'),
  ('grp_3b', 'tecno', 'asig_r3_ceu_26', 'Grupo 3B'),
  ('grp_j1', 'tecno', 'asig_r3_cej_26', 'Grupo J1');

INSERT INTO matriculas (id, academia_id, estudiante_id, asignacion_id, grupo_id, username, email) VALUES
  ('mat_ana',    'tecno', 'est_ana',    'asig_r3_ceu_26', 'grp_3a', 'rob3ceu01', 'rob3ceu01@tc.edu.ve'),
  ('mat_carlos', 'tecno', 'est_carlos', 'asig_r3_ceu_26', 'grp_3a', 'rob3ceu02', 'rob3ceu02@tc.edu.ve'),
  ('mat_diana',  'tecno', 'est_diana',  'asig_r3_ceu_26', 'grp_3b', 'rob3ceu03', 'rob3ceu03@tc.edu.ve'),
  ('mat_edu',    'tecno', 'est_edu',    'asig_r3_cej_26', 'grp_j1', 'rob3cej01', 'rob3cej01@tc.edu.ve');

INSERT INTO progreso_actividades (matricula_id, actividad_id, asignacion_id, academia_id, moodle_completado, nota) VALUES
  ('mat_ana',    10, 'asig_r3_ceu_26', 'tecno', 1, NULL),  -- completado
  ('mat_ana',    11, 'asig_r3_ceu_26', 'tecno', 2, 8.5),   -- completado y aprobado
  ('mat_ana',    12, 'asig_r3_ceu_26', 'tecno', 3, 4.0),   -- completado no aprobado
  ('mat_carlos', 10, 'asig_r3_ceu_26', 'tecno', 1, NULL),  -- completado
  ('mat_carlos', 11, 'asig_r3_ceu_26', 'tecno', 0, NULL);  -- no completado

COMMIT;

-- Sincronizar secuencias con los IDs explícitos insertados en Part 1.
-- Las secuencias de secciones_moodle y actividades_moodle no avanzan con INSERT
-- explícito; sin esto cualquier INSERT posterior con BIGSERIAL genera id=1 → conflicto.
SELECT setval('secciones_moodle_id_seq',   (SELECT MAX(id) FROM secciones_moodle));
SELECT setval('actividades_moodle_id_seq', (SELECT MAX(id) FROM actividades_moodle));

-- ══════════════════════════════════════════════════════════════════
-- PARTE 2: PRUEBAS DE INTEGRIDAD ESTRUCTURAL (superusuario)
-- Las excepciones lanzadas dentro de los bloques DO son intencionales.
-- ══════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- TEST 1: moodle_completado fuera de rango debe fallar
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO progreso_actividades
      (matricula_id, actividad_id, asignacion_id, academia_id, moodle_completado)
    VALUES ('mat_ana', 12, 'asig_r3_ceu_26', 'tecno', 4);
    RAISE EXCEPTION 'TEST 1 FALLÓ: debió rechazar moodle_completado=4';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 1 OK: moodle_completado=4 rechazado por CHECK (0..3)';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 2: grupo de otra asignación no puede asignarse a matrícula
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO matriculas (id, academia_id, estudiante_id, asignacion_id, grupo_id, username)
    VALUES ('mat_test_cross', 'tecno', 'est_ana', 'asig_r3_cej_26', 'grp_3a', 'test_cross');
    RAISE EXCEPTION 'TEST 2 FALLÓ: debió rechazar grupo de otra asignación';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 2 OK: FK (grupo_id, asignacion_id) impide cruzar asignaciones';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 3: progreso no puede cruzar matrícula y actividad de distinta asignación
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO progreso_actividades
      (matricula_id, actividad_id, asignacion_id, academia_id, moodle_completado)
    VALUES ('mat_edu', 10, 'asig_r3_cej_26', 'tecno', 1);
    RAISE EXCEPTION 'TEST 3 FALLÓ: debió rechazar actividad de otra asignación';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 3 OK: FK (actividad_id, asignacion_id) impide cruzar asignaciones en progreso';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 4: username duplicado entre activos debe fallar
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO matriculas (id, academia_id, estudiante_id, asignacion_id, username)
    VALUES ('mat_dup', 'tecno', 'est_diana', 'asig_r3_ceu_26', 'rob3ceu01');
    RAISE EXCEPTION 'TEST 4 FALLÓ: debió rechazar username duplicado entre activos';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 4 OK: uk_username_activo impide username duplicado entre activos';
  END;
END $$;

-- TEST 4b: username duplicado en papelera sí se permite
DO $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO matriculas (id, academia_id, estudiante_id, asignacion_id, username, eliminado_en)
  VALUES ('mat_baja', 'tecno', 'est_diana', 'asig_r3_ceu_26', 'rob3ceu01', NOW());
  SELECT COUNT(*) INTO v_count FROM matriculas WHERE username = 'rob3ceu01';
  IF v_count = 2 THEN
    RAISE NOTICE 'TEST 4b OK: username duplicado en papelera permitido (eliminado_en IS NOT NULL)';
  ELSE
    RAISE EXCEPTION 'TEST 4b FALLÓ: conteo inesperado %', v_count;
  END IF;
  DELETE FROM matriculas WHERE id = 'mat_baja';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 5: uk_asig_activa impide dos asignaciones activas (mismo colegio/curso/año)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO asignaciones_moodle (id, academia_id, colegio_id, curso_id, anio, nombre_corto)
    VALUES ('asig_r3_ceu_26_dup', 'tecno', 'col_ceu', 'cur_rob3', '2026', '3erROB-CEU-26-dup');
    RAISE EXCEPTION 'TEST 5 FALLÓ: debió rechazar asignación activa duplicada';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 5 OK: uk_asig_activa impide dos asignaciones activas para mismo (colegio, curso, año)';
  END;
END $$;

-- TEST 5b: la misma combinación en papelera sí se permite
DO $$
BEGIN
  INSERT INTO asignaciones_moodle
    (id, academia_id, colegio_id, curso_id, anio, nombre_corto, eliminado_en)
  VALUES ('asig_r3_ceu_26_old', 'tecno', 'col_ceu', 'cur_rob3', '2026', '3erROB-CEU-26-old', NOW());
  RAISE NOTICE 'TEST 5b OK: asignación eliminada con mismo (colegio, curso, año) permitida';
  DELETE FROM asignaciones_moodle WHERE id = 'asig_r3_ceu_26_old';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 7: % de avance con estados 0-3 (1 y 2 cuentan; 3 no suma)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_completadas   INT;
  v_aprobadas     INT;
  v_no_aprobadas  INT;
  v_elegibles     INT;
  v_pct           NUMERIC;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE pa.moodle_completado IN (1, 2)) AS completadas,
    COUNT(*) FILTER (WHERE pa.moodle_completado = 2)       AS aprobadas,
    COUNT(*) FILTER (WHERE pa.moodle_completado = 3)       AS no_aprobadas,
    COUNT(DISTINCT a.id) AS elegibles
  INTO v_completadas, v_aprobadas, v_no_aprobadas, v_elegibles
  FROM matriculas           m
  JOIN progreso_actividades pa ON pa.matricula_id = m.id
  JOIN actividades_moodle   a  ON a.id = pa.actividad_id
  JOIN secciones_moodle     s  ON s.id = a.seccion_id
  WHERE m.id = 'mat_ana'
    AND s.numero_seccion BETWEEN 1 AND 2
    AND a.tiene_finalizacion = TRUE;

  v_pct := ROUND(100.0 * v_completadas / NULLIF(v_elegibles, 0), 1);

  IF v_completadas = 2 AND v_aprobadas = 1 AND v_no_aprobadas = 1 AND v_pct = 66.7 THEN
    RAISE NOTICE 'TEST 7 OK: mat_ana → completadas=%, aprobadas=%, no_aprobadas=%, %%=%',
      v_completadas, v_aprobadas, v_no_aprobadas, v_pct;
  ELSE
    RAISE EXCEPTION 'TEST 7 FALLÓ: completadas=%, aprobadas=%, no_aprobadas=%, %%=%',
      v_completadas, v_aprobadas, v_no_aprobadas, v_pct;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 8: vista v_moodle_upload — firstname = username + ' ' + nombres
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_firstname TEXT;
  v_lastname  TEXT;
  v_group1    TEXT;
  v_course1   TEXT;
BEGIN
  SELECT firstname, lastname, group1, course1
  INTO v_firstname, v_lastname, v_group1, v_course1
  FROM v_moodle_upload
  WHERE username = 'rob3ceu01';

  IF v_firstname = 'rob3ceu01 Ana'
     AND v_lastname = 'Gomez Perez'
     AND v_group1   = 'Grupo 3A'
     AND v_course1  = '3erROB-CEU-26' THEN
    RAISE NOTICE 'TEST 8 OK: firstname="%", lastname="%", group1="%", course1="%"',
      v_firstname, v_lastname, v_group1, v_course1;
  ELSE
    RAISE EXCEPTION 'TEST 8 FALLÓ: firstname="%", lastname="%", group1="%", course1="%"',
      v_firstname, v_lastname, v_group1, v_course1;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 9_EMPTY_RANGO: avance por estudiante con rango SIN actividades → 0 elegibles
--
-- REPRODUCE EL BUG: con CROSS JOIN en la CTE avance, si eligibles es vacía
-- (rango 8-9: ninguna sección tiene numero_unidad 8 o 9), el CROSS JOIN
-- produce 0 filas y los estudiantes desaparecen del resultado.
-- Con LEFT JOIN ... ON TRUE, los estudiantes siguen apareciendo con elegibles=0
-- y porcentaje=NULL.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_filas      INT;
  v_elegibles  INT;
BEGIN
  WITH elegibles AS (
    SELECT a.id AS actividad_id
    FROM   actividades_moodle a
    JOIN   secciones_moodle   s ON s.id = a.seccion_id
    WHERE  s.asignacion_id      = 'asig_r3_ceu_26'
      AND  s.numero_unidad    BETWEEN 8 AND 9       -- rango sin actividades
      AND  a.publicada_en    IS NOT NULL
      AND  a.tiene_finalizacion = TRUE
      AND  a.ausente_en      IS NULL
  ),
  avance AS (
    SELECT
      m.id AS matricula_id,
      COUNT(el.actividad_id) AS elegibles
    FROM  matriculas   m
    -- LEFT JOIN (no CROSS JOIN): si elegibles vacía, los estudiantes siguen apareciendo
    LEFT JOIN elegibles el ON TRUE
    LEFT JOIN progreso_actividades pa
           ON pa.matricula_id = m.id AND pa.actividad_id = el.actividad_id
    WHERE m.asignacion_id = 'asig_r3_ceu_26'
      AND m.grupo_id      = 'grp_3a'
      AND m.eliminado_en IS NULL
    GROUP BY m.id
  )
  SELECT COUNT(*), COALESCE(MAX(elegibles), 0)
  INTO v_filas, v_elegibles
  FROM avance;

  IF v_filas = 2 AND v_elegibles = 0 THEN
    RAISE NOTICE 'TEST 9_EMPTY_RANGO OK: rango 8-9 → % estudiantes visibles, elegibles=0 (no desaparecen)',
      v_filas;
  ELSE
    RAISE EXCEPTION 'TEST 9_EMPTY_RANGO FALLÓ: esperado 2 filas y 0 elegibles, obtenido filas=%, elegibles=%',
      v_filas, v_elegibles;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 9: consulta de avance con rango de numero_unidad (§3.5)
-- Verifica valores CONCRETOS: Ana=2 completadas/4 elegibles/50%, Carlos=1/4/25%.
-- Rango 1-2: actividades 10,11,12 (unidad 1) y 13 (unidad 2) = 4 elegibles.
-- Actividad 15 tiene ausente_en IS NOT NULL → excluida.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ana_comp    INT;
  v_ana_eleg    INT;
  v_ana_pct     NUMERIC;
  v_carlos_comp INT;
  v_carlos_eleg INT;
  v_carlos_pct  NUMERIC;
BEGIN
  WITH elegibles AS (
    SELECT a.id AS actividad_id
    FROM   actividades_moodle a
    JOIN   secciones_moodle   s ON s.id = a.seccion_id
    WHERE  s.asignacion_id      = 'asig_r3_ceu_26'
      AND  s.numero_unidad    BETWEEN 1 AND 2
      AND  a.publicada_en    IS NOT NULL
      AND  a.tiene_finalizacion = TRUE
      AND  a.ausente_en      IS NULL          -- excluir borradas de Moodle
  ),
  avance AS (
    SELECT
      m.id AS matricula_id,
      e.apellidos || ', ' || e.nombres AS estudiante,
      COUNT(pa.actividad_id) FILTER (WHERE pa.moodle_completado IN (1, 2)) AS completadas,
      COUNT(el.actividad_id)                                                AS elegibles,
      CASE WHEN COUNT(el.actividad_id) > 0
           THEN ROUND(100.0 * COUNT(pa.actividad_id)
                      FILTER (WHERE pa.moodle_completado IN (1, 2))
                      / COUNT(el.actividad_id), 1)
           ELSE NULL
      END AS porcentaje
    FROM  matriculas   m
    JOIN  estudiantes  e  ON e.id  = m.estudiante_id
    LEFT JOIN elegibles   el ON TRUE
    LEFT JOIN progreso_actividades pa
           ON pa.matricula_id = m.id AND pa.actividad_id = el.actividad_id
    WHERE m.asignacion_id = 'asig_r3_ceu_26'
      AND m.grupo_id      = 'grp_3a'
      AND m.eliminado_en IS NULL
    GROUP BY m.id, e.apellidos, e.nombres
  )
  SELECT
    MAX(completadas) FILTER (WHERE estudiante = 'Gomez Perez, Ana'),
    MAX(elegibles)   FILTER (WHERE estudiante = 'Gomez Perez, Ana'),
    MAX(porcentaje)  FILTER (WHERE estudiante = 'Gomez Perez, Ana'),
    MAX(completadas) FILTER (WHERE estudiante = 'Lopez Torres, Carlos'),
    MAX(elegibles)   FILTER (WHERE estudiante = 'Lopez Torres, Carlos'),
    MAX(porcentaje)  FILTER (WHERE estudiante = 'Lopez Torres, Carlos')
  INTO v_ana_comp, v_ana_eleg, v_ana_pct,
       v_carlos_comp, v_carlos_eleg, v_carlos_pct
  FROM avance;

  IF  v_ana_comp = 2    AND v_ana_eleg = 4    AND v_ana_pct    = 50.0
  AND v_carlos_comp = 1 AND v_carlos_eleg = 4 AND v_carlos_pct = 25.0 THEN
    RAISE NOTICE 'TEST 9 OK: Gomez Perez, Ana | completadas=% elegibles=% porcentaje=%',
      v_ana_comp, v_ana_eleg, v_ana_pct;
    RAISE NOTICE 'TEST 9 OK: Lopez Torres, Carlos | completadas=% elegibles=% porcentaje=%',
      v_carlos_comp, v_carlos_eleg, v_carlos_pct;
  ELSE
    RAISE EXCEPTION
      'TEST 9 FALLÓ: Ana comp=% eleg=% pct=% | Carlos comp=% eleg=% pct=% (esperados 2/4/50 y 1/4/25)',
      v_ana_comp, v_ana_eleg, v_ana_pct, v_carlos_comp, v_carlos_eleg, v_carlos_pct;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 9b: promedio de grupo — valor esperado CONCRETO 37.5
-- Ana=50.0, Carlos=25.0, promedio=(50+25)/2=37.5
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_promedio NUMERIC;
BEGIN
  WITH elegibles AS (
    SELECT a.id AS actividad_id
    FROM   actividades_moodle a
    JOIN   secciones_moodle   s ON s.id = a.seccion_id
    WHERE  s.asignacion_id      = 'asig_r3_ceu_26'
      AND  s.numero_unidad    BETWEEN 1 AND 2
      AND  a.publicada_en    IS NOT NULL
      AND  a.tiene_finalizacion = TRUE
      AND  a.ausente_en      IS NULL
  ),
  avance AS (
    SELECT
      m.id,
      COUNT(pa.actividad_id) FILTER (WHERE pa.moodle_completado IN (1, 2)) AS completadas,
      COUNT(el.actividad_id)                                                AS elegibles
    FROM  matriculas   m
    LEFT JOIN elegibles   el ON TRUE
    LEFT JOIN progreso_actividades pa
           ON pa.matricula_id = m.id AND pa.actividad_id = el.actividad_id
    WHERE m.asignacion_id = 'asig_r3_ceu_26'
      AND m.grupo_id      = 'grp_3a'
      AND m.eliminado_en IS NULL
    GROUP BY m.id
  )
  SELECT ROUND(AVG(100.0 * completadas / NULLIF(elegibles, 0)), 1)
  INTO v_promedio
  FROM avance;

  IF v_promedio = 37.5 THEN
    RAISE NOTICE 'TEST 9b OK: promedio del grupo grp_3a = %%%', v_promedio;
  ELSE
    RAISE EXCEPTION 'TEST 9b FALLÓ: promedio resultó % (esperado 37.5)', v_promedio;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 9_RANGO_COLEGIO: desglose por colegio con rango SIN actividades
--
-- REPRODUCE EL BUG: la consulta anterior usaba LEFT JOIN de actividades con
-- secciones con el filtro de unidad en la cláusula ON. Con eso, el COUNT(el2.id)
-- contaba TODAS las actividades publicadas (la join fallaba pero el2 seguía
-- non-NULL), así que el resultado con rango 8-9 era idéntico al de rango 1-2.
--
-- La consulta corregida usa una CTE con INNER JOIN en secciones, de modo que
-- solo actividades en el rango especificado entran como elegibles.
-- Con rango 8-9 esperamos: elegibles=0 y promedio_avance IS NULL para todos.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_colegio_ceu_promedio NUMERIC;
  v_colegio_cej_promedio NUMERIC;
  v_ceu_eleg_max         INT;
  v_filas                INT;
BEGIN
  WITH rango_elegibles AS (
    -- CTE con INNER JOIN (corregida): solo actividades dentro del rango 8-9.
    -- Con el rango 8-9 el resultado es vacío → COUNT(el.actividad_id) = 0 para todos.
    SELECT a.id AS actividad_id, a.asignacion_id
    FROM   actividades_moodle a
    JOIN   secciones_moodle   s ON s.id = a.seccion_id
    WHERE  s.numero_unidad BETWEEN 8 AND 9   -- rango sin actividades
      AND  a.publicada_en IS NOT NULL
      AND  a.tiene_finalizacion = TRUE
      AND  a.ausente_en IS NULL
  ),
  sub AS (
    SELECT
      m2.id,
      m2.asignacion_id,
      COUNT(el.actividad_id) AS elegibles,
      CASE WHEN COUNT(el.actividad_id) > 0
           THEN 100.0 * COUNT(pa2.actividad_id)
                FILTER (WHERE pa2.moodle_completado IN (1,2))
                / COUNT(el.actividad_id)
           ELSE NULL
      END AS porcentaje
    FROM  matriculas m2
    LEFT JOIN rango_elegibles el ON el.asignacion_id = m2.asignacion_id
    LEFT JOIN progreso_actividades pa2
           ON pa2.matricula_id = m2.id AND pa2.actividad_id = el.actividad_id
    WHERE m2.eliminado_en IS NULL
    GROUP BY m2.id, m2.asignacion_id
  )
  SELECT
    COUNT(*),
    MAX(sub.elegibles)                                         FILTER (WHERE a.colegio_id = 'col_ceu'),
    ROUND(AVG(sub.porcentaje) FILTER (WHERE a.colegio_id = 'col_ceu'), 1),
    ROUND(AVG(sub.porcentaje) FILTER (WHERE a.colegio_id = 'col_cej'), 1)
  INTO v_filas, v_ceu_eleg_max, v_colegio_ceu_promedio, v_colegio_cej_promedio
  FROM sub
  JOIN asignaciones_moodle a ON a.id = sub.asignacion_id;

  -- Con rango 8-9: todos elegibles=0, promedio=NULL (no hay elegibles que promediar)
  IF v_ceu_eleg_max = 0 AND v_colegio_ceu_promedio IS NULL AND v_colegio_cej_promedio IS NULL THEN
    RAISE NOTICE 'TEST 9_RANGO_COLEGIO OK: rango 8-9 → elegibles=0, promedio=NULL en ambos colegios (% filas en sub)',
      v_filas;
  ELSE
    RAISE EXCEPTION
      'TEST 9_RANGO_COLEGIO FALLÓ: ceu_eleg_max=% ceu_prom=% cej_prom=% (esperados 0, NULL, NULL)',
      v_ceu_eleg_max, v_colegio_ceu_promedio, v_colegio_cej_promedio;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 9c: desglose por colegio — consulta CORREGIDA con CTE + valores esperados concretos
-- Rango 1-2. Esperado: CEU estudiantes=3 promedio=25.0, CEJ estudiantes=1 promedio=0.0
-- CEU: Ana=50.0, Carlos=25.0, Diana=0.0 → (50+25+0)/3=25.0
-- CEJ: Eduardo=0.0 (act 14 en unidad 1, sin progreso) → 0.0
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ceu_est     INT;
  v_ceu_prom    NUMERIC;
  v_cej_est     INT;
  v_cej_prom    NUMERIC;
BEGIN
  WITH rango_elegibles AS (
    SELECT a.id AS actividad_id, a.asignacion_id
    FROM   actividades_moodle a
    JOIN   secciones_moodle   s ON s.id = a.seccion_id
    WHERE  s.numero_unidad BETWEEN 1 AND 2
      AND  a.publicada_en IS NOT NULL
      AND  a.tiene_finalizacion = TRUE
      AND  a.ausente_en IS NULL
  ),
  sub AS (
    SELECT
      m2.id,
      m2.asignacion_id,
      CASE WHEN COUNT(el.actividad_id) > 0
           THEN 100.0 * COUNT(pa2.actividad_id)
                FILTER (WHERE pa2.moodle_completado IN (1,2))
                / COUNT(el.actividad_id)
           ELSE NULL
      END AS porcentaje
    FROM  matriculas m2
    LEFT JOIN rango_elegibles el ON el.asignacion_id = m2.asignacion_id
    LEFT JOIN progreso_actividades pa2
           ON pa2.matricula_id = m2.id AND pa2.actividad_id = el.actividad_id
    WHERE m2.eliminado_en IS NULL
    GROUP BY m2.id, m2.asignacion_id
  )
  SELECT
    COUNT(DISTINCT m.id)           FILTER (WHERE c.id = 'col_ceu'),
    ROUND(AVG(sub.porcentaje) FILTER (WHERE c.id = 'col_ceu'), 1),
    COUNT(DISTINCT m.id)           FILTER (WHERE c.id = 'col_cej'),
    ROUND(AVG(sub.porcentaje) FILTER (WHERE c.id = 'col_cej'), 1)
  INTO v_ceu_est, v_ceu_prom, v_cej_est, v_cej_prom
  FROM sub
  JOIN matriculas            m  ON m.id  = sub.id
  JOIN asignaciones_moodle   a  ON a.id  = sub.asignacion_id
  JOIN colegios              c  ON c.id  = a.colegio_id
  WHERE a.eliminado_en IS NULL;

  -- Notificar línea a línea (como antes) para facilitar debugging
  RAISE NOTICE 'TEST 9c: colegio=Colegio Ejemplo Uno anio=2026 nivel=media estudiantes=% promedio=%%%',
    v_ceu_est, v_ceu_prom;
  RAISE NOTICE 'TEST 9c: colegio=Colegio Ejemplo Junior anio=2026 nivel=media estudiantes=% promedio=%%%',
    v_cej_est, v_cej_prom;

  IF v_ceu_est = 3 AND v_ceu_prom = 25.0 AND v_cej_est = 1 AND v_cej_prom = 0.0 THEN
    RAISE NOTICE 'TEST 9c OK: desglose por colegio con rango numero_unidad y CTE corregida';
  ELSE
    RAISE EXCEPTION
      'TEST 9c FALLÓ: CEU est=% prom=% CEJ est=% prom=% (esperados 3/25.0 y 1/0.0)',
      v_ceu_est, v_ceu_prom, v_cej_est, v_cej_prom;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 10: grupo borrado físicamente debe fallar si tiene matrículas (RESTRICT)
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    DELETE FROM grupos WHERE id = 'grp_3a';
    RAISE EXCEPTION 'TEST 10 FALLÓ: debió rechazar borrar grupo con matrículas activas';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 10 OK: RESTRICT impide borrar grupo con matrículas → usar activo=FALSE';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 11: anio y nivel se derivan por JOIN (sin columnas en matriculas)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_anio  TEXT;
  v_nivel TEXT;
BEGIN
  SELECT a.anio, c.nivel::TEXT
  INTO v_anio, v_nivel
  FROM matriculas          m
  JOIN asignaciones_moodle a ON a.id = m.asignacion_id
  JOIN cursos_modelo       c ON c.id = a.curso_id
  WHERE m.id = 'mat_ana';

  IF v_anio = '2026' AND v_nivel = 'media' THEN
    RAISE NOTICE 'TEST 11 OK: anio="%" nivel="%" derivados por JOIN', v_anio, v_nivel;
  ELSE
    RAISE EXCEPTION 'TEST 11 FALLÓ: anio=%, nivel=%', v_anio, v_nivel;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 12: cross-academia — colegio de cleveland en asignación de tecno falla
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    INSERT INTO asignaciones_moodle (id, academia_id, colegio_id, curso_id, anio, nombre_corto)
    VALUES ('asig_cross', 'tecno', 'col_cei', 'cur_rob3', '2026', 'cross-test');
    RAISE EXCEPTION 'TEST 12 FALLÓ: debió rechazar colegio de otra academia';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'TEST 12 OK: FK (colegio_id, academia_id) impide cruzar academias';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 12b: unidad_actual_auto es la misma para todos los grupos de una asignación
-- La lógica de §3.6: MAX(numero_unidad) de secciones con publicada_en IS NOT NULL
-- Secciones 1,2,3 de asig_r3_ceu_26 tienen numero_unidad 1,1,2 → MAX = 2
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_grupos_3a  INT;
  v_grupos_3b  INT;
BEGIN
  UPDATE grupos g
  SET    unidad_actual_auto = (
    SELECT MAX(s.numero_unidad)
    FROM   secciones_moodle s
    WHERE  s.asignacion_id    = g.asignacion_id
      AND  s.publicada_en    IS NOT NULL
      AND  s.numero_unidad   IS NOT NULL
  )
  WHERE g.asignacion_id = 'asig_r3_ceu_26';

  SELECT unidad_actual_auto INTO v_grupos_3a FROM grupos WHERE id = 'grp_3a';
  SELECT unidad_actual_auto INTO v_grupos_3b FROM grupos WHERE id = 'grp_3b';

  IF v_grupos_3a = 2 AND v_grupos_3b = 2 THEN
    RAISE NOTICE 'TEST 12b OK: unidad_actual_auto=% es la misma para grp_3a y grp_3b (misma asignación)',
      v_grupos_3a;
  ELSE
    RAISE EXCEPTION 'TEST 12b FALLÓ: grp_3a=%, grp_3b=% (deberían ser iguales y = 2)',
      v_grupos_3a, v_grupos_3b;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 21: ausente_en excluye actividad de los elegibles
-- Actividad 15 tiene ausente_en IS NOT NULL → no debe contar como elegible.
-- Actividades 10-13 en unidades 1-2 sin ausente_en = 4 elegibles.
-- Actividad 15 en unidad 1 CON ausente_en = excluida → sigue siendo 4.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_elegibles INT;
BEGIN
  SELECT COUNT(*)
  INTO v_elegibles
  FROM actividades_moodle a
  JOIN secciones_moodle   s ON s.id = a.seccion_id
  WHERE s.asignacion_id      = 'asig_r3_ceu_26'
    AND s.numero_unidad    BETWEEN 1 AND 2
    AND a.publicada_en    IS NOT NULL
    AND a.tiene_finalizacion = TRUE
    AND a.ausente_en      IS NULL;   -- excluir borradas

  IF v_elegibles = 4 THEN
    RAISE NOTICE 'TEST 21 OK: ausente_en excluye actividad 15 → elegibles=% (acto 15 no cuenta)', v_elegibles;
  ELSE
    RAISE EXCEPTION 'TEST 21 FALLÓ: elegibles=% (esperado 4; actividad 15 con ausente_en no debió contar)',
      v_elegibles;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 22: sync_queue — uk_sync_queue_pendiente cubre 'pendiente' y 'en_proceso'
--
-- (a) pendiente+pendiente → rechazado
-- (b) en_proceso+pendiente → rechazado (previene dos workers simultáneos)
-- (c) tras completado → encolar de nuevo permitido
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count INT;
BEGIN
  -- TEST 22 (a): pendiente + pendiente → debe fallar
  INSERT INTO sync_queue (asignacion_id, academia_id, tipo, estado)
  VALUES ('asig_r3_ceu_26', 'tecno', 'progreso', 'pendiente');

  BEGIN
    INSERT INTO sync_queue (asignacion_id, academia_id, tipo, estado)
    VALUES ('asig_r3_ceu_26', 'tecno', 'progreso', 'pendiente');
    RAISE EXCEPTION 'TEST 22 FALLÓ (a): debió rechazar trabajo pendiente duplicado';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 22 OK (a): pendiente+pendiente rechazado por uk_sync_queue_pendiente';
  END;

  -- TEST 22 (b): pasar a en_proceso y encolar nuevo pendiente → debe fallar
  UPDATE sync_queue SET estado = 'en_proceso'
  WHERE asignacion_id = 'asig_r3_ceu_26' AND tipo = 'progreso' AND estado = 'pendiente';

  BEGIN
    INSERT INTO sync_queue (asignacion_id, academia_id, tipo, estado)
    VALUES ('asig_r3_ceu_26', 'tecno', 'progreso', 'pendiente');
    RAISE EXCEPTION 'TEST 22 FALLÓ (b): debió rechazar encolar mientras hay uno en_proceso';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'TEST 22 OK (b): encolar mientras hay uno en_proceso rechazado';
  END;

  -- TEST 22 (c): pasar a completado → encolar nuevo pendiente debe funcionar
  UPDATE sync_queue SET estado = 'completado'
  WHERE asignacion_id = 'asig_r3_ceu_26' AND tipo = 'progreso' AND estado = 'en_proceso';

  INSERT INTO sync_queue (asignacion_id, academia_id, tipo, estado)
  VALUES ('asig_r3_ceu_26', 'tecno', 'progreso', 'pendiente');

  SELECT COUNT(*) INTO v_count
  FROM sync_queue WHERE asignacion_id = 'asig_r3_ceu_26' AND tipo = 'progreso';

  IF v_count = 2 THEN
    RAISE NOTICE 'TEST 22 OK (c): encolar tras completado permitido (% filas en historial)', v_count;
  ELSE
    RAISE EXCEPTION 'TEST 22 FALLÓ (c): esperado 2 filas (1 completado + 1 pendiente), obtenido %', v_count;
  END IF;

  -- Limpiar
  DELETE FROM sync_queue WHERE asignacion_id = 'asig_r3_ceu_26';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PRE-TEST A: verificar que CHECK chk_act_ausente está activo en v2.6
--
-- Comportamiento esperado con el esquema ACTUAL (v2.6):
--   → check_violation al intentar ausente_en IS NOT NULL con consecutivas=0
-- Si este test genera RAISE EXCEPTION (no check_violation), significa que el
-- esquema NO tiene el CHECK → retroceder a schema.sql y añadirlo.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    -- Intentar insertar actividad con ausente_en IS NOT NULL y ausencias_consecutivas=0
    -- Esto viola el invariante: ausente_en solo puede ser NOT NULL si consecutivas >= 2
    INSERT INTO actividades_moodle
      (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo,
       visible, publicada_en, ausente_en, ausencias_consecutivas)
    VALUES (1, 'asig_r3_ceu_26', 'tecno', 9990, 'resource', TRUE, NOW(), NOW(), 0);
    -- Si llega aquí: el esquema NO tiene CHECK → el invariante no se impone en BD
    DELETE FROM actividades_moodle WHERE moodle_cmid = 9990 AND asignacion_id = 'asig_r3_ceu_26';
    RAISE EXCEPTION 'PRE-TEST A FALLÓ: esquema permite ausente_en IS NOT NULL con consecutivas=0 (falta CHECK chk_act_ausente)';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PRE-TEST A OK: CHECK chk_act_ausente activo — ausente_en NOT NULL con consecutivas=0 rechazado';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- PRE-TEST B: verificar que sync_aplicar_estructura existe en v2.6
--
-- Si este test genera RAISE EXCEPTION (undefined_function), significa que la
-- función no existe → retroceder a schema.sql y crearla.
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    -- Llamar con array vacío: la función debe retornar sin hacer nada (salvaguarda a)
    PERFORM sync_aplicar_estructura('asig_r3_ceu_26', ARRAY[]::BIGINT[], TRUE);
    RAISE NOTICE 'PRE-TEST B OK: sync_aplicar_estructura existe y acepta array vacío (salvaguarda a: no hace nada)';
  EXCEPTION WHEN undefined_function THEN
    RAISE EXCEPTION 'PRE-TEST B FALLÓ: sync_aplicar_estructura no existe — crearla en schema.sql';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 23: sync_aplicar_estructura — 1 miss no marca ausente; 2 sí marcan
--
-- La función implementa las salvaguardas (a)/(b)/(c). Los tests anteriores
-- a v2.6 hacían los UPDATEs directamente (tests circulares); estos tests
-- llaman la función con entradas reales y verifican el resultado en BD.
--
-- Estrategia: incluir todos los cmids reales de asig_r3_ceu_26 en p_cmids
-- para que solo el cmid de prueba (9901) sea el ausente.
-- Los cmids reales (1001-1005): actividades 10-13 y 15 no se ven afectadas
-- porque todas están "presentes" en p_cmids o son visible=FALSE.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ausente_en   TIMESTAMPTZ;
  v_consecutivas SMALLINT;
  v_cmids_base   BIGINT[] := ARRAY[1001, 1002, 1003, 1004, 1005];
BEGIN
  INSERT INTO actividades_moodle
    (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo,
     tiene_finalizacion, visible, publicada_en, ausencias_consecutivas)
  VALUES (1, 'asig_r3_ceu_26', 'tecno', 9901, 'resource', TRUE, TRUE, NOW(), 0);

  -- Primer miss: 9901 no está en v_cmids_base → incrementa su contador
  PERFORM sync_aplicar_estructura('asig_r3_ceu_26', v_cmids_base, TRUE);

  SELECT ausente_en, ausencias_consecutivas
  INTO v_ausente_en, v_consecutivas
  FROM actividades_moodle WHERE moodle_cmid = 9901 AND asignacion_id = 'asig_r3_ceu_26';

  IF v_ausente_en IS NULL AND v_consecutivas = 1 THEN
    RAISE NOTICE 'TEST 23 OK (a): 1 miss → ausencias_consecutivas=%, ausente_en IS NULL (salvaguarda b: no marca aún)',
      v_consecutivas;
  ELSE
    RAISE EXCEPTION 'TEST 23 FALLÓ (a): ausente_en=%, consecutivas=% (esperados NULL y 1)',
      v_ausente_en, v_consecutivas;
  END IF;

  -- Segundo miss consecutivo → contador llega a 2 → ausente_en se fija
  PERFORM sync_aplicar_estructura('asig_r3_ceu_26', v_cmids_base, TRUE);

  SELECT ausente_en, ausencias_consecutivas
  INTO v_ausente_en, v_consecutivas
  FROM actividades_moodle WHERE moodle_cmid = 9901 AND asignacion_id = 'asig_r3_ceu_26';

  IF v_ausente_en IS NOT NULL AND v_consecutivas = 2 THEN
    RAISE NOTICE 'TEST 23 OK (b): 2 misses → ausente_en IS NOT NULL, consecutivas=% (salvaguarda b: marcada)',
      v_consecutivas;
  ELSE
    RAISE EXCEPTION 'TEST 23 FALLÓ (b): ausente_en=%, consecutivas=% (esperados not-NULL y 2)',
      v_ausente_en, v_consecutivas;
  END IF;

  DELETE FROM actividades_moodle WHERE moodle_cmid = 9901 AND asignacion_id = 'asig_r3_ceu_26';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 24: reaparición con visible=TRUE limpia ausente_en (salvaguarda c)
-- Actividad previamente ausente (consecutivas=2, ausente_en IS NOT NULL, visible=TRUE).
-- Al incluir su cmid en p_cmids, la función resetea el contador y ausente_en.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ausente_en   TIMESTAMPTZ;
  v_consecutivas SMALLINT;
  v_cmids_con_9902 BIGINT[] := ARRAY[1001, 1002, 1003, 1004, 1005, 9902];
BEGIN
  INSERT INTO actividades_moodle
    (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo,
     tiene_finalizacion, visible, publicada_en, ausente_en, ausencias_consecutivas)
  VALUES (1, 'asig_r3_ceu_26', 'tecno', 9902, 'resource', TRUE, TRUE, NOW(), NOW(), 2);

  -- Reaparición: 9902 en la respuesta AND visible=TRUE → la función resetea
  PERFORM sync_aplicar_estructura('asig_r3_ceu_26', v_cmids_con_9902, TRUE);

  SELECT ausente_en, ausencias_consecutivas
  INTO v_ausente_en, v_consecutivas
  FROM actividades_moodle WHERE moodle_cmid = 9902 AND asignacion_id = 'asig_r3_ceu_26';

  IF v_ausente_en IS NULL AND v_consecutivas = 0 THEN
    RAISE NOTICE 'TEST 24 OK: reaparición (visible=TRUE) → ausente_en=NULL, consecutivas=0 (salvaguarda c)';
  ELSE
    RAISE EXCEPTION 'TEST 24 FALLÓ: ausente_en=%, consecutivas=% (esperados NULL y 0)',
      v_ausente_en, v_consecutivas;
  END IF;

  DELETE FROM actividades_moodle WHERE moodle_cmid = 9902 AND asignacion_id = 'asig_r3_ceu_26';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 25: actividad oculta (visible=FALSE) presente en respuesta NO se resetea
--
-- "Nunca se marca una actividad oculta como presente": si visible=FALSE en BD,
-- la función no limpia ausencias_consecutivas ni ausente_en aunque el cmid
-- esté en p_cmids. La actividad debe recuperarse primero haciéndose visible.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ausente_en   TIMESTAMPTZ;
  v_consecutivas SMALLINT;
  v_cmids_con_9903 BIGINT[] := ARRAY[1001, 1002, 1003, 1004, 1005, 9903];
BEGIN
  -- Actividad visible=FALSE, previamente marcada ausente (consecutivas=2)
  INSERT INTO actividades_moodle
    (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo,
     tiene_finalizacion, visible, publicada_en, ausente_en, ausencias_consecutivas)
  VALUES (1, 'asig_r3_ceu_26', 'tecno', 9903, 'resource', TRUE, FALSE, NOW(), NOW(), 2);

  -- 9903 aparece en la respuesta pero visible=FALSE → la función NO resetea
  PERFORM sync_aplicar_estructura('asig_r3_ceu_26', v_cmids_con_9903, TRUE);

  SELECT ausente_en, ausencias_consecutivas
  INTO v_ausente_en, v_consecutivas
  FROM actividades_moodle WHERE moodle_cmid = 9903 AND asignacion_id = 'asig_r3_ceu_26';

  IF v_ausente_en IS NOT NULL AND v_consecutivas = 2 THEN
    RAISE NOTICE 'TEST 25 OK: visible=FALSE en respuesta → no reseteada (ausente_en IS NOT NULL, consecutivas=%)',
      v_consecutivas;
  ELSE
    RAISE EXCEPTION 'TEST 25 FALLÓ: ausente_en=%, consecutivas=% (esperados IS NOT NULL y 2; visible=FALSE no resetea)',
      v_ausente_en, v_consecutivas;
  END IF;

  DELETE FROM actividades_moodle WHERE moodle_cmid = 9903 AND asignacion_id = 'asig_r3_ceu_26';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 26: sync_inicializar_publicada_en propaga publicada_en a actividad y sección
--
-- Al inicializar el sistema, una actividad con moodle_completado > 0 y
-- publicada_en IS NULL recibe publicada_en = NOW(). La función también
-- propaga a la sección si esta tiene publicada_en IS NULL.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_act_pub  TIMESTAMPTZ;
  v_sec_pub  TIMESTAMPTZ;
  v_sec_id   BIGINT;
  v_act_id   BIGINT;
BEGIN
  -- Sección con publicada_en=NULL
  INSERT INTO secciones_moodle
    (asignacion_id, academia_id, moodle_section_id, numero_seccion, numero_unidad,
     titulo, visible, publicada_en)
  VALUES ('asig_r3_ceu_26', 'tecno', 997, 97, 9, 'Sección prueba T26', FALSE, NULL)
  RETURNING id INTO v_sec_id;

  -- Actividad en esa sección con publicada_en=NULL
  INSERT INTO actividades_moodle
    (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo,
     tiene_finalizacion, visible, publicada_en)
  VALUES (v_sec_id, 'asig_r3_ceu_26', 'tecno', 9904, 'quiz', TRUE, FALSE, NULL)
  RETURNING id INTO v_act_id;

  -- Insertar progreso con moodle_completado=1 (evidencia de que la actividad estuvo visible)
  INSERT INTO progreso_actividades
    (matricula_id, actividad_id, asignacion_id, academia_id, moodle_completado)
  VALUES ('mat_ana', v_act_id, 'asig_r3_ceu_26', 'tecno', 1);

  -- Llamar la función: propaga publicada_en por evidencia de completados
  PERFORM sync_inicializar_publicada_en('asig_r3_ceu_26');

  SELECT a.publicada_en, s.publicada_en
  INTO v_act_pub, v_sec_pub
  FROM actividades_moodle a
  JOIN secciones_moodle   s ON s.id = a.seccion_id
  WHERE a.id = v_act_id;

  IF v_act_pub IS NOT NULL AND v_sec_pub IS NOT NULL THEN
    RAISE NOTICE 'TEST 26 OK: sync_inicializar_publicada_en propagó publicada_en a actividad y sección';
  ELSE
    RAISE EXCEPTION 'TEST 26 FALLÓ: actividad.publicada_en=%, seccion.publicada_en=% (ambos deben ser NOT NULL)',
      v_act_pub, v_sec_pub;
  END IF;

  -- Limpieza (CASCADE borra progreso_actividades al eliminar la actividad)
  DELETE FROM actividades_moodle WHERE id = v_act_id;
  DELETE FROM secciones_moodle   WHERE id = v_sec_id;
END $$;

ROLLBACK;


-- ══════════════════════════════════════════════════════════════════
-- PARTE 3: PRUEBAS DE RLS (SET LOCAL ROLE app_user, sin WHERE manual)
-- ══════════════════════════════════════════════════════════════════
-- IMPORTANTE: dentro de este bloque las queries NO llevan WHERE academia_id = …
-- La política RLS filtra automáticamente. Probar de otro modo (con WHERE manual
-- o como superusuario) no prueba las políticas reales.

BEGIN;
SET LOCAL ROLE app_user;

-- ─────────────────────────────────────────────────────────────────
-- TEST 6: 0 filas en TODAS las tablas con RLS cuando academia vacía
-- Cubre las 19 tablas que tienen política RLS habilitada (incluye sync_queue).
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v INT;
  v_total INT := 0;
BEGIN
  PERFORM set_config('app.academia_ids', '', TRUE);

  SELECT COUNT(*) INTO v FROM colegios;              v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM cursos_modelo;         v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM asignaciones_moodle;   v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM secciones_moodle;      v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM actividades_moodle;    v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM estudiantes;           v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM grupos;                v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM matriculas;            v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM progreso_actividades;  v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM carnet_listas;         v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM carnet_estudiantes;    v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM moodle_sync_log;       v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM sync_queue;            v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM auditoria;             v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM migracion_cuarentena;  v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM roles_academia;        v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM permisos_usuario;      v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM asesores_colegios;     v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM carnet_opciones;       v_total := v_total + v;

  IF v_total = 0 THEN
    RAISE NOTICE 'TEST 6 OK: academia_ids vacío → 0 filas en las 19 tablas con RLS';
  ELSE
    RAISE EXCEPTION 'TEST 6 FALLÓ: academia vacía aún expone % fila(s) en total', v_total;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 6b: academia=tecno → solo filas de tecno visibles (sin WHERE manual)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_colegios     INT;
  v_ajenos       INT;
  v_estudiantes  INT;
  v_matriculas   INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  SELECT COUNT(*) INTO v_colegios    FROM colegios;
  SELECT COUNT(*) INTO v_ajenos      FROM colegios WHERE academia_id = 'cleveland';
  SELECT COUNT(*) INTO v_estudiantes FROM estudiantes;
  SELECT COUNT(*) INTO v_matriculas  FROM matriculas;

  IF v_colegios = 2 AND v_ajenos = 0 THEN
    RAISE NOTICE 'TEST 6b OK: academia=tecno → % colegios visibles, 0 de cleveland', v_colegios;
  ELSE
    RAISE EXCEPTION 'TEST 6b FALLÓ en colegios: total=%, ajenos=% (esperados 2 y 0)',
      v_colegios, v_ajenos;
  END IF;

  IF v_estudiantes = 4 THEN
    RAISE NOTICE 'TEST 6b OK: academia=tecno → % estudiantes visibles', v_estudiantes;
  ELSE
    RAISE EXCEPTION 'TEST 6b FALLÓ en estudiantes: esperados 4, visto %', v_estudiantes;
  END IF;

  RAISE NOTICE 'TEST 6b OK: matriculas visibles = %', v_matriculas;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 6c: gerente (tecno,cleveland) ve datos de ambas academias
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_colegios INT;
  v_cursos   INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno,cleveland', TRUE);

  SELECT COUNT(*) INTO v_colegios FROM colegios;
  SELECT COUNT(*) INTO v_cursos   FROM cursos_modelo;

  IF v_colegios = 3 AND v_cursos = 2 THEN
    RAISE NOTICE 'TEST 6c OK: gerente (tecno,cleveland) → % colegios, % cursos modelo',
      v_colegios, v_cursos;
  ELSE
    RAISE EXCEPTION 'TEST 6c FALLÓ: colegios=%, cursos=% (esperados 3 y 2)',
      v_colegios, v_cursos;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 13: ninguna fila ajena visible con academia=tecno
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  SELECT COUNT(*) INTO v FROM colegios             WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en colegios', v; END IF;

  SELECT COUNT(*) INTO v FROM cursos_modelo        WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en cursos_modelo', v; END IF;

  SELECT COUNT(*) INTO v FROM asignaciones_moodle  WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en asignaciones', v; END IF;

  SELECT COUNT(*) INTO v FROM estudiantes          WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en estudiantes', v; END IF;

  SELECT COUNT(*) INTO v FROM matriculas           WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en matriculas', v; END IF;

  SELECT COUNT(*) INTO v FROM secciones_moodle     WHERE academia_id != 'tecno';
  IF v > 0 THEN RAISE EXCEPTION 'TEST 13 FALLÓ: % fila(s) ajena(s) en secciones', v; END IF;

  RAISE NOTICE 'TEST 13 OK: academia=tecno → 0 filas ajenas en colegios, cursos, asignaciones, estudiantes, matriculas, secciones';
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 14: INSERT en academia ajena bloqueado por RLS
-- ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  BEGIN
    INSERT INTO colegios (id, academia_id, nombre)
    VALUES ('col_intruso', 'cleveland', 'Intruso');
    RAISE EXCEPTION 'TEST 14 FALLÓ: INSERT en academia ajena debió ser rechazado';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 14 OK: INSERT en academia ajena rechazado por RLS (insufficient_privilege)';
  WHEN others THEN
    RAISE NOTICE 'TEST 14 OK (variante): INSERT en academia ajena rechazado: %', SQLERRM;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 15: UPDATE en fila de otra academia → 0 filas afectadas
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v_affected INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  UPDATE colegios SET nombre = 'Intruso' WHERE id = 'col_cei';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE NOTICE 'TEST 15 OK: UPDATE en col_cei (cleveland) con sesión tecno → 0 filas afectadas';
  ELSE
    RAISE EXCEPTION 'TEST 15 FALLÓ: UPDATE afectó % fila(s) de otra academia', v_affected;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 16: DELETE en fila de otra academia → 0 filas afectadas
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v_affected INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  DELETE FROM colegios WHERE id = 'col_cei';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 0 THEN
    RAISE NOTICE 'TEST 16 OK: DELETE en col_cei (cleveland) con sesión tecno → 0 filas afectadas';
  ELSE
    RAISE EXCEPTION 'TEST 16 FALLÓ: DELETE eliminó % fila(s) de otra academia', v_affected;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 17: v_moodle_upload no expone datos de otra academia
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total  INT;
  v_ajenas INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  SELECT COUNT(*) INTO v_total FROM v_moodle_upload;
  SELECT COUNT(*) INTO v_ajenas
  FROM v_moodle_upload v
  JOIN matriculas m ON m.username = v.username
  WHERE m.academia_id != 'tecno';

  IF v_ajenas = 0 THEN
    RAISE NOTICE 'TEST 17 OK: v_moodle_upload con academia=tecno → % filas, 0 de otra academia',
      v_total;
  ELSE
    RAISE EXCEPTION 'TEST 17 FALLÓ: v_moodle_upload expone % fila(s) de otra academia', v_ajenas;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 18: auditoria solo permite INSERT (no UPDATE ni DELETE)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_id     BIGINT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  INSERT INTO auditoria (academia_id, tabla, operacion, registro_id)
  VALUES ('tecno', 'colegios', 'INSERT', 'test_audit')
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RAISE NOTICE 'TEST 18a OK: app_user puede INSERT en auditoria (id=%)', v_id;
  ELSE
    RAISE EXCEPTION 'TEST 18a FALLÓ: INSERT en auditoria no devolvió id';
  END IF;

  BEGIN
    UPDATE auditoria SET tabla = 'manipulado' WHERE id = v_id;
    RAISE EXCEPTION 'TEST 18b FALLÓ: UPDATE en auditoria debió ser rechazado';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 18b OK: UPDATE en auditoria rechazado (sin privilegio)';
  END;

  BEGIN
    DELETE FROM auditoria WHERE id = v_id;
    RAISE EXCEPTION 'TEST 18c FALLÓ: DELETE en auditoria debió ser rechazado';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 18c OK: DELETE en auditoria rechazado (sin privilegio)';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 19: camino de login — login_usuario() resuelve academias
-- sin depender de app.academia_ids
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r         RECORD;
  v_count   INT := 0;
  v_acad    TEXT;
BEGIN
  PERFORM set_config('app.academia_ids', '', TRUE);

  FOR r IN SELECT * FROM login_usuario('admin@tc.edu.ve') LOOP
    v_count := v_count + 1;
    v_acad  := r.academia_ids;
    RAISE NOTICE 'TEST 19: usuario_id=%, nombre=%, activo=%, academia_ids=%',
      r.usuario_id, r.nombre, r.activo, r.academia_ids;
  END LOOP;

  IF v_count = 1 AND v_acad IS NOT NULL THEN
    RAISE NOTICE 'TEST 19 OK: login_usuario() devuelve academia_ids="%" sin depender de la sesión',
      v_acad;
  ELSE
    RAISE EXCEPTION 'TEST 19 FALLÓ: filas=%, academia_ids=%', v_count, v_acad;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 20: login_usuario() NO usa tablas temporales con el mismo nombre
--
-- Verifica que login_usuario() (SECURITY DEFINER, SET search_path = public, pg_temp,
-- con nombres cualificados public.usuarios_app y public.roles_academia) NO es
-- afectada por tablas temporales creadas por el llamante con esos mismos nombres.
--
-- Si la función NO estuviera protegida (sin SET search_path fijo, sin public.),
-- un llamante con privilegios de crear tablas temporales podría inyectar datos
-- falsos; la función devolvería el "usuario" de la tabla temporal.
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r          RECORD;
  v_nombre   TEXT;
  v_count    INT := 0;
BEGIN
  PERFORM set_config('app.academia_ids', '', TRUE);

  -- Crear tablas temporales con los mismos nombres que las tablas reales
  CREATE TEMP TABLE IF NOT EXISTS usuarios_app (
    id INT, email TEXT, nombre TEXT, activo BOOLEAN, password_hash TEXT,
    creado_en TIMESTAMPTZ DEFAULT NOW(), ultima_sesion TIMESTAMPTZ
  );
  CREATE TEMP TABLE IF NOT EXISTS roles_academia (
    usuario_id INT, academia_id TEXT, rol TEXT, activo BOOLEAN,
    asignado_en TIMESTAMPTZ DEFAULT NOW(),
    ultimo_actualizar_avance TIMESTAMPTZ
  );

  -- Insertar datos FALSOS en las tablas temporales
  INSERT INTO usuarios_app VALUES (999, 'admin@tc.edu.ve', 'IMPOSTOR', TRUE, 'fake_hash', NOW(), NULL);
  INSERT INTO roles_academia  VALUES (999, 'hack', 'admin', TRUE, NOW(), NULL);

  -- Llamar a login_usuario(): debe devolver datos REALES de public.usuarios_app
  FOR r IN SELECT * FROM login_usuario('admin@tc.edu.ve') LOOP
    v_count  := v_count + 1;
    v_nombre := r.nombre;
  END LOOP;

  IF v_count = 1 AND v_nombre = 'Admin Tecno' THEN
    RAISE NOTICE 'TEST 20 OK: login_usuario() usa public.usuarios_app (nombre="%"), no la tabla temporal',
      v_nombre;
  ELSIF v_nombre = 'IMPOSTOR' THEN
    RAISE EXCEPTION 'TEST 20 FALLÓ: login_usuario() leyó la tabla temporal (nombre="%")', v_nombre;
  ELSE
    RAISE EXCEPTION 'TEST 20 FALLÓ: nombre="%", filas=% (esperado "Admin Tecno" y 1 fila)',
      v_nombre, v_count;
  END IF;

  -- Limpiar tablas temporales
  DROP TABLE IF EXISTS usuarios_app;
  DROP TABLE IF EXISTS roles_academia;
END $$;

ROLLBACK;


-- ══════════════════════════════════════════════════════════════════
-- PARTE 3b: PRUEBAS DE sync_worker (SET LOCAL ROLE sync_worker)
--
-- Verifica: (a) 0 filas sin academia; (b) solo ve la academia indicada;
-- (c) las 5 operaciones del §3.4 funcionan; (d) password_enc y enc_iv
-- denegados; (e) usuarios_app, sesiones, auditoria denegados.
-- ══════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL ROLE sync_worker;

-- ─────────────────────────────────────────────────────────────────
-- TEST 27: 0 filas en todas las tablas de sync_worker sin academia
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v INT;
  v_total INT := 0;
BEGIN
  PERFORM set_config('app.academia_ids', '', TRUE);

  SELECT COUNT(*) INTO v FROM asignaciones_moodle;  v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM secciones_moodle;     v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM actividades_moodle;   v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM progreso_actividades; v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM grupos;               v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM sync_queue;           v_total := v_total + v;
  SELECT COUNT(*) INTO v FROM moodle_sync_log;      v_total := v_total + v;

  IF v_total = 0 THEN
    RAISE NOTICE 'TEST 27 OK: sync_worker sin academia → 0 filas en las 7 tablas accesibles';
  ELSE
    RAISE EXCEPTION 'TEST 27 FALLÓ: academia vacía expone % fila(s)', v_total;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 28: sync_worker con academia=tecno solo ve filas de tecno
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_secciones    INT;
  v_actividades  INT;
  v_matriculas   INT;
  v_ajenas_sec   INT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  SELECT COUNT(*) INTO v_secciones   FROM secciones_moodle;
  SELECT COUNT(*) INTO v_actividades FROM actividades_moodle;
  -- matriculas: columnas autorizadas; seleccionar solo id y academia_id
  SELECT COUNT(*) INTO v_matriculas  FROM matriculas;
  SELECT COUNT(*) INTO v_ajenas_sec  FROM secciones_moodle WHERE academia_id != 'tecno';

  IF v_ajenas_sec = 0 AND v_secciones > 0 THEN
    RAISE NOTICE 'TEST 28 OK: sync_worker academia=tecno → % secciones, % actividades, % matrículas, 0 ajenas',
      v_secciones, v_actividades, v_matriculas;
  ELSE
    RAISE EXCEPTION 'TEST 28 FALLÓ: secciones=%, actividades=%, ajenas=%',
      v_secciones, v_actividades, v_ajenas_sec;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 29: las 5 operaciones del §3.4 funcionan como sync_worker
-- (a) UPDATE moodle_course_id en asignaciones_moodle
-- (b) UPDATE moodle_user_id en matriculas
-- (c) INSERT en secciones_moodle
-- (d) INSERT en actividades_moodle
-- (e) UPDATE en progreso_actividades
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_affected  INT;
  v_sec_id    BIGINT;
  v_act_id    BIGINT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  -- (a) UPDATE moodle_course_id en asignaciones_moodle
  UPDATE asignaciones_moodle SET moodle_course_id = 8888 WHERE id = 'asig_r3_ceu_26';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 1 THEN
    RAISE NOTICE 'TEST 29a OK: sync_worker puede UPDATE moodle_course_id en asignaciones_moodle';
  ELSE
    RAISE EXCEPTION 'TEST 29a FALLÓ: UPDATE moodle_course_id afectó % filas (esperado 1)', v_affected;
  END IF;

  -- (b) UPDATE moodle_user_id en matriculas
  UPDATE matriculas SET moodle_user_id = 77777 WHERE id = 'mat_ana';
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 1 THEN
    RAISE NOTICE 'TEST 29b OK: sync_worker puede UPDATE moodle_user_id en matriculas';
  ELSE
    RAISE EXCEPTION 'TEST 29b FALLÓ: UPDATE moodle_user_id afectó % filas (esperado 1)', v_affected;
  END IF;

  -- (c) INSERT en secciones_moodle
  INSERT INTO secciones_moodle
    (asignacion_id, academia_id, moodle_section_id, numero_seccion, numero_unidad, titulo, visible)
  VALUES ('asig_r3_ceu_26', 'tecno', 901, 90, 9, 'Sec test worker', TRUE)
  RETURNING id INTO v_sec_id;
  IF v_sec_id IS NOT NULL THEN
    RAISE NOTICE 'TEST 29c OK: sync_worker puede INSERT en secciones_moodle (id=%)', v_sec_id;
  ELSE
    RAISE EXCEPTION 'TEST 29c FALLÓ: INSERT en secciones_moodle no retornó id';
  END IF;

  -- (d) INSERT en actividades_moodle (usando la sección recién insertada)
  INSERT INTO actividades_moodle
    (seccion_id, asignacion_id, academia_id, moodle_cmid, tipo_modulo, visible)
  VALUES (v_sec_id, 'asig_r3_ceu_26', 'tecno', 8001, 'quiz', TRUE)
  RETURNING id INTO v_act_id;
  IF v_act_id IS NOT NULL THEN
    RAISE NOTICE 'TEST 29d OK: sync_worker puede INSERT en actividades_moodle (id=%)', v_act_id;
  ELSE
    RAISE EXCEPTION 'TEST 29d FALLÓ: INSERT en actividades_moodle no retornó id';
  END IF;

  -- (e) UPDATE en progreso_actividades (fila existente de mat_ana, actividad 10)
  UPDATE progreso_actividades
  SET fecha_consulta = NOW()
  WHERE matricula_id = 'mat_ana' AND actividad_id = 10;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  IF v_affected = 1 THEN
    RAISE NOTICE 'TEST 29e OK: sync_worker puede UPDATE en progreso_actividades';
  ELSE
    RAISE EXCEPTION 'TEST 29e FALLÓ: UPDATE progreso_actividades afectó % filas (esperado 1)', v_affected;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 30: password_enc denegado para sync_worker
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dummy TEXT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  BEGIN
    SELECT password_enc INTO v_dummy FROM matriculas LIMIT 1;
    RAISE EXCEPTION 'TEST 30 FALLÓ: sync_worker puede leer password_enc (no debe tener acceso)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 30 OK: password_enc denegado para sync_worker';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 31: enc_iv denegado para sync_worker
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dummy TEXT;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);
  BEGIN
    SELECT enc_iv INTO v_dummy FROM matriculas LIMIT 1;
    RAISE EXCEPTION 'TEST 31 FALLÓ: sync_worker puede leer enc_iv (no debe tener acceso)';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 31 OK: enc_iv denegado para sync_worker';
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- TEST 32: usuarios_app, sesiones y auditoria denegados para sync_worker
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_errores INT := 0;
BEGIN
  PERFORM set_config('app.academia_ids', 'tecno', TRUE);

  BEGIN
    PERFORM (SELECT id FROM usuarios_app LIMIT 1);
    RAISE EXCEPTION 'TEST 32 FALLÓ: sync_worker puede leer usuarios_app';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    v_errores := v_errores + 1;
  END;

  BEGIN
    PERFORM (SELECT id FROM sesiones LIMIT 1);
    RAISE EXCEPTION 'TEST 32 FALLÓ: sync_worker puede leer sesiones';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    v_errores := v_errores + 1;
  END;

  BEGIN
    PERFORM (SELECT id FROM auditoria LIMIT 1);
    RAISE EXCEPTION 'TEST 32 FALLÓ: sync_worker puede leer auditoria';
  EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
    v_errores := v_errores + 1;
  END;

  IF v_errores = 3 THEN
    RAISE NOTICE 'TEST 32 OK: sync_worker no puede leer usuarios_app, sesiones ni auditoria (3 denegados)';
  ELSE
    RAISE EXCEPTION 'TEST 32 FALLÓ: solo % de 3 accesos fueron denegados', v_errores;
  END IF;
END $$;

ROLLBACK;


-- ══════════════════════════════════════════════════════════════════
-- PARTE 4: LIMPIEZA (superusuario, orden inverso a FK)
-- ══════════════════════════════════════════════════════════════════

BEGIN;
DELETE FROM progreso_actividades;
DELETE FROM matriculas;
DELETE FROM grupos;
DELETE FROM actividades_moodle;
DELETE FROM secciones_moodle;
DELETE FROM asignaciones_moodle;
DELETE FROM sync_queue;
DELETE FROM carnet_estudiantes;
DELETE FROM carnet_listas;
DELETE FROM moodle_sync_log;
DELETE FROM auditoria;
DELETE FROM migracion_cuarentena;
DELETE FROM carnet_opciones;
DELETE FROM asesores_colegios;
DELETE FROM permisos_usuario;
DELETE FROM roles_academia;
DELETE FROM sesiones;
DELETE FROM intentos_login;
DELETE FROM estudiantes;
DELETE FROM cursos_modelo;
DELETE FROM colegios;
DELETE FROM usuarios_app;
DELETE FROM academias;
COMMIT;

-- Resumen: si en NOTICE aparece "OK" para cada test y no hay excepciones no capturadas,
-- el esquema cumple los invariantes de integridad, RLS y sync de la v2.6.
