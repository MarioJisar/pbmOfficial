// js/register.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { auth } from "../firebase/firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { db } from "../firebase/firebase-config.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const registerBtn = document.getElementById("register-btn");
const mensaje = document.getElementById("mensaje");

registerBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 🔐 Guardar en Firestore
        await setDoc(doc(db, "usuarios", user.uid), {
            email: user.email,
            creadoEn: new Date()
        });

        mensaje.textContent = "¡Usuario registrado y guardado!";
        mensaje.style.color = "green";
    } catch (error) {
        mensaje.textContent = `Error: ${error.message}`;
        mensaje.style.color = "red";
    }
});
// Limpiar mensajes al cambiar de campo
emailInput.addEventListener("input", () => {
    mensaje.textContent = "";
});