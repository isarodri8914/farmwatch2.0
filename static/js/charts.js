// === TEMPERATURA ===
new Chart(document.getElementById("lineChart"), {
    type: "line",
    data: {
        labels: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
        datasets: [{
            label: "Temperatura Promedio",
            data: [38.5, 38.7, 38.9, 39.1, 39.0, 38.8, 39.3, 39.4, 39.1, 38.8, 38.6, 38.5],
            borderWidth: 3,
            borderColor: "#e74a3b",
            fill: false
        }]
    }
});

// === ESTADOS DE SALUD ===
new Chart(document.getElementById("pieChart"), {
    type: "doughnut",
    data: {
        labels: ["Normal", "Alerta", "Crítico"],
        datasets: [{
            data: [70, 20, 10],
            backgroundColor: ["#1cc88a", "#f6c23e", "#e74a3b"]
        }]
    }
});
