document.addEventListener('DOMContentLoaded', () => {

    // Número máximo de jugadores en la plantilla
    const maxJugadores = 5;

    // Estado del modo de edición
    let modoEdicion = false;
    // Almacenar el primer jugador seleccionado en modo edición
    let primerJugadorSeleccionado = null;

    // Almacenar la información del usuario autenticado
    let currentUserUid = null; // Para guardar el UID del usuario logueado


    // Referencias a elementos del DOM
    const btnEditarPlantilla = document.getElementById('btn-editar-plantilla');
    const plantillaContainer = document.getElementById('plantilla');
    const mercadoContainer = document.getElementById('jugadores-mercado'); // Referencia al contenedor del mercado


    // ** NUEVO: Escuchar el estado de autenticación de Firebase **
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Usuario logueado
            currentUserUid = user.uid;
            console.log("Usuario logueado:", currentUserUid);
            // Cargar los datos del usuario logueado (plantilla, mercado, puntuaciones)
            cargarDatosUsuario(currentUserUid);

             // Opcional: Mostrar elementos de UI específicos para usuarios logueados
             document.getElementById('zona-usuario').style.display = 'block'; // Asegurar que la zona de usuario es visible
             document.getElementById('btn-login').style.display = 'none'; // Ocultar botón de login/registro
             document.getElementById('btn-fantasy').style.display = 'block'; // Mostrar botón de fantasy (si no es la página actual)
             document.getElementById('btn-logout').style.display = 'block'; // Mostrar botón de logout


        } else {
            // Usuario no logueado
            currentUserUid = null;
            console.log("Ningún usuario logueado");
            // Cargar una plantilla anónima o de ejemplo y las puntuaciones (que pueden ser públicas)
            cargarPlantillaAnonima();
            cargarPuntuaciones(); // Las puntuaciones pueden ser públicas

            // Opcional: Ajustar elementos de UI para usuarios no logueados
             document.getElementById('zona-usuario').style.display = 'block'; // Asegurar que la zona de usuario es visible
             document.getElementById('btn-login').style.display = 'block'; // Mostrar botón de login/registro
             document.getElementById('btn-fantasy').style.display = 'none'; // Ocultar botón de fantasy
             document.getElementById('btn-logout').style.display = 'none'; // Ocultar botón de logout
             // Desactivar el botón de editar plantilla o redirigir si intenta usarlo
             if (btnEditarPlantilla) {
                 btnEditarPlantilla.style.display = 'none'; // Ocultar el botón de editar si no hay usuario
             }

        }
    });


    // ** MODIFICADA: Función para cargar datos del usuario logueado **
    // Esta función llamará a las funciones específicas para cargar plantilla, etc.
    function cargarDatosUsuario(uid) {
        // Cargar la plantilla del usuario desde Firestore
        cargarPlantillaFirestore(uid);
        // Cargar el mercado (probablemente no depende del usuario, pero se carga aquí)
        cargarMercadoFirestore();
        // Cargar las puntuaciones (probablemente para todos, pero se inicia aquí)
        cargarPuntuaciones(); // Esta función ya carga desde Firestore

        // Podrías también cargar las actualizaciones relevantes para este usuario
        // cargarActualizacionesFirestore(uid);
    }


    // ** NUEVA: Función para cargar la plantilla desde Firestore **
    function cargarPlantillaFirestore(uid) {
        // Obtener el documento de la plantilla del usuario logueado
        db.collection("plantillas").doc(uid).get()
            .then((doc) => {
                if (doc.exists) {
                    console.log("Plantilla encontrada para el usuario:", uid);
                    const plantillaData = doc.data();
                    // Suponemos que plantillaData.jugadores es un array de objetos { idJugador: ..., posicionFormacion: ... }

                    // ** Importante: Necesitamos obtener los datos completos de los jugadores
                    //    desde la colección 'jugadores_equipo_real' usando los IDs de la plantilla **

                    // Si el array de jugadores está vacío, simplemente cargar celdas vacías
                    if (!plantillaData.jugadores || plantillaData.jugadores.length === 0) {
                         console.log("Plantilla vacía, cargando celdas vacías.");
                         plantillaContainer.innerHTML = ''; // Limpiar el contenedor actual
                         for (let i = 1; i <= maxJugadores; i++) {
                            const celdaVacia = document.createElement('div');
                            celdaVacia.classList.add('celda-vacia');
                            celdaVacia.textContent = 'Espacio Vacío';
                             celdaVacia.dataset.posicionFormacion = i; // Asignar posición
                            plantillaContainer.appendChild(celdaVacia);
                         }
                         // Añadir eventos de click a las celdas vacías
                         addClickEventsToPlantilla();
                         return; // Salir de la función

                    }


                    // Para cada jugador en la plantilla, obtener sus datos completos
                    const promesasJugadores = plantillaData.jugadores.map(itemJugador => {
                        return db.collection("jugadores_equipo_real").doc(itemJugador.idJugador).get()
                                .then(jugadorDoc => {
                                    if (jugadorDoc.exists) {
                                        return { ...jugadorDoc.data(), posicionFormacion: itemJugador.posicionFormacion, firestoreId: jugadorDoc.id };
                                    } else {
                                        console.warn(`Jugador con ID ${itemJugador.idJugador} no encontrado en jugadores_equipo_real.`);
                                        return null; // O manejar el error
                                    }
                                })
                                .catch(error => {
                                    console.error("Error al obtener datos de jugador:", error);
                                    return null;
                                });
                    });

                    // Esperar a que todas las promesas de obtener jugadores se resuelvan
                    Promise.all(promesasJugadores)
                        .then(jugadoresCompletos => {
                             // Filtrar jugadores nulos (por si alguno no se encontró)
                            const jugadoresValidos = jugadoresCompletos.filter(jugador => jugador !== null);

                            // Ordenar los jugadores según su posicionFormacion para la vista 1-2-2
                            jugadoresValidos.sort((a, b) => a.posicionFormacion - b.posicionFormacion);


                            plantillaContainer.innerHTML = ''; // Limpiar el contenedor actual

                            // Crear elementos para los jugadores y las celdas vacías en el orden correcto de la formación
                            const elementosPlantilla = [];
                            let jugadorIndex = 0;

                            for (let i = 1; i <= maxJugadores; i++) {
                                // Buscar si hay un jugador válido para esta posición
                                const jugadorEnPosicion = jugadoresValidos.find(j => j.posicionFormacion === i);

                                if (jugadorEnPosicion) {
                                    // Crear tarjeta de jugador para esta posición
                                    const jugadorElement = crearTarjetaJugador(jugadorEnPosicion);
                                     // Guardar el ID de Firestore en el dataset del elemento para futuras actualizaciones
                                     jugadorElement.dataset.firestoreId = jugadorEnPosicion.firestoreId;
                                     // Guardar la posicionFormacion en el dataset
                                     jugadorElement.dataset.posicionFormacion = jugadorEnPosicion.posicionFormacion;

                                    elementosPlantilla.push(jugadorElement);
                                    jugadorIndex++;
                                } else {
                                    // Crear una celda vacía para esta posición
                                    const celdaVacia = document.createElement('div');
                                    celdaVacia.classList.add('celda-vacia');
                                    celdaVacia.textContent = 'Espacio Vacío';
                                    // Guardar la posicionFormacion en el dataset de la celda vacía también
                                     celdaVacia.dataset.posicionFormacion = i;
                                    elementosPlantilla.push(celdaVacia);
                                }
                            }

                            // Añadir todos los elementos al contenedor de la plantilla en el orden definido
                             elementosPlantilla.forEach(el => plantillaContainer.appendChild(el));


                            // Añadir eventos de click a los elementos de la plantilla
                            addClickEventsToPlantilla();
                        })
                        .catch(error => console.error("Error al procesar jugadores de la plantilla:", error));

                } else {
                    console.log("No existe documento de plantilla para este usuario. Creando uno inicial...");
                    // Si no existe plantilla, crear una inicial con 5 espacios vacíos en la base de datos
                    db.collection("plantillas").doc(uid).set({
                        idUsuario: uid,
                        jugadores: [] // Inicialmente, un array de jugadores vacío
                    })
                    .then(() => {
                        console.log("Documento de plantilla inicial creado en Firestore.");
                        // Cargar la plantilla recién creada (que estará vacía y mostrará celdas vacías)
                        cargarPlantillaFirestore(uid);
                    })
                    .catch(error => console.error("Error al crear documento de plantilla en Firestore:", error));
                }
            })
            .catch((error) => {
                console.error("Error al obtener documento de plantilla desde Firestore:", error);
            });
    }

    // ** NUEVA: Función para cargar una plantilla anónima o de ejemplo (si no hay usuario logueado) **
    function cargarPlantillaAnonima() {
         plantillaContainer.innerHTML = ''; // Limpiar el contenedor actual
         for (let i = 1; i <= maxJugadores; i++) { // Iterar de 1 a maxJugadores para asignar posicionFormacion
            const celdaVacia = document.createElement('div');
            celdaVacia.classList.add('celda-vacia');
            celdaVacia.textContent = 'Espacio Vacío';
             celdaVacia.dataset.posicionFormacion = i; // Asignar posición para consistencia
            plantillaContainer.appendChild(celdaVacia);
        }
         // No añadir eventos de click en modo edición si no hay usuario logueado para interactuar
         // addClickEventsToPlantilla(); // Descomentar si quieres permitir alguna interacción anónima (sin guardar)
         console.log("Plantilla anónima cargada.");

    }


    // ** MODIFICADA: Función para cargar y mostrar las puntuaciones desde Firestore **
    function cargarPuntuaciones() {
        // Obtener todos los documentos de la colección 'usuarios'
        db.collection("usuarios").get()
            .then((querySnapshot) => {
                const puntuaciones = [];
                querySnapshot.forEach((doc) => {
                    // Obtener el nombre de usuario y los puntos
                    const userData = doc.data();
                     // Asegurarse de que existen los campos necesarios
                     if (userData.nombreUsuario && userData.puntosTotales !== undefined) {
                         puntuaciones.push({
                             usuario: userData.nombreUsuario,
                             puntos: userData.puntosTotales
                         });
                     }
                });

                const tablaPuntuacionesBody = document.querySelector('#tabla-puntuaciones tbody');
                tablaPuntuacionesBody.innerHTML = ''; // Limpiar la tabla actual

                // Ordenar puntuaciones de mayor a menor
                puntuaciones.sort((a, b) => b.puntos - a.puntos);

                puntuaciones.forEach((item, index) => {
                    const fila = document.createElement('tr');
                    fila.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${item.usuario}</td>
                        <td>${item.puntos}</td>
                    `;
                    tablaPuntuacionesBody.appendChild(fila);
                });
                 console.log("Puntuaciones cargadas desde Firestore.");
            })
            .catch(error => console.error('Error al cargar las puntuaciones desde Firestore:', error));
    }

     // ** NUEVA: Función para cargar jugadores del mercado desde Firestore **
    function cargarMercadoFirestore() {
        const mercadoContainer = document.getElementById('jugadores-mercado');
        if (!mercadoContainer) {
            console.warn("Contenedor del mercado no encontrado.");
            return; // Salir si el contenedor del mercado no existe
        }

        mercadoContainer.innerHTML = ''; // Limpiar el contenedor actual
         console.log("Cargando jugadores del mercado desde Firestore...");

        // Obtener jugadores que están disponibles en el mercado
        db.collection("jugadores_equipo_real")
          .where("disponibleEnMercado", "==", true) // Filtrar por jugadores disponibles
          .get()
          .then((querySnapshot) => {
            console.log(`Encontrados ${querySnapshot.size} jugadores en el mercado.`);
            querySnapshot.forEach((doc) => {
              const jugadorData = doc.data();
              const jugadorElement = document.createElement('div');
              jugadorElement.classList.add('jugador-fantasy'); // Reutilizar la clase de estilo de tarjeta
              jugadorElement.dataset.id = doc.id; // Usar el ID del documento de Firestore

              jugadorElement.innerHTML = `
                  <img src="${jugadorData.urlImagen || 'img/jugador_generico.jpeg'}" alt="${jugadorData.nombre}">
                  <p>${jugadorData.nombre}</p>
                  <p>Precio: ${jugadorData.precioMercado ? jugadorData.precioMercado.toLocaleString('es-ES') + '€' : 'N/D'}</p> <!-- Mostrar el precio formateado -->
              `;
              mercadoContainer.appendChild(jugadorElement);

              // Opcional: Añadir eventos de arrastrar y soltar para mover del mercado a la plantilla
              // Si decides implementar esa funcionalidad.
              // jugadorElement.setAttribute('draggable', true);
              // addDragDropEventsToMercadoItems(); // Una nueva función para eventos de arrastre del mercado

            });
          })
          .catch((error) => {
            console.error("Error al cargar el mercado desde Firestore:", error);
          });
    }


    // Función auxiliar para crear un elemento de tarjeta de jugador (Se mantiene igual, usa datos de Firestore)
    function crearTarjetaJugador(jugador) {
        const jugadorElement = document.createElement('div');
        jugadorElement.classList.add('jugador-fantasy');
        // No hacemos los jugadores arrastrables por defecto en este modo de edición basado en clics
        // jugadorElement.setAttribute('draggable', true);
        // Usar el ID de Firestore si está disponible, de lo contrario, tu ID JSON (para compatibilidad si es necesario)
        jugadorElement.dataset.id = jugador.firestoreId || jugador.id;


        jugadorElement.innerHTML = `
            <img src="${jugador.urlImagen || jugador.imagen || 'img/jugador_generico.jpeg'}" alt="${jugador.nombre}">
            <p>${jugador.nombre}</p>
            <p>${jugador.posicion || 'Sin Posición'}</p>
        `;
        return jugadorElement;
    }


    // Añadir eventos de click a los elementos dentro de la plantilla (Se mantiene igual, llama al handler)
    function addClickEventsToPlantilla() {
        const plantillaItems = plantillaContainer.querySelectorAll('.jugador-fantasy, .celda-vacia');
        plantillaItems.forEach(item => {
             item.removeEventListener('click', handlePlantillaItemClick); // Asegurarse de no duplicar listeners
             item.addEventListener('click', handlePlantillaItemClick);
        });
    }

     // Handler para el click en elementos de la plantilla (MODIFICADA para actualizar Firestore)
    function handlePlantillaItemClick() {
        // Solo actuar si estamos en modo edición y hay usuario logueado
        if (!modoEdicion || !currentUserUid) {
            console.log("No en modo edición o usuario no logueado.");
            return;
        }

         const clickedItem = this; // El elemento (jugador o celda vacía) que fue clickeado
         const clickedItemPosicion = parseInt(clickedItem.dataset.posicionFormacion); // Obtener la posición clickeada


        if (!primerJugadorSeleccionado) {
            // Si no hay ningún jugador seleccionado, seleccionar este
            primerJugadorSeleccionado = clickedItem;
            clickedItem.classList.add('seleccionado'); // Añadir una clase para resaltarlo (necesitas definir el estilo en CSS)
             console.log("Primer elemento seleccionado en posición:", clickedItemPosicion);

        } else if (primerJugadorSeleccionado === clickedItem) {
            // Si se clickea el mismo elemento, deseleccionarlo
            primerJugadorSeleccionado.classList.remove('seleccionado');
            primerJugadorSeleccionado = null;
             console.log("Primer elemento deseleccionado.");

        } else {
            // Si hay un jugador seleccionado y se clickea otro, intercambiar posiciones
            const segundoJugadorSeleccionado = clickedItem;
             const primerJugadorPosicion = parseInt(primerJugadorSeleccionado.dataset.posicionFormacion);
             const segundoJugadorPosicion = parseInt(segundoJugadorSeleccionado.dataset.posicionFormacion);

             console.log(`Intercambiando elemento en posición ${primerJugadorPosicion} con elemento en posición ${segundoJugadorPosicion}`);


            // ** Lógica de Intercambio en el DOM **
            // Clonar los elementos para facilitar la inserción
             const clonPrimer = primerJugadorSeleccionado.cloneNode(true);
             const clonSegundo = segundoJugadorSeleccionado.cloneNode(true);

             // Reemplazar los elementos originales por sus clones
             plantillaContainer.replaceChild(clonSegundo, primerJugadorSeleccionado);
             plantillaContainer.replaceChild(clonPrimer, segundoJugadorSeleccionado);

            // Actualizar los datasets de posicionFormacion en los clones
             clonPrimer.dataset.posicionFormacion = segundoJugadorPosicion;
             clonSegundo.dataset.posicionFormacion = primerJugadorPosicion;


            // Quitar el resaltado y resetear la selección
            primerJugadorSeleccionado.classList.remove('seleccionado'); // Quitar del original
            // segundoJugadorSeleccionado.classList.remove('seleccionado'); // El segundo nunca se selecciona formalmente en este flujo
            primerJugadorSeleccionado = null; // Resetear la selección después del intercambio

            // ** Lógica de Actualización en Firestore **
            // Reconstruir la estructura de la plantilla que se guardará en Firestore
            const nuevaPlantillaFirestore = [];
            plantillaContainer.querySelectorAll('.jugador-fantasy').forEach(itemElement => {
                 // Solo incluimos los jugadores en la estructura para Firestore
                 if (itemElement.classList.contains('jugador-fantasy')) {
                     nuevaPlantillaFirestore.push({
                         // Usamos el ID de Firestore para referenciar al jugador
                         idJugador: itemElement.dataset.id, // Ahora usa dataset.id que es el firestoreId
                         // Guardamos la posición en la formación según el dataset actualizado
                         posicionFormacion: parseInt(itemElement.dataset.posicionFormacion)
                     });
                 }
                // No incluimos las celdas vacías en la estructura de la base de datos
            });

             // No necesitamos ordenar si la posicionFormacion en el dataset ya refleja el orden

            // Actualizar el documento de plantilla del usuario en Firestore
            db.collection("plantillas").doc(currentUserUid).update({
                jugadores: nuevaPlantillaFirestore
            })
            .then(() => {
                console.log("Plantilla actualizada en Firestore con intercambio.");
                 // Opcional: Mostrar un mensaje de éxito al usuario
            })
            .catch((error) => {
                console.error("Error al actualizar plantilla en Firestore:", error);
                 // Opcional: Revertir el cambio visual en el frontend si falla la actualización
                 // Esto sería más complejo: obtener los datos de plantilla de Firestore nuevamente y recargar la vista
                 alert("Error al guardar los cambios. Inténtalo de nuevo.");
                 cargarPlantillaFirestore(currentUserUid); // Intentar recargar la plantilla desde el último estado guardado
            });


             // Volver a añadir los eventos de click a los nuevos elementos clonados
             addClickEventsToPlantilla();
        }
    }


    // Handler para el botón de edición (Se mantiene igual, gestiona el modo visual)
    btnEditarPlantilla.addEventListener('click', () => {
        // Solo permitir entrar en modo edición si hay un usuario logueado
        if (!currentUserUid) {
             console.log("Se requiere usuario logueado para editar la plantilla.");
             alert("Debes iniciar sesión para editar tu plantilla.");
             return; // Salir si no hay usuario logueado
        }

        modoEdicion = !modoEdicion; // Alternar el estado del modo de edición

        if (modoEdicion) {
            plantillaContainer.classList.add('modo-edicion'); // Añadir clase para estilos de edición
            btnEditarPlantilla.textContent = 'Salir del Modo Edición';
             console.log("Modo Edición Activado");
            // Asegurarse de que los elementos no sean arrastrables en modo edición si tenías esa funcionalidad
            plantillaContainer.querySelectorAll('.jugador-fantasy').forEach(jugador => {
                jugador.removeAttribute('draggable');
            });


        } else {
            plantillaContainer.classList.remove('modo-edicion'); // Quitar clase de estilos
            btnEditarPlantilla.textContent = 'Editar Plantilla';
             console.log("Modo Edición Desactivado");
            // Si hay un jugador seleccionado al salir del modo edición, deseleccionarlo
            if (primerJugadorSeleccionado) {
                primerJugadorSeleccionado.classList.remove('seleccionado');
                primerJugadorSeleccionado = null;
            }
             // Reactivar arrastrar y soltar si se desea fuera del modo edición
             // Aunque en este enfoque con clicks no lo estamos usando en la plantilla
              plantillaContainer.querySelectorAll('.jugador-fantasy').forEach(jugador => {
                jugador.setAttribute('draggable', true); // Opcional: hacer arrastrables de nuevo si se implementa arrastre fuera del modo edición
            });

             // Opcional: Aquí podrías enviar un mensaje al backend si fuera necesario después de salir de edición
             // y no guardaste en cada intercambio. Pero como ahora guardamos en cada intercambio, quizás no es necesario.
        }
    });


    // Estilo visual para el elemento seleccionado en modo edición (Recuerda añadirlo a tu CSS)
    /*
    .jugador-fantasy.seleccionado,
    .celda-vacia.seleccionado {
        border: 2px solid var(--amarillo); // Borde amarillo para indicar selección
        box-shadow: 0 0 8px var(--amarillo); // Sombra amarilla
    }
    */

    // Código de Arrastrar y Soltar (comentado o eliminado si solo usas clicks en la plantilla)
    // Si quieres mantener la funcionalidad de arrastrar jugadores entre la plantilla y el mercado,
    // necesitarías adaptar este código para que solo funcione fuera del modo de edición
    // y manejar el intercambio entre plantilla y mercado.
    /*
    function addDragDropEvents() { ... }
    function handleDragStart(e) { ... }
    function handleDragEnd() { ... }
    function handleDragOver(e) { ... }
    function handleDragEnter(e) { ... }
    function handleDragLeave() { ... }
    function handleDrop(e) { ... }
    */


     // Estilo visual para arrastrar sobre un objetivo (Se mantiene comentado si no hay arrastre)
     /*
    const style = document.createElement('style');
    style.innerHTML = `
        .dragover-target {
            background-color: #e0ecff !important;
            border-color: #a6c1ee !important;
            box-shadow: 0 0 10px rgba(166, 193, 238, 0.5);
        }
        .dragging {
             opacity: 0.5;
        }
    `;
    document.head.appendChild(style);
    */


    // La carga inicial ahora espera el estado de autenticación.
    // Las funciones de carga se llaman dentro del onAuthStateChanged.


    // Puedes añadir lógica para cargar mercado y actualizaciones aquí también.
    // La carga del mercado la iniciamos dentro de cargarDatosUsuario.

});
