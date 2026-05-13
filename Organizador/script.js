import { db } from './firebase-config.js';
import { ref, set, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ══ SESIÓN ══
const _orgUser = sessionStorage.getItem('orgUser');
if (!_orgUser) {
  window.location.replace('login.html');
  throw new Error('Unauthenticated');
}
const USER_PATH = _orgUser + '/';
const USER_NAME  = _orgUser === 'dreha' ? 'Andrea' : 'Ale';

const _loader = document.getElementById('app-loader');
if (_loader) _loader.style.display = 'none';

// ══ ESTADO LOCAL ══
let tasks      = [];
let notes      = [];
let reminders  = {};
let trash      = { tasks:[], notes:[], colleges:[], teachers:[], visits:[], evals:[], todos:[], reminders:[] };
let actividades = [];
let colleges  = [];

let editingTaskId     = null;
let editingStatus     = 'pendiente';
let editingNoteId     = null;
let selectedNoteColor = 0;
let calDate           = new Date();
let selectedCalDay    = null;
let dragSrcId         = null;

const NOTE_COLORS = [
  '#FFFEF5','#EBF5EC','#E8F0FB','#FDEEED','#F2EFFE','#FEF9E7',
  '#FEF3E0','#E2F7FB','#FCEEF3','#EAFBF2','#F3F5FB','#FEF6ED',
  '#EFFBEF','#EEF4FF','#FDF0FA','#FDFCE8'
];

// ══ FIREBASE HELPERS ══
function toArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : Object.values(v);
}
function fbSetTask(id, data)    { set(ref(db, USER_PATH + 'tasks/'    + id), data); }
function fbRemoveTask(id)       { remove(ref(db, USER_PATH + 'tasks/' + id)); }
function fbSetNote(id, data)    { set(ref(db, USER_PATH + 'notes/'    + id), data); }
function fbRemoveNote(id)       { remove(ref(db, USER_PATH + 'notes/' + id)); }
function fbSetCollege(id, data) { set(ref(db, USER_PATH + 'colleges/' + id), data); }
function fbRemoveCollege(id)    { remove(ref(db, USER_PATH + 'colleges/' + id)); }
function fbSaveReminders()      { set(ref(db, USER_PATH + 'reminders'), reminders); }
function fbSaveTrash()          { set(ref(db, USER_PATH + 'trash'), trash); }

function saveColleges() {
  const obj = {};
  colleges.forEach(c => { obj[c.id] = c; });
  set(ref(db, USER_PATH + 'colleges'), obj);
}

// ══ NAVEGACIÓN — estado activo ══
let currentView = 'dashboard';
const _unsub = {};
let calInitialized = false;

// ══ LISTENERS EN TIEMPO REAL ══
_unsub.tasks = onValue(ref(db, USER_PATH + 'tasks'), snap => {
  tasks = snap.val() ? Object.values(snap.val()) : [];
  if (currentView === 'tasks')     renderTasks();
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'calendar')  renderCalendar();
});

_unsub.notes = onValue(ref(db, USER_PATH + 'notes'), snap => {
  notes = snap.val()
    ? Object.values(snap.val()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    : [];
  if (currentView === 'notes') renderNotes();
});

_unsub.reminders = onValue(ref(db, USER_PATH + 'reminders'), snap => {
  reminders = snap.val() || {};
  if (currentView === 'calendar') {
    renderCalendar();
    if (selectedCalDay) renderDayReminders(selectedCalDay);
  }
});

_unsub.trash = onValue(ref(db, USER_PATH + 'trash'), snap => {
  const v = snap.val() || {};
  trash = {
    tasks:     toArray(v.tasks),
    notes:     toArray(v.notes),
    colleges:  toArray(v.colleges),
    teachers:  toArray(v.teachers),
    visits:    toArray(v.visits),
    evals:     toArray(v.evals),
    todos:     toArray(v.todos),
    reminders: toArray(v.reminders),
  };
  updateTrashBadge();
  if (currentView === 'trash') renderTrash();
});

_unsub.colleges = onValue(ref(db, USER_PATH + 'colleges'), snap => {
  const v = snap.val();
  colleges = v ? Object.values(v).map(c => ({
    ...c,
    teachers:    toArray(c.teachers),
    visits:      toArray(c.visits),
    evaluations: toArray(c.evaluations),
    todos:       toArray(c.todos),
  })) : [];
  if (currentView === 'colleges') {
    renderColleges();
    populateCollegeSelect();
    if (currentCollegeId) { renderTeachers(); renderVisits(); renderEvals(); renderCollegeTodos(); }
  }
  if (currentView === 'calendar') renderCalendar();
  if (currentView === 'reportes') { populateCollegeSelect(); updateTeacherSelect(); }
});

// ══ UTILIDADES ══
function updateTrashBadge() {
  const total = (trash.tasks||[]).length + (trash.notes||[]).length +
    (trash.colleges||[]).length + (trash.teachers||[]).length +
    (trash.visits||[]).length + (trash.evals||[]).length + (trash.todos||[]).length +
    (trash.reminders||[]).length;
  const badge = document.getElementById('trash-count-badge');
  if (badge) { badge.textContent = total; badge.style.display = total ? '' : 'none'; }
}

function sendToTrash(type, item) {
  if (!trash[type]) trash[type] = [];
  trash[type].unshift({ ...item, deletedAt: new Date().toISOString() });
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(d) {
  if (!d) return '';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function fmtNoteDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

// ══ MODO OSCURO ══
function toggleDark() {
  document.body.classList.toggle('dark');
  localStorage.setItem('flow_dark', document.body.classList.contains('dark') ? '1' : '0');
}
if (localStorage.getItem('flow_dark') === '1') document.body.classList.add('dark');

// ══ NAVEGACIÓN ══
const NAV_VIEWS = ['dashboard','tasks','calendar','notes','colleges','reportes','trash'];
function showView(id) {
  currentView = id;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-'+id).classList.add('active');
  const idx = NAV_VIEWS.indexOf(id);
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  if (id==='dashboard') renderDashboard();
  if (id==='tasks')     renderTasks();
  if (id==='calendar')  { calInitialized = true; cleanOrphanVisits(); renderCalendar(); setTimeout(() => window.dispatchEvent(new Event('resize')), 220); }
  if (id==='notes')     renderNotes();
  if (id==='trash')     renderTrash();
  if (id==='colleges')  renderColleges();
  if (id==='reportes')  { populateCollegeSelect(); updateTeacherSelect(); renderActividades(); updateReportPreview(); }
}

// ══ DASHBOARD ══
function renderDashboard() {
  document.getElementById('stat-total').textContent      = tasks.length;
  document.getElementById('stat-pending').textContent    = tasks.filter(t=>t.status==='pendiente').length;
  document.getElementById('stat-inprogress').textContent = tasks.filter(t=>t.status==='proceso').length;
  document.getElementById('stat-done').textContent       = tasks.filter(t=>t.status==='completado').length;

  const alta  = tasks.filter(t=>t.priority==='alta' && t.status!=='completado');
  const progr = tasks.filter(t=>t.status==='proceso');
  document.getElementById('dash-alta-count').textContent = alta.length;
  document.getElementById('dash-prog-count').textContent = progr.length;

  document.getElementById('dash-alta-list').innerHTML = alta.length
    ? alta.map(t=>`<div class="day-task-item" onclick="openTaskModal(${t.id})"><div class="day-dot" style="background:var(--trash-color)"></div>${esc(t.title)}</div>`).join('')
    : `<div class="empty-state"><div class="icon">🌼</div><div class="empty-msg">Sin urgencias hoy</div></div>`;

  document.getElementById('dash-prog-list').innerHTML = progr.length
    ? progr.map(t=>`<div class="day-task-item" onclick="openTaskModal(${t.id})"><div class="day-dot" style="background:var(--blue)"></div>${esc(t.title)}</div>`).join('')
    : `<div class="empty-state"><div class="icon">🐱</div><div class="empty-msg">Todo en calma</div></div>`;

  const now = new Date();
  const D = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const M = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  document.getElementById('dashboard-date').textContent =
    `${D[now.getDay()]}, ${now.getDate()} de ${M[now.getMonth()]} de ${now.getFullYear()}`;
}

// ══ TAREAS ══
function openFormExtra() {
  const extra = document.getElementById('form-extra');
  if (!extra.classList.contains('open')) {
    extra.classList.add('open');
    document.getElementById('form-toggle-btn').textContent = '− Detalles';
  }
}
function toggleFormExtra() {
  const extra = document.getElementById('form-extra');
  const btn = document.getElementById('form-toggle-btn');
  if (extra.classList.contains('open')) {
    extra.classList.remove('open');
    btn.textContent = '＋ Detalles';
  } else {
    extra.classList.add('open');
    btn.textContent = '− Detalles';
    document.getElementById('task-desc').focus();
  }
}

function addTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { alert('Escribe un título para la tarea'); return; }
  const id = Date.now();
  fbSetTask(id, {
    id,
    title,
    desc:     document.getElementById('task-desc').value.trim(),
    status:   document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    date:     document.getElementById('task-date').value,
    tag:      document.getElementById('task-tag').value.trim(),
    created:  new Date().toISOString()
  });
  clearTaskForm();
}

function clearTaskForm() {
  ['task-title','task-desc','task-date','task-tag'].forEach(id => document.getElementById(id).value='');
  document.getElementById('task-status').value='pendiente';
  document.getElementById('task-priority').value='baja';
  document.getElementById('form-extra').classList.remove('open');
  document.getElementById('form-toggle-btn').textContent = '＋ Detalles';
}

function pClass(p) {
  return {alta:'priority-alta',media:'priority-media',baja:'priority-baja'}[p]||'';
}

function taskCardHTML(t) {
  return `
    <div class="task-card" onclick="openTaskModal(${t.id})">
      <div class="task-card-title">${esc(t.title)}</div>
      ${t.desc?`<div class="task-card-desc">${esc(t.desc)}</div>`:''}
      <div class="task-card-meta">
        <span class="task-tag ${pClass(t.priority)}">${t.priority}</span>
        ${t.tag?`<span class="task-tag" style="background:var(--surface);border:1.5px solid var(--border)">${esc(t.tag)}</span>`:''}
        ${t.date?`<span class="task-date-badge">🗓 ${fmtDate(t.date)}</span>`:''}
      </div>
    </div>`;
}

function renderTasks() {
  ['pendiente','proceso','completado'].forEach(s=>{
    const filtered = tasks.filter(t=>t.status===s);
    document.getElementById('count-'+s).textContent = filtered.length;
    const emptyIcons = {completado:'🌸',proceso:'🌼',pendiente:'🌱'};
    const emptyMsgs  = {completado:'Aún sin logros aquí',proceso:'Nada en marcha',pendiente:'Sin pendientes 🎉'};
    document.getElementById('col-'+s).innerHTML = filtered.length
      ? filtered.map(taskCardHTML).join('')
      : `<div class="empty-state"><div class="icon">${emptyIcons[s]}</div><div class="empty-msg">${emptyMsgs[s]}</div></div>`;
  });
}

// ══ MODAL EDITAR TAREA ══
function openTaskModal(id) {
  editingTaskId = id;
  const t = tasks.find(t=>t.id===id);
  document.getElementById('edit-title').value    = t.title;
  document.getElementById('edit-desc').value     = t.desc||'';
  document.getElementById('edit-priority').value = t.priority;
  document.getElementById('edit-date').value     = t.date||'';
  document.getElementById('edit-tag').value      = t.tag||'';
  setEditStatus(t.status);
  document.getElementById('task-modal').classList.add('active');
}

function setEditStatus(s) {
  editingStatus = s;
  ['pendiente','proceso','completado'].forEach(x=>{
    const p = document.getElementById('pill-'+x);
    p.className = 'status-pill';
    if (x===s) p.classList.add('active-'+x);
  });
}

function saveEditTask() {
  const t = tasks.find(t=>t.id===editingTaskId);
  const title = document.getElementById('edit-title').value.trim();
  if (!title) { alert('El título no puede estar vacío'); return; }
  fbSetTask(editingTaskId, {
    ...t,
    title,
    desc:     document.getElementById('edit-desc').value.trim(),
    status:   editingStatus,
    priority: document.getElementById('edit-priority').value,
    date:     document.getElementById('edit-date').value,
    tag:      document.getElementById('edit-tag').value.trim(),
  });
  closeTaskModal();
}

function deleteEditingTask() {
  const t = tasks.find(t=>t.id===editingTaskId);
  if (!t) return;
  sendToTrash('tasks', t);
  fbRemoveTask(editingTaskId);
  fbSaveTrash();
  closeTaskModal();
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('active');
  editingTaskId = null;
}

// ══ CALENDARIO ══
function cleanOrphanVisits() {
  const activeIds = new Set(colleges.map(c => c.id));
  const trashIds  = new Set((trash.colleges||[]).map(c => c.id));
  const before    = (trash.visits||[]).length;
  trash.visits = (trash.visits||[]).filter(v =>
    activeIds.has(v.collegeId) || trashIds.has(v.collegeId)
  );
  if (trash.visits.length !== before) fbSaveTrash();
}

const MNAMES    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MNAMES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function renderCalendar() {
  document.getElementById('cal-month-label').textContent =
    `${MNAMES[calDate.getMonth()]} ${calDate.getFullYear()}`;

  const firstDay    = new Date(calDate.getFullYear(), calDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth()+1, 0).getDate();
  const daysInPrev  = new Date(calDate.getFullYear(), calDate.getMonth(),   0).getDate();
  const today       = new Date();

  const taskDates     = new Set(tasks.filter(t=>t.date).map(t=>t.date));
  const reminderDates = new Set(Object.keys(reminders).filter(k=>reminders[k]?.length));

  const visitDatesMap = {};
  colleges.forEach(c => {
    (c.visits || []).forEach(v => {
      if (!v.date) return;
      if (!visitDatesMap[v.date]) visitDatesMap[v.date] = [];
      visitDatesMap[v.date].push({ purpose: v.purpose, collegeName: c.name });
    });
  });

  const container = document.getElementById('cal-days');
  container.innerHTML = '';

  let cells = [];
  for (let i=firstDay-1;i>=0;i--) cells.push({day:daysInPrev-i,current:false});
  for (let d=1;d<=daysInMonth;d++) cells.push({day:d,current:true});
  let nx=1;
  while (cells.length<42) cells.push({day:nx++,current:false});

  cells.forEach(cell=>{
    const el = document.createElement('div');
    el.className = 'cal-day';
    const dateStr = cell.current
      ? `${calDate.getFullYear()}-${String(calDate.getMonth()+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
      : null;

    if (!cell.current) { el.classList.add('other-month'); }
    else {
      const isToday = cell.day===today.getDate() && calDate.getMonth()===today.getMonth() && calDate.getFullYear()===today.getFullYear();
      if (isToday) el.classList.add('today');
      if (dateStr===selectedCalDay) el.classList.add('selected');
      el.onclick = ()=>selectDay(dateStr,cell.day);
    }

    el.textContent = cell.day;

    if (dateStr && (taskDates.has(dateStr)||reminderDates.has(dateStr)||visitDatesMap[dateStr])) {
      const row = document.createElement('div'); row.className='dot-row';
      if (taskDates.has(dateStr))     { const d=document.createElement('div'); d.className='dot dot-task';     row.appendChild(d); }
      if (reminderDates.has(dateStr)) { const d=document.createElement('div'); d.className='dot dot-reminder'; row.appendChild(d); }
      if (visitDatesMap[dateStr])     { const d=document.createElement('div'); d.className='dot dot-visit';    row.appendChild(d); }
      el.appendChild(row);
    }
    container.appendChild(el);
  });
}

function changeMonth(dir) {
  calDate = new Date(calDate.getFullYear(), calDate.getMonth()+dir, 1);
  renderCalendar();
}

function selectDay(dateStr,day) {
  selectedCalDay = dateStr;
  document.getElementById('day-panel-title').textContent = `${day} de ${MNAMES_ES[calDate.getMonth()]}`;
  document.getElementById('btn-add-reminder').style.display='';
  document.getElementById('day-reminders-section').style.display='';

  const dayTasks = tasks.filter(t=>t.date===dateStr);
  const dotColors = {pendiente:'var(--pending-color)',proceso:'var(--blue)',completado:'var(--green)'};
  document.getElementById('day-panel-tasks').innerHTML = dayTasks.length
    ? dayTasks.map(t=>`<div class="day-task-item" onclick="openTaskModal(${t.id})"><div class="day-dot" style="background:${dotColors[t.status]}"></div><span style="flex:1">${esc(t.title)}</span><span class="task-tag ${pClass(t.priority)}" style="font-size:10px">${t.priority}</span></div>`).join('')
    : '<div style="font-size:13px;color:var(--text-muted);padding:6px 0;font-weight:600">Sin tareas este día 🌿</div>';

  renderDayVisits(dateStr);
  renderDayReminders(dateStr);
  renderCalendar();
}

function renderDayVisits(dateStr) {
  const visitList = [];
  colleges.forEach(c => {
    (c.visits || []).forEach(v => {
      if (v.date === dateStr) visitList.push({ purpose: v.purpose, collegeName: c.name });
    });
  });
  const section = document.getElementById('day-visits-section');
  const container = document.getElementById('day-panel-visits');
  section.style.display = visitList.length ? '' : 'none';
  container.innerHTML = visitList.map(v =>
    `<div class="day-task-item">
       <div class="day-dot" style="background:var(--pink)"></div>
       <div style="flex:1">
         <div style="font-weight:600;font-size:13px">${esc(v.purpose)}</div>
         <div style="font-size:11px;color:var(--text-muted)">${esc(v.collegeName)}</div>
       </div>
     </div>`
  ).join('');
}

function renderDayReminders(dateStr) {
  const list = reminders[dateStr]||[];
  document.getElementById('day-panel-reminders').innerHTML = list.length
    ? list.map((r,i)=>`
        <div class="reminder-item">
          <span class="r-icon">🔔</span>
          <div style="flex:1">
            <div class="r-text">${esc(r.text)}</div>
            ${r.time?`<div class="r-time">${r.time}</div>`:''}
          </div>
          <button class="reminder-del" onclick="deleteReminder('${dateStr}',${i})" title="Eliminar">✕</button>
        </div>`).join('')
    : '<div style="font-size:13px;color:var(--text-muted);font-weight:600">Sin recordatorios 🌸</div>';
}

function toggleReminderForm() {
  const f = document.getElementById('reminder-form');
  f.style.display = f.style.display==='none' ? '' : 'none';
  if (f.style.display!=='none') document.getElementById('r-text').focus();
}

function addReminder() {
  const text = document.getElementById('r-text').value.trim();
  if (!text||!selectedCalDay) return;
  if (!reminders[selectedCalDay]) reminders[selectedCalDay]=[];
  reminders[selectedCalDay].push({text, time:document.getElementById('r-time').value});
  fbSaveReminders();
  document.getElementById('r-text').value='';
  document.getElementById('r-time').value='';
  document.getElementById('reminder-form').style.display='none';
  renderDayReminders(selectedCalDay);
  renderCalendar();
}

function deleteReminder(dateStr,idx) {
  sendToTrash('reminders', { ...reminders[dateStr][idx], date: dateStr });
  reminders[dateStr].splice(idx,1);
  if (!reminders[dateStr].length) delete reminders[dateStr];
  fbSaveReminders();
  fbSaveTrash();
  renderDayReminders(dateStr);
  renderCalendar();
}

// ══ NOTAS ══
function noteCardHTML(n, pinned) {
  return `<div class="note-card note-color-${n.color}${pinned?' pinned':''}"
    onclick="openNoteModal(${n.id})"
    draggable="true"
    ondragstart="onDragStart(event,${n.id})"
    ondragover="onDragOver(event)"
    ondragleave="onDragLeave(event)"
    ondrop="onDrop(event,${n.id})"
    ondragend="onDragEnd(event)">
    <button class="note-pin-btn" onclick="event.stopPropagation();togglePin(${n.id})" title="${pinned?'Desfijar':'Fijar'}">${pinned?'📌':'📍'}</button>
    <button class="note-card-del" onclick="event.stopPropagation();deleteNote(${n.id})">✕</button>
    <div class="note-card-title" style="padding-left:${pinned?'22px':'0'}">${esc(n.title)}</div>
    <div class="note-card-body">${esc(n.body)}</div>
    <div class="note-card-date">${fmtNoteDate(n.created)}</div>
  </div>`;
}

function renderNotes() {
  const pinned   = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  const addBtn = `<div class="add-note-card" onclick="openNoteModal()"><span class="plus-icon">+</span><span>Nueva nota</span></div>`;

  const pinnedSection = document.getElementById('notes-pinned-section');
  const pinnedGrid    = document.getElementById('notes-pinned-grid');
  const mainGrid      = document.getElementById('notes-grid');
  const emptyOverlay  = document.getElementById('notes-empty-overlay');

  if (pinned.length) {
    pinnedSection.style.display = '';
    pinnedGrid.innerHTML = pinned.map(n => noteCardHTML(n, true)).join('');
  } else {
    pinnedSection.style.display = 'none';
    pinnedGrid.innerHTML = '';
  }

  mainGrid.innerHTML = addBtn + unpinned.map(n => noteCardHTML(n, false)).join('');
  emptyOverlay.style.display = (notes.length === 0) ? '' : 'none';
}

function togglePin(id) {
  const n = notes.find(n => n.id === id);
  if (!n) return;
  fbSetNote(id, { ...n, pinned: !n.pinned });
}

// ── Drag & drop ──
function onDragStart(e, id) {
  dragSrcId = id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e, targetId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (dragSrcId === targetId) return;
  const srcIdx = notes.findIndex(n => n.id === dragSrcId);
  const tgtIdx = notes.findIndex(n => n.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  if (notes[srcIdx].pinned !== notes[tgtIdx].pinned) return;
  const [moved] = notes.splice(srcIdx, 1);
  notes.splice(tgtIdx, 0, moved);
  const obj = {};
  notes.forEach((n, i) => { obj[n.id] = { ...n, sortOrder: i }; });
  set(ref(db, USER_PATH + 'notes'), obj);
  renderNotes();
}
function onDragEnd(e) { e.currentTarget.classList.remove('dragging'); dragSrcId = null; }

function openNoteModal(id) {
  editingNoteId = id||null;
  document.getElementById('note-modal-mode').textContent = id ? 'Editar nota' : 'Nueva nota';
  if (id) {
    const n=notes.find(n=>n.id===id);
    document.getElementById('note-title-input').value = n.title;
    document.getElementById('note-body-input').value  = n.body;
    selectedNoteColor = n.color;
  } else {
    document.getElementById('note-title-input').value='';
    document.getElementById('note-body-input').value='';
    selectedNoteColor=0;
  }
  updateColorPicker();
  const modal = document.querySelector('#note-modal .modal');
  modal.style.background = NOTE_COLORS[selectedNoteColor];
  document.getElementById('note-modal-del-btn').style.display = id ? '' : 'none';
  document.getElementById('note-modal').classList.add('active');
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('active');
  editingNoteId=null;
}

function saveNote() {
  const title=document.getElementById('note-title-input').value.trim();
  const body =document.getElementById('note-body-input').value.trim();
  if (!title&&!body) { alert('Escribe algo en la nota'); return; }
  if (editingNoteId) {
    const n=notes.find(n=>n.id===editingNoteId);
    fbSetNote(editingNoteId, { ...n, title, body, color: selectedNoteColor });
  } else {
    const id = Date.now();
    const sortOrder = notes.length ? Math.max(...notes.map(n => n.sortOrder || 0)) + 1 : 0;
    fbSetNote(id, { id, title, body, color: selectedNoteColor, pinned: false, created: new Date().toISOString(), sortOrder });
  }
  closeNoteModal();
}

function deleteNote(id) {
  const n = notes.find(n=>n.id===id);
  if (!n) return;
  sendToTrash('notes', n);
  fbRemoveNote(id);
  fbSaveTrash();
}

function deleteNoteFromModal() {
  if (!editingNoteId) return;
  deleteNote(editingNoteId);
  closeNoteModal();
}

function selectNoteColor(i) {
  selectedNoteColor = i;
  updateColorPicker();
  const modal = document.querySelector('#note-modal .modal');
  modal.style.background = NOTE_COLORS[i];
  modal.style.transition = 'background 0.3s ease';
}

function updateColorPicker() {
  document.querySelectorAll('.cpick').forEach((el,i)=>el.classList.toggle('sel',i===selectedNoteColor));
}

// ══ PAPELERA ══
function renderTrash() {
  const tTasks    = trash.tasks    || [];
  const tNotes    = trash.notes    || [];
  const tColleges = trash.colleges || [];
  const tTeachers = trash.teachers || [];
  const tVisits   = trash.visits   || [];
  const tEvals    = trash.evals    || [];
  const tTodos      = trash.todos      || [];
  const tReminders  = trash.reminders  || [];
  const total = tTasks.length + tNotes.length + tColleges.length + tTeachers.length + tVisits.length + tEvals.length + tTodos.length + tReminders.length;

  document.getElementById('btn-empty-all').style.display = total ? '' : 'none';
  document.getElementById('trash-empty-state').style.display = total ? 'none' : '';
  document.getElementById('trash-tasks-section').style.display      = tTasks.length      ? '' : 'none';
  document.getElementById('trash-notes-section').style.display      = tNotes.length      ? '' : 'none';
  document.getElementById('trash-colleges-section').style.display   = tColleges.length   ? '' : 'none';
  document.getElementById('trash-teachers-section').style.display   = tTeachers.length   ? '' : 'none';
  document.getElementById('trash-visits-section').style.display     = tVisits.length     ? '' : 'none';
  document.getElementById('trash-evals-section').style.display      = tEvals.length      ? '' : 'none';
  document.getElementById('trash-todos-section').style.display      = tTodos.length      ? '' : 'none';
  document.getElementById('trash-reminders-section').style.display  = tReminders.length  ? '' : 'none';

  document.getElementById('trash-task-count').textContent      = tTasks.length;
  document.getElementById('trash-note-count').textContent      = tNotes.length;
  document.getElementById('trash-college-count').textContent   = tColleges.length;
  document.getElementById('trash-teacher-count').textContent   = tTeachers.length;
  document.getElementById('trash-visit-count').textContent     = tVisits.length;
  document.getElementById('trash-eval-count').textContent      = tEvals.length;
  document.getElementById('trash-todo-count').textContent      = tTodos.length;
  document.getElementById('trash-reminder-count').textContent  = tReminders.length;

  document.getElementById('trash-tasks-list').innerHTML = tTasks.map(t => `
    <div class="trash-card">
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(t.title)}</div>
        <div class="trash-card-meta">
          ${t.status ? `Estado: ${t.status}` : ''}
          ${t.priority ? ` · Prioridad: ${t.priority}` : ''}
          ${t.deletedAt ? ` · Eliminada: ${fmtNoteDate(t.deletedAt)}` : ''}
        </div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreTask(${t.id})">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteTask(${t.id})">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-notes-list').innerHTML = tNotes.map(n => `
    <div class="trash-card">
      <div class="trash-note-preview note-color-${n.color}">🌸</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(n.title)||'(Sin título)'}</div>
        <div class="trash-card-meta">
          ${n.body ? esc(n.body).substring(0,60)+(n.body.length>60?'…':'') : 'Sin contenido'}
          ${n.deletedAt ? ` · Eliminada: ${fmtNoteDate(n.deletedAt)}` : ''}
        </div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreNote(${n.id})">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteNote(${n.id})">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-colleges-list').innerHTML = tColleges.map((c,i) => `
    <div class="trash-card">
      <div class="trash-note-preview">${COLLEGE_THEMES[c.theme]?.icon||'🏫'}</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(c.name)}</div>
        <div class="trash-card-meta">${c.location ? esc(c.location)+' · ' : ''}${c.teachers.length} teachers · ${c.visits.length} visitas · Eliminado: ${fmtNoteDate(c.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreCollege(${c.id})">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteCollege(${c.id})">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-teachers-list').innerHTML = tTeachers.map((t,i) => `
    <div class="trash-card">
      <div class="trash-note-preview">👩‍🏫</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(t.name)}</div>
        <div class="trash-card-meta">Inglés${t.grade ? ' · '+esc(t.grade) : ''} · Colegio: ${esc(t.collegeName)} · Eliminado: ${fmtNoteDate(t.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreTeacher('${t.deletedAt}')">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteTeacher('${t.deletedAt}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-visits-list').innerHTML = tVisits.map((v,i) => `
    <div class="trash-card">
      <div class="trash-note-preview">📅</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(v.purpose)}</div>
        <div class="trash-card-meta">Fecha: ${fmtDate(v.date)} · Colegio: ${esc(v.collegeName)} · Eliminado: ${fmtNoteDate(v.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreVisit('${v.deletedAt}')">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteVisit('${v.deletedAt}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-evals-list').innerHTML = tEvals.map((e,i) => `
    <div class="trash-card">
      <div class="trash-note-preview">📋</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(e.teacher)}</div>
        <div class="trash-card-meta">Fecha: ${e.date ? fmtDate(e.date) : '—'} · Colegio: ${esc(e.collegeName)} · ${'🌟'.repeat(e.rating||0)} · Eliminado: ${fmtNoteDate(e.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreEval('${e.deletedAt}')">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteEval('${e.deletedAt}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-todos-list').innerHTML = tTodos.map(t => `
    <div class="trash-card">
      <div class="trash-note-preview">✅</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(t.text)}</div>
        <div class="trash-card-meta">Colegio: ${esc(t.collegeName)} · ${t.done ? 'Completado' : 'Pendiente'} · Eliminado: ${fmtNoteDate(t.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreTodo('${t.deletedAt}')">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteTodo('${t.deletedAt}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');

  document.getElementById('trash-reminders-list').innerHTML = tReminders.map(r => `
    <div class="trash-card">
      <div class="trash-note-preview">🔔</div>
      <div class="trash-card-body">
        <div class="trash-card-title">${esc(r.text)}</div>
        <div class="trash-card-meta">Fecha: ${fmtDate(r.date)}${r.time ? ' · '+r.time : ''} · Eliminado: ${fmtNoteDate(r.deletedAt)}</div>
      </div>
      <div class="trash-card-actions">
        <button class="trash-restore-btn" onclick="restoreReminder('${r.deletedAt}')">↩ Restaurar</button>
        <button class="trash-del-btn" onclick="permDeleteReminder('${r.deletedAt}')">🗑 Eliminar</button>
      </div>
    </div>`).join('');
}

function restoreTask(id) {
  const t = trash.tasks.find(t=>t.id===Number(id));
  if (!t) return;
  const { deletedAt, ...restored } = t;
  trash.tasks = trash.tasks.filter(t=>t.id!==Number(id));
  fbSetTask(restored.id, restored);
  fbSaveTrash();
}
function permDeleteTask(id) {
  if (!confirm('¿Eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) return;
  trash.tasks = trash.tasks.filter(t=>t.id!==Number(id));
  fbSaveTrash();
}
function restoreNote(id) {
  const n = trash.notes.find(n=>n.id===Number(id));
  if (!n) return;
  const { deletedAt, ...restored } = n;
  trash.notes = trash.notes.filter(n=>n.id!==Number(id));
  fbSetNote(restored.id, restored);
  fbSaveTrash();
}
function permDeleteNote(id) {
  if (!confirm('¿Eliminar esta nota permanentemente? Esta acción no se puede deshacer.')) return;
  trash.notes = trash.notes.filter(n=>n.id!==Number(id));
  fbSaveTrash();
}
function restoreCollege(id) {
  const c = (trash.colleges||[]).find(c=>c.id===id);
  if (!c) return;
  const { deletedAt, ...restored } = c;
  trash.colleges = (trash.colleges||[]).filter(c=>c.id!==id);
  colleges.push(restored);
  fbSetCollege(restored.id, restored);
  fbSaveTrash();
}
function permDeleteCollege(id) {
  if (!confirm('¿Eliminar este colegio permanentemente? Esta acción no se puede deshacer.')) return;
  // Cascade: purge orphaned sub-items in trash that reference this college
  ['visits','teachers','evals','todos'].forEach(type => {
    trash[type] = (trash[type]||[]).filter(item => item.collegeId !== id);
  });
  trash.colleges = (trash.colleges||[]).filter(c=>c.id!==id);
  fbSaveTrash();
}
function restoreTeacher(deletedAt) {
  const t = (trash.teachers||[]).find(t=>t.deletedAt===deletedAt);
  if (!t) return;
  const c = colleges.find(c=>c.id===t.collegeId);
  if (!c) { alert(`El colegio "${t.collegeName}" no existe. Restáuralo primero desde la papelera.`); return; }
  const { deletedAt: _, collegeId: __, collegeName: ___, origIdx: ____, ...restored } = t;
  c.teachers.push(restored);
  trash.teachers = (trash.teachers||[]).filter(t=>t.deletedAt!==deletedAt);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  if (currentCollegeId === c.id) renderTeachers();
}
function permDeleteTeacher(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.teachers = (trash.teachers||[]).filter(t=>t.deletedAt!==deletedAt);
  fbSaveTrash();
}
function restoreVisit(deletedAt) {
  const v = (trash.visits||[]).find(v=>v.deletedAt===deletedAt);
  if (!v) return;
  const c = colleges.find(c=>c.id===v.collegeId);
  if (!c) { alert(`El colegio "${v.collegeName}" no existe. Restáuralo primero desde la papelera.`); return; }
  const { deletedAt: _, collegeId: __, collegeName: ___, ...restored } = v;
  c.visits.push(restored);
  trash.visits = (trash.visits||[]).filter(v=>v.deletedAt!==deletedAt);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  if (currentCollegeId === c.id) renderVisits();
}
function permDeleteVisit(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.visits = (trash.visits||[]).filter(v=>v.deletedAt!==deletedAt);
  fbSaveTrash();
}
function restoreEval(deletedAt) {
  const e = (trash.evals||[]).find(e=>e.deletedAt===deletedAt);
  if (!e) return;
  const c = colleges.find(c=>c.id===e.collegeId);
  if (!c) { alert(`El colegio "${e.collegeName}" no existe. Restáuralo primero desde la papelera.`); return; }
  const { deletedAt: _, collegeId: __, collegeName: ___, ...restored } = e;
  c.evaluations.unshift(restored);
  trash.evals = (trash.evals||[]).filter(e=>e.deletedAt!==deletedAt);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  if (currentCollegeId === c.id) renderEvals();
}
function permDeleteEval(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.evals = (trash.evals||[]).filter(e=>e.deletedAt!==deletedAt);
  fbSaveTrash();
}
function restoreTodo(deletedAt) {
  const t = (trash.todos||[]).find(t=>t.deletedAt===deletedAt);
  if (!t) return;
  const c = colleges.find(c=>c.id===t.collegeId);
  if (!c) { alert(`El colegio "${t.collegeName}" no existe. Restáuralo primero desde la papelera.`); return; }
  const { deletedAt: _, collegeId: __, collegeName: ___, ...restored } = t;
  c.todos.push(restored);
  trash.todos = (trash.todos||[]).filter(t=>t.deletedAt!==deletedAt);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  if (currentCollegeId === c.id) renderCollegeTodos();
}
function permDeleteTodo(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.todos = (trash.todos||[]).filter(t=>t.deletedAt!==deletedAt);
  fbSaveTrash();
}
function restoreReminder(deletedAt) {
  const r = (trash.reminders||[]).find(r=>r.deletedAt===deletedAt);
  if (!r) return;
  if (!reminders[r.date]) reminders[r.date] = [];
  const { deletedAt: _, date, ...restored } = r;
  reminders[date].push(restored);
  trash.reminders = (trash.reminders||[]).filter(r=>r.deletedAt!==deletedAt);
  fbSaveReminders();
  fbSaveTrash();
  if (selectedCalDay === date) renderDayReminders(date);
}
function permDeleteReminder(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.reminders = (trash.reminders||[]).filter(r=>r.deletedAt!==deletedAt);
  fbSaveTrash();
}
function emptyTrash() {
  if (!confirm('¿Vaciar toda la papelera? Todos los elementos se eliminarán permanentemente y no podrás recuperarlos.')) return;
  update(ref(db, '/'), { [USER_PATH + 'trash']: null })
    .then(() => { if (currentView === 'calendar') renderCalendar(); })
    .catch(err => { alert('Error al vaciar la papelera. Inténtalo de nuevo.'); console.error(err); });
}

// Cerrar modales al clic fuera
['task-modal','note-modal'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(e){
    if(e.target===this) { id==='task-modal'?closeTaskModal():closeNoteModal(); }
  });
});

// ══ COLEGIOS ══
let currentCollegeId = null;

const COLLEGE_THEMES = {
  girasol:  { icon: '🌻', label: 'Girasol',  badge: 'badge-girasol' },
  margarita:{ icon: '🌸', label: 'Margarita', badge: 'badge-margarita' },
  tulipan:  { icon: '🌷', label: 'Tulipán',   badge: 'badge-tulipan' }
};

function renderColleges() {
  const grid = document.getElementById('colleges-grid');
  const addCard = `<div class="add-college-card" onclick="openCollegeModal()"><span class="plus-icon">+</span><span>Nuevo colegio</span></div>`;
  if (!colleges.length) { grid.innerHTML = addCard; return; }
  grid.innerHTML = colleges.map(c => {
    const th = COLLEGE_THEMES[c.theme] || COLLEGE_THEMES.girasol;
    return `<div class="college-card theme-${c.theme}" onclick="viewCollege(${c.id})">
      <div class="college-card-actions">
        <button class="college-card-action-btn" onclick="event.stopPropagation();openEditCollegeModal(${c.id})" title="Editar">✏️</button>
        <button class="college-card-action-btn del" onclick="event.stopPropagation();deleteCollege(${c.id})" title="Eliminar">✕</button>
      </div>
      <span class="college-card-icon">${th.icon}</span>
      <div class="college-card-name">${esc(c.name)}</div>
      <div class="college-card-theme">${th.label}${c.location ? ' · ' + esc(c.location) : ''}</div>
      <div class="college-card-stats">
        <div class="college-stat"><div class="college-stat-num" style="color:var(--accent)">${c.teachers.length}</div><div class="college-stat-lbl">Teachers</div></div>
        <div class="college-stat"><div class="college-stat-num" style="color:var(--blue)">${c.visits.length}</div><div class="college-stat-lbl">Visitas</div></div>
        <div class="college-stat"><div class="college-stat-num" style="color:var(--pink)">${c.evaluations.length}</div><div class="college-stat-lbl">Fichas</div></div>
        <div class="college-stat"><div class="college-stat-num" style="color:var(--green)">${c.todos.filter(t=>t.done).length}/${c.todos.length}</div><div class="college-stat-lbl">Pendientes</div></div>
      </div>
    </div>`;
  }).join('') + addCard;
}

function viewCollege(id) {
  currentCollegeId = id;
  const c = colleges.find(c => c.id === id);
  if (!c) return;
  document.getElementById('colleges-directory').style.display = 'none';
  document.getElementById('colleges-detail').style.display = '';
  const th = COLLEGE_THEMES[c.theme] || COLLEGE_THEMES.girasol;
  document.getElementById('college-detail-header').innerHTML = `
    <div class="college-detail-icon">${th.icon}</div>
    <div>
      <span class="college-detail-badge ${th.badge}">${th.label}</span>
      <div class="page-title" style="font-size:28px">${esc(c.name)}</div>
      ${c.location ? `<div class="page-subtitle">${esc(c.location)}</div>` : ''}
    </div>`;
  document.querySelectorAll('.college-tab').forEach((t,i) => t.classList.toggle('active', i===0));
  document.querySelectorAll('.college-tab-panel').forEach((p,i) => p.classList.toggle('active', i===0));
  renderTeachers(); renderVisits(); renderEvals(); renderCollegeTodos();
}

function backToColleges() {
  currentCollegeId = null;
  document.getElementById('colleges-directory').style.display = '';
  document.getElementById('colleges-detail').style.display = 'none';
  renderColleges();
}

function switchCollegeTab(btn, panelId) {
  document.querySelectorAll('.college-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.college-tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(panelId).classList.add('active');
}

function currentCollege() { return colleges.find(c => c.id === currentCollegeId); }

// College CRUD
let editingCollegeId = null;
function openCollegeModal() {
  editingCollegeId = null;
  document.getElementById('college-modal-title').textContent = '🏫 Nuevo colegio';
  document.getElementById('college-modal').classList.add('active');
}
function openEditCollegeModal(id) {
  const c = colleges.find(c => c.id === id);
  if (!c) return;
  editingCollegeId = id;
  document.getElementById('college-modal-title').textContent = '✏️ Editar colegio';
  document.getElementById('cm-name').value = c.name || '';
  document.getElementById('cm-theme').value = c.theme || 'girasol';
  document.getElementById('cm-location').value = c.location || '';
  document.getElementById('college-modal').classList.add('active');
}
function closeCollegeModal() {
  document.getElementById('college-modal').classList.remove('active');
  ['cm-name','cm-location'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cm-theme').value = 'girasol';
  editingCollegeId = null;
}
function saveCollege() {
  const name = document.getElementById('cm-name').value.trim();
  if (!name) { alert('Escribe el nombre del colegio'); return; }
  if (editingCollegeId !== null) {
    const c = colleges.find(c => c.id === editingCollegeId);
    if (c) {
      c.name = name;
      c.theme = document.getElementById('cm-theme').value;
      c.location = document.getElementById('cm-location').value.trim();
      fbSetCollege(c.id, c);
    }
  } else {
    const id = Date.now();
    const college = { id, name, theme: document.getElementById('cm-theme').value, location: document.getElementById('cm-location').value.trim(), teachers: [], visits: [], evaluations: [], todos: [], created: new Date().toISOString() };
    fbSetCollege(id, college);
  }
  closeCollegeModal();
}
function deleteCollege(id) {
  if (!confirm('¿Mover este colegio a la papelera?')) return;
  const c = colleges.find(c => c.id === id);
  if (!c) return;
  // Remove sub-items in trash that already reference this college (they travel with it)
  ['visits','teachers','evals','todos'].forEach(type => {
    trash[type] = (trash[type]||[]).filter(item => item.collegeId !== id);
  });
  sendToTrash('colleges', c);
  // Atomic: remove from active colleges + persist updated trash in a single write
  update(ref(db, '/'), {
    [USER_PATH + 'colleges/' + id]: null,
    [USER_PATH + 'trash']: trash
  }).catch(err => console.error('Error al mover colegio a papelera:', err));
}

// Teachers
function renderTeachers() {
  const c = currentCollege(); if (!c) return;
  const list = document.getElementById('teachers-list');
  const empty = document.getElementById('teachers-empty');
  if (!c.teachers.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = c.teachers.map((t,i) => `
    <div class="teacher-item">
      <div class="teacher-avatar">👩‍🏫</div>
      <div class="teacher-info">
        <div class="teacher-name">${esc(t.name)}</div>
        <div class="teacher-subject">inglés${t.grade ? ' · ' + esc(t.grade) : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn-edit-sm" onclick="openEditTeacherModal(${i})" title="Editar">✏️</button>
        <button class="teacher-del" onclick="deleteTeacher(${i})" title="Eliminar">✕</button>
      </div>
    </div>`).join('');
}
let editingTeacherIdx = null;
function openTeacherModal() {
  editingTeacherIdx = null;
  document.getElementById('teacher-modal-title').textContent = '👩‍🏫 Agregar Teacher';
  document.getElementById('teacher-modal').classList.add('active');
}
function openEditTeacherModal(idx) {
  const c = currentCollege();
  const t = c.teachers[idx];
  editingTeacherIdx = idx;
  document.getElementById('teacher-modal-title').textContent = '✏️ Editar Teacher';
  document.getElementById('tm-name').value = t.name || '';
  document.getElementById('tm-grade').value = t.grade || '';
  document.getElementById('teacher-modal').classList.add('active');
}
function saveTeacher() {
  const name = document.getElementById('tm-name').value.trim();
  if (!name) { alert('Escribe el nombre del docente'); return; }
  const c = currentCollege();
  if (editingTeacherIdx !== null) {
    c.teachers[editingTeacherIdx] = { ...c.teachers[editingTeacherIdx], name, grade: document.getElementById('tm-grade').value.trim() };
  } else {
    c.teachers.push({ name, grade: document.getElementById('tm-grade').value.trim() });
  }
  fbSetCollege(c.id, c);
  closeModal('teacher-modal');
  ['tm-name','tm-grade'].forEach(id => document.getElementById(id).value = '');
  editingTeacherIdx = null;
  renderTeachers();
}
function deleteTeacher(idx) {
  const c = currentCollege();
  sendToTrash('teachers', { ...c.teachers[idx], collegeId: c.id, collegeName: c.name, origIdx: idx });
  c.teachers.splice(idx, 1);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  renderTeachers();
}

// Visits
function renderVisits() {
  const c = currentCollege(); if (!c) return;
  const list = document.getElementById('visits-list');
  const empty = document.getElementById('visits-empty');
  const sorted = [...c.visits].sort((a,b) => a.date < b.date ? 1 : -1);
  if (!sorted.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = sorted.map(v => {
    const origIdx = c.visits.indexOf(v);
    return `
    <div class="visit-item${v.completada ? ' completada' : ''}">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <input class="visit-cb" type="checkbox" ${v.completada ? 'checked' : ''} onchange="toggleVisitDone(${origIdx})" />
        <div style="flex:1">
          <div class="visit-date">📅 ${fmtDate(v.date)}</div>
          <div class="visit-purpose${v.completada ? ' done' : ''}">${esc(v.purpose)}</div>
          ${v.notes ? `<div class="visit-notes">${esc(v.notes)}</div>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px">
            <button class="btn-edit-sm" onclick="openEditVisitModal(${origIdx})" title="Editar">✏️ Editar</button>
            <button class="teacher-del" onclick="deleteVisit(${origIdx})" title="Eliminar">✕ Eliminar</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}
let editingVisitIdx = null;
function openVisitModal() {
  editingVisitIdx = null;
  document.getElementById('visit-modal-title').textContent = '📅 Programar visita';
  document.getElementById('visit-modal').classList.add('active');
}
function openEditVisitModal(idx) {
  const c = currentCollege();
  const v = c.visits[idx];
  editingVisitIdx = idx;
  document.getElementById('visit-modal-title').textContent = '✏️ Editar visita';
  document.getElementById('vm-date').value = v.date || '';
  document.getElementById('vm-purpose').value = v.purpose || '';
  document.getElementById('vm-notes').value = v.notes || '';
  document.getElementById('visit-modal').classList.add('active');
}
function saveVisit() {
  const purpose = document.getElementById('vm-purpose').value.trim();
  if (!purpose) { alert('Escribe el propósito de la visita'); return; }
  const c = currentCollege();
  const visitData = { date: document.getElementById('vm-date').value, purpose, notes: document.getElementById('vm-notes').value.trim() };
  if (editingVisitIdx !== null) {
    c.visits[editingVisitIdx] = visitData;
  } else {
    c.visits.push(visitData);
  }
  fbSetCollege(c.id, c);
  closeModal('visit-modal');
  ['vm-date','vm-purpose','vm-notes'].forEach(id => document.getElementById(id).value = '');
  editingVisitIdx = null;
  renderVisits();
}
function toggleVisitDone(idx) {
  const c = currentCollege();
  c.visits[idx].completada = !c.visits[idx].completada;
  fbSetCollege(c.id, c);
  renderVisits();
}

function deleteVisit(idx) {
  const c = currentCollege();
  sendToTrash('visits', { ...c.visits[idx], collegeId: c.id, collegeName: c.name });
  c.visits.splice(idx,1);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  renderVisits();
}

// Evaluations
function renderEvals() {
  const c = currentCollege(); if (!c) return;
  const list = document.getElementById('evals-list');
  const empty = document.getElementById('evals-empty');
  if (!c.evaluations.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = c.evaluations.map((e,i) => {
    const stars = [1,2,3,4,5].map(n => `<span class="eval-star${n<=e.rating?' lit':''}">🌟</span>`).join('');
    return `<div class="eval-card">
      <div class="eval-header">
        <div>
          <div class="eval-teacher">${esc(e.teacher)}</div>
          <div class="eval-date">${e.date ? fmtDate(e.date) : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn-edit-sm" onclick="openEditEvalModal(${i})" title="Editar">✏️</button>
          <button class="eval-del" onclick="deleteEval(${i})">✕</button>
        </div>
      </div>
      <div class="eval-rating">${stars}</div>
      ${e.strengths ? `<div class="eval-section"><div class="eval-section-label">Fortalezas 🌻</div><div class="eval-section-body">${esc(e.strengths)}</div></div>` : ''}
      ${e.improvements ? `<div class="eval-section"><div class="eval-section-label">Puntos de mejora 🌱</div><div class="eval-section-body">${esc(e.improvements)}</div></div>` : ''}
      ${e.commitments ? `<div class="eval-section"><div class="eval-section-label">Compromisos</div><div class="eval-section-body">${esc(e.commitments)}</div></div>` : ''}
    </div>`;
  }).join('');
}
let editingEvalIdx = null;
function openEvalModal() {
  editingEvalIdx = null;
  document.getElementById('eval-modal-title').textContent = '📋 Ficha de Observación';
  const c = currentCollege();
  const sel = document.getElementById('em-teacher');
  sel.innerHTML = '<option value="">Seleccionar teacher...</option>' + (c ? c.teachers.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('') : '');
  document.getElementById('eval-modal').classList.add('active');
}
function openEditEvalModal(idx) {
  const c = currentCollege();
  const e = c.evaluations[idx];
  editingEvalIdx = idx;
  document.getElementById('eval-modal-title').textContent = '✏️ Editar Ficha';
  const sel = document.getElementById('em-teacher');
  sel.innerHTML = '<option value="">Seleccionar teacher...</option>' + (c ? c.teachers.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('') : '');
  sel.value = e.teacher || '';
  document.getElementById('em-date').value = e.date || '';
  document.getElementById('em-rating').value = e.rating || '5';
  document.getElementById('em-strengths').value = e.strengths || '';
  document.getElementById('em-improvements').value = e.improvements || '';
  document.getElementById('em-commitments').value = e.commitments || '';
  document.getElementById('eval-modal').classList.add('active');
}
function saveEval() {
  const teacher = document.getElementById('em-teacher').value.trim();
  if (!teacher) { alert('Selecciona el teacher observado'); return; }
  const c = currentCollege();
  const evalData = { teacher, date: document.getElementById('em-date').value, rating: parseInt(document.getElementById('em-rating').value), strengths: document.getElementById('em-strengths').value.trim(), improvements: document.getElementById('em-improvements').value.trim(), commitments: document.getElementById('em-commitments').value.trim() };
  if (editingEvalIdx !== null) {
    c.evaluations[editingEvalIdx] = evalData;
  } else {
    c.evaluations.unshift(evalData);
  }
  fbSetCollege(c.id, c);
  closeModal('eval-modal');
  ['em-teacher','em-date','em-strengths','em-improvements','em-commitments'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('em-rating').value = '5';
  editingEvalIdx = null;
  renderEvals();
}
function deleteEval(idx) {
  const c = currentCollege();
  sendToTrash('evals', { ...c.evaluations[idx], collegeId: c.id, collegeName: c.name });
  c.evaluations.splice(idx,1);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  renderEvals();
}

// Todos
function renderCollegeTodos() {
  const c = currentCollege(); if (!c) return;
  const list = document.getElementById('college-todos-list');
  const empty = document.getElementById('todos-empty');
  if (!c.todos.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = c.todos.map((t,i) => `
    <div class="college-todo-item">
      <input class="college-todo-cb" type="checkbox" ${t.done?'checked':''} onchange="toggleCollegeTodo(${i})" />
      <span class="college-todo-text${t.done?' done':''}">${esc(t.text)}</span>
      <button class="college-todo-del" onclick="deleteCollegeTodo(${i})">✕</button>
    </div>`).join('');
}
function addCollegeTodo() {
  const inp = document.getElementById('new-college-todo');
  const text = inp.value.trim();
  if (!text) return;
  const c = currentCollege();
  c.todos.push({ text, done: false });
  inp.value = '';
  fbSetCollege(c.id, c);
  renderCollegeTodos();
}
function toggleCollegeTodo(idx) {
  const c = currentCollege();
  c.todos[idx].done = !c.todos[idx].done;
  fbSetCollege(c.id, c);
  renderCollegeTodos();
}
function deleteCollegeTodo(idx) {
  const c = currentCollege();
  sendToTrash('todos', { ...c.todos[idx], collegeId: c.id, collegeName: c.name });
  c.todos.splice(idx,1);
  fbSetCollege(c.id, c);
  fbSaveTrash();
  renderCollegeTodos();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}
document.getElementById('college-modal').addEventListener('click', function(e){ if(e.target===this) closeCollegeModal(); });
['teacher-modal','visit-modal','eval-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e){
    if(e.target===this) {
      closeModal(id);
      if(id==='teacher-modal') editingTeacherIdx=null;
      if(id==='visit-modal') editingVisitIdx=null;
      if(id==='eval-modal') editingEvalIdx=null;
    }
  });
});

// ══ REPORTES ══
const REP_FIELDS = ['rep-college','rep-date','rep-teacher','rep-grade','rep-logros','rep-mejoras'];
let _reportSaveTimer = null;

_unsub.repDraft = onValue(ref(db, USER_PATH + 'reportes/draft'), snap => {
  const d = snap.val();
  if (!d) return;
  // Only hydrate fields and trigger select/preview when there is real content to load
  const hasContent = REP_FIELDS.some(id => d[id]);
  if (!hasContent) return;
  REP_FIELDS.filter(id => id !== 'rep-teacher').forEach(id => {
    const el = document.getElementById(id);
    if (el && d[id]) el.value = d[id];
  });
  updateTeacherSelect();
  if (d['rep-teacher']) {
    const sel = document.getElementById('rep-teacher');
    if (sel) sel.value = d['rep-teacher'];
  }
  if (currentView === 'reportes') updateReportPreview();
});

function onReportInput() {
  updateReportPreview();
  clearTimeout(_reportSaveTimer);
  _reportSaveTimer = setTimeout(() => {
    const draft = {};
    REP_FIELDS.forEach(id => { draft[id] = document.getElementById(id)?.value || ''; });
    set(ref(db, USER_PATH + 'reportes/draft'), draft);
  }, 900);
}

function populateCollegeSelect() {
  const sel = document.getElementById('rep-college');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Seleccionar colegio...</option>' +
    colleges.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  if (prev) sel.value = prev;
  updateTeacherSelect();
}

function updateTeacherSelect() {
  const collegeName = (document.getElementById('rep-college')?.value || '').trim();
  const sel = document.getElementById('rep-teacher');
  if (!sel) return;

  if (!collegeName) {
    sel.innerHTML = '<option value="">— Selecciona un colegio primero —</option>';
    onReportInput();
    return;
  }

  const college = colleges.find(c => c.name.toLowerCase() === collegeName.toLowerCase());
  if (!college || !college.teachers.length) {
    sel.innerHTML = '<option value="">— Sin teachers registrados —</option>';
    onReportInput();
    return;
  }

  const prev = sel.value;
  sel.innerHTML = '<option value="">Seleccionar teacher...</option>' +
    college.teachers.map(t =>
      `<option value="${esc(t.name)}">${esc(t.name)}${t.grade ? ' · ' + esc(t.grade) : ''}</option>`
    ).join('');
  if (prev) sel.value = prev;
  onReportInput();
}

function fmtReportDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  return `${days[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]} ${d}/${m}/${y}`;
}

function buildReport() {
  const college = (document.getElementById('rep-college')?.value || '').trim();
  const date    =  document.getElementById('rep-date')?.value    || '';
  const teacher = (document.getElementById('rep-teacher')?.value || '').trim();
  const grade   = (document.getElementById('rep-grade')?.value   || '').trim();
  const logros  = (document.getElementById('rep-logros')?.value  || '').trim();
  const mejoras = (document.getElementById('rep-mejoras')?.value || '').trim();

  const fmt = lines => lines.split('\n').filter(l => l.trim()).map(l => `- ${l.trim()}`).join('\n');

  let t = '';
  if (college) t += `${college}\n\n`;
  if (date)    t += `${fmtReportDate(date)}\n\n`;
  t += `👋🏻 Reciban un cordial saludo desde Cleveland English Institute. El presente es para informar sobre las actividades realizadas el día de hoy en la asignatura de inglés:\n\n`;
  if (teacher) t += `📌 Acompañamiento pedagógico: Teacher ${teacher}.\n\n`;
  if (grade || logros) {
    t += `✅ Logros Alcanzados\n\n`;
    if (teacher || grade) t += `Teacher ${teacher}${grade ? ' - ' + grade : ''}.\n\n`;
    if (logros)  t += `${fmt(logros)}\n\n`;
  }
  if (mejoras) t += `🚀 Aspectos en Proceso de Mejora\n\n${fmt(mejoras)}\n\n`;
  actividades.filter(a => a.active).forEach(a => {
    t += `${a.title}\n\n${a.body}\n\n`;
  });
  t += `🗽\nCleveland English Institute\nEmpoderando mentes, transformando futuros.`;
  return t;
}

function updateReportPreview() {
  const el = document.getElementById('rep-preview');
  if (!el) return;
  const hasContent = REP_FIELDS.filter(id => id !== 'rep-date')
    .some(id => document.getElementById(id)?.value?.trim()) ||
    actividades.some(a => a.active);
  if (!hasContent) {
    el.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Completa el formulario y el reporte aparecerá aquí 🌻</span>';
    return;
  }
  el.textContent = buildReport();
}

function copyReport() {
  const text = buildReport();
  if (!text.trim()) return;
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('copy-toast');
    if (!toast) return;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  });
}

function resetReport() {
  if (!confirm('¿Estás segura de que quieres reiniciar el reporte? Se borrará todo el texto actual.')) return;

  // Block auto-save: cancel any pending timer before touching the fields
  clearTimeout(_reportSaveTimer);
  _reportSaveTimer = null;

  REP_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // updateTeacherSelect calls onReportInput internally, which schedules a new 900ms timer.
  // Cancel it immediately after so no empty-object write races against the null delete below.
  updateTeacherSelect();
  clearTimeout(_reportSaveTimer);
  _reportSaveTimer = null;

  actividades.forEach(a => { a.active = false; a.body = ''; });
  saveActividades();
  renderActividades();

  // This write takes priority — runs uncontested because both timers above are cancelled.
  set(ref(db, USER_PATH + 'reportes/draft'), null);

  updateReportPreview();
}

// ══ ACTIVIDADES ESPECIALES ══
let editingActividadId = null;

_unsub.repActs = onValue(ref(db, USER_PATH + 'reportes/actividades'), snap => {
  actividades = toArray(snap.val());
  if (currentView === 'reportes') { renderActividades(); updateReportPreview(); }
});

function saveActividades() {
  set(ref(db, USER_PATH + 'reportes/actividades'), actividades.length ? actividades : null);
}

function renderActividades() {
  const list = document.getElementById('actividades-list');
  if (!list) return;
  if (!actividades.length) {
    list.innerHTML = '<div class="act-empty">Sin actividades aún. Usa "+ Nueva" para crear la primera 🌱</div>';
    return;
  }
  list.innerHTML = actividades.map((a, i) => `
    <div class="actividad-card${a.active ? ' act-on' : ''}">
      <div class="act-card-main">
        <label class="act-toggle-wrap" title="${a.active ? 'Desactivar' : 'Activar'}">
          <input class="act-toggle-input" type="checkbox" ${a.active ? 'checked' : ''} onchange="toggleActividad(${a.id})" />
          <span class="act-toggle-track"></span>
        </label>
        <div class="act-card-info" onclick="openActividadModal(${a.id})">
          <div class="act-card-title">${esc(a.title)}</div>
          <div class="act-card-preview">${esc((a.body||'').substring(0,75))}${(a.body||'').length>75?'…':''}</div>
        </div>
        <div class="act-card-actions">
          <button class="act-move-btn" onclick="moveActividad(${a.id},-1)" ${i===0?'disabled':''} title="Subir"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,7 5,3 8,7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="act-move-btn" onclick="moveActividad(${a.id},1)"  ${i===actividades.length-1?'disabled':''} title="Bajar"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="2,3 5,7 8,3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="btn-edit-sm"  onclick="openActividadModal(${a.id})" title="Editar">✏️</button>
          <button class="teacher-del"  onclick="deleteActividad(${a.id})"    title="Eliminar">✕</button>
        </div>
      </div>
    </div>`).join('');
}

function toggleActividad(id) {
  const a = actividades.find(a => a.id === id);
  if (!a) return;
  a.active = !a.active;
  saveActividades();
  renderActividades();
  updateReportPreview();
}

function moveActividad(id, dir) {
  const idx = actividades.findIndex(a => a.id === id);
  const to  = idx + dir;
  if (to < 0 || to >= actividades.length) return;
  [actividades[idx], actividades[to]] = [actividades[to], actividades[idx]];
  saveActividades();
  renderActividades();
  updateReportPreview();
}

function deleteActividad(id) {
  if (!confirm('¿Eliminar esta actividad?')) return;
  actividades = actividades.filter(a => a.id !== id);
  saveActividades();
}

function openActividadModal(id) {
  editingActividadId = id || null;
  document.getElementById('act-modal-title').textContent = id ? '✏️ Editar actividad' : '✨ Nueva actividad';
  if (id) {
    const a = actividades.find(a => a.id === id);
    document.getElementById('act-modal-name').value = a?.title || '';
    document.getElementById('act-modal-body').value = a?.body  || '';
  } else {
    document.getElementById('act-modal-name').value = '';
    document.getElementById('act-modal-body').value = '';
  }
  document.getElementById('act-modal').classList.add('active');
  document.getElementById('act-modal-name').focus();
}

function closeActividadModal() {
  document.getElementById('act-modal').classList.remove('active');
  editingActividadId = null;
}

function saveActividadModal() {
  const title = document.getElementById('act-modal-name').value.trim();
  const body  = document.getElementById('act-modal-body').value.trim();
  if (!title) { alert('Escribe el nombre de la actividad'); return; }
  if (editingActividadId) {
    const a = actividades.find(a => a.id === editingActividadId);
    if (a) { a.title = title; a.body = body; }
  } else {
    actividades.push({ id: Date.now(), title, body, active: true });
  }
  saveActividades();
  closeActividadModal();
}

document.getElementById('act-modal').addEventListener('click', function(e) {
  if (e.target === this) closeActividadModal();
});

// ══ CERRAR SESIÓN ══
function logout() {
  sessionStorage.removeItem('orgUser');
  window.location.replace('login.html');
}

// INIT
renderDashboard();
renderCalendar();
updateTrashBadge();

// Saludo dinámico según usuario
const _greetingEl = document.getElementById('page-greeting');
if (_greetingEl) _greetingEl.innerHTML = `Hola, ${USER_NAME} <span class="greeting-sunflower">🐱</span>`;

// ── MENÚ HAMBURGUESA (móvil) ──
document.getElementById('menu-toggle').addEventListener('pointerdown', () => {
  document.querySelector('.sidebar').classList.toggle('sidebar-active');
});
document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.remove('sidebar-active');
});
document.querySelectorAll('.sidebar .nav-item').forEach(item => {
  item.addEventListener('pointerdown', e => {
    if (item.classList.contains('logout-btn')) return;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelector('.sidebar').classList.remove('sidebar-active');
    // Call showView immediately on pointerdown — don't wait for click (touch may not fire it)
    const m = (item.getAttribute('onclick') || '').match(/showView\('(\w+)'\)/);
    if (m) showView(m[1]);
  });
});

// ══ EXPONER AL SCOPE GLOBAL (requerido por onclick en HTML) ══
Object.assign(window, {
  showView, toggleDark, addTask, clearTaskForm, toggleFormExtra, openFormExtra,
  openTaskModal, setEditStatus, saveEditTask, deleteEditingTask, closeTaskModal,
  changeMonth, selectDay, toggleReminderForm, addReminder, deleteReminder,
  openNoteModal, closeNoteModal, saveNote, deleteNoteFromModal, selectNoteColor,
  togglePin, deleteNote, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  openCollegeModal, openEditCollegeModal, closeCollegeModal, saveCollege, deleteCollege,
  viewCollege, backToColleges, switchCollegeTab,
  openTeacherModal, openEditTeacherModal, saveTeacher, deleteTeacher,
  closeModal, openVisitModal, openEditVisitModal, saveVisit, deleteVisit, toggleVisitDone,
  openEvalModal, openEditEvalModal, saveEval, deleteEval,
  addCollegeTodo, toggleCollegeTodo, deleteCollegeTodo,
  onReportInput, copyReport, updateTeacherSelect, resetReport,
  toggleActividad, moveActividad, deleteActividad, openActividadModal, closeActividadModal, saveActividadModal,
  restoreTask, permDeleteTask, restoreNote, permDeleteNote,
  restoreCollege, permDeleteCollege, restoreTeacher, permDeleteTeacher,
  restoreVisit, permDeleteVisit, restoreEval, permDeleteEval,
  restoreTodo, permDeleteTodo, restoreReminder, permDeleteReminder, emptyTrash,
  logout
});
