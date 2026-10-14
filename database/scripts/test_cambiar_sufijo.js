#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════
   test_cambiar_sufijo.js · Prueba de lógica pura del cambio de
   sufijo de colegio (ver cambiar_sufijo_colegio.md)

   Prueba sin navegador ni DOM: detección de sufijos, construcción
   del plan (cursos copiados, participantes activos y de la
   Papelera, carnetListas, choques y avisos de ancho) y la
   aplicación del plan. Replica la lógica pura agregada a
   Organizador_moodle/script.js (sección "CAMBIAR SUFIJO DE
   COLEGIO") con datos ficticios — nunca datos reales.

   Uso: node test_cambiar_sufijo.js
   ════════════════════════════════════════════════════════════ */
'use strict';
const assert = require('assert');
const path = require('path');
const { execSync } = require('child_process');

let passed = 0, failed = 0;
function ok(label, fn) {
  try { fn(); console.log(`  ✓  ${label}`); passed++; }
  catch (e) { console.error(`  ✗  ${label}\n     ${e.message}`); failed++; }
}

// ── Réplica de la lógica pura de script.js ──────────────────────

let _uidSeq = 0;
function uid() { return 'id' + (_uidSeq++) + Math.random().toString(36).slice(2, 6); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function parseUsername(username) {
  const m = /^([a-zA-Z]+)(\d+)$/.exec(String(username || '').trim());
  if (!m) return null;
  return { prefix: m[1], num: parseInt(m[2], 10) };
}

function _escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Simplificado respecto a script.js: en las pruebas cada participante ya trae
// `nivel` explícito (igual que en data.participantes real, fijado al generarse),
// así que no hace falta derivarlo de cursoMap/anio.
function nivelDe(p) { return p.nivel || null; }

function nivelesConDatos(data, colegioId) {
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const niveles = new Set();
  data.asignaciones.forEach(a => { if (a.colegioId === colegioId) { const n = (cursoMap[a.cursoId] || {}).nivel; if (n) niveles.add(n); } });
  data.participantes.forEach(p => { if (p.colegioId === colegioId) { const n = nivelDe(p); if (n) niveles.add(n); } });
  return ['media', 'primaria'].filter(n => niveles.has(n));
}

function detectarSufijosColegio(data, colegioId, niveles) {
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const nivelesSet = new Set(niveles);
  const info = {};
  const registrar = (sufijo, campo) => {
    const key = String(sufijo).toLowerCase();
    if (!info[key]) info[key] = { sufijo: key, participantes: 0, cursos: 0 };
    info[key][campo]++;
  };
  data.asignaciones.forEach(a => {
    if (a.colegioId !== colegioId) return;
    const nivel = (cursoMap[a.cursoId] || {}).nivel;
    if (!nivel || !nivelesSet.has(nivel)) return;
    const corto = a.nombreCorto || '';
    const lastDash = corto.lastIndexOf('-');
    if (lastDash === -1 || lastDash === corto.length - 1) return;
    registrar(corto.slice(lastDash + 1), 'cursos');
  });
  data.participantes.forEach(p => {
    if (p.colegioId !== colegioId) return;
    const nivel = nivelDe(p);
    if (!nivel || !nivelesSet.has(nivel)) return;
    const parsed = parseUsername(p.username);
    if (!parsed) return;
    registrar(parsed.prefix, 'participantes');
  });
  return Object.values(info).sort((a, b) => (b.participantes + b.cursos) - (a.participantes + a.cursos));
}

function validarSufijoNuevo(sufijoNuevo, sufijoViejo) {
  const v = String(sufijoNuevo || '').trim();
  if (!v) return 'Escribe el sufijo nuevo.';
  if (!/^[a-zA-Z0-9]{2,10}$/.test(v)) return 'El sufijo nuevo debe tener solo letras y números, de 2 a 10 caracteres.';
  if (v.toLowerCase() === String(sufijoViejo || '').trim().toLowerCase()) return 'El sufijo nuevo debe ser distinto del actual.';
  return null;
}

function construirPlanCambioSufijo(data, emailDominio, { colegioId, niveles, sufijoViejo, sufijoNuevo }) {
  sufijoViejo = String(sufijoViejo || '').trim();
  sufijoNuevo = String(sufijoNuevo || '').trim();
  const cursoMap = {}; data.cursos.forEach(c => cursoMap[c.id] = c);
  const nivelesSet = new Set(niveles);
  const reUser = new RegExp('^' + _escapeRegExp(sufijoViejo) + '(\\d+)$', 'i');
  const reDash = new RegExp('-' + _escapeRegExp(sufijoViejo) + '$', 'i');

  const cursos = [];
  let cursosNoCoincidentes = 0;
  const procesarAsig = (a, origen) => {
    if (a.colegioId !== colegioId) return;
    const nivel = (cursoMap[a.cursoId] || {}).nivel;
    if (!nivel || !nivelesSet.has(nivel)) return;
    const corto = a.nombreCorto || '';
    if (!reDash.test(corto)) { cursosNoCoincidentes++; return; }
    const completo = a.nombreCompleto || '';
    const completoCoincide = reDash.test(completo);
    cursos.push({
      origen, id: a.id, anio: a.anio,
      nombreCortoAnterior: corto, nombreCortoNuevo: corto.replace(reDash, '-' + sufijoNuevo.toLowerCase()),
      nombreCompletoAnterior: completo,
      nombreCompletoNuevo: completoCoincide ? completo.replace(reDash, '-' + sufijoNuevo.toUpperCase()) : completo,
      completoCoincide
    });
  };
  data.asignaciones.forEach(a => procesarAsig(a, 'activo'));
  data.trash.asignaciones.forEach(a => procesarAsig(a, 'papelera'));

  const participantes = [];
  let participantesNoCoincidentes = 0;
  const procesarParticipante = (p, origen, refId) => {
    if (!p || p.colegioId !== colegioId) return;
    const nivel = nivelDe(p);
    if (!nivel || !nivelesSet.has(nivel)) return;
    const m = reUser.exec(String(p.username || '').trim());
    if (!m) { participantesNoCoincidentes++; return; }
    const digitos = m[1];
    const usernameNuevo = sufijoNuevo.toLowerCase() + digitos;
    const emailGenerado = `${p.username}@${emailDominio}`.toLowerCase();
    const emailCoincide = String(p.email || '').toLowerCase() === emailGenerado;
    const course1Coincide = reDash.test(p.course1 || '');
    participantes.push({
      origen, refId, id: p.id,
      usernameAnterior: p.username, usernameNuevo,
      emailAnterior: p.email, emailCoincide,
      emailNuevo: emailCoincide ? `${usernameNuevo}@${emailDominio}` : p.email,
      course1Anterior: p.course1, course1Coincide,
      course1Nuevo: course1Coincide ? String(p.course1).replace(reDash, '-' + sufijoNuevo.toLowerCase()) : p.course1
    });
  };
  data.participantes.forEach(p => procesarParticipante(p, 'activo', null));
  data.trash.estudiantes.forEach(t => procesarParticipante(t.participante, 'papelera-individual', t.id));
  data.trash.participantes.forEach(t => (t.estudiantes || []).forEach(p => procesarParticipante(p, 'papelera-lista', t.id)));

  const idsEnPlan = new Set(participantes.map(x => x.id));
  const ocupados = [];
  const registrarOcupado = p => {
    if (!p || idsEnPlan.has(p.id)) return;
    ocupados.push({ username: p.username, parsed: parseUsername(p.username) });
  };
  data.participantes.forEach(registrarOcupado);
  data.trash.estudiantes.forEach(t => registrarOcupado(t.participante));
  data.trash.participantes.forEach(t => (t.estudiantes || []).forEach(registrarOcupado));

  const ocupadosExactos = new Set(ocupados.map(o => String(o.username || '').toLowerCase()));
  const choques = [];
  const avisosAncho = [];
  participantes.forEach(row => {
    if (ocupadosExactos.has(row.usernameNuevo.toLowerCase())) { choques.push({ usernameNuevo: row.usernameNuevo }); return; }
    const parsedNuevo = parseUsername(row.usernameNuevo);
    if (!parsedNuevo) return;
    const anchoDistinto = ocupados.find(o => o.parsed
      && o.parsed.prefix.toLowerCase() === parsedNuevo.prefix.toLowerCase()
      && o.parsed.num === parsedNuevo.num
      && String(o.username).toLowerCase() !== row.usernameNuevo.toLowerCase());
    if (anchoDistinto) avisosAncho.push({ usernameNuevo: row.usernameNuevo, usernameExistente: anchoDistinto.username });
  });

  const mapaUsernames = new Map(participantes.map(p => [p.usernameAnterior.toLowerCase(), p.usernameNuevo]));
  const carnetListas = [];
  (data.carnetListas || []).forEach(lista => {
    (lista.estudiantes || []).forEach((est, i) => {
      const nuevo = mapaUsernames.get(String(est.usuario || '').toLowerCase());
      if (nuevo && nuevo.toLowerCase() !== String(est.usuario).toLowerCase()) {
        carnetListas.push({ listaId: lista.id, index: i, usuarioAnterior: est.usuario, usuarioNuevo: nuevo });
      }
    });
  });

  return {
    colegioId, niveles: [...niveles], sufijoViejo, sufijoNuevo,
    cursos, participantes, carnetListas, choques, avisosAncho,
    cursosNoCoincidentes, participantesNoCoincidentes,
    ejemplosUsuarios: participantes.slice(0, 3).map(p => ({ antes: p.usernameAnterior, despues: p.usernameNuevo })),
    ejemplosCursos: cursos.filter(c => c.origen === 'activo').slice(0, 3).map(c => ({ antes: c.nombreCortoAnterior, despues: c.nombreCortoNuevo })),
    bloqueado: choques.length > 0,
    resumen: {
      cursosActivos: cursos.filter(c => c.origen === 'activo').length,
      cursosPapelera: cursos.filter(c => c.origen === 'papelera').length,
      participantesActivos: participantes.filter(p => p.origen === 'activo').length,
      participantesPapelera: participantes.filter(p => p.origen !== 'activo').length,
      carnets: carnetListas.length
    }
  };
}

function aplicarPlanCambioSufijo(data, plan) {
  if (plan.bloqueado) throw new Error('No se puede aplicar un plan con choques de usuario.');

  const asigPorId = {}; data.asignaciones.forEach(a => asigPorId[a.id] = a);
  const trashAsigPorId = {}; data.trash.asignaciones.forEach(a => trashAsigPorId[a.id] = a);
  plan.cursos.forEach(c => {
    const a = c.origen === 'activo' ? asigPorId[c.id] : trashAsigPorId[c.id];
    if (!a) return;
    a.nombreCorto = c.nombreCortoNuevo;
    a.nombreCompleto = c.nombreCompletoNuevo;
  });

  const partPorId = {}; data.participantes.forEach(p => partPorId[p.id] = p);
  const trashEstPorId = {}; data.trash.estudiantes.forEach(t => trashEstPorId[t.id] = t);
  const trashListaPorId = {}; data.trash.participantes.forEach(t => trashListaPorId[t.id] = t);

  plan.participantes.forEach(row => {
    let p = null;
    if (row.origen === 'activo') p = partPorId[row.id];
    else if (row.origen === 'papelera-individual') p = (trashEstPorId[row.refId] || {}).participante;
    else if (row.origen === 'papelera-lista') {
      const lista = trashListaPorId[row.refId];
      p = lista ? (lista.estudiantes || []).find(e => e.id === row.id) : null;
    }
    if (!p) return;
    p.username = row.usernameNuevo;
    if (row.emailCoincide) p.email = row.emailNuevo;
    if (row.course1Coincide) p.course1 = row.course1Nuevo;
  });

  const carnetListaPorId = {}; (data.carnetListas || []).forEach(l => carnetListaPorId[l.id] = l);
  plan.carnetListas.forEach(c => {
    const lista = carnetListaPorId[c.listaId];
    const est = lista && lista.estudiantes[c.index];
    if (est && String(est.usuario || '').toLowerCase() === String(c.usuarioAnterior).toLowerCase()) est.usuario = c.usuarioNuevo;
  });

  return { cursos: plan.cursos.length, participantes: plan.participantes.length, carnets: plan.carnetListas.length };
}

function generarCSVRenombreMoodle(data, plan) {
  const activos = plan.participantes.filter(p => p.origen === 'activo');
  const partPorId = {}; data.participantes.forEach(p => partPorId[p.id] = p);
  const header = 'oldusername,username,password,firstname,lastname,email,city,country,course1,group1,role1,enrolperiod1,suspended';
  const lines = activos.map(row => {
    const p = partPorId[row.id];
    if (!p) return null;
    return [row.usernameAnterior, p.username, p.password, `${p.username} ${p.nombres}`, p.apellidos,
      p.email, p.city, p.country, p.course1, p.group1, p.role1, p.enrolperiod1, p.suspended]
      .map(v => v ?? '').join(',');
  }).filter(Boolean);
  return [header, ...lines].join('\n');
}

// ── Fixtures ─────────────────────────────────────────────────────

const DOMINIO = 'tecno.com';

function freshDataVacia() {
  return { colegios: [], cursos: [], asignaciones: [], participantes: [], carnetListas: [], trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [] } };
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function participante(over) {
  return Object.assign({
    id: uid(), colegioId: 'colA', cursoId: 'curso-media', anio: '1er Año', nivel: 'media',
    username: '', password: '1234', nombres: 'JUAN', apellidos: 'PEREZ',
    email: '', city: 'Acarigua', country: 'Venezuela', course1: '1styear-ah',
    group1: '', role1: 'student', enrolperiod1: '365d', suspended: '0', fecha: todayStr()
  }, over);
}

// Colegio A: replica el caso real — Media ah0001-ah0038 (4 dígitos), Primaria hum001-hum330 (3 dígitos).
function construirColegioA() {
  const data = freshDataVacia();
  data.cursos.push({ id: 'curso-media', nombre: 'Robotica 1', nivel: 'media' });
  data.cursos.push({ id: 'curso-primaria', nombre: 'Knex A1 1er grado', nivel: 'primaria' });
  data.asignaciones.push({ id: 'asigA-media', colegioId: 'colA', cursoId: 'curso-media', anio: '1er Año', nombreCompleto: '1er Año-AH', nombreCorto: '1styear-ah', clases: 10 });
  data.asignaciones.push({ id: 'asigA-primaria', colegioId: 'colA', cursoId: 'curso-primaria', anio: '1er Grado', nombreCompleto: '1er Grado-HUM', nombreCorto: '1stgrade-hum', clases: 8 });

  for (let i = 1; i <= 38; i++) {
    const username = 'ah' + String(i).padStart(4, '0');
    data.participantes.push(participante({
      id: uid(), colegioId: 'colA', cursoId: 'curso-media', anio: '1er Año', nivel: 'media',
      username, email: `${username}@${DOMINIO}`, course1: '1styear-ah'
    }));
  }
  for (let i = 1; i <= 330; i++) {
    const username = 'hum' + String(i).padStart(3, '0');
    const esImportadoCleveland = i === 5; // simula un correo que no viene del patrón generado
    data.participantes.push(participante({
      id: uid(), colegioId: 'colA', cursoId: 'curso-primaria', anio: '1er Grado', nivel: 'primaria',
      username, email: esImportadoCleveland ? 'otro.correo@externo.com' : `${username}@${DOMINIO}`,
      course1: '1stgrade-hum'
    }));
  }
  return data;
}

// Colegio B: sufijo y ancho distintos (xy → zk, 2 dígitos), un solo nivel. No usa
// letras+números pegados en el sufijo (el username real solo admite letras en el
// prefijo, dígitos después — parseUsername(): ^([a-zA-Z]+)(\d+)$), para quedar
// bien formado y seguir demostrando que nada está atado al caso Humboldt.
function construirColegioB() {
  const data = freshDataVacia();
  data.cursos.push({ id: 'curso-b-media', nombre: 'Electronica 1', nivel: 'media' });
  data.asignaciones.push({ id: 'asigB-media', colegioId: 'colB', cursoId: 'curso-b-media', anio: '2do Año', nombreCompleto: '2do Año-XY', nombreCorto: '2ndyear-xy', clases: 6 });
  for (let i = 1; i <= 12; i++) {
    const username = 'xy' + String(i).padStart(2, '0');
    data.participantes.push(participante({
      id: uid(), colegioId: 'colB', cursoId: 'curso-b-media', anio: '2do Año', nivel: 'media',
      username, email: `${username}@${DOMINIO}`, course1: '2ndyear-xy'
    }));
  }
  return data;
}

// ── Pruebas ──────────────────────────────────────────────────────

console.log('── Detección de sufijos ──');

ok('detecta ah y lo distingue de hum en Media de Colegio A', () => {
  const data = construirColegioA();
  const detectados = detectarSufijosColegio(data, 'colA', ['media']);
  assert.strictEqual(detectados.length, 1);
  assert.strictEqual(detectados[0].sufijo, 'ah');
  assert.strictEqual(detectados[0].participantes, 38);
  assert.strictEqual(detectados[0].cursos, 1);
});

ok('detecta hum en Primaria sin mezclarse con ah de Media', () => {
  const data = construirColegioA();
  const detectados = detectarSufijosColegio(data, 'colA', ['primaria']);
  assert.strictEqual(detectados.length, 1);
  assert.strictEqual(detectados[0].sufijo, 'hum');
  assert.strictEqual(detectados[0].participantes, 330);
});

ok('niveles marcados ambos detecta ambos sufijos por separado', () => {
  const data = construirColegioA();
  const detectados = detectarSufijosColegio(data, 'colA', ['media', 'primaria']);
  const map = {}; detectados.forEach(d => map[d.sufijo] = d);
  assert.strictEqual(map.ah.participantes, 38);
  assert.strictEqual(map.hum.participantes, 330);
});

console.log('\n── validarSufijoNuevo ──');

ok('rechaza vacío, caracteres inválidos, muy corto y el mismo sufijo', () => {
  assert.ok(validarSufijoNuevo('', 'ah'));
  assert.ok(validarSufijoNuevo('h', 'ah'));
  assert.ok(validarSufijoNuevo('hu-m', 'ah'));
  assert.ok(validarSufijoNuevo('ah', 'ah'));
  assert.ok(validarSufijoNuevo('AH', 'ah')); // mismo sufijo, distinta mayúscula → inválido
  assert.strictEqual(validarSufijoNuevo('hum', 'ah'), null);
});

console.log('\n── Plan: Colegio A, Media ah → hum (caso real) ──');

ok('ah0007 → hum0007 conserva dígitos y ancho; email y course1 correctos; nombres/apellidos intactos', () => {
  const data = construirColegioA();
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, false);
  assert.strictEqual(plan.resumen.participantesActivos, 38);
  assert.strictEqual(plan.resumen.cursosActivos, 1);
  const fila = plan.participantes.find(p => p.usernameAnterior === 'ah0007');
  assert.strictEqual(fila.usernameNuevo, 'hum0007');
  assert.strictEqual(fila.emailCoincide, true);
  assert.strictEqual(fila.emailNuevo, `hum0007@${DOMINIO}`);
  assert.strictEqual(fila.course1Nuevo, '1stgrade-hum'.replace('grade', 'year')); // '1styear-hum'

  const curso = plan.cursos[0];
  assert.strictEqual(curso.nombreCortoNuevo, '1styear-hum');
  assert.strictEqual(curso.nombreCompletoNuevo, '1er Año-HUM');

  aplicarPlanCambioSufijo(data, plan);
  const p = data.participantes.find(x => x.id === fila.id);
  assert.strictEqual(p.nombres, 'JUAN');
  assert.strictEqual(p.apellidos, 'PEREZ');
  assert.strictEqual(p.username, 'hum0007');
});

ok('Primaria (hum) no se toca al cambiar solo Media (ah → hum)', () => {
  const data = construirColegioA();
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, false);
  aplicarPlanCambioSufijo(data, plan);
  const primariaIntacta = data.participantes.filter(p => p.nivel === 'primaria');
  assert.strictEqual(primariaIntacta.length, 330);
  assert.ok(primariaIntacta.every(p => /^hum\d{3}$/.test(p.username)));
  const asigPrimaria = data.asignaciones.find(a => a.id === 'asigA-primaria');
  assert.strictEqual(asigPrimaria.nombreCorto, '1stgrade-hum'); // sin cambios
});

ok('correo no generado (importado) y los que ya tienen el sufijo nuevo quedan intactos', () => {
  const data = construirColegioA();
  const antes = data.participantes.find(p => p.username === 'hum005').email;
  assert.strictEqual(antes, 'otro.correo@externo.com');
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['primaria'], sufijoViejo: 'xx', sufijoNuevo: 'hum2' });
  // sufijo "xx" no existe en primaria → nada que renombrar (0 participantes), prueba de borde:
  assert.strictEqual(plan.resumen.participantesActivos, 0);

  // Ahora sí: xx no existe, forcemos un cambio real hum -> otro y verifiquemos que el correo importado no se recalcula.
  const plan2 = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['primaria'], sufijoViejo: 'hum', sufijoNuevo: 'xxxx' });
  const fila5 = plan2.participantes.find(p => p.usernameAnterior === 'hum005');
  assert.strictEqual(fila5.emailCoincide, false);
  assert.strictEqual(fila5.emailNuevo, 'otro.correo@externo.com'); // no se tocó

  aplicarPlanCambioSufijo(data, plan2);
  const p5 = data.participantes.find(p => p.id === fila5.id);
  assert.strictEqual(p5.email, 'otro.correo@externo.com');
  assert.strictEqual(p5.username, 'xxxx005');
});

console.log('\n── Plan: Colegio B, un solo nivel, otro sufijo y ancho (xy → zk, 2 dígitos) ──');

ok('xy07 → zk07 conserva 2 dígitos; no depende del caso Humboldt', () => {
  const data = construirColegioB();
  const detectados = detectarSufijosColegio(data, 'colB', ['media']);
  assert.strictEqual(detectados[0].sufijo, 'xy');
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colB', niveles: ['media'], sufijoViejo: 'xy', sufijoNuevo: 'zk' });
  assert.strictEqual(plan.bloqueado, false);
  assert.strictEqual(plan.resumen.participantesActivos, 12);
  const fila = plan.participantes.find(p => p.usernameAnterior === 'xy07');
  assert.strictEqual(fila.usernameNuevo, 'zk07');
  aplicarPlanCambioSufijo(data, plan);
  assert.ok(data.participantes.every(p => /^zk\d{2}$/.test(p.username)));
});

console.log('\n── Choques y avisos de ancho ──');

ok('choque exacto de username (incluso contra OTRO colegio) bloquea y no cambia nada', () => {
  const data = construirColegioA();
  // Colegio C ya tiene "hum0007" ocupado -> choca con lo que generaría renombrar ah0007.
  data.colegios = data.colegios || [];
  data.participantes.push(participante({ id: uid(), colegioId: 'colC', cursoId: 'otro-curso', anio: 'x', nivel: 'media', username: 'hum0007', email: `hum0007@${DOMINIO}` }));

  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, true);
  assert.ok(plan.choques.some(c => c.usernameNuevo === 'hum0007'));

  const snapshot = clone(data);
  assert.throws(() => aplicarPlanCambioSufijo(data, plan));
  assert.deepStrictEqual(data, snapshot); // nada cambió
});

ok('choque contra la Papelera también bloquea', () => {
  const data = construirColegioA();
  data.trash.estudiantes.push({ id: uid(), fechaEliminacion: todayStr(), participante: participante({ id: uid(), colegioId: 'colA', nivel: 'media', username: 'hum0001', email: `hum0001@${DOMINIO}` }) });
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, true);
  assert.ok(plan.choques.some(c => c.usernameNuevo === 'hum0001'));
});

ok('mismo número con distinto ancho (hum001 vs hum0001) solo avisa, no bloquea', () => {
  const data = construirColegioA();
  // hum007 (3 dígitos, Primaria) ya existe; renombrar ah0007 (Media) -> hum0007 (4 dígitos) no choca exacto.
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, false);
  assert.ok(plan.avisosAncho.some(a => a.usernameNuevo === 'hum0007' && a.usernameExistente === 'hum007'));
  aplicarPlanCambioSufijo(data, plan); // se permite aplicar a pesar del aviso
  assert.ok(data.participantes.some(p => p.username === 'hum0007'));
  assert.ok(data.participantes.some(p => p.username === 'hum007'));
});

console.log('\n── Aplicar dos veces / revertir ──');

ok('aplicar el mismo plan dos veces no corrompe nada (la segunda vez no encuentra coincidencias)', () => {
  const data = construirColegioA();
  const plan1 = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  aplicarPlanCambioSufijo(data, plan1);
  const snapshot = clone(data);

  const plan2 = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan2.resumen.participantesActivos, 0); // ya no hay "ah" que renombrar
  aplicarPlanCambioSufijo(data, plan2);
  assert.deepStrictEqual(data, snapshot);
});

ok('revertir (nuevo → viejo) devuelve exactamente los datos originales', () => {
  const data = construirColegioA();
  const original = clone(data);
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  aplicarPlanCambioSufijo(data, plan);
  assert.notDeepStrictEqual(data, original);

  const planReverso = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'hum', sufijoNuevo: 'ah' });
  assert.strictEqual(planReverso.bloqueado, false);
  aplicarPlanCambioSufijo(data, planReverso);
  assert.deepStrictEqual(data, original);
});

console.log('\n── Tecno y Cleveland no se cruzan ──');

ok('dos academias con la misma estructura de datos no comparten choques entre sí', () => {
  const dataTecno = construirColegioA();
  const dataCleveland = construirColegioA(); // misma forma, pero es un `data` totalmente separado
  const plan = construirPlanCambioSufijo(dataTecno, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  assert.strictEqual(plan.bloqueado, false); // los "hum" de dataCleveland no se consultan en absoluto
  aplicarPlanCambioSufijo(dataTecno, plan);
  assert.ok(dataCleveland.participantes.every(p => /^(ah|hum)/i.test(p.username))); // intacto, nunca se tocó
});

console.log('\n── Generación posterior continúa con el prefijo nuevo ──');

ok('tras renombrar, el próximo número generado para Media sigue desde el máximo ya usado con el sufijo nuevo', () => {
  const data = construirColegioA();
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  aplicarPlanCambioSufijo(data, plan);

  // Replica la lógica de generarListaUsuarios(): calcula maxNum para colegioId+nivel+prefix.
  let maxNum = 0;
  data.participantes.filter(p => p.colegioId === 'colA' && p.nivel === 'media').forEach(p => {
    const parsed = parseUsername(p.username);
    if (parsed && parsed.prefix.toLowerCase() === 'hum') maxNum = Math.max(maxNum, parsed.num);
  });
  assert.strictEqual(maxNum, 38);
  const siguienteUsername = 'hum' + String(maxNum + 1).padStart(4, '0');
  assert.strictEqual(siguienteUsername, 'hum0039');
});

console.log('\n── CSV de renombre para Moodle ──');

ok('el CSV de renombre solo tiene las filas activas renombradas, con oldusername al inicio', () => {
  const data = construirColegioA();
  const plan = construirPlanCambioSufijo(data, DOMINIO, { colegioId: 'colA', niveles: ['media'], sufijoViejo: 'ah', sufijoNuevo: 'hum' });
  aplicarPlanCambioSufijo(data, plan);
  const csv = generarCSVRenombreMoodle(data, plan);
  const lineas = csv.split('\n');
  assert.strictEqual(lineas[0].split(',')[0], 'oldusername');
  assert.strictEqual(lineas.length, 1 + 38); // encabezado + 38 participantes de Media
  assert.ok(lineas[1].startsWith('ah0001,hum0001,'));
});

// ── Verificación de sintaxis de los archivos modificados ─────────

console.log('\n── node --check ──');
const base = path.join(__dirname, '..', '..');
['Organizador_moodle/script.js', 'database/scripts/test_cambiar_sufijo.js'].forEach(rel => {
  ok(`node --check ${rel}`, () => { execSync(`node --check "${path.join(base, rel)}"`, { stdio: 'pipe' }); });
});

// ── Resumen ──────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Resultado: ${passed} pasaron, ${failed} fallaron.\n`);
const NO_PROBADO = [
  'NO se pudo probar (requiere navegador / DOM real):',
  '  - El modal "🔁 Cambiar sufijo": checkboxes de nivel, el',
  '    selector de sufijos detectados en vivo, el botón "Vista',
  '    previa" y su render, la deshabilitación de "Aplicar cambio"',
  '    cuando hay choques.',
  '  - El modal de resultado y la descarga real de los archivos',
  '    (.json de respaldo automático y el .csv de renombre).',
  '  - El aviso y cancelación cuando hay cambios sin guardar en el',
  '    Generador de usuarios del mismo colegio.',
  '  - La guarda "no aplicar dos veces seguidas" en memoria',
  '    (`sufUltimoAplicado`), al depender del estado del módulo UI.',
];
if (failed) {
  NO_PROBADO.forEach(l => console.log(l));
  process.exit(1);
} else {
  NO_PROBADO.forEach(l => console.log(l));
}
