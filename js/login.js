// js/login.js
// Login de usuarios usando Firestore
import { db } from '../firebase/firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('login-form');
  const mensaje = document.getElementById('login-mensaje');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const usuariosRef = collection(db, 'usuariosPBM');
      const q = query(usuariosRef, where('username', '==', username), where('password', '==', password));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        mensaje.style.color = 'green';
        mensaje.textContent = '¡Login exitoso! Redirigiendo...';
        setTimeout(() => {
          window.location.href = 'fantasy.html';
        }, 1200);
      } else {
        mensaje.style.color = 'red';
        mensaje.textContent = 'Usuario o contraseña incorrectos.';
      }
    } catch (error) {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Error al iniciar sesión: ' + error.message;
    }
  });
});
