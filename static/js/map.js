document.addEventListener("DOMContentLoaded", () => {
  // Mapa principal
  const map = L.map("map").setView([19.4326, -99.1332], 13); // Centro en CDMX o tu zona
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Lista de vacas y búsqueda
  const cowList = document.getElementById("cowList");
  const cowSearch = document.getElementById("cowSearch");

  let vacas = []; // Se llenará desde la API

  // Cargar vacas desde API (tu endpoint /api/dashboard o /api/vacas)
  async function loadVacas() {
    try {
      const res = await fetch("/api/dashboard"); // o "/api/vacas" si tienes uno específico
      const data = await res.json();
      vacas = data.cows || []; // Asumiendo que /api/dashboard devuelve { cows: [...] }

      renderCowList(vacas);
      renderMarkers(vacas);
    } catch (err) {
      console.error("Error cargando vacas:", err);
      cowList.innerHTML = "<li>Error al cargar vacas</li>";
    }
  }

  // Renderizar lista de vacas
  function renderCowList(vacasFiltradas) {
    cowList.innerHTML = "";
    vacasFiltradas.forEach(v => {
      const li = document.createElement("li");
      li.textContent = v.name || `Vaca ${v.id}`;
      li.onclick = () => openCowModal(v);
      cowList.appendChild(li);
    });
  }

  // Renderizar pines en el mapa con color según estado
  function renderMarkers(vacas) {
    vacas.forEach(v => {
      if (!v.lat || !v.lng) return;

      const color = v.status === "ok" ? "#10b981" : 
                    v.status === "alert" ? "#f97316" : "#9ca3af";

      const marker = L.circleMarker([v.lat, v.lng], {
        radius: 11,
        color: color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 2
      }).addTo(map);

      marker.bindPopup(`
        <b>${v.name || "Vaca " + v.id}</b><br>
        Temp: ${v.temp ?? "--"} °C<br>
        Ritmo: ${v.hr ?? "--"} bpm<br>
        Estado: <strong>${v.status}</strong>
      `);

      marker.on("click", () => openCowModal(v));
    });
  }

  // Filtro de búsqueda en tiempo real
  cowSearch.addEventListener("input", function () {
    const text = this.value.toLowerCase();
    const filtradas = vacas.filter(v => 
      (v.name || `Vaca ${v.id}`).toLowerCase().includes(text)
    );
    renderCowList(filtradas);
  });

  // Modal
  function openCowModal(vaca) {
    document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;
    document.getElementById("cowModal").style.display = "block";

    updateCowData(vaca.id); // Primera carga
    const interval = setInterval(() => updateCowData(vaca.id), 3000);

    // Cerrar modal también limpia intervalo
    const closeModal = () => {
      document.getElementById("cowModal").style.display = "none";
      clearInterval(interval);
    };

    document.getElementById("closeModal").onclick = closeModal;
    document.querySelector(".modal").onclick = (e) => {
      if (e.target === document.querySelector(".modal")) closeModal();
    };
  }

  // Actualizar datos del modal + mini gráficas
  let chartTemp, chartHR;
  async function updateCowData(id) {
    try {
      // Simulamos llamada a API (cambia por tu endpoint real, ej: /api/vaca/<id>)
      // const res = await fetch(`/api/vaca/${id}`);
      // const data = await res.json();

      // Datos de prueba (reemplaza con data real cuando tengas el endpoint)
      const data = {
        temperatura: (Math.random() * 10 + 35).toFixed(1),  // 35-45 °C
        ritmo: Math.floor(Math.random() * 60 + 60),         // 60-120 bpm
        actividad: "Normal",
        ubicacion: "Calle 45, Mérida",
        estado: Math.random() > 0.7 ? "Alerta" : "OK"
      };

      document.getElementById("m_temp").textContent = data.temperatura;
      document.getElementById("m_hr").textContent = data.ritmo;
      document.getElementById("m_act").textContent = data.actividad;
      document.getElementById("m_loc").textContent = data.ubicacion;
      document.getElementById("m_state").textContent = data.estado;

      // Actualizar gráficas (agregar nuevo punto)
      const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      chartTemp.data.labels.push(now);
      chartTemp.data.datasets[0].data.push(data.temperatura);
      chartHR.data.labels.push(now);
      chartHR.data.datasets[0].data.push(data.ritmo);

      // Limitar a últimos 20 puntos para que no se sature
      if (chartTemp.data.labels.length > 20) {
        chartTemp.data.labels.shift();
        chartTemp.data.datasets[0].data.shift();
      }
      if (chartHR.data.labels.length > 20) {
        chartHR.data.labels.shift();
        chartHR.data.datasets[0].data.shift();
      }

      chartTemp.update();
      chartHR.update();

    } catch (err) {
      console.error("Error actualizando datos vaca:", err);
    }
  }

  // Crear mini gráficas vacías al abrir modal
  function createCharts() {
    const ctxTemp = document.getElementById("chartTemp");
    const ctxHR = document.getElementById("chartHR");

    chartTemp = new Chart(ctxTemp, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Temperatura (°C)",
          data: [],
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: 30, suggestedMax: 45 } }
      }
    });

    chartHR = new Chart(ctxHR, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Ritmo cardíaco (bpm)",
          data: [],
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.15)",
          tension: 0.3,
          fill: true,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { suggestedMin: 40, suggestedMax: 120 } }
      }
    });
  }

  // Carga inicial
  loadVacas();

  // Crear gráficas cuando se abre modal (solo una vez)
  document.getElementById("cowModal").addEventListener("shown", createCharts, { once: true });
});