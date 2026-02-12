// ===== UTILIDADES GLOBALES =====
function formatDate(date = new Date()) {
    return date.toLocaleString("es-MX", {
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}

console.log("FarmWatch Iniciado");
