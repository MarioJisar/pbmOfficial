import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { auth } from "../firebase/firebase-config.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const mensaje = document.getElementById("mensaje");

loginBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        mensaje.textContent = "¡Sesión iniciada!";
        mensaje.style.color = "green";

        // Redirigir al fantasy
        setTimeout(() => {
            window.location.href = "fantasy.html";
        }, 1000);

    } catch (error) {
        mensaje.textContent = `Error: ${error.message}`;
        mensaje.style.color = "red";
    }
});
// Limpiar mensajes al cambiar de campo
emailInput.addEventListener("input", () => {
    mensaje.textContent = "";
});