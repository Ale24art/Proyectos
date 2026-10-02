/* ═══════════════════════════════════════════════════════════════
   app.js · Listas por grado/sección, validación y descarga de PDF
   ═══════════════════════════════════════════════════════════════ */

const $ = s => document.querySelector(s);
const COLS = ['user', 'last', 'first'];

/* ── Textos de la interfaz (inglés = Cleveland, español = TecnoCleveland) ── */
const T = {
  en: {
    logoTail: ' ID cards', logoSub: 'Cleveland English Institute · Moodle', change: 'Change academy',
    appTitle: 'ID card generator',
    appSub: 'Save one list per grade and section. The app groups them by grade and builds the PDFs.',
    newList: 'New list', editList: 'Editing list',
    media: 'High School · Years 1–5', primaria: 'Primary School · Grades 1–6',
    f_gradeMedia: 'Year', f_gradePrim: 'Grade', pickGrade: 'Choose…',
    f_section: 'Section (optional)', h_section: 'Leave empty if this grade has no sections.', ph_section: 'A',
    f_pass: 'Password', h_pass: 'The same password for every student in this list.', ph_pass: '1234',
    dataHint: 'Paste one column per box, one student per line. Line 1 of every box is the same student.',
    pasteTip: 'Tip: copy the columns from Excel or Sheets and paste them into the first box — they spread across the boxes to its right.',
    f_user: 'Username', f_last: 'Last names', f_first: 'First names',
    ph_user: 'sje227', ph_last: 'MONTILLA VALERO', ph_first: 'JOSE ALEJANDRO',
    lines: n => `${n} ${n === 1 ? 'line' : 'lines'}`,
    example: 'Load example', clearForm: 'Clear form',
    save: 'Save list', update: 'Update list', cancelEdit: 'Cancel editing',
    savedTitle: 'Saved lists',
    empty: 'No lists yet. Fill in the form above and press “Save list”.',
    total: (n, l, g) => `${n} students · ${l} ${l === 1 ? 'list' : 'lists'} · ${g} ${g === 1 ? 'grade' : 'grades'}`,
    meta: (n, p, l) => `${n} cards · ${p} ${p === 1 ? 'page' : 'pages'} · ${l} ${l === 1 ? 'list' : 'lists'}`,
    levelName: { media: 'High School', primaria: 'Primary School' },
    secName: s => s ? `Section ${s}` : 'No section',
    cards: n => `${n} ${n === 1 ? 'card' : 'cards'}`,
    gradePdf: 'Download grade PDF', pdf: 'PDF', preview: 'Preview', edit: 'Edit', del: 'Delete',
    zipAll: 'Download all grades (.zip)', delAll: 'Delete all lists',
    optionsTitle: 'Print options', optLayout: 'Cards per page', optUrl: 'Website on the card',
    layoutBig: '14 · large (2 × 7)', layoutCompact: '24 · compact (3 × 8)', optUpper: 'Print names in capital letters',
    close: 'Close', working: 'Creating…',
    errGrade: 'Choose the year or grade.', errPass: 'Enter the password for this list.',
    errEmpty: 'Paste at least one student.',
    errCounts: c => `Every column must have the same number of lines. Found: ${c}.`,
    errMissing: 'These lines are missing a username, last name or first name:',
    line: i => `Line ${i}`, more: n => `…and ${n} more`,
    confirmReplace: (g, s) => `A list for ${g}${s ? ' · Section ' + s : ''} already exists. Replace it?`,
    confirmDel: (g, s) => `Delete the list for ${g}${s ? ' · Section ' + s : ''}?`,
    confirmDelAll: 'Delete ALL saved lists? This cannot be undone.',
    saved: 'List saved', updated: 'List updated', deleted: 'List deleted', doneOne: 'PDF downloaded', doneZip: 'ZIP downloaded',
    fail: 'Something went wrong while creating the PDF.', sectionWord: 'Section', sectionFile: 'Section'
  },
  es: {
    logoTail: ' carnets', logoSub: 'TecnoCleveland · Moodle', change: 'Cambiar academia',
    appTitle: 'Generador de carnets',
    appSub: 'Guarda una lista por grado y sección. El programa las agrupa por grado y crea los PDF.',
    newList: 'Nueva lista', editList: 'Editando lista',
    media: 'Educación Media · 1.º a 5.º año', primaria: 'Educación Primaria · 1.º a 6.º grado',
    f_gradeMedia: 'Año', f_gradePrim: 'Grado', pickGrade: 'Elige…',
    f_section: 'Sección (opcional)', h_section: 'Déjala vacía si este grado no tiene secciones.', ph_section: 'A',
    f_pass: 'Clave', h_pass: 'La misma clave para todos los estudiantes de esta lista.', ph_pass: '1234',
    dataHint: 'Pega una columna por caja, un estudiante por línea. La línea 1 de todas las cajas es el mismo estudiante.',
    pasteTip: 'Consejo: copia las columnas desde Excel o Sheets y pégalas en la primera caja; se reparten en las cajas de su derecha.',
    f_user: 'Usuario', f_last: 'Apellidos', f_first: 'Nombres',
    ph_user: 'sje227', ph_last: 'MONTILLA VALERO', ph_first: 'JOSE ALEJANDRO',
    lines: n => `${n} ${n === 1 ? 'línea' : 'líneas'}`,
    example: 'Cargar ejemplo', clearForm: 'Limpiar formulario',
    save: 'Guardar lista', update: 'Actualizar lista', cancelEdit: 'Cancelar edición',
    savedTitle: 'Listas guardadas',
    empty: 'Aún no hay listas. Completa el formulario de arriba y pulsa «Guardar lista».',
    total: (n, l, g) => `${n} estudiantes · ${l} ${l === 1 ? 'lista' : 'listas'} · ${g} ${g === 1 ? 'grado' : 'grados'}`,
    meta: (n, p, l) => `${n} carnets · ${p} ${p === 1 ? 'página' : 'páginas'} · ${l} ${l === 1 ? 'lista' : 'listas'}`,
    levelName: { media: 'Educación Media', primaria: 'Educación Primaria' },
    secName: s => s ? `Sección ${s}` : 'Sin sección',
    cards: n => `${n} ${n === 1 ? 'carnet' : 'carnets'}`,
    gradePdf: 'Descargar PDF del grado', pdf: 'PDF', preview: 'Vista previa', edit: 'Editar', del: 'Eliminar',
    zipAll: 'Descargar todos los grados (.zip)', delAll: 'Eliminar todas las listas',
    optionsTitle: 'Opciones de impresión', optLayout: 'Carnets por página', optUrl: 'Sitio web en el carnet',
    layoutBig: '14 · grandes (2 × 7)', layoutCompact: '24 · compactos (3 × 8)', optUpper: 'Imprimir nombres en mayúsculas',
    close: 'Cerrar', working: 'Creando…',
    errGrade: 'Elige el año o grado.', errPass: 'Escribe la clave de esta lista.',
    errEmpty: 'Pega al menos un estudiante.',
    errCounts: c => `Todas las columnas deben tener el mismo número de líneas. Encontré: ${c}.`,
    errMissing: 'A estas líneas les falta el usuario, el apellido o el nombre:',
    line: i => `Línea ${i}`, more: n => `…y ${n} más`,
    confirmReplace: (g, s) => `Ya existe una lista de ${g}${s ? ' · Sección ' + s : ''}. ¿Reemplazarla?`,
    confirmDel: (g, s) => `¿Eliminar la lista de ${g}${s ? ' · Sección ' + s : ''}?`,
    confirmDelAll: '¿Eliminar TODAS las listas guardadas? No se puede deshacer.',
    saved: 'Lista guardada', updated: 'Lista actualizada', deleted: 'Lista eliminada', doneOne: 'PDF descargado', doneZip: 'ZIP descargado',
    fail: 'Ocurrió un problema al crear el PDF.', sectionWord: 'Sección', sectionFile: 'Seccion'
  }
};

const state = { academy: null, level: 'primaria', lists: [], editing: null };
const t = () => T[state.academy.lang];
const storeKey = () => 'cleveland-carnets-lists-' + state.academy.id;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ═════════ Persistencia (localStorage de este navegador) ═════════ */
function loadLists() {
  try { state.lists = JSON.parse(localStorage.getItem(storeKey()) || '[]'); } catch (e) { state.lists = []; }
}
function persist() { try { localStorage.setItem(storeKey(), JSON.stringify(state.lists)); } catch (e) {} }

/* ═════════ Navegación ═════════ */
function pickAcademy(id) {
  state.academy = ACADEMIES[id];
  document.body.dataset.academy = id;
  document.body.dataset.screen = 'app';
  document.documentElement.lang = state.academy.lang;
  $('#screen-home').hidden = true; $('#screen-app').hidden = false;
  loadLists(); state.editing = null;
  buildUI(); renderLists(); window.scrollTo(0, 0);
}
function goHome() {
  state.academy = null;
  document.body.dataset.academy = ''; document.body.dataset.screen = 'home';
  document.documentElement.lang = 'es';
  $('#screen-home').hidden = false; $('#screen-app').hidden = true;
  $('#academy-chip').hidden = true; $('#btn-change').hidden = true;
  $('#logo-text').innerHTML = 'Generador<span class="logo-accent"> de carnets</span>';
  $('#logo-sub').textContent = 'Cleveland · Moodle';
}

/* ═════════ Interfaz según idioma ═════════ */
function buildUI() {
  const L = t(), A = state.academy;
  $('#logo-text').innerHTML = A.lang === 'en'
    ? `Cleveland<span class="logo-accent">${L.logoTail}</span>`
    : `Tecno<span class="logo-accent">Cleveland</span><span class="logo-tail">${L.logoTail}</span>`;
  $('#logo-sub').textContent = L.logoSub;
  $('#academy-chip').hidden = false; $('#academy-chip').textContent = A.name;
  $('#btn-change').hidden = false; $('#btn-change').textContent = L.change;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = L[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = L[el.dataset.i18nPh]; });
  $('#modal-close').textContent = L.close;
  document.querySelectorAll('#level-seg .seg-btn').forEach(b => { b.textContent = L[b.dataset.level]; });
  const lay = $('#opt-layout'), cur = lay.value || 'big';
  lay.innerHTML = `<option value="big">${L.layoutBig}</option><option value="compact">${L.layoutCompact}</option>`;
  lay.value = cur;
  $('#opt-url').value = A.url;
  resetForm();
}

function buildGradeSelect(selected) {
  const max = LEVELS[state.level].max, L = t();
  $('#lbl-grade').textContent = state.level === 'media' ? L.f_gradeMedia : L.f_gradePrim;
  let html = `<option value="">${L.pickGrade}</option>`;
  for (let g = 1; g <= max; g++) html += `<option value="${g}">${gradeLabel(state.academy, state.level, g)}</option>`;
  $('#f-grade').innerHTML = html;
  $('#f-grade').value = selected ? String(selected) : '';
}
function setLevel(level, keepGrade) {
  const prev = $('#f-grade').value;
  state.level = level;
  document.querySelectorAll('#level-seg .seg-btn').forEach(b => b.setAttribute('aria-checked', b.dataset.level === level));
  buildGradeSelect(keepGrade ? prev : '');
}

/* ═════════ Formulario ═════════ */
function readLines(id) {
  const a = document.getElementById(id).value.replace(/\r/g, '').split('\n').map(s => s.trim());
  while (a.length && a[a.length - 1] === '') a.pop();
  return a;
}
function updateCounts() {
  const L = t(), cols = COLS.map(c => readLines('f-' + c)), n = Math.max(...cols.map(c => c.length));
  COLS.forEach((c, i) => {
    const el = $('#cnt-' + c), len = cols[i].length;
    el.textContent = L.lines(len);
    el.className = 'col-count' + (n === 0 ? '' : len === n ? ' ok' : ' bad');
    document.getElementById('f-' + c).classList.toggle('bad', n > 0 && len !== n);
  });
}
function resetForm() {
  state.editing = null;
  setLevel(state.level, false);
  ['f-section', 'f-pass', 'f-user', 'f-last', 'f-first'].forEach(id => document.getElementById(id).value = '');
  $('#form-status').innerHTML = '';
  $('#form-title').textContent = t().newList;
  $('#btn-save').textContent = t().save;
  $('#btn-cancel').hidden = true;
  $('#form-card').classList.remove('editing');
  updateCounts();
}

function smartPaste(e, idx) {
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text.includes('\t')) return;
  e.preventDefault();
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const cells = rows.map(r => r.split('\t'));
  const ncols = Math.max(...cells.map(r => r.length));
  for (let c = 0; c < ncols && idx + c < COLS.length; c++)
    document.getElementById('f-' + COLS[idx + c]).value = cells.map(r => (r[c] || '').trim()).join('\n');
  updateCounts();
}
function syncScroll(src) {
  COLS.forEach(c => { const el = document.getElementById('f-' + c); if (el !== src) el.scrollTop = src.scrollTop; });
}

function saveList() {
  const L = t(), errs = [];
  const grade = parseInt($('#f-grade').value, 10);
  const section = $('#f-section').value.trim().toLocaleUpperCase();
  const pass = $('#f-pass').value.trim();
  const cols = {}; COLS.forEach(c => cols[c] = readLines('f-' + c));
  const n = Math.max(...COLS.map(c => cols[c].length));
  const box = $('#form-status');
  const alert = h => `<div class="alert">${h}</div>`;
  const listHtml = (arr, fn) => '<ul>' + arr.slice(0, 6).map(fn).join('') + (arr.length > 6 ? `<li>${L.more(arr.length - 6)}</li>` : '') + '</ul>';

  if (!grade) errs.push(alert(L.errGrade));
  if (!pass) errs.push(alert(L.errPass));
  if (n === 0) errs.push(alert(L.errEmpty));
  else if (COLS.some(c => cols[c].length !== n)) {
    errs.push(alert(L.errCounts(COLS.map(c => `${L['f_' + c]} ${cols[c].length}`).join(' · '))));
  } else {
    const miss = [];
    for (let i = 0; i < n; i++) if (!cols.user[i] || !cols.last[i] || !cols.first[i]) miss.push(i + 1);
    if (miss.length) errs.push(alert(L.errMissing + listHtml(miss, i => `<li>${L.line(i)}</li>`)));
  }
  if (errs.length) { box.innerHTML = errs.join(''); return; }
  box.innerHTML = '';

  const gl = gradeLabel(state.academy, state.level, grade);
  const dup = state.lists.find(l => l.level === state.level && l.grade === grade && l.section === section && l.id !== state.editing);
  if (dup) {
    if (!confirm(L.confirmReplace(gl, section))) return;
    state.lists = state.lists.filter(l => l.id !== dup.id);
  }
  const data = {
    level: state.level, grade, section, pass,
    students: cols.user.map((u, i) => ({ user: u, last: cols.last[i], first: cols.first[i] }))
  };
  const was = state.editing;
  if (was) {
    const i = state.lists.findIndex(l => l.id === was);
    if (i >= 0) state.lists[i] = Object.assign({ id: was }, data); else state.lists.push(Object.assign({ id: uid() }, data));
  } else state.lists.push(Object.assign({ id: uid() }, data));   // el orden de guardado se conserva
  persist(); renderLists();
  const keepLevel = state.level;
  resetForm(); setLevel(keepLevel, false);
  toast(was ? L.updated : L.saved);
}

function editList(id) {
  const l = state.lists.find(x => x.id === id); if (!l) return;
  state.editing = id; state.level = l.level;
  setLevel(l.level, false); buildGradeSelect(l.grade);
  $('#f-section').value = l.section; $('#f-pass').value = l.pass;
  $('#f-user').value = l.students.map(s => s.user).join('\n');
  $('#f-last').value = l.students.map(s => s.last).join('\n');
  $('#f-first').value = l.students.map(s => s.first).join('\n');
  $('#form-status').innerHTML = '';
  $('#form-title').textContent = t().editList + ' · ' + gradeLabel(state.academy, l.level, l.grade) + (l.section ? ' · ' + l.section : '');
  $('#btn-save').textContent = t().update;
  $('#btn-cancel').hidden = false;
  $('#form-card').classList.add('editing');
  updateCounts();
  $('#form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteList(id) {
  const l = state.lists.find(x => x.id === id); if (!l) return;
  if (!confirm(t().confirmDel(gradeLabel(state.academy, l.level, l.grade), l.section))) return;
  state.lists = state.lists.filter(x => x.id !== id);
  if (state.editing === id) resetForm();
  persist(); renderLists(); toast(t().deleted);
}

/* ═════════ Listas guardadas, agrupadas por grado ═════════ */
function groupLists() {
  const map = new Map();
  state.lists.forEach(l => {
    const k = l.level + '|' + l.grade;
    if (!map.has(k)) map.set(k, { level: l.level, grade: l.grade, lists: [] });
    map.get(k).lists.push(l);                         // orden de guardado
  });
  return [...map.values()].sort((a, b) => (a.level === b.level ? a.grade - b.grade : a.level === 'media' ? -1 : 1));
}
const perPage = () => { const l = LAYOUTS[$('#opt-layout').value]; return l.cols * l.rows; };

function renderLists() {
  const L = t(), box = $('#results'), groups = groupLists();
  const totalStudents = state.lists.reduce((s, l) => s + l.students.length, 0);
  $('#btn-zip').hidden = groups.length < 2; $('#btn-zip').textContent = L.zipAll;
  $('#btn-delall').hidden = !state.lists.length; $('#btn-delall').textContent = L.delAll;
  $('#total').textContent = state.lists.length ? L.total(totalStudents, state.lists.length, groups.length) : '';
  if (!groups.length) { box.innerHTML = `<div class="empty">${L.empty}</div>`; return; }

  box.innerHTML = groups.map(g => {
    const cnt = g.lists.reduce((s, l) => s + l.students.length, 0);
    const key = g.level + '|' + g.grade;
    return `<div class="group">
      <div class="group-head">
        <div class="grade-bar"></div>
        <div><div class="grade-name">${gradeLabel(state.academy, g.level, g.grade)}</div>
          <div class="grade-meta">${L.levelName[g.level]} · ${L.meta(cnt, Math.ceil(cnt / perPage()), g.lists.length)}</div></div>
        <div class="grade-actions">
          <button class="btn ghost sm" data-act="preview-grade" data-k="${key}">${L.preview}</button>
          <button class="btn primary sm" data-act="dl-grade" data-k="${key}">${L.gradePdf}</button>
        </div>
      </div>
      <div class="sub-list">` + g.lists.map((l, i) => `
        <div class="sub-row">
          <div class="sub-name"><span class="order-n">${i + 1}</span>
            <span class="pill${l.section ? '' : ' none'}">${L.secName(l.section)}</span>
            <span class="sub-count">${L.cards(l.students.length)}</span></div>
          <div class="grade-actions">
            <button class="btn ghost sm" data-act="preview-list" data-id="${l.id}">${L.preview}</button>
            <button class="btn sm" data-act="dl-list" data-id="${l.id}">${L.pdf}</button>
            <button class="btn ghost sm" data-act="edit" data-id="${l.id}">${L.edit}</button>
            <button class="btn ghost sm danger" data-act="del" data-id="${l.id}">${L.del}</button>
          </div>
        </div>`).join('') + `</div></div>`;
  }).join('');
}

/* ═════════ Generación de PDF ═════════ */
function studentsOf(lists) {
  const upper = $('#opt-upper').checked;
  return lists.flatMap(l => l.students.map(s => {
    const name = `${s.first} ${s.last}`.replace(/\s+/g, ' ').trim();
    return { name: upper ? name.toLocaleUpperCase() : name, user: s.user, pass: l.pass, section: l.section };
  }));
}
function makeDoc(lists, level, grade, sectionText) {
  return buildPDF(studentsOf(lists), {
    acad: state.academy, level, grade, sectionText,
    layout: $('#opt-layout').value, url: $('#opt-url').value.trim() || state.academy.url
  });
}
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const prefix = () => state.academy.lang === 'en' ? 'ID-Cards' : 'Carnets';
const levelTag = lv => lv === 'media' ? 'Media' : 'Primaria';
function groupOf(key) { return groupLists().find(g => g.level + '|' + g.grade === key); }

function gradeJob(key) {
  const g = groupOf(key);
  return { doc: () => makeDoc(g.lists, g.level, g.grade, ''), name: `${prefix()}_${slug(state.academy.short)}_${levelTag(g.level)}_${slug(gradeLabel(state.academy, g.level, g.grade))}.pdf`,
           title: gradeLabel(state.academy, g.level, g.grade) };
}
function listJob(id) {
  const l = state.lists.find(x => x.id === id), L = t();
  const gl = gradeLabel(state.academy, l.level, l.grade);
  return { doc: () => makeDoc([l], l.level, l.grade, l.section ? `${L.sectionWord} ${l.section}` : ''),
           name: `${prefix()}_${slug(state.academy.short)}_${levelTag(l.level)}_${slug(gl)}${l.section ? '_' + L.sectionFile + '-' + slug(l.section) : ''}.pdf`,
           title: gl + (l.section ? ' · ' + L.secName(l.section) : '') };
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}
function openPreview(job) {
  try {
    const url = URL.createObjectURL(job.doc().output('blob'));
    $('#modal-title').textContent = job.title;
    $('#modal-frame').src = url + '#toolbar=0&navpanes=0';
    $('#modal').hidden = false; $('#modal').dataset.url = url;
  } catch (e) { console.error(e); toast(t().fail); }
}
function closePreview() {
  $('#modal').hidden = true; $('#modal-frame').src = 'about:blank';
  if ($('#modal').dataset.url) URL.revokeObjectURL($('#modal').dataset.url);
}
function download(job, btn) {
  const label = btn.textContent; btn.disabled = true; btn.textContent = t().working;
  setTimeout(() => {
    try { saveBlob(job.doc().output('blob'), job.name); toast(t().doneOne); }
    catch (e) { console.error(e); toast(t().fail); }
    btn.disabled = false; btn.textContent = label;
  }, 30);
}
function downloadZip(btn) {
  const label = btn.textContent; btn.disabled = true; btn.textContent = t().working;
  setTimeout(async () => {
    try {
      const zip = new JSZip();
      groupLists().forEach(g => { const j = gradeJob(g.level + '|' + g.grade); zip.file(j.name, j.doc().output('arraybuffer')); });
      saveBlob(await zip.generateAsync({ type: 'blob' }), `${prefix()}_${slug(state.academy.short)}.zip`);
      toast(t().doneZip);
    } catch (e) { console.error(e); toast(t().fail); }
    btn.disabled = false; btn.textContent = label;
  }, 30);
}

/* ═════════ Ejemplo ═════════ */
function loadExample() {
  $('#f-pass').value = '1234'; $('#f-section').value = 'A';
  if (!$('#f-grade').value) $('#f-grade').value = '4';
  $('#f-user').value = ['sje227', 'sje228', 'sje229', 'sje230'].join('\n');
  $('#f-last').value = ['ANGEL LEAL', 'MORALES SALINAS', 'COLMENARES RODRÍGUEZ', 'VILLEGAS PEREZ'].join('\n');
  $('#f-first').value = ['ARIADNA SOFÍA', 'HANNY VALERIA', 'PAULA', 'SAHIR EMILIANO'].join('\n');
  updateCounts();
}

/* ═════════ Eventos ═════════ */
document.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => pickAcademy(b.dataset.pick)));
$('#btn-change').addEventListener('click', goHome);
document.querySelectorAll('#level-seg .seg-btn').forEach(b => b.addEventListener('click', () => setLevel(b.dataset.level, true)));
COLS.forEach((c, i) => {
  const el = document.getElementById('f-' + c);
  el.addEventListener('input', updateCounts);
  el.addEventListener('paste', e => smartPaste(e, i));
  el.addEventListener('scroll', () => syncScroll(el));
});
$('#btn-save').addEventListener('click', saveList);
$('#btn-cancel').addEventListener('click', resetForm);
$('#btn-example').addEventListener('click', loadExample);
$('#btn-clear').addEventListener('click', resetForm);
$('#btn-delall').addEventListener('click', () => {
  if (!confirm(t().confirmDelAll)) return;
  state.lists = []; persist(); resetForm(); renderLists();
});
['#opt-layout', '#opt-upper'].forEach(s => $(s).addEventListener('change', renderLists));
$('#results').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  switch (b.dataset.act) {
    case 'preview-grade': return openPreview(gradeJob(b.dataset.k));
    case 'dl-grade': return download(gradeJob(b.dataset.k), b);
    case 'preview-list': return openPreview(listJob(b.dataset.id));
    case 'dl-list': return download(listJob(b.dataset.id), b);
    case 'edit': return editList(b.dataset.id);
    case 'del': return deleteList(b.dataset.id);
  }
});
$('#btn-zip').addEventListener('click', e => downloadZip(e.currentTarget));
$('#modal-close').addEventListener('click', closePreview);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closePreview(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closePreview(); });

function applyTheme(dark) { document.body.classList.toggle('dark', dark); try { localStorage.setItem('stk-dark', dark ? '1' : '0'); } catch (e) {} }
$('#btn-theme').addEventListener('click', () => applyTheme(!document.body.classList.contains('dark')));
try { if (localStorage.getItem('stk-dark') === '1') applyTheme(true); } catch (e) {}
