// js/estadisticas.js

document.addEventListener("DOMContentLoaded", () => {
  fetch("json/estadisticas.json")
    .then(res => res.json())
    .then(jugadores => {
      const contenedor = document.getElementById("contenedor-tabla");
      const tabla = document.createElement("table");
      tabla.id = "tabla-estadisticas";

      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Jugador</th>
          <th>Partidos asistidos</th>
          <th>Goles</th>
          <th>Asistencias</th>
          <th>MVPs</th>
        </tr>`;
      tabla.appendChild(thead);

      const tbody = document.createElement("tbody");
      jugadores.forEach(jugador => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${jugador.nombre}</td>
          <td>${jugador.partidos_asistidos}</td>
          <td>${jugador.goles}</td>
          <td>${jugador.asistencias}</td>
          <td>${jugador.mvps}</td>`;
        tbody.appendChild(tr);
      });

      tabla.appendChild(tbody);
      contenedor.appendChild(tabla);
      
      new Tablesort(tabla);
    })
    .catch(err => console.error("Error cargando estadísticas:", err));
});