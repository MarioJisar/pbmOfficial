document.addEventListener("DOMContentLoaded", () => {
  fetch("json/estadisticas.json")
    .then(res => res.json())
    .then(jugadores => {

      // ORDENAR ANTES DE PINTAR
      jugadores.sort((a, b) => {
        // 1. MVPs
        if (b.mvps !== a.mvps) return b.mvps - a.mvps;
        // 2. Goles
        if (b.goles !== a.goles) return b.goles - a.goles;
        // 3. Asistencias
        if (b.asistencias !== a.asistencias) return b.asistencias - a.asistencias;
        // 4. Nombre (orden alfabético ascendente)
        if (a.partidos_asistidos !== b.partidos_asistidos) return b.partidos_asistidos - a.partidos_asistidos;
        return a.nombre.localeCompare(b.nombre);
      });

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
