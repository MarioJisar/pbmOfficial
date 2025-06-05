document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("table").forEach(function (tabla) {
    // Evita envolver si ya está envuelta
    if (!tabla.parentElement.classList.contains("tabla-scroll")) {
      const wrapper = document.createElement("div");
      wrapper.className = "tabla-scroll";
      tabla.parentNode.insertBefore(wrapper, tabla);
      wrapper.appendChild(tabla);
    }
  });
});
