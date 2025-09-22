// js/login.js
import { 
    auth,
    initializeFirebase 
} from '../firebase/firebase-config.js';
import { 
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Inicializar Firebase
        await initializeFirebase();
        
        // Configurar persistencia de autenticación
        await setPersistence(auth, browserLocalPersistence);
        
        const form = document.getElementById('login-form');
        const mensaje = document.getElementById('login-mensaje');

        // Si ya está autenticado, redirigir a fantasy.html
        if (auth.currentUser) {
            window.location.href = 'fantasy.html';
            return;
        }

        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = form.username.value.trim();
            const password = form.password.value;

            try {
                mensaje.textContent = 'Iniciando sesión...';
                mensaje.style.color = 'blue';

                // Intentar autenticación
                await signInWithEmailAndPassword(auth, email, password);

                mensaje.style.color = 'green';
                mensaje.textContent = '¡Login exitoso! Redirigiendo...';
                
                // Redirigir después de un breve delay
                setTimeout(() => {
                    window.location.href = 'fantasy.html';
                }, 1000);

            } catch (error) {
                console.error('Error de autenticación:', error);
                mensaje.style.color = 'red';
                
                // Mensajes de error amigables
                switch (error.code) {
                    case 'auth/invalid-email':
                        mensaje.textContent = 'El correo electrónico no es válido.';
                        break;
                    case 'auth/user-disabled':
                        mensaje.textContent = 'Esta cuenta ha sido deshabilitada.';
                        break;
                    case 'auth/user-not-found':
                        mensaje.textContent = 'No existe una cuenta con este correo.';
                        break;
                    case 'auth/wrong-password':
                        mensaje.textContent = 'Contraseña incorrecta.';
                        break;
                    default:
                        mensaje.textContent = 'Error al iniciar sesión: ' + error.message;
                }
            }
        });
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        const mensaje = document.getElementById('login-mensaje');
        if (mensaje) {
            mensaje.style.color = 'red';
            mensaje.textContent = 'Error al inicializar la aplicación. Por favor, recarga la página.';
        }
    }
});
