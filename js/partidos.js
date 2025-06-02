// js/partidos.js

document.addEventListener("DOMContentLoaded", () => {
  fetch("json/partidos.json")
    .then(res => res.json())
    .then(partidos => {
      const listaProximos = document.getElementById("lista-partidos");
      const listaJugados = document.getElementById("partidos-jugados");
      const ahora = new Date();

      const partidosFuturos = [];
      const partidosPasados = [];

      partidos.forEach(partido => {
        const inicio = new Date(partido.fecha);
        const fin = new Date(partido.fin);

        const enDirecto = ahora >= inicio && ahora <= fin;
        const yaJugado = ahora > fin;

        // Construcción visual
        const li = document.createElement("li");
        let html = `
          <strong>${partido.equipoLocal} vs ${partido.equipoVisitante}</strong><br>
          ${inicio.toLocaleString()} - ${partido.lugar}<br>
        `;

        if (enDirecto) {
          html += `<span style="color: red; font-weight: bold;">🔴 EN DIRECTO</span><br>`;
        }

        if (yaJugado && partido.resultado) {
          html += `<span style="font-weight: bold;">Resultado:</span> ${partido.resultado}<br>`;
        }

        li.innerHTML = html;

        if (!yaJugado) {
          const btn = document.createElement("button");
          btn.textContent = "Añadir al calendario";
          btn.addEventListener("click", () => crearICS(partido));
          li.appendChild(btn);
          partidosFuturos.push({ fecha: inicio, elemento: li });
        } else {
          partidosPasados.push({ fecha: inicio, elemento: li });
        }
      });

      // Ordenar
      partidosFuturos.sort((a, b) => a.fecha - b.fecha); // ascendente
      partidosPasados.sort((a, b) => b.fecha - a.fecha); // descendente

      // Pintar
      partidosFuturos.forEach(p => listaProximos.appendChild(p.elemento));
      partidosPasados.forEach(p => listaJugados.appendChild(p.elemento));
    })
    .catch(err => console.error("Error cargando partidos:", err));
});

function crearICS(partido) {
  const inicio = new Date(partido.fecha);
  const fin = new Date(partido.fin);

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
