/* ════════════════════════════════════════════════════════════
   sync-firebase.js · Adaptador de Firebase para window.Sync
   ════════════════════════════════════════════════════════════
   ÚNICO archivo de todo el proyecto que puede llamar a `firebase.*`.
   Si se muda la app a un servidor propio (ver database/MIGRACION_A_
   SERVIDOR_PROPIO.md), este es el único archivo que hay que
   reemplazar por un adaptador equivalente contra una API REST.

   Si el SDK de Firebase no cargó (sin internet, bloqueado, o
   `firebase-config.js` todavía tiene los marcadores de ejemplo),
   este archivo simplemente no registra ningún adaptador y
   `window.Sync` se queda en modo "solo local" sin lanzar errores.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (typeof firebase === 'undefined' || !firebase.apps) {
    console.info('[SyncFirebase] SDK de Firebase no disponible; la app sigue funcionando solo con almacenamiento local.');
    return;
  }
  if (!firebase.apps.length) {
    console.info('[SyncFirebase] Firebase no se inicializó (revisa Organizador_moodle/firebase-config.js); modo solo local.');
    return;
  }
  if (typeof window.Sync !== 'object' || typeof window.Sync._registrarAdaptador !== 'function') {
    console.error('[SyncFirebase] window.Sync no existe todavía; revisa el orden de los <script> en index.html.');
    return;
  }

  const ACADEMIA_ID = ACADEMIA_ACTUAL.id;

  const COLECCIONES = [
    'colegios', 'cursos', 'asignaciones', 'carnetListas', 'carnetOpciones', 'listas_part',
    'trash_colegios', 'trash_cursos', 'trash_asignaciones', 'trash_carnetListas', 'trash_listas_part', 'trash_estudiantes'
  ];

  function db() { return firebase.firestore(); }
  function refAcademia(academiaId) { return db().collection('academias').doc(academiaId); }
  function refColeccion(academiaId, coleccion) { return refAcademia(academiaId).collection(coleccion); }
  function refTombstones(academiaId) { return refAcademia(academiaId).collection('tombstones'); }

  function docAEntidad(coleccion, docSnap) {
    const bruto = docSnap.data() || {};
    const orden = bruto._orden || 0;
    const datos = Object.assign({}, bruto);
    delete datos._orden; delete datos._updatedAt; delete datos._updatedBy; delete datos._schemaVersion;
    const clave = (coleccion === 'listas_part' || coleccion === 'trash_listas_part')
      ? { colegioId: datos.colegioId, cursoId: datos.cursoId, anio: datos.anio, grupo: datos.grupo || '' }
      : { id: docSnap.id };
    return { coleccion, docId: docSnap.id, datos, orden, clave };
  }

  function esperarEstadoAuthInicial() {
    return new Promise(resolve => {
      const cancelar = firebase.auth().onAuthStateChanged(user => { cancelar(); resolve(user); });
    });
  }

  async function autenticar(email, password) {
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
    const snap = await db().collection('auth_map').doc(cred.user.uid).get();
    if (!snap.exists) {
      await firebase.auth().signOut();
      throw new Error('auth_map/' + cred.user.uid + ' no existe: cuenta sin academia autorizada.');
    }
    const info = snap.data();
    return { uid: cred.user.uid, email: cred.user.email, academiaId: info.academiaId, nombre: info.nombre || '' };
  }

  async function cerrarSesion() { await firebase.auth().signOut(); }

  async function sesionActiva() {
    const user = await esperarEstadoAuthInicial();
    if (!user) return null;
    const snap = await db().collection('auth_map').doc(user.uid).get();
    if (!snap.exists) return null;
    const info = snap.data();
    return { uid: user.uid, email: user.email, academiaId: info.academiaId, nombre: info.nombre || '' };
  }

  async function primeraVezEnLaNube() {
    const snap = await refAcademia(ACADEMIA_ID).get();
    return !snap.exists;
  }

  async function leerRevRaiz() {
    const snap = await refAcademia(ACADEMIA_ID).get();
    return snap.exists ? (snap.data()._rev || 0) : null;
  }

  async function leerTodasLasColecciones() {
    const [snapshots, tombSnap, rootSnap] = await Promise.all([
      Promise.all(COLECCIONES.map(c => refColeccion(ACADEMIA_ID, c).get())),
      refTombstones(ACADEMIA_ID).get(),
      refAcademia(ACADEMIA_ID).get()
    ]);
    const coleccionesRemotas = {};
    COLECCIONES.forEach((coleccion, i) => {
      coleccionesRemotas[coleccion] = snapshots[i].docs.map(d => docAEntidad(coleccion, d));
    });
    const tombstones = new Set();
    tombSnap.docs.forEach(d => {
      const t = d.data();
      tombstones.add(t.coleccion + '/' + t.docId);
    });
    const rev = rootSnap.exists ? (rootSnap.data()._rev || 0) : 0;
    return { coleccionesRemotas, tombstones, rev };
  }

  async function escribirLote({ cambios, eliminados, tombstonesNuevos, autor, academiaId, schemaVersion }) {
    const academia = academiaId || ACADEMIA_ID;
    const ahora = new Date().toISOString();
    // Límite de Firestore: 500 operaciones por batch. Para la escala de esta app
    // (participantes agrupados por lista, no un documento por estudiante) un solo
    // batch alcanza en el uso normal. Si se llegara a superar, habría que dividir
    // en varios batches secuenciales — no implementado, fuera del alcance actual.
    const batch = db().batch();
    cambios.forEach(e => {
      const ref = refColeccion(academia, e.coleccion).doc(e.docId);
      const payload = Object.assign({}, e.datos, {
        _orden: e.orden, _updatedAt: ahora, _updatedBy: autor, _schemaVersion: schemaVersion || 1
      });
      batch.set(ref, payload);
    });
    eliminados.forEach(e => {
      batch.delete(refColeccion(academia, e.coleccion).doc(e.docId));
    });
    tombstonesNuevos.forEach(t => {
      const id = t.coleccion + '__' + t.docId;
      batch.set(refTombstones(academia).doc(id), { coleccion: t.coleccion, docId: t.docId, eliminadoEn: ahora, eliminadoPor: autor });
    });
    batch.set(refAcademia(academia), {
      _rev: firebase.firestore.FieldValue.increment(1),
      _updatedAt: ahora, _updatedBy: autor, _schemaVersion: schemaVersion || 1
    }, { merge: true });
    await batch.commit();
  }

  window.Sync._registrarAdaptador({
    autenticar, cerrarSesion, sesionActiva, primeraVezEnLaNube,
    leerRevRaiz, leerTodasLasColecciones, escribirLote
  });
})();
