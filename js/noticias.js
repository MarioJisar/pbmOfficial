// js/noticias.js

document.addEventListener("DOMContentLoaded", () => {
  fetch("json/noticias.json")
    .then(res => res.json())
    .then(noticias => {
      const contenedor = document.getElementById("contenedor-noticias");
      const ahora = new Date();

      noticias.forEach(noticia => {
        const inicio = new Date(noticia.inicio);
        const fin = new Date(noticia.fin);

        if (ahora >= inicio && ahora <= fin) {
          const article = document.createElement("article");
          const titulo = document.createElement("h3");
          const contenido = document.createElement("p");

          titulo.textContent = noticia.titulo;
          contenido.textContent = noticia.contenido;

          article.appendChild(titulo);
          article.appendChild(contenido);
          contenedor.appendChild(article);
        }
      });
    })
    .catch(err => console.error("Error cargando noticias:", err));
});
