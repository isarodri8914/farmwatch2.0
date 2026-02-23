document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicializar Mapa Principal
  // Se añade zoomControl: true y un nivel de zoom inicial
  const map = L.map("map", { zoomControl: true }).setView([20.9754, -89.6169], 13);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  const cowList = document.getElementById("cowList");
  const cowSearch = document.getElementById("cowSearch");

  let vacas = [];
  let currentInterval = null;
  let currentModalMap = null;
  let chartTemp = null;
  let chartHR = null;

  // Cargar vacas desde API
  async function loadVacas() {
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      vacas = data.cows || [];

      renderCowList(vacas);
      renderMarkers(vacas);
    } catch (err) {
      console.error("Error cargando vacas:", err);
      cowList.innerHTML = "<li>Error al cargar</li>";
    }
  }

  function renderCowList(vacasFiltradas) {
    cowList.innerHTML = "";
    vacasFiltradas.forEach(v => {
      const li = document.createElement("li");
      li.textContent = v.name || `Vaca ${v.id}`;
      li.style.cursor = "pointer";
      // Al hacer clic, abre modal y mueve el mapa
      li.addEventListener("click", () => openCowModal(v));
      cowList.appendChild(li);
    });
  }

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

  // Búsqueda
  cowSearch.addEventListener("input", function () {
    const text = this.value.toLowerCase();
    const filtradas = vacas.filter(v => 
      (v.name || `Vaca ${v.id}`).toLowerCase().includes(text)
    );
    renderCowList(filtradas);
  });

  // --- FUNCIÓN PARA ABRIR MODAL Y UBICAR VACA ---
  function openCowModal(vaca) {
    // ESTO MUEVE EL MAPA PRINCIPAL A LA POSICIÓN DE LA VACA
    if (vaca.lat && vaca.lng) {
        map.setView([vaca.lat, vaca.lng], 16); 
    }

    document.getElementById("modalName").textContent = vaca.name || `Vaca ${vaca.id}`;
    
    // Mostramos el modal (Asegúrate de tener el CSS que te pasé antes)
    const modal = document.getElementById("cowModal");
    modal.style.display = "flex"; 

    // Datos iniciales
    document.getElementById("m_temp").textContent = vaca.temp ?? "--";
    document.getElementById("m_hr").textContent = vaca.hr ?? "--";
    document.getElementById("m_act").textContent = "Normal";
    document.getElementById("m_loc").textContent = "Mérida, Yucatán";
    document.getElementById("m_state").textContent = vaca.status || "OK";

    // Reiniciar mini-mapa del modal
    if (currentModalMap) currentModalMap.remove();
    currentModalMap = L.map("modalMiniMap", {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false
    }).setView([vaca.lat || 20.9754, vaca.lng || -89.6169], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(currentModalMap);

    L.circleMarker([vaca.lat || 20.9754, vaca.lng || -89.6169], {
      radius: 8,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.8
    }).addTo(currentModalMap);

    // Crear gráficas
    createMiniCharts();

    // Actualización en tiempo real (simulada)
    if (currentInterval) clearInterval(currentInterval);
    currentInterval = setInterval(() => updateCowData(vaca.id), 3000);
    updateCowData(vaca.id); 
  }

  // Cerrar modal
  function closeCowModal() {
    document.getElementById("cowModal").style.display = "none";
    if (currentInterval) clearInterval(currentInterval);
    if (currentModalMap) currentModalMap.remove();
    if (chartTemp) chartTemp.destroy();
    if (chartHR) chartHR.destroy();
  }

  document.getElementById("closeModal").onclick = closeCowModal;
  
  // Cerrar al hacer clic fuera del contenido blanco
  window.onclick = (event) => {
    const modal = document.getElementById("cowModal");
    if (event.target == modal) {
        closeCowModal();
    }
  };

  async function updateCowData(id) {
    try {
      // Simulación de datos nuevos
      const data = {
        temperatura: (Math.random() * 2 + 37).toFixed(1),
        ritmo: Math.floor(Math.random() * 20 + 70),
        actividad: "Pastando",
        ubicacion: "Sector Norte",
        estado: "OK"
      };

      document.getElementById("m_temp").textContent = data.temperatura;
      document.getElementById("m_hr").textContent = data.ritmo;
      document.getElementById("m_act").textContent = data.actividad;
      document.getElementById("m_state").textContent = data.estado;

      const now = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});

      chartTemp.data.labels.push(now);
      chartTemp.data.datasets[0].data.push(data.temperatura);

      chartHR.data.labels.push(now);
      chartHR.data.datasets[0].data.push(data.ritmo);

      if (chartTemp.data.labels.length > 10) {
        chartTemp.data.labels.shift();
        chartTemp.data.datasets[0].data.shift();
        chartHR.data.labels.shift();
        chartHR.data.datasets[0].data.shift();
      }

      chartTemp.update();
      chartHR.update();

    } catch (err) {
      console.error("Error en update:", err);
    }
  }

  function createMiniCharts() {
    const ctxTemp = document.getElementById("chartTemp");
    const ctxHR = document.getElementById("chartHR");

    chartTemp = new Chart(ctxTemp, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "Temp",
          data: [],
          borderColor: "#ef4444",
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(239,68,68,0.1)"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    chartHR = new Chart(ctxHR, {
      type: "line",
      data: {
        labels: [],
        datasets: [{
          label: "HR",
          data: [],
          borderColor: "#3b82f6",
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(59,130,246,0.1)"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  loadVacas();
});