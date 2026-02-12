// dashboard.js - Apple style dashboard with mock data
document.addEventListener("DOMContentLoaded", () => {

  /* -------------------
     MOCK DATA (replace with API later)
  ------------------- */
  const cows = [
    { id: 101, name: "Vaca 101", lat: 19.4325, lng: -99.1332, temp: 38.6, hr: 72, status: "ok" },
    { id: 102, name: "Vaca 102", lat: 19.4330, lng: -99.1320, temp: 39.7, hr: 96, status: "alert" },
    { id: 103, name: "Vaca 103", lat: 19.4318, lng: -99.1340, temp: 37.9, hr: 68, status: "ok" },
    { id: 104, name: "Vaca 104", lat: 19.4342, lng: -99.1311, temp: 40.1, hr: 102, status: "alert" },
    { id: 105, name: "Vaca 105", lat: 19.4350, lng: -99.1305, temp: 38.0, hr: 71, status: "offline" }
  ];

  const sensors = [
    { id: "S1", name: "MAX30100", status: "ok" },
    { id: "S2", name: "MLX90614", status: "ok" },
    { id: "S3", name: "MPU6050", status: "warn" },
    { id: "S4", name: "GPS NEO6MV2", status: "warn" },
    { id: "S5", name: "ESP32", status: "ok" }
  ];

  const alerts = [
    { cow: "Vaca 104", text: "Temperatura crítica 40.1°C", time: "2 min" },
    { cow: "Vaca 102", text: "Ritmo alto 96 bpm", time: "7 min" },
    { cow: "Vaca 105", text: "Sensor sin señal", time: "12 min" }
  ];

  /* -------------------
     TOP METRICS
  ------------------- */
  const total = cows.length;
  const alertCount = cows.filter(c => c.status === "alert").length;
  const offlineCount = cows.filter(c => c.status === "offline").length;
  const battLow = sensors.filter(s => s.status === "warn").length;
  const lastUpdated = new Date().toLocaleString();

  document.getElementById("stat-total").innerText = total;
  document.getElementById("stat-alerts").innerText = alertCount;
  document.getElementById("stat-offline").innerText = offlineCount;
  document.getElementById("stat-battlow").innerText = battLow;
  document.getElementById("stat-updated").innerText = lastUpdated;

  document.getElementById("sys-sensors").innerText = sensors.filter(s => s.status === "ok").length + " / " + sensors.length;

  // system mock
  document.getElementById("sys-db").innerText = "Conectado";
  document.getElementById("sys-api").innerText = "OK";

  /* -------------------
     Alerts list
  ------------------- */
  const alertsList = document.getElementById("alertsList");
  alerts.forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="left">${a.cow} — ${a.text}</div><div class="right">${a.time}</div>`;
    alertsList.appendChild(li);
  });

  /* -------------------
     Charts (Chart.js)
  ------------------- */
  // hours labels
  const hours = [...Array(12)].map((_, i) => {
    const d = new Date();
    d.setHours(d.getHours() - (11 - i));
    return `${d.getHours()}:00`;
  });

  // generate temp & hr arrays (average across cows with some noise)
  const tempData = hours.map((_,i) => {
    let base = 38.5 + Math.sin(i/3)*0.6;
    return +(base + (Math.random()-0.5)*0.4).toFixed(2);
  });

  const hrData = hours.map((_,i) => {
    let base = 74 + Math.cos(i/2.2)*6;
    return Math.round(base + (Math.random()-0.5)*4);
  });

  const tempCtx = document.getElementById("tempChart").getContext("2d");
  const hrCtx = document.getElementById("hrChart").getContext("2d");

  const tempChart = new Chart(tempCtx, {
    type: "line",
    data: { labels: hours, datasets: [{ label: "°C", data: tempData, fill: true, backgroundColor: "rgba(239,68,68,0.08)", borderColor: "#ef4444", tension:0.35 }]},
    options: { plugins:{ legend:{ display:false } }, scales:{ y:{ suggestedMin:36.5, suggestedMax:42 }}}
  });

  const hrChart = new Chart(hrCtx, {
    type: "line",
    data: { labels: hours, datasets: [{ label: "BPM", data: hrData, fill:true, backgroundColor: "rgba(37,99,235,0.06)", borderColor: "#2563eb", tension:0.35 }]},
    options: { plugins:{ legend:{ display:false } } }
  });

  // Donut: cows
  const cowCounts = {
    ok: cows.filter(c=>c.status==="ok").length,
    alert: cows.filter(c=>c.status==="alert").length,
    offline: cows.filter(c=>c.status==="offline").length
  };
  const cowDonutCtx = document.getElementById("cowDonut").getContext("2d");
  new Chart(cowDonutCtx, {
    type: "doughnut",
    data: {
      labels: ["Saludable","Alerta","Offline"],
      datasets:[{ data:[cowCounts.ok,cowCounts.alert,cowCounts.offline], backgroundColor:["#10b981","#f97316","#ef4444"] }]
    },
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  // Donut: sensors
  const sensorCounts = {
    ok: sensors.filter(s=>s.status==="ok").length,
    warn: sensors.filter(s=>s.status==="warn").length,
    off: 0
  };
  const sensorDonutCtx = document.getElementById("sensorDonut").getContext("2d");
  new Chart(sensorDonutCtx, {
    type: "doughnut",
    data: { labels:["OK","Advertencia","Offline"], datasets:[{ data:[sensorCounts.ok,sensorCounts.warn,sensorCounts.off], backgroundColor:["#10b981","#f59e0b","#9ca3af"] }]},
    options:{ plugins:{ legend:{ position:'bottom' } } }
  });

  /* -------------------
     Map (Leaflet) - nice markers + cow icon
  ------------------- */
  const avgLat = cows.reduce((s,c)=>s+c.lat,0)/cows.length;
  const avgLng = cows.reduce((s,c)=>s+c.lng,0)/cows.length;
  const map = L.map("map", {scrollWheelZoom:false}).setView([avgLat, avgLng], 15);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"" }).addTo(map);

  // cow icon: put image at static/img/cow.png
  const cowIcon = L.icon({ iconUrl:"/static/img/cow.png", iconSize:[42,42], iconAnchor:[21,42], popupAnchor:[0,-36] });

  // add markers with colored halo by status
  cows.forEach(c => {
    const marker = L.marker([c.lat,c.lng], { icon: cowIcon }).addTo(map);
    const statusLabel = c.status==="ok" ? "Saludable" : (c.status==="alert" ? "Alerta" : "Offline");
    marker.bindPopup(`<b>${c.name}</b><br>Temp: ${c.temp} °C<br>HR: ${c.hr} bpm<br>Status: ${statusLabel}`);
    // small colored circle behind marker (use circle)
    const color = c.status==="ok" ? "#10b981" : (c.status==="alert" ? "#f97316" : "#9ca3af");
    L.circle([c.lat,c.lng], { radius: 20, color: color, fillColor: color, fillOpacity: 0.12, weight:0 }).addTo(map);
  });

  /* -------------------
     OPTIONAL: refresh demo data (every 60s)
  ------------------- */
  // setInterval(() => { /* fetch API, update charts & map markers */ }, 60000);

}); // DOMContentLoaded
