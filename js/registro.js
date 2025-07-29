// js/registro.js
// Registro de usuarios usando localStorage

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('registro-form');
  const mensaje = document.getElementById('registro-mensaje');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    if (!username || !password) {
      mensaje.textContent = 'Por favor, completa todos los campos.';
      return;
    }

    let usuarios = JSON.parse(localStorage.getItem('usuariosPBM')) || [];
    if (usuarios.find(u => u.username === username)) {
      mensaje.textContent = 'El usuario ya existe.';
      return;
    }

    usuarios.push({ username, password });
    localStorage.setItem('usuariosPBM', JSON.stringify(usuarios));
    mensaje.style.color = 'green';
    mensaje.textContent = '¡Registro exitoso! Ahora puedes iniciar sesión.';
    form.reset();
  });
});
