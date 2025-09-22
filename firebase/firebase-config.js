
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
    getFirestore, 
    enableIndexedDbPersistence, 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    getDocs, 
    writeBatch,
    arrayUnion,
    arrayRemove
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhILwOFVq14nGlg5MYm7eLDuOKy_IdNfA",
  authDomain: "pbmofficial-a22a1.firebaseapp.com",
  projectId: "pbmofficial-a22a1",
  storageBucket: "pbmofficial-a22a1.firebasestorage.app",
  messagingSenderId: "982178990497",
  appId: "1:982178990497:web:13f9575e1f90f84a6263e0",
  measurementId: "G-95G6CVQ0KE"
};

// Initialize Firebase inmediatamente
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Verificar estado de autenticación
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('Usuario autenticado:', user.email);
    } else {
        console.log('Usuario no autenticado');
        // Si no estamos en la página de login, redirigir
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html';
        }
    }
});

// Asegurar que Firebase esté inicializado
let firebaseInitialized = false;

// Inicializar Firebase de forma síncrona
function initializeFirebase() {
    if (firebaseInitialized) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
        try {
            if (!app || !auth || !db) {
                reject(new Error('Firebase no está correctamente inicializado'));
                return;
            }

            // Esperar a que auth esté listo con timeout
            const timeout = setTimeout(() => {
                unsubscribe();
                reject(new Error('Timeout al inicializar Firebase'));
            }, 10000); // 10 segundos de timeout

            const unsubscribe = onAuthStateChanged(auth, () => {
                clearTimeout(timeout);
                unsubscribe();
                firebaseInitialized = true;
                console.log('Firebase inicializado exitosamente');
                resolve();
            }, (error) => {
                clearTimeout(timeout);
                unsubscribe();
                console.error('Error en la autenticación:', error);
                reject(error);
            });
        } catch (error) {
            console.error('Error al inicializar Firebase:', error);
            reject(error);
        }
    });
}

// Inicializar persistencia
try {
    // Habilitar persistencia offline
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Múltiples pestañas abiertas, persistencia deshabilitada');
        } else if (err.code === 'unimplemented') {
            console.warn('El navegador no soporta persistencia');
        }
    });
} catch (error) {
    console.error('Error inicializando Firebase:', error);
}

// Función para verificar estado de autenticación y asegurar inicialización
export async function waitForAuth() {
    await initializeFirebase(); // Asegurar que Firebase esté inicializado
    
    return new Promise((resolve) => {
        if (auth.currentUser) {
            resolve(auth.currentUser);
        } else {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        }
    });
}

// Exportar todo lo necesario
export {
    app,
    auth,
    db,
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    getDocs,
    writeBatch,
    arrayUnion,
    arrayRemove,
    initializeFirebase // Exportar la función de inicialización
};
