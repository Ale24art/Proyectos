/* ════════════════════════════════════════════════════════════
   mapeo.js · Conversión Respaldo JSON (de la app) ⇄ filas SQL
   ════════════════════════════════════════════════════════════
   Lo usan respaldo_a_sql.js, sql_a_respaldo.js y el test de ida y
   vuelta. No depende de ningún motor de base de datos concreto:
   solo produce/consume arreglos planos de objetos (una fila = un
   objeto), listos para INSERT o ya leídos de un SELECT.
   ════════════════════════════════════════════════════════════ */
'use strict';

function porDefecto(d) {
  return {
    colegios: [], cursos: [], asignaciones: [], participantes: [], carnetListas: [],
    carnetOpciones: {}, trash: { colegios: [], cursos: [], asignaciones: [], participantes: [], estudiantes: [], carnetListas: [] },
    ...d
  };
}

/** Respaldo JSON (payload completo, con _academia) → filas por tabla. */
function datosAFilas(payload) {
  const academiaId = payload._academia || 'tecno';
  const d = porDefecto(payload);
  const fechaAprox = payload._exportadoEn || new Date().toISOString();

  const colegios = [
    ...d.colegios.map((c, i) => ({ id: c.id, academia_id: academiaId, nombre: c.nombre, orden: i, eliminado_en: null })),
    ...d.trash.colegios.map((c, i) => ({ id: c.id, academia_id: academiaId, nombre: c.nombre, orden: i, eliminado_en: fechaAprox }))
  ];

  const cursos_modelo = [
    ...d.cursos.map((c, i) => ({ id: c.id, academia_id: academiaId, nombre: c.nombre, nivel: c.nivel, orden: i, eliminado_en: null })),
    ...d.trash.cursos.map((c, i) => ({ id: c.id, academia_id: academiaId, nombre: c.nombre, nivel: c.nivel, orden: i, eliminado_en: fechaAprox }))
  ];

  const filaAsig = (a, i, eliminado) => ({
    id: a.id, academia_id: academiaId, colegio_id: a.colegioId, curso_id: a.cursoId,
    anio: a.anio, fecha: a.fecha, nombre_completo: a.nombreCompleto, nombre_corto: a.nombreCorto,
    clases: Number(a.clases) || 0, notas: a.notas || '', orden: i, eliminado_en: eliminado
  });
  const asignaciones = [
    ...d.asignaciones.map((a, i) => filaAsig(a, i, null)),
    ...d.trash.asignaciones.map((a, i) => filaAsig(a, i, fechaAprox))
  ];

  const filaParticipante = (p, orden, eliminado_en, lote_baja, tipo_papelera) => ({
    id: p.id, academia_id: academiaId, colegio_id: p.colegioId, curso_id: p.cursoId,
    anio: p.anio, nivel: p.nivel, username: p.username, password: p.password,
    firstname: p.username && p.nombres ? `${p.username} ${p.nombres}` : (p.nombres || p.username || ''),
    lastname: p.apellidos, email: p.email, city: p.city, country: p.country,
    course1: p.course1, group1: p.group1 || '', role1: p.role1 || 'student',
    enrolperiod1: p.enrolperiod1 || '365d', suspended: p.suspended || '0',
    nombres: p.nombres, apellidos: p.apellidos, fecha: p.fecha,
    eliminado_en, lote_baja, tipo_papelera, orden
  });

  const participantes = [
    ...d.participantes.map((p, i) => filaParticipante(p, i, null, null, null)),
  ];
  d.trash.participantes.forEach(lote => {
    (lote.estudiantes || []).forEach((p, i) => {
      participantes.push(filaParticipante(p, i, lote.fechaEliminacion || fechaAprox, lote.id, 'lote'));
    });
  });
  d.trash.estudiantes.forEach((t, i) => {
    participantes.push(filaParticipante(t.participante, 0, t.fechaEliminacion || fechaAprox, t.id, 'individual'));
  });

  const carnet_listas = [];
  const carnet_estudiantes = [];
  const agregarLista = (l, orden, eliminado_en) => {
    carnet_listas.push({ id: l.id, academia_id: academiaId, nivel: l.nivel, grado: Number(l.grado) || 0, seccion: l.seccion || '', clave: l.clave, orden, eliminado_en });
    (l.estudiantes || []).forEach((e, i) => {
      carnet_estudiantes.push({ lista_id: l.id, academia_id: academiaId, usuario: e.usuario, apellidos: e.apellidos, nombres: e.nombres, orden: i });
    });
  };
  d.carnetListas.forEach((l, i) => agregarLista(l, i, null));
  d.trash.carnetListas.forEach((l, i) => agregarLista(l, i, l.fechaEliminacion || fechaAprox));

  const carnet_opciones = [{
    academia_id: academiaId,
    layout: (d.carnetOpciones || {}).layout || 'big',
    url: (d.carnetOpciones || {}).url || '',
    upper: (d.carnetOpciones || {}).upper === false ? 0 : 1
  }];

  return { colegios, cursos_modelo, asignaciones, participantes, carnet_listas, carnet_estudiantes, carnet_opciones };
}

/** Filas por tabla (ya leídas de la BD) → objeto `data` + metadatos, forma de un Respaldo. */
function filasADatos(filas, academiaId) {
  const porOrden = (arr) => [...arr].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const colegiosActivos = porOrden(filas.colegios.filter(c => !c.eliminado_en));
  const colegiosBaja = porOrden(filas.colegios.filter(c => c.eliminado_en));
  const cursosActivos = porOrden(filas.cursos_modelo.filter(c => !c.eliminado_en));
  const cursosBaja = porOrden(filas.cursos_modelo.filter(c => c.eliminado_en));
  const asigActivas = porOrden(filas.asignaciones.filter(a => !a.eliminado_en));
  const asigBaja = porOrden(filas.asignaciones.filter(a => a.eliminado_en));

  const colegio = c => ({ id: c.id, nombre: c.nombre });
  const curso = c => ({ id: c.id, nombre: c.nombre, nivel: c.nivel });
  const asig = a => ({
    id: a.id, colegioId: a.colegio_id, cursoId: a.curso_id, anio: a.anio,
    fecha: a.fecha instanceof Date ? a.fecha.toISOString().slice(0, 10) : a.fecha,
    nombreCompleto: a.nombre_completo, nombreCorto: a.nombre_corto,
    clases: Number(a.clases) || 0, notas: a.notas || ''
  });
  const participante = p => ({
    id: p.id, colegioId: p.colegio_id, cursoId: p.curso_id, anio: p.anio, nivel: p.nivel,
    username: p.username, password: p.password, nombres: p.nombres, apellidos: p.apellidos,
    email: p.email, city: p.city, country: p.country, course1: p.course1, group1: p.group1 || '',
    role1: p.role1, enrolperiod1: p.enrolperiod1, suspended: p.suspended, fecha: p.fecha
  });

  const partActivos = porOrden(filas.participantes.filter(p => !p.eliminado_en)).map(participante);

  const lotesMap = new Map();
  filas.participantes.filter(p => p.eliminado_en && p.tipo_papelera === 'lote').forEach(p => {
    if (!lotesMap.has(p.lote_baja)) lotesMap.set(p.lote_baja, { id: p.lote_baja, colegioId: p.colegio_id, cursoId: p.curso_id, anio: p.anio, grupo: p.group1 || '', fechaEliminacion: p.eliminado_en, estudiantes: [] });
    lotesMap.get(p.lote_baja).estudiantes.push(p);
  });
  const trashParticipantes = [...lotesMap.values()].map(l => ({
    ...l, estudiantes: porOrden(l.estudiantes).map(participante)
  }));

  const trashEstudiantes = porOrden(filas.participantes.filter(p => p.eliminado_en && p.tipo_papelera === 'individual'))
    .map(p => ({ id: p.lote_baja, fechaEliminacion: p.eliminado_en, participante: participante(p) }));

  const estudiantesDeLista = (listaId) => porOrden(filas.carnet_estudiantes.filter(e => e.lista_id === listaId))
    .map(e => ({ usuario: e.usuario, apellidos: e.apellidos, nombres: e.nombres }));

  const carnetLista = l => ({ id: l.id, nivel: l.nivel, grado: Number(l.grado) || 0, seccion: l.seccion || '', clave: l.clave, estudiantes: estudiantesDeLista(l.id) });
  const carnetListasActivas = porOrden(filas.carnet_listas.filter(l => !l.eliminado_en)).map(carnetLista);
  const carnetListasBaja = porOrden(filas.carnet_listas.filter(l => l.eliminado_en))
    .map(l => ({ ...carnetLista(l), fechaEliminacion: l.eliminado_en }));

  const opciones = filas.carnet_opciones.find(o => o.academia_id === academiaId) || {};

  return {
    colegios: colegiosActivos.map(colegio),
    cursos: cursosActivos.map(curso),
    asignaciones: asigActivas.map(asig),
    participantes: partActivos,
    carnetListas: carnetListasActivas,
    carnetOpciones: { layout: opciones.layout || 'big', url: opciones.url || '', upper: !!opciones.upper },
    trash: {
      colegios: colegiosBaja.map(colegio),
      cursos: cursosBaja.map(curso),
      asignaciones: asigBaja.map(asig),
      participantes: trashParticipantes,
      estudiantes: trashEstudiantes,
      carnetListas: carnetListasBaja
    }
  };
}

module.exports = { datosAFilas, filasADatos };
