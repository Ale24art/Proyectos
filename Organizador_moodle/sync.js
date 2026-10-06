/* ════════════════════════════════════════════════════════════
   sync.js · window.Sync — interfaz genérica de sincronización
   ════════════════════════════════════════════════════════════
   Esta es la ÚNICA puerta de entrada que `script.js` (y, si algún
   día lo necesita, `login.html`) usan para hablar de "la nube".
   Nadie fuera de `sync-firebase.js` debe llamar a `firebase.*`
   directamente — así, mudarse a un servidor propio en el futuro
   significa escribir un adaptador nuevo (por ejemplo contra una
   API REST) y registrarlo aquí; este archivo y script.js no cambian.

   Si `sync-firebase.js` nunca llega a registrar un adaptador (SDK
   bloqueado, sin internet, archivo no cargado), `window.Sync` sigue
   existiendo y se comporta en modo "solo local": `encolar()` no hace
   nada peligroso, `estado()` informa 'sin-nube' y la app funciona
   exactamente igual que sin este archivo. Nunca lanza errores.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BASE_KEY = (typeof ACADEMIA_ACTUAL !== 'undefined' && ACADEMIA_ACTUAL.storageKey) || 'tc_organizador_data';
  const ACADEMIA_ID = (typeof ACADEMIA_ACTUAL !== 'undefined' && ACADEMIA_ACTUAL.id) || 'tecno';
  const SCHEMA_VERSION = 1;

  const K_BASELINE = BASE_KEY + '__sync_baseline';
  const K_REV = BASE_KEY + '__sync_rev';
  const K_EMAIL = BASE_KEY + '__sync_cloud_email';
  const K_POSPUESTA = BASE_KEY + '__sync_subida_inicial_pospuesta';

  let adaptador = null;         // lo entrega sync-firebase.js (o un futuro adaptador REST)
  let vinculado = false;        // ¿hay una sesión de nube activa en este dispositivo?
  let emailVinculado = null;
  let estadoActual = { tipo: 'sin-nube', detalle: '' };
  let haySinSubir = false;
  let timerCola = null;
  let intentosFallidos = 0;
  let cargaInicialHecha = false;

  const escuchas = { estado: [], primeraSubida: [], sobrescritos: [], conflictoInicial: [] };
  function emitir(tipo, payload) {
    (escuchas[tipo] || []).forEach(cb => { try { cb(payload); } catch (e) { console.error('[Sync] escucha', tipo, e); } });
  }
  function on(tipo, cb) {
    (escuchas[tipo] = escuchas[tipo] || []).push(cb);
    return () => { escuchas[tipo] = escuchas[tipo].filter(f => f !== cb); };
  }

  function marcarEstado(tipo, detalle) {
    estadoActual = { tipo, detalle: detalle || '' };
    emitir('estado', estadoActual);
  }

  function leerJSON(clave, porDefecto) {
    try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : porDefecto; }
    catch (e) { return porDefecto; }
  }
  function guardarJSON(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* cuota llena: se reintentará en el próximo ciclo */ }
  }

  function leerBaseline() { return leerJSON(K_BASELINE, {}); }
  function guardarBaseline(b) { guardarJSON(K_BASELINE, b); }
  function leerRevLocal() { return leerJSON(K_REV, null); }
  function guardarRevLocal(r) { guardarJSON(K_REV, r); }

  function nombreSesion() {
    try { return sessionStorage.getItem('tcUser') || 'Desconocido'; } catch (e) { return 'Desconocido'; }
  }

  function esErrorDeRed(e) {
    const msg = String((e && (e.code || e.message)) || e || '').toLowerCase();
    return msg.includes('network') || msg.includes('unavailable') || msg.includes('offline') || msg.includes('failed-precondition');
  }

  /* ── Vínculo de dispositivo (correo + contraseña de Firebase, NO el código de acceso) ── */
  function estadoVinculo() { return { vinculado, email: emailVinculado }; }
  function nubeDisponible() { return !!adaptador; }

  function localTieneContenido() {
    const d = (typeof data !== 'undefined' && data) ? data : null;
    return !!(d && (d.colegios.length || d.cursos.length || d.asignaciones.length || d.participantes.length || d.carnetListas.length));
  }

  async function autenticar(email, password) {
    if (!adaptador) return { ok: false, mensaje: 'La nube no está disponible en este dispositivo (sin conexión o bloqueada).' };
    try {
      const r = await adaptador.autenticar(email, password);
      if (r.academiaId !== ACADEMIA_ID) {
        await adaptador.cerrarSesion();
        return { ok: false, mensaje: 'Esta cuenta de nube no corresponde a esta academia.' };
      }
      vinculado = true;
      emailVinculado = r.email;
      guardarJSON(K_EMAIL, r.email);
      marcarEstado('pendiente', 'Vinculado, revisando la nube…');

      // Primera vez que ESTE dispositivo se vincula (línea base vacía): si la nube
      // ya tiene datos de otro dispositivo Y este equipo también tiene datos propios,
      // no se fusiona en silencio — se pregunta explícitamente qué hacer (§3.3.3).
      const baselineVacio = Object.keys(leerBaseline()).length === 0;
      if (baselineVacio && localTieneContenido()) {
        const vacia = await adaptador.primeraVezEnLaNube();
        if (!vacia) {
          const remoto = await adaptador.leerTodasLasColecciones();
          conflictoPendiente = remoto;
          if (typeof window.__syncRespaldoSilencioso === 'function') window.__syncRespaldoSilencioso();
          emitir('conflictoInicial', {});
          marcarEstado('pendiente', 'Esperando decisión sobre datos existentes en la nube.');
          return { ok: true, mensaje: 'Conectado. Hay datos previos en la nube: decide cómo continuar.' };
        }
      }

      await revisarPrimeraVez();
      await revisarYBajar(true);
      return { ok: true, mensaje: 'Conectado a la nube ✓' };
    } catch (e) {
      console.error('[Sync] autenticar', e);
      return { ok: false, mensaje: 'No se pudo conectar. Verifica el correo y la contraseña.' };
    }
  }

  /* ── Resolución del conflicto de primera conexión (ver autenticar) ── */
  let conflictoPendiente = null; // snapshot remoto ya descargado, mientras se espera la decisión del usuario

  async function resolverConflictoUsarNube() {
    if (!conflictoPendiente || !adaptador) return;
    const remoto = conflictoPendiente;
    conflictoPendiente = null;
    const entidadesRemotas = flatten(remoto.coleccionesRemotas);
    const nuevaData = SyncCore.entidadesADatos(entidadesRemotas);
    if (typeof window.__syncAplicarDataRemota === 'function') window.__syncAplicarDataRemota(nuevaData, { sobrescritos: [] });
    guardarBaseline(SyncCore.construirBaseline(entidadesRemotas));
    guardarRevLocal(remoto.rev);
    marcarEstado('sincronizado');
  }

  async function resolverConflictoSubirLocal() {
    if (!conflictoPendiente || !adaptador || typeof data === 'undefined' || !data) return;
    const remoto = conflictoPendiente;
    conflictoPendiente = null;
    marcarEstado('sincronizando', 'Subiendo los datos de este equipo…');
    try {
      const entidadesLocales = SyncCore.construirIndiceLocal(data);
      const presentesLocal = new Set(entidadesLocales.map(e => e.coleccion + '/' + e.docId));
      const entidadesRemotas = flatten(remoto.coleccionesRemotas);
      const eliminados = entidadesRemotas.filter(e => !presentesLocal.has(e.coleccion + '/' + e.docId));
      const tombstonesNuevos = SyncCore.calcularTombstonesNuevos(eliminados, entidadesLocales);
      await adaptador.escribirLote({ cambios: entidadesLocales, eliminados, tombstonesNuevos, autor: nombreSesion(), academiaId: ACADEMIA_ID, schemaVersion: SCHEMA_VERSION });
      guardarBaseline(SyncCore.construirBaseline(entidadesLocales));
      const rev = await adaptador.leerRevRaiz();
      guardarRevLocal(rev);
      marcarEstado('sincronizado');
    } catch (e) {
      console.error('[Sync] resolverConflictoSubirLocal', e);
      marcarEstado(esErrorDeRed(e) ? 'sin-conexion' : 'error', 'No se pudo subir lo de este equipo.');
    }
  }

  async function resolverConflictoCancelar() {
    conflictoPendiente = null;
    await cerrarVinculo();
  }

  async function cerrarVinculo() {
    if (adaptador) { try { await adaptador.cerrarSesion(); } catch (e) { /* no crítico */ } }
    vinculado = false;
    emailVinculado = null;
    try { localStorage.removeItem(K_EMAIL); } catch (e) {}
    marcarEstado('desconectado');
  }

  /* ── Primera vez: nube vacía + hay datos locales → ofrecer subirlos ── */
  async function revisarPrimeraVez() {
    if (!adaptador || !vinculado) return;
    try {
      const vacia = await adaptador.primeraVezEnLaNube();
      if (!vacia) return;
      const d = (typeof data !== 'undefined' && data) ? data : null;
      const hayDatos = d && (d.colegios.length || d.cursos.length || d.asignaciones.length || d.participantes.length || d.carnetListas.length);
      if (hayDatos && !sessionStorage.getItem(K_POSPUESTA)) {
        emitir('primeraSubida', {});
      }
    } catch (e) { console.error('[Sync] revisarPrimeraVez', e); }
  }

  async function confirmarSubidaInicial() {
    if (!adaptador || typeof data === 'undefined' || !data) return;
    marcarEstado('sincronizando', 'Subiendo datos de este equipo…');
    try {
      const entidades = SyncCore.construirIndiceLocal(data);
      await adaptador.escribirLote({ cambios: entidades, eliminados: [], tombstonesNuevos: [], autor: nombreSesion(), academiaId: ACADEMIA_ID, schemaVersion: SCHEMA_VERSION });
      guardarBaseline(SyncCore.construirBaseline(entidades));
      const rev = await adaptador.leerRevRaiz();
      guardarRevLocal(rev);
      marcarEstado('sincronizado');
    } catch (e) {
      console.error('[Sync] confirmarSubidaInicial', e);
      marcarEstado(esErrorDeRed(e) ? 'sin-conexion' : 'error', 'No se pudo completar la subida inicial.');
    }
  }
  function posponerSubidaInicial() {
    try { sessionStorage.setItem(K_POSPUESTA, '1'); } catch (e) {}
  }

  /* ── Subida (encolar + debounce + reintentos) ── */
  function encolar() {
    haySinSubir = true;
    if (!adaptador || !vinculado) return; // modo local: no hay nada más que hacer
    marcarEstado('pendiente');
    clearTimeout(timerCola);
    timerCola = setTimeout(intentarSubir, 3000);
  }

  function construirLoteParaSubir() {
    const entidadesActuales = SyncCore.construirIndiceLocal(data);
    const baseline = leerBaseline();
    const { cambios, eliminados } = SyncCore.calcularDiff(entidadesActuales, baseline);
    const tombstonesNuevos = SyncCore.calcularTombstonesNuevos(eliminados, entidadesActuales);
    return { entidadesActuales, cambios, eliminados, tombstonesNuevos };
  }

  async function intentarSubir() {
    clearTimeout(timerCola);
    if (!adaptador || !vinculado || typeof data === 'undefined' || !data) return;
    const { entidadesActuales, cambios, eliminados, tombstonesNuevos } = construirLoteParaSubir();
    if (!cambios.length && !eliminados.length) { haySinSubir = false; marcarEstado('sincronizado'); return; }
    marcarEstado('sincronizando');
    try {
      await adaptador.escribirLote({ cambios, eliminados, tombstonesNuevos, autor: nombreSesion(), academiaId: ACADEMIA_ID, schemaVersion: SCHEMA_VERSION });
      guardarBaseline(SyncCore.construirBaseline(entidadesActuales));
      const rev = await adaptador.leerRevRaiz();
      guardarRevLocal(rev);
      haySinSubir = false;
      intentosFallidos = 0;
      marcarEstado('sincronizado');
    } catch (e) {
      console.error('[Sync] intentarSubir', e);
      intentosFallidos++;
      marcarEstado(esErrorDeRed(e) ? 'sin-conexion' : 'error', 'No se pudieron subir los cambios.');
      const espera = Math.min(30000, 1000 * Math.pow(2, intentosFallidos));
      clearTimeout(timerCola);
      timerCola = setTimeout(intentarSubir, espera);
    }
  }

  /* ── Descarga (revisar _rev raíz; bajar todo solo si cambió) ── */
  async function revisarYBajar(forzarDescarga) {
    if (!adaptador || !vinculado || typeof data === 'undefined' || !data) return;
    try {
      const revRemoto = await adaptador.leerRevRaiz();
      const revConocido = leerRevLocal();
      if (!forzarDescarga && revRemoto !== null && revRemoto === revConocido) {
        if (!haySinSubir) marcarEstado('sincronizado');
        return;
      }
      marcarEstado('sincronizando');
      const { coleccionesRemotas, tombstones, rev } = await adaptador.leerTodasLasColecciones();
      const entidadesRemotas = flatten(coleccionesRemotas);
      const entidadesLocales = SyncCore.construirIndiceLocal(data);
      const baseline = leerBaseline();
      const { entidades, sobrescritos } = SyncCore.fusionarEntidades(entidadesLocales, baseline, entidadesRemotas, tombstones);
      const nuevaData = SyncCore.entidadesADatos(entidades);

      if (typeof window.__syncAplicarDataRemota === 'function') {
        window.__syncAplicarDataRemota(nuevaData, { sobrescritos });
      }
      if (sobrescritos.length) emitir('sobrescritos', sobrescritos);

      guardarBaseline(SyncCore.construirBaseline(entidades));
      guardarRevLocal(rev);
      intentosFallidos = 0;
      marcarEstado(haySinSubir ? 'pendiente' : 'sincronizado');
    } catch (e) {
      console.error('[Sync] revisarYBajar', e);
      marcarEstado(esErrorDeRed(e) ? 'sin-conexion' : 'error', 'No se pudo revisar la nube.');
    }
  }

  function flatten(coleccionesRemotas) {
    const out = [];
    Object.keys(coleccionesRemotas || {}).forEach(coleccion => {
      (coleccionesRemotas[coleccion] || []).forEach(doc => out.push(doc));
    });
    return out;
  }

  async function sincronizarAhora() {
    await intentarSubir();
    await revisarYBajar(false);
  }

  /* ── Arranque: autenticación silenciosa (si el dispositivo ya estaba vinculado) ── */
  async function cargar() {
    if (cargaInicialHecha) return;
    cargaInicialHecha = true;
    if (!adaptador) { marcarEstado('sin-nube'); return; }
    marcarEstado('desconectado');
    try {
      const actual = await adaptador.sesionActiva();
      if (actual && actual.academiaId === ACADEMIA_ID) {
        vinculado = true;
        emailVinculado = actual.email || leerJSON(K_EMAIL, null);
        marcarEstado('sincronizando');
        await revisarPrimeraVez();
        await revisarYBajar(false);
      } else if (actual) {
        // Sesión de otra academia en este navegador: no la usamos, pero tampoco la cerramos
        // (podría ser el navegador de un equipo compartido con otra persona).
        marcarEstado('desconectado');
      }
    } catch (e) {
      console.error('[Sync] cargar', e);
      marcarEstado('error', 'No se pudo verificar la sesión de nube.');
    }
  }

  function estado() { return Object.assign({}, estadoActual, { vinculado, email: emailVinculado }); }

  function _registrarAdaptador(impl) {
    adaptador = impl;
    marcarEstado('desconectado');
  }

  window.Sync = {
    autenticar, cerrarVinculo, estadoVinculo, nubeDisponible,
    cargar, encolar, sincronizarAhora,
    estado, onCambioEstado: cb => on('estado', cb),
    onPrimeraSubidaDisponible: cb => on('primeraSubida', cb),
    onSobrescritos: cb => on('sobrescritos', cb),
    onConflictoInicial: cb => on('conflictoInicial', cb),
    confirmarSubidaInicial, posponerSubidaInicial,
    resolverConflictoUsarNube, resolverConflictoSubirLocal, resolverConflictoCancelar,
    _registrarAdaptador
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') revisarYBajar(false);
  });
})();
