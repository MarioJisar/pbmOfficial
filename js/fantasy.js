import { 
    db, 
    auth, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    initializeFirebase
} from '../firebase/firebase-config.js';
import { onSnapshot } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { calcularPuntos, calcularCoste } from './utils.js';

// Variables globales
let estadisticasPBM = [];

// Constantes
const JORNADA_MAX = 5; // Número de jornadas por temporada
const MERCADO_SIZE = 20; // Número de jugadores en el mercado
const MERCADO_REFRESH_MS = 24 * 60 * 60 * 1000; // 24 horas
const TEMPORADA_ACTUAL = 1; // Número de temporada actual

// Función principal de inicialización
// Función para inicializar la estructura de la base de datos
async function inicializarEstructuraDB() {
    console.log('Verificando estructura de la base de datos...');
    
    try {
        // Verificar que el usuario esté autenticado
        if (!auth.currentUser) {
            console.error('Usuario no autenticado al intentar inicializar la estructura');
            return false;
        }

        // Verificar/crear documento de mercado global
        const mercadoRef = doc(db, 'mercado', 'global');
        let mercadoDoc;
        try {
            mercadoDoc = await getDoc(mercadoRef);
        } catch (error) {
            console.error('Error al acceder al documento del mercado:', error);
            if (error.code === 'permission-denied') {
                alert('Error de permisos: Por favor, asegúrate de estar autenticado y tener los permisos necesarios.');
            }
            throw error;
        }

        if (!mercadoDoc.exists() || !mercadoDoc.data().mercado || Object.keys(mercadoDoc.data().mercado).length === 0) {
            console.log('Creando/actualizando documento de mercado global...');
            const nuevoMercado = generarMercadoAleatorio();
            await setDoc(mercadoRef, {
                mercado: nuevoMercado,
                jugadoresDisponibles: Object.values(nuevoMercado),
                movimientos: [],
                ultimaActualizacion: new Date().toISOString()
            });
            console.log('Mercado global inicializado con', Object.keys(nuevoMercado).length, 'jugadores');
        }

        // Verificar/crear documento de temporada actual
        const temporadaRef = doc(db, 'temporadas', TEMPORADA_ACTUAL.toString());
        const temporadaDoc = await getDoc(temporadaRef);
        if (!temporadaDoc.exists()) {
            console.log('Creando documento de temporada actual...');
            await setDoc(temporadaRef, {
                numero: TEMPORADA_ACTUAL,
                jornadaActual: 1,
                fechaInicio: new Date().toISOString(),
                ultimoRefrescoMercado: new Date().toISOString(),
                estado: 'en_curso'
            });
        }

        console.log('Estructura de la base de datos verificada correctamente');
        return true;
    } catch (error) {
        console.error('Error al inicializar estructura de la base de datos:', error);
        return false;
    }
}

async function inicializarAplicacion() {
    try {
        console.log('Iniciando aplicación...');
        
        // Inicializar Firebase y esperar autenticación
        await initializeFirebase();
        console.log('Firebase inicializado correctamente');

        // Verificar autenticación
        if (!auth.currentUser) {
            console.log('Esperando autenticación...');
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout esperando autenticación'));
                }, 5000);

                const unsubscribe = auth.onAuthStateChanged((user) => {
                    clearTimeout(timeout);
                    unsubscribe();
                    if (user) {
                        console.log('Usuario autenticado:', user.email);
                        resolve();
                    } else {
                        console.log('Usuario no autenticado, redirigiendo a login...');
                        window.location.href = '/login.html';
                        reject(new Error('Usuario no autenticado'));
                    }
                });
            });
        } else {
            console.log('Usuario ya autenticado:', auth.currentUser.email);
        }

        // Esperar a que el estado de autenticación esté listo
        await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                if (!user) {
                    console.log('Usuario no autenticado, redirigiendo a login...');
                    window.location.href = '/login.html';
                }
                resolve();
            });
        });

        // Cargar estadísticas primero
        console.log('Cargando estadísticas desde:', new URL('/json/estadisticas.json', window.location.href).href);
        try {
            const response = await fetch('/json/estadisticas.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            try {
                estadisticasPBM = JSON.parse(text);
                console.log('Estadísticas cargadas correctamente:', estadisticasPBM.length, 'jugadores');
                
                if (!Array.isArray(estadisticasPBM) || estadisticasPBM.length === 0) {
                    throw new Error('No se cargaron jugadores de las estadísticas o el formato es incorrecto');
                }
            } catch (parseError) {
                console.error('Error al parsear las estadísticas:', parseError);
                console.log('Contenido recibido:', text);
                throw parseError;
            }
        } catch (fetchError) {
            console.error('Error al cargar estadísticas:', fetchError);
            throw new Error('No se pudieron cargar las estadísticas. ' + fetchError.message);
        }

        // Inicializar estructura de la base de datos después de cargar estadísticas
        const dbInitialized = await inicializarEstructuraDB();
        if (!dbInitialized) {
            throw new Error('Error al inicializar la estructura de la base de datos');
        }

        // Escuchar cambios de autenticación
        onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    console.log('Usuario autenticado:', user.email);
                    
                    // Verificar si Firestore está disponible
                    if (!db) {
                        console.error('Error: Firestore no está inicializado');
                        throw new Error('Firestore no inicializado');
                    }

                    // Cargar datos del usuario
                    console.log('Iniciando carga de datos...');
                    await cargarDatosUsuario(user.uid);
                    console.log('Datos del usuario cargados');

                    // Cargar datos de temporada
                    console.log('Cargando información de temporada...');
                    await actualizarInfoTemporada();
                    console.log('Información de temporada cargada');

                    // Cargar mercado
                    console.log('Cargando mercado...');
                    await cargarMercado();
                    console.log('Mercado cargado');

                    // Mostrar sección de fantasy
                    document.getElementById('fantasy-section').style.display = 'block';
                    document.getElementById('login-requerido').style.display = 'none';
                    
                    // Configurar actualizaciones en tiempo real
                    console.log('Configurando listeners en tiempo real...');
                    setupRealtimeListeners(user.uid);
                } else {
                    console.log('Usuario no autenticado');
                    document.getElementById('fantasy-section').style.display = 'none';
                    document.getElementById('login-requerido').style.display = 'block';
                }
            } catch (error) {
                console.error('Error en el manejo de autenticación:', error);
                alert('Error al cargar los datos. Por favor, recarga la página.');
            }
        });
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        // Mostrar mensaje de error al usuario
        const mensaje = document.createElement('div');
        mensaje.className = 'error-mensaje';
        mensaje.textContent = 'Error al cargar la aplicación. Por favor, recarga la página.';
        document.body.insertBefore(mensaje, document.body.firstChild);
    }
}

// Llamar a la función de inicialización cuando se carga el documento
document.addEventListener('DOMContentLoaded', inicializarAplicacion);

// --- Funciones principales ---

// Función para cargar los datos del usuario
async function cargarDatosUsuario(uid) {
    try {
        console.log('Cargando datos del usuario:', uid);
        
        if (!db) {
            console.error('Firestore no está inicializado');
            return;
        }

        const userDoc = await getDoc(doc(db, "usuarios", uid));
        if (!userDoc.exists()) {
            console.log('No se encontraron datos del usuario, creando perfil inicial...');
            // Crear perfil inicial si no existe
            await setDoc(doc(db, "usuarios", uid), {
                email: auth.currentUser.email,
                nombre: auth.currentUser.displayName || auth.currentUser.email,
                presupuesto: 30, // Presupuesto inicial
                plantilla: [],
                alineacionDraft: {}
            });
            return;
        }

        const userData = userDoc.data();
        
        // Actualizar presupuesto
        const presupuestoElement = document.getElementById('presupuesto-usuario');
        if (presupuestoElement) {
            presupuestoElement.textContent = userData.presupuesto || 0;
        }

        // Mostrar plantilla
        const jugadoresLista = document.getElementById('jugadores-lista');
        if (jugadoresLista && Array.isArray(userData.plantilla)) {
            jugadoresLista.innerHTML = '';
            userData.plantilla.forEach(nombreJugador => {
                const stats = estadisticasPBM.find(j => j.nombre === nombreJugador);
                if (stats) {
                    const carta = crearCartaJugador(nombreJugador, stats);
                    jugadoresLista.appendChild(carta);
                }
            });
        }

        // Mostrar alineación
        if (userData.alineacionDraft) {
            mostrarAlineacionGuardada(userData.alineacionDraft);
        }

        console.log('Datos del usuario cargados correctamente');
    } catch (error) {
        console.error('Error al cargar datos del usuario:', error);
    }
}

// Función para actualizar la información de la temporada
async function cargarMercado() {
    console.log('Iniciando carga del mercado...');
    
    // Obtener los elementos del DOM
    const mercadoLista = document.getElementById('mercado-lista');
    const mercadoVentasLista = document.getElementById('mercado-ventas-lista');
    const movimientosList = document.getElementById('movimientos-mercado');
    const notificacionesMercado = document.getElementById('notificaciones-mercado');
    
    // Verificar elementos requeridos
    if (!mercadoLista || !mercadoVentasLista || !movimientosList) {
        console.error('No se encontraron los contenedores del mercado');
        return;
    }

    console.log('Contenedores del mercado encontrados');

    // Limpiar contenedores
    mercadoLista.innerHTML = '';
    mercadoVentasLista.innerHTML = '';
    movimientosList.innerHTML = '';
    if (notificacionesMercado) {
        notificacionesMercado.innerHTML = '';
    }
    
    try {
        // Obtener datos del mercado global
        const mercadoRef = doc(db, 'mercado', 'global');
        const mercadoDoc = await getDoc(mercadoRef);

        if (mercadoDoc.exists()) {
            console.log('Documento del mercado encontrado');
            const mercadoData = mercadoDoc.data();
            
            // Procesar jugadores del mercado general
            if (mercadoData.jugadoresDisponibles) {
                console.log('Procesando jugadores disponibles...');
                mercadoData.jugadoresDisponibles.forEach(jugador => {
                    const stats = estadisticasPBM.find(j => j.nombre === jugador);
                    if (stats) {
                        const carta = crearCartaJugador(jugador, stats);
                        const coste = calcularCoste(calcularPuntos(stats));
                        
                        // Agregar botón de compra
                        const botonCompra = document.createElement('button');
                        botonCompra.className = 'boton-compra';
                        botonCompra.textContent = `Comprar por ${coste} EUR`;
                        botonCompra.onclick = () => comprarJugador(jugador, coste);
                        carta.appendChild(botonCompra);
                        
                        mercadoLista.appendChild(carta);
                    }
                });
            } else {
                mercadoLista.innerHTML = '<p class="mensaje-mercado">No hay jugadores disponibles en el mercado</p>';
            }

            // Procesar jugadores en venta
            console.log('Procesando jugadores en venta...');
            const mercado = mercadoData.mercado || {};
            let hayJugadoresEnVenta = false;

            for (const [nombreJugador, infoJugador] of Object.entries(mercado)) {
                if (!infoJugador || !infoJugador.enVenta) continue;
                
                hayJugadoresEnVenta = true;
                const stats = estadisticasPBM.find(j => j.nombre === nombreJugador);
                if (!stats) continue;

                const carta = crearCartaJugador(nombreJugador, stats);
                if (infoJugador.vendedor !== auth.currentUser?.uid) {
                    const botonCompra = document.createElement('button');
                    botonCompra.className = 'boton-venta';
                    botonCompra.textContent = `Comprar por ${infoJugador.precio} EUR`;
                    botonCompra.onclick = () => comprarJugadorVenta(nombreJugador, infoJugador.precio, infoJugador.vendedor);
                    carta.appendChild(botonCompra);
                } else {
                    const mensajePropio = document.createElement('div');
                    mensajePropio.className = 'mensaje-propio';
                    mensajePropio.textContent = 'Este es tu jugador en venta';
                    carta.appendChild(mensajePropio);
                }
                mercadoVentasLista.appendChild(carta);
            }

            if (!hayJugadoresEnVenta) {
                mercadoVentasLista.innerHTML = '<p class="mensaje-no-ventas">No hay jugadores en venta actualmente</p>';
            }

            // Procesar movimientos recientes
            console.log('Procesando movimientos recientes...');
            if (Array.isArray(mercadoData.movimientos) && mercadoData.movimientos.length > 0) {
                const movimientosRecientes = mercadoData.movimientos
                    .slice(-5)
                    .reverse()
                    .map(mov => `<li class="movimiento">${mov}</li>`)
                    .join('');
                movimientosList.innerHTML = movimientosRecientes;
            } else {
                movimientosList.innerHTML = '<li class="sin-movimientos">No hay movimientos recientes</li>';
            }

            // Mostrar próxima actualización del mercado
            if (notificacionesMercado && mercadoData.ultimaActualizacion) {
                const proximaActualizacion = new Date(mercadoData.ultimaActualizacion);
                proximaActualizacion.setHours(proximaActualizacion.getHours() + 24);
                notificacionesMercado.innerHTML = `
                    <p>Próxima actualización del mercado: ${proximaActualizacion.toLocaleString()}</p>
                `;
            }
        } else {
            console.log('No se encontró el documento del mercado, mostrando mensajes por defecto');
            mercadoLista.innerHTML = '<p class="mensaje-mercado">El mercado está cerrado temporalmente</p>';
            mercadoVentasLista.innerHTML = '<p class="mensaje-no-ventas">No hay jugadores en venta actualmente</p>';
            movimientosList.innerHTML = '<li class="sin-movimientos">No hay movimientos recientes</li>';
        }
        
        console.log('Carga del mercado completada');
    } catch (error) {
        console.error('Error al cargar el mercado:', error);
        if (mercadoLista) mercadoLista.innerHTML = '<p class="error-mensaje">Error al cargar el mercado</p>';
        if (mercadoVentasLista) mercadoVentasLista.innerHTML = '<p class="error-mensaje">Error al cargar las ventas</p>';
        if (movimientosList) movimientosList.innerHTML = '<li class="error-mensaje">Error al cargar los movimientos</li>';
    }
}

// Función para comprar jugador del mercado general
async function comprarJugador(nombreJugador, precio) {
    try {
        if (!confirm(`¿Quieres comprar a ${nombreJugador} por ${precio} EUR?`)) return;

        const userRef = doc(db, 'usuarios', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            alert('Error: No se encontraron tus datos');
            return;
        }

        const userData = userDoc.data();
        if ((userData.presupuesto || 0) < precio) {
            alert('No tienes suficiente presupuesto para esta compra');
            return;
        }

        const nuevaPlantilla = [...(userData.plantilla || []), nombreJugador];
        const nuevoPresupuesto = userData.presupuesto - precio;

        await updateDoc(userRef, {
            plantilla: nuevaPlantilla,
            presupuesto: nuevoPresupuesto
        });

        // Actualizar mercado
        const mercadoRef = doc(db, 'mercado', 'global');
        const mercadoDoc = await getDoc(mercadoRef);
        if (mercadoDoc.exists()) {
            const mercadoData = mercadoDoc.data();
            const jugadoresDisponibles = (mercadoData.jugadoresDisponibles || [])
                .filter(j => j !== nombreJugador);
            
            const movimientos = [
                `${auth.currentUser.displayName || auth.currentUser.email} ha comprado a ${nombreJugador} por ${precio} EUR`,
                ...(mercadoData.movimientos || []).slice(0, 19)
            ];

            await updateDoc(mercadoRef, {
                jugadoresDisponibles,
                movimientos,
                ultimaActualizacion: new Date().toISOString()
            });
        }

        alert(`¡Has comprado a ${nombreJugador} por ${precio} EUR!`);
        cargarMercado(); // Recargar el mercado
        cargarDatosUsuario(auth.currentUser.uid); // Actualizar datos del usuario
    } catch (error) {
        console.error('Error al comprar jugador:', error);
        alert('Error al realizar la compra. Por favor, intenta de nuevo.');
    }
}

async function actualizarInfoTemporada() {
    try {
        const temporadaDoc = await getDoc(doc(db, "temporadas", TEMPORADA_ACTUAL.toString()));
        if (!temporadaDoc.exists()) {
            console.log('No hay datos de temporada');
            return;
        }

        const temporadaData = temporadaDoc.data();
        
        // Actualizar elementos en la UI
        document.getElementById('numero-temporada').textContent = temporadaData.numero || '-';
        document.getElementById('estado-temporada').textContent = temporadaData.estado || '-';
        document.getElementById('numero-jornada').textContent = temporadaData.jornadaActual || '-';
        document.getElementById('total-jornadas').textContent = JORNADA_MAX;

        // Calcular próximo mercado
        if (temporadaData.ultimoRefrescoMercado) {
            const proximoMercado = new Date(temporadaData.ultimoRefrescoMercado);
            proximoMercado.setTime(proximoMercado.getTime() + MERCADO_REFRESH_MS);
            document.getElementById('proximo-mercado').textContent = proximoMercado.toLocaleString();
        } else {
            document.getElementById('proximo-mercado').textContent = 'Pendiente';
        }

        console.log('Información de temporada actualizada');
    } catch (error) {
        console.error('Error al actualizar información de temporada:', error);
    }
}

// Consulta y muestra la alineación de otro usuario por UID
export async function mostrarAlineacionDeUsuario(uid, contenedorId = 'alineacion-externa') {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (!docSnap.exists()) {
    alert("Usuario no encontrado");
    return;
  }
  const data = docSnap.data();
  const alineacion = data.alineacionDraft;
  const cont = document.getElementById(contenedorId);
  if (!cont) return;
  cont.innerHTML = '';
  if (!alineacion) {
    cont.innerHTML = '<p>Este usuario no tiene alineación guardada.</p>';
    return;
  }
  Object.entries(alineacion).forEach(([pos, nombre]) => {
    if (!nombre) return;
    const stats = estadisticasPBM.find(j => j.nombre === nombre);
    const carta = crearCartaJugador(nombre, stats, pos);
    cont.appendChild(carta);
  });
}

// Función helper para crear carta de jugador
function crearCartaJugador(nombre, stats, pos = null, index = null, isAlineacion = false) {
  const puntos = nombre ? calcularPuntos(stats) : 0;
  const coste = nombre ? calcularCoste(puntos) : 0;
  const carta = document.createElement('div');
  carta.className = 'carta-jugador';
  
  // Asignar el nombre del jugador como dataset para drag and drop
  if (nombre) carta.dataset.nombre = nombre;
  
  // Determinar el texto a mostrar
  const displayName = nombre || `Jugador ${index || pos.charAt(0).toUpperCase() + pos.slice(1)}`;
  const posLabel = isAlineacion ? pos.charAt(0).toUpperCase() + pos.slice(1) : displayName;
  const imgSrc = nombre ? `img/${nombre.replace(/ /g, '_').toLowerCase()}.jpeg` : 'img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg';
  
  carta.innerHTML = `
    ${nombre ? `<div class="puntos">${puntos}</div>
    ${!isAlineacion ? `<div class="botones-venta">
      <button class="boton-venta" onclick="venderJugador('${nombre}', ${coste})">Vender</button>
      <button class="boton-venta boton-venta-rapida" onclick="ventaRapida('${nombre}', ${Math.floor(coste * 0.6)})">Venta rápida (${Math.floor(coste * 0.6)})</button>
    </div>` : ''}` : ''}
    <img src="${imgSrc}" alt="Foto de ${displayName}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
    ${!isAlineacion ? `<div class="nombre">${displayName}</div>` : ''}
    <div class="stats">
      <div class="stats-left">
        <div class="stat">
          <span class="stat-icon">⚽</span>
          <span>${stats?.goles ?? 0}</span>
        </div>
        <div class="stat">
          <span class="stat-icon">👟</span>
          <span>${stats?.asistencias ?? 0}</span>
        </div>
      </div>
      <div class="stats-right">
        <div class="stat">
          <span class="stat-icon">🏆</span>
          <span>${stats?.mvps ?? 0}</span>
        </div>
      </div>
    </div>
    <div class="coste">${coste}M</div>
  `;

  return carta;
}

// --- FUNCIONES DE TEMPORADA Y JORNADA ---

// Obtener datos de la temporada actual
async function obtenerTemporadaFirestore() {
  const docSnap = await getDoc(doc(db, "temporadas", TEMPORADA_ACTUAL.toString()));
  if (!docSnap.exists()) {
    // Si no existe, crear nueva temporada
    const nuevaTemporada = {
      numero: TEMPORADA_ACTUAL,
      jornadaActual: 1,
      fechaInicio: new Date().toISOString(),
      ultimoRefrescoMercado: null,
      estado: 'en_curso' // en_curso, finalizada
    };
    await setDoc(doc(db, "temporadas", TEMPORADA_ACTUAL.toString()), nuevaTemporada);
    return nuevaTemporada;
  }
  return docSnap.data();
}

// Configurar escuchas en tiempo real
function setupRealtimeListeners(uid) {
    // Escuchar cambios en los datos del usuario
    const unsubscribeUser = onSnapshot(doc(db, "usuarios", uid), (doc) => {
        if (doc.exists()) {
            const userData = doc.data();
            console.log('Datos del usuario actualizados:', userData);
            
            // Actualizar presupuesto
            const presupuestoElement = document.getElementById('presupuesto-usuario');
            if (presupuestoElement) {
                presupuestoElement.textContent = userData.presupuesto || 0;
            }

            // Actualizar plantilla
            const jugadoresLista = document.getElementById('jugadores-lista');
            if (jugadoresLista && Array.isArray(userData.plantilla)) {
                jugadoresLista.innerHTML = '';
                userData.plantilla.forEach(nombreJugador => {
                    const stats = estadisticasPBM.find(j => j.nombre === nombreJugador);
                    if (stats) {
                        const carta = crearCartaJugador(nombreJugador, stats);
                        jugadoresLista.appendChild(carta);
                    }
                });
            }

            // Actualizar alineación
            if (userData.alineacionDraft) {
                mostrarAlineacionGuardada(userData.alineacionDraft);
            }
        }
    });

    // Escuchar cambios en el mercado global
    const unsubscribeMercado = onSnapshot(doc(db, "mercado", "global"), (doc) => {
        if (doc.exists()) {
            console.log('Datos del mercado actualizados');
            cargarMercado();
        }
    });

    // Escuchar cambios en la temporada actual
    const unsubscribeTemporada = onSnapshot(doc(db, "temporadas", TEMPORADA_ACTUAL.toString()), (doc) => {
        if (doc.exists()) {
            console.log('Datos de la temporada actualizados');
            actualizarInfoTemporada();
        }
    });

    // Almacenar las funciones de cancelación
    window.unsubscribeListeners = () => {
        unsubscribeUser();
        unsubscribeMercado();
        unsubscribeTemporada();
        console.log('Listeners cancelados');
    };
}

// Función para mostrar la alineación guardada
async function mostrarAlineacionGuardada(alineacion) {
    try {
        const alineacionSection = document.getElementById('alineacion-section');
        if (!alineacionSection) return;

        // Mostrar la sección de alineación
        alineacionSection.style.display = 'block';

        // Limpiar y mostrar jugadores disponibles
        const jugadoresDisponibles = document.getElementById('jugadores-disponibles');
        if (!jugadoresDisponibles) return;

        // Limpiar contenedor de jugadores disponibles
        jugadoresDisponibles.innerHTML = '';
        
        // Obtener la lista actualizada de jugadores del usuario
        const userDoc = await getDoc(doc(db, 'usuarios', auth.currentUser.uid));
        if (!userDoc.exists()) {
            console.log('No se encontraron datos del usuario');
            return;
        }

        const userData = userDoc.data();
        const plantilla = userData.plantilla || [];
        
        // Obtener jugadores alineados (filtrando los null/undefined)
        const jugadoresAlineados = Object.values(alineacion || {}).filter(Boolean);
        
        // Filtrar jugadores disponibles (que no estén en la alineación)
        const jugadoresDisponiblesArr = plantilla.filter(j => !jugadoresAlineados.includes(j));
        
        // Mostrar jugadores disponibles
        jugadoresDisponiblesArr.forEach(nombreJugador => {
            const stats = estadisticasPBM.find(j => j.nombre === nombreJugador);
            if (stats) {
                const carta = crearCartaJugador(nombreJugador, stats);
                carta.draggable = true;
                carta.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', nombreJugador);
                    carta.classList.add('dragging');
                });
                carta.addEventListener('dragend', () => carta.classList.remove('dragging'));
                jugadoresDisponibles.appendChild(carta);
            }
        });

    // Mostrar jugadores en cada posición
    const posiciones = ['defensa', 'medio', 'atacante'];
    posiciones.forEach(pos => {
        const zonaPos = document.querySelector(`[data-pos="${pos}"]`);
        if (!zonaPos) return;
        
        // Limpiar zona completamente
        while (zonaPos.firstChild) {
            zonaPos.removeChild(zonaPos.firstChild);
        }

        const jugador = alineacion?.[pos];
        if (jugador) {
            const stats = estadisticasPBM.find(j => j.nombre === jugador);
            if (stats) {
                const carta = crearCartaJugador(jugador, stats, pos, null, true);
                zonaPos.appendChild(carta);
                
                // Agregar botón para quitar jugador
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-carta';
                removeBtn.innerHTML = '×';
                removeBtn.onclick = async (e) => {
                    e.stopPropagation(); // Evitar propagación del evento
                    await quitarJugadorDeAlineacion(pos);
                };
                zonaPos.appendChild(removeBtn);
            }
        }
    });

    // Configurar zonas drop
    configurarZonasDroppables();
} catch (error) {
    console.error('Error al mostrar alineación:', error);
}

    // Configurar zonas drop
    configurarZonasDroppables();
}

// Función para quitar un jugador de la alineación
async function quitarJugadorDeAlineacion(posicion) {
    try {
        const userRef = doc(db, 'usuarios', auth.currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const alineacion = userData.alineacionDraft || {};
        alineacion[posicion] = null;

        await updateDoc(userRef, { alineacionDraft: alineacion });
        mostrarAlineacionGuardada(alineacion);
    } catch (error) {
        console.error('Error al quitar jugador de la alineación:', error);
    }
}

// Configurar zonas droppables para drag and drop
function configurarZonasDroppables() {
    const zonas = document.querySelectorAll('.zona-drop');
    
    // Primero, eliminar eventos existentes
    zonas.forEach(zona => {
        const nuevoZona = zona.cloneNode(true);
        zona.parentNode.replaceChild(nuevoZona, zona);
        
        // Agregar nuevos event listeners
        nuevoZona.addEventListener('dragover', e => {
            e.preventDefault();
            nuevoZona.classList.add('drag-over');
        });

        nuevoZona.addEventListener('dragleave', () => {
            nuevoZona.classList.remove('drag-over');
        });

        nuevoZona.addEventListener('drop', async e => {
            e.preventDefault();
            nuevoZona.classList.remove('drag-over');
            
            const jugador = e.dataTransfer.getData('text/plain');
            const posicion = nuevoZona.dataset.pos;

            try {
                // Verificar que el jugador y la posición son válidos
                if (!jugador || !posicion) {
                    console.error('Jugador o posición no válidos');
                    return;
                }

                const userRef = doc(db, 'usuarios', auth.currentUser.uid);
                const userDoc = await getDoc(userRef);
                if (!userDoc.exists()) {
                    console.error('No se encontró el documento del usuario');
                    return;
                }

                const userData = userDoc.data();
                let alineacion = {...(userData.alineacionDraft || {})};
                
                // Verificar si el jugador ya está en otra posición y quitarlo
                Object.entries(alineacion).forEach(([pos, j]) => {
                    if (j === jugador) {
                        alineacion[pos] = null;
                    }
                });

                // Asignar jugador a la nueva posición
                alineacion[posicion] = jugador;

                // Actualizar en la base de datos
                await updateDoc(userRef, { alineacionDraft: alineacion });
                
                // Actualizar la vista
                mostrarAlineacionGuardada(alineacion);
            } catch (error) {
                console.error('Error al actualizar alineación:', error);
                alert('Error al actualizar la alineación. Por favor, intenta de nuevo.');
            }
        });
    });
}

// Guardar historial de jornada
async function guardarHistorialJornada(jornada) {
  try {
    const batch = writeBatch(db);
    const jornadaRef = doc(db, "temporadas", TEMPORADA_ACTUAL.toString(), "jornadas", jornada.toString());
    
    // 1. Datos básicos de la jornada
    const jornadaData = {
      numero: jornada,
      fecha: new Date().toISOString(),
      estado: jornada > JORNADA_MAX ? 'finalizada' : 'activa'
    };
    
    // 2. Obtener todos los usuarios
    const usuariosSnap = await getDocs(collection(db, "usuarios"));
    const historialUsuarios = {};
    
    // 3. Procesar cada usuario
    for (const userDoc of usuariosSnap.docs) {
      const userData = userDoc.data();
      const alineacion = userData.alineacionDraft || {};
      const plantilla = userData.plantilla || [];
      
      // Calcular puntos de la alineación
      let puntosTotales = 0;
      const puntosDetallados = {};
      
      Object.entries(alineacion).forEach(([posicion, jugador]) => {
        if (!jugador) return;
        
        const stats = estadisticasPBM.find(j => j.nombre === jugador);
        if (stats) {
          const puntos = calcularPuntos(stats);
          puntosDetallados[posicion] = {
            jugador,
            puntos,
            stats: {
              goles: stats.goles,
              asistencias: stats.asistencias,
              mvps: stats.mvps
            }
          };
          puntosTotales += puntos;
        }
      });
      
      // Guardar historial del usuario para esta jornada
      const userJornadaRef = doc(db, "usuarios", userDoc.id, "historial", `${TEMPORADA_ACTUAL}_${jornada}`);
      batch.set(userJornadaRef, {
        temporada: TEMPORADA_ACTUAL,
        jornada,
        alineacion,
        plantilla,
        puntosTotales,
        puntosDetallados,
        presupuesto: userData.presupuesto
      });
      
      historialUsuarios[userDoc.id] = {
        nombre: userData.nombre || userData.email,
        puntos: puntosTotales,
        alineacion: puntosDetallados
      };
    }
    
    // 4. Guardar datos globales de la jornada
    jornadaData.usuarios = historialUsuarios;
    batch.set(jornadaRef, jornadaData);
    
    // 5. Actualizar jornada actual en la temporada
    const temporadaRef = doc(db, "temporadas", TEMPORADA_ACTUAL.toString());
    batch.update(temporadaRef, { jornadaActual: jornada });
    
    // 6. Ejecutar todos los cambios
    await batch.commit();
    
    // 7. Notificar a los usuarios
    const mensaje = jornada > JORNADA_MAX
      ? `¡Jornada ${jornada} finalizada! La temporada ha terminado.`
      : `¡Jornada ${jornada} finalizada! Puntuaciones guardadas.`;
      
    await agregarNotificacionFirestore(mensaje);
    
    return historialUsuarios;
    
  } catch (error) {
    console.error('Error guardando historial de jornada:', error);
    throw error;
  }
}

// Guardar datos de jornada
async function guardarJornadaFirestore(jornada) {
  // Guardar historial completo de la jornada
  const historial = await guardarHistorialJornada(jornada);
  
  // Si es la última jornada, finalizar temporada
  if (jornada > JORNADA_MAX) {
    await finalizarTemporada();
  }
  
  return historial;
}

// Obtener historial de jornada
async function obtenerHistorialJornada(temporada, jornada) {
  try {
    const jornadaRef = doc(db, "temporadas", temporada.toString(), "jornadas", jornada.toString());
    const docSnap = await getDoc(jornadaRef);
    
    if (!docSnap.exists()) return null;
    return docSnap.data();
    
  } catch (error) {
    console.error('Error obteniendo historial de jornada:', error);
    throw error;
  }
}

// Obtener historial de usuario en jornada
async function obtenerHistorialUsuarioJornada(userId, temporada, jornada) {
  try {
    const historialRef = doc(db, "usuarios", userId, "historial", `${temporada}_${jornada}`);
    const docSnap = await getDoc(historialRef);
    
    if (!docSnap.exists()) return null;
    return docSnap.data();
    
  } catch (error) {
    console.error('Error obteniendo historial de usuario:', error);
    throw error;
  }
}

// Obtener jornada actual
async function obtenerJornadaFirestore() {
  const temporada = await obtenerTemporadaFirestore();
  return temporada.jornadaActual || 1;
}

// Verificar si es momento de avanzar jornada
async function verificarAvanceJornada() {
  const temporada = await obtenerTemporadaFirestore();
  if (temporada.estado === 'finalizada') return false;
  
  const jornada = temporada.jornadaActual;
  if (jornada > JORNADA_MAX) {
    // Finalizar temporada
    await finalizarTemporada();
    return false;
  }
  return true;
}

// Finalizar temporada actual
async function finalizarTemporada() {
  try {
    const temporadaRef = doc(db, "temporadas", TEMPORADA_ACTUAL.toString());
    const fechaFin = new Date().toISOString();
    
    // 1. Marcar temporada como finalizada
    await updateDoc(temporadaRef, { 
      estado: 'finalizada',
      fechaFin
    });
    
    // 2. Obtener todos los usuarios
    const usuariosSnap = await getDocs(collection(db, "usuarios"));
    const batch = writeBatch(db);
    
    // 3. Procesar cada usuario
    for (const userDoc of usuariosSnap.docs) {
      const userData = userDoc.data();
      const plantilla = userData.plantilla || [];
      
      // Guardar historial de la temporada para el usuario
      const historialRef = doc(db, "usuarios", userDoc.id, "historial", TEMPORADA_ACTUAL.toString());
      batch.set(historialRef, {
        temporada: TEMPORADA_ACTUAL,
        plantillaFinal: plantilla,
        presupuestoFinal: userData.presupuesto,
        fechaFin
      });
      
      // Resetear datos del usuario
      const userRef = doc(db, "usuarios", userDoc.id);
      batch.update(userRef, {
        plantilla: [],
        presupuesto: PRESUPUESTO_INICIAL,
        alineacionDraft: {}
      });
      
      // Devolver jugadores al mercado
      plantilla.forEach(jugador => {
        // Obtener stats del jugador
        const stats = estadisticasPBM.find(j => j.nombre === jugador);
        if (stats) {
          const puntos = calcularPuntos(stats);
          const precioOriginal = calcularCoste(puntos);
          // Marcar como devuelto con 20% de descuento
          mercadoDevueltos[jugador] = Math.floor(precioOriginal * 0.8);
        }
      });
    }
    
    // 4. Crear nuevo mercado inicial para siguiente temporada
    const nuevoMercado = generarMercadoAleatorio();
    Object.assign(nuevoMercado, { _devueltos: mercadoDevueltos });
    
    // 5. Guardar nuevo mercado
    const mercadoRef = doc(db, "mercado", "global");
    batch.set(mercadoRef, { mercado: nuevoMercado });
    
    // 6. Crear nueva temporada
    const nuevaTemporadaRef = doc(db, "temporadas", (TEMPORADA_ACTUAL + 1).toString());
    batch.set(nuevaTemporadaRef, {
      numero: TEMPORADA_ACTUAL + 1,
      jornadaActual: 1,
      fechaInicio: new Date().toISOString(),
      ultimoRefrescoMercado: null,
      estado: 'en_curso'
    });
    
    // 7. Ejecutar todos los cambios en una sola operación
    await batch.commit();
    
    // 8. Notificar a los usuarios
    await agregarNotificacionFirestore(`¡La temporada ${TEMPORADA_ACTUAL} ha finalizado! Nueva temporada iniciada.`);
    
    alert(`¡La temporada ${TEMPORADA_ACTUAL} ha finalizado! Nueva temporada iniciada.`);
    location.reload();
    
  } catch (error) {
    console.error('Error finalizando temporada:', error);
    throw error;
  }
}

// Generar nuevo mercado aleatorio (puede haber repetidos)
function generarMercadoAleatorio() {
  if (!estadisticasPBM || estadisticasPBM.length === 0) {
    console.error('No hay jugadores disponibles para generar el mercado');
    return null;
  }

  const mercado = {};
  const pool = [...estadisticasPBM.map(j => j.nombre)];
  const jugadoresSeleccionados = new Set();

  // Intentar evitar repetidos si hay suficientes jugadores
  for (let i = 0; i < MERCADO_SIZE; i++) {
    let jugador;
    if (pool.length > jugadoresSeleccionados.size) {
      // Buscar un jugador no seleccionado
      do {
        jugador = pool[Math.floor(Math.random() * pool.length)];
      } while (jugadoresSeleccionados.has(jugador));
      jugadoresSeleccionados.add(jugador);
    } else {
      // Si no hay suficientes jugadores únicos, permitir repetidos
      jugador = pool[Math.floor(Math.random() * pool.length)];
    }
    mercado[`mercado_${i}`] = jugador;
  }
  
  console.log('Mercado generado con', Object.keys(mercado).length, 'jugadores');
  return mercado;
}
const PRESUPUESTO_INICIAL = 30; // millones

// Plantilla
async function guardarPlantillaFirestore(uid, plantilla) {
  await setDoc(doc(db, "usuarios", uid), { plantilla }, { merge: true });
}
async function obtenerPlantillaFirestore(uid) {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (docSnap.exists()) return docSnap.data().plantilla || [];
  return [];
}

// Mercado
async function guardarMercadoFirestore(mercado) {
  if (!mercado) {
    console.error('Intento de guardar un mercado vacío');
    return;
  }

  const jugadoresDisponibles = Object.values(mercado);
  const mercadoData = {
    mercado,
    jugadoresDisponibles,
    ultimaActualizacion: new Date().toISOString()
  };

  // Sobrescribe el mercado completamente, eliminando cualquier campo residual
  await setDoc(doc(db, "mercado", "global"), mercadoData, { merge: false });
  console.log('Mercado guardado con', jugadoresDisponibles.length, 'jugadores disponibles');
}

async function obtenerMercadoFirestore() {
  const docSnap = await getDoc(doc(db, "mercado", "global"));
  if (!docSnap.exists()) {
    console.log('No existe documento de mercado');
    return null;
  }
  const data = docSnap.data();
  console.log('Datos del mercado recuperados:', data);
  return data.mercado || {};
}

// Presupuesto
async function guardarPresupuestoFirestore(uid, presupuesto) {
  await setDoc(doc(db, "usuarios", uid), { presupuesto }, { merge: true });
}
async function obtenerPresupuestoFirestore(uid) {
  const docSnap = await getDoc(doc(db, "usuarios", uid));
  if (docSnap.exists()) return docSnap.data().presupuesto ?? PRESUPUESTO_INICIAL;
  return PRESUPUESTO_INICIAL;
}

// Notificaciones
async function agregarNotificacionFirestore(msg) {
  const fecha = new Date().toLocaleString();
  await setDoc(doc(db, "notificaciones", "global"), { notificaciones: arrayUnion({ fecha, msg }) }, { merge: true });
}
async function obtenerNotificacionesFirestore() {
  const docSnap = await getDoc(doc(db, "notificaciones", "global"));
  if (docSnap.exists()) return docSnap.data().notificaciones || [];
  return [];
}

// Movimientos
async function agregarMovimientoFirestore(mov) {
  await setDoc(doc(db, "movimientos", "global"), { movimientos: arrayUnion(mov) }, { merge: true });
}
async function obtenerMovimientosFirestore() {
  const docSnap = await getDoc(doc(db, "movimientos", "global"));
  if (docSnap.exists()) return docSnap.data().movimientos || [];
  return [];
}

// --- CARGA DE JUGADORES ---
let jugadoresPBM = [];
fetch('json/estadisticas.json')
  .then(response => response.json())
  .then(data => {
    estadisticasPBM = data;
    jugadoresPBM = data.map(j => j.nombre);
    inicializarFantasy();
  })
  .catch(() => {
    estadisticasPBM = [];
    jugadoresPBM = [];
    inicializarFantasy();
  });

// --- FANTASY PRINCIPAL ---
async function inicializarFantasy() {
    // Guardar plantilla al hacer submit en el formulario
    const plantillaForm = document.getElementById('plantilla-form');
    if (plantillaForm) {
      plantillaForm.onsubmit = async function(e) {
        e.preventDefault();
        // Recoge los jugadores actuales de la plantilla
        // (ya están en plantillaUsuario)
        if (user && user.uid) {
          await guardarPlantillaFirestore(user.uid, plantillaUsuario);
          mensaje.style.color = 'green';
          mensaje.textContent = '¡Plantilla guardada en la nube!';
        }
      };
    }
  onAuthStateChanged(auth, async (user) => {
    const bienvenida = document.getElementById('bienvenida');
    const loginReq = document.getElementById('login-requerido');
    const fantasySection = document.getElementById('fantasy-section');
    const nombreUsuario = document.getElementById('nombre-usuario');
    const jugadoresLista = document.getElementById('jugadores-lista');
    const mensaje = document.getElementById('fantasy-mensaje');
    const logoutBtn = document.getElementById('logout-btn');
    let resetMercadoBtn = document.getElementById('reset-mercado-btn');
    if (!resetMercadoBtn) {
      resetMercadoBtn = document.createElement('button');
      resetMercadoBtn.id = 'reset-mercado-btn';
      resetMercadoBtn.textContent = 'Resetear mercado';
      resetMercadoBtn.style.background = '#1a7f37';
      resetMercadoBtn.style.color = '#fff';
      resetMercadoBtn.style.marginLeft = '1em';
      resetMercadoBtn.style.display = 'none';
      bienvenida.appendChild(resetMercadoBtn);
    }

    if (!user) {
      loginReq.style.display = 'block';
      return;
    }

    bienvenida.style.display = 'block';
    fantasySection.style.display = 'block';
    nombreUsuario.textContent = user.displayName || user.email;

    // Mostrar botón de reset solo para admin (ajusta tu email aquí)
    if (user.email === 'mjimenezsarm@gmail.com' || user.email === 'mjimenezsarm@gmail.com') {
      resetMercadoBtn.style.display = 'inline-block';
      resetMercadoBtn.onclick = async () => {
        if (confirm('¿Seguro que quieres resetear el mercado? Esta acción es irreversible.')) {
          await guardarMercadoFirestore({});
          alert('Mercado reseteado.');
          location.reload();
        }
      };
    } else {
      resetMercadoBtn.style.display = 'none';
    }

    // Leer plantilla, mercado, jornada y presupuesto desde Firestore
    let plantillaUsuario = await obtenerPlantillaFirestore(user.uid);
    let jornada = await obtenerJornadaFirestore();
    let mercado = await obtenerMercadoFirestore();
    let presupuesto = await obtenerPresupuestoFirestore(user.uid);

    // Si es jornada 1 y el mercado está vacío, generarlo automáticamente
    if (jornada === 1 && (!mercado || Object.keys(mercado).length === 0)) {
      const nuevoMercado = generarMercadoAleatorio();
      await guardarMercadoFirestore(nuevoMercado);
      mercado = nuevoMercado;
    }

    // Actualizar información de temporada y jornada
    async function actualizarInfoTemporada() {
      try {
        const temporada = await obtenerTemporadaFirestore();
        const user = auth.currentUser;
        
        // Info básica
        document.getElementById('numero-temporada').textContent = TEMPORADA_ACTUAL;
        document.getElementById('numero-jornada').textContent = temporada.jornadaActual;
        document.getElementById('total-jornadas').textContent = JORNADA_MAX;
        
        const estado = document.getElementById('estado-temporada');
        estado.textContent = temporada.estado === 'en_curso' ? 'En curso' : 'Finalizada';
        estado.className = temporada.estado === 'en_curso' ? 'estado-activo' : 'estado-finalizada';
        
        // Próximo mercado
        const proximoMercado = document.getElementById('proximo-mercado');
        if (temporada.ultimoRefrescoMercado) {
          const ultimo = new Date(temporada.ultimoRefrescoMercado);
          const proximo = new Date(ultimo.getTime() + MERCADO_REFRESH_MS);
          const ahora = new Date();
          const diff = proximo - ahora;
          
          if (diff > 0) {
            const horas = Math.floor(diff / (1000 * 60 * 60));
            const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            proximoMercado.textContent = `${horas}h ${minutos}m`;
          } else {
            proximoMercado.textContent = 'Próximamente';
          }
        } else {
          proximoMercado.textContent = 'Próximamente';
        }
        
        // Puntuaciones del usuario
        if (user) {
          const historial = await obtenerHistorialUsuarioJornada(
            user.uid,
            TEMPORADA_ACTUAL,
            temporada.jornadaActual
          );
          
          const puntosJornada = document.getElementById('puntos-jornada');
          const puntosTemporada = document.getElementById('puntos-temporada');
          
          puntosJornada.textContent = historial ? historial.puntosTotales : '0';
          
          // Calcular total de temporada
          let totalTemporada = 0;
          for (let i = 1; i <= temporada.jornadaActual; i++) {
            const jornadaHistorial = await obtenerHistorialUsuarioJornada(user.uid, TEMPORADA_ACTUAL, i);
            if (jornadaHistorial) {
              totalTemporada += jornadaHistorial.puntosTotales;
            }
          }
          puntosTemporada.textContent = totalTemporada;
        }
        
        // Tabla de mejores puntuaciones
        const historialJornada = await obtenerHistorialJornada(TEMPORADA_ACTUAL, temporada.jornadaActual);
        if (historialJornada && historialJornada.usuarios) {
          const tbody = document.getElementById('tbody-puntuaciones');
          tbody.innerHTML = '';
          
          // Ordenar usuarios por puntos
          const usuarios = Object.entries(historialJornada.usuarios)
            .sort(([,a], [,b]) => b.puntos - a.puntos)
            .slice(0, 10); // Top 10
          
          usuarios.forEach(([userId, data], index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${index + 1}</td>
              <td>${data.nombre}</td>
              <td>${data.puntos}</td>
              <td class="mejor-alineacion">${formatearMejorAlineacion(data.alineacion)}</td>
            `;
            tbody.appendChild(tr);
          });
          
          document.getElementById('tabla-puntuaciones').style.display = 'block';
        }
        
      } catch (error) {
        console.error('Error actualizando info de temporada:', error);
      }
    }
    
    // Formatear alineación para mostrar
    function formatearMejorAlineacion(alineacion) {
      if (!alineacion) return '-';
      
      return Object.entries(alineacion)
        .map(([pos, data]) => `${pos}: ${data.jugador} (${data.puntos})`)
        .join(' | ');
    }
    
    // Actualizar información cada minuto
    actualizarInfoTemporada();
    setInterval(actualizarInfoTemporada, 60000);

    // Mostrar "Mis jugadores"
    function renderMisJugadores(plantilla) {
      jugadoresLista.innerHTML = '';
      if (plantilla.length === 0) {
        jugadoresLista.innerHTML = '<p>No tienes jugadores en propiedad. Compra en el mercado para poder alinear.</p>';
      } else {
        plantilla.forEach(jugador => {
          const stats = estadisticasPBM.find(j => j.nombre === jugador);
          const carta = crearCartaJugador(jugador, stats);
          jugadoresLista.appendChild(carta);
        });
      }
      // Restricción de plantilla
      if (plantilla.length > 3) {
        mensaje.style.color = 'red';
        mensaje.textContent = '¡Tienes más de 3 jugadores en plantilla! Debes vender jugadores.';
      } else {
        mensaje.textContent = '';
      }
    }
    renderMisJugadores(plantillaUsuario);
    mostrarAlineacionSection(plantillaUsuario);

    // Inicializar mercado global y presupuesto
    inicializarMercado(user, plantillaUsuario, mercado, presupuesto);

    logoutBtn.addEventListener('click', function() {
      window.location.href = 'login.html';
    });
  });
}

// --- MERCADO, COMPRA/VENTA, NOTIFICACIONES ---
function inicializarMercado(user, plantillaUsuario, mercado, presupuesto) {
  const mercadoLista = document.getElementById('mercado-lista');
  const movimientosMercado = document.getElementById('movimientos-mercado');
  const notificacionesMercado = document.getElementById('notificaciones-mercado');
  const presupuestoSpan = document.getElementById('presupuesto-usuario');

  // Mostrar presupuesto
  function renderPresupuesto() {
    // Si presupuesto es undefined, mostrar el inicial
    let mostrar = (typeof presupuesto === 'number' && !isNaN(presupuesto)) ? presupuesto : PRESUPUESTO_INICIAL;
    presupuestoSpan.textContent = mostrar + 'M';
  }

  // Actualización en tiempo real del mercado
  let mercadoActual = mercado;
  function renderMercado() {
    mercadoLista.innerHTML = '';
    mercadoLista.style.display = 'grid';
    mercadoLista.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    mercadoLista.style.gap = '1em';
    const devueltos = mercadoActual._devueltos || {};
    for (let i = 0; i < MERCADO_SIZE; i++) {
      const j = mercadoActual[`mercado_${i}`];
      if (!j) continue;
      const stats = estadisticasPBM.find(s => s.nombre === j);
      const puntos = calcularPuntos(stats);
      let coste = calcularCoste(puntos);
      let esDevuelto = devueltos[j];
      if (esDevuelto) {
        coste = Math.max(1, Math.round(coste * 0.8));
      }
      const slotComprado = mercadoActual[`comprado_${i}`];
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.style.display = 'flex';
      carta.style.flexDirection = 'column';
      carta.style.alignItems = 'center';
      carta.style.justifyContent = 'space-between';
      carta.style.margin = '0.5em';
      carta.style.padding = '0.5em';
      carta.style.background = '#fff';
      carta.style.borderRadius = '8px';
      carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      carta.style.minHeight = '260px';
      carta.style.minWidth = '180px';
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre" style="font-weight:bold;">${j}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
        <div class="acciones" style="margin-top:0.5em;"></div>
      `;
      if (esDevuelto) {
        const etiqueta = document.createElement('span');
        etiqueta.textContent = 'Devuelto al mercado (-20%)';
        etiqueta.style.background = '#ffe082';
        etiqueta.style.color = '#b8860b';
        etiqueta.style.fontSize = '0.8em';
        etiqueta.style.padding = '2px 6px';
        etiqueta.style.borderRadius = '6px';
        etiqueta.style.marginBottom = '0.5em';
        carta.insertBefore(etiqueta, carta.firstChild.nextSibling);
      }
      const acciones = carta.querySelector('.acciones');
      if (slotComprado) {
        acciones.innerHTML = `<span style=\"color:gray\">Comprado por ${slotComprado.usuario}</span>`;
        carta.style.opacity = 0.7;
      } else if (!plantillaUsuario.includes(j)) {
        const btn = document.createElement('button');
        btn.textContent = `Comprar (${coste}M)`;
        btn.className = 'btn-comprar';
        btn.style.background = '#1a7f37';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.padding = '0.3em 1em';
        btn.style.cursor = 'pointer';
        // Bloquear compra si plantilla llena
        if (plantillaUsuario.length >= 3) {
          btn.disabled = true;
          btn.style.background = '#ccc';
          btn.textContent = 'Máximo 3 jugadores';
        } else {
          btn.onclick = async () => { await comprarJugador(j, coste, false, i); };
        }
        acciones.appendChild(btn);
      } else {
        acciones.innerHTML = `<span style=\"color:gray\">Ya en tu plantilla</span>`;
        carta.style.opacity = 0.7;
      }
      mercadoLista.appendChild(carta);
    }
  }

  // Listener Firestore para mercado en tiempo real
  onSnapshot(doc(db, "mercado", "global"), (docSnap) => {
    if (docSnap.exists()) {
      mercadoActual = docSnap.data().mercado || {};
      renderMercado();
    }
  });
  // --- Mercado rotativo ---
  let actualizando = false;
  
  // Verificar y actualizar mercado si es necesario
  async function verificarMercado() {
    if (actualizando) return;
    actualizando = true;
    
    try {
      const temporada = await obtenerTemporadaFirestore();
      if (temporada.estado === 'finalizada') {
        actualizando = false;
        return;
      }
      
      const ultimoRefresco = temporada.ultimoRefrescoMercado;
      const ahora = new Date().getTime();
      
      // Si no hay último refresco o ha pasado el tiempo necesario
      if (!ultimoRefresco || (ahora - new Date(ultimoRefresco).getTime()) >= MERCADO_REFRESH_MS) {
        // Verificar si es momento de avanzar jornada
        if (await verificarAvanceJornada()) {
          await refrescarMercado();
          await avanzarJornada();
        }
      }
    } catch (error) {
      console.error('Error verificando mercado:', error);
    }
    
    actualizando = false;
  }
  
  // Refrescar mercado
  async function refrescarMercado() {
    const nuevoMercado = generarMercadoAleatorio();
    // Limpiar comprados previos
    for (let i = 0; i < MERCADO_SIZE; i++) {
      if (nuevoMercado.hasOwnProperty(`comprado_${i}`)) {
        delete nuevoMercado[`comprado_${i}`];
      }
    }
    
    await guardarMercadoFirestore(nuevoMercado);
    await updateDoc(doc(db, "temporadas", TEMPORADA_ACTUAL.toString()), {
      ultimoRefrescoMercado: new Date().toISOString()
    });
  }
  
  // Avanzar jornada
  async function avanzarJornada() {
    const temporada = await obtenerTemporadaFirestore();
    const nuevaJornada = temporada.jornadaActual + 1;
    
    await guardarJornadaFirestore(nuevaJornada);
    alert(`¡Nueva jornada disponible! Jornada ${nuevaJornada}`);
    location.reload();
  }
  
  // Verificar mercado periódicamente
  setInterval(verificarMercado, 60000); // Verificar cada minuto

  // Comprar jugador
  async function comprarJugador(jugador, coste, gratis, slotIdx) {
    if (plantillaUsuario.includes(jugador)) {
      alert('Ya tienes este jugador en tu plantilla.');
      return;
    }
    if (!gratis && presupuesto < coste) {
      alert('No tienes suficiente presupuesto.');
      return;
    }
    if (gratis && plantillaUsuario.length > 0) return;
    // Si es compra de slot de mercado
    if (typeof slotIdx === 'number') {
      // Comprobación en tiempo real en Firestore antes de comprar
      const mercadoDoc = await getDoc(doc(db, "mercado", "global"));
      const mercadoActual = mercadoDoc.exists() ? mercadoDoc.data().mercado || {} : {};
      if (mercadoActual[`comprado_${slotIdx}`]) {
        alert('Este jugador ya ha sido comprado por otro usuario.');
        renderMercado(); // Actualiza la vista
        return;
      }
      mercado[`comprado_${slotIdx}`] = { usuario: user.email };
    }
    plantillaUsuario.push(jugador);
    if (!gratis) presupuesto -= coste;
    await guardarPlantillaFirestore(user.uid, plantillaUsuario);
    await guardarMercadoFirestore(mercado);
    await guardarPresupuestoFirestore(user.uid, presupuesto);
    await agregarMovimientoFirestore({ fecha: new Date().toLocaleString(), usuario: user.email, tipo: 'compra', jugador, coste });
    await agregarNotificacionFirestore(`${user.displayName} compró a ${jugador} (${coste}M)`);
    renderMisJugadores(plantillaUsuario);
    renderMercado();
    renderPresupuesto();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(plantillaUsuario);
  }

  // Vender jugador
  async function venderJugador(jugador) {
    if (!plantillaUsuario.includes(jugador)) return;
    const stats = estadisticasPBM.find(j => j.nombre === jugador);
    const puntos = calcularPuntos(stats);
    const coste = calcularCoste(puntos);
    plantillaUsuario = plantillaUsuario.filter(j => j !== jugador);
    mercado[jugador] = null;
    presupuesto += coste;
    await guardarPlantillaFirestore(user.uid, plantillaUsuario);
    await guardarMercadoFirestore(mercado);
    await guardarPresupuestoFirestore(user.uid, presupuesto);
    await agregarMovimientoFirestore({ fecha: new Date().toLocaleString(), usuario: user.email, tipo: 'venta', jugador, coste });
    await agregarNotificacionFirestore(`${user.displayName} vendió a ${jugador} (${coste}M)`);
    renderMisJugadores(plantillaUsuario);
    renderMercado();
    renderPresupuesto();
    renderMovimientos();
    renderNotificaciones();
    mostrarPlantillaCartas(plantillaUsuario);
  }

  // Mostrar movimientos
  async function renderMovimientos() {
    let movimientos = await obtenerMovimientosFirestore();
    movimientosMercado.innerHTML = '';
    movimientos.slice(-10).reverse().forEach(m => {
      const li = document.createElement('li');
      li.textContent = `${m.fecha}: ${m.usuario} ${m.tipo === 'venta' ? 'vendió' : 'compró'} a ${m.jugador} (${m.coste}M)`;
      movimientosMercado.appendChild(li);
    });
  }

  // Mostrar notificaciones globales
  async function renderNotificaciones() {
    let notificaciones = await obtenerNotificacionesFirestore();
    notificacionesMercado.innerHTML = '';
    notificaciones.slice(-3).reverse().forEach(n => {
      const div = document.createElement('div');
      div.textContent = `${n.fecha}: ${n.msg}`;
      notificacionesMercado.appendChild(div);
    });
  }

  // Mostrar "Mis jugadores"
  function renderMisJugadores(plantilla) {
    const jugadoresLista = document.getElementById('jugadores-lista');
    jugadoresLista.innerHTML = '';
    jugadoresLista.style.display = 'grid';
    jugadoresLista.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    jugadoresLista.style.gap = '1em';
    if (plantilla.length === 0) {
      jugadoresLista.innerHTML = '<p>No tienes jugadores en propiedad. Compra en el mercado para poder alinear.</p>';
    } else {
      plantilla.forEach(jugador => {
        const stats = estadisticasPBM.find(j => j.nombre === jugador);
        const puntos = calcularPuntos(stats);
        const coste = calcularCoste(puntos);
        const carta = document.createElement('div');
        carta.className = 'carta-jugador';
        carta.style.display = 'flex';
        carta.style.flexDirection = 'column';
        carta.style.alignItems = 'center';
        carta.style.justifyContent = 'space-between';
        carta.style.margin = '0.5em';
        carta.style.padding = '0.5em';
        carta.style.background = '#fff';
        carta.style.borderRadius = '8px';
        carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        carta.style.minHeight = '260px';
        carta.style.minWidth = '180px';
        carta.innerHTML = `
          <img src="img/${jugador.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${jugador}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
          <div class="nombre" style="font-weight:bold;">${jugador}</div>
          <div class="puntos">Puntos: <b>${puntos}</b></div>
          <div class="coste">Coste: <b>${coste}M</b></div>
          <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
        `;
        jugadoresLista.appendChild(carta);
      });
    }
  }

  // Mostrar plantilla visual
  function mostrarPlantillaCartas(plantilla) {
    const div = document.getElementById('plantilla-cartas');
    if (!div) return;
    div.innerHTML = '';
    div.style.display = 'grid';
    div.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    div.style.gap = '1em';
    let totalCoste = 0;
    plantilla.forEach(j => {
      const stats = estadisticasPBM.find(p => p.nombre === j);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      totalCoste += coste;
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.style.display = 'flex';
      carta.style.flexDirection = 'column';
      carta.style.alignItems = 'center';
      carta.style.justifyContent = 'space-between';
      carta.style.margin = '0.5em';
      carta.style.padding = '0.5em';
      carta.style.background = '#fff';
      carta.style.borderRadius = '8px';
      carta.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      carta.style.minHeight = '260px';
      carta.style.minWidth = '180px';
      carta.innerHTML = `
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" style="width:90px;height:90px;object-fit:cover;border-radius:50%;margin-bottom:0.5em;" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre" style="font-weight:bold;">${j}</div>
        <div class="puntos">Puntos: <b>${puntos}</b></div>
        <div class="coste">Coste: <b>${coste}M</b></div>
        <div class="stats" style="font-size:0.9em;color:#555;">Goles: ${stats.goles} | Asist: ${stats.asistencias} | MVPs: ${stats.mvps}</div>
      `;
      div.appendChild(carta);
    });
    if (plantilla.length > 0) {
      const total = document.createElement('div');
      total.style.width = '100%';
      total.style.fontWeight = 'bold';
      total.style.marginTop = '0.5em';
      total.textContent = `Total coste plantilla: ${totalCoste}M`;
      div.appendChild(total);
    }
  }

  // Inicial
  renderMercado();
  renderMovimientos();
  renderNotificaciones();
  renderPresupuesto();
  mostrarPlantillaCartas(plantillaUsuario);
}


// --- ALINEACIÓN (solo Firestore, sin localStorage) ---
async function mostrarAlineacionSection(jugadores) {
  const alineacionSection = document.getElementById('alineacion-section');
  alineacionSection.style.display = 'block';
  let limpiarBtn = document.getElementById('limpiar-alineacion');
  if (!limpiarBtn) {
    limpiarBtn = document.createElement('button');
    limpiarBtn.id = 'limpiar-alineacion';
    limpiarBtn.type = 'button';
    limpiarBtn.textContent = 'Limpiar plantilla';
    limpiarBtn.style.marginLeft = '1em';
    const guardarBtn = document.getElementById('guardar-alineacion');
    guardarBtn.parentNode.insertBefore(limpiarBtn, guardarBtn.nextSibling);
  }
  const zonas = {
    defensa: alineacionSection.querySelector('.zona-drop[data-pos="defensa"]'),
    medio: alineacionSection.querySelector('.zona-drop[data-pos="medio"]'),
    atacante: alineacionSection.querySelector('.zona-drop[data-pos="atacante"]')
  };
  const disponiblesDiv = document.getElementById('jugadores-disponibles');
  const mensaje = document.getElementById('alineacion-mensaje');

  // Obtener usuario autenticado de Firebase Auth
  let usuario = null;
  await new Promise(resolve => {
    onAuthStateChanged(auth, user => {
      usuario = user;
      resolve();
    });
  });
  let alineacion = {
    portero: null,
    defensa1: null,
    defensa2: null,
    atacante1: null,
    atacante2: null
  };
  // Listener en tiempo real para la alineación draft
  if (usuario && usuario.uid) {
    onSnapshot(doc(db, "usuarios", usuario.uid), (docSnap) => {
      const data = docSnap.data();
      if (data && data.alineacionDraft) {
        alineacion = { ...data.alineacionDraft };
        renderZonas();
        renderJugadoresDisponibles();
      }
    });
  }

    // Listener en tiempo real para la alineación draft
    if (usuario && usuario.uid) {
      onSnapshot(doc(db, "usuarios", usuario.uid), (docSnap) => {
        const data = docSnap.data();
        if (data && data.alineacionDraft) {
          alineacion = { ...data.alineacionDraft };
          renderZonas();
          renderJugadoresDisponibles();
        }
      });
    }

  // Renderizar cartas disponibles
  function renderJugadoresDisponibles() {
    disponiblesDiv.innerHTML = '';
    jugadores.forEach(j => {
      if (Object.values(alineacion).includes(j)) return; // Ya alineado
      const stats = estadisticasPBM.find(p => p.nombre === j);
      const puntos = calcularPuntos(stats);
      const coste = calcularCoste(puntos);
      const carta = document.createElement('div');
      carta.className = 'carta-jugador';
      carta.draggable = true;
      carta.dataset.nombre = j;
      carta.innerHTML = `
        <div class="puntos">${puntos}</div>
        <img src="img/${j.replace(/ /g, '_').toLowerCase()}.jpeg" alt="Foto de ${j}" onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
        <div class="nombre">${j}</div>
        <div class="stats">
          <div class="stats-left">
            <div class="stat">
              <span class="stat-icon">⚽</span>
              <span>${stats.goles}</span>
            </div>
            <div class="stat">
              <span class="stat-icon">👟</span>
              <span>${stats.asistencias}</span>
            </div>
          </div>
          <div class="stats-right">
            <div class="stat">
              <span class="stat-icon">🏆</span>
              <span>${stats.mvps}</span>
            </div>
          </div>
        </div>
        <div class="coste">${coste}M</div>
      `;
      carta.addEventListener('dragstart', e => {
        carta.classList.add('dragging');
        e.dataTransfer.setData('text/plain', j);
      });
      carta.addEventListener('dragend', () => {
        carta.classList.remove('dragging');
      });
      disponiblesDiv.appendChild(carta);
    });
  }

  // Renderizar cartas en zonas
  function renderZonas() {
  let index = 1;
  Object.entries(zonas).forEach(([pos, zona]) => {
    zona.innerHTML = ""; // Limpia la zona antes de añadir la carta
    zona.classList.remove('drag-over');
    const jugador = alineacion[pos];
    
    // Crear carta (con jugador o vacía)
    const carta = crearCartaJugador(
      jugador || null,
      jugador ? estadisticasPBM.find(p => p.nombre === jugador) : null,
      pos,
      index++,
      true // Indicar que es una carta de alineación
    );

    // Si hay jugador, añadir botón para quitar
    if (jugador) {
      const btn = document.createElement('button');
      btn.className = 'remove-carta';
      btn.innerHTML = '&times;';
      btn.title = 'Quitar de la alineación';
      btn.onclick = async () => {
        alineacion[pos] = null;
        if (usuario && usuario.uid) {
          await setDoc(doc(db, "usuarios", usuario.uid), { alineacionDraft: alineacion }, { merge: true });
        }
        renderZonas();
        renderJugadoresDisponibles();
      };
      zona.appendChild(btn);
      zona.appendChild(carta);
    }
  });
}

  // Drag & drop listeners
  Object.entries(zonas).forEach(([pos, zona]) => {
    zona.ondragover = e => {
      e.preventDefault();
      zona.classList.add('drag-over');
    };
    zona.ondragleave = () => zona.classList.remove('drag-over');
    zona.ondrop = async e => {
      e.preventDefault();
      zona.classList.remove('drag-over');
      const nombre = e.dataTransfer.getData('text/plain');
      if (!nombre) return;
      // No permitir repetir
      if (Object.values(alineacion).includes(nombre)) return;
      alineacion[pos] = nombre;
      if (usuario && usuario.uid) {
        await setDoc(doc(db, "usuarios", usuario.uid), { alineacionDraft: alineacion }, { merge: true });
      }
      renderZonas();
      renderJugadoresDisponibles();
    };
  });

  // Guardar alineación
  document.getElementById('guardar-alineacion').onclick = async function() {
    const valores = Object.values(alineacion);
    if (valores.some(v => !v)) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Debes colocar todos los jugadores en una posición.';
      return;
    }
    if (new Set(valores).size !== 5) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'No puedes repetir jugadores en varias posiciones.';
      return;
    }
    // Guardar en Firestore alineación y plantilla
    try {
      if (usuario && usuario.uid) {
        // Obtener plantilla actual del usuario (jugadores en propiedad)
        let plantilla = [];
        if (typeof window.plantillaUsuario !== 'undefined') {
          plantilla = window.plantillaUsuario;
        } else if (typeof jugadores !== 'undefined') {
          plantilla = jugadores;
        }
        await setDoc(doc(db, "usuarios", usuario.uid), { alineacion, plantilla }, { merge: true });
      }
      mensaje.style.color = 'green';
      mensaje.textContent = '¡Alineación y plantilla guardadas!';
    } catch (e) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error guardando en la nube.';
    }
    inicializarFantasy();
  };

  renderZonas();
  renderJugadoresDisponibles();
  mensaje.textContent = '';
}

// Las funciones de cálculo ahora están definidas al inicio del archivo