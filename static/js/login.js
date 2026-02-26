document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const correo = document.getElementById("username").value;
            const pass = document.getElementById("password").value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, password: pass })
                });

                const result = await response.json();
                if (response.ok) {
                    window.location.href = result.redirect; // Solo entra si el servidor dice OK
                } else {
                    alert("Error: " + result.error); // Aquí te dirá por qué no entras
                }
            } catch (err) {
                alert("Error de conexión con el servidor");
            }
        });
    }

    const regForm = document.getElementById("register-form");
    if (regForm) {
        regForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = {
                nombre: document.getElementById("reg-nombre").value,
                correo: document.getElementById("reg-correo").value,
                password: document.getElementById("reg-pass").value
            };

            const response = await fetch('/api/registrar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert("¡Usuario registrado con éxito!");
                window.location.href = "/";
            } else {
                const error = await response.json();
                alert("Fallo en el registro: " + error.error);
            }
        });
    }
});