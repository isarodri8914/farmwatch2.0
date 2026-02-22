document.addEventListener("DOMContentLoaded", () => {

  let map;
  let markers = [];

  function initMap() {
    map = L.map("map", { scrollWheelZoom: false })
      .setView([19.4325, -99.1332], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(map);
  }

  async function loadDashboard() {
    const res = await fetch("/api/dashboard");
    const data = await res.json();

    if (!data.cows) return;

    const cows = data.cows;

    document.getElementById("stat-total").innerText = cows.length;
    document.getElementById("stat-alerts").innerText =
      cows.filter(c => c.status === "alert").length;
    document.getElementById("stat-offline").innerText =
      cows.filter(c => c.status === "offline").length;
    document.getElementById("stat-updated").innerText =
      data.last_update;

    document.getElementById("sys-sensors").innerText =
      cows.filter(c => c.status === "ok").length + " / " + cows.length;

    // ALERTAS
    const alertsList = document.getElementById("alertsList");
    alertsList.innerHTML = "";
    data.alerts.forEach(a => {
      const li = document.createElement("li");
      li.innerHTML = `<div>${a.cow} — ${a.text}</div>`;
      alertsList.appendChild(li);
    });

    // MAPA
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    cows.forEach(c => {

      const color =
        c.status === "ok" ? "#10b981" :
        c.status === "alert" ? "#f97316" :
        "#9ca3af";

      const marker = L.circleMarker([c.lat, c.lng], {
        radius: 10,
        color: color,
        fillColor: color,
        fillOpacity: 0.8
      }).addTo(map);

      marker.bindPopup(`
        <b>${c.name}</b><br>
        Temp: ${c.temp} °C<br>
        HR: ${c.hr} bpm<br>
        Estado: ${c.status}
      `);

      markers.push(marker);
    });
  }

  initMap();
  loadDashboard();
  setInterval(loadDashboard, 5000);

});