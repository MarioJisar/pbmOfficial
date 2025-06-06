/*
async function cargarNoticiasTemporales() {
    try {
      const response = await fetch('noticias.json');
      const noticias = await response.json();
      const ahora = new Date();
      const contenedor = document.getElementById('contenedor-noticias');

      noticias.forEach(noticia => {
        const inicio = new Date(noticia.inicio);
        const fin = new Date(noticia.fin);

        if (ahora >= inicio && ahora <= fin) {
          const article = document.createElement('article');
          const titulo = document.createElement('h3');
          const contenido = document.createElement('p');

          titulo.textContent = noticia.titulo;
          contenido.textContent = noticia.contenido;

          article.appendChild(titulo);
          article.appendChild(contenido);
          contenedor.appendChild(article);
        }
      });
    } catch (error) {
      console.error('Error al cargar las noticias:', error);
    }
  }

  document.addEventListener('DOMContentLoaded', cargarNoticiasTemporales);
*/