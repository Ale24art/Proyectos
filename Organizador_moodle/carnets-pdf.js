/* ═══════════════════════════════════════════════════════════════
   carnets-pdf.js · Motor de generación de PDF de carnets (jsPDF)
   Adaptado de stickers/js/stickers.js. Encapsulado en IIFE: solo
   expone window.CarnetsPDF para evitar colisiones con script.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const CN_ACADEMIAS = {
    tecno: {
      id: 'tecno',
      nombre: 'TecnoCleveland',
      colors: { primary: '#EA5A1E', secondary: '#84BC24', stripe: ['#976FB0', '#3A6BB5', '#EA5A1E', '#84BC24'] },
      labels: { user: 'USUARIO', pass: 'CLAVE', section: 'Sección' }
    },
    cleveland: {
      id: 'cleveland',
      nombre: 'Cleveland English Institute',
      colors: { primary: '#25A5DE', secondary: '#7EBD3E', stripe: ['#25A5DE', '#7EBD3E'] },
      labels: { user: 'USERNAME', pass: 'PASSWORD', section: 'Section' }
    }
  };

  const ORDINALS = {
    en: { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' },
    es: { 1: '1er', 2: '2do', 3: '3er', 4: '4to', 5: '5to', 6: '6to' }
  };

  const LEVELS = { media: { max: 5 }, primaria: { max: 6 } };

  function gradeLabel(lang, nivel, n) {
    const o = ORDINALS[lang][n];
    if (lang === 'en') return `${o} ${nivel === 'media' ? 'Year' : 'Grade'}`;
    return `${o} ${nivel === 'media' ? 'Año' : 'Grado'}`;
  }

  /* Tamaño carta, en mm */
  const PAGE = { w: 215.9, h: 279.4, mx: 10, top: 9, bottom: 12 };
  const LAYOUTS = {
    big:     { cols: 2, rows: 7, gapX: 5, gapY: 4 },
    compact: { cols: 3, rows: 8, gapX: 4, gapY: 3.5 }
  };

  /* ── utilidades de color ── */
  const hex2rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const tint  = (h, t) => hex2rgb(h).map(c => Math.round(c + (255 - c) * t));
  const shade = (h, t) => hex2rgb(h).map(c => Math.round(c * t));
  const fill = (d, c) => d.setFillColor(c[0], c[1], c[2]);
  const draw = (d, c) => d.setDrawColor(c[0], c[1], c[2]);
  const txt  = (d, c) => d.setTextColor(c[0], c[1], c[2]);

  /* jsPDF (fuentes estándar) solo entiende Latin-1: limpiar el resto */
  function clean(s) {
    return String(s == null ? '' : s).split('').map(ch => {
      if (ch.charCodeAt(0) <= 255) return ch;
      const b = ch.normalize('NFD')[0];
      return b && b.charCodeAt(0) <= 255 ? b : '?';
    }).join('');
  }

  const PT = 0.3528; // 1 pt en mm

  function drawSticker(doc, x, y, w, h, s, A) {
    const P = A.colors.primary, S = A.colors.secondary;
    const INK = [22, 32, 43], MUTED = [92, 106, 126], r = 2.6;
    const hh = h * 0.26, nh = h * 0.28, fh = h * 0.13, credH = h - hh - nh - fh;

    /* Cabecera de color con esquinas superiores redondeadas */
    fill(doc, hex2rgb(P));
    doc.roundedRect(x, y, w, hh + r, r, r, 'F');
    fill(doc, [255, 255, 255]);
    doc.rect(x, y + hh, w, r + 0.2, 'F');

    /* Contorno */
    draw(doc, hex2rgb(P)); doc.setLineWidth(0.35);
    doc.roundedRect(x, y, w, h, r, r, 'S');

    /* Grado (izquierda) y sección (derecha) */
    const hs = Math.min(11.5, hh / PT * 0.58);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(hs); txt(doc, [255, 255, 255]);
    doc.text(clean(s.gradeText), x + 3.6, y + hh / 2, { baseline: 'middle' });
    if (s.section) {
      const ss = hs * 0.82;
      doc.setFontSize(ss);
      const label = clean(`${A.labels.section} ${s.section}`);
      const tw = doc.getTextWidth(label) + 4.4, ph = hh * 0.64;
      const px = x + w - 3 - tw, py = y + (hh - ph) / 2;
      fill(doc, hex2rgb(S));
      doc.roundedRect(px, py, tw, ph, ph / 2, ph / 2, 'F');
      txt(doc, [24, 40, 10]);
      doc.text(label, px + tw / 2, y + hh / 2, { align: 'center', baseline: 'middle' });
    }

    /* Nombre: se ajusta automáticamente a 1–3 líneas */
    doc.setFont('helvetica', 'bold'); txt(doc, INK);
    const nameW = w - 7;
    let size = Math.min(12, nh / PT * 0.5), lines, lh;
    for (;;) {
      doc.setFontSize(size);
      lines = doc.splitTextToSize(clean(s.name), nameW);
      lh = size * PT * 1.14;
      if (lines.length * lh <= nh - 0.8 || size <= 6.5) break;
      size -= 0.5;
    }
    let ny = y + hh + nh / 2 - (lines.length - 1) * lh / 2;
    lines.forEach(l => { doc.text(l, x + w / 2, ny, { align: 'center', baseline: 'middle' }); ny += lh; });

    /* Credenciales */
    const cy = y + hh + nh, bx = x + 3, bw = w - 6, bh = credH - 0.6, rowH = bh / 2;
    fill(doc, tint(P, 0.9));
    doc.roundedRect(bx, cy + 0.2, bw, bh, 1.6, 1.6, 'F');
    draw(doc, tint(P, 0.62)); doc.setLineWidth(0.15);
    doc.line(bx + 2, cy + 0.2 + rowH, bx + bw - 2, cy + 0.2 + rowH);

    const ls = Math.min(7.2, rowH / PT * 0.5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(ls);
    const lw = Math.max(doc.getTextWidth(A.labels.user), doc.getTextWidth(A.labels.pass));
    const lx = bx + 2.6, vx = lx + lw + 3.2, vmax = bx + bw - 2.2 - vx;
    [[A.labels.user, s.user], [A.labels.pass, s.pass]].forEach(([lab, val], i) => {
      const my = cy + 0.2 + rowH * i + rowH / 2;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(ls); txt(doc, MUTED);
      doc.text(lab, lx, my, { baseline: 'middle' });
      doc.setFont('courier', 'bold'); txt(doc, INK);
      let vs = Math.min(11.5, rowH / PT * 0.72);
      doc.setFontSize(vs);
      const v = clean(val);
      while (doc.getTextWidth(v) > vmax && vs > 5) { vs -= 0.4; doc.setFontSize(vs); }
      doc.text(v, vx, my, { baseline: 'middle' });
    });

    /* Franja de color + sitio web */
    const fy = y + h - fh, sx = x + r + 1.5, sw = w - 2 * (r + 1.5), n = A.colors.stripe.length;
    A.colors.stripe.forEach((c, i) => {
      fill(doc, hex2rgb(c));
      doc.rect(sx + (sw / n) * i, fy + 0.15, sw / n, 0.75, 'F');
    });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(Math.min(8, fh / PT * 0.62));
    txt(doc, shade(P, 0.68));
    doc.text(clean(s.url), x + w / 2, fy + 0.9 + (fh - 0.9) / 2, { align: 'center', baseline: 'middle' });
  }

  /**
   * Crea un PDF (tamaño carta) con los carnets de un año/grado (o de una sola sección).
   * students: [{name,user,pass,section}]
   * opts: { academiaId, lang, level, grade, layout, url, sectionText }
   */
  function buildPDF(students, opts) {
    const { jsPDF } = window.jspdf;
    const base = CN_ACADEMIAS[opts.academiaId] || CN_ACADEMIAS.tecno;
    const A = Object.assign({}, base, { url: opts.url || 'cursoscleveland.com' });
    const lang = opts.lang || 'es';
    const L = LAYOUTS[opts.layout] || LAYOUTS.big;
    const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
    doc.setProperties({ title: `${A.nombre} · ${gradeLabel(lang, opts.level, opts.grade)}` });

    const usableW = PAGE.w - 2 * PAGE.mx, usableH = PAGE.h - PAGE.top - PAGE.bottom;
    const sw = (usableW - (L.cols - 1) * L.gapX) / L.cols;
    const sh = (usableH - (L.rows - 1) * L.gapY) / L.rows;
    const per = L.cols * L.rows, pages = Math.ceil(students.length / per);
    const gLabel = gradeLabel(lang, opts.level, opts.grade) + (opts.sectionText ? '  ·  ' + opts.sectionText : '');

    students.forEach((st, i) => {
      if (i > 0 && i % per === 0) doc.addPage();
      const k = i % per, col = k % L.cols, row = Math.floor(k / L.cols);
      drawSticker(doc,
        PAGE.mx + col * (sw + L.gapX), PAGE.top + row * (sh + L.gapY), sw, sh,
        { name: st.name, user: st.user, pass: st.pass, section: st.section, gradeText: gradeLabel(lang, opts.level, opts.grade), url: A.url }, A);
    });

    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); txt(doc, [150, 160, 174]);
      doc.text(clean(`${A.nombre}  ·  ${gLabel}  ·  ${p}/${pages}`), PAGE.w / 2, PAGE.h - 6, { align: 'center' });
    }
    return doc;
  }

  window.CarnetsPDF = { buildPDF, gradeLabel, academias: CN_ACADEMIAS, levels: LEVELS, layouts: LAYOUTS };
})();
