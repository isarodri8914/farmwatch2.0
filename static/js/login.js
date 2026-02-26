document.addEventListener("DOMContentLoaded", () => {
    // Manejo de Login
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const correo = document.getElementById("username").value; // Input de usuario/correo
            const pass = document.getElementById("password").value;

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, password: pass })
            });

            const result = await response.json();
            if (response.ok) {
                window.location.href = result.redirect;
            } else {
                alert("Error: " + result.error);
            }
        });
    }

    // Manejo de Registro
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const nombre = document.getElementById("reg-nombre").value;
            const correo = document.getElementById("reg-correo").value;
            const pass = document.getElementById("reg-pass").value;

            const response = await fetch('/api/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, correo, password: pass })
            });

            const result = await response.json();
            if (response.ok) {
                alert("¡Cuenta creada! Ahora inicia sesión.");
                window.location.href = "/";
            } else {
                alert("Error: " + result.error);
            }
        });
    }
});