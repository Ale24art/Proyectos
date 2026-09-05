<!-- =========================================================
     MODO OSCURO v2 - Botón toggle para Moove (Moodle 5.0.6)
     Pegar este bloque completo (incluyendo <script>) en:
     Administración del sitio > Apariencia > HTML adicional >
     "Antes de cerrar BODY"
     (reemplaza completamente lo que hayas pegado antes)
     ========================================================= -->

<!-- colocar en el apartado Antes de cerrar BODY dentro de moodle HTML Adicional -->

<script>
(function () {
  var STORAGE_KEY = 'moodle_dark_mode';

  var moonIcon = '<svg viewBox="0 0 24 24"><path d="M21.75 15.5A9.72 9.72 0 0 1 12.24 22 9.75 9.75 0 0 1 12 2.5a.75.75 0 0 1 .82 1.13A7.25 7.25 0 0 0 21.13 14.7a.75.75 0 0 1 .62 .8Z"/></svg>';
  var sunIcon = '<svg viewBox="0 0 24 24"><path d="M12 4a1 1 0 0 1-1-1V1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1Zm0 20a1 1 0 0 1-1-1v-2a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1ZM4 13H2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2Zm20 0h-2a1 1 0 1 1 0-2h2a1 1 0 1 1 0 2ZM5.64 6.34a1 1 0 0 1-1.41 0L2.9 5a1 1 0 1 1 1.41-1.41l1.33 1.33a1 1 0 0 1 0 1.42Zm14.61 14.61a1 1 0 0 1-1.41 0l-1.33-1.33a1 1 0 1 1 1.41-1.41l1.33 1.33a1 1 0 0 1 0 1.41ZM5.64 17.66l-1.33 1.33A1 1 0 1 1 2.9 17.58l1.33-1.33a1 1 0 1 1 1.41 1.41Zm14.61-14.61-1.33 1.33a1 1 0 1 1-1.41-1.41l1.33-1.33a1 1 0 1 1 1.41 1.41ZM12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6Z"/></svg>';

  function applyMode(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    var btn = document.querySelector('.dark-mode-toggle-btn');
    if (btn) {
      btn.innerHTML = isDark ? sunIcon : moonIcon;
      btn.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }

  function createToggleButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dark-mode-toggle-btn';
    btn.setAttribute('aria-label', 'Cambiar modo oscuro');

    // Prioridad 1: insertarlo como PRIMER hijo del contenedor de navegación
    // (#usernavigation). Esto evita meterlo dentro de submenús como el
    // selector de idioma (.langmenu) o el menú de usuario, que rompían
    // el layout al anidar el botón donde no correspondía.
    var container = document.querySelector('#usernavigation');
    if (container) {
      container.insertBefore(btn, container.firstChild);
      return btn;
    }

    // Prioridad 2 (respaldo): selectores típicos de Moove/Boost si por algún
    // motivo #usernavigation no existe en esta página.
    var selectors = [
      '.popover-region-messages',
      '.popover-region-notifications',
      '.usermenu',
      '.navbar-nav.ml-auto',
      '.navbar .ml-auto'
    ];
    var target = null;
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) { target = el; break; }
    }

    if (target && target.parentNode) {
      target.parentNode.insertBefore(btn, target);
    } else {
      var header = document.querySelector('#page-header') || document.body;
      header.appendChild(btn);
    }

    return btn;
  }

  document.addEventListener('DOMContentLoaded', function () {
    // La página de login tiene su propia imagen de fondo a pantalla completa;
    // el modo oscuro la tapa, así que ahí no se ofrece el toggle.
    if (document.body.classList.contains('pagelayout-login')) {
      return;
    }

    var toggleBtn = createToggleButton();
    toggleBtn.addEventListener('click', function () {
      var isDark = !document.body.classList.contains('dark-mode');
      applyMode(isDark);
      try {
        localStorage.setItem(STORAGE_KEY, isDark ? '1' : '0');
      } catch (e) { /* localStorage no disponible */ }
    });

    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (e) { /* ignorar */ }

    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = saved === '1' || (saved === null && prefersDark);
    applyMode(isDark);
  });
})();
</script>