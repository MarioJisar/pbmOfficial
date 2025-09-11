// Consulta y muestra la alineación de otro usuario por UID
export async function mostrarAlineacionDeUsuario(uid, contenedorId = 'alineacion-externa') {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (!docSnap.exists()) {
    alert("Usuario no encontrado");
    return;
  }
  const data = docSnap.data();
  const alineacion = data.alineacion;
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  cont.innerHTML = '';
  if (!alineacion) {
    cont.innerHTML = '<p>Este usuario no tiene alineación guardada.</p>';
    return;
  }
  Object.entries(alineacion).forEach(([pos, nombre]) => {
    if (!nombre) return;
    const stats = estadisticasPBM.find(j => j.nombre === nombre);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    const carta = document.createElement('div');
    carta.className = 'carta-jugador';
    carta.innerHTML = `
      <img src="img/${nombre.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${nombre}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
      <div class="nombre">${nombre}</div>
      <div class="puntos">Puntos: <b>${puntos}</b></div>
      <div class="coste">Coste: <b>${coste}M</b></div>
      <div class="stats">Goles: ${stats?.goles ?? 0} | Asist: ${stats?.asistencias ?? 0} | MVPs: ${stats?.mvps ?? 0}</div>
      <div class="pos-label">${pos.charAt(0).toUpperCase() + pos.slice(1)}</div>
    `;
    cont.appendChild(carta);
  });
}
// --- FIREBASE/FIRESTORE INTEGRACIÓN BASE ---
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

// Configuración igual que en fantasy.html
const firebaseConfig = {
  apiKey: "AIzaSyBhILwOFVq14nGlg5MYm7eLDuOKy_IdNfA",
  authDomain: "pbmofficial-a22a1.firebaseapp.com",
  projectId: "pbmofficial-a22a1",
  storageBucket: "pbmofficial-a22a1.firebasestorage.app",
  messagingSenderId: "982178990497",
  appId: "1:982178990497:web:13f9575e1f90f84a6263e0",
  measurementId: "G-95G6CVQ0KE"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- FIRESTORE HELPERS ---
const JORNADA_MAX = 5;
const MERCADO_SIZE = 20;
const MERCADO_REFRESH_MS = 1 * 60 * 1000; // 1 minuto

// Guardar jornada actual
async function guardarJornadaFirestore(jornada) {
  await setDoc(doc(db, "mercado", "global"), { jornada }, { merge: true });
}
async function obtenerJornadaFirestore() {
  const docSnap = await getDoc(doc(db, "mercado", "global"));
  if (docSnap.exists()) return docSnap.data().jornada || 1;
  return 1;
}

// Generar nuevo mercado aleatorio (puede haber repetidos)
function generarMercadoAleatorio() {
  const mercado = {};
  const pool = [...jugadoresPBM];
  for (let i = 0; i < MERCADO_SIZE; i++) {
    const jugador = pool[Math.floor(Math.random() * pool.length)];
    // Permitir repetidos, pero máximo 20 en total
    mercado[`mercado_${i}`] = jugador;
  }
  return mercado;
}
const PRESUPUESTO_INICIAL = 30; // millones

// Plantilla
async function guardarPlantillaFirestore(uid, plantilla) {
  await setDoc(doc(db, "usuarios", uid), { plantilla }, { merge: true });
}
async function obtenerPlantillaFirestore(uid) {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (docSnap.exists()) return docSnap.data().plantilla || [];
  return [];
}

// Mercado
async function guardarMercadoFirestore(mercado) {
  // Sobrescribe el mercado completamente, eliminando cualquier campo residual
  await setDoc(doc(db, "mercado", "global"), { mercado }, { merge: false });
}
async function obtenerMercadoFirestore() {
  const docSnap = await getDoc(doc(db, "mercado", "global"));
  if (docSnap.exists()) return docSnap.data().mercado || {};
  return {};
}

// Presupuesto
async function guardarPresupuestoFirestore(uid, presupuesto) {
  await setDoc(doc(db, "usuarios", uid), { presupuesto }, { merge: true });
}
async function obtenerPresupuestoFirestore(uid) {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (docSnap.exists()) return docSnap.data().presupuesto ?? PRESUPUESTO_INICIAL;
  return PRESUPUESTO_INICIAL;
}

// Notificaciones
async function agregarNotificacionFirestore(msg) {
  const fecha = new Date().toLocaleString();
  await setDoc(doc(db, "notificaciones", "global"), { notificaciones: arrayUnion({ fecha, msg }) }, { merge: true });
}
async function obtenerNotificacionesFirestore() {
  const docSnap = await getDoc(doc(db, "notificaciones", "global"));
  if (docSnap.exists()) return docSnap.data().notificaciones || [];
  return [];
}

// Movimientos
async function agregarMovimientoFirestore(mov) {
  await setDoc(doc(db, "movimientos", "global"), { movimientos: arrayUnion(mov) }, { merge: true });
}
async function obtenerMovimientosFirestore() {
  const docSnap = await getDoc(doc(db, "movimientos", "global"));
  if (docSnap.exists()) return docSnap.data().movimientos || [];
  return [];
}

// --- CARGA DE JUGADORES ---
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

// --- FANTASY PRINCIPAL ---
async function inicializarFantasy() {
    // Guardar plantilla al hacer submit en el formulario
    const plantillaForm = document.getElementById('plantilla-form');
    if (plantillaForm) {
      plantillaForm.onsubmit = async function(e) {
        e.preventDefault();
        // Recoge los jugadores actuales de la plantilla
        // (ya están en plantillaUsuario)
        if (user && user.uid) {
          await guardarPlantillaFirestore(user.uid, plantillaUsuario);
          mensaje.style.color = 'green';
          mensaje.textContent = '¡Plantilla guardada en la nube!';
        }
      };
    }
  onAuthStateChanged(auth, async (user) => {
    const bienvenida = document.getElementById('bienvenida');
    const loginReq = document.getElementById('login-requerido');
    const fantasySection = document.getElementById('fantasy-section');
    const nombreUsuario = document.getElementById('nombre-usuario');
    const jugadoresLista = document.getElementById('jugadores-lista');
    const mensaje = document.getElementById('fantasy-mensaje');
    const logoutBtn = document.getElementById('logout-btn');
    let resetMercadoBtn = document.getElementById('reset-mercado-btn');
    if (!resetMercadoBtn) {
      resetMercadoBtn = document.createElement('button');
      resetMercadoBtn.id = 'reset-mercado-btn';
      resetMercadoBtn.textContent = 'Resetear mercado';
      resetMercadoBtn.style.background = '#1a7f37';
      resetMercadoBtn.style.color = '#fff';
      resetMercadoBtn.style.marginLeft = '1em';
      resetMercadoBtn.style.display = 'none';
      bienvenida.appendChild(resetMercadoBtn);
    }

    if (!user) {
      loginReq.style.display = 'block';
      return;
    }

    bienvenida.style.display = 'block';
    fantasySection.style.display = 'block';
    nombreUsuario.textContent = user.displayName || user.email;

    // Mostrar botón de reset solo para admin (ajusta tu email aquí)
    if (user.email === 'mjimenezsarm@gmail.com' || user.email === 'mjimenezsarm@gmail.com') {
      resetMercadoBtn.style.display = 'inline-block';
      resetMercadoBtn.onclick = async () => {
        if (confirm('¿Seguro que quieres resetear el mercado? Esta acción es irreversible.')) {
          await guardarMercadoFirestore({});
          alert('Mercado reseteado.');
          location.reload();
        }
      };
    } else {
      resetMercadoBtn.style.display = 'none';
    }

    // Leer plantilla, mercado, jornada y presupuesto desde Firestore
    let plantillaUsuario = await obtenerPlantillaFirestore(user.uid);
    let jornada = await obtenerJornadaFirestore();
    let mercado = await obtenerMercadoFirestore();
    let presupuesto = await obtenerPresupuestoFirestore(user.uid);

    // Si es jornada 1 y el mercado está vacío, generarlo automáticamente
    if (jornada === 1 && (!mercado || Object.keys(mercado).length === 0)) {
      const nuevoMercado = generarMercadoAleatorio();
      await guardarMercadoFirestore(nuevoMercado);
      mercado = nuevoMercado;
    }

    // Mostrar jornada y estado de liga
    let jornadaDiv = document.getElementById('jornada-actual');
    if (!jornadaDiv) {
      jornadaDiv = document.createElement('div');
      jornadaDiv.id = 'jornada-actual';
      jornadaDiv.style.fontWeight = 'bold';
      jornadaDiv.style.margin = '1em 0';
      bienvenida.appendChild(jornadaDiv);
    }
    if (jornada > JORNADA_MAX) {
      jornadaDiv.textContent = '¡La liga ha terminado!';
    } else {
      jornadaDiv.textContent = `Jornada ${jornada} de ${JORNADA_MAX}`;
    }

    // Mostrar "Mis jugadores"
    function renderMisJugadores(plantilla) {
      jugadoresLista.innerHTML = '';
      if (plantilla.length === 0) {
        jugadoresLista.innerHTML = '<p>No tienes jugadores en propiedad. Compra en el mercado para poder alinear.</p>';
      } else {
        plantilla.forEach(jugador => {
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
          `;
          jugadoresLista.appendChild(carta);
        });
      }
      // Restricción de plantilla
      if (plantilla.length > 7) {
        mensaje.style.color = 'red';
        mensaje.textContent = '¡Tienes más de 7 jugadores en plantilla! Solo puedes tener 5 en el campo y 2 en el banquillo. Debes vender jugadores.';
      } else {
        mensaje.textContent = '';
      }
    }
    renderMisJugadores(plantillaUsuario);
    mostrarAlineacionSection(plantillaUsuario);

    // Inicializar mercado global y presupuesto
    inicializarMercado(user, plantillaUsuario, mercado, presupuesto);

    logoutBtn.addEventListener('click', function() {
      window.location.href = 'login.html';
    });
  });
}

// --- MERCADO, COMPRA/VENTA, NOTIFICACIONES ---
function inicializarMercado(user, plantillaUsuario, mercado, presupuesto) {
  const mercadoLista = document.getElementById('mercado-lista');
  const movimientosMercado = document.getElementById('movimientos-mercado');
  const notificacionesMercado = document.getElementById('notificaciones-mercado');
  const presupuestoSpan = document.getElementById('presupuesto-usuario');

  // Mostrar presupuesto
  function renderPresupuesto() {
    // Si presupuesto es undefined, mostrar el inicial
    let mostrar = (typeof presupuesto === 'number' && !isNaN(presupuesto)) ? presupuesto : PRESUPUESTO_INICIAL;
    presupuestoSpan.textContent = mostrar + 'M';
  }

  // Actualización en tiempo real del mercado
  let mercadoActual = mercado;
  function renderMercado() {
    mercadoLista.innerHTML = '';
    mercadoLista.style.display = 'grid';
    mercadoLista.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    mercadoLista.style.gap = '1em';
    const devueltos = mercadoActual._devueltos || {};
    for (let i = 0; i < MERCADO_SIZE; i++) {
      const j = mercadoActual[`mercado_${i}`];
      if (!j) continue;
      const stats = estadisticasPBM.find(s => s.nombre === j);
      const puntos = calcularPuntos(stats);
      let coste = calcularCoste(puntos);
      let esDevuelto = devueltos[j];
      if (esDevuelto) {
        coste = Math.max(1, Math.round(coste * 0.8));
      }
      const slotComprado = mercadoActual[`comprado_${i}`];
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.style.display = 'flex';
      carta.style.flexDirection = 'column';
      carta.style.alignItems = 'center';
      carta.style.justifyContent = 'space-between';
      carta.style.margin = '0.5em';
      carta.style.padding = '0.5em';
      carta.style.background = '#fff';
      carta.style.borderRadius = '8px';
      carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      carta.style.minHeight = '260px';
      carta.style.minWidth = '180px';
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre" style="font-weight:bold;">${j}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
        <div class="acciones" style="margin-top:0.5em;"></div>
      `;
      if (esDevuelto) {
        const etiqueta = document.createElement('span');
        etiqueta.textContent = 'Devuelto al mercado (-20%)';
        etiqueta.style.background = '#ffe082';
        etiqueta.style.color = '#b8860b';
        etiqueta.style.fontSize = '0.8em';
        etiqueta.style.padding = '2px 6px';
        etiqueta.style.borderRadius = '6px';
        etiqueta.style.marginBottom = '0.5em';
        carta.insertBefore(etiqueta, carta.firstChild.nextSibling);
      }
      const acciones = carta.querySelector('.acciones');
      if (slotComprado) {
        acciones.innerHTML = `<span style=\"color:gray\">Comprado por ${slotComprado.usuario}</span>`;
        carta.style.opacity = 0.7;
      } else if (!plantillaUsuario.includes(j)) {
        const btn = document.createElement('button');
        btn.textContent = `Comprar (${coste}M)`;
        btn.className = 'btn-comprar';
        btn.style.background = '#1a7f37';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.padding = '0.3em 1em';
        btn.style.cursor = 'pointer';
        // Bloquear compra si plantilla llena
        if (plantillaUsuario.length >= 7) {
          btn.disabled = true;
          btn.style.background = '#ccc';
          btn.textContent = 'Máximo 7 jugadores';
        } else {
          btn.onclick = async () => { await comprarJugador(j, coste, false, i); };
        }
        acciones.appendChild(btn);
      } else {
        acciones.innerHTML = `<span style=\"color:gray\">Ya en tu plantilla</span>`;
        carta.style.opacity = 0.7;
      }
      mercadoLista.appendChild(carta);
    }
  }

  // Listener Firestore para mercado en tiempo real
  onSnapshot(doc(db, "mercado", "global"), (docSnap) => {
    if (docSnap.exists()) {
      mercadoActual = docSnap.data().mercado || {};
      renderMercado();
    }
  });
  // --- Mercado rotativo: cada 3 minutos ---
  let jornada = 1;
  let actualizando = false;
  async function avanzarMercado() {
    if (actualizando) return;
    actualizando = true;
    let j = await obtenerJornadaFirestore();
    if (j > JORNADA_MAX) {
      actualizando = false;
      return;
    }
    // Generar nuevo mercado SIN ningún slot bloqueado
    const nuevoMercado = generarMercadoAleatorio();
    // Asegurarse de que no haya ningún comprado_X en el nuevo mercado
    for (let i = 0; i < MERCADO_SIZE; i++) {
      if (nuevoMercado.hasOwnProperty(`comprado_${i}`)) {
        delete nuevoMercado[`comprado_${i}`];
      }
    }
    await guardarMercadoFirestore(nuevoMercado);
    await guardarJornadaFirestore(j + 1);
    alert('¡Nuevo mercado disponible! Jornada ' + (j + 1));
    actualizando = false;
    location.reload();
  }
  setInterval(async () => {
    let j = await obtenerJornadaFirestore();
    if (j <= JORNADA_MAX) {
      avanzarMercado();
    }
  }, MERCADO_REFRESH_MS);

  // Comprar jugador
  async function comprarJugador(jugador, coste, gratis, slotIdx) {
    if (plantillaUsuario.includes(jugador)) {
      alert('Ya tienes este jugador en tu plantilla.');
      return;
    }
    if (!gratis && presupuesto < coste) {
      alert('No tienes suficiente presupuesto.');
      return;
    }
    if (gratis && plantillaUsuario.length > 0) return;
    // Si es compra de slot de mercado
    if (typeof slotIdx === 'number') {
      // Comprobación en tiempo real en Firestore antes de comprar
      const mercadoDoc = await getDoc(doc(db, "mercado", "global"));
      const mercadoActual = mercadoDoc.exists() ? mercadoDoc.data().mercado || {} : {};
      if (mercadoActual[`comprado_${slotIdx}`]) {
        alert('Este jugador ya ha sido comprado por otro usuario.');
        renderMercado(); // Actualiza la vista
        return;
      }
      mercado[`comprado_${slotIdx}`] = { usuario: user.email };
    }
    plantillaUsuario.push(jugador);
    if (!gratis) presupuesto -= coste;
    await guardarPlantillaFirestore(user.uid, plantillaUsuario);
    await guardarMercadoFirestore(mercado);
    await guardarPresupuestoFirestore(user.uid, presupuesto);
    await agregarMovimientoFirestore({ fecha: new Date().toLocaleString(), usuario: user.email, tipo: 'compra', jugador, coste });
    await agregarNotificacionFirestore(`${user.displayName} compró a ${jugador} (${coste}M)`);
    renderMisJugadores(plantillaUsuario);
    renderMercado();
    renderPresupuesto();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(plantillaUsuario);
  }

  // Vender jugador
  async function venderJugador(jugador) {
    if (!plantillaUsuario.includes(jugador)) return;
    const stats = estadisticasPBM.find(j => j.nombre === jugador);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    plantillaUsuario = plantillaUsuario.filter(j => j !== jugador);
    mercado[jugador] = null;
    presupuesto += coste;
    await guardarPlantillaFirestore(user.uid, plantillaUsuario);
    await guardarMercadoFirestore(mercado);
    await guardarPresupuestoFirestore(user.uid, presupuesto);
    await agregarMovimientoFirestore({ fecha: new Date().toLocaleString(), usuario: user.email, tipo: 'venta', jugador, coste });
    await agregarNotificacionFirestore(`${user.displayName} vendió a ${jugador} (${coste}M)`);
    renderMisJugadores(plantillaUsuario);
    renderMercado();
    renderPresupuesto();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(plantillaUsuario);
  }

  // Mostrar movimientos
  async function renderMovimientos() {
    let movimientos = await obtenerMovimientosFirestore();
    movimientosMercado.innerHTML = '';
    movimientos.slice(-10).reverse().forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.fecha}: ${m.usuario} ${m.tipo === 'venta' ? 'vendió' : 'compró'} a ${m.jugador} (${m.coste}M)`;
      movimientosMercado.appendChild(li);
    });
  }

  // Mostrar notificaciones globales
  async function renderNotificaciones() {
    let notificaciones = await obtenerNotificacionesFirestore();
    notificacionesMercado.innerHTML = '';
    notificaciones.slice(-3).reverse().forEach(n => {
      const div = document.createElement('div');
      div.textContent = `${n.fecha}: ${n.msg}`;
      notificacionesMercado.appendChild(div);
    });
  }

  // Mostrar "Mis jugadores"
  function renderMisJugadores(plantilla) {
    const jugadoresLista = document.getElementById('jugadores-lista');
    jugadoresLista.innerHTML = '';
    jugadoresLista.style.display = 'grid';
    jugadoresLista.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    jugadoresLista.style.gap = '1em';
    if (plantilla.length === 0) {
      jugadoresLista.innerHTML = '<p>No tienes jugadores en propiedad. Compra en el mercado para poder alinear.</p>';
    } else {
      plantilla.forEach(jugador => {
        const stats = estadisticasPBM.find(j => j.nombre === jugador);
        const puntos = calcularPuntos(stats);
        const coste = calcularCoste(puntos);
        const carta = document.createElement('div');
        carta.className = 'carta-jugador';
        carta.style.display = 'flex';
        carta.style.flexDirection = 'column';
        carta.style.alignItems = 'center';
        carta.style.justifyContent = 'space-between';
        carta.style.margin = '0.5em';
        carta.style.padding = '0.5em';
        carta.style.background = '#fff';
        carta.style.borderRadius = '8px';
        carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        carta.style.minHeight = '260px';
        carta.style.minWidth = '180px';
        carta.innerHTML = `
          <img src="img/${jugador.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${jugador}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
          <div class="nombre" style="font-weight:bold;">${jugador}</div>
          <div class="puntos">Puntos: <b>${puntos}</b></div>
          <div class="coste">Coste: <b>${coste}M</b></div>
          <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
        `;
        jugadoresLista.appendChild(carta);
      });
    }
  }

  // Mostrar plantilla visual
  function mostrarPlantillaCartas(plantilla) {
    const div = document.getElementById('plantilla-cartas');
    if (!div) return;
    div.innerHTML = '';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    div.style.gap = '1em';
    let totalCoste = 0;
    plantilla.forEach(j => {
      const stats = estadisticasPBM.find(p => p.nombre === j);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      totalCoste += coste;
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.style.display = 'flex';
      carta.style.flexDirection = 'column';
      carta.style.alignItems = 'center';
      carta.style.justifyContent = 'space-between';
      carta.style.margin = '0.5em';
      carta.style.padding = '0.5em';
      carta.style.background = '#fff';
      carta.style.borderRadius = '8px';
      carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      carta.style.minHeight = '260px';
      carta.style.minWidth = '180px';
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre" style="font-weight:bold;">${j}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
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

  // Inicial
  renderMercado();
  renderMovimientos();
  renderNotificaciones();
  renderPresupuesto();
  mostrarPlantillaCartas(plantillaUsuario);
}

// --- ALINEACIÓN (mantiene localStorage, pero puede migrarse a Firestore si se desea) ---
function mostrarAlineacionSection(jugadores) {
  const alineacionSection = document.getElementById('alineacion-section');
  alineacionSection.style.display = 'block';
    // Botón limpiar plantilla
    let limpiarBtn = document.getElementById('limpiar-alineacion');
    if (!limpiarBtn) {
      limpiarBtn = document.createElement('button');
      limpiarBtn.id = 'limpiar-alineacion';
      limpiarBtn.type = 'button';
      limpiarBtn.textContent = 'Limpiar plantilla';
      limpiarBtn.style.marginLeft = '1em';
      const guardarBtn = document.getElementById('guardar-alineacion');
      guardarBtn.parentNode.insertBefore(limpiarBtn, guardarBtn.nextSibling);
    }
    limpiarBtn.onclick = async function() {
      Object.keys(alineacion).forEach(pos => alineacion[pos] = null);
      if (usuario && usuario.uid) {
        await setDoc(doc(db, "usuarios", usuario.uid), { alineacionDraft: alineacion }, { merge: true });
      }
      renderZonas();
      renderJugadoresDisponibles();
      mensaje.textContent = 'Alineación limpiada. Todos los jugadores están en el banquillo.';
      mensaje.style.color = 'green';
    };
  const zonas = {
    portero: alineacionSection.querySelector('.zona-drop[data-pos="portero"]'),
    defensa1: alineacionSection.querySelector('.zona-drop[data-pos="defensa1"]'),
    defensa2: alineacionSection.querySelector('.zona-drop[data-pos="defensa2"]'),
    atacante1: alineacionSection.querySelector('.zona-drop[data-pos="atacante1"]'),
    atacante2: alineacionSection.querySelector('.zona-drop[data-pos="atacante2"]')
  };
  const disponiblesDiv = document.getElementById('jugadores-disponibles');
  const mensaje = document.getElementById('alineacion-mensaje');

  // Obtener valores previos (de localStorage)
  const usuario = JSON.parse(localStorage.getItem('usuarioLogueadoPBM'));
  const alineacionGuardada = JSON.parse(localStorage.getItem('alineacionPBM_' + (usuario?.username || ''))) || {};
  // Estado de alineación actual
    let alineacion = {
      portero: alineacionGuardada.portero || null,
      defensa1: alineacionGuardada.defensa1 || null,
      defensa2: alineacionGuardada.defensa2 || null,
      atacante1: alineacionGuardada.atacante1 || null,
      atacante2: alineacionGuardada.atacante2 || null
    };

    // Listener en tiempo real para la alineación draft
    if (usuario && usuario.uid) {
      onSnapshot(doc(db, "usuarios", usuario.uid), (docSnap) => {
        const data = docSnap.data();
        if (data && data.alineacionDraft) {
          alineacion = { ...data.alineacionDraft };
          renderZonas();
          renderJugadoresDisponibles();
        }
      });
    }

  // Renderizar cartas disponibles
  function renderJugadoresDisponibles() {
    disponiblesDiv.innerHTML = '';
    jugadores.forEach(j => {
      if (Object.values(alineacion).includes(j)) return; // Ya alineado
      const stats = estadisticasPBM.find(p => p.nombre === j);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.draggable = true;
      carta.dataset.nombre = j;
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre">${j}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
      `;
      carta.addEventListener('dragstart', e => {
        carta.classList.add('dragging');
        e.dataTransfer.setData('text/plain', j);
      });
      carta.addEventListener('dragend', () => {
        carta.classList.remove('dragging');
      });
      disponiblesDiv.appendChild(carta);
    });
  }

  // Renderizar cartas en zonas
  function renderZonas() {
  Object.entries(zonas).forEach(([pos, zona]) => {
    zona.innerHTML = ""; // Limpia la zona antes de añadir la carta
    zona.classList.remove('drag-over');
    const jugador = alineacion[pos];
    if (jugador) {
      const stats = estadisticasPBM.find(p => p.nombre === jugador);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.innerHTML = `
        <img src="img/${jugador.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${jugador}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre">${jugador}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
      `;
      // Botón para quitar
      const btn = document.createElement('button');
      btn.className = 'remove-carta';
      btn.innerHTML = '&times;';
      btn.title = 'Quitar de la alineación';
        btn.onclick = async () => {
          alineacion[pos] = null;
          if (usuario && usuario.uid) {
            await setDoc(doc(db, "usuarios", usuario.uid), { alineacionDraft: alineacion }, { merge: true });
          }
          renderZonas();
          renderJugadoresDisponibles();
        };
      zona.appendChild(btn);
      zona.appendChild(carta);
    }
  });
}

  // Drag & drop listeners
  Object.entries(zonas).forEach(([pos, zona]) => {
    zona.ondragover = e => {
      e.preventDefault();
      zona.classList.add('drag-over');
    };
    zona.ondragleave = () => zona.classList.remove('drag-over');
    zona.ondrop = async e => {
      e.preventDefault();
      zona.classList.remove('drag-over');
      const nombre = e.dataTransfer.getData('text/plain');
      if (!nombre) return;
      // No permitir repetir
      if (Object.values(alineacion).includes(nombre)) return;
      alineacion[pos] = nombre;
      if (usuario && usuario.uid) {
        await setDoc(doc(db, "usuarios", usuario.uid), { alineacionDraft: alineacion }, { merge: true });
      }
      renderZonas();
      renderJugadoresDisponibles();
    };
  });

  // Guardar alineación
  document.getElementById('guardar-alineacion').onclick = async function() {
    const valores = Object.values(alineacion);
    if (valores.some(v => !v)) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Debes colocar todos los jugadores en una posición.';
      return;
    }
    if (new Set(valores).size !== 5) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'No puedes repetir jugadores en varias posiciones.';
      return;
    }
    const usuario = JSON.parse(localStorage.getItem('usuarioLogueadoPBM'));
    localStorage.setItem('alineacionPBM_' + (usuario?.username || ''), JSON.stringify(alineacion));
    // Guardar en Firestore alineación y plantilla
    try {
      if (usuario && usuario.uid) {
        // Obtener plantilla actual del usuario (jugadores en propiedad)
        let plantilla = [];
        if (typeof window.plantillaUsuario !== 'undefined') {
          plantilla = window.plantillaUsuario;
        } else if (typeof jugadores !== 'undefined') {
          plantilla = jugadores;
        }
        await setDoc(doc(db, "usuarios", usuario.uid), { alineacion, plantilla }, { merge: true });
      }
      mensaje.style.color = 'green';
      mensaje.textContent = '¡Alineación y plantilla guardadas!';
    } catch (e) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error guardando en la nube.';
    }
    inicializarFantasy();
  };

  renderZonas();
  renderJugadoresDisponibles();
  mensaje.textContent = '';
}

// --- PUNTOS Y COSTE ---
function calcularPuntos(stats) {
  if (!stats) return 0;
  return stats.goles * 4 + stats.asistencias * 3 + stats.mvps * 2;
}
function calcularCoste(puntos) {
  return Math.max(1, Math.round(puntos / 3));
}