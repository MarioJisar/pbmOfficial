// js/registro.js
// Registro de usuarios usando Firestore
import { db, auth, doc, setDoc, initializeFirebase } from '../firebase/firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// Cargar jugadores disponibles desde estadisticas.json
let jugadoresDisponibles = [];
fetch('./json/estadisticas.json')
  .then(res => res.json())
  .then(data => {
    jugadoresDisponibles = data;
  });

document.addEventListener('DOMContentLoaded', async function() {
  const mensaje = document.getElementById('registro-mensaje');
  let form;
  
  try {
    // Asegurar que Firebase esté inicializado antes de continuar
    await initializeFirebase();
    
    form = document.getElementById('registro-form');
    if (!form) {
      throw new Error('No se pudo encontrar el formulario de registro');
    }

    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const nombre = form.nombre.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;

    if (!nombre || !email || !password) {
      mensaje.textContent = 'Por favor, completa todos los campos.';
      return;
    }

    try {
      // Crear usuario en Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: nombre });

      // Asignar jugador aleatorio de estadisticas.json
      let plantilla = [];
      let jugadorAsignado = null;
      if (Array.isArray(jugadoresDisponibles) && jugadoresDisponibles.length > 0) {
        const idx = Math.floor(Math.random() * jugadoresDisponibles.length);
        jugadorAsignado = jugadoresDisponibles[idx];
        plantilla = [jugadorAsignado.nombre];
      }

      // Inicializar presupuesto (el jugador asignado es un regalo inicial)
      const presupuesto = 30; // Presupuesto inicial completo
      const mercado = [];

      // Guardar datos en Firestore (colección 'usuarios', id = uid de Auth)
      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        nombre,
        email,
        plantilla,
        presupuesto,
        mercado
      });

      mensaje.style.color = 'green';
      mensaje.textContent = jugadorAsignado
        ? `¡Registro exitoso! Te ha tocado: ${jugadorAsignado.nombre}. Redirigiendo al login...`
        : '¡Registro exitoso! Redirigiendo al login...';
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      form.reset();
    } catch (error) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error al registrar: ' + (error.message || error.code);
    }
  });
  } catch (error) {
    console.error('Error al inicializar:', error);
    if (mensaje) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error al inicializar la aplicación. Por favor, recarga la página.';
    }
  }
});
