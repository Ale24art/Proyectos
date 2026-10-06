/* ════════════════════════════════════════════════════════════
   academias.js · Configuración multi-academia
   Debe cargarse ANTES de script.js y de carnets.js.
   ════════════════════════════════════════════════════════════ */

const ACADEMIAS = {
  tecno: {
    id: 'tecno',
    nombre: 'TecnoCleveland',
    subtitulo: 'Academia de Robótica',
    storageKey: 'tc_organizador_data',   // ¡NO cambiar! es la clave que ya usan los datos reales
    emailDominio: 'tecno.com',
    importarCSV: true,                    // la función "Importar CSV" del Generador de usuarios
    importarCSVConservarDatos: false,     // false → recalcula email con emailDominio (comportamiento Tecno)
    idiomaCarnet: 'es',
    idiomaUI: 'es'
  },
  cleveland: {
    id: 'cleveland',
    nombre: 'Cleveland English Institute',
    subtitulo: 'English Program',
    storageKey: 'cc_organizador_data',
    emailDominio: 'cleve.com',
    importarCSV: true,                    // muestra el botón "Importar CSV" para el usuario ruben
    importarCSVConservarDatos: true,      // true → carga fiel: email y datos del CSV sin modificar
    idiomaCarnet: 'en',
    idiomaUI: 'es'
  }
};

function getAcademiaActual() {
  const id = sessionStorage.getItem('tcAcademia');
  return ACADEMIAS[id] || ACADEMIAS.tecno;
}

const ACADEMIA_ACTUAL = getAcademiaActual();
