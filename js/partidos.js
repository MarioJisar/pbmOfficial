// js/partidos.js

document.addEventListener("DOMContentLoaded", () => {
  fetch("json/partidos.json")
    .then(res => res.json())
    .then(partidos => {
      const contenedor = document.getElementById("partidos");
      const ul = document.createElement("ul");

      partidos.forEach(partido => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>${partido.equipoLocal} vs ${partido.equipoVisitante}</strong><br>
          ${partido.fecha} - ${partido.lugar}<br>`;

        const btn = document.createElement("button");
        btn.textContent = "Añadir al calendario";
        btn.addEventListener("click", () => crearICS(partido));
        li.appendChild(btn);

        ul.appendChild(li);
      });

      contenedor.appendChild(ul);
    })
    .catch(err => console.error("Error cargando partidos:", err));
});

function crearICS(partido) {
  const inicio = new Date(partido.fecha);
  const fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000); // duración de 2h

  const contenido = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${partido.equipoLocal} vs ${partido.equipoVisitante}\nDTSTART:${formatoICS(inicio)}\nDTEND:${formatoICS(fin)}\nLOCATION:${partido.lugar}\nDESCRIPTION:Partido programado\nEND:VEVENT\nEND:VCALENDAR`;

  const blob = new Blob([contenido], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${partido.equipoLocal}_vs_${partido.equipoVisitante}.ics`;
  link.click();
}

function formatoICS(fecha) {
  return fecha.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
