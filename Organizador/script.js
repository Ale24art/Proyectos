// ══ DATOS (localStorage) ══
let tasks     = JSON.parse(localStorage.getItem('flow_tasks')     || '[]');
let notes     = JSON.parse(localStorage.getItem('flow_notes')     || '[]');
let reminders = JSON.parse(localStorage.getItem('flow_reminders') || '{}');
let trash     = JSON.parse(localStorage.getItem('flow_trash')     || '{"tasks":[],"notes":[]}');

let editingTaskId = null;
let editingStatus = 'pendiente';
let editingNoteId = null;
let selectedNoteColor = 0;
let calDate = new Date();
let selectedCalDay = null;
let dragSrcId = null;

const NOTE_COLORS = [
  '#FFFEF5','#EBF5EC','#E8F0FB','#FDEEED','#F2EFFE','#FEF9E7',
  '#FEF3E0','#E2F7FB','#FCEEF3','#EAFBF2','#F3F5FB','#FEF6ED',
  '#EFFBEF','#EEF4FF','#FDF0FA','#FDFCE8'
];

function save() {
  localStorage.setItem('flow_tasks',     JSON.stringify(tasks));
  localStorage.setItem('flow_notes',     JSON.stringify(notes));
  localStorage.setItem('flow_reminders', JSON.stringify(reminders));
  localStorage.setItem('flow_trash',     JSON.stringify(trash));
  localStorage.setItem('flow_colleges',   JSON.stringify(colleges));
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
const NAV_VIEWS = ['dashboard','tasks','calendar','notes','colleges','trash'];
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-'+id).classList.add('active');
  const idx = NAV_VIEWS.indexOf(id);
  document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
  if (id==='dashboard') renderDashboard();
  if (id==='tasks')     renderTasks();
  if (id==='calendar')  renderCalendar();
  if (id==='notes')     renderNotes();
  if (id==='trash')     renderTrash();
  if (id==='colleges')  renderColleges();
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
  tasks.push({
    id: Date.now(),
    title,
    desc:     document.getElementById('task-desc').value.trim(),
    status:   document.getElementById('task-status').value,
    priority: document.getElementById('task-priority').value,
    date:     document.getElementById('task-date').value,
    tag:      document.getElementById('task-tag').value.trim(),
    created:  new Date().toISOString()
  });
  save(); clearTaskForm(); renderTasks(); renderDashboard();
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
  t.title    = title;
  t.desc     = document.getElementById('edit-desc').value.trim();
  t.status   = editingStatus;
  t.priority = document.getElementById('edit-priority').value;
  t.date     = document.getElementById('edit-date').value;
  t.tag      = document.getElementById('edit-tag').value.trim();
  save(); closeTaskModal(); renderTasks(); renderDashboard();
}

function deleteEditingTask() {
  const t = tasks.find(t=>t.id===editingTaskId);
  if (!t) return;
  trash.tasks.unshift({ ...t, deletedAt: new Date().toISOString() });
  tasks = tasks.filter(t=>t.id!==editingTaskId);
  save(); closeTaskModal(); renderTasks(); renderDashboard();
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('active');
  editingTaskId = null;
}

// ══ CALENDARIO ══
const MNAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
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

    if (dateStr && (taskDates.has(dateStr)||reminderDates.has(dateStr))) {
      const row = document.createElement('div'); row.className='dot-row';
      if (taskDates.has(dateStr))     { const d=document.createElement('div'); d.className='dot dot-task';     row.appendChild(d); }
      if (reminderDates.has(dateStr)) { const d=document.createElement('div'); d.className='dot dot-reminder'; row.appendChild(d); }
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

  renderDayReminders(dateStr);
  renderCalendar();
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
  save();
  document.getElementById('r-text').value='';
  document.getElementById('r-time').value='';
  document.getElementById('reminder-form').style.display='none';
  renderDayReminders(selectedCalDay);
  renderCalendar();
}

function deleteReminder(dateStr,idx) {
  reminders[dateStr].splice(idx,1);
  if (!reminders[dateStr].length) delete reminders[dateStr];
  save(); renderDayReminders(dateStr); renderCalendar();
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
  n.pinned = !n.pinned;
  save(); renderNotes();
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
  const srcPinned = notes[srcIdx].pinned;
  const tgtPinned = notes[tgtIdx].pinned;
  if (srcPinned !== tgtPinned) return;
  const [moved] = notes.splice(srcIdx, 1);
  notes.splice(tgtIdx, 0, moved);
  save(); renderNotes();
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
    n.title=title; n.body=body; n.color=selectedNoteColor;
  } else {
    notes.unshift({id:Date.now(),title,body,color:selectedNoteColor,pinned:false,created:new Date().toISOString()});
  }
  save(); closeNoteModal(); renderNotes();
}

function deleteNote(id) {
  const n = notes.find(n=>n.id===id);
  if (!n) return;
  trash.notes.unshift({ ...n, deletedAt: new Date().toISOString() });
  notes = notes.filter(n=>n.id!==id);
  save(); renderNotes();
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
  const total = tTasks.length + tNotes.length + tColleges.length + tTeachers.length + tVisits.length + tEvals.length;

  document.getElementById('btn-empty-all').style.display = total ? '' : 'none';
  document.getElementById('trash-empty-state').style.display = total ? 'none' : '';
  document.getElementById('trash-tasks-section').style.display    = tTasks.length    ? '' : 'none';
  document.getElementById('trash-notes-section').style.display    = tNotes.length    ? '' : 'none';
  document.getElementById('trash-colleges-section').style.display = tColleges.length ? '' : 'none';
  document.getElementById('trash-teachers-section').style.display = tTeachers.length ? '' : 'none';
  document.getElementById('trash-visits-section').style.display   = tVisits.length   ? '' : 'none';
  document.getElementById('trash-evals-section').style.display    = tEvals.length    ? '' : 'none';

  document.getElementById('trash-task-count').textContent    = tTasks.length;
  document.getElementById('trash-note-count').textContent    = tNotes.length;
  document.getElementById('trash-college-count').textContent = tColleges.length;
  document.getElementById('trash-teacher-count').textContent = tTeachers.length;
  document.getElementById('trash-visit-count').textContent   = tVisits.length;
  document.getElementById('trash-eval-count').textContent    = tEvals.length;

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
}

function restoreTask(id) {
  const t = trash.tasks.find(t=>t.id===Number(id));
  if (!t) return;
  const { deletedAt, ...restored } = t;
  tasks.unshift(restored);
  trash.tasks = trash.tasks.filter(t=>t.id!==Number(id));
  save(); renderTrash(); renderDashboard();
}
function permDeleteTask(id) {
  if (!confirm('¿Eliminar esta tarea permanentemente? Esta acción no se puede deshacer.')) return;
  trash.tasks = trash.tasks.filter(t=>t.id!==Number(id));
  save(); renderTrash();
}
function restoreNote(id) {
  const n = trash.notes.find(n=>n.id===Number(id));
  if (!n) return;
  const { deletedAt, ...restored } = n;
  notes.unshift(restored);
  trash.notes = trash.notes.filter(n=>n.id!==Number(id));
  save(); renderTrash();
}
function permDeleteNote(id) {
  if (!confirm('¿Eliminar esta nota permanentemente? Esta acción no se puede deshacer.')) return;
  trash.notes = trash.notes.filter(n=>n.id!==Number(id));
  save(); renderTrash();
}
function restoreCollege(id) {
  const c = (trash.colleges||[]).find(c=>c.id===id);
  if (!c) return;
  const { deletedAt, ...restored } = c;
  colleges.push(restored);
  trash.colleges = (trash.colleges||[]).filter(c=>c.id!==id);
  saveColleges(); save(); renderTrash();
}
function permDeleteCollege(id) {
  if (!confirm('¿Eliminar este colegio permanentemente? Esta acción no se puede deshacer.')) return;
  trash.colleges = (trash.colleges||[]).filter(c=>c.id!==id);
  save(); renderTrash();
}
function restoreTeacher(deletedAt) {
  const t = (trash.teachers||[]).find(t=>t.deletedAt===deletedAt);
  if (!t) return;
  const c = colleges.find(c=>c.id===t.collegeId);
  if (c) { const { deletedAt: _, collegeId: __, collegeName: ___, origIdx: ____, ...restored } = t; c.teachers.push(restored); saveColleges(); }
  trash.teachers = (trash.teachers||[]).filter(t=>t.deletedAt!==deletedAt);
  save(); renderTrash();
}
function permDeleteTeacher(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.teachers = (trash.teachers||[]).filter(t=>t.deletedAt!==deletedAt);
  save(); renderTrash();
}
function restoreVisit(deletedAt) {
  const v = (trash.visits||[]).find(v=>v.deletedAt===deletedAt);
  if (!v) return;
  const c = colleges.find(c=>c.id===v.collegeId);
  if (c) { const { deletedAt: _, collegeId: __, collegeName: ___, ...restored } = v; c.visits.push(restored); saveColleges(); }
  trash.visits = (trash.visits||[]).filter(v=>v.deletedAt!==deletedAt);
  save(); renderTrash();
}
function permDeleteVisit(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.visits = (trash.visits||[]).filter(v=>v.deletedAt!==deletedAt);
  save(); renderTrash();
}
function restoreEval(deletedAt) {
  const e = (trash.evals||[]).find(e=>e.deletedAt===deletedAt);
  if (!e) return;
  const c = colleges.find(c=>c.id===e.collegeId);
  if (c) { const { deletedAt: _, collegeId: __, collegeName: ___, ...restored } = e; c.evaluations.unshift(restored); saveColleges(); }
  trash.evals = (trash.evals||[]).filter(e=>e.deletedAt!==deletedAt);
  save(); renderTrash();
}
function permDeleteEval(deletedAt) {
  if (!confirm('¿Eliminar permanentemente?')) return;
  trash.evals = (trash.evals||[]).filter(e=>e.deletedAt!==deletedAt);
  save(); renderTrash();
}
function emptyTrash() {
  if (!confirm('¿Vaciar toda la papelera? Todos los elementos se eliminarán permanentemente y no podrás recuperarlos.')) return;
  trash = { tasks: [], notes: [], colleges: [], teachers: [], visits: [], evals: [] };
  save(); renderTrash();
}

// Cerrar modales al clic fuera
['task-modal','note-modal'].forEach(id=>{
  document.getElementById(id).addEventListener('click',function(e){
    if(e.target===this) { id==='task-modal'?closeTaskModal():closeNoteModal(); }
  });
});


// ══ COLEGIOS ══
let colleges = JSON.parse(localStorage.getItem('flow_colleges') || '[]');
let currentCollegeId = null;

const COLLEGE_THEMES = {
  girasol:  { icon: '🌻', label: 'Girasol',  badge: 'badge-girasol' },
  margarita:{ icon: '🌸', label: 'Margarita', badge: 'badge-margarita' },
  tulipan:  { icon: '🌷', label: 'Tulipán',   badge: 'badge-tulipan' }
};

function saveColleges() {
  localStorage.setItem('flow_colleges', JSON.stringify(colleges));
}

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
  // reset tabs
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
    if (c) { c.name = name; c.theme = document.getElementById('cm-theme').value; c.location = document.getElementById('cm-location').value.trim(); }
  } else {
    colleges.push({ id: Date.now(), name, theme: document.getElementById('cm-theme').value, location: document.getElementById('cm-location').value.trim(), teachers: [], visits: [], evaluations: [], todos: [], created: new Date().toISOString() });
  }
  saveColleges(); closeCollegeModal(); renderColleges();
}
function deleteCollege(id) {
  if (!confirm('¿Mover este colegio a la papelera?')) return;
  const c = colleges.find(c => c.id === id);
  if (!c) return;
  if (!trash.colleges) trash.colleges = [];
  trash.colleges.push({ ...c, deletedAt: new Date().toISOString() });
  colleges = colleges.filter(c => c.id !== id);
  saveColleges(); save(); renderColleges();
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
  saveColleges(); closeModal('teacher-modal');
  ['tm-name','tm-grade'].forEach(id => document.getElementById(id).value = '');
  editingTeacherIdx = null;
  renderTeachers();
}
function deleteTeacher(idx) {
  const c = currentCollege();
  const t = c.teachers[idx];
  if (!trash.teachers) trash.teachers = [];
  trash.teachers.push({ ...t, collegeId: c.id, collegeName: c.name, deletedAt: new Date().toISOString(), origIdx: idx });
  c.teachers.splice(idx, 1);
  saveColleges(); save(); renderTeachers();
}

// Visits
function renderVisits() {
  const c = currentCollege(); if (!c) return;
  const list = document.getElementById('visits-list');
  const empty = document.getElementById('visits-empty');
  const sorted = [...c.visits].sort((a,b) => a.date < b.date ? 1 : -1);
  if (!sorted.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = sorted.map((v,i) => `
    <div class="visit-item">
      <div class="visit-date">📅 ${fmtDate(v.date)}</div>
      <div class="visit-purpose">${esc(v.purpose)}</div>
      ${v.notes ? `<div class="visit-notes">${esc(v.notes)}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px">
        <button class="btn-edit-sm" onclick="openEditVisitModal(${c.visits.indexOf(v)})" title="Editar">✏️ Editar</button>
        <button class="teacher-del" onclick="deleteVisit(${c.visits.indexOf(v)})" title="Eliminar">✕ Eliminar</button>
      </div>
    </div>`).join('');
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
  saveColleges(); closeModal('visit-modal');
  ['vm-date','vm-purpose','vm-notes'].forEach(id => document.getElementById(id).value = '');
  editingVisitIdx = null;
  renderVisits();
}
function deleteVisit(idx) {
  const c = currentCollege();
  const v = c.visits[idx];
  if (!trash.visits) trash.visits = [];
  trash.visits.push({ ...v, collegeId: c.id, collegeName: c.name, deletedAt: new Date().toISOString() });
  c.visits.splice(idx,1);
  saveColleges(); save(); renderVisits();
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
  // Populate teacher dropdown
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
  // Populate teacher dropdown
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
  saveColleges(); closeModal('eval-modal');
  ['em-teacher','em-date','em-strengths','em-improvements','em-commitments'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('em-rating').value = '5';
  editingEvalIdx = null;
  renderEvals();
}
function deleteEval(idx) {
  const c = currentCollege();
  const e = c.evaluations[idx];
  if (!trash.evals) trash.evals = [];
  trash.evals.push({ ...e, collegeId: c.id, collegeName: c.name, deletedAt: new Date().toISOString() });
  c.evaluations.splice(idx,1);
  saveColleges(); save(); renderEvals();
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
  saveColleges(); renderCollegeTodos();
}
function toggleCollegeTodo(idx) {
  const c = currentCollege();
  c.todos[idx].done = !c.todos[idx].done;
  saveColleges(); renderCollegeTodos();
}
function deleteCollegeTodo(idx) {
  const c = currentCollege();
  c.todos.splice(idx,1);
  saveColleges(); renderCollegeTodos();
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

// INIT
renderDashboard();
renderCalendar();

// ── MENÚ HAMBURGUESA (móvil) ──
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('sidebar-active');
});

document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.remove('sidebar-active');
});

document.querySelectorAll('.sidebar .nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('sidebar-active');
  });
});
