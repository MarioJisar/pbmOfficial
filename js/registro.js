// js/registro.js
// Registro de usuarios usando Firestore
import { db } from '../firebase/firebase-config.js';
import { collection, query, where, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Cargar jugadores disponibles (solo nombres)
let jugadoresDisponibles = [];
fetch('../json/jugadores.json')
  .then(res => res.json())
  .then(data => {
    jugadoresDisponibles = data.map(j => j.nombre);
  });

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('registro-form');
  const mensaje = document.getElementById('registro-mensaje');

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
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: nombre });

      // Asignar jugador aleatorio válido de jugadores.json
      let plantilla = [];
      let jugadorValido = null;
      if (Array.isArray(jugadoresDisponibles) && jugadoresDisponibles.length > 0) {
        const idx = Math.floor(Math.random() * jugadoresDisponibles.length);
        jugadorValido = jugadoresDisponibles[idx];
        plantilla = [jugadorValido];
      }

      // Inicializar presupuesto y mercado
      const presupuesto = 100; // O el valor inicial que uses
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
      mensaje.textContent = jugadorValido
        ? `¡Registro exitoso! Te ha tocado: ${jugadorValido}. Redirigiendo al login...`
        : '¡Registro exitoso! Redirigiendo al login...';
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
      form.reset();
    } catch (error) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error al registrar: ' + (error.message || error.code);
    }
  });
});
