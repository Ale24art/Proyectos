/* ════════════════════════════════════════════════════════════
   sync-core.js · Lógica pura de sincronización (sin DOM, sin Firebase)
   La usan sync.js (navegador) y sync-firebase.js (adaptador), y también
   los scripts de prueba en database/scripts/ vía require(), para poder
   simular la sincronización entre dispositivos sin abrir un navegador.

   Nada aquí toca `window`, `document` ni `firebase.*`. Si algún día se
   reemplaza Firebase por una API REST propia, este archivo no cambia.
   ════════════════════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SyncCore = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  const CARNET_OPCIONES_DEFAULT = { layout: 'big', url: 'cursoscleveland.com', upper: true };

  /* ── Serialización determinista + hash liviano (no criptográfico) ──
     Solo necesitamos detectar "cambió / no cambió" para decidir qué subir. */
  function stableStringify(valor) {
    if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
    if (Array.isArray(valor)) return '[' + valor.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(valor).sort().map(k => JSON.stringify(k) + ':' + stableStringify(valor[k])).join(',') + '}';
  }

  function hashTexto(texto) {
    let h = 0x811c9dc5; // FNV-1a de 32 bits
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  function hashEntidad(datos) { return hashTexto(stableStringify(datos)); }

  function slugId(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  }

  // Clave determinista del documento que agrupa a los participantes de una
  // lista (colegio+curso+año+grupo). No es el `id` de ningún participante.
  function claveListaParticipantes(colegioId, cursoId, anio, grupo) {
    return [colegioId || '_', cursoId || '_', slugId(anio), slugId(grupo || '')].join('__');
  }

  const COLECCIONES_SIMPLES = [
    ['colegios', 'colegios'],
    ['cursos', 'cursos'],
    ['asignaciones', 'asignaciones'],
    ['carnetListas', 'carnetListas']
  ];
  const COLECCIONES_TRASH_SIMPLES = [
    ['colegios', 'trash_colegios'],
    ['cursos', 'trash_cursos'],
    ['asignaciones', 'trash_asignaciones'],
    ['carnetListas', 'trash_carnetListas'],
    ['estudiantes', 'trash_estudiantes']
  ];

  // Colección activa → colección de papelera correspondiente. Se usa para
  // distinguir "se movió a la papelera" de "se borró para siempre" cuando
  // un documento desaparece de su colección activa.
  const PARES_ACTIVO_TRASH = {
    colegios: 'trash_colegios',
    cursos: 'trash_cursos',
    asignaciones: 'trash_asignaciones',
    carnetListas: 'trash_carnetListas',
    listas_part: 'trash_listas_part'
  };

  /**
   * Convierte el objeto `data` de la app (ver §4.1 de la documentación) en una
   * lista plana de "entidades" sincronizables: { coleccion, docId, datos, orden, clave }.
   * No muta `data` ni los objetos que contiene.
   */
  function construirIndiceLocal(data) {
    const entidades = [];
    const push = (coleccion, docId, datos, orden, clave) =>
      entidades.push({ coleccion, docId, datos, orden, clave: clave || { id: docId } });

    COLECCIONES_SIMPLES.forEach(([campo, coleccion]) => {
      (data[campo] || []).forEach((item, i) => push(coleccion, item.id, item, i));
    });
    COLECCIONES_TRASH_SIMPLES.forEach(([campo, coleccion]) => {
      ((data.trash || {})[campo] || []).forEach((item, i) => push(coleccion, item.id, item, i));
    });

    push('carnetOpciones', 'main', data.carnetOpciones || {}, 0);

    // Participantes: se agrupan por lista (igual que al mostrarlos en "Años ya
    // generados") porque un documento por participante individual multiplicaría
    // las escrituras y lecturas sin necesidad.
    const grupos = new Map();
    (data.participantes || []).forEach(p => {
      const key = claveListaParticipantes(p.colegioId, p.cursoId, p.anio, p.group1);
      if (!grupos.has(key)) {
        grupos.set(key, { colegioId: p.colegioId, cursoId: p.cursoId, anio: p.anio, grupo: p.group1 || '', nivel: p.nivel, estudiantes: [] });
      }
      grupos.get(key).estudiantes.push(p);
    });
    let ordenLista = 0;
    grupos.forEach((payload, key) => {
      // _orden interno de cada estudiante: Firestore conserva el orden de un
      // array dentro de un mismo documento, pero lo fijamos explícito para no
      // depender de esa garantía si en el futuro se reparte en subdocumentos.
      const payloadOrdenado = Object.assign({}, payload, {
        estudiantes: payload.estudiantes.map((e, i) => Object.assign({}, e, { _orden: i }))
      });
      push('listas_part', key, payloadOrdenado, ordenLista++,
        { colegioId: payload.colegioId, cursoId: payload.cursoId, anio: payload.anio, grupo: payload.grupo });
    });

    (((data.trash || {}).participantes) || []).forEach((item, i) => {
      push('trash_listas_part', item.id, item, i,
        { colegioId: item.colegioId, cursoId: item.cursoId, anio: item.anio, grupo: item.grupo || '' });
    });

    return entidades;
  }

  function construirBaseline(entidades) {
    const baseline = {};
    entidades.forEach(e => {
      baseline[e.coleccion] = baseline[e.coleccion] || {};
      baseline[e.coleccion][e.docId] = { hash: hashEntidad(e.datos), orden: e.orden, clave: e.clave };
    });
    return baseline;
  }

  /**
   * Compara el índice local actual contra la última línea base sincronizada.
   * Devuelve qué hay que subir (`cambios`) y qué desapareció (`eliminados`,
   * sin decidir todavía si es un traslado a papelera o un borrado real).
   */
  function calcularDiff(entidadesActuales, baselineAnterior) {
    const base = baselineAnterior || {};
    const cambios = [];
    const vistos = {};
    entidadesActuales.forEach(e => {
      vistos[e.coleccion] = vistos[e.coleccion] || new Set();
      vistos[e.coleccion].add(e.docId);
      const prev = (base[e.coleccion] || {})[e.docId];
      if (!prev || prev.hash !== hashEntidad(e.datos) || prev.orden !== e.orden) cambios.push(e);
    });
    const eliminados = [];
    Object.keys(base).forEach(coleccion => {
      Object.keys(base[coleccion]).forEach(docId => {
        if (!vistos[coleccion] || !vistos[coleccion].has(docId)) {
          eliminados.push({ coleccion, docId, clave: base[coleccion][docId].clave });
        }
      });
    });
    return { cambios, eliminados };
  }

  /**
   * De los documentos que desaparecieron de una colección, decide cuáles son
   * borrados PERMANENTES reales (necesitan un tombstone para que otros
   * dispositivos los distingan de "nunca existió") frente a simples
   * traslados activo→papelera (el dato sigue vivo, solo cambió de colección).
   */
  function calcularTombstonesNuevos(eliminados, entidadesActuales) {
    const porColeccion = {};
    entidadesActuales.forEach(e => {
      porColeccion[e.coleccion] = porColeccion[e.coleccion] || [];
      porColeccion[e.coleccion].push(e);
    });
    const tombstones = [];
    eliminados.forEach(el => {
      const trashColeccion = PARES_ACTIVO_TRASH[el.coleccion];
      if (trashColeccion) {
        const candidatos = porColeccion[trashColeccion] || [];
        const esTraslado = el.coleccion === 'listas_part'
          ? candidatos.some(c => c.clave.colegioId === el.clave.colegioId && c.clave.cursoId === el.clave.cursoId
              && c.clave.anio === el.clave.anio && (c.clave.grupo || '') === (el.clave.grupo || ''))
          : candidatos.some(c => c.docId === el.docId);
        if (esTraslado) return;
      }
      tombstones.push({ coleccion: el.coleccion, docId: el.docId });
    });
    return tombstones;
  }

  /**
   * Fusiona el índice local con lo descargado de la nube, sin perder datos
   * en silencio:
   * - Si una entidad remota no cambió desde la línea base pero la local sí → gana la local.
   * - Si ambas cambiaron desde la línea base (editadas en dos dispositivos) → gana la remota
   *   (ya fue confirmada por otro dispositivo) y se reporta en `sobrescritos`.
   * - Si una entidad solo existe local y nadie la borró remotamente (no hay tombstone) → se conserva.
   * - Si solo existe local pero hay un tombstone remoto para ella → se elimina (borrado real en otro dispositivo).
   */
  function fusionarEntidades(entidadesLocales, baselineLocal, entidadesRemotas, tombstonesRemotos) {
    const base = baselineLocal || {};
    const hashBase = (col, id) => ((base[col] || {})[id] || {}).hash || null;

    const localPorClave = new Map(entidadesLocales.map(e => [e.coleccion + '/' + e.docId, e]));
    const remotoPorClave = new Map(entidadesRemotas.map(e => [e.coleccion + '/' + e.docId, e]));
    const tumbas = tombstonesRemotos || new Set();

    const sobrescritos = [];
    const resultado = new Map();

    remotoPorClave.forEach((remoto, clave) => {
      const local = localPorClave.get(clave);
      const hBase = hashBase(remoto.coleccion, remoto.docId);
      const remotoCambio = hBase !== hashEntidad(remoto.datos);
      if (!local) { resultado.set(clave, remoto); return; }
      const localCambio = hBase !== hashEntidad(local.datos);
      if (localCambio && remotoCambio) {
        resultado.set(clave, remoto);
        sobrescritos.push({ coleccion: remoto.coleccion, docId: remoto.docId });
      } else if (localCambio && !remotoCambio) {
        resultado.set(clave, local);
      } else {
        resultado.set(clave, remoto);
      }
    });

    localPorClave.forEach((local, clave) => {
      if (resultado.has(clave)) return;
      if (tumbas.has(clave)) return; // borrado real confirmado en otro dispositivo
      resultado.set(clave, local);
    });

    // Limpieza de traslados: si un dispositivo movió algo de su colección activa a
    // la papelera y el otro todavía tenía la copia activa sin cambios, el paso anterior
    // puede dejar la entidad duplicada (activa + papelera). La copia en papelera es la
    // que gana siempre: significa que *alguien* ya completó el traslado.
    Object.keys(PARES_ACTIVO_TRASH).forEach(activa => {
      const papelera = PARES_ACTIVO_TRASH[activa];
      if (activa === 'listas_part') {
        const trasladadas = [...resultado.values()].filter(e => e.coleccion === papelera);
        [...resultado.entries()].forEach(([clave, e]) => {
          if (e.coleccion !== activa) return;
          const hayTraslado = trasladadas.some(t => t.clave.colegioId === e.clave.colegioId && t.clave.cursoId === e.clave.cursoId
            && t.clave.anio === e.clave.anio && (t.clave.grupo || '') === (e.clave.grupo || ''));
          if (hayTraslado) resultado.delete(clave);
        });
      } else {
        [...resultado.keys()].forEach(clave => {
          if (!clave.startsWith(activa + '/')) return;
          const docId = clave.slice(activa.length + 1);
          if (resultado.has(papelera + '/' + docId)) resultado.delete(clave);
        });
      }
    });

    return { entidades: [...resultado.values()], sobrescritos };
  }

  function agruparPorColeccion(entidades) {
    const out = {};
    entidades.forEach(e => { (out[e.coleccion] = out[e.coleccion] || []).push(e); });
    return out;
  }

  /** Reconstruye el objeto `data` (forma de §4.1) a partir de una lista de entidades. */
  function entidadesADatos(entidades) {
    const porColeccion = agruparPorColeccion(entidades);
    const ordenar = (col) => (porColeccion[col] || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(e => e.datos);

    const carnetOpcionesEnt = (porColeccion.carnetOpciones || [])[0];
    const carnetOpciones = Object.assign({}, CARNET_OPCIONES_DEFAULT, carnetOpcionesEnt ? carnetOpcionesEnt.datos : {});

    const participantes = [];
    ordenar('listas_part').forEach(lista => {
      const estudiantes = [...(lista.estudiantes || [])].sort((a, b) => (a._orden || 0) - (b._orden || 0));
      estudiantes.forEach(e => {
        const copia = Object.assign({}, e);
        delete copia._orden;
        participantes.push(copia);
      });
    });

    return {
      colegios: ordenar('colegios'),
      cursos: ordenar('cursos'),
      asignaciones: ordenar('asignaciones'),
      participantes,
      carnetListas: ordenar('carnetListas'),
      carnetOpciones,
      trash: {
        colegios: ordenar('trash_colegios'),
        cursos: ordenar('trash_cursos'),
        asignaciones: ordenar('trash_asignaciones'),
        participantes: ordenar('trash_listas_part'),
        estudiantes: ordenar('trash_estudiantes'),
        carnetListas: ordenar('trash_carnetListas')
      }
    };
  }

  return {
    stableStringify,
    hashTexto,
    hashEntidad,
    slugId,
    claveListaParticipantes,
    construirIndiceLocal,
    construirBaseline,
    calcularDiff,
    calcularTombstonesNuevos,
    fusionarEntidades,
    agruparPorColeccion,
    entidadesADatos,
    PARES_ACTIVO_TRASH,
    CARNET_OPCIONES_DEFAULT
  };
});
