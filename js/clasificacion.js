// js/clasificacion.js

document.addEventListener("DOMContentLoaded", () => {
  fetch("json/clasificacion.json")
    .then(res => res.json())
    .then(datos => {
      const contenedor = document.getElementById("tabla-clasificacion");
      const tabla = document.createElement("table");

      const thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Posición</th>
          <th>Equipo</th>
          <th>Puntos</th>
        </tr>`;
      tabla.appendChild(thead);

      const tbody = document.createElement("tbody");
      datos.forEach(fila => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${fila.posicion}</td>
          <td>${fila.equipo}</td>
          <td>${fila.puntos}</td>`;
        tbody.appendChild(tr);
      });

      tabla.appendChild(tbody);
      contenedor.appendChild(tabla);
    })
    .catch(err => console.error("Error cargando la clasificación:", err));
});