// js/fantasy.js
// Lógica del Fantasy PBM


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


  // Mostrar lista de jugadores para seleccionar (con estadísticas y coste)
  jugadoresLista.innerHTML = '';
  jugadoresPBM.forEach((jugador, idx) => {
    const stats = estadisticasPBM.find(j => j.nombre === jugador);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" name="jugador" value="${jugador}"> <b>${jugador}</b> | Puntos: ${puntos} | Coste: ${coste}M | Goles: ${stats.goles}, Asist: ${stats.asistencias}, MVPs: ${stats.mvps}`;
    jugadoresLista.appendChild(label);
    jugadoresLista.appendChild(document.createElement('br'));
  });

  // Mostrar plantilla guardada si existe
  mostrarPlantillaGuardada(usuario);

  document.getElementById('plantilla-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const seleccionados = Array.from(document.querySelectorAll('input[name="jugador"]:checked')).map(i => i.value);
    if (seleccionados.length < 5) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Debes seleccionar al menos 5 jugadores.';
      return;
    }
    localStorage.setItem('plantillaPBM_' + usuario.username, JSON.stringify(seleccionados));
    mensaje.style.color = 'green';
    mensaje.textContent = '¡Plantilla guardada!';
    mostrarPlantillaGuardada(usuario);
  });

  logoutBtn.addEventListener('click', function() {
    localStorage.removeItem('usuarioLogueadoPBM');
    window.location.href = 'login.html';
  });
}



function mostrarPlantillaGuardada(usuario) {
  const plantilla = JSON.parse(localStorage.getItem('plantillaPBM_' + usuario.username)) || [];
  const ul = document.getElementById('plantilla-guardada');
  ul.innerHTML = '';
  let totalCoste = 0;
  plantilla.forEach(j => {
    const stats = estadisticasPBM.find(p => p.nombre === j);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    totalCoste += coste;
    const li = document.createElement('li');
    li.innerHTML = `<b>${j}</b> | Puntos: ${puntos} | Coste: ${coste}M | Goles: ${stats.goles}, Asist: ${stats.asistencias}, MVPs: ${stats.mvps}`;
    ul.appendChild(li);
  });
  if (plantilla.length > 0) {
    const liTotal = document.createElement('li');
    liTotal.innerHTML = `<b>Total coste plantilla:</b> ${totalCoste}M`;
    ul.appendChild(liTotal);
  }
}

// Fórmula de ejemplo para puntos y coste
function calcularPuntos(stats) {
  if (!stats) return 0;
  // Puedes ajustar la fórmula según tu criterio
  return stats.goles * 4 + stats.asistencias * 3 + stats.mvps * 2;
}

function calcularCoste(puntos) {
  // Coste en millones, mínimo 1M
  return Math.max(1, Math.round(puntos / 3));
}
