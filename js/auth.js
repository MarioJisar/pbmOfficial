// js/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const registerBtn = document.getElementById("register-btn");
const authMsg = document.getElementById("auth-msg");

// Iniciar sesión
loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    signInWithEmailAndPassword(getAuth, email, password)
        .then((userCredential) => {
            authMsg.style.color = "green";
            authMsg.textContent = "Inicio de sesión exitoso";
            // Redirige a otra página si quieres
            window.location.href = "fantasy.html";
        })
        .catch((error) => {
            authMsg.textContent = "Error al iniciar sesión: " + error.message;
        });
});

// Registrarse
registerBtn.addEventListener("click", () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            authMsg.style.color = "green";
            authMsg.textContent = "Registro exitoso. Ya puedes iniciar sesión.";
        })
        .catch((error) => {
            authMsg.textContent = "Error al registrarse: " + error.message;
        });
});
// Limpiar mensajes al cambiar de campo
emailInput.addEventListener("input", () => {
    authMsg.textContent = "";
});