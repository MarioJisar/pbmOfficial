// js/login.js
// Login de usuarios usando localStorage

document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('login-form');
  const mensaje = document.getElementById('login-mensaje');

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    let usuarios = JSON.parse(localStorage.getItem('usuariosPBM')) || [];
    const usuario = usuarios.find(u => u.username === username && u.password === password);

    if (usuario) {
      localStorage.setItem('usuarioLogueadoPBM', JSON.stringify(usuario));
      mensaje.style.color = 'green';
      mensaje.textContent = '¡Login exitoso! Redirigiendo...';
      setTimeout(() => {
        window.location.href = 'fantasy.html';
      }, 1200);
    } else {
      mensaje.style.color = 'red';
      mensaje.textContent = 'Usuario o contraseña incorrectos.';
    }
  });
});
