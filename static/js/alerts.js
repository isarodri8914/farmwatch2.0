document.addEventListener("DOMContentLoaded", () => {

    // --- Selección de listas ---
    const listaSistema = document.getElementById("listaSistema");
    const listaVacas = document.getElementById("listaVacas");
    const listaSensores = document.getElementById("listaSensores");

    // --- Mockup Datos ---
    // ⚠️ Alertas del sistema
    const sistemaAlertas = [
        { mensaje: "⚠️ Conexión con Cloud SQL inestable", nivel: "warning", hora: ahora() },
        { mensaje: "❌ Cloud SQL desconectado", nivel: "critical", hora: ahora() }
    ];

    // 🐄 Alertas de vacas
    const alertasVacas = [
        { vaca: "Vaca 03", tipo: "Temperatura Alta", nivel: "critical", valor: "41.2 °C", hora: ahora() },
        { vaca: "Vaca 12", tipo: "Ritmo cardiaco elevado", nivel: "warning", valor: "128 BPM", hora: ahora() },
        { vaca: "Vaca 22", tipo: "Sin movimiento detectado (30 min)", nivel: "critical", hora: ahora() }
    ];

    // 📡 Alertas de sensores
    const alertasSensores = [
        { sensor: "Sensor 01", tipo: "Batería baja", nivel: "warning", hora: ahora() },
        { sensor: "Sensor 08", tipo: "Desconectado", nivel: "critical", hora: ahora() },
        { sensor: "Sensor 10", tipo: "Señal débil", nivel: "warning", hora: ahora() }
    ];

    // --- Renderización ---
    sistemaAlertas.forEach(alert => {
        listaSistema.appendChild(crearAlerta(alert.mensaje, alert.nivel, alert.hora));
    });

    alertasVacas.forEach(a => {
        listaVacas.appendChild(
            crearAlerta(`🐄 ${a.vaca} — ${a.tipo}${a.valor ? " (" + a.valor + ")" : ""}`, a.nivel, a.hora)
        );
    });

    alertasSensores.forEach(s => {
        listaSensores.appendChild(
            crearAlerta(`📡 ${s.sensor} — ${s.tipo}`, s.nivel, s.hora)
        );
    });
});


//HOLA
function crearAlerta(texto, nivel, hora) {
    const div = document.createElement("li");
    div.className = `alert-item ${nivel}`;

    div.innerHTML = `
        <p class="alert-text">${texto}</p>
        <p class="alert-time">${hora}</p>
    `;

    return div;
}

function ahora() {
    const d = new Date();
    return d.toLocaleString();
}
