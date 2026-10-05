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
});

function renderAll() {
  renderDashboard();
  renderColegios();
  renderCursos();
  renderGenerador();
  renderBuscar();
  renderTrash();
  updateTrashBadge();
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
    const a = asigsCollege.find(a => a.anio === anio);
    return a ? (cursoMap[a.cursoId] || {}).nivel : null;
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
  genPreviewRows = [];
  genPreviewCtx = null;
  genPreviewSaved = false;
  genEliminarCtx = null;
  document.getElementById('gen-preview-card').style.display = 'none';
  hideGenError();
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
      const pNivel = p.nivel || (cursoMap[p.cursoId] || {}).nivel;
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
        const nombres = spaceIdx === -1 ? '' : firstRaw.slice(spaceIdx + 1).trim();

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
          email: `${username}@${ACADEMIA_ACTUAL.emailDominio}`,
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
    return '<tr>' + GEN_COLS.map(col => {
      const id = `gp-${col}-${i}`;
      const handler = col === 'username'
        ? `onchange="onGenUsernameEdit(${i}, this.value)"`
        : `oninput="onGenFieldEdit(${i}, '${col}', this.value)"`;
      return `<td><input class="table-input" id="${id}" value="${esc(r[col])}" ${handler}></td>`;
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
  partes.push(`${genPreviewRows.length} estudiante${genPreviewRows.length === 1 ? '' : 's'}`);
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

function guardarListaUsuarios() {
  if (!genPreviewRows.length || !genPreviewCtx) { showToast('Genera una lista primero'); return; }
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

function descargarCSVPreview() {
  if (!genPreviewRows.length) return;
  const col = data.colegios.find(c => c.id === genColegioId);
  const csv = buildUsuariosCSV(genPreviewRows);
  const filename = `usuarios_${slugify(col ? col.nombre : 'colegio')}_${slugify(genAnioSel || '')}.csv`;
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

  const nivelOf = g => (cursoMap[g.cursoId] || {}).nivel;
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
    const first = rows[0].username, last = rows[rows.length - 1].username;
    return `<tr>
      <td><b>${esc(g.anio)}</b></td>
      <td>${esc(g.grupo || '—')}</td>
      <td>${rows.length}</td>
      <td><code>${esc(first)} – ${esc(last)}</code></td>
      <td class="row-actions">
        <button class="btn btn-ghost" data-anio="${esc(g.anio)}" data-grupo="${esc(g.grupo)}" onclick="verEditarGenYear(this.dataset.anio, this.dataset.grupo)">Ver/Editar</button>
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
    group1: p.group1, role1: p.role1, enrolperiod1: p.enrolperiod1, suspended: p.suspended
  }));
  const cursoIdCtx = rows[0].cursoId || genAsig.cursoId;
  const nivelCtx = rows[0].nivel || (data.cursos.find(c => c.id === cursoIdCtx) || {}).nivel;
  genPreviewCtx = { colegioId: genColegioId, cursoId: cursoIdCtx, anio, nivel: nivelCtx, group1: grupo };
  genPreviewSaved = true;
  renderGenPreviewTable();
  const card = document.getElementById('gen-preview-card');
  card.style.display = '';
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const col = data.colegios.find(c => c.id === genColegioId);
  const csv = buildUsuariosCSV(csvRows);
  const grupoSuffix = grupo ? `_${slugify(grupo)}` : '';
  downloadFile(csv, `usuarios_${slugify(col ? col.nombre : 'colegio')}_${slugify(anio)}${grupoSuffix}.csv`, 'text/csv;charset=utf-8;');
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
  renderGenYearsSummary();
  if (currentCollegeId === genColegioId) renderCollegeParticipantes(genColegioId);
  renderTrash();
  updateTrashBadge();
  showToast('Lista movida a la papelera');
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
    return;
  }
  wrap.style.display = '';
  searchWrap.style.display = '';
  tableWrap.style.display = '';
  actions.style.display = '';
  empty.style.display = 'none';

  // Agrupado Media/Primaria, misma estructura y orden que fillGenAnioSelect().
  const nivelOf = anio => (mine.find(p => p.anio === anio) || {}).nivel;
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
  const nivel = (data.participantes.find(p => p.colegioId === currentCollegeId && p.anio === anio) || {}).nivel;
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
  const col = data.colegios.find(c => c.id === currentCollegeId);
  const aoa = [['usuario','clave','nombres','apellidos'], ...rows.map(p => [p.username, p.password, p.nombres, p.apellidos])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participantes');
  const grupoSuffix = grupo ? `_${slugify(grupo)}` : '';
  XLSX.writeFile(wb, `participantes_${slugify(col ? col.nombre : 'colegio')}_${slugify(anio)}${grupoSuffix}.xlsx`);
  showToast('XLSX descargado ✓');
}

/* ════════════════════════════════════════════════════════════
   BUSCAR
   ════════════════════════════════════════════════════════════ */
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

function exportBackup() {
  const payload = { ...data, _academia: ACADEMIA_ACTUAL.id };
  downloadFile(JSON.stringify(payload, null, 2), `respaldo_${ACADEMIA_ACTUAL.id}_${todayStr()}.json`, 'application/json');
  showToast('Respaldo descargado ✓');
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
      if (!confirm('Esto reemplazará todos los datos actuales en este navegador con los del archivo. ¿Continuar?')) return;
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
      showToast('Respaldo importado ✓');
    } catch (e) {
      console.error(e);
      showToast('⚠ El archivo no es un respaldo válido');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

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
