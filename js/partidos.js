document.addEventListener("DOMContentLoaded", () => {
  const divProximos = document.getElementById("lista-partidos");
  const divJugados = document.getElementById("partidos-jugados");

  fetch("json/partidos.json")
    .then(res => res.json())
    .then(partidos => {
      const ahora = new Date();

      const jugados = partidos
        .filter(p => new Date(p.fin) < ahora)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) // del más nuevo al más viejo
        .slice(0, 2);

      const proximos = partidos
        .filter(p => new Date(p.fin) > ahora)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
        .slice(0, 2);

      // Jugados
      divJugados.innerHTML = "";
      if (jugados.length === 0) {
        divJugados.innerHTML = `<div class="partido vacio">Sin partidos recientes</div>`;
      } else {
        jugados.forEach(p => divJugados.appendChild(crearPartidoJugado(p)));
        completarLista(divJugados, 2, "Sin partidos recientes");
      }

      // Próximos
      divProximos.innerHTML = "";
      if (proximos.length === 0) {
        divProximos.innerHTML = `<div class="partido vacio">Sin próxima fecha</div><div class="partido vacio">Hasta la próxima temporada...</div>`;
      } else {
        proximos.forEach(p => divProximos.appendChild(crearPartidoProximo(p)));
        completarLista(divProximos, 2, "Hasta la próxima temporada...");
      }

      // Actualización periódica para mostrar si hay partidos en directo
      setInterval(() => actualizarPartidosEnDirecto(proximos, divProximos), 30_000);
    })
    .catch(err => console.error("Error cargando partidos:", err));
});

function crearPartidoProximo(partido) {
  const div = document.createElement("div");
  div.classList.add("partido");

  const fecha = formatearFecha(partido.fecha);
  const directo = estaEnDirecto(partido) ? `<span class="directo"><img src="../img/live-streaming.gif" style="height: 2em; vertical-align: middle;"> EN DIRECTO <img src="../img/package.gif" style="height: 2em; vertical-align: middle;"></span>` : "";

  div.innerHTML = `
    <strong>${partido.equipoLocal} vs ${partido.equipoVisitante}</strong>
    <div class="info">${partido.jornada || ""} - ${partido.competicion || ""}</div>
    <div class="fecha">${fecha} - ${partido.lugar}</div>
    ${directo}
  `;

  const btn = document.createElement("button");
  btn.textContent = "Añadir al calendario";
  btn.addEventListener("click", () => crearICS(partido));
  div.appendChild(btn);

  return div;
}

function crearPartidoJugado(partido) {
  const div = document.createElement("div");
  div.classList.add("partido");

  const fecha = formatearFecha(partido.fecha);

  div.innerHTML = `
    <strong>${partido.equipoLocal} vs ${partido.equipoVisitante}</strong>
    <div class="info">${partido.jornada || ""} - ${partido.competicion || ""}</div>
    <div class="fecha">${fecha} - ${partido.lugar}</div>
    <div class="resultado">Resultado: ${partido.resultado || "No disponible"}</div>
  `;

  return div;
}

function completarLista(contenedor, total, textoExtra) {
  while (contenedor.children.length < total) {
    const div = document.createElement("div");
    div.classList.add("partido", "vacio");

    if (textoExtra.includes("próxima temporada")) {
      div.classList.add("fin-temporada");
    }

    div.innerHTML = `<em>${textoExtra}</em>`;
    contenedor.appendChild(div);
  }
}

function estaEnDirecto(partido, ahora = new Date()) {
  const ini = new Date(partido.fecha);
  const fin = new Date(partido.fin);
  return ahora >= ini && ahora <= fin;
}

function actualizarPartidosEnDirecto(partidos, contenedor) {
  const ahora = new Date();
  [...contenedor.children].forEach((div, i) => {
    const partido = partidos[i];
    if (!partido) return;
    const yaMarcado = div.querySelector(".directo");

    if (estaEnDirecto(partido, ahora)) {
      if (!yaMarcado) {
        const span = document.createElement("span");
        span.textContent = "🔴 EN DIRECTO";
        span.classList.add("directo");
        div.insertBefore(span, div.lastElementChild);
      }
    } else {
      if (yaMarcado) yaMarcado.remove();
    }
  });
}

function formatearFecha(f) {
  return new Date(f).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function crearICS(partido) {
  const inicio = new Date(partido.fecha);
  const fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);

  const contenido = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${partido.equipoLocal} vs ${partido.equipoVisitante}\nDTSTART:${formatoICS(inicio)}\nDTEND:${formatoICS(fin)}\nLOCATION:${partido.lugar}\nDESCRIPTION:${partido.jornada || ""} - ${partido.competicion || ""}\nEND:VEVENT\nEND:VCALENDAR`;

  const blob = new Blob([contenido], { type: "text/calendar" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${partido.equipoLocal}_vs_${partido.equipoVisitante}.ics`;
  link.click();
}

function formatoICS(fecha) {
  return fecha.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}
