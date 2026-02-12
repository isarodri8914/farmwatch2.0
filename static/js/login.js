document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        let user = document.getElementById("admin").value.trim();
        let pass = document.getElementById("admin").value.trim();

        if (user === "" || pass === "") {
            alert("Ingrese usuario y contraseña.");
            return;
        }

        // Simulación login
        window.location.href = "dashboard.html";
    });
});
