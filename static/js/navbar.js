function abrirMenuMovil() {
    const menu = document.getElementById("mobileMenu");
    const overlay = document.getElementById("mobileOverlay");
    const btn = document.getElementById("hamburgerBtn");
    const icon = document.getElementById("hamburgerIcon");

    menu.classList.add("active");
    overlay.classList.add("active");
    document.body.classList.add("menu-open");

    if (btn) btn.setAttribute("aria-expanded", "true");
    if (icon) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");
    }
}

function cerrarMenuMovil() {
    const menu = document.getElementById("mobileMenu");
    const overlay = document.getElementById("mobileOverlay");
    const btn = document.getElementById("hamburgerBtn");
    const icon = document.getElementById("hamburgerIcon");

    menu.classList.remove("active");
    overlay.classList.remove("active");
    document.body.classList.remove("menu-open");

    if (btn) btn.setAttribute("aria-expanded", "false");
    if (icon) {
        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById("mobileMenu");
    if (menu.classList.contains("active")) {
        cerrarMenuMovil();
    } else {
        abrirMenuMovil();
    }
}

document.addEventListener("DOMContentLoaded", function () {

    const hamburgerBtn = document.getElementById("hamburgerBtn");
    const overlay = document.getElementById("mobileOverlay");

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener("click", toggleMobileMenu);
    }

    // Cerrar al tocar el fondo oscuro
    if (overlay) {
        overlay.addEventListener("click", cerrarMenuMovil);
    }

    // Cerrar al elegir una opción del menú
    document.querySelectorAll(".mobile-menu a").forEach(link => {
        link.addEventListener("click", cerrarMenuMovil);
    });

    // Cerrar con la tecla Escape
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") cerrarMenuMovil();
    });

    // Si la pantalla crece y deja de ser "móvil", asegurar que quede cerrado
    window.addEventListener("resize", function () {
        if (window.innerWidth > 850) cerrarMenuMovil();
    });

});