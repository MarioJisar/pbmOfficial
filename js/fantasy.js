// js/fantasy.js
// Lógica del Fantasy PBM

// --- CONFIGURACIÓN ---
const PRESUPUESTO_INICIAL = 30; // millones

// Cargar jugadores desde json/estadisticas.json
let jugadoresPBM = [];
let estadisticasPBM = [];

fetch('json/estadisticas.json')
  .then(response => response.json())
  .then(data => {
    estadisticasPBM = data;
    jugadoresPBM = data.map(j => j.nombre);
    inicializarFantasy();
  })
  .catch(() => {
    estadisticasPBM = [];
    jugadoresPBM = [];
    inicializarFantasy();
  });

// --- PRESUPUESTO ---
function getPresupuestoUsuario(username) {
  let presupuestos = JSON.parse(localStorage.getItem('presupuestosPBM')) || {};
  if (!(username in presupuestos)) {
    presupuestos[username] = PRESUPUESTO_INICIAL;
    localStorage.setItem('presupuestosPBM', JSON.stringify(presupuestos));
  }
  return presupuestos[username];
}

function setPresupuestoUsuario(username, valor) {
  let presupuestos = JSON.parse(localStorage.getItem('presupuestosPBM')) || {};
  presupuestos[username] = valor;
  localStorage.setItem('presupuestosPBM', JSON.stringify(presupuestos));
}

// --- FANTASY PRINCIPAL ---
function inicializarFantasy() {
  const usuario = JSON.parse(localStorage.getItem('usuarioLogueadoPBM'));
  const bienvenida = document.getElementById('bienvenida');
  const loginReq = document.getElementById('login-requerido');
  const fantasySection = document.getElementById('fantasy-section');
  const nombreUsuario = document.getElementById('nombre-usuario');
  const jugadoresLista = document.getElementById('jugadores-lista');
  const mensaje = document.getElementById('fantasy-mensaje');
  const logoutBtn = document.getElementById('logout-btn');

  if (!usuario) {
    loginReq.style.display = 'block';
    return;
  }

  bienvenida.style.display = 'block';
  fantasySection.style.display = 'block';
  nombreUsuario.textContent = usuario.username;

  // Mostrar lista de jugadores para seleccionar (con cartas)
  jugadoresLista.innerHTML = '';
  jugadoresPBM.forEach((jugador, idx) => {
    const stats = estadisticasPBM.find(j => j.nombre === jugador);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    const carta = document.createElement('div');
    carta.className = 'carta-jugador';
    carta.innerHTML = `
      <img src="img/${jugador.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${jugador}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
      <div class="nombre">${jugador}</div>
      <div class="puntos">Puntos: ${puntos}</div>
      <div class="coste">Coste: ${coste}M</div>
      <div class="stats">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
      <div class="acciones"></div>
    `;
    const acciones = carta.querySelector('.acciones');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'jugador';
    input.value = jugador;
    acciones.appendChild(input);
    jugadoresLista.appendChild(carta);
  });

  // Selección de plantilla (5 jugadores)
  document.getElementById('plantilla-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const seleccionados = Array.from(document.querySelectorAll('input[name="jugador"]:checked')).map(i => i.value);
    if (seleccionados.length !== 5) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Debes seleccionar exactamente 5 jugadores.';
      return;
    }
    localStorage.setItem('plantillaPBM_' + usuario.username, JSON.stringify(seleccionados));
    mensaje.style.color = 'green';
    mensaje.textContent = '¡Plantilla guardada! Ahora coloca a tus jugadores en el campo.';
    mostrarPlantillaCartas(usuario);
    mostrarAlineacionSection(seleccionados);
  });

  // Si ya hay plantilla guardada, mostrar alineación y cartas
  const plantillaGuardada = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
  if (plantillaGuardada.length === 5) {
    mostrarPlantillaCartas(usuario);
    mostrarAlineacionSection(plantillaGuardada);
  }

  // Inicializar mercado global y presupuesto
  inicializarMercado(usuario);

  logoutBtn.addEventListener('click', function() {
    localStorage.removeItem('usuarioLogueadoPBM');
    window.location.href = 'login.html';
  });
}

// --- MERCADO, COMPRA/VENTA, NOTIFICACIONES ---
function inicializarMercado(usuario) {
  const mercadoLista = document.getElementById('mercado-lista');
  const movimientosMercado = document.getElementById('movimientos-mercado');
  const notificacionesMercado = document.getElementById('notificaciones-mercado');
  const presupuestoSpan = document.getElementById('presupuesto-usuario');

  // Estado global en localStorage
  let mercado = JSON.parse(localStorage.getItem('mercadoPBM'));
  if (!mercado) {
    mercado = {};
    jugadoresPBM.forEach(j => { mercado[j] = null; });
    localStorage.setItem('mercadoPBM', JSON.stringify(mercado));
  }

  // Mostrar presupuesto
  function renderPresupuesto() {
    presupuestoSpan.textContent = getPresupuestoUsuario(usuario.username);
  }

  // Mostrar jugadores disponibles para comprar/vender como cartas
  function renderMercado() {
    mercado = JSON.parse(localStorage.getItem('mercadoPBM'));
    mercadoLista.innerHTML = '';
    jugadoresPBM.forEach(j => {
      const stats = estadisticasPBM.find(s => s.nombre === j);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      const owner = mercado[j];
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre">${j}</div>
        <div class="puntos">Puntos: ${puntos}</div>
        <div class="coste">Coste: ${coste}M</div>
        <div class="stats">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
        <div class="acciones"></div>
      `;
      const acciones = carta.querySelector('.acciones');
      if (!owner) {
        // Si es el primer jugador gratis
        const plantilla = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
        if (plantilla.length === 0) {
          const btn = document.createElement('button');
          btn.textContent = 'Recibir gratis';
          btn.onclick = () => comprarJugador(j, 0, true);
          acciones.appendChild(btn);
        } else {
          const btn = document.createElement('button');
          btn.textContent = `Comprar (${coste}M)`;
          btn.onclick = () => comprarJugador(j, coste, false);
          acciones.appendChild(btn);
        }
      } else if (owner === usuario.username) {
        const btn = document.createElement('button');
        btn.textContent = 'Vender';
        btn.onclick = () => venderJugador(j);
        acciones.appendChild(btn);
        carta.style.border = '2px solid #1a7f37';
      } else {
        acciones.innerHTML = `<span style="color:gray">Comprado por ${owner}</span>`;
        carta.style.opacity = 0.6;
      }
      mercadoLista.appendChild(carta);
    });
  }

  // Comprar jugador
  function comprarJugador(jugador, coste, gratis) {
    let mercado = JSON.parse(localStorage.getItem('mercadoPBM'));
    if (mercado[jugador]) return;
    let plantilla = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
    if (!gratis && getPresupuestoUsuario(usuario.username) < coste) {
      alert('No tienes suficiente presupuesto.');
      return;
    }
    if (plantilla.includes(jugador)) {
      alert('Ya tienes este jugador en tu plantilla.');
      return;
    }
    if (gratis && plantilla.length > 0) return;
    mercado[jugador] = usuario.username;
    localStorage.setItem('mercadoPBM', JSON.stringify(mercado));
    plantilla.push(jugador);
    localStorage.setItem('plantillaPBM_' + usuario.username, JSON.stringify(plantilla));
    if (!gratis) {
      setPresupuestoUsuario(usuario.username, getPresupuestoUsuario(usuario.username) - coste);
    }
    renderPresupuesto();
    // Guardar movimiento
    let movimientos = JSON.parse(localStorage.getItem('movimientosPBM')) || [];
    const stats = estadisticasPBM.find(s => s.nombre === jugador);
    const mov = { usuario: usuario.username, jugador, coste, fecha: new Date().toLocaleString(), tipo: 'compra' };
    movimientos.unshift(mov);
    localStorage.setItem('movimientosPBM', JSON.stringify(movimientos));
    // Notificación global
    let notificaciones = JSON.parse(localStorage.getItem('notificacionesPBM')) || [];
    notificaciones.unshift({ msg: gratis ? `¡${usuario.username} ha recibido gratis a ${jugador}!` : `¡${usuario.username} ha comprado a ${jugador} por ${coste}M!`, fecha: new Date().toLocaleString() });
    localStorage.setItem('notificacionesPBM', JSON.stringify(notificaciones));
    renderMercado();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(usuario);
  }

  // Vender jugador
  function venderJugador(jugador) {
    let mercado = JSON.parse(localStorage.getItem('mercadoPBM'));
    if (mercado[jugador] !== usuario.username) return;
    let plantilla = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
    plantilla = plantilla.filter(j => j !== jugador);
    localStorage.setItem('plantillaPBM_' + usuario.username, JSON.stringify(plantilla));
    mercado[jugador] = null;
    localStorage.setItem('mercadoPBM', JSON.stringify(mercado));
    // Recuperar presupuesto (mismo coste que compra)
    const stats = estadisticasPBM.find(s => s.nombre === jugador);
    const coste = calcularCoste(calcularPuntos(stats));
    setPresupuestoUsuario(usuario.username, getPresupuestoUsuario(usuario.username) + coste);
    renderPresupuesto();
    // Guardar movimiento
    let movimientos = JSON.parse(localStorage.getItem('movimientosPBM')) || [];
    const mov = { usuario: usuario.username, jugador, coste, fecha: new Date().toLocaleString(), tipo: 'venta' };
    movimientos.unshift(mov);
    localStorage.setItem('movimientosPBM', JSON.stringify(movimientos));
    // Notificación global
    let notificaciones = JSON.parse(localStorage.getItem('notificacionesPBM')) || [];
    notificaciones.unshift({ msg: `¡${usuario.username} ha vendido a ${jugador} y recupera ${coste}M!`, fecha: new Date().toLocaleString() });
    localStorage.setItem('notificacionesPBM', JSON.stringify(notificaciones));
    renderMercado();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(usuario);
  }

  // Mostrar movimientos
  function renderMovimientos() {
    let movimientos = JSON.parse(localStorage.getItem('movimientosPBM')) || [];
    movimientosMercado.innerHTML = '';
    movimientos.slice(0, 10).forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.fecha}: ${m.usuario} ${m.tipo === 'venta' ? 'vendió' : 'compró'} a ${m.jugador} (${m.coste}M)`;
      movimientosMercado.appendChild(li);
    });
  }

  // Mostrar notificaciones globales
  function renderNotificaciones() {
    let notificaciones = JSON.parse(localStorage.getItem('notificacionesPBM')) || [];
    notificacionesMercado.innerHTML = '';
    notificaciones.slice(0, 3).forEach(n => {
      const div = document.createElement('div');
      div.textContent = `${n.fecha}: ${n.msg}`;
      notificacionesMercado.appendChild(div);
    });
  }

  // Inicial
  renderMercado();
  renderMovimientos();
  renderNotificaciones();
  renderPresupuesto();
  mostrarPlantillaCartas(usuario);

  // Actualizar en tiempo real si hay cambios en localStorage (de otros usuarios)
  window.addEventListener('storage', function(e) {
    if (["mercadoPBM","movimientosPBM","notificacionesPBM","presupuestosPBM"].includes(e.key)) {
      renderMercado();
      renderMovimientos();
      renderNotificaciones();
      renderPresupuesto();
      mostrarPlantillaCartas(usuario);
    }
  });
}

// --- PLANTILLA VISUAL ---
function mostrarPlantillaCartas(usuario) {
  const plantilla = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
  const div = document.getElementById('plantilla-cartas');
  if (!div) return;
  div.innerHTML = '';
  let totalCoste = 0;
  plantilla.forEach(j => {
    const stats = estadisticasPBM.find(p => p.nombre === j);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    totalCoste += coste;
    const carta = document.createElement('div');
    carta.className = 'carta-jugador';
    carta.innerHTML = `
      <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
      <div class="nombre">${j}</div>
      <div class="puntos">Puntos: ${puntos}</div>
      <div class="coste">Coste: ${coste}M</div>
      <div class="stats">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
    `;
    div.appendChild(carta);
  });
  if (plantilla.length > 0) {
    const total = document.createElement('div');
    total.style.width = '100%';
    total.style.fontWeight = 'bold';
    total.style.marginTop = '0.5em';
    total.textContent = `Total coste plantilla: ${totalCoste}M`;
    div.appendChild(total);
  }
}

// --- ALINEACIÓN ---
function mostrarAlineacionSection(jugadores) {
  const alineacionSection = document.getElementById('alineacion-section');
  alineacionSection.style.display = 'block';
  // Limpiar selects
  const porteroSel = document.getElementById('pos-portero');
  const campoSels = [
    document.getElementById('pos-campo-1'),
    document.getElementById('pos-campo-2'),
    document.getElementById('pos-campo-3'),
    document.getElementById('pos-campo-4')
  ];

  // Guardar alineación previa si existe
  const usuario = JSON.parse(localStorage.getItem('usuarioLogueadoPBM'));
  const alineacionGuardada = JSON.parse(localStorage.getItem('alineacionPBM_' + usuario.username)) || {};

  // Opciones para selects
  function setOptions(select, jugadores, selected) {
    select.innerHTML = '<option value="">--Selecciona--</option>';
    jugadores.forEach(j => {
      const opt = document.createElement('option');
      opt.value = j;
      opt.textContent = j;
      if (selected === j) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // Obtener valores previos
  setOptions(porteroSel, jugadores, alineacionGuardada.portero);
  campoSels.forEach((sel, idx) => {
    setOptions(sel, jugadores, alineacionGuardada['campo'+(idx+1)]);
  });

  // Evitar duplicados entre posiciones
  function actualizarSelects() {
    const usados = [porteroSel.value, ...campoSels.map(s=>s.value)].filter(Boolean);
    setOptions(porteroSel, jugadores.filter(j => !usados.includes(j) || porteroSel.value === j), porteroSel.value);
    campoSels.forEach((sel, idx) => {
      setOptions(sel, jugadores.filter(j => !usados.includes(j) || sel.value === j), sel.value);
    });
  }
  porteroSel.onchange = actualizarSelects;
  campoSels.forEach(sel => sel.onchange = actualizarSelects);

  // Guardar alineación
  document.getElementById('guardar-alineacion').onclick = function() {
    const portero = porteroSel.value;
    const campo = campoSels.map(s=>s.value);
    const mensaje = document.getElementById('alineacion-mensaje');
    if (!portero || campo.some(c=>!c)) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Debes colocar todos los jugadores en una posición.';
      return;
    }
    // Comprobar duplicados
    const todos = [portero, ...campo];
    if (new Set(todos).size !== 5) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'No puedes repetir jugadores en varias posiciones.';
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuarioLogueadoPBM'));
    localStorage.setItem('alineacionPBM_' + usuario.username, JSON.stringify({portero, campo1: campo[0], campo2: campo[1], campo3: campo[2], campo4: campo[3]}));
    mensaje.style.color = 'green';
    mensaje.textContent = '¡Alineación guardada!';
  };
  // Inicializar selects para evitar duplicados
  actualizarSelects();
}

// --- PUNTOS Y COSTE ---
function calcularPuntos(stats) {
  if (!stats) return 0;
  return stats.goles * 4 + stats.asistencias * 3 + stats.mvps * 2;
}

function calcularCoste(puntos) {
  return Math.max(1, Math.round(puntos / 3));
}