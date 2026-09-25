/* ════════════════════════════════════════════════════════════
   TecnoCleveland · Organizador Moodle
   Todo se guarda en localStorage (navegador). Ver "Respaldo" en
   la app para exportar/importar un archivo .json de seguridad.
   ════════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'tc_organizador_data';

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

/* ── PERSISTENCIA ── */
function freshData() {
  return {
    colegios: DEFAULT_COLEGIOS.map(nombre => ({ id: uid(), nombre })),
    cursos: DEFAULT_CURSOS.map(c => ({ id: uid(), nombre: c.nombre, nivel: c.nivel })),
    asignaciones: [],
    participantes: [],
    trash: { colegios: [], cursos: [], asignaciones: [], participantes: [] }
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
      trash: {
        colegios: trash.colegios || [],
        cursos: trash.cursos || [],
        asignaciones: trash.asignaciones || [],
        participantes: trash.participantes || []
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
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  const savedUser = sessionStorage.getItem('tcUser') || 'Administrador';
  document.getElementById('sidebar-user').textContent = savedUser;
  document.getElementById('greet-user').textContent = savedUser;

  document.getElementById('dashboard-date').textContent =
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (localStorage.getItem('tc_dark') === '1') {
    document.body.classList.add('dark');
  }

  renderAll();

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
  if (id === 'cursos') renderCursos();
  if (id === 'trash') renderTrash();
  if (id === 'dashboard') renderDashboard();

  document.querySelector('.sidebar').classList.remove('sidebar-active');
  document.getElementById('sidebar-overlay').classList.remove('active');
  window.scrollTo(0,0);
}

function logout() {
  sessionStorage.removeItem('tcUser');
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

  const body = document.getElementById('cd-asig-body');
  const empty = document.getElementById('cd-asig-empty');
  const asigsSorted = [...s.asigs].sort((a,b) => (a.anio||'').localeCompare(b.anio||''));

  if (!asigsSorted.length) {
    body.innerHTML = ''; empty.style.display = '';
  } else {
    empty.style.display = 'none';
    body.innerHTML = asigsSorted.map(a => {
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

  renderCollegeParticipantes(col.id);
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
  const anios = [...new Set(data.asignaciones.filter(a => a.colegioId === colegioId).map(a => a.anio))]
    .sort((a,b) => (a||'').localeCompare(b||''));

  if (!anios.length) {
    sel.innerHTML = `<option value="">Sin años asignados</option>`;
    sel.disabled = true;
    genAnioSel = null;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = anios.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  if (selectedAnio && anios.includes(selectedAnio)) sel.value = selectedAnio;
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

  const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + escPrefix + '(\\d+)$');
  let maxNum = 0;
  data.participantes
    .filter(p => p.colegioId === genColegioId)
    .forEach(p => {
      const m = re.exec(p.username || '');
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
  const start = maxNum + 1;

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const num = String(start + i).padStart(4, '0');
    const username = prefix + num;
    const nombres = noLines[i];
    rows.push({
      username, password,
      firstname: `${username} ${nombres}`,
      lastname: apLines[i],
      email: `${username}@tecno.com`,
      city, country: 'Venezuela',
      course1: nombreCorto,
      group1, role1: 'student', enrolperiod1: '365d', suspended: '0'
    });
  }

  genPreviewRows = rows;
  genPreviewCtx = { colegioId: genColegioId, cursoId: genAsig.cursoId, anio: genAnioSel, group1 };
  renderGenPreviewTable();
  document.getElementById('gen-preview-card').style.display = '';
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
    }).join('') + '</tr>';
  }).join('');
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
  row.email = `${newUsername}@tecno.com`;
  const fnInput = document.getElementById(`gp-firstname-${i}`);
  const emInput = document.getElementById(`gp-email-${i}`);
  if (fnInput) fnInput.value = row.firstname;
  if (emInput) emInput.value = row.email;
}

function guardarListaUsuarios() {
  if (!genPreviewRows.length || !genPreviewCtx) { showToast('Genera una lista primero'); return; }
  const { colegioId, cursoId, anio, group1 } = genPreviewCtx;
  const grupoKey = group1 || '';
  const existing = data.participantes.filter(p => p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && (p.group1||'') === grupoKey);
  if (existing.length) {
    const grupoTxt = grupoKey ? ` (grupo "${grupoKey}")` : '';
    if (!confirm(`¿Reemplazar la lista ya generada para este año${grupoTxt}?`)) return;
    data.participantes = data.participantes.filter(p => !(p.colegioId === colegioId && p.cursoId === cursoId && p.anio === anio && (p.group1||'') === grupoKey));
  }
  const fecha = todayStr();
  genPreviewRows.forEach(r => {
    let nombres = r.firstname;
    if (r.username && r.firstname.startsWith(r.username + ' ')) {
      nombres = r.firstname.slice(r.username.length + 1);
    }
    data.participantes.push({
      id: uid(), colegioId, cursoId, anio,
      username: r.username, password: r.password,
      nombres, apellidos: r.lastname,
      email: r.email, city: r.city, country: r.country,
      course1: r.course1, group1: r.group1, role1: r.role1,
      enrolperiod1: r.enrolperiod1, suspended: r.suspended,
      fecha
    });
  });
  saveData();
  showToast('Lista guardada ✓');
  renderGenYearsSummary();
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
  const body = document.getElementById('gen-years-body');
  const empty = document.getElementById('gen-years-empty');
  if (!genColegioId) { body.innerHTML = ''; empty.style.display = ''; return; }

  const mine = data.participantes.filter(p => p.colegioId === genColegioId);
  const groupsMap = {};
  mine.forEach(p => {
    const grupoKey = p.group1 || '';
    const key = (p.anio||'') + ' ' + grupoKey;
    if (!groupsMap[key]) groupsMap[key] = { anio: p.anio, grupo: grupoKey, rows: [] };
    groupsMap[key].rows.push(p);
  });
  const groups = Object.values(groupsMap).sort((a,b) =>
    (a.anio||'').localeCompare(b.anio||'') || (a.grupo||'').localeCompare(b.grupo||''));

  if (!groups.length) { body.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

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
  genPreviewCtx = { colegioId: genColegioId, cursoId: rows[0].cursoId || genAsig.cursoId, anio, group1: grupo };
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

/* ════════════════════════════════════════════════════════════
   PARTICIPANTES (dentro del detalle de un colegio)
   ════════════════════════════════════════════════════════════ */
function renderCollegeParticipantes(colegioId) {
  const sel = document.getElementById('cd-part-anio');
  const wrap = document.getElementById('cd-part-selector-wrap');
  const tableWrap = document.querySelector('#cd-participantes-card .table-wrap');
  const actions = document.getElementById('cd-part-actions');
  const empty = document.getElementById('cd-part-empty');

  const anios = [...new Set(data.participantes.filter(p => p.colegioId === colegioId).map(p => p.anio))]
    .sort((a,b) => (a||'').localeCompare(b||''));

  if (!anios.length) {
    wrap.style.display = 'none';
    tableWrap.style.display = 'none';
    actions.style.display = 'none';
    empty.style.display = '';
    return;
  }
  wrap.style.display = '';
  tableWrap.style.display = '';
  actions.style.display = '';
  empty.style.display = 'none';

  const prevSel = sel.value;
  sel.innerHTML = anios.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
  if (prevSel && anios.includes(prevSel)) sel.value = prevSel;

  onCdPartAnioChange();
}

function onCdPartAnioChange() {
  if (!currentCollegeId) return;
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

function renderCollegeParticipantesTable() {
  if (!currentCollegeId) return;
  const anio = document.getElementById('cd-part-anio').value;
  const grupoWrap = document.getElementById('cd-part-grupo-wrap');
  const grupoSel = document.getElementById('cd-part-grupo');
  const grupo = grupoWrap.style.display !== 'none' ? grupoSel.value : '';

  const body = document.getElementById('cd-part-body');
  const rows = data.participantes
    .filter(p => p.colegioId === currentCollegeId && p.anio === anio && (grupo === '' || (p.group1||'') === grupo))
    .sort((a,b) => a.username.localeCompare(b.username));
  body.innerHTML = rows.map(p => `<tr>
    <td><code>${esc(p.username)}</code></td>
    <td>${esc(p.password)}</td>
    <td>${esc(p.nombres)}</td>
    <td>${esc(p.apellidos)}</td>
  </tr>`).join('');
}

function buildParticipantesCSV(rows) {
  const header = 'usuario,clave,nombres,apellidos';
  const lines = rows.map(p => [p.username, p.password, p.nombres, p.apellidos].join(','));
  return [header, ...lines].join('\n');
}

function descargarCSVParticipantesColegio() {
  if (!currentCollegeId) return;
  const anio = document.getElementById('cd-part-anio').value;
  const grupoWrap = document.getElementById('cd-part-grupo-wrap');
  const grupoSel = document.getElementById('cd-part-grupo');
  const grupo = grupoWrap.style.display !== 'none' ? grupoSel.value : '';
  const rows = data.participantes.filter(p => p.colegioId === currentCollegeId && p.anio === anio && (grupo === '' || (p.group1||'') === grupo));
  if (!rows.length) return;
  const col = data.colegios.find(c => c.id === currentCollegeId);
  const csv = buildParticipantesCSV(rows);
  const grupoSuffix = grupo ? `_${slugify(grupo)}` : '';
  downloadFile(csv, `participantes_${slugify(col ? col.nombre : 'colegio')}_${slugify(anio)}${grupoSuffix}.csv`, 'text/csv;charset=utf-8;');
  showToast('CSV descargado ✓');
}

/* ════════════════════════════════════════════════════════════
   BUSCAR
   ════════════════════════════════════════════════════════════ */
function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function onSearchInput() {
  const q = normalize(document.getElementById('search-input').value.trim());
  const box = document.getElementById('search-suggestions');
  if (!q) {
    box.style.display = 'none';
    document.getElementById('search-result').style.display = 'none';
    document.getElementById('search-empty').style.display = '';
    return;
  }
  const matches = data.colegios.filter(c => normalize(c.nombre).includes(q)).sort((a,b) => a.nombre.localeCompare(b.nombre)).slice(0, 8);
  if (!matches.length) {
    box.innerHTML = `<div class="search-suggestion-item" style="color:var(--text-muted)">Sin coincidencias</div>`;
    box.style.display = '';
    document.getElementById('search-result').style.display = 'none';
    document.getElementById('search-empty').style.display = '';
    return;
  }
  box.innerHTML = matches.map(c => `<div class="search-suggestion-item" onclick="selectSearchResult('${c.id}')">🏫 ${esc(c.nombre)}</div>`).join('');
  box.style.display = '';
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
  downloadFile(csv, `reporte_tecnocleveland_${todayStr()}.csv`, 'text/csv;charset=utf-8;');
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
  downloadFile(JSON.stringify(data, null, 2), `respaldo_tecnocleveland_${todayStr()}.json`, 'application/json');
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
      if (!confirm('Esto reemplazará todos los datos actuales en este navegador con los del archivo. ¿Continuar?')) return;
      const trash = parsed.trash || {};
      data = {
        colegios: parsed.colegios || [],
        cursos: parsed.cursos || [],
        asignaciones: parsed.asignaciones || [],
        participantes: parsed.participantes || [],
        trash: {
          colegios: trash.colegios || [],
          cursos: trash.cursos || [],
          asignaciones: trash.asignaciones || [],
          participantes: trash.participantes || []
        }
      };
      saveData();
      renderAll();
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
  data.colegios = fresh.colegios;
  data.cursos = fresh.cursos;
  saveData();
  renderAll();
  showToast('Catálogos restablecidos ✓');
}

/* ════════════════════════════════════════════════════════════
   PAPELERA
   ════════════════════════════════════════════════════════════ */
function updateTrashBadge() {
  const total = data.trash.colegios.length + data.trash.cursos.length + data.trash.asignaciones.length + data.trash.participantes.length;
  const badge = document.getElementById('trash-count-badge');
  if (total > 0) { badge.textContent = total; badge.style.display = ''; }
  else badge.style.display = 'none';
}

function renderTrash() {
  const tCol = data.trash.colegios, tCur = data.trash.cursos, tAsig = data.trash.asignaciones, tPart = data.trash.participantes;
  const total = tCol.length + tCur.length + tAsig.length + tPart.length;

  document.getElementById('trash-colegios-section').style.display = tCol.length ? '' : 'none';
  document.getElementById('trash-cursos-section').style.display = tCur.length ? '' : 'none';
  document.getElementById('trash-asig-section').style.display = tAsig.length ? '' : 'none';
  document.getElementById('trash-part-section').style.display = tPart.length ? '' : 'none';
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

function emptyTrash() {
  const total = data.trash.colegios.length + data.trash.cursos.length + data.trash.asignaciones.length + data.trash.participantes.length;
  if (!total) return;
  if (!confirm(`Se eliminarán ${total} elemento(s) para siempre. ¿Continuar?`)) return;
  data.trash = { colegios: [], cursos: [], asignaciones: [], participantes: [] };
  saveData(); renderTrash(); updateTrashBadge(); showToast('Papelera vaciada');
}
