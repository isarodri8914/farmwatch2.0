document.addEventListener("DOMContentLoaded", () => {

    function showAlert(el, message) {
        if (!el) { alert(message); return; }
        el.textContent = message;
        el.hidden = false;
    }

    function hideAlert(el) {
        if (!el) return;
        el.hidden = true;
        el.textContent = "";
    }

    function setLoading(btn, loading, idleText) {
        if (!btn) return;
        btn.disabled = loading;
        const label = btn.querySelector(".btn-primary__text");
        if (label) label.textContent = loading ? "Ingresando..." : idleText;
    }

    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        const alertEl = document.getElementById("authAlert");
        const loginBtn = document.getElementById("loginBtn");

        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            hideAlert(alertEl);

            const correo = document.getElementById("username").value.trim();
            const pass = document.getElementById("password").value;

            if (!correo || !pass) {
                showAlert(alertEl, "Ingresa tu usuario y contraseña.");
                return;
            }

            setLoading(loginBtn, true, "Iniciar sesión");

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
                    showAlert(alertEl, result.error || "Correo o contraseña incorrectos.");
                    setLoading(loginBtn, false, "Iniciar sesión");
                }
            } catch (err) {
                showAlert(alertEl, "No pudimos conectar con el servidor. Intenta de nuevo.");
                setLoading(loginBtn, false, "Iniciar sesión");
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