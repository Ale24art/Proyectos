/* ═══════════════════════════════════════════════════════════════
   carnets.js · Vista "Generador de carnets" del Organizador Moodle
   Módulo IIFE: expone solo window.Carnets = { init, render, closePreview }.
   Usa datos/funciones ya globales de script.js (data, saveData, esc,
   uid, showToast, extractAnioNum, slugify, normalize, showView) y el
   motor de PDF de carnets-pdf.js (window.CarnetsPDF).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Diccionario de interfaz (es/en), según ACADEMIA_ACTUAL.idiomaUI ── */
  const T = {
    es: {
      gradeMedia: 'Año', gradePrim: 'Grado', pick: 'Elige…',
      newList: 'Nueva lista', editList: 'Editando lista',
      save: 'Guardar lista', update: 'Actualizar lista',
      savedTitle: 'Listas guardadas',
      empty: 'Aún no hay listas. Completa el formulario de arriba y pulsa «Guardar lista».',
      total: (n, l, g) => `${n} estudiantes · ${l} ${l === 1 ? 'lista' : 'listas'} · ${g} ${g === 1 ? 'grado' : 'grados'}`,
      meta: (n, p, l) => `${n} carnets · ${p} ${p === 1 ? 'página' : 'páginas'} · ${l} ${l === 1 ? 'lista' : 'listas'}`,
      levelName: { media: 'Educación Media', primaria: 'Educación Primaria' },
      secName: s => s ? `Sección ${s}` : 'Sin sección',
      cards: n => `${n} ${n === 1 ? 'carnet' : 'carnets'}`,
      gradePdf: 'Descargar PDF del grado', pdf: 'PDF', preview: 'Vista previa', edit: 'Editar', del: 'Eliminar',
      zipAll: 'Descargar todos los grados (.zip)', delAll: 'Eliminar todas las listas',
      errGrade: 'Elige el año o grado.', errPass: 'Escribe la clave de esta lista.',
      errEmpty: 'Pega al menos un estudiante.',
      errCounts: c => `Todas las columnas deben tener el mismo número de líneas. Encontré: ${c}.`,
      errMissing: 'A estas líneas les falta el usuario, el apellido o el nombre:',
      line: i => `Línea ${i}`, more: n => `…y ${n} más`,
      confirmReplace: (g, s) => `Ya existe una lista de ${g}${s ? ' · Sección ' + s : ''}. ¿Reemplazarla?`,
      confirmDel: (g, s) => `¿Eliminar la lista de ${g}${s ? ' · Sección ' + s : ''}?`,
      confirmDelAll: '¿Eliminar TODAS las listas guardadas? No se puede deshacer.',
      saved: 'Lista guardada', updated: 'Lista actualizada', deleted: 'Lista eliminada',
      doneOne: 'PDF descargado', doneZip: 'ZIP descargado',
      fail: 'Ocurrió un problema al crear el PDF.', working: 'Creando…',
      sectionWord: 'Sección', sectionFile: 'Seccion'
    },
    en: {
      gradeMedia: 'Year', gradePrim: 'Grade', pick: 'Choose…',
      newList: 'New list', editList: 'Editing list',
      save: 'Save list', update: 'Update list',
      savedTitle: 'Saved lists',
      empty: 'No lists yet. Fill in the form above and press "Save list".',
      total: (n, l, g) => `${n} students · ${l} ${l === 1 ? 'list' : 'lists'} · ${g} ${g === 1 ? 'grade' : 'grades'}`,
      meta: (n, p, l) => `${n} cards · ${p} ${p === 1 ? 'page' : 'pages'} · ${l} ${l === 1 ? 'list' : 'lists'}`,
      levelName: { media: 'High School', primaria: 'Primary School' },
      secName: s => s ? `Section ${s}` : 'No section',
      cards: n => `${n} ${n === 1 ? 'card' : 'cards'}`,
      gradePdf: 'Download grade PDF', pdf: 'PDF', preview: 'Preview', edit: 'Edit', del: 'Delete',
      zipAll: 'Download all grades (.zip)', delAll: 'Delete all lists',
      errGrade: 'Choose the year or grade.', errPass: 'Enter the password for this list.',
      errEmpty: 'Paste at least one student.',
      errCounts: c => `Every column must have the same number of lines. Found: ${c}.`,
      errMissing: 'These lines are missing a username, last name or first name:',
      line: i => `Line ${i}`, more: n => `…and ${n} more`,
      confirmReplace: (g, s) => `A list for ${g}${s ? ' · Section ' + s : ''} already exists. Replace it?`,
      confirmDel: (g, s) => `Delete the list for ${g}${s ? ' · Section ' + s : ''}?`,
      confirmDelAll: 'Delete ALL saved lists? This cannot be undone.',
      saved: 'List saved', updated: 'List updated', deleted: 'List deleted',
      doneOne: 'PDF downloaded', doneZip: 'ZIP downloaded',
      fail: 'Something went wrong while creating the PDF.', working: 'Creating…',
      sectionWord: 'Section', sectionFile: 'Section'
    }
  };
  function L() { return T[ACADEMIA_ACTUAL.idiomaUI] || T.es; }

  const CN_COLS = ['user', 'last', 'first'];

  /* ── Estado del módulo ── */
  let manualLevel = 'media';
  let editingListId = null;

  /* ═════════ Utilidades de generación de PDF ═════════ */
  function perPage() {
    const key = (data.carnetOpciones && data.carnetOpciones.layout) || 'big';
    const ly = (window.CarnetsPDF.layouts || {})[key] || { cols: 2, rows: 7 };
    return ly.cols * ly.rows;
  }

  function prefixCarnet() { return ACADEMIA_ACTUAL.idiomaCarnet === 'en' ? 'ID-Cards' : 'Carnets'; }
  function levelTag(nivel) { return nivel === 'media' ? 'Media' : 'Primaria'; }

  // Convierte una lista guardada a estudiantes "canónicos" {name,user,pass,section}
  function toCanonicalStudents(list) {
    const upper = !!(data.carnetOpciones && data.carnetOpciones.upper);
    return list.estudiantes.map(s => {
      const name = `${s.nombres} ${s.apellidos}`.replace(/\s+/g, ' ').trim();
      const pass = s.clave !== undefined ? s.clave : list.clave;
      return { name: upper ? name.toLocaleUpperCase() : name, user: s.usuario, pass, section: list.seccion };
    });
  }
  function studentsOfLists(lists) { return lists.flatMap(toCanonicalStudents); }

  function makeDoc(students, nivel, grado, sectionText) {
    return window.CarnetsPDF.buildPDF(students, {
      academiaId: ACADEMIA_ACTUAL.id,
      lang: ACADEMIA_ACTUAL.idiomaCarnet,
      level: nivel, grade: grado, sectionText,
      layout: (data.carnetOpciones && data.carnetOpciones.layout) || 'big',
      url: (data.carnetOpciones && data.carnetOpciones.url) || 'cursoscleveland.com'
    });
  }

  function groupByGrade(lists) {
    const map = new Map();
    lists.forEach(l => {
      const k = l.nivel + '|' + l.grado;
      if (!map.has(k)) map.set(k, { nivel: l.nivel, grado: l.grado, lists: [] });
      map.get(k).lists.push(l); // se conserva el orden de guardado
    });
    return [...map.values()].sort((a, b) => a.nivel === b.nivel ? a.grado - b.grado : (a.nivel === 'media' ? -1 : 1));
  }

  function gradeJob(lists, key) {
    const g = groupByGrade(lists).find(x => x.nivel + '|' + x.grado === key);
    if (!g) return null;
    const nombreGradoCarnet = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaCarnet, g.nivel, g.grado);
    const nombreGradoUI = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, g.nivel, g.grado);
    return {
      doc: () => makeDoc(studentsOfLists(g.lists), g.nivel, g.grado, ''),
      name: `${prefixCarnet()}_${slugify(ACADEMIA_ACTUAL.nombre)}_${levelTag(g.nivel)}_${slugify(nombreGradoCarnet)}.pdf`,
      title: nombreGradoUI
    };
  }
  function listJob(lists, id) {
    const l = lists.find(x => x.id === id);
    if (!l) return null;
    const Lx = L();
    const nombreGradoCarnet = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaCarnet, l.nivel, l.grado);
    const nombreGradoUI = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, l.nivel, l.grado);
    const sectionText = l.seccion ? `${Lx.sectionWord} ${l.seccion}` : '';
    return {
      doc: () => makeDoc(toCanonicalStudents(l), l.nivel, l.grado, sectionText),
      name: `${prefixCarnet()}_${slugify(ACADEMIA_ACTUAL.nombre)}_${levelTag(l.nivel)}_${slugify(nombreGradoCarnet)}${l.seccion ? '_' + Lx.sectionFile + '-' + slugify(l.seccion) : ''}.pdf`,
      title: nombreGradoUI + (l.seccion ? ' · ' + Lx.secName(l.seccion) : '')
    };
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function openPreview(job) {
    if (!job) return;
    try {
      const url = URL.createObjectURL(job.doc().output('blob'));
      document.getElementById('cn-preview-title').textContent = job.title;
      document.getElementById('cn-preview-frame').src = url + '#toolbar=0&navpanes=0';
      const modal = document.getElementById('cn-preview-modal');
      modal.classList.add('active');
      modal.dataset.url = url;
    } catch (e) { console.error(e); showToast(L().fail); }
  }
  function closePreview() {
    const modal = document.getElementById('cn-preview-modal');
    modal.classList.remove('active');
    document.getElementById('cn-preview-frame').src = 'about:blank';
    if (modal.dataset.url) { URL.revokeObjectURL(modal.dataset.url); delete modal.dataset.url; }
  }
  function downloadJob(job, btn) {
    if (!job) return;
    const Lx = L();
    const label = btn.textContent; btn.disabled = true; btn.textContent = Lx.working;
    setTimeout(() => {
      try { saveBlob(job.doc().output('blob'), job.name); showToast(Lx.doneOne); }
      catch (e) { console.error(e); showToast(Lx.fail); }
      btn.disabled = false; btn.textContent = label;
    }, 30);
  }
  function downloadZip(lists, btn) {
    const Lx = L();
    const label = btn.textContent; btn.disabled = true; btn.textContent = Lx.working;
    setTimeout(async () => {
      try {
        const zip = new JSZip();
        groupByGrade(lists).forEach(g => {
          const j = gradeJob(lists, g.nivel + '|' + g.grado);
          zip.file(j.name, j.doc().output('arraybuffer'));
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        saveBlob(blob, `${prefixCarnet()}_${slugify(ACADEMIA_ACTUAL.nombre)}.zip`);
        showToast(Lx.doneZip);
      } catch (e) { console.error(e); showToast(Lx.fail); }
      btn.disabled = false; btn.textContent = label;
    }, 30);
  }

  function renderResultsInto(containerId, lists, opts) {
    const Lx = L();
    const box = document.getElementById(containerId);
    const groups = groupByGrade(lists);
    const totalStudents = lists.reduce((s, l) => s + l.estudiantes.length, 0);

    if (opts.totalElId) {
      const el = document.getElementById(opts.totalElId);
      if (el) el.textContent = lists.length ? Lx.total(totalStudents, lists.length, groups.length) : '';
    }
    if (opts.zipBtnId) {
      const el = document.getElementById(opts.zipBtnId);
      if (el) { el.style.display = groups.length > 1 ? '' : 'none'; el.textContent = Lx.zipAll; }
    }
    if (opts.delAllBtnId) {
      const el = document.getElementById(opts.delAllBtnId);
      if (el) { el.style.display = lists.length ? '' : 'none'; el.textContent = Lx.delAll; }
    }

    if (!box) return;
    if (!groups.length) {
      box.innerHTML = opts.editable ? `<div class="empty-state">${esc(Lx.empty)}</div>` : '';
      return;
    }

    const per = perPage();
    const src = opts.editable ? 'manual' : 'participantes';
    box.innerHTML = groups.map(g => {
      const key = g.nivel + '|' + g.grado;
      const cnt = g.lists.reduce((s, l) => s + l.estudiantes.length, 0);
      const gradeNameUI = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, g.nivel, g.grado);
      return `<div class="cn-group">
        <div class="cn-group-head">
          <div class="cn-grade-bar"></div>
          <div>
            <div class="cn-grade-name">${esc(gradeNameUI)}</div>
            <div class="cn-grade-meta">${esc(Lx.levelName[g.nivel])} · ${esc(Lx.meta(cnt, Math.ceil(cnt / per), g.lists.length))}</div>
          </div>
          <div class="cn-grade-actions">
            <button class="btn btn-ghost sm" data-act="preview-grade" data-k="${esc(key)}" data-src="${src}">${esc(Lx.preview)}</button>
            <button class="btn btn-primary sm" data-act="dl-grade" data-k="${esc(key)}" data-src="${src}">${esc(Lx.gradePdf)}</button>
          </div>
        </div>
        <div class="cn-sub-list">` + g.lists.map((l, i) => `
          <div class="cn-sub-row">
            <div class="cn-sub-name">
              <span class="cn-order-n">${i + 1}</span>
              <span class="cn-pill${l.seccion ? '' : ' cn-pill-none'}">${esc(Lx.secName(l.seccion))}</span>
              ${opts.showCurso && l.cursoNombre ? `<span class="cn-sub-curso">${esc(l.cursoNombre)}</span>` : ''}
              <span class="cn-sub-count">${esc(Lx.cards(l.estudiantes.length))}</span>
            </div>
            <div class="cn-grade-actions">
              <button class="btn btn-ghost sm" data-act="preview-list" data-id="${esc(l.id)}" data-src="${src}">${esc(Lx.preview)}</button>
              <button class="btn btn-ghost sm" data-act="dl-list" data-id="${esc(l.id)}" data-src="${src}">${esc(Lx.pdf)}</button>
              ${opts.editable ? `<button class="btn btn-ghost sm" data-act="edit" data-id="${esc(l.id)}">${esc(Lx.edit)}</button>
              <button class="btn btn-ghost sm cn-danger" data-act="del" data-id="${esc(l.id)}">${esc(Lx.del)}</button>` : ''}
            </div>
          </div>`).join('') + `</div></div>`;
    }).join('');
  }

  function bindResultsClicks(containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const lists = data.carnetListas;
      switch (b.dataset.act) {
        case 'preview-grade': return openPreview(gradeJob(lists, b.dataset.k));
        case 'dl-grade': return downloadJob(gradeJob(lists, b.dataset.k), b);
        case 'preview-list': return openPreview(listJob(lists, b.dataset.id));
        case 'dl-list': return downloadJob(listJob(lists, b.dataset.id), b);
        case 'edit': return editManualList(b.dataset.id);
        case 'del': return deleteManualList(b.dataset.id);
      }
    });
  }

  /* ═════════ Opciones de impresión ═════════ */
  function syncOptionsFromData() {
    document.getElementById('cn-opt-layout').value = data.carnetOpciones.layout || 'big';
    document.getElementById('cn-opt-url').value = data.carnetOpciones.url || 'cursoscleveland.com';
    document.getElementById('cn-opt-upper').checked = !!data.carnetOpciones.upper;
  }
  function bindOptions() {
    document.getElementById('cn-opt-layout').addEventListener('change', (e) => {
      data.carnetOpciones.layout = e.target.value; saveData();
      renderManualResults();
    });
    document.getElementById('cn-opt-url').addEventListener('input', (e) => {
      data.carnetOpciones.url = e.target.value; saveData();
    });
    document.getElementById('cn-opt-upper').addEventListener('change', (e) => {
      data.carnetOpciones.upper = e.target.checked; saveData();
    });
  }

  /* ═════════ Crear desde cero ═════════ */
  function buildGradeSelect(selected) {
    const Lx = L();
    const max = (window.CarnetsPDF.levels[manualLevel] || {}).max || 5;
    document.getElementById('cn-lbl-grade').textContent = manualLevel === 'media' ? Lx.gradeMedia : Lx.gradePrim;
    let html = `<option value="">${esc(Lx.pick)}</option>`;
    for (let g = 1; g <= max; g++) {
      html += `<option value="${g}">${esc(window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, manualLevel, g))}</option>`;
    }
    const sel = document.getElementById('cn-f-grade');
    sel.innerHTML = html;
    sel.value = selected ? String(selected) : '';
  }
  function setManualLevel(level, keepGrade) {
    const prev = document.getElementById('cn-f-grade').value;
    manualLevel = level;
    document.querySelectorAll('#cn-level-seg .cn-seg-btn').forEach(b => b.classList.toggle('active', b.dataset.level === level));
    buildGradeSelect(keepGrade ? prev : '');
  }

  function cnReadLines(id) {
    const a = document.getElementById(id).value.replace(/\r/g, '').split('\n').map(s => s.trim());
    while (a.length && a[a.length - 1] === '') a.pop();
    return a;
  }
  function updateManualCounts() {
    const cols = CN_COLS.map(c => cnReadLines('cn-f-' + c));
    const n = Math.max(...cols.map(c => c.length));
    CN_COLS.forEach((c, i) => {
      const len = cols[i].length;
      const countEl = document.getElementById('cn-cnt-' + c);
      countEl.textContent = `${len} ${len === 1 ? 'línea' : 'líneas'}`;
      countEl.className = 'cn-col-count' + (n === 0 ? '' : len === n ? ' ok' : ' bad');
      document.getElementById('cn-f-' + c).classList.toggle('bad', n > 0 && len !== n);
    });
  }
  function smartPasteManual(e, idx) {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text.includes('\t')) return;
    e.preventDefault();
    const rows = text.replace(/\r/g, '').split('\n');
    while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
    const cells = rows.map(r => r.split('\t'));
    const ncols = Math.max(...cells.map(r => r.length));
    for (let c = 0; c < ncols && idx + c < CN_COLS.length; c++) {
      document.getElementById('cn-f-' + CN_COLS[idx + c]).value = cells.map(r => (r[c] || '').trim()).join('\n');
    }
    updateManualCounts();
  }

  function resetManualForm() {
    editingListId = null;
    setManualLevel(manualLevel, false);
    ['cn-f-section', 'cn-f-pass', 'cn-f-user', 'cn-f-last', 'cn-f-first'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cn-form-status').innerHTML = '';
    document.getElementById('cn-form-title').textContent = L().newList;
    document.getElementById('cn-btn-save').textContent = L().save;
    document.getElementById('cn-btn-cancel').style.display = 'none';
    updateManualCounts();
  }

  function loadExampleManual() {
    document.getElementById('cn-f-pass').value = '1234';
    document.getElementById('cn-f-section').value = 'A';
    if (!document.getElementById('cn-f-grade').value) document.getElementById('cn-f-grade').value = '4';
    document.getElementById('cn-f-user').value = ['sje227', 'sje228', 'sje229', 'sje230'].join('\n');
    document.getElementById('cn-f-last').value = ['ANGEL LEAL', 'MORALES SALINAS', 'COLMENARES RODRÍGUEZ', 'VILLEGAS PEREZ'].join('\n');
    document.getElementById('cn-f-first').value = ['ARIADNA SOFÍA', 'HANNY VALERIA', 'PAULA', 'SAHIR EMILIANO'].join('\n');
    updateManualCounts();
  }

  function saveManualList() {
    const Lx = L();
    const errs = [];
    const grado = parseInt(document.getElementById('cn-f-grade').value, 10);
    const seccion = document.getElementById('cn-f-section').value.trim().toLocaleUpperCase();
    const clave = document.getElementById('cn-f-pass').value.trim();
    const cols = {}; CN_COLS.forEach(c => { cols[c] = cnReadLines('cn-f-' + c); });
    const n = Math.max(...CN_COLS.map(c => cols[c].length));
    const box = document.getElementById('cn-form-status');
    const alertHtml = h => `<div class="cn-alert">${h}</div>`;
    const listHtml = (arr, fn) => '<ul>' + arr.slice(0, 6).map(fn).join('') + (arr.length > 6 ? `<li>${esc(Lx.more(arr.length - 6))}</li>` : '') + '</ul>';

    const colLabel = { user: 'Usuario', last: 'Apellidos', first: 'Nombres' };
    if (!grado) errs.push(alertHtml(esc(Lx.errGrade)));
    if (!clave) errs.push(alertHtml(esc(Lx.errPass)));
    if (n === 0) errs.push(alertHtml(esc(Lx.errEmpty)));
    else if (CN_COLS.some(c => cols[c].length !== n)) {
      errs.push(alertHtml(esc(Lx.errCounts(CN_COLS.map(c => `${colLabel[c]} ${cols[c].length}`).join(' · ')))));
    } else {
      const miss = [];
      for (let i = 0; i < n; i++) if (!cols.user[i] || !cols.last[i] || !cols.first[i]) miss.push(i + 1);
      if (miss.length) errs.push(alertHtml(esc(Lx.errMissing) + listHtml(miss, i => `<li>${esc(Lx.line(i))}</li>`)));
    }
    if (errs.length) { box.innerHTML = errs.join(''); return; }
    box.innerHTML = '';

    const gl = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, manualLevel, grado);
    const dup = data.carnetListas.find(l => l.nivel === manualLevel && l.grado === grado && l.seccion === seccion && l.id !== editingListId);
    if (dup) {
      if (!confirm(Lx.confirmReplace(gl, seccion))) return;
      data.carnetListas = data.carnetListas.filter(l => l.id !== dup.id);
    }
    const payload = {
      nivel: manualLevel, grado, seccion, clave,
      estudiantes: cols.user.map((u, i) => ({ usuario: u, apellidos: cols.last[i], nombres: cols.first[i] }))
    };
    const was = editingListId;
    if (was) {
      const i = data.carnetListas.findIndex(l => l.id === was);
      if (i >= 0) data.carnetListas[i] = Object.assign({ id: was }, payload);
      else data.carnetListas.push(Object.assign({ id: uid() }, payload));
    } else {
      data.carnetListas.push(Object.assign({ id: uid() }, payload)); // se conserva el orden de guardado
    }
    saveData();
    renderManualResults();
    const keepLevel = manualLevel;
    resetManualForm();
    setManualLevel(keepLevel, false);
    showToast(was ? Lx.updated : Lx.saved);
  }

  function editManualList(id) {
    const l = data.carnetListas.find(x => x.id === id);
    if (!l) return;
    editingListId = id;
    setManualLevel(l.nivel, false);
    buildGradeSelect(l.grado);
    document.getElementById('cn-f-section').value = l.seccion;
    document.getElementById('cn-f-pass').value = l.clave;
    document.getElementById('cn-f-user').value = l.estudiantes.map(s => s.usuario).join('\n');
    document.getElementById('cn-f-last').value = l.estudiantes.map(s => s.apellidos).join('\n');
    document.getElementById('cn-f-first').value = l.estudiantes.map(s => s.nombres).join('\n');
    document.getElementById('cn-form-status').innerHTML = '';
    const gl = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, l.nivel, l.grado);
    document.getElementById('cn-form-title').textContent = L().editList + ' · ' + gl + (l.seccion ? ' · ' + l.seccion : '');
    document.getElementById('cn-btn-save').textContent = L().update;
    document.getElementById('cn-btn-cancel').style.display = '';
    updateManualCounts();
    document.getElementById('cn-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteManualList(id) {
    const l = data.carnetListas.find(x => x.id === id);
    if (!l) return;
    const gl = window.CarnetsPDF.gradeLabel(ACADEMIA_ACTUAL.idiomaUI, l.nivel, l.grado);
    if (!confirm(L().confirmDel(gl, l.seccion))) return;
    data.carnetListas = data.carnetListas.filter(x => x.id !== id);
    if (editingListId === id) resetManualForm();
    saveData();
    renderManualResults();
    showToast(L().deleted);
  }

  function renderManualResults() {
    renderResultsInto('cn-results', data.carnetListas, {
      editable: true, showCurso: false,
      totalElId: 'cn-total', zipBtnId: 'cn-btn-zip', delAllBtnId: 'cn-btn-delall'
    });
  }

  /* ═════════ Ciclo de vida ═════════ */
  function init() {
    bindOptions();
    syncOptionsFromData();

    document.querySelectorAll('#cn-level-seg .cn-seg-btn').forEach(b => {
      b.addEventListener('click', () => setManualLevel(b.dataset.level, true));
    });

    CN_COLS.forEach((c, i) => {
      const el = document.getElementById('cn-f-' + c);
      el.addEventListener('input', updateManualCounts);
      el.addEventListener('paste', e => smartPasteManual(e, i));
    });

    document.getElementById('cn-btn-save').addEventListener('click', saveManualList);
    document.getElementById('cn-btn-cancel').addEventListener('click', resetManualForm);
    document.getElementById('cn-btn-example').addEventListener('click', loadExampleManual);
    document.getElementById('cn-btn-clear').addEventListener('click', resetManualForm);
    document.getElementById('cn-btn-delall').addEventListener('click', () => {
      if (!data.carnetListas.length) return;
      if (!confirm(L().confirmDelAll)) return;
      data.carnetListas = [];
      saveData();
      resetManualForm();
      renderManualResults();
    });
    document.getElementById('cn-btn-zip').addEventListener('click', e => downloadZip(data.carnetListas, e.currentTarget));

    bindResultsClicks('cn-results');

    resetManualForm();
    renderManualResults();

    document.getElementById('cn-preview-modal').addEventListener('click', e => { if (e.target.id === 'cn-preview-modal') closePreview(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePreview(); });
  }

  function render() {
    syncOptionsFromData();
    renderManualResults();
  }

  window.Carnets = { init, render, closePreview };
})();
