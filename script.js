async function cargarNoticias() {
    const res = await fetch('noticias.json');
    const noticias = await res.json();
    const ahora = new Date();

    const contenedor = document.getElementById('noticias');
    contenedor.innerHTML = ''; // limpiar noticias previas

    noticias.forEach(noticia => {
        const inicio = new Date(noticia.inicio);
        const fin = new Date(noticia.fin);

        if (ahora >= inicio && ahora <= fin) {
            const articulo = document.createElement('article');
            articulo.innerHTML = `
          <h3>${noticia.titulo}</h3>
          <p>${noticia.contenido}</p>
        `;
            contenedor.appendChild(articulo);
        }
    });
}

document.addEventListener('DOMContentLoaded', cargarNoticias);
