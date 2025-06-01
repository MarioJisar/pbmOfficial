// js/clasificacion.js

fetch('json/clasificacion.json')
  .then(response => response.json())
  .then(data => mostrarClasificacion(data));

function mostrarClasificacion(equipos) {
  // Calculamos puntos y ordenamos
  equipos.forEach(equipo => {
    equipo.puntos = equipo.victorias * 3 + equipo.empates;
  });

  equipos.sort((a, b) => b.puntos - a.puntos);

  const tabla = document.querySelector('#clasificacion table');
  tabla.innerHTML = `
    <thead>
      <tr>
        <th>Posición</th>
        <th>Equipo</th>
        <th>PJ</th>
        <th>PG</th>
        <th>PE</th>
        <th>PP</th>
        <th>Puntos</th>
      </tr>
    </thead>
    <tbody>
      ${equipos.map((equipo, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${equipo.equipo}</td>
          <td>${equipo.partidos_jugados}</td>
          <td>${equipo.victorias}</td>
          <td>${equipo.empates}</td>
          <td>${equipo.derrotas}</td>
          <td>${equipo.puntos}</td>
        </tr>`).join('')}
    </tbody>
  `;
}
