/* ════════════════════════════════════════════════════════════
   firebase-config.js · Configuración pública del proyecto Firebase
   ════════════════════════════════════════════════════════════
   Estos valores NO son secretos: cualquier app web de Firebase los
   expone en el navegador. La protección real de los datos la dan
   las reglas de Firestore (ver firestore.rules), no este archivo.

   Cómo obtenerlos:
     firebase apps:sdkconfig web --project moodle-organizador
   o en la consola: Configuración del proyecto → "Tu aplicación web"
   → "Configuración del SDK" → "Config".

   Reemplaza los marcadores TU_..._AQUI por los valores reales.
   Mientras sigan con el marcador, `firebase.initializeApp()` se
   ejecuta pero cualquier operación real (login, lectura, escritura)
   fallará de forma controlada: la app sigue funcionando en modo
   solo local (ver sync.js / sync-firebase.js).
   ════════════════════════════════════════════════════════════ */
(function () {
  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.info('[firebase-config] SDK de Firebase no cargado; modo solo local.');
    return;
  }

  const FIREBASE_CONFIG = {
    apiKey: 'TU_API_KEY_AQUI',
    authDomain: 'moodle-organizador.firebaseapp.com',
    projectId: 'moodle-organizador',
    storageBucket: 'moodle-organizador.appspot.com',
    messagingSenderId: 'TU_SENDER_ID_AQUI',
    appId: 'TU_APP_ID_AQUI'
  };

  if (FIREBASE_CONFIG.apiKey.indexOf('TU_') === 0) {
    console.info('[firebase-config] Faltan los valores reales del proyecto; modo solo local hasta completarlos.');
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
  } catch (e) {
    console.error('[firebase-config] No se pudo inicializar Firebase.', e);
  }
})();
