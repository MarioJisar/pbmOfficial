import { db, auth, waitForAuth } from '../firebase/firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { calcularPuntos, calcularCoste } from './utils.js';

// Variables globales
let modalVenta = null;
let jugadorEnVenta = null;

// Cargar jugadores en venta
async function cargarJugadoresEnVenta() {
    try {
                // Verificar autenticación
        const user = await waitForAuth();
        if (!user) {
            console.log('Usuario no autenticado');
            window.location.href = 'login.html';
            return;
        }

        const mercadoVentasLista = document.getElementById('mercado-ventas-lista');
        if (!mercadoVentasLista) {
            console.log('No se encontró el contenedor del mercado de ventas');
            return;
        }

        // Obtener el documento del mercado global
        const mercadoRef = doc(db, 'mercado', 'global');
        const mercadoDoc = await getDoc(mercadoRef);
        
        if (!mercadoDoc.exists()) {
            console.log('No existe el documento del mercado');
            mercadoVentasLista.innerHTML = '<p class="mensaje-no-ventas">No hay jugadores en venta actualmente</p>';
            return;
        }

        const mercadoData = mercadoDoc.data();
        const mercado = mercadoData.mercado || {};
        mercadoVentasLista.innerHTML = '';

        let hayJugadoresEnVenta = false;

        for (const [nombreJugador, infoJugador] of Object.entries(mercado)) {
            if (!infoJugador || !infoJugador.enVenta) continue;
            
            hayJugadoresEnVenta = true;
            const stats = window.estadisticasPBM.find(j => j.nombre === nombreJugador);
            if (!stats) continue;

            const puntos = calcularPuntos(stats);
            const carta = document.createElement('div');
            carta.className = 'carta-jugador carta-venta';
            carta.innerHTML = `
                <img src="img/${nombreJugador.replace(/ /g, '_').toLowerCase()}.jpeg" 
                     onerror="this.src='img/0b1d0f0076aa13c3fd8b83cca83594635c8e2c59a1b9dc61e73dd5994279b88c.jpeg'">
                <div class="nombre">${nombreJugador}</div>
                <div class="puntos">${puntos} pts</div>
                <div class="coste">${infoJugador.precio} EUR</div>
                <div class="stats">
                    <span title="Goles">⚽ ${stats.goles}</span>
                    <span title="Asistencias">👟 ${stats.asistencias}</span>
                    <span title="MVPs">🏆 ${stats.mvps}</span>
                </div>
                <div class="vendedor">Vendedor: ${infoJugador.nombreVendedor}</div>
                ${auth.currentUser && auth.currentUser.uid !== infoJugador.vendedor ? 
                    `<button onclick="comprarJugadorVenta('${nombreJugador}', ${infoJugador.precio}, '${infoJugador.vendedor}')" class="boton-venta">
                        Comprar por ${infoJugador.precio} EUR
                    </button>` : 
                    '<div class="mensaje-propio">Este es tu jugador en venta</div>'}
            `;
            mercadoVentasLista.appendChild(carta);
        }

        if (!hayJugadoresEnVenta) {
            mercadoVentasLista.innerHTML = '<p class="mensaje-no-ventas">No hay jugadores en venta actualmente</p>';
        }
    } catch (error) {
        console.error('Error al cargar jugadores en venta:', error);
        const mercadoVentasLista = document.getElementById('mercado-ventas-lista');
        if (mercadoVentasLista) {
            mercadoVentasLista.innerHTML = '<p class="mensaje-error">Error al cargar el mercado de ventas</p>';
        }
    }
}

// Comprar jugador
window.comprarJugadorVenta = async function(nombreJugador, precio, vendedorUid) {
    if (!confirm(`Quieres comprar a ${nombreJugador} por ${precio} EUR?`)) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Debes iniciar sesión para realizar esta acción');
            return;
        }

        // Verificar comprador
        const compradorDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!compradorDoc.exists()) return;
        const compradorData = compradorDoc.data();

        if ((compradorData.presupuesto || 0) < precio) {
            alert('No tienes suficiente presupuesto');
            return;
        }

        // Verificar vendedor
        const vendedorDoc = await getDoc(doc(db, 'usuarios', vendedorUid));
        if (!vendedorDoc.exists()) return;
        const vendedorData = vendedorDoc.data();

        // Actualizar presupuestos
        const nuevoPresupuestoComprador = compradorData.presupuesto - precio;
        const nuevoPresupuestoVendedor = (vendedorData.presupuesto || 0) + precio;

        // Actualizar comprador
        await updateDoc(doc(db, 'usuarios', user.uid), {
            plantilla: arrayUnion(nombreJugador),
            presupuesto: nuevoPresupuestoComprador
        });

        // Actualizar vendedor
        await updateDoc(doc(db, 'usuarios', vendedorUid), {
            presupuesto: nuevoPresupuestoVendedor
        });

        // Quitar jugador del mercado
        const mercadoRef = doc(db, 'mercado', 'global');
        await updateDoc(mercadoRef, {
            [`mercado.${nombreJugador}`]: null
        });

        alert(`Has comprado a ${nombreJugador} por ${precio} EUR`);
        location.reload();

    } catch (error) {
        console.error('Error al comprar jugador:', error);
        alert('Error al realizar la compra');
    }
};

// Eventos del DOM y modal de venta
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Esperar a que el usuario esté autenticado
        const user = await waitForAuth();
        if (!user) {
            console.log('Usuario no autenticado');
            window.location.href = 'login.html';
            return;
        }
        
        // Inicializar eventos
        window.venderJugador = function(nombreJugador, precioMercado) {
            try {
                jugadorEnVenta = nombreJugador;
                modalVenta = document.getElementById('modal-venta');
                const precioInput = document.getElementById('modal-precio-venta');
                const precioInfo = document.getElementById('modal-precio-mercado');
                const nombreSpan = document.getElementById('modal-jugador-nombre');

                nombreSpan.textContent = nombreJugador;
                precioInput.value = precioMercado;
                precioInfo.textContent = `Precio actual en el mercado: ${precioMercado} EUR`;
                modalVenta.style.display = 'block';
            } catch (error) {
                console.error('Error al abrir el modal de venta:', error);
                alert('Error al abrir el modal de venta');
            }
        };

    // Cargar mercado de ventas
    cargarJugadoresEnVenta();

    // Configurar modal
    const modalVenta = document.getElementById('modal-venta');
    const confirmarVentaBtn = document.getElementById('modal-confirmar-venta');
    const cancelarVentaBtn = document.getElementById('modal-cancelar-venta');

    // Botones del modal
    confirmarVentaBtn.onclick = async () => {
        const precioVenta = parseInt(document.getElementById('modal-precio-venta').value);
        
        if (!precioVenta || precioVenta < 1) {
            alert('Por favor, introduce un precio válido');
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                alert('Debes iniciar sesión para realizar esta acción');
                return;
            }

            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (!userDoc.exists()) return;

            const userData = userDoc.data();
            const plantilla = userData.plantilla || [];

            if (!plantilla.includes(jugadorEnVenta)) {
                alert('Este jugador no está en tu plantilla');
                return;
            }

            // Poner jugador en venta
            const mercadoRef = doc(db, 'mercado', 'global');
            await updateDoc(mercadoRef, {
                [`mercado.${jugadorEnVenta}`]: {
                    enVenta: true,
                    vendedor: user.uid,
                    precio: precioVenta,
                    nombreVendedor: user.displayName || user.email,
                    timestamp: new Date().getTime()
                }
            });

            // Actualizar plantilla del usuario
            const nuevaPlantilla = plantilla.filter(j => j !== jugadorEnVenta);
            const alineacion = userData.alineacionDraft || {};
            Object.keys(alineacion).forEach(pos => {
                if (alineacion[pos] === jugadorEnVenta) {
                    alineacion[pos] = null;
                }
            });

            await updateDoc(doc(db, 'usuarios', user.uid), {
                plantilla: nuevaPlantilla,
                alineacionDraft: alineacion
            });

            modalVenta.style.display = 'none';
            alert(`${jugadorEnVenta} ha sido puesto en venta por ${precioVenta} EUR`);
            location.reload();

        } catch (error) {
            console.error('Error al poner en venta:', error);
            alert('Error al poner el jugador en venta');
        }
    };

    cancelarVentaBtn.onclick = () => {
        modalVenta.style.display = 'none';
    };
    } catch (error) {
        console.error('Error en la inicialización:', error);
        alert('Error al inicializar la página de ventas');
    }
});

// Venta rápida
window.ventaRapida = async function(nombreJugador, precioVentaRapida) {
    if (!confirm(`Seguro que quieres vender a ${nombreJugador} por ${precioVentaRapida} EUR?`)) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            alert('Debes iniciar sesión para realizar esta acción');
            return;
        }

        // Verificar usuario y jugador
        const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const plantilla = userData.plantilla || [];

        if (!plantilla.includes(nombreJugador)) {
            alert('Este jugador no está en tu plantilla');
            return;
        }

        // Actualizar presupuesto y plantilla
        const nuevoPresupuesto = (userData.presupuesto || 0) + precioVentaRapida;
        const nuevaPlantilla = plantilla.filter(j => j !== nombreJugador);
        const alineacion = userData.alineacionDraft || {};

        Object.keys(alineacion).forEach(pos => {
            if (alineacion[pos] === nombreJugador) {
                alineacion[pos] = null;
            }
        });

        await updateDoc(doc(db, 'usuarios', user.uid), {
            plantilla: nuevaPlantilla,
            alineacionDraft: alineacion,
            presupuesto: nuevoPresupuesto
        });

        // Devolver jugador al mercado
        const mercadoRef = doc(db, 'mercado', 'global');
        await updateDoc(mercadoRef, {
            [`mercado.${nombreJugador}`]: null
        });

        alert(`Has vendido a ${nombreJugador} por ${precioVentaRapida} EUR`);
        location.reload();

    } catch (error) {
        console.error('Error en venta rápida:', error);
        alert('Error al realizar la venta rápida');
    }
};