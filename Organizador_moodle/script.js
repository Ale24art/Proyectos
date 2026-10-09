/* ════════════════════════════════════════════════════════════
   TecnoCleveland · Organizador Moodle
   Todo se guarda en localStorage (navegador). Ver "Respaldo" en
   la app para exportar/importar un archivo .json de seguridad.
   ════════════════════════════════════════════════════════════ */

const STORAGE_KEY = ACADEMIA_ACTUAL.storageKey;

const DEFAULT_COLEGIOS = [
  "Alejandro Humboldt","Angel de la Guarda","Fray Miguel de Olivares","Arturo Michelena",
  "Cesar Rengifo","Gran Mariscal de Ayacucho","Daniel Camejo Acosta","Rafael Castillo",
  "San Andrés","San Juan Eudes","Alfa y Omega","Aquiles Nazoa","El Parque",
  "Madre Teresa de Calcuta","Santa Clara de Asis","Santos Michelena","Jose Maria Vargas",
  "Tomás de Jesús Quintero","Santisimo Salvador","Pedro Alcantara León","Lazo Martí",
  "Santa Rosa de Lima","Colegio Sucre","Maria Inmaculada de Los Dos Caminos","El Araguaney",
  "Monseñor Francisco de Ibarra y Herrera","Rosa de Saron","Don Cesar Acosta"
];

const DEFAULT_CURSOS = [
  // Educación Media
  { nombre: "Robotica 1", nivel: "media" },
  { nombre: "Robotica 2", nivel: "media" },
  { nombre: "Electronica 1", nivel: "media" },
  { nombre: "Electronica 2", nivel: "media" },
  { nombre: "Diseño 3D", nivel: "media" },
  { nombre: "STEAMakersBlocks", nivel: "media" },
  { nombre: "STEAMakers ESP32", nivel: "media" },
  // Educación Primaria
  { nombre: "Knex A1 1er grado", nivel: "primaria" },
  { nombre: "Knex A1 2do grado", nivel: "primaria" },
  { nombre: "Knex A2 1er grado", nivel: "primaria" },
  { nombre: "Knex A2 2do grado", nivel: "primaria" },
  { nombre: "Knex A3 1er grado", nivel: "primaria" },
  { nombre: "Aventuras con TpBot", nivel: "primaria" },
  { nombre: "Maker 3.0", nivel: "primaria" },
  { nombre: "Nezha", nivel: "primaria" },
  { nombre: "Wonder", nivel: "primaria" },
  { nombre: "Scratch Interactivo", nivel: "primaria" },
];

const NIVEL_LABEL = { media: "🎓 Educación Media", primaria: "🧒 Educación Primaria" };

function extractAnioNum(anio) {
  const m = String(anio || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

// Normaliza una cadena de nivel a 'media', 'primaria' o null.
// Acepta: 'media', 'Media', 'MEDIA', 'Educación Media', 'educacion media', etc.
function _normNivelStr(s) {
  const v = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (v === 'media' || v === 'educacion media') return 'media';
  if (v === 'primaria' || v === 'educacion primaria') return 'primaria';
  return null;
}

// Deriva el nivel a partir del texto del año/grado.
// "…Año…" / "…Year…" → 'media'; "…Grado…" / "…Grade…" → 'primaria'.
function nivelDeAnio(anio) {
  const v = String(anio || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/\bano\b|\byear\b/.test(v)) return 'media';
  if (/\bgrado\b|\bgrade\b/.test(v)) return 'primaria';
  return null;
}

// Devuelve el nivel canónico ('media' | 'primaria' | null) de un participante.
// Orden de precedencia: p.nivel normalizado → cursoMap[p.cursoId].nivel → texto de p.anio.
function nivelDe(p, cursoMap) {
  const n1 = _normNivelStr(p.nivel);
  if (n1) return n1;
  if (cursoMap) {
    const n2 = _normNivelStr((cursoMap[p.cursoId] || {}).nivel);
    if (n2) return n2;
  }
  return nivelDeAnio(p.anio);
}

let data = null; // { colegios:[], cursos:[], asignaciones:[], participantes:[], trash:{colegios:[],cursos:[],asignaciones:[]} }

let currentView = 'dashboard';
let currentCollegeId = null;
let cursosTab = 'media';
let editingCollegeId = null;
let editingCursoId = null;
let editingAsigId = null;
let asigPresetCollegeId = null;

let genColegioId = null;
let genAnioSel = null;
let genAsig = null;
let genPreviewRows = [];
let genPreviewCtx = null;
let genPreviewSaved = false; // true si las filas ya existen en data.participantes (se abrió con Ver/Editar)
let genEliminarCtx = null;   // { index } mientras el modal de eliminar estudiante está abierto
let genModoAgregar = false;             // true mientras el Generador está en modo agregar
let genModoAgregarExistentes = [];      // copia de genPreviewRows al entrar en modo agregar
const GEN_COLS = ['username','password','firstname','lastname','email','city','country','course1','group1','role1','enrolperiod1','suspended'];

/* ── UTILIDADES ── */
function uid() { return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function slugifyInitials(nombre) {
  const stop = new Set(['de','la','el','los','las','y','del','a']);
  const words = nombre.split(/\s+/).filter(w => w && !stop.has(w.toLowerCase()));
  const initials = words.map(w => w[0]).join('').toUpperCase();
  return initials || nombre.slice(0,2).toUpperCase();
}

function ordinalWord(n) {
  const map = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', 5:'5th', 6:'6th', 7:'7th' };
  return map[n] || (n + 'th');
}

function parseUsername(username) {
  const m = /^([a-zA-Z]+)(\d+)$/.exec(String(username || '').trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

/**
 * Calcula la renumeración consecutiva al "Reestructurar" tras eliminar un estudiante.
 * `lista`: participantes de la MISMA lista (colegio+curso+año+grupo), incluido el eliminado.
 * `usernamesOcupados`: usernames (cualquier capitalización) ya usados por OTRAS listas/grupos
 *   del mismo colegio+prefijo — el llamador debe excluir aquí toda la `lista` actual, porque
 *   sus números están a punto de desplazarse y no cuentan como "ocupados" por otra lista.
 * Devuelve { posible, motivo?, cambios:[{usernameAnterior, usernameNuevo}] }.
 */
function calcularReestructura(lista, eliminadoUsername, digits, usernamesOcupados) {
  const parsedDel = parseUsername(eliminadoUsername);
  if (!parsedDel) {
    return { posible: false, motivo: 'El estudiante eliminado no tiene un usuario con el formato letras+números.', cambios: [] };
  }
  const prefix = parsedDel.prefix.toLowerCase();

  const posteriores = lista
    .map(item => ({ item, parsed: parseUsername(item.username) }))
    .filter(x => x.parsed
      && x.parsed.prefix.toLowerCase() === prefix
      && String(x.item.username).toLowerCase() !== String(eliminadoUsername).toLowerCase()
      && x.parsed.num > parsedDel.num)
    .sort((a, b) => a.parsed.num - b.parsed.num);

  if (!posteriores.length) {
    return { posible: false, motivo: 'No hay usuarios posteriores al eliminado en esta lista.', cambios: [] };
  }

  const usados = new Set(Array.from(usernamesOcupados || []).map(u => String(u).toLowerCase()));
  let nextNum = parsedDel.num;
  const cambios = [];
  posteriores.forEach(({ item }) => {
    let candidato = prefix + String(nextNum).padStart(digits, '0');
    while (usados.has(candidato.toLowerCase())) {
      nextNum++;
      candidato = prefix + String(nextNum).padStart(digits, '0');
    }
    cambios.push({ usernameAnterior: item.username, usernameNuevo: candidato });
    usados.add(candidato.toLowerCase());
    nextNum++;
  });

  return { posible: true, cambios };
}

/* ── ACORDEÓN REUTILIZABLE ──
   Estado abierto/cerrado guardado en memoria (no en `data` ni localStorage):
   las vistas se re-renderizan con innerHTML y sin esto el acordeón se
   reabriría solo con cada acción. Por defecto todos empiezan abiertos. */
const uiAcordeones = {};
function accOpen(key) { return uiAcordeones[key] !== false; }
function applyAccState(key) {
  const open = accOpen(key);
  document.querySelectorAll(`[data-acc="${key}"]`).forEach(el => {
    if (el.classList.contains('acc-header')) {
      el.setAttribute('aria-expanded', String(open));
      el.classList.toggle('acc-collapsed', !open);
    } else {
      el.style.display = open ? '' : 'none';
    }
  });
}
function toggleAcordeon(key) {
  uiAcordeones[key] = !accOpen(key);
  applyAccState(key);
}

/* ── PAGINACIÓN REUTILIZABLE (estilo Moodle) ── */
function paginaInfo(total, page, perPage) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const clamped = Math.min(Math.max(1, page || 1), totalPages);
  const start = total === 0 ? 0 : (clamped - 1) * perPage + 1;
  const end = Math.min(clamped * perPage, total);
  return { page: clamped, totalPages, start, end };
}

// Botones a mostrar: primera, última, actual ±2, con "…" en los huecos.
function paginaBotones(page, totalPages) {
  if (totalPages <= 1) return [];
  const keep = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const sorted = [...keep].filter(n => n >= 1 && n <= totalPages).sort((a,b) => a - b);
  const result = [];
  let prev = 0;
  sorted.forEach(n => {
    if (prev && n - prev > 1) result.push({ type: 'ellipsis' });
    result.push({ type: 'page', n });
    prev = n;
  });
  return result;
}

function renderPaginacionHTML(containerId, page, totalPages, onClickFnName) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  const botones = paginaBotones(page, totalPages);
  let html = `<button class="btn btn-ghost sm" ${page <= 1 ? 'disabled' : ''} onclick="${onClickFnName}(${page - 1})">‹ Anterior</button>`;
  html += botones.map(b => b.type === 'ellipsis'
    ? `<span class="pg-ellipsis">…</span>`
    : `<button class="btn ${b.n === page ? 'btn-primary' : 'btn-ghost'} sm" onclick="${onClickFnName}(${b.n})">${b.n}</button>`
  ).join('');
  html += `<button class="btn btn-ghost sm" ${page >= totalPages ? 'disabled' : ''} onclick="${onClickFnName}(${page + 1})">Siguiente ›</button>`;
  el.innerHTML = html;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignorado, el salto real viene con \n */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ── PERSISTENCIA ── */
const CARNET_OPCIONES_DEFAULT = { layout: 'big', url: 'cursoscleveland.com', upper: true };

function freshData() {
  const esTecno = ACADEMIA_ACTUAL.id === 'tecno';
  return {
    colegios: esTecno ? DEFAULT_COLEGIOS.map(nombre => ({ id: uid(), nombre })) : [],
    cursos: esTecno ? DEFAULT_CURSOS.map(c => ({ id: uid(), nombre: c.nombre, nivel: c.nivel })) : [],
    asignaciones: [],
    participantes: [],
    carnetListas: [],
    carnetOpciones: { ...CARNET_OPCIONES_DEFAULT },
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] }
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { data = freshData(); saveData(); return; }
    const parsed = JSON.parse(raw);
    const trash = parsed.trash || {};
    data = {
      colegios: parsed.colegios || [],
      cursos: parsed.cursos || [],
      asignaciones: parsed.asignaciones || [],
      participantes: parsed.participantes || [],
      carnetListas: parsed.carnetListas || [],
      carnetOpciones: { ...CARNET_OPCIONES_DEFAULT, ...(parsed.carnetOpciones || {}) },
      trash: {
        colegios: trash.colegios || [],
        cursos: trash.cursos || [],
        asignaciones: trash.asignaciones || [],
        participantes: trash.participantes || [],
        estudiantes: trash.estudiantes || [],
        carnetListas: trash.carnetListas || []
      }
    };
  } catch (e) {
    console.error('Error cargando datos, se crean datos nuevos.', e);
    data = freshData();
    saveData();
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error guardando datos', e);
    showToast('⚠ No se pudo guardar. ¿Espacio de almacenamiento lleno?');
  }
  // La nube (si está vinculada) se actualiza de forma asíncrona y nunca bloquea
  // este guardado local — ver sync.js. Si no hay adaptador, encolar() no hace nada.
  if (window.Sync) Sync.encolar();
}

/* ── Tamaño aproximado de `data` en localStorage, para el aviso de cuota (Parte C) ── */
function tamanoDatosBytes() {
  try { return new Blob([JSON.stringify(data)]).size; } catch (e) { return JSON.stringify(data).length; }
}

/* ── ARRANQUE ── */
function applyAcademiaBranding() {
  document.body.setAttribute('data-academia', ACADEMIA_ACTUAL.id);
  document.title = `${ACADEMIA_ACTUAL.nombre} · Organizador Moodle`;

  const esTecno = ACADEMIA_ACTUAL.id === 'tecno';
  const logoMark = document.getElementById('sidebar-logo-mark');
  const logoText = document.getElementById('sidebar-logo-text');
  const logoSub = document.getElementById('sidebar-logo-subtitle');
  const footerAcademia = document.getElementById('sidebar-footer-academia');
  const welcomeAcademia = document.getElementById('welcome-academia');
  const welcomeIcons = document.getElementById('welcome-icons');
  const statColegiosSub = document.getElementById('stat-colegios-sub');
  const importBtn = document.getElementById('gen-import-btn');
  const resetCatalogText = document.getElementById('reset-catalog-text');

  if (logoMark) logoMark.textContent = esTecno ? '🤖' : '🪪';
  if (logoText) logoText.innerHTML = esTecno
    ? 'Tecno<span class="logo-accent">Cleveland</span>'
    : 'Cleveland<span class="logo-accent"> English</span>';
  if (logoSub) logoSub.textContent = ACADEMIA_ACTUAL.subtitulo;
  if (footerAcademia) footerAcademia.textContent = `${ACADEMIA_ACTUAL.nombre} · ${ACADEMIA_ACTUAL.subtitulo}`;
  if (welcomeAcademia) welcomeAcademia.textContent = `${ACADEMIA_ACTUAL.nombre} · ${ACADEMIA_ACTUAL.subtitulo}`;
  if (welcomeIcons) welcomeIcons.textContent = esTecno ? '🤖⚙️🔧' : '🪪📘🌎';
  if (statColegiosSub) statColegiosSub.textContent = esTecno ? 'de 28 registrados' : 'registrados';
  if (importBtn) importBtn.style.display = ACADEMIA_ACTUAL.importarCSV ? '' : 'none';
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', String(!document.documentElement.classList.contains('sidebar-collapsed')));
  if (resetCatalogText) {
    resetCatalogText.innerHTML = esTecno
      ? 'Si algo se dañó, puedes recargar la lista base de 28 colegios y 17 cursos modelo. Esto <b>no borra</b> los cursos copiados que ya registraste.'
      : 'Si algo se dañó, puedes vaciar el catálogo de colegios y cursos modelo para empezar de nuevo. Esto <b>no borra</b> los cursos copiados, participantes ni carnets que ya registraste.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  applyAcademiaBranding();

  const savedUser = sessionStorage.getItem('tcUser') || 'Administrador';
  document.getElementById('sidebar-user').textContent = savedUser;
  document.getElementById('greet-user').textContent = savedUser;

  document.getElementById('dashboard-date').textContent =
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (localStorage.getItem('tc_dark') === '1') {
    document.body.classList.add('dark');
  }

  renderAll();
  if (window.Carnets && typeof window.Carnets.init === 'function') window.Carnets.init();

  setTimeout(() => {
    const loader = document.getElementById('app-loader');
    if (loader) loader.style.display = 'none';
  }, 250);

  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('sidebar-active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  });
  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('sidebar-active');
    document.getElementById('sidebar-overlay').classList.remove('active');
  });

  document.getElementById('am-fecha').value = todayStr();

  // La nube se intenta en paralelo y nunca retrasa la apertura de la app
  // (ya renderizada arriba con los datos locales). Ver sync.js.
  if (window.Sync) {
    Sync.onCambioEstado(renderSyncStatus);
    Sync.onPrimeraSubidaDisponible(() => document.getElementById('modal-primera-subida').classList.add('active'));
    Sync.onConflictoInicial(() => document.getElementById('modal-conflicto-nube').classList.add('active'));
    Sync.onSobrescritos(lista => showToast(`☁ Se actualizaron ${lista.length} registro(s) desde otro dispositivo.`));
    renderSyncStatus(Sync.estado());
    renderRespaldoView();
    Sync.cargar();
  }
});

function renderAll() {
  renderDashboard();
  renderColegios();
  renderCursos();
  renderGenerador();
  renderBuscar();
  renderTrash();
  updateTrashBadge();
  if (window.Sync) renderRespaldoView();
}

/* ── NAVEGACIÓN ── */
const NAV_VIEWS = ['dashboard','colegios','generador','cursos','buscar','respaldo','trash'];

function showView(id) {
  currentView = id;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + id).classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${id}"]`);
  if (navBtn) navBtn.classList.add('active');

  if (id === 'colegios') { closeCollegeDetail(); renderColegios(); }
  if (id === 'generador') renderGenerador();
  if (id === 'carnets' && window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
  if (id === 'cursos') renderCursos();
  if (id === 'buscar') renderBuscar();
  if (id === 'trash') renderTrash();
  if (id === 'dashboard') renderDashboard();
  if (id === 'respaldo' && window.Sync) renderRespaldoView();

  document.querySelector('.sidebar').classList.remove('sidebar-active');
  document.getElementById('sidebar-overlay').classList.remove('active');
  window.scrollTo(0,0);
}

function logout() {
  sessionStorage.removeItem('tcUser');
  sessionStorage.removeItem('tcAcademia');
  window.location.replace('login.html');
}

function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('tc_dark', document.body.classList.contains('dark') ? '1' : '0');
}

function toggleSidebar() {
  const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
  try { localStorage.setItem('tc_sidebar_collapsed', collapsed ? '1' : '0'); } catch(e) {}
  const btn = document.getElementById('sidebar-toggle-btn');
  if (btn) btn.setAttribute('aria-expanded', String(!collapsed));
}

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 2400);
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD
   ════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const totalColegios = data.colegios.length;
  const totalAsig = data.asignaciones.length;
  const totalClases = data.asignaciones.reduce((s,a) => s + (Number(a.clases)||0), 0);
  const promedio = totalAsig ? Math.round((totalClases / totalAsig) * 10) / 10 : 0;

  document.getElementById('stat-colegios').textContent = totalColegios;
  document.getElementById('stat-asignaciones').textContent = totalAsig;
  document.getElementById('stat-clases').textContent = totalClases;
  document.getElementById('stat-promedio').textContent = promedio;

  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const mediaCount = data.asignaciones.filter(a => (cursoMap[a.cursoId]||{}).nivel === 'media').length;
  const primariaCount = data.asignaciones.filter(a => (cursoMap[a.cursoId]||{}).nivel === 'primaria').length;
  const maxCount = Math.max(mediaCount, primariaCount, 1);

  document.getElementById('nivel-bars').innerHTML = `
    <div class="nivel-bar-row">
      <div class="nivel-bar-label"><span>🎓 Educación Media</span><span>${mediaCount}</span></div>
      <div class="nivel-bar-track"><div class="nivel-bar-fill" style="width:${(mediaCount/maxCount)*100}%;background:var(--accent)"></div></div>
    </div>
    <div class="nivel-bar-row">
      <div class="nivel-bar-label"><span>🧒 Educación Primaria</span><span>${primariaCount}</span></div>
      <div class="nivel-bar-track"><div class="nivel-bar-fill" style="width:${(primariaCount/maxCount)*100}%;background:var(--accent2)"></div></div>
    </div>
  `;

  const collegeMap = {}; data.colegios.forEach(c => collegeMap[c.id] = c);
  const recent = [...data.asignaciones]
    .sort((a,b) => (b.fecha||'').localeCompare(a.fecha||''))
    .slice(0, 6);

  const list = document.getElementById('recent-list');
  if (!recent.length) {
    list.innerHTML = `<div class="empty-state">Aún no has registrado ningún curso copiado.</div>`;
  } else {
    list.innerHTML = recent.map(a => {
      const col = collegeMap[a.colegioId];
      const curso = cursoMap[a.cursoId];
      return `<div class="recent-item">
        <div>
          <div class="recent-item-main">${esc(col ? col.nombre : '—')} · ${esc(a.anio)}</div>
          <div class="recent-item-sub">${esc(curso ? curso.nombre : '—')} · ${fmtDate(a.fecha)}</div>
        </div>
        <div class="recent-item-clases">${Number(a.clases)||0} clases</div>
      </div>`;
    }).join('');
  }
}

/* ════════════════════════════════════════════════════════════
   COLEGIOS
   ════════════════════════════════════════════════════════════ */
function collegeStats(colegioId) {
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const asigs = data.asignaciones.filter(a => a.colegioId === colegioId);
  const anios = [...new Set(asigs.map(a => a.anio))];
  const niveles = [...new Set(asigs.map(a => (cursoMap[a.cursoId]||{}).nivel).filter(Boolean))];
  const clases = asigs.reduce((s,a) => s + (Number(a.clases)||0), 0);
  return { asigs, anios, niveles, clases };
}

function renderColegios() {
  const filter = (document.getElementById('colegios-filter').value || '').toLowerCase().trim();
  const grid = document.getElementById('colegios-grid');
  const list = data.colegios
    .filter(c => c.nombre.toLowerCase().includes(filter))
    .sort((a,b) => a.nombre.localeCompare(b.nombre));

  const addCard = `<div class="college-card college-card-add" onclick="openCollegeModal(null)">+ Nuevo colegio</div>`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No hay colegios que coincidan con "${esc(filter)}".</div>` + addCard;
    return;
  }

  grid.innerHTML = list.map(c => {
    const s = collegeStats(c.id);
    const badges = s.niveles.map(n => `<span class="badge ${n==='media'?'badge-media':'badge-primaria'}">${n==='media'?'🎓 Media':'🧒 Primaria'}</span>`).join('');
    return `<div class="college-card" onclick="openCollegeDetail('${c.id}')">
      <div class="college-card-icon">🏫</div>
      <div class="college-card-name">${esc(c.nombre)}</div>
      <div class="college-card-meta">
        ${badges || '<span class="badge badge-count">Sin cursos aún</span>'}
        ${s.asigs.length ? `<span class="badge badge-count">${s.asigs.length} curso(s)</span>` : ''}
      </div>
    </div>`;
  }).join('') + addCard;
}

function openCollegeDetail(id) {
  currentCollegeId = id;
  document.getElementById('colegios-directory').style.display = 'none';
  document.getElementById('colegios-detail').style.display = '';
  renderCollegeDetail();
}

function closeCollegeDetail() {
  currentCollegeId = null;
  document.getElementById('colegios-directory').style.display = '';
  document.getElementById('colegios-detail').style.display = 'none';
}

function renderCollegeDetail() {
  const col = data.colegios.find(c => c.id === currentCollegeId);
  if (!col) { closeCollegeDetail(); return; }
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const s = collegeStats(col.id);

  document.getElementById('cd-nombre').textContent = col.nombre;
  document.getElementById('cd-resumen').textContent =
    s.asigs.length ? `${s.anios.length} año(s) registrados · ${s.clases} clases subidas` : 'Sin cursos copiados todavía';

  const badges = s.niveles.map(n => `<span class="badge ${n==='media'?'badge-media':'badge-primaria'}">${NIVEL_LABEL[n]}</span>`).join('');
  document.getElementById('cd-badges').innerHTML = badges || `<span class="badge badge-count">Sin nivel asignado aún</span>`;

  const asigsSorted = [...s.asigs].sort((a,b) => (a.anio||'').localeCompare(b.anio||''));
  const mediaRows = asigsSorted.filter(a => (cursoMap[a.cursoId]||{}).nivel === 'media');
  const primariaRows = asigsSorted.filter(a => (cursoMap[a.cursoId]||{}).nivel === 'primaria');

  document.getElementById('cd-asig-media-title').textContent =
    `🎓 Cursos copiados · Educación Media · ${mediaRows.length} ${mediaRows.length === 1 ? 'curso' : 'cursos'}`;
  document.getElementById('cd-asig-primaria-title').textContent =
    `🧒 Cursos copiados · Educación Primaria · ${primariaRows.length} ${primariaRows.length === 1 ? 'curso' : 'cursos'}`;
  applyAccState('col-cursos-media');
  applyAccState('col-cursos-primaria');

  renderAsigLevelTable(mediaRows, cursoMap, 'cd-asig-media-body', 'cd-asig-media-empty', 'cd-asig-media-wrap');
  renderAsigLevelTable(primariaRows, cursoMap, 'cd-asig-primaria-body', 'cd-asig-primaria-empty', 'cd-asig-primaria-wrap');

  renderCollegeParticipantes(col.id);
}

function renderAsigLevelTable(rows, cursoMap, bodyId, emptyId, wrapId) {
  const body = document.getElementById(bodyId);
  const empty = document.getElementById(emptyId);
  const wrap = document.getElementById(wrapId);
  if (!rows.length) {
    body.innerHTML = '';
    empty.style.display = '';
    wrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display = '';
  body.innerHTML = rows.map(a => {
    const curso = cursoMap[a.cursoId];
    const nivel = curso ? curso.nivel : null;
    return `<tr>
      <td><b>${esc(a.anio)}</b></td>
      <td>${esc(curso ? curso.nombre : '—')}</td>
      <td>${nivel ? `<span class="badge ${nivel==='media'?'badge-media':'badge-primaria'}">${nivel==='media'?'Media':'Primaria'}</span>` : '—'}</td>
      <td>${esc(a.nombreCompleto)}</td>
      <td><code>${esc(a.nombreCorto)}</code></td>
      <td><b>${Number(a.clases)||0}</b></td>
      <td>${fmtDate(a.fecha)}</td>
      <td class="row-actions">
        <button class="icon-btn" title="Editar" onclick="openAsigModal('${a.id}')">✎</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteAsig('${a.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function editCollegeFromDetail() { openCollegeModal(currentCollegeId); }

function openCollegeModal(id) {
  editingCollegeId = id;
  const title = document.getElementById('college-modal-title');
  const input = document.getElementById('cm-name');
  if (id) {
    const c = data.colegios.find(c => c.id === id);
    title.textContent = '✎ Editar colegio';
    input.value = c ? c.nombre : '';
  } else {
    title.textContent = '🏫 Nuevo colegio';
    input.value = '';
  }
  document.getElementById('college-modal').classList.add('active');
  setTimeout(() => input.focus(), 50);
}

function saveCollege() {
  const name = document.getElementById('cm-name').value.trim();
  if (!name) { showToast('Escribe el nombre del colegio'); return; }

  if (editingCollegeId) {
    const c = data.colegios.find(c => c.id === editingCollegeId);
    if (c) c.nombre = name;
    showToast('Colegio actualizado ✓');
  } else {
    data.colegios.push({ id: uid(), nombre: name });
    showToast('Colegio agregado ✓');
  }
  saveData();
  closeModal('college-modal');
  renderColegios();
  if (currentCollegeId) renderCollegeDetail();
  renderDashboard();
  renderGenerador();
}

function deleteCollege(id) {
  const idx = data.colegios.findIndex(c => c.id === id);
  if (idx === -1) return;
  if (!confirm('¿Enviar este colegio a la papelera? Sus cursos copiados no se eliminan, pero quedarán sin colegio visible hasta que lo restaures.')) return;
  const [removed] = data.colegios.splice(idx, 1);
  data.trash.colegios.push(removed);
  saveData();
  closeCollegeDetail();
  renderColegios();
  renderTrash();
  updateTrashBadge();
  renderGenerador();
  showToast('Colegio movido a la papelera');
}

/* ════════════════════════════════════════════════════════════
   CURSOS MODELO
   ════════════════════════════════════════════════════════════ */
function setCursosTab(nivel) {
  cursosTab = nivel;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.nivel === nivel));
  renderCursos();
}

function renderCursos() {
  const body = document.getElementById('cursos-body');
  const cursos = data.cursos.filter(c => c.nivel === cursosTab).sort((a,b) => a.nombre.localeCompare(b.nombre));

  if (!cursos.length) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state">No hay cursos modelo en este nivel todavía.</div></td></tr>`;
    return;
  }

  body.innerHTML = cursos.map(c => {
    const asigs = data.asignaciones.filter(a => a.cursoId === c.id);
    const colegiosCount = new Set(asigs.map(a => a.colegioId)).size;
    const clases = asigs.length ? Math.round(asigs.reduce((s,a) => s + (Number(a.clases)||0),0) / asigs.length * 10)/10 : 0;
    return `<tr>
      <td><b>${esc(c.nombre)}</b></td>
      <td>${colegiosCount} colegio(s)</td>
      <td>${clases}</td>
      <td class="row-actions">
        <button class="icon-btn" title="Editar" onclick="openCursoModal('${c.id}')">✎</button>
        <button class="icon-btn danger" title="Eliminar" onclick="deleteCurso('${c.id}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function openCursoModal(id) {
  editingCursoId = id;
  const title = document.getElementById('curso-modal-title');
  const nameInput = document.getElementById('km-name');
  const nivelSelect = document.getElementById('km-nivel');
  if (id) {
    const c = data.cursos.find(c => c.id === id);
    title.textContent = '✎ Editar curso modelo';
    nameInput.value = c ? c.nombre : '';
    nivelSelect.value = c ? c.nivel : cursosTab;
  } else {
    title.textContent = '⚙️ Nuevo curso modelo';
    nameInput.value = '';
    nivelSelect.value = cursosTab;
  }
  document.getElementById('curso-modal').classList.add('active');
  setTimeout(() => nameInput.focus(), 50);
}

function saveCurso() {
  const name = document.getElementById('km-name').value.trim();
  const nivel = document.getElementById('km-nivel').value;
  if (!name) { showToast('Escribe el nombre del curso modelo'); return; }

  if (editingCursoId) {
    const c = data.cursos.find(c => c.id === editingCursoId);
    if (c) { c.nombre = name; c.nivel = nivel; }
    showToast('Curso modelo actualizado ✓');
  } else {
    data.cursos.push({ id: uid(), nombre: name, nivel });
    showToast('Curso modelo agregado ✓');
  }
  saveData();
  closeModal('curso-modal');
  cursosTab = nivel;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.nivel === nivel));
  renderCursos();
  renderDashboard();
}

function deleteCurso(id) {
  const idx = data.cursos.findIndex(c => c.id === id);
  if (idx === -1) return;
  const enUso = data.asignaciones.some(a => a.cursoId === id);
  if (enUso && !confirm('Este curso modelo tiene copias registradas en uno o más colegios. ¿Eliminarlo de todas formas? (los registros de esos colegios se conservarán)')) return;
  else if (!enUso && !confirm('¿Enviar este curso modelo a la papelera?')) return;
  const [removed] = data.cursos.splice(idx, 1);
  data.trash.cursos.push(removed);
  saveData();
  renderCursos();
  renderTrash();
  updateTrashBadge();
  showToast('Curso modelo movido a la papelera');
}

/* ════════════════════════════════════════════════════════════
   ASIGNACIONES (cursos copiados a un colegio)
   ════════════════════════════════════════════════════════════ */
function fillColegioSelect(selectedId) {
  const sel = document.getElementById('am-colegio');
  const sorted = [...data.colegios].sort((a,b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = sorted.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  if (selectedId) sel.value = selectedId;
}

function fillCursoSelect(selectedId) {
  const sel = document.getElementById('am-curso');
  const media = data.cursos.filter(c => c.nivel === 'media').sort((a,b) => a.nombre.localeCompare(b.nombre));
  const primaria = data.cursos.filter(c => c.nivel === 'primaria').sort((a,b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML =
    `<optgroup label="🎓 Educación Media">${media.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</optgroup>` +
    `<optgroup label="🧒 Educación Primaria">${primaria.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</optgroup>`;
  if (selectedId) sel.value = selectedId;
  onAsigCursoChange();
}

function onAsigCursoChange() {
  const cursoId = document.getElementById('am-curso').value;
  const curso = data.cursos.find(c => c.id === cursoId);
  document.getElementById('am-nivel-display').value = curso ? NIVEL_LABEL[curso.nivel] : '';
}

function openAsigModal(id) {
  editingAsigId = id;
  const title = document.getElementById('asig-modal-title');
  const delBtn = document.getElementById('asig-modal-del-btn');

  if (id) {
    const a = data.asignaciones.find(a => a.id === id);
    title.textContent = '✎ Editar curso copiado';
    delBtn.style.display = '';
    fillColegioSelect(a.colegioId);
    fillCursoSelect(a.cursoId);
    document.getElementById('am-anio').value = a.anio || '';
    document.getElementById('am-fecha').value = a.fecha || todayStr();
    document.getElementById('am-nombre-completo').value = a.nombreCompleto || '';
    document.getElementById('am-nombre-corto').value = a.nombreCorto || '';
    document.getElementById('am-clases').value = a.clases ?? '';
    document.getElementById('am-notas').value = a.notas || '';
  } else {
    title.textContent = '📋 Registrar copia de curso';
    delBtn.style.display = 'none';
    fillColegioSelect(asigPresetCollegeId);
    fillCursoSelect(null);
    document.getElementById('am-anio').value = '';
    document.getElementById('am-fecha').value = todayStr();
    document.getElementById('am-nombre-completo').value = '';
    document.getElementById('am-nombre-corto').value = '';
    document.getElementById('am-clases').value = '';
    document.getElementById('am-notas').value = '';
  }
  asigPresetCollegeId = null;
  document.getElementById('asig-modal').classList.add('active');
}

function openAsigModalForCollege() {
  asigPresetCollegeId = currentCollegeId;
  openAsigModal(null);
}

function suggestNames(force) {
  const anio = document.getElementById('am-anio').value.trim();
  const colegioId = document.getElementById('am-colegio').value;
  const col = data.colegios.find(c => c.id === colegioId);
  if (!anio || !col) { if (force) showToast('Elige el colegio y escribe el año/grado primero'); return; }

  const completoField = document.getElementById('am-nombre-completo');
  const cortoField = document.getElementById('am-nombre-corto');
  if (!force && (completoField.value.trim() || cortoField.value.trim())) return;

  const initials = slugifyInitials(col.nombre);
  completoField.value = `${anio}-${initials}`;

  const num = parseInt(anio.match(/\d+/)?.[0] || '', 10);
  const gradoWord = /grado/i.test(anio) ? 'grade' : 'year';
  const cortoBase = num ? `${ordinalWord(num)}${gradoWord}` : anio.toLowerCase().replace(/\s+/g,'');
  cortoField.value = `${cortoBase}-${initials.toLowerCase()}`;
}

function saveAsig() {
  const colegioId = document.getElementById('am-colegio').value;
  const cursoId = document.getElementById('am-curso').value;
  const anio = document.getElementById('am-anio').value.trim();
  const fecha = document.getElementById('am-fecha').value || todayStr();
  const nombreCompleto = document.getElementById('am-nombre-completo').value.trim();
  const nombreCorto = document.getElementById('am-nombre-corto').value.trim();
  const clases = document.getElementById('am-clases').value;
  const notas = document.getElementById('am-notas').value.trim();

  if (!colegioId) { showToast('Elige un colegio'); return; }
  if (!cursoId) { showToast('Elige un curso modelo'); return; }
  if (!anio) { showToast('Escribe el año o grado'); return; }
  if (!nombreCompleto) { showToast('Escribe el nombre completo del curso'); return; }

  const payload = { colegioId, cursoId, anio, fecha, nombreCompleto, nombreCorto, clases: Number(clases)||0, notas };

  if (editingAsigId) {
    const a = data.asignaciones.find(a => a.id === editingAsigId);
    if (a) Object.assign(a, payload);
    showToast('Curso copiado actualizado ✓');
  } else {
    data.asignaciones.push({ id: uid(), ...payload });
    showToast('Curso copiado registrado ✓');
  }
  saveData();
  closeModal('asig-modal');
  renderDashboard();
  renderColegios();
  renderCursos();
  renderGenerador();
  if (currentCollegeId) renderCollegeDetail();
}

function deleteAsigFromModal() {
  if (!editingAsigId) return;
  deleteAsig(editingAsigId);
  closeModal('asig-modal');
}

function deleteAsig(id) {
  const idx = data.asignaciones.findIndex(a => a.id === id);
  if (idx === -1) return;
  if (!confirm('¿Enviar este registro de curso copiado a la papelera?')) return;
  const [removed] = data.asignaciones.splice(idx, 1);
  data.trash.asignaciones.push(removed);
  saveData();
  renderDashboard();
  renderColegios();
  renderCursos();
  renderGenerador();
  if (currentCollegeId) renderCollegeDetail();
  renderTrash();
  updateTrashBadge();
  showToast('Movido a la papelera');
}

/* ════════════════════════════════════════════════════════════
   GENERADOR DE USUARIOS
   ════════════════════════════════════════════════════════════ */
function renderGenerador() {
  if (!document.getElementById('gen-colegio')) return;
  fillGenColegioSelect(genColegioId);
  onGenColegioChange();
}

function fillGenColegioSelect(selectedId) {
  const sel = document.getElementById('gen-colegio');
  const sorted = [...data.colegios].sort((a,b) => a.nombre.localeCompare(b.nombre));
  sel.innerHTML = sorted.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  if (selectedId && sorted.some(c => c.id === selectedId)) sel.value = selectedId;
  genColegioId = sel.value || null;
}

function fillGenAnioSelect(colegioId, selectedAnio) {
  const sel = document.getElementById('gen-anio');
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const asigsCollege = data.asignaciones.filter(a => a.colegioId === colegioId);
  const anios = [...new Set(asigsCollege.map(a => a.anio))];

  if (!anios.length) {
    sel.innerHTML = `<option value="">Sin años asignados</option>`;
    sel.disabled = true;
    genAnioSel = null;
    return;
  }

  const nivelOf = anio => {
    const a = asigsCollege.find(x => x.anio === anio);
    if (!a) return null;
    return _normNivelStr((cursoMap[a.cursoId] || {}).nivel) || nivelDeAnio(a.anio);
  };
  const media = anios.filter(a => nivelOf(a) === 'media').sort((a,b) => extractAnioNum(a) - extractAnioNum(b));
  const primaria = anios.filter(a => nivelOf(a) === 'primaria').sort((a,b) => extractAnioNum(b) - extractAnioNum(a));
  const otros = anios.filter(a => !['media','primaria'].includes(nivelOf(a))).sort((a,b) => (a||'').localeCompare(b||''));
  const ordered = [...media, ...primaria, ...otros];

  const optgroupHTML = (label, arr) => arr.length
    ? `<optgroup label="${label}">${arr.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</optgroup>`
    : '';
  sel.disabled = false;
  sel.innerHTML =
    optgroupHTML('🎓 Educación Media', media) +
    optgroupHTML('🧒 Educación Primaria', primaria) +
    otros.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  if (selectedAnio && ordered.includes(selectedAnio)) sel.value = selectedAnio;
  genAnioSel = sel.value || null;
}

function onGenColegioChange() {
  genColegioId = document.getElementById('gen-colegio').value || null;
  hideGenPreview();
  fillGenAnioSelect(genColegioId, genAnioSel);
  onGenAnioChange();
  renderGenYearsSummary();
}

function onGenAnioChange() {
  genAnioSel = document.getElementById('gen-anio').value || null;
  hideGenPreview();
  const infoBox = document.getElementById('gen-asig-info');
  genAsig = null;
  if (genColegioId && genAnioSel) {
    genAsig = data.asignaciones.find(a => a.colegioId === genColegioId && a.anio === genAnioSel) || null;
  }
  if (genAsig) {
    const curso = data.cursos.find(c => c.id === genAsig.cursoId);
    document.getElementById('gen-info-curso').value = curso ? curso.nombre : '—';
    document.getElementById('gen-info-corto').value = genAsig.nombreCorto || '—';
    document.getElementById('gen-info-nivel').value = curso ? NIVEL_LABEL[curso.nivel] : '—';
    infoBox.style.display = '';
  } else {
    infoBox.style.display = 'none';
  }
}

function showGenError(msg) {
  const box = document.getElementById('gen-error');
  box.textContent = msg;
  box.style.display = '';
}
function hideGenError() {
  document.getElementById('gen-error').style.display = 'none';
}

function hideGenPreview() {
  if (genModoAgregar) {
    genModoAgregar = false;
    genModoAgregarExistentes = [];
    const selColegio = document.getElementById('gen-colegio');
    const selAnio = document.getElementById('gen-anio');
    const selGrupo = document.getElementById('gen-grupo');
    if (selColegio) selColegio.disabled = false;
    if (selAnio) selAnio.disabled = false;
    if (selGrupo) selGrupo.disabled = false;
    const banner = document.getElementById('gen-modo-agregar-banner');
    if (banner) banner.style.display = 'none';
    const counter = document.getElementById('gen-modo-contador');
    if (counter) counter.style.display = 'none';
  }
  genPreviewRows = [];
  genPreviewCtx = null;
  genPreviewSaved = false;
  genEliminarCtx = null;
  const csvNuevosBtn = document.getElementById('gen-csv-nuevos-btn');
  if (csvNuevosBtn) csvNuevosBtn.style.display = 'none';
  document.getElementById('gen-preview-card').style.display = 'none';
  hideGenError();
}

function salirModoAgregar() {
  document.getElementById('gen-apellidos').value = '';
  document.getElementById('gen-nombres').value = '';
  hideGenPreview();
}

function _entrarModoAgregar() {
  genModoAgregar = true;
  genModoAgregarExistentes = genPreviewRows.map(r => ({ ...r }));

  document.getElementById('gen-colegio').disabled = true;
  document.getElementById('gen-anio').disabled = true;
  document.getElementById('gen-grupo').disabled = true;

  if (genPreviewRows.length) {
    const first = genPreviewRows[0];
    document.getElementById('gen-password').value = first.password || '1234';
    document.getElementById('gen-ciudad').value = first.city || '';
    document.getElementById('gen-grupo').value = genPreviewCtx.group1 || '';
  }

  const apLines = genModoAgregarExistentes.map(r => r.lastname || '');
  const noLines = genModoAgregarExistentes.map(r =>
    (r.username && r.firstname.startsWith(r.username + ' '))
      ? r.firstname.slice(r.username.length + 1)
      : (r.firstname || '')
  );
  document.getElementById('gen-apellidos').value = apLines.join('\n');
  document.getElementById('gen-nombres').value = noLines.join('\n');

  const col = data.colegios.find(c => c.id === genPreviewCtx.colegioId);
  const n = genModoAgregarExistentes.length;
  let info = `Modo agregar: ${genPreviewCtx.anio}`;
  if (genPreviewCtx.group1) info += ` · Grupo ${genPreviewCtx.group1}`;
  if (col) info += ` · ${col.nombre}`;
  info += ` · ${n} estudiante${n !== 1 ? 's' : ''} existente${n !== 1 ? 's' : ''}.`;
  info += ' Escribe debajo los apellidos y nombres de los nuevos.';
  document.getElementById('gen-modo-agregar-info').textContent = info;
  document.getElementById('gen-modo-agregar-banner').style.display = '';

  const counter = document.getElementById('gen-modo-contador');
  counter.style.display = '';
  actualizarContadorModoAgregar();

  const tieneNuevosYaGuardados = genPreviewRows.some(r => r.esNuevo);
  document.getElementById('gen-csv-nuevos-btn').style.display = tieneNuevosYaGuardados ? '' : 'none';
}

function actualizarContadorModoAgregar() {
  const counter = document.getElementById('gen-modo-contador');
  if (!counter || !genModoAgregar) return;

  const apLines = parseLines(document.getElementById('gen-apellidos').value);
  const noLines = parseLines(document.getElementById('gen-nombres').value);
  while (apLines.length && !apLines[apLines.length - 1]) apLines.pop();
  while (noLines.length && !noLines[noLines.length - 1]) noLines.pop();
  const maxLen = Math.max(apLines.length, noLines.length);

  if (!maxLen) { counter.textContent = ''; return; }

  const existentesSet = new Set(
    genModoAgregarExistentes.map(r => {
      const nombres = (r.username && r.firstname.startsWith(r.username + ' '))
        ? r.firstname.slice(r.username.length + 1) : (r.firstname || '');
      return normalize(r.lastname || '') + '||' + normalize(nombres);
    })
  );

  let countEx = 0, countNu = 0;
  for (let i = 0; i < maxLen; i++) {
    const ap = (apLines[i] || '').trim();
    const no = (noLines[i] || '').trim();
    if (!ap && !no) continue;
    const key = normalize(ap) + '||' + normalize(no);
    if (existentesSet.has(key)) countEx++;
    else countNu++;
  }
  counter.textContent = `${countEx} existente${countEx !== 1 ? 's' : ''} · ${countNu} nuevo${countNu !== 1 ? 's' : ''}`;
}

function onGenTextareaInput() {
  if (genModoAgregar) actualizarContadorModoAgregar();
}

function calcularRangos(rows) {
  if (!rows.length) return '';
  const sorted = [...rows].sort((a, b) => a.username.localeCompare(b.username));
  if (sorted.length === 1) return sorted[0].username;
  const withP = sorted.map(r => ({ u: r.username, p: parseUsername(r.username) }));
  if (!withP.every(x => x.p)) return `${sorted[0].username} – ${sorted[sorted.length - 1].username}`;
  const prefix0 = withP[0].p.prefix.toLowerCase();
  if (!withP.every(x => x.p.prefix.toLowerCase() === prefix0)) {
    return `${sorted[0].username} – ${sorted[sorted.length - 1].username}`;
  }
  const byNum = [...withP].sort((a, b) => a.p.num - b.p.num);
  const segs = []; let segStart = 0;
  for (let i = 1; i <= byNum.length; i++) {
    if (i === byNum.length || byNum[i].p.num !== byNum[i - 1].p.num + 1) {
      segs.push({ from: byNum[segStart].u, to: byNum[i - 1].u });
      segStart = i;
    }
  }
  if (segs.length === 1) return `${segs[0].from} – ${segs[0].to}`;
  return segs.map(s => s.from === s.to ? s.from : `${s.from}–${s.to}`).join(', ');
}

function descargarCSVNuevos() {
  const nuevos = genPreviewRows.filter(r => r.esNuevo);
  if (!nuevos.length) { showToast('No hay estudiantes nuevos en esta vista'); return; }
  const csv = buildUsuariosCSV(nuevos);
  const anio = genPreviewCtx ? genPreviewCtx.anio : (genAnioSel || '');
  const grupo = genPreviewCtx ? (genPreviewCtx.group1 || '') : '';
  let nombre = (anio).toLocaleLowerCase('es');
  if (grupo) nombre += ` ${grupo}`;
  nombre += '_nuevos';
  nombre = nombre.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  downloadFile(csv, `${nombre}.csv`, 'text/csv;charset=utf-8;');
  showToast('CSV de nuevos descargado ✓');
}

function parseLines(text) {
  return String(text || '').split(/\r?\n/).map(l => l.trim());
}

function generarListaUsuarios() {
  hideGenError();
  if (!genColegioId) { showGenError('Elige un colegio.'); return; }
  if (!genAsig) { showGenError('Elige un año/grado con curso asignado para este colegio.'); return; }

  const nombreCorto = genAsig.nombreCorto || '';
  const lastDash = nombreCorto.lastIndexOf('-');
  if (lastDash === -1 || lastDash === nombreCorto.length - 1) {
    showGenError('Este curso no tiene un nombre corto válido para generar usuarios.');
    return;
  }
  const prefix = nombreCorto.slice(lastDash + 1);

  if (genModoAgregar) { _generarListaEnModoAgregar(prefix); return; }

  const apLines = parseLines(document.getElementById('gen-apellidos').value);
  const noLines = parseLines(document.getElementById('gen-nombres').value);
  while (apLines.length && apLines[apLines.length - 1] === '') apLines.pop();
  while (noLines.length && noLines[noLines.length - 1] === '') noLines.pop();

  const maxLen = Math.max(apLines.length, noLines.length);
  if (!maxLen) { showGenError('Escribe al menos un estudiante en Apellidos y Nombres.'); return; }
  for (let i = 0; i < maxLen; i++) {
    if (!apLines[i] || !noLines[i]) {
      showGenError(`Las cajas de Apellidos y Nombres no coinciden en la línea ${i + 1}.`);
      return;
    }
  }

  const password = document.getElementById('gen-password').value.trim() || '1234';
  const city = document.getElementById('gen-ciudad').value.trim();
  const group1 = document.getElementById('gen-grupo').value.trim();

  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const curso = cursoMap[genAsig.cursoId];
  const nivel = curso ? curso.nivel : 'media';
  const digits = nivel === 'primaria' ? 3 : 4;

  let maxNum = 0;
  data.participantes
    .filter(p => p.colegioId === genColegioId)
    .forEach(p => {
      const pNivel = nivelDe(p, cursoMap);
      if (pNivel !== nivel) return;
      const parsed = parseUsername(p.username);
      if (parsed && parsed.prefix.toLowerCase() === prefix.toLowerCase()) {
        maxNum = Math.max(maxNum, parsed.num);
      }
    });
  const start = maxNum + 1;

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const num = String(start + i).padStart(digits, '0');
    const username = prefix + num;
    const nombres = noLines[i];
    rows.push({
      username, password,
      firstname: `${username} ${nombres}`,
      lastname: apLines[i],
      email: `${username}@${ACADEMIA_ACTUAL.emailDominio}`,
      city, country: 'Venezuela',
      course1: nombreCorto,
      group1, role1: 'student', enrolperiod1: '365d', suspended: '0'
    });
  }

  genPreviewRows = rows;
  genPreviewCtx = { colegioId: genColegioId, cursoId: genAsig.cursoId, anio: genAnioSel, nivel, group1 };
  genPreviewSaved = false;
  renderGenPreviewTable();
  document.getElementById('gen-preview-card').style.display = '';
}

function onImportCSVClick() {
  hideGenError();
  if (!genColegioId) { showGenError('Elige un colegio.'); return; }
  if (!genAsig) { showGenError('Elige un año/grado con curso asignado para este colegio.'); return; }
  document.getElementById('gen-import-file').click();
}

function importarCSVArchivo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let text = String(reader.result || '');
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const table = parseCSV(text).filter(r => r.length && r.some(v => (v||'').trim() !== ''));
      if (table.length < 2) throw new Error('CSV vacío o sin filas de datos');

      const header = table[0].map(h => String(h||'').trim().toLowerCase());
      const idxFirst = header.indexOf('first name');
      const idxLast = header.indexOf('last name');
      const idxEmail = header.indexOf('email address');
      const idxGroups = header.indexOf('groups');
      if (idxFirst === -1 || idxLast === -1) throw new Error('No se reconocen las columnas "First name" / "Last name"');

      const password = document.getElementById('gen-password').value.trim() || '1234';
      const city = document.getElementById('gen-ciudad').value.trim();
      const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
      const curso = cursoMap[genAsig.cursoId];
      const nivel = curso ? curso.nivel : 'primaria';
      const conservar = ACADEMIA_ACTUAL.importarCSVConservarDatos === true;

      const rows = [];
      for (let i = 1; i < table.length; i++) {
        const cols = table[i];
        const firstRaw = (cols[idxFirst] || '').trim();
        const lastRaw = (cols[idxLast] || '').trim();
        const emailRaw = (cols[idxEmail] !== undefined ? cols[idxEmail] : '').trim();
        const groupRaw = idxGroups !== -1 ? (cols[idxGroups] || '').trim() : '';
        if (!firstRaw && !lastRaw) continue;

        const spaceIdx = firstRaw.indexOf(' ');
        let username = spaceIdx === -1 ? firstRaw : firstRaw.slice(0, spaceIdx);
        // conservar=true: preservar literal (incluye tabulaciones internas); conservar=false: trim normal
        const nombres = spaceIdx === -1 ? '' : (conservar ? firstRaw.slice(spaceIdx + 1) : firstRaw.slice(spaceIdx + 1).trim());

        if (!/^([a-zA-Z]+)(\d+)$/.test(username)) {
          const atIdx = emailRaw.indexOf('@');
          if (atIdx !== -1) username = emailRaw.slice(0, atIdx);
        }
        username = username.trim();
        if (!username) continue;

        rows.push({
          username, password,
          firstname: nombres ? `${username} ${nombres}` : username,
          lastname: lastRaw,
          // conservar=true: email del CSV tal cual (correos externos válidos); conservar=false: recalcular con emailDominio
          email: conservar ? emailRaw : `${username}@${ACADEMIA_ACTUAL.emailDominio}`,
          city, country: 'Venezuela',
          course1: genAsig.nombreCorto,
          group1: groupRaw, role1: 'student', enrolperiod1: '365d', suspended: '0'
        });
      }

      if (!rows.length) throw new Error('No se encontraron filas válidas en el archivo');

      genPreviewRows = rows;
      genPreviewCtx = { colegioId: genColegioId, cursoId: genAsig.cursoId, anio: genAnioSel, nivel, group1: '' };
      genPreviewSaved = false;
      renderGenPreviewTable();
      document.getElementById('gen-preview-card').style.display = '';
      showToast(`CSV importado: ${rows.length} estudiante(s) ✓`);
    } catch (e) {
      console.error(e);
      showGenError('No se pudo importar el archivo. Verifica que sea el CSV exportado de la otra plataforma.');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function renderGenPreviewTable() {
  const body = document.getElementById('gen-preview-body');
  body.innerHTML = genPreviewRows.map((r, i) => {
    const esNuevo = r.esNuevo === true;
    const rowClass = esNuevo ? ' class="gen-row-nuevo"' : '';
    return `<tr${rowClass}>` + GEN_COLS.map(col => {
      const id = `gp-${col}-${i}`;
      const handler = col === 'username'
        ? `onchange="onGenUsernameEdit(${i}, this.value)"`
        : `oninput="onGenFieldEdit(${i}, '${col}', this.value)"`;
      let cellHtml = `<input class="table-input" id="${id}" value="${esc(r[col])}" ${handler}>`;
      if (col === 'username' && esNuevo) {
        cellHtml = `<span class="badge-nuevo" aria-label="Estudiante nuevo">Nuevo</span>${cellHtml}`;
      }
      return `<td>${cellHtml}</td>`;
    }).join('') + `<td class="row-actions"><button class="icon-btn danger" title="Eliminar estudiante" onclick="abrirEliminarEstudiante(${i})">🗑</button></td></tr>`;
  }).join('');
  renderGenPreviewTitle();
  applyAccState('gen-editor');
}

function renderGenPreviewTitle() {
  const el = document.getElementById('gen-preview-title');
  if (!el) return;
  if (!genPreviewCtx) { el.textContent = 'Vista previa (editable)'; return; }
  const col = data.colegios.find(c => c.id === genPreviewCtx.colegioId);
  const partes = [col ? col.nombre : '(colegio eliminado)', genPreviewCtx.anio];
  if (genPreviewCtx.group1) partes.push('Grupo ' + genPreviewCtx.group1);
  if (genModoAgregar) {
    const nEx = genPreviewRows.filter(r => !r.esNuevo).length;
    const nNuevo = genPreviewRows.filter(r => r.esNuevo).length;
    partes.push(`${nEx} existente${nEx !== 1 ? 's' : ''}`);
    if (nNuevo) partes.push(`${nNuevo} nuevo${nNuevo !== 1 ? 's' : ''}`);
  } else {
    partes.push(`${genPreviewRows.length} estudiante${genPreviewRows.length === 1 ? '' : 's'}`);
  }
  el.textContent = partes.join(' · ');
}

function onGenFieldEdit(i, field, value) {
  if (!genPreviewRows[i]) return;
  genPreviewRows[i][field] = value;
}

function onGenUsernameEdit(i, value) {
  const row = genPreviewRows[i];
  if (!row) return;
  const oldUsername = row.username;
  let namePart = row.firstname;
  if (oldUsername && row.firstname.startsWith(oldUsername + ' ')) {
    namePart = row.firstname.slice(oldUsername.length + 1);
  }
  const newUsername = value.trim();
  row.username = newUsername;
  row.firstname = namePart ? `${newUsername} ${namePart}` : newUsername;
  row.email = `${newUsername}@${ACADEMIA_ACTUAL.emailDominio}`;
  const fnInput = document.getElementById(`gp-firstname-${i}`);
  const emInput = document.getElementById(`gp-email-${i}`);
  if (fnInput) fnInput.value = row.firstname;
  if (emInput) emInput.value = row.email;
}

function _generarListaEnModoAgregar(prefix) {
  const apLines = parseLines(document.getElementById('gen-apellidos').value);
  const noLines = parseLines(document.getElementById('gen-nombres').value);
  while (apLines.length && apLines[apLines.length - 1] === '') apLines.pop();
  while (noLines.length && noLines[noLines.length - 1] === '') noLines.pop();

  const maxLen = Math.max(apLines.length, noLines.length);
  if (!maxLen) { showGenError('Escribe al menos un estudiante en Apellidos y Nombres.'); return; }
  for (let i = 0; i < maxLen; i++) {
    if (!apLines[i] || !noLines[i]) {
      showGenError(`Las cajas de Apellidos y Nombres no coinciden en la línea ${i + 1}.`);
      return;
    }
  }

  const existentesSet = new Set(
    genModoAgregarExistentes.map(r => {
      const nombres = (r.username && r.firstname.startsWith(r.username + ' '))
        ? r.firstname.slice(r.username.length + 1) : (r.firstname || '');
      return normalize(r.lastname || '') + '||' + normalize(nombres);
    })
  );

  const nuevosAp = [], nuevosNo = [];
  let countEx = 0;
  for (let i = 0; i < maxLen; i++) {
    const ap = apLines[i].trim();
    const no = noLines[i].trim();
    const key = normalize(ap) + '||' + normalize(no);
    if (existentesSet.has(key)) { countEx++; }
    else { nuevosAp.push(ap); nuevosNo.push(no); }
  }

  if (!nuevosAp.length) {
    const aviso = countEx > 0
      ? `No hay estudiantes nuevos (${countEx} de las ${maxLen} líneas ya están en la lista).`
      : 'No hay estudiantes nuevos que generar.';
    showGenError(aviso);
    return;
  }

  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const curso = cursoMap[genAsig.cursoId];
  const nivel = curso ? curso.nivel : 'media';
  const digits = nivel === 'primaria' ? 3 : 4;

  let maxNum = 0;
  data.participantes
    .filter(p => p.colegioId === genColegioId)
    .forEach(p => {
      const pNivel = nivelDe(p, cursoMap);
      if (pNivel !== nivel) return;
      const parsed = parseUsername(p.username);
      if (parsed && parsed.prefix.toLowerCase() === prefix.toLowerCase()) {
        maxNum = Math.max(maxNum, parsed.num);
      }
    });
  const start = maxNum + 1;

  const password = document.getElementById('gen-password').value.trim() || '1234';
  const city = document.getElementById('gen-ciudad').value.trim();
  const { group1, colegioId, cursoId, anio } = genPreviewCtx;
  const nombreCorto = genAsig.nombreCorto;

  const nuevasFilas = [];
  for (let i = 0; i < nuevosAp.length; i++) {
    const num = String(start + i).padStart(digits, '0');
    const username = prefix + num;
    nuevasFilas.push({
      username, password,
      firstname: `${username} ${nuevosNo[i]}`,
      lastname: nuevosAp[i],
      email: `${username}@${ACADEMIA_ACTUAL.emailDominio}`,
      city, country: 'Venezuela',
      course1: nombreCorto,
      group1, role1: 'student', enrolperiod1: '365d', suspended: '0',
      esNuevo: true
    });
  }

  genPreviewRows = [...genModoAgregarExistentes, ...nuevasFilas];
  genPreviewCtx = { colegioId, cursoId, anio, nivel, group1 };

  renderGenPreviewTable();
  renderGenPreviewTitle();
  document.getElementById('gen-preview-card').style.display = '';
  const n = nuevasFilas.length;
  showToast(`${countEx} existente${countEx !== 1 ? 's' : ''} · ${n} nuevo${n !== 1 ? 's' : ''} generado${n !== 1 ? 's' : ''} ✓`);
  hideGenError();
}

function _guardarListaEnModoAgregar() {
  const nuevos = genPreviewRows.filter(r => r.esNuevo);
  if (!nuevos.length) { showToast('No hay estudiantes nuevos que agregar'); return; }
  const { colegioId, cursoId, anio, nivel } = genPreviewCtx;
  const fecha = todayStr();
  const agregadoEn = new Date().toISOString();
  nuevos.forEach(r => {
    let nombres = r.firstname;
    if (r.username && r.firstname.startsWith(r.username + ' ')) nombres = r.firstname.slice(r.username.length + 1);
    data.participantes.push({
      id: uid(), colegioId, cursoId, anio, nivel,
      username: r.username, password: r.password,
      nombres, apellidos: r.lastname,
      email: r.email, city: r.city, country: r.country,
      course1: r.course1, group1: r.group1, role1: r.role1,
      enrolperiod1: r.enrolperiod1, suspended: r.suspended,
      fecha, agregadoEn
    });
  });
  saveData();
  genPreviewSaved = true;
  const n = nuevos.length;
  showToast(`${n} estudiante${n !== 1 ? 's' : ''} nuevo${n !== 1 ? 's' : ''} agregado${n !== 1 ? 's' : ''} ✓`);
  renderGenYearsSummary();
  renderGenPreviewTitle();
  if (currentCollegeId === colegioId) renderCollegeParticipantes(colegioId);
  document.getElementById('gen-csv-nuevos-btn').style.display = '';
}

function guardarListaUsuarios() {
  if (!genPreviewRows.length || !genPreviewCtx) { showToast('Genera una lista primero'); return; }

  if (genModoAgregar) { _guardarListaEnModoAgregar(); return; }

  const { colegioId, cursoId, anio, nivel } = genPreviewCtx;

  const gruposPresentes = [...new Set(genPreviewRows.map(r => r.group1 || ''))];
  const existentesPorGrupo = {};
  gruposPresentes.forEach(g => {
    existentesPorGrupo[g] = data.participantes.filter(p =>
      p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && (p.group1||'') === g);
  });
  const conflictos = gruposPresentes.filter(g => existentesPorGrupo[g].length);
  if (conflictos.length) {
    const grupoTxt = conflictos.map(g => g ? `"${g}"` : '(sin grupo)').join(', ');
    if (!confirm(`¿Reemplazar la lista ya generada para este año en el/los grupo(s) ${grupoTxt}?`)) return;
  }
  // La(s) versión(es) que se pisan van a la Papelera antes de reemplazar.
  conflictos.forEach(g => {
    data.trash.participantes.push({
      id: uid(), colegioId, cursoId, anio, grupo: g,
      fechaEliminacion: todayStr(), estudiantes: existentesPorGrupo[g]
    });
  });
  data.participantes = data.participantes.filter(p =>
    !(p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && gruposPresentes.includes(p.group1||'')));

  const fecha = todayStr();
  genPreviewRows.forEach(r => {
    let nombres = r.firstname;
    if (r.username && r.firstname.startsWith(r.username + ' ')) {
      nombres = r.firstname.slice(r.username.length + 1);
    }
    data.participantes.push({
      id: uid(), colegioId, cursoId, anio, nivel,
      username: r.username, password: r.password,
      nombres, apellidos: r.lastname,
      email: r.email, city: r.city, country: r.country,
      course1: r.course1, group1: r.group1, role1: r.role1,
      enrolperiod1: r.enrolperiod1, suspended: r.suspended,
      fecha
    });
  });
  saveData();
  genPreviewSaved = true;
  showToast('Lista guardada ✓');
  renderGenYearsSummary();
  renderGenPreviewTitle();
  if (conflictos.length) { renderTrash(); updateTrashBadge(); }
  if (currentCollegeId === colegioId) renderCollegeParticipantes(colegioId);
}

function buildUsuariosCSV(rows) {
  const header = 'username,password,firstname,lastname,email,city,country,course1,group1,role1,enrolperiod1,suspended';
  const lines = rows.map(r => GEN_COLS.map(c => r[c] ?? '').join(','));
  return [header, ...lines].join('\n');
}

function slugify(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

// nombreArchivoDescarga('5to Año', 'A', 'csv') -> '5to año A.csv'
function nombreArchivoDescarga(anio, grupo, extension) {
  let nombre = (anio || '').toLocaleLowerCase('es');
  if (grupo) nombre = `${nombre} ${grupo}`;
  nombre = nombre.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  if (!nombre) nombre = extension === 'xlsx' ? 'participantes' : 'usuarios';
  return `${nombre}.${extension}`;
}

function descargarCSVPreview() {
  if (!genPreviewRows.length) return;
  const csv = buildUsuariosCSV(genPreviewRows);
  const filename = nombreArchivoDescarga(genPreviewCtx ? genPreviewCtx.anio : genAnioSel, genPreviewCtx ? genPreviewCtx.group1 : '', 'csv');
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  showToast('CSV descargado ✓');
}

function renderGenYearsSummary() {
  const noneCard = document.getElementById('gen-years-empty-card');
  const mediaCard = document.getElementById('gen-years-media-card');
  const primariaCard = document.getElementById('gen-years-primaria-card');

  const showNone = () => {
    noneCard.style.display = '';
    mediaCard.style.display = 'none';
    primariaCard.style.display = 'none';
  };

  if (!genColegioId) { showNone(); return; }

  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const mine = data.participantes.filter(p => p.colegioId === genColegioId);
  const groupsMap = {};
  mine.forEach(p => {
    const grupoKey = p.group1 || '';
    const key = (p.anio||'') + ' ' + grupoKey;
    if (!groupsMap[key]) groupsMap[key] = { anio: p.anio, grupo: grupoKey, cursoId: p.cursoId, rows: [] };
    groupsMap[key].rows.push(p);
  });
  const groups = Object.values(groupsMap);

  if (!groups.length) { showNone(); return; }

  noneCard.style.display = 'none';
  mediaCard.style.display = '';
  primariaCard.style.display = '';

  const nivelOf = g => nivelDe(g.rows[0] || {}, cursoMap);
  const sortLevel = arr => arr.sort((a,b) =>
    extractAnioNum(b.anio) - extractAnioNum(a.anio) || (a.grupo||'').localeCompare(b.grupo||''));
  const mediaGroups = sortLevel(groups.filter(g => nivelOf(g) === 'media'));
  const primariaGroups = sortLevel(groups.filter(g => nivelOf(g) === 'primaria'));

  document.getElementById('gen-years-media-title').textContent =
    `🎓 Educación Media · ${mediaGroups.length} ${mediaGroups.length === 1 ? 'lista' : 'listas'}`;
  document.getElementById('gen-years-primaria-title').textContent =
    `🧒 Educación Primaria · ${primariaGroups.length} ${primariaGroups.length === 1 ? 'lista' : 'listas'}`;
  applyAccState('gen-media');
  applyAccState('gen-primaria');

  renderGenYearsLevelTable(mediaGroups, 'gen-years-media-body', 'gen-years-media-empty', 'gen-years-media-wrap');
  renderGenYearsLevelTable(primariaGroups, 'gen-years-primaria-body', 'gen-years-primaria-empty', 'gen-years-primaria-wrap');
}

function renderGenYearsLevelTable(groups, bodyId, emptyId, wrapId) {
  const body = document.getElementById(bodyId);
  const empty = document.getElementById(emptyId);
  const wrap = document.getElementById(wrapId);
  if (!groups.length) {
    body.innerHTML = '';
    empty.style.display = '';
    wrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  wrap.style.display = '';
  body.innerHTML = groups.map(g => {
    const rows = [...g.rows].sort((a,b) => a.username.localeCompare(b.username));
    const rango = calcularRangos(rows);
    return `<tr>
      <td><b>${esc(g.anio)}</b></td>
      <td>${esc(g.grupo || '—')}</td>
      <td>${rows.length}</td>
      <td><code title="${esc(rango)}">${esc(rango)}</code></td>
      <td class="row-actions">
        <button class="btn btn-ghost" data-anio="${esc(g.anio)}" data-grupo="${esc(g.grupo)}" onclick="verEditarGenYear(this.dataset.anio, this.dataset.grupo)" aria-label="Ver y editar lista para agregar estudiantes">Ver/Editar</button>
        <button class="btn btn-ghost" data-anio="${esc(g.anio)}" data-grupo="${esc(g.grupo)}" onclick="descargarCSVGenYear(this.dataset.anio, this.dataset.grupo)">⬇ CSV</button>
        <button class="btn btn-ghost" data-anio="${esc(g.anio)}" data-grupo="${esc(g.grupo)}" onclick="eliminarGenLista(this.dataset.anio, this.dataset.grupo)">🗑 Eliminar</button>
      </td>
    </tr>`;
  }).join('');
}

function verEditarGenYear(anio, grupo) {
  grupo = grupo || '';
  const rows = data.participantes.filter(p => p.colegioId === genColegioId && p.anio === anio && (p.group1||'') === grupo)
    .sort((a,b) => a.username.localeCompare(b.username));
  if (!rows.length) return;

  document.getElementById('gen-anio').value = anio;
  onGenAnioChange();
  if (!genAsig) { showToast('No se encontró la asignación de este año'); return; }

  genPreviewRows = rows.map(p => ({
    username: p.username, password: p.password,
    firstname: `${p.username} ${p.nombres}`,
    lastname: p.apellidos, email: p.email,
    city: p.city, country: p.country, course1: p.course1,
    group1: p.group1, role1: p.role1, enrolperiod1: p.enrolperiod1, suspended: p.suspended,
    esNuevo: !!p.agregadoEn
  }));
  const cursoIdCtx = rows[0].cursoId || genAsig.cursoId;
  const nivelCtx = rows[0].nivel || (data.cursos.find(c => c.id === cursoIdCtx) || {}).nivel;
  genPreviewCtx = { colegioId: genColegioId, cursoId: cursoIdCtx, anio, nivel: nivelCtx, group1: grupo };
  genPreviewSaved = true;
  renderGenPreviewTable();
  const card = document.getElementById('gen-preview-card');
  card.style.display = '';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  _entrarModoAgregar();
}

function descargarCSVGenYear(anio, grupo) {
  grupo = grupo || '';
  const rows = data.participantes.filter(p => p.colegioId === genColegioId && p.anio === anio && (p.group1||'') === grupo);
  if (!rows.length) return;
  const csvRows = rows.map(p => ({
    username: p.username, password: p.password,
    firstname: `${p.username} ${p.nombres}`, lastname: p.apellidos,
    email: p.email, city: p.city, country: p.country, course1: p.course1,
    group1: p.group1, role1: p.role1, enrolperiod1: p.enrolperiod1, suspended: p.suspended
  }));
  const csv = buildUsuariosCSV(csvRows);
  downloadFile(csv, nombreArchivoDescarga(anio, grupo, 'csv'), 'text/csv;charset=utf-8;');
  showToast('CSV descargado ✓');
}

function eliminarGenLista(anio, grupo) {
  grupo = grupo || '';
  const rows = data.participantes.filter(p => p.colegioId === genColegioId && p.anio === anio && (p.group1||'') === grupo);
  if (!rows.length) return;
  const grupoTxt = grupo ? ` ${grupo}` : '';
  if (!confirm(`¿Eliminar la lista de ${anio}${grupoTxt}? Esto moverá ${rows.length} estudiantes a la Papelera.`)) return;

  data.trash.participantes.push({
    id: uid(),
    colegioId: genColegioId,
    cursoId: rows[0].cursoId,
    anio,
    grupo,
    fechaEliminacion: todayStr(),
    estudiantes: rows
  });
  data.participantes = data.participantes.filter(p => !(p.colegioId === genColegioId && p.anio === anio && (p.group1||'') === grupo));
  saveData();
  if (genModoAgregar && genPreviewCtx && genPreviewCtx.anio === anio && (genPreviewCtx.group1 || '') === grupo) {
    document.getElementById('gen-apellidos').value = '';
    document.getElementById('gen-nombres').value = '';
    hideGenPreview();
    showToast('Lista movida a la papelera. Se salió del modo agregar.');
  } else {
    showToast('Lista movida a la papelera');
  }
  renderGenYearsSummary();
  if (currentCollegeId === genColegioId) renderCollegeParticipantes(genColegioId);
  renderTrash();
  updateTrashBadge();
}

/* ── Eliminar un estudiante individual desde Ver/Editar (§2.2) ── */
function abrirEliminarEstudiante(i) {
  const row = genPreviewRows[i];
  if (!row || !genPreviewCtx) return;
  genEliminarCtx = { index: i };

  const nombres = (row.username && row.firstname.startsWith(row.username + ' '))
    ? row.firstname.slice(row.username.length + 1)
    : row.firstname;
  document.getElementById('del-est-info').textContent = `Usuario: ${row.username} — ${row.lastname} ${nombres}`;

  document.getElementById('del-est-conservar').checked = true;
  const digits = genPreviewCtx.nivel === 'primaria' ? 3 : 4;

  const parsed = parseUsername(row.username);
  let resultado;
  if (!parsed) {
    resultado = { posible: false, motivo: 'Este estudiante no tiene un usuario con el formato letras+números.', cambios: [] };
  } else {
    const prefix = parsed.prefix.toLowerCase();
    const enEstaLista = new Set(genPreviewRows.map(r => String(r.username).toLowerCase()));
    const ocupados = data.participantes
      .filter(p => p.colegioId === genPreviewCtx.colegioId && !enEstaLista.has(String(p.username).toLowerCase()))
      .map(p => p.username)
      .filter(u => { const pu = parseUsername(u); return pu && pu.prefix.toLowerCase() === prefix; });
    resultado = calcularReestructura(genPreviewRows, row.username, digits, ocupados);
  }
  genEliminarCtx.resultado = resultado;

  const reestructurarRadio = document.getElementById('del-est-reestructurar');
  const reasonBox = document.getElementById('del-est-disabled-reason');
  reestructurarRadio.disabled = !resultado.posible;
  reasonBox.style.display = resultado.posible ? 'none' : '';
  reasonBox.textContent = resultado.posible ? '' : ('Reestructurar no está disponible: ' + resultado.motivo);

  actualizarPreviewReestructura();
  document.getElementById('modal-eliminar-estudiante').classList.add('active');
}

function actualizarPreviewReestructura() {
  const checked = document.querySelector('input[name="del-est-modo"]:checked');
  const wrap = document.getElementById('del-est-preview-wrap');
  if (!checked || checked.value !== 'reestructurar' || !genEliminarCtx || !genEliminarCtx.resultado.posible) {
    wrap.style.display = 'none';
    return;
  }
  const cambios = genEliminarCtx.resultado.cambios;
  const items = cambios.slice(0, 6).map(c => `${c.usernameAnterior} → ${c.usernameNuevo}`).join(', ');
  const extra = cambios.length > 6 ? ` (+${cambios.length - 6} más)` : '';
  document.getElementById('del-est-preview').textContent = items + extra;
  wrap.style.display = '';
}

function confirmarEliminarEstudiante() {
  if (!genEliminarCtx) return;
  const i = genEliminarCtx.index;
  const row = genPreviewRows[i];
  if (!row) { closeModal('modal-eliminar-estudiante'); return; }
  const modo = document.querySelector('input[name="del-est-modo"]:checked').value;
  const reestructurar = modo === 'reestructurar';
  const cambios = (reestructurar && genEliminarCtx.resultado.posible) ? genEliminarCtx.resultado.cambios : [];

  if (genPreviewSaved) {
    const { colegioId, cursoId, anio, group1 } = genPreviewCtx;
    const eliminadoReal = data.participantes.find(p =>
      p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && (p.group1||'') === (group1||'') && p.username === row.username);
    if (eliminadoReal) {
      const idx = data.participantes.findIndex(p => p.id === eliminadoReal.id);
      data.participantes.splice(idx, 1);
      data.trash.estudiantes.push({ id: uid(), fechaEliminacion: todayStr(), participante: eliminadoReal });
    }
    cambios.forEach(c => {
      const p = data.participantes.find(p =>
        p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && (p.group1||'') === (group1||'') && p.username === c.usernameAnterior);
      if (p) { p.username = c.usernameNuevo; p.email = `${c.usernameNuevo}@${ACADEMIA_ACTUAL.emailDominio}`; }
    });
    saveData();
    renderTrash();
    updateTrashBadge();
  }

  // Refleja los cambios en la copia en pantalla (preview), con o sin lista guardada.
  cambios.forEach(c => {
    const r = genPreviewRows.find(r => r.username === c.usernameAnterior);
    if (r) {
      let nombres = r.firstname;
      if (r.username && r.firstname.startsWith(r.username + ' ')) nombres = r.firstname.slice(r.username.length + 1);
      r.username = c.usernameNuevo;
      r.firstname = nombres ? `${c.usernameNuevo} ${nombres}` : c.usernameNuevo;
      r.email = `${c.usernameNuevo}@${ACADEMIA_ACTUAL.emailDominio}`;
    }
  });
  genPreviewRows.splice(i, 1);

  closeModal('modal-eliminar-estudiante');
  genEliminarCtx = null;

  if (genPreviewSaved && currentCollegeId === genPreviewCtx.colegioId) renderCollegeParticipantes(genPreviewCtx.colegioId);
  if (genPreviewSaved) renderGenYearsSummary();

  const eraGuardada = genPreviewSaved;
  if (!genPreviewRows.length) {
    hideGenPreview();
    showToast(eraGuardada ? 'Estudiante eliminado. Puedes restaurarlo desde la Papelera.' : 'Estudiante eliminado de la vista previa.');
    return;
  }

  renderGenPreviewTable();
  showToast(eraGuardada ? 'Estudiante eliminado. Puedes restaurarlo desde la Papelera.' : 'Estudiante eliminado de la vista previa.');
}

/* ════════════════════════════════════════════════════════════
   PARTICIPANTES (dentro del detalle de un colegio)
   ════════════════════════════════════════════════════════════ */
const PARTICIPANTES_POR_PAGINA = 20;
let cdPartPage = 1;

function renderCollegeParticipantes(colegioId) {
  const sel = document.getElementById('cd-part-anio');
  const wrap = document.getElementById('cd-part-selector-wrap');
  const searchWrap = document.getElementById('cd-part-search-wrap');
  const tableWrap = document.querySelector('#cd-participantes-card .table-wrap');
  const actions = document.getElementById('cd-part-actions');
  const empty = document.getElementById('cd-part-empty');

  const mine = data.participantes.filter(p => p.colegioId === colegioId);
  const anios = [...new Set(mine.map(p => p.anio))];

  if (!anios.length) {
    wrap.style.display = 'none';
    searchWrap.style.display = 'none';
    tableWrap.style.display = 'none';
    actions.style.display = 'none';
    document.getElementById('cd-part-pagination').innerHTML = '';
    document.getElementById('cd-part-count-label').textContent = '';
    document.getElementById('cd-part-title').textContent = '';
    empty.style.display = '';
    _actualizarNivelDownloadBlock(colegioId);
    return;
  }
  wrap.style.display = '';
  searchWrap.style.display = '';
  tableWrap.style.display = '';
  actions.style.display = '';
  empty.style.display = 'none';

  // Agrupado Media/Primaria, misma estructura y orden que fillGenAnioSelect().
  const _cMapPart = {}; data.cursos.forEach(c => _cMapPart[c.id] = c);
  const nivelOf = anio => nivelDe(mine.find(p => p.anio === anio) || {}, _cMapPart);
  const media = anios.filter(a => nivelOf(a) === 'media').sort((a,b) => extractAnioNum(a) - extractAnioNum(b));
  const primaria = anios.filter(a => nivelOf(a) === 'primaria').sort((a,b) => extractAnioNum(b) - extractAnioNum(a));
  const otros = anios.filter(a => !['media','primaria'].includes(nivelOf(a))).sort((a,b) => (a||'').localeCompare(b||''));
  const ordered = [...media, ...primaria, ...otros];

  const optgroupHTML = (label, arr) => arr.length
    ? `<optgroup label="${label}">${arr.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}</optgroup>`
    : '';
  const prevSel = sel.value;
  sel.innerHTML = optgroupHTML('🎓 Educación Media', media) + optgroupHTML('🧒 Educación Primaria', primaria) +
    otros.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  if (prevSel && ordered.includes(prevSel)) sel.value = prevSel;
  document.getElementById('cd-part-search').value = '';
  cdPartPage = 1;

  _actualizarNivelDownloadBlock(colegioId);
  onCdPartAnioChange();
}

function onCdPartAnioChange() {
  if (!currentCollegeId) return;
  cdPartPage = 1;
  const anio = document.getElementById('cd-part-anio').value;
  const grupoWrap = document.getElementById('cd-part-grupo-wrap');
  const grupoSel = document.getElementById('cd-part-grupo');

  const grupos = [...new Set(data.participantes
    .filter(p => p.colegioId === currentCollegeId && p.anio === anio)
    .map(p => p.group1 || ''))]
    .sort((a,b) => a.localeCompare(b));

  if (grupos.length > 1) {
    const prevGrupo = grupoSel.value;
    grupoSel.innerHTML = `<option value="">Todos</option>` + grupos.map(g => `<option value="${esc(g)}">${esc(g || '—')}</option>`).join('');
    grupoSel.value = grupos.includes(prevGrupo) ? prevGrupo : '';
    grupoWrap.style.display = '';
  } else {
    grupoSel.innerHTML = '';
    grupoWrap.style.display = 'none';
  }

  renderCollegeParticipantesTable();
}

function onCdPartGrupoChange() {
  cdPartPage = 1;
  renderCollegeParticipantesTable();
}

function onCdPartSearchInput() {
  cdPartPage = 1;
  renderCollegeParticipantesTable();
}

function cdPartSeleccion() {
  const anio = document.getElementById('cd-part-anio').value;
  const grupoWrap = document.getElementById('cd-part-grupo-wrap');
  const grupoSel = document.getElementById('cd-part-grupo');
  const grupo = grupoWrap.style.display !== 'none' ? grupoSel.value : '';
  return { anio, grupo };
}

function renderCdPartTitle(anio, grupo, total) {
  const el = document.getElementById('cd-part-title');
  if (!el) return;
  const _cMapTitle = {}; data.cursos.forEach(c => _cMapTitle[c.id] = c);
  const _p0Title = data.participantes.find(p => p.colegioId === currentCollegeId && p.anio === anio);
  const nivel = _p0Title ? nivelDe(_p0Title, _cMapTitle) : null;
  const partes = [nivel ? NIVEL_LABEL[nivel].replace(/^\S+\s/, '') : null, anio, grupo ? `Grupo ${grupo}` : null].filter(Boolean);
  el.textContent = partes.join(' · ') + (total ? ` · ${total} participante${total === 1 ? '' : 's'}` : '');
}

function renderCollegeParticipantesTable() {
  if (!currentCollegeId) return;
  const { anio, grupo } = cdPartSeleccion();
  const q = normalize(document.getElementById('cd-part-search').value.trim());

  const seleccion = data.participantes.filter(p => p.colegioId === currentCollegeId && p.anio === anio && (grupo === '' || (p.group1||'') === grupo));
  const filtrados = seleccion
    .filter(p => !q || normalize(p.username).includes(q) || normalize(p.nombres).includes(q) || normalize(p.apellidos).includes(q) || normalize(p.email).includes(q))
    .sort((a,b) => a.username.localeCompare(b.username));

  const info = paginaInfo(filtrados.length, cdPartPage, PARTICIPANTES_POR_PAGINA);
  cdPartPage = info.page;
  const pageRows = filtrados.slice((info.page - 1) * PARTICIPANTES_POR_PAGINA, info.page * PARTICIPANTES_POR_PAGINA);

  const body = document.getElementById('cd-part-body');
  if (!filtrados.length) {
    body.innerHTML = `<tr><td colspan="5"><div class="empty-state">${q ? 'Ningún participante coincide con la búsqueda.' : 'Sin participantes en esta selección.'}</div></td></tr>`;
  } else {
    body.innerHTML = pageRows.map(p => `<tr>
      <td><code>${esc(p.username)}</code></td>
      <td>${esc(p.password)}</td>
      <td>${esc(p.nombres)}</td>
      <td>${esc(p.apellidos)}</td>
      <td class="row-actions">
        <button class="icon-btn" title="Copiar" onclick="copyParticipante('${p.id}', this)">📋</button>
      </td>
    </tr>`).join('');
  }

  renderCdPartTitle(anio, grupo, filtrados.length);
  document.getElementById('cd-part-count-label').textContent =
    filtrados.length ? `Mostrando ${info.start}–${info.end} de ${filtrados.length}` : '';
  renderPaginacionHTML('cd-part-pagination', info.page, info.totalPages, 'irAPaginaCdPart');
}

function irAPaginaCdPart(n) {
  cdPartPage = n;
  renderCollegeParticipantesTable();
}

function copyParticipante(id, btn) {
  const p = data.participantes.find(p => p.id === id);
  if (!p) return;
  const text = `Estudiante: ${p.nombres} ${p.apellidos}\nUSUARIO: ${String(p.username||'').toUpperCase()}\nCLAVE: ${p.password}`;
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => { btn.textContent = original; }, 1000);
    }
    showToast('Copiado al portapapeles ✓');
  }).catch(() => showToast('⚠ No se pudo copiar al portapapeles'));
}

function descargarXLSXParticipantesColegio() {
  if (!currentCollegeId) return;
  if (typeof XLSX === 'undefined') { showToast('⚠ Falta la librería XLSX (Organizador_moodle/lib/xlsx.full.min.js)'); return; }
  // Nota (§3.3): exporta TODA la selección de año/grupo, sin paginar y sin aplicar el filtro de búsqueda,
  // igual que lo hacía antes de agregar la paginación.
  const { anio, grupo } = cdPartSeleccion();
  const rows = data.participantes.filter(p => p.colegioId === currentCollegeId && p.anio === anio && (grupo === '' || (p.group1||'') === grupo));
  if (!rows.length) return;
  const aoa = [['usuario','clave','nombres','apellidos'], ...rows.map(p => [p.username, p.password, p.nombres, p.apellidos])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  XLSX.writeFile(wb, nombreArchivoDescarga(anio, grupo, 'xlsx'));
  showToast('XLSX descargado ✓');
}

/* ════════════════════════════════════════════════════════════
   BUSCAR
   ════════════════════════════════════════════════════════════ */
/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 PDF DE PARTICIPANTES \u2014 utilidades internas \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

function _pdfClean(s) {
  return String(s == null ? '' : s).split('').map(ch => {
    if (ch.charCodeAt(0) <= 255) return ch;
    const b = ch.normalize('NFD')[0];
    return b && b.charCodeAt(0) <= 255 ? b : '?';
  }).join('');
}

function _pdfBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const _PDFP = {
  w: 215.9, h: 279.4,
  mL: 15, mR: 15, mT: 15, mB: 20,
  cW: 185.9,
  cols: [
    { label: 'Usuario',   w: 40   },
    { label: 'Clave',     w: 25   },
    { label: 'Nombres',   w: 60   },
    { label: 'Apellidos', w: 60.9 }
  ],
  rowH: 6.5, lineH: 5.5, hdrH: 8, fSz: 9, hdrFSz: 9
};
(function () { let x = _PDFP.mL; _PDFP.cols.forEach(c => { c.x = x; x += c.w; }); }());

function _pdfRowLines(doc, row) {
  doc.setFontSize(_PDFP.fSz);
  return row.map((v, i) => doc.splitTextToSize(_pdfClean(String(v || '')), _PDFP.cols[i].w - 3).length);
}
function _pdfRowH(lc) { const m = Math.max(...lc); return m <= 1 ? _PDFP.rowH : m * _PDFP.lineH + 2; }

function _pdfDrawColHeaders(doc, y) {
  const { mL, cW, cols, hdrH } = _PDFP;
  doc.setFillColor(230, 237, 250); doc.rect(mL, y, cW, hdrH, 'F');
  doc.setDrawColor(180, 195, 220); doc.setLineWidth(0.3);
  doc.line(mL, y + hdrH, mL + cW, y + hdrH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(_PDFP.hdrFSz); doc.setTextColor(30, 55, 110);
  cols.forEach(c => doc.text(_pdfClean(c.label), c.x + 2, y + hdrH / 2, { baseline: 'middle' }));
  return y + hdrH;
}

function _pdfDrawRow(doc, y, row, rh, isAlt) {
  const { mL, cW, cols } = _PDFP;
  if (isAlt) { doc.setFillColor(248, 250, 254); doc.rect(mL, y, cW, rh, 'F'); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(_PDFP.fSz); doc.setTextColor(25, 35, 50);
  row.forEach((v, i) => {
    const lines = doc.splitTextToSize(_pdfClean(String(v || '')), cols[i].w - 3);
    const lh = rh / Math.max(lines.length, 1);
    lines.forEach((l, li) => doc.text(l, cols[i].x + 2, y + li * lh + lh / 2, { baseline: 'middle' }));
  });
  doc.setDrawColor(215, 222, 235); doc.setLineWidth(0.15);
  doc.line(mL, y + rh, mL + cW, y + rh);
}

function _pdfDrawTable(doc, rows, y0, bottomLimit) {
  let y = y0;
  rows.forEach((row, idx) => {
    const lc = _pdfRowLines(doc, row);
    const rh = _pdfRowH(lc);
    if (y + rh > bottomLimit) { doc.addPage(); y = _PDFP.mT; y = _pdfDrawColHeaders(doc, y); }
    _pdfDrawRow(doc, y, row, rh, idx % 2 !== 0);
    y += rh;
  });
  return y;
}

function _pdfPageFooter(doc, page, total) {
  const { w, h, mB } = _PDFP;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(150, 162, 178);
  doc.text(_pdfClean(`P\u00e1gina ${page} de ${total}`), w / 2, h - mB / 2, { align: 'center', baseline: 'middle' });
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 FUNCI\u00d3N 1 \u2014 PDF por a\u00f1o/grado individual \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function descargarPDFParticipantesColegio(btn) {
  if (!currentCollegeId) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast('\u26a0 Falta la librer\u00eda jsPDF (lib/jspdf.umd.min.js)'); return; }
  const { anio, grupo } = cdPartSeleccion();
  const rows = data.participantes
    .filter(p => p.colegioId === currentCollegeId && p.anio === anio && (grupo === '' || (p.group1 || '') === grupo))
    .sort((a, b) => a.username.localeCompare(b.username));
  if (!rows.length) return;
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF\u2026'; }
  setTimeout(() => {
    try {
      const col   = data.colegios.find(c => c.id === currentCollegeId) || { nombre: '-' };
      const _cMapPdfInd = {}; data.cursos.forEach(c => _cMapPdfInd[c.id] = c);
      const _nivelCode  = rows.length ? nivelDe(rows[0], _cMapPdfInd) : null;
      const nivel = _nivelCode === 'media' ? 'Educaci\u00f3n Media' : _nivelCode === 'primaria' ? 'Educaci\u00f3n Primaria' : '';
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
      doc.setProperties({ title: _pdfClean(`${col.nombre} \u00b7 ${anio}`) });
      const { mL, mT, mB, w, h, cW } = _PDFP;
      const bottomLimit = h - mB - 5;
      let y = mT;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(40, 55, 80);
      doc.text(_pdfClean(col.nombre), mL, y + 5.5, { baseline: 'middle' }); y += 8;
      const tituloAnio = [nivel, anio, grupo ? `Grupo ${grupo}` : null].filter(Boolean).join(' \u00b7 ');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(50, 80, 150);
      doc.text(_pdfClean(tituloAnio), mL, y + 5, { baseline: 'middle' }); y += 7.5;
      doc.setDrawColor(180, 195, 222); doc.setLineWidth(0.4);
      doc.line(mL, y, w - mL, y); y += 5;
      y = _pdfDrawColHeaders(doc, y);
      _pdfDrawTable(doc, rows.map(p => [p.username, p.password, p.nombres, p.apellidos]), y, bottomLimit);
      const total = doc.getNumberOfPages();
      for (let p = 1; p <= total; p++) { doc.setPage(p); _pdfPageFooter(doc, p, total); }
      _pdfBlob(doc.output('blob'), nombreArchivoDescarga(anio, grupo, 'pdf'));
      showToast('PDF descargado \u2713');
    } catch (e) { console.error(e); showToast('\u26a0 Error al generar el PDF'); }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }, 30);
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 FUNCI\u00d3N 2 \u2014 Descarga completa de un nivel \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function _actualizarNivelDownloadBlock(colegioId) {
  const block = document.getElementById('cd-nivel-download-block');
  const sel   = document.getElementById('cd-nivel-select');
  const btnXlsx = document.getElementById('cd-nivel-btn-xlsx');
  const btnPdf  = document.getElementById('cd-nivel-btn-pdf');
  if (!block || !sel) return;
  const mine        = data.participantes.filter(p => p.colegioId === colegioId);
  const _cMapNivel  = {}; data.cursos.forEach(c => _cMapNivel[c.id] = c);
  const hasMedia    = mine.some(p => nivelDe(p, _cMapNivel) === 'media');
  const hasPrimaria = mine.some(p => nivelDe(p, _cMapNivel) === 'primaria');
  if (!hasMedia && !hasPrimaria) { block.style.display = 'none'; return; }
  block.style.display = '';
  const prev = sel.value;
  sel.innerHTML = '<option value="">Elige un nivel\u2026</option>';
  if (hasMedia)    sel.innerHTML += '<option value="media">\ud83c\udf93 Educaci\u00f3n Media</option>';
  if (hasPrimaria) sel.innerHTML += '<option value="primaria">\ud83e\uddd2 Educaci\u00f3n Primaria</option>';
  if ((prev === 'media' && hasMedia) || (prev === 'primaria' && hasPrimaria)) sel.value = prev;
  const noSel = !sel.value;
  if (btnXlsx) btnXlsx.disabled = noSel;
  if (btnPdf)  btnPdf.disabled  = noSel;
}

function onCdNivelChange() {
  const sel = document.getElementById('cd-nivel-select');
  const noSel = !(sel && sel.value);
  const btnXlsx = document.getElementById('cd-nivel-btn-xlsx');
  const btnPdf  = document.getElementById('cd-nivel-btn-pdf');
  if (btnXlsx) btnXlsx.disabled = noSel;
  if (btnPdf)  btnPdf.disabled  = noSel;
}

function descargarNivelXLSXClick() {
  const sel = document.getElementById('cd-nivel-select');
  if (!sel || !sel.value) return;
  descargarNivelXLSX(sel.value);
}

function descargarNivelPDFClick(btn) {
  const sel = document.getElementById('cd-nivel-select');
  if (!sel || !sel.value) return;
  descargarNivelPDF(sel.value, btn);
}

function descargarNivelXLSX(nivel) {
  if (!currentCollegeId) return;
  if (typeof XLSX === 'undefined') { showToast('\u26a0 Falta la librer\u00eda XLSX'); return; }
  const col      = data.colegios.find(c => c.id === currentCollegeId) || { nombre: '-' };
  const nivelTxt = nivel === 'media' ? 'Educaci\u00f3n Media' : 'Educaci\u00f3n Primaria';
  const _cMapXlsxNivel = {}; data.cursos.forEach(c => _cMapXlsxNivel[c.id] = c);
  const mine  = data.participantes.filter(p => p.colegioId === currentCollegeId && nivelDe(p, _cMapXlsxNivel) === nivel);
  const anios = [...new Set(mine.map(p => p.anio))].sort((a, b) => extractAnioNum(a) - extractAnioNum(b));
  if (!anios.length) { showToast('Sin participantes en este nivel.'); return; }
  const COLS = ['usuario', 'clave', 'nombres', 'apellidos'];
  const aoa  = [];
  anios.forEach(anio => {
    const filas = mine.filter(p => p.anio === anio).sort((a, b) => a.username.localeCompare(b.username));
    if (!filas.length) return;
    aoa.push([`${anio} \u00b7 ${nivelTxt} \u00b7 ${col.nombre}`, '', '', '']);
    aoa.push([...COLS]);
    filas.forEach(p => aoa.push([p.username, p.password, p.nombres, p.apellidos]));
    aoa.push([`Fin de ${anio}`, '', '', '']);
    aoa.push(['', '', '', '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 28 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  const sheetName = nivel === 'media' ? 'Estudiantes Media' : 'Estudiantes Primaria';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, nivel === 'media' ? 'Estudiantes Media.xlsx' : 'Estudiantes Primaria.xlsx');
  showToast('XLSX descargado \u2713');
}

function descargarNivelPDF(nivel, btn) {
  if (!currentCollegeId) return;
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast('\u26a0 Falta la librer\u00eda jsPDF'); return; }
  const _cMapPdfNivel = {}; data.cursos.forEach(c => _cMapPdfNivel[c.id] = c);
  const mine  = data.participantes.filter(p => p.colegioId === currentCollegeId && nivelDe(p, _cMapPdfNivel) === nivel);
  const anios = [...new Set(mine.map(p => p.anio))].sort((a, b) => extractAnioNum(a) - extractAnioNum(b));
  if (!anios.length) { showToast('Sin participantes en este nivel.'); return; }
  const label = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Generando PDF\u2026'; }
  setTimeout(() => {
    try {
      const col      = data.colegios.find(c => c.id === currentCollegeId) || { nombre: '-' };
      const nivelTxt = nivel === 'media' ? 'Educaci\u00f3n Media' : 'Educaci\u00f3n Primaria';
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
      doc.setProperties({ title: _pdfClean(`${nivelTxt} \u00b7 ${col.nombre}`) });
      const { mL, mT, mB, w, h, cW } = _PDFP;
      const bottomLimit = h - mB - 5;
      let primerAnio = true;
      anios.forEach(anio => {
        const filas = mine.filter(p => p.anio === anio).sort((a, b) => a.username.localeCompare(b.username));
        if (!filas.length) return;
        if (!primerAnio) doc.addPage();
        const paginaInicio = doc.getNumberOfPages();
        try { if (doc.outline && doc.outline.add) doc.outline.add(null, _pdfClean(anio), { pageNumber: paginaInicio }); } catch (_) {}
        let y = mT;
        doc.setFillColor(50, 90, 170); doc.rect(mL, y, cW, 10, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
        doc.text(_pdfClean(`${anio} \u00b7 ${nivelTxt} \u00b7 ${col.nombre}`), mL + 3, y + 5, { baseline: 'middle' });
        y += 13;
        y = _pdfDrawColHeaders(doc, y);
        y = _pdfDrawTable(doc, filas.map(p => [p.username, p.password, p.nombres, p.apellidos]), y, bottomLimit);
        y += 2;
        if (y + 8 > bottomLimit) { doc.addPage(); y = mT; }
        doc.setDrawColor(100, 130, 200); doc.setLineWidth(0.35);
        doc.line(mL, y, mL + cW, y); y += 3;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 90, 160);
        doc.text(_pdfClean(`Fin de ${anio}`), mL, y + 4, { baseline: 'middle' });
        primerAnio = false;
      });
      const totalPags = doc.getNumberOfPages();
      for (let p = 1; p <= totalPags; p++) { doc.setPage(p); _pdfPageFooter(doc, p, totalPags); }
      _pdfBlob(doc.output('blob'), nivel === 'media' ? 'Estudiantes Media.pdf' : 'Estudiantes Primaria.pdf');
      showToast('PDF descargado \u2713');
    } catch (e) { console.error(e); showToast('\u26a0 Error al generar el PDF'); }
    if (btn) { btn.disabled = false; btn.textContent = label; }
  }, 30);
}

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buscarEmptyMessage(hayQuery, hayCoincidencias) {
  if (!data.colegios.length) return 'Aún no hay colegios registrados.';
  if (!hayQuery) return 'Empieza a escribir el nombre de un colegio para ver su información.';
  if (!hayCoincidencias) return 'No se encontró ningún colegio con ese nombre.';
  return '';
}

function onSearchInput() {
  const raw = document.getElementById('search-input').value.trim();
  const q = normalize(raw);
  const box = document.getElementById('search-suggestions');
  const empty = document.getElementById('search-empty');
  const result = document.getElementById('search-result');

  if (!q) {
    box.style.display = 'none';
    result.style.display = 'none';
    searchSelectedId = null;
    empty.textContent = buscarEmptyMessage(false, false);
    empty.style.display = '';
    return;
  }

  const matches = data.colegios.filter(c => normalize(c.nombre).includes(q)).sort((a,b) => a.nombre.localeCompare(b.nombre));

  if (!matches.length) {
    box.style.display = 'none';
    result.style.display = 'none';
    searchSelectedId = null;
    empty.textContent = buscarEmptyMessage(true, false);
    empty.style.display = '';
    return;
  }

  // Coincidencia exacta con un único colegio: carga el resumen directo, sin desplegable.
  const exact = matches.filter(c => normalize(c.nombre) === q);
  if (exact.length === 1) {
    selectSearchResult(exact[0].id);
    return;
  }

  box.innerHTML = matches.slice(0, 8).map(c => `<div class="search-suggestion-item" onclick="selectSearchResult('${c.id}')">🏫 ${esc(c.nombre)}</div>`).join('');
  box.style.display = 'block';
  empty.style.display = 'none';
}

function onSearchKeydown(e) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const q = normalize(document.getElementById('search-input').value.trim());
  if (!q) return;
  const matches = data.colegios.filter(c => normalize(c.nombre).includes(q)).sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (matches.length) selectSearchResult(matches[0].id);
}

function renderBuscar() {
  const input = document.getElementById('search-input');
  document.getElementById('search-suggestions').style.display = 'none';
  if (input.value.trim()) { onSearchInput(); return; }
  document.getElementById('search-result').style.display = 'none';
  searchSelectedId = null;
  const empty = document.getElementById('search-empty');
  empty.textContent = buscarEmptyMessage(false, false);
  empty.style.display = '';
}

let searchSelectedId = null;

function selectSearchResult(id) {
  searchSelectedId = id;
  document.getElementById('search-suggestions').style.display = 'none';
  const col = data.colegios.find(c => c.id === id);
  document.getElementById('search-input').value = col ? col.nombre : '';
  document.getElementById('search-empty').style.display = 'none';

  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const s = collegeStats(id);

  document.getElementById('sr-nombre').textContent = col.nombre;
  document.getElementById('sr-anios').textContent = s.anios.length;
  document.getElementById('sr-clases').textContent = s.clases;
  document.getElementById('sr-badges').innerHTML = s.niveles.length
    ? s.niveles.map(n => `<span class="badge ${n==='media'?'badge-media':'badge-primaria'}">${NIVEL_LABEL[n]}</span>`).join('')
    : `<span class="badge badge-count">Sin cursos copiados aún</span>`;

  const sorted = [...s.asigs].sort((a,b) => (a.anio||'').localeCompare(b.anio||''));
  document.getElementById('sr-body').innerHTML = sorted.length
    ? sorted.map(a => {
        const curso = cursoMap[a.cursoId];
        const nivel = curso ? curso.nivel : null;
        return `<tr>
          <td><b>${esc(a.anio)}</b></td>
          <td>${esc(curso ? curso.nombre : '—')}</td>
          <td>${nivel ? `<span class="badge ${nivel==='media'?'badge-media':'badge-primaria'}">${nivel==='media'?'Media':'Primaria'}</span>` : '—'}</td>
          <td><b>${Number(a.clases)||0}</b></td>
          <td>${fmtDate(a.fecha)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="5"><div class="empty-state">Este colegio aún no tiene cursos copiados.</div></td></tr>`;

  document.getElementById('search-result').style.display = '';
}

function goToCollegeFromSearch() {
  if (!searchSelectedId) return;
  showView('colegios');
  openCollegeDetail(searchSelectedId);
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.search-box-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('search-suggestions').style.display = 'none';
  }
});

function exportReportCSV() {
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const colMap = {}; data.colegios.forEach(c => colMap[c.id] = c);
  const rows = [['Colegio','Año/Grado','Curso modelo','Nivel','Nombre completo','Nombre corto','Clases','Fecha de copia','Notas']];

  data.asignaciones
    .slice()
    .sort((a,b) => (colMap[a.colegioId]?.nombre||'').localeCompare(colMap[b.colegioId]?.nombre||'') || (a.anio||'').localeCompare(b.anio||''))
    .forEach(a => {
      const col = colMap[a.colegioId];
      const curso = cursoMap[a.cursoId];
      rows.push([
        col ? col.nombre : '(colegio eliminado)',
        a.anio || '',
        curso ? curso.nombre : '(curso eliminado)',
        curso ? (curso.nivel === 'media' ? 'Educación Media' : 'Educación Primaria') : '',
        a.nombreCompleto || '', a.nombreCorto || '',
        Number(a.clases)||0, a.fecha || '', a.notas || ''
      ]);
    });

  if (rows.length === 1) { showToast('No hay datos todavía para exportar'); return; }

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadFile(csv, `reporte_${ACADEMIA_ACTUAL.id}_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
  showToast('Reporte CSV descargado ✓');
}

/* ════════════════════════════════════════════════════════════
   RESPALDO (export/import JSON)
   ════════════════════════════════════════════════════════════ */
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const RESPALDO_VERSION_ESQUEMA = 1;

function estaDataVacia(d) {
  return !d || (!d.colegios.length && !d.cursos.length && !d.asignaciones.length &&
    !d.participantes.length && !d.carnetListas.length && !trashTotalDe(d));
}
function trashTotalDe(d) {
  const t = (d && d.trash) || {};
  return (t.colegios||[]).length + (t.cursos||[]).length + (t.asignaciones||[]).length +
    (t.participantes||[]).length + (t.estudiantes||[]).length + (t.carnetListas||[]).length;
}
function resumenDe(d) {
  return {
    colegios: d.colegios.length, cursos: d.cursos.length, asignaciones: d.asignaciones.length,
    participantes: d.participantes.length, carnetListas: d.carnetListas.length,
    itemsEnPapelera: trashTotalDe(d)
  };
}
function construirPayloadRespaldo() {
  const resumen = resumenDe(data);
  return {
    ...data,
    _academia: ACADEMIA_ACTUAL.id,
    _versionEsquema: RESPALDO_VERSION_ESQUEMA,
    _exportadoEn: new Date().toISOString(),
    _exportadoPor: sessionStorage.getItem('tcUser') || '',
    _resumen: resumen
  };
}
function marcarUltimoRespaldo() {
  try { localStorage.setItem('tc_last_backup_' + ACADEMIA_ACTUAL.id, todayStr()); } catch (e) {}
  if (typeof renderRespaldoView === 'function') renderRespaldoView();
}

function exportBackup() {
  const payload = construirPayloadRespaldo();
  downloadFile(JSON.stringify(payload), `respaldo_${ACADEMIA_ACTUAL.id}_${todayStr()}.json`, 'application/json');
  marcarUltimoRespaldo();
  showToast('Respaldo descargado ✓ (incluye papelera)');
}

// Respaldo silencioso (sin toast ni interacción): se usa como red de seguridad
// justo antes de que la sincronización reemplace datos locales por los de la
// nube en un escenario de riesgo (ver sync.js / window.__syncRespaldoSilencioso).
function descargarRespaldoSilencioso(sufijo) {
  if (estaDataVacia(data)) return;
  const payload = construirPayloadRespaldo();
  downloadFile(JSON.stringify(payload), `respaldo_${ACADEMIA_ACTUAL.id}_${todayStr()}_${sufijo || 'automatico'}.json`, 'application/json');
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.colegios) || !Array.isArray(parsed.cursos)) {
        throw new Error('Formato no válido');
      }
      if (parsed._academia && parsed._academia !== ACADEMIA_ACTUAL.id) {
        if (!confirm('Este respaldo es de otra academia. ¿Importar de todos modos?')) { event.target.value = ''; return; }
      }
      if (!confirm('Esto reemplazará todos los datos actuales en este navegador con los del archivo. ¿Continuar?')) { event.target.value = ''; return; }
      if (window.Sync && Sync.estadoVinculo().vinculado) {
        if (!confirm('La sincronización con la nube está activa: esto también reemplazará los datos guardados en la nube (y los de los demás dispositivos). ¿Continuar?')) { event.target.value = ''; return; }
      }

      // Red de seguridad: si lo que hay ahora en este navegador no está vacío,
      // se descarga automáticamente antes de perderlo (§C.2).
      if (!estaDataVacia(data)) descargarRespaldoSilencioso('previo-a-importar');

      const trash = parsed.trash || {};
      data = {
        colegios: parsed.colegios || [],
        cursos: parsed.cursos || [],
        asignaciones: parsed.asignaciones || [],
        participantes: parsed.participantes || [],
        carnetListas: parsed.carnetListas || [],
        carnetOpciones: { ...CARNET_OPCIONES_DEFAULT, ...(parsed.carnetOpciones || {}) },
        trash: {
          colegios: trash.colegios || [],
          cursos: trash.cursos || [],
          asignaciones: trash.asignaciones || [],
          participantes: trash.participantes || [],
          estudiantes: trash.estudiantes || [],
          carnetListas: trash.carnetListas || []
        }
      };
      saveData();
      renderAll();
      if (window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
      closeCollegeDetail();
      const r = resumenDe(data);
      showToast(`Importado ✓ — ${r.colegios} colegios, ${r.cursos} cursos, ${r.asignaciones} cursos copiados, ${r.participantes} participantes, ${r.carnetListas} listas de carnets, ${r.itemsEnPapelera} en papelera`);
    } catch (e) {
      console.error(e);
      showToast('⚠ El archivo no es un respaldo válido');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

/* ════════════════════════════════════════════════════════════
   SINCRONIZACIÓN EN LA NUBE — interfaz de usuario (habla solo con
   window.Sync; nunca con firebase.* directamente, ver sync.js)
   ════════════════════════════════════════════════════════════ */
const UMBRAL_AVISO_CUOTA_BYTES = 4 * 1024 * 1024; // 4 MB de ~5 MB disponibles en localStorage

function renderRespaldoView() {
  if (!document.getElementById('view-respaldo')) return;
  const v = window.Sync ? Sync.estadoVinculo() : { vinculado: false, email: null };

  const subtitle = document.getElementById('respaldo-subtitle');
  const cloudText = document.getElementById('cloud-sync-text');
  const connectBtn = document.getElementById('cloud-connect-btn');
  const disconnectBtn = document.getElementById('cloud-disconnect-btn');
  const syncNowBtn = document.getElementById('cloud-sync-now-btn');

  if (!window.Sync || !Sync.nubeDisponible()) {
    if (subtitle) subtitle.textContent = 'La información se guarda en este navegador. Exporta seguido para no perder nada.';
    if (cloudText) cloudText.textContent = 'La sincronización en la nube no está disponible en este momento (sin conexión, o el servicio está bloqueado). La app sigue funcionando normalmente con lo guardado en este navegador.';
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    if (syncNowBtn) syncNowBtn.style.display = 'none';
  } else if (v.vinculado) {
    if (subtitle) subtitle.textContent = 'Tus datos se guardan en este navegador y, además, están sincronizados en la nube.';
    if (cloudText) cloudText.innerHTML = `Este dispositivo está conectado como <b>${esc(v.email || '')}</b>. El respaldo .json sigue siendo tu copia personal descargable.`;
    if (connectBtn) connectBtn.style.display = 'none';
    if (disconnectBtn) disconnectBtn.style.display = '';
    if (syncNowBtn) syncNowBtn.style.display = '';
  } else {
    if (subtitle) subtitle.textContent = 'La información se guarda en este navegador. Exporta seguido para no perder nada.';
    if (cloudText) cloudText.textContent = 'Este dispositivo todavía no está conectado a la nube. Conéctalo una sola vez con un correo y una contraseña de Firebase (no es el código de acceso) para ver los mismos datos desde cualquier equipo.';
    if (connectBtn) connectBtn.style.display = '';
    if (disconnectBtn) disconnectBtn.style.display = 'none';
    if (syncNowBtn) syncNowBtn.style.display = 'none';
  }

  const lastBackupEl = document.getElementById('last-backup-text');
  if (lastBackupEl) {
    const fecha = localStorage.getItem('tc_last_backup_' + ACADEMIA_ACTUAL.id);
    if (!fecha) {
      lastBackupEl.innerHTML = '⚠ Todavía no has descargado ningún respaldo.';
    } else {
      const dias = Math.floor((Date.now() - new Date(fecha + 'T00:00:00').getTime()) / 86400000);
      lastBackupEl.innerHTML = dias > 7
        ? `⚠ Último respaldo descargado: ${fmtDate(fecha)} (hace ${dias} días).`
        : `Último respaldo descargado: ${fmtDate(fecha)}.`;
    }
  }

  const quotaCard = document.getElementById('storage-quota-card');
  const quotaText = document.getElementById('storage-quota-text');
  if (quotaCard && quotaText) {
    const bytes = tamanoDatosBytes();
    if (bytes > UMBRAL_AVISO_CUOTA_BYTES) {
      quotaCard.style.display = '';
      quotaText.innerHTML = `Tus datos ocupan aproximadamente <b>${(bytes/1024/1024).toFixed(1)} MB</b> de los ~5 MB que suele permitir el navegador. Considera vaciar la Papelera o descargar un respaldo y archivarlo fuera de la app.`;
    } else {
      quotaCard.style.display = 'none';
    }
  }
}

function renderSyncStatus(estado) {
  const icon = document.getElementById('sync-status-icon');
  const text = document.getElementById('sync-status-text');
  if (!icon || !text) return;
  const MAPA = {
    'sin-nube':     { icono: '☁', texto: 'Nube no disponible' },
    'desconectado': { icono: '☁', texto: 'Conectar con la nube' },
    'sincronizado': { icono: '✓', texto: 'Sincronizado' },
    'sincronizando':{ icono: '↺', texto: 'Sincronizando…' },
    'pendiente':    { icono: '●', texto: 'Cambios pendientes' },
    'sin-conexion': { icono: '✕', texto: 'Sin conexión' },
    'error':        { icono: '⚠', texto: 'Error de sincronización' }
  };
  const m = MAPA[estado.tipo] || MAPA['sin-nube'];
  icon.textContent = m.icono;
  text.textContent = m.texto;
  const btn = document.getElementById('sync-status-btn');
  if (btn) { btn.title = estado.detalle || m.texto; btn.setAttribute('data-estado', estado.tipo); }
  renderRespaldoView();
}

function onSyncStatusClick() {
  if (!window.Sync || !Sync.nubeDisponible()) { showToast('La nube no está disponible en este dispositivo.'); return; }
  const v = Sync.estadoVinculo();
  if (!v.vinculado) { abrirConectarNube(); return; }
  showView('respaldo');
}

function abrirConectarNube() {
  document.getElementById('cn-email').value = '';
  document.getElementById('cn-password').value = '';
  document.getElementById('cn-error').style.display = 'none';
  document.getElementById('modal-conectar-nube').classList.add('active');
  setTimeout(() => document.getElementById('cn-email').focus(), 50);
}

async function confirmarConectarNube() {
  const email = document.getElementById('cn-email').value.trim();
  const password = document.getElementById('cn-password').value;
  const errBox = document.getElementById('cn-error');
  errBox.style.display = 'none';
  if (!email || !password) { errBox.textContent = 'Escribe el correo y la contraseña.'; errBox.style.display = ''; return; }
  const btn = document.getElementById('cn-submit-btn');
  btn.disabled = true;
  const r = await Sync.autenticar(email, password);
  btn.disabled = false;
  if (!r.ok) { errBox.textContent = r.mensaje; errBox.style.display = ''; return; }
  closeModal('modal-conectar-nube');
  showToast(r.mensaje);
}

async function desconectarNube() {
  if (!confirm('Esto desconecta este dispositivo de la nube. Tus datos locales y los de la nube NO se borran. ¿Continuar?')) return;
  await Sync.cerrarVinculo();
  showToast('Dispositivo desconectado de la nube');
}

async function sincronizarAhoraClick() {
  showToast('Sincronizando…');
  await Sync.sincronizarAhora();
}

function confirmarSubidaInicialClick() {
  closeModal('modal-primera-subida');
  Sync.confirmarSubidaInicial();
  showToast('Subiendo tus datos a la nube…');
}
function pospondrSubidaInicialClick() {
  closeModal('modal-primera-subida');
  Sync.posponerSubidaInicial();
}

function cancelarConflictoNubeClick() {
  closeModal('modal-conflicto-nube');
  Sync.resolverConflictoCancelar();
  showToast('Se canceló la conexión con la nube.');
}
function subirLocalConflictoNubeClick() {
  closeModal('modal-conflicto-nube');
  Sync.resolverConflictoSubirLocal();
  showToast('Subiendo los datos de este equipo a la nube…');
}
function usarNubeConflictoNubeClick() {
  closeModal('modal-conflicto-nube');
  Sync.resolverConflictoUsarNube();
  showToast('Usando los datos de la nube en este equipo…');
}

// Puente hacia sync.js: aplica datos ya fusionados por sync.js (diferencia por
// entidad, no un reemplazo total — ver SyncCore.fusionarEntidades). El respaldo
// automático "por si acaso" ya se descargó antes, en el momento de riesgo real
// (primera vinculación con datos distintos en la nube, o importBackup), no en
// cada fusión rutinaria — descargar un archivo en cada sincronización silenciosa
// sería más una molestia que una protección.
window.__syncAplicarDataRemota = function (nuevaData, info) {
  data = nuevaData;
  saveData();
  renderAll();
  if (window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
  if (currentCollegeId) renderCollegeDetail();
};
window.__syncRespaldoSilencioso = function () { descargarRespaldoSilencioso(); };

function resetCatalogs() {
  if (!confirm('Esto restablece la lista de colegios y cursos modelo a los valores base. Los cursos copiados que ya registraste se conservan. ¿Continuar?')) return;
  const fresh = freshData();
  // Los colegios/cursos reemplazados van a la Papelera (no se pierden).
  data.trash.colegios.push(...data.colegios);
  data.trash.cursos.push(...data.cursos);
  data.colegios = fresh.colegios;
  data.cursos = fresh.cursos;
  saveData();
  renderAll();
  showToast('Catálogos restablecidos ✓');
}

/* ════════════════════════════════════════════════════════════
   PAPELERA
   ════════════════════════════════════════════════════════════ */
function trashTotal() {
  return data.trash.colegios.length + data.trash.cursos.length + data.trash.asignaciones.length +
    data.trash.participantes.length + data.trash.estudiantes.length + data.trash.carnetListas.length;
}

function updateTrashBadge() {
  const total = trashTotal();
  const badge = document.getElementById('trash-count-badge');
  if (total > 0) { badge.textContent = total; badge.style.display = ''; }
  else badge.style.display = 'none';
}

function renderTrash() {
  const tCol = data.trash.colegios, tCur = data.trash.cursos, tAsig = data.trash.asignaciones, tPart = data.trash.participantes;
  const tEst = data.trash.estudiantes, tCarnet = data.trash.carnetListas;
  const total = trashTotal();

  document.getElementById('trash-colegios-section').style.display = tCol.length ? '' : 'none';
  document.getElementById('trash-cursos-section').style.display = tCur.length ? '' : 'none';
  document.getElementById('trash-asig-section').style.display = tAsig.length ? '' : 'none';
  document.getElementById('trash-part-section').style.display = tPart.length ? '' : 'none';
  document.getElementById('trash-estudiantes-section').style.display = tEst.length ? '' : 'none';
  document.getElementById('trash-carnetlistas-section').style.display = tCarnet.length ? '' : 'none';
  document.getElementById('trash-empty').style.display = total ? 'none' : '';

  document.getElementById('trash-colegios-list').innerHTML = tCol.map(c => `
    <div class="trash-item">
      <div><div class="trash-item-main">🏫 ${esc(c.nombre)}</div></div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreCollege('${c.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteCollege('${c.id}')">Eliminar para siempre</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-cursos-list').innerHTML = tCur.map(c => `
    <div class="trash-item">
      <div><div class="trash-item-main">⚙️ ${esc(c.nombre)}</div><div class="trash-item-sub">${NIVEL_LABEL[c.nivel]||''}</div></div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreCurso('${c.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteCurso('${c.id}')">Eliminar para siempre</button>
      </div>
    </div>`).join('');

  const colMap = {}; data.colegios.forEach(c => colMap[c.id] = c);
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  document.getElementById('trash-asig-list').innerHTML = tAsig.map(a => `
    <div class="trash-item">
      <div>
        <div class="trash-item-main">${esc(colMap[a.colegioId]?.nombre || 'Colegio eliminado')} · ${esc(a.anio)}</div>
        <div class="trash-item-sub">${esc(cursoMap[a.cursoId]?.nombre || 'Curso eliminado')} · ${Number(a.clases)||0} clases</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreAsig('${a.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteAsig('${a.id}')">Eliminar para siempre</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-part-list').innerHTML = tPart.map(t => `
    <div class="trash-item">
      <div>
        <div class="trash-item-main">${esc(colMap[t.colegioId]?.nombre || 'Colegio eliminado')} · ${esc(t.anio)}${t.grupo ? ' · Grupo ' + esc(t.grupo) : ''}</div>
        <div class="trash-item-sub">${t.estudiantes.length} estudiante(s) · Eliminado ${fmtDate(t.fechaEliminacion)}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreGenLista('${t.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteGenLista('${t.id}')">Eliminar para siempre</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-estudiantes-list').innerHTML = tEst.map(t => {
    const p = t.participante;
    const col = colMap[p.colegioId];
    const curso = cursoMap[p.cursoId];
    const colTxt = col ? col.nombre : '(colegio eliminado)';
    const cursoTxt = curso ? curso.nombre : (p.cursoId ? '(curso eliminado)' : '—');
    return `<div class="trash-item">
      <div>
        <div class="trash-item-main">${esc(p.username)} — ${esc(p.apellidos)} ${esc(p.nombres)}</div>
        <div class="trash-item-sub">${esc(colTxt)} · ${esc(cursoTxt)} · ${esc(p.anio||'')}${p.group1 ? ' · Grupo ' + esc(p.group1) : ''} · eliminado el ${fmtDate(t.fechaEliminacion)}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreEstudiante('${t.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteEstudiante('${t.id}')">Eliminar para siempre</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('trash-carnetlistas-list').innerHTML = tCarnet.map(l => {
    const nivelTxt = l.nivel === 'media' ? 'Media' : 'Primaria';
    return `<div class="trash-item">
      <div>
        <div class="trash-item-main">${nivelTxt} · Grado/Año ${esc(String(l.grado))}${l.seccion ? ' · Sección ' + esc(l.seccion) : ''}</div>
        <div class="trash-item-sub">${l.estudiantes.length} estudiante(s) · eliminada el ${fmtDate(l.fechaEliminacion)}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn btn-ghost" onclick="restoreCarnetLista('${l.id}')">↩ Restaurar</button>
        <button class="btn btn-red" onclick="permaDeleteCarnetLista('${l.id}')">Eliminar para siempre</button>
      </div>
    </div>`;
  }).join('');
}

function restoreCollege(id) {
  const idx = data.trash.colegios.findIndex(c => c.id === id);
  if (idx === -1) return;
  const [item] = data.trash.colegios.splice(idx, 1);
  data.colegios.push(item);
  saveData(); renderAll(); showToast('Colegio restaurado ✓');
}
function permaDeleteCollege(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.colegios = data.trash.colegios.filter(c => c.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function restoreCurso(id) {
  const idx = data.trash.cursos.findIndex(c => c.id === id);
  if (idx === -1) return;
  const [item] = data.trash.cursos.splice(idx, 1);
  data.cursos.push(item);
  saveData(); renderAll(); showToast('Curso modelo restaurado ✓');
}
function permaDeleteCurso(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.cursos = data.trash.cursos.filter(c => c.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function restoreAsig(id) {
  const idx = data.trash.asignaciones.findIndex(a => a.id === id);
  if (idx === -1) return;
  const [item] = data.trash.asignaciones.splice(idx, 1);
  data.asignaciones.push(item);
  saveData(); renderAll(); if (currentCollegeId) renderCollegeDetail(); showToast('Curso copiado restaurado ✓');
}
function permaDeleteAsig(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.asignaciones = data.trash.asignaciones.filter(a => a.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function restoreGenLista(id) {
  const idx = data.trash.participantes.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [item] = data.trash.participantes.splice(idx, 1);
  data.participantes.push(...item.estudiantes);
  saveData(); renderAll(); if (currentCollegeId) renderCollegeDetail(); showToast('Lista restaurada ✓');
}
function permaDeleteGenLista(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.participantes = data.trash.participantes.filter(t => t.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function restoreEstudiante(id) {
  const idx = data.trash.estudiantes.findIndex(t => t.id === id);
  if (idx === -1) return;
  const item = data.trash.estudiantes[idx];
  const p = item.participante;
  const colegioExiste = data.colegios.some(c => c.id === p.colegioId);
  const cursoExiste = data.cursos.some(c => c.id === p.cursoId);
  if (!colegioExiste || !cursoExiste) {
    showToast('Primero restaura el colegio/curso de este estudiante.');
    return;
  }
  data.trash.estudiantes.splice(idx, 1);

  const ocupado = data.participantes.some(x => String(x.username).toLowerCase() === String(p.username).toLowerCase());
  const restaurado = { ...p };
  if (ocupado) {
    const parsed = parseUsername(p.username);
    if (parsed) {
      const digits = p.nivel === 'primaria' ? 3 : 4;
      let maxNum = 0;
      data.participantes
        .filter(x => x.colegioId === p.colegioId)
        .forEach(x => {
          const pu = parseUsername(x.username);
          if (pu && pu.prefix.toLowerCase() === parsed.prefix.toLowerCase()) maxNum = Math.max(maxNum, pu.num);
        });
      const nuevoUsername = parsed.prefix + String(maxNum + 1).padStart(digits, '0');
      restaurado.username = nuevoUsername;
      restaurado.email = `${nuevoUsername}@${ACADEMIA_ACTUAL.emailDominio}`;
    }
  }
  data.participantes.push(restaurado);
  saveData();
  renderTrash();
  updateTrashBadge();
  renderGenYearsSummary();
  if (currentCollegeId === p.colegioId) renderCollegeParticipantes(p.colegioId);
  showToast(ocupado
    ? `Se restauró como ${restaurado.username} porque ${p.username} ya estaba ocupado.`
    : 'Estudiante restaurado ✓');
}
function permaDeleteEstudiante(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.estudiantes = data.trash.estudiantes.filter(t => t.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function restoreCarnetLista(id) {
  const idx = data.trash.carnetListas.findIndex(l => l.id === id);
  if (idx === -1) return;
  const item = data.trash.carnetListas[idx];
  const dup = data.carnetListas.find(l => l.nivel === item.nivel && l.grado === item.grado && l.seccion === item.seccion);
  if (dup) {
    const nivelTxt = dup.nivel === 'media' ? 'Media' : 'Primaria';
    if (!confirm(`Ya existe una lista de ${nivelTxt} · ${dup.grado}${dup.seccion ? ' · Sección ' + dup.seccion : ''}. ¿Reemplazarla? La actual se moverá a la Papelera.`)) return;
    data.carnetListas = data.carnetListas.filter(l => l.id !== dup.id);
    data.trash.carnetListas.push({ ...dup, fechaEliminacion: todayStr() });
  }
  data.trash.carnetListas.splice(idx, 1);
  const restaurado = { ...item };
  delete restaurado.fechaEliminacion;
  if (data.carnetListas.some(l => l.id === restaurado.id)) restaurado.id = uid();
  data.carnetListas.push(restaurado);
  saveData();
  renderTrash();
  updateTrashBadge();
  if (window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
  showToast('Lista de carnets restaurada ✓');
}
function permaDeleteCarnetLista(id) {
  if (!confirm('Esta acción no se puede deshacer. ¿Eliminar para siempre?')) return;
  data.trash.carnetListas = data.trash.carnetListas.filter(l => l.id !== id);
  saveData(); renderTrash(); updateTrashBadge(); showToast('Eliminado permanentemente');
}

function emptyTrash() {
  const total = trashTotal();
  if (!total) return;
  if (!confirm(`Se eliminarán ${total} elemento(s) para siempre. ¿Continuar?`)) return;
  data.trash = { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] };
  saveData(); renderTrash(); updateTrashBadge();
  if (window.Carnets && typeof window.Carnets.render === 'function') window.Carnets.render();
  showToast('Papelera vaciada');
}
