let map;
let ruta;
let marcadores = [];
let tempChart;
let hrChart;
let reporteActual = null;

// Paginación de la tabla
const FILAS_POR_PAGINA = 8;
let filasTabla = [];
let paginaActual = 1;

document.addEventListener("DOMContentLoaded", function () {

  document.getElementById("generar").onclick = generarInforme;
  document.getElementById("exportPDF").onclick = exportPDF;
  document.getElementById("prevPage").onclick = () => cambiarPagina(-1);
  document.getElementById("nextPage").onclick = () => cambiarPagina(1);

  cargarVacas();

});

function mostrarEstado(estado) {
  // estado: "empty" | "loading" | "content"
  document.getElementById("emptyState").hidden = estado !== "empty";
  document.getElementById("loadingState").hidden = estado !== "loading";
  document.getElementById("reportContent").hidden = estado !== "content";
}

async function generarInforme() {

  const vaca = document.getElementById("vaca").value;
  const inicio = document.getElementById("inicio").value;
  const fin = document.getElementById("fin").value;

  const btnGenerar = document.getElementById("generar");
  const btnExport = document.getElementById("exportPDF");

  btnGenerar.disabled = true;
  btnExport.disabled = true;
  mostrarEstado("loading");

  try {

    const res = await fetch(`/api/reporte?vaca=${vaca}&inicio=${inicio}&fin=${fin}`);
    let data;

    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text();
      console.error("Respuesta NO JSON:", text);
      throw new Error("El servidor no devolvió JSON");
    }

    if (data.error) {
      alert(data.error);
      mostrarEstado("empty");
      return;
    }

    reporteActual = data;

    mostrarAnalisis(data);
    crearGraficas(data.datos);
    crearMapa(data.datos);
    prepararTabla(data.datos);

    mostrarEstado("content");
    btnExport.disabled = false;

    const ahora = new Date();
    document.getElementById("headerStatus").textContent =
      "Actualizado " + ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("liveDot").classList.add("live");

  } catch (e) {

    console.error("Error generando informe", e);
    alert("Error al generar informe");
    mostrarEstado("empty");

  } finally {
    btnGenerar.disabled = false;
  }

}

function claseEstado(texto) {
  const t = (texto || "").toLowerCase();
  if (t.includes("alerta") || t.includes("critico") || t.includes("crítico") || t.includes("peligro")) {
    return "status-danger";
  }
  if (t.includes("precauc") || t.includes("atenci")) {
    return "status-warning";
  }
  return "";
}

function mostrarAnalisis(data) {

  document.getElementById("analisis").innerText = data.analisis;

  document.getElementById("temp_avg").innerText = Number(data.estadisticas.temp_avg).toFixed(2);
  document.getElementById("temp_max").innerText = Number(data.estadisticas.temp_max).toFixed(2);
  document.getElementById("hr_avg").innerText = Number(data.estadisticas.hr_avg).toFixed(2);
  document.getElementById("hr_max").innerText = Number(data.estadisticas.hr_max).toFixed(2);

  const estadoTexto = data.estadisticas.estado;
  document.getElementById("estado").innerText = estadoTexto;

  const cardEstado = document.getElementById("card_estado");
  cardEstado.classList.remove("status-danger", "status-warning");
  const clase = claseEstado(estadoTexto);

  const banner = document.getElementById("alertBanner");
  if (clase) {
    cardEstado.classList.add(clase);
    if (clase === "status-danger") {
      document.getElementById("alertText").textContent =
        "Este animal presenta un estado de alerta: " + estadoTexto + ". Revisa el análisis y los registros recientes.";
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  } else {
    banner.hidden = true;
  }

  let analisisTexto = data.analisis;

  if (data.movimiento) {
    analisisTexto += "\n\nDistancia recorrida: " + data.movimiento.distancia_km.toFixed(2) + " km";

    const badge = document.getElementById("distanciaBadge");
    badge.textContent = data.movimiento.distancia_km.toFixed(2) + " km recorridos";
    badge.hidden = false;
  } else {
    document.getElementById("distanciaBadge").hidden = true;
  }

  if (data.analisis_sistema) {
    analisisTexto += "\n\n" + data.analisis_sistema;
  }

  document.getElementById("analisis").innerText = analisisTexto;

}

function crearGraficas(datos) {

  const datosLimitados = datos.slice(-30);

  const labels = datosLimitados.map(d => d.fecha);
  const temps = datosLimitados.map(d => d.temp_objeto);
  const hr = datosLimitados.map(d => d.ritmo_cardiaco);

  const clayColor = "#b6502f";
  const skyColor = "#3e7ca6";

  if (tempChart) tempChart.destroy();

  tempChart = new Chart(document.getElementById("tempChart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Temperatura",
        data: temps,
        borderColor: clayColor,
        backgroundColor: clayColor + "22",
        pointRadius: 2,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 6 } } }
    }
  });

  if (hrChart) hrChart.destroy();

  hrChart = new Chart(document.getElementById("hrChart"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Ritmo cardiaco",
        data: hr,
        borderColor: skyColor,
        backgroundColor: skyColor + "22",
        pointRadius: 2,
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 6 } } }
    }
  });
}

function crearMapa(datos) {

  if (!map) {
    map = L.map("map").setView([20.97, -89.62], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
  }

  marcadores.forEach(m => map.removeLayer(m));
  marcadores = [];

  if (ruta) {
    map.removeLayer(ruta);
  }

  const puntos = [];

  datos.forEach(d => {
    if (d.latitud && d.longitud && d.latitud != 0 && d.longitud != 0) {
      const punto = [d.latitud, d.longitud];
      puntos.push(punto);
      const marker = L.marker(punto).addTo(map);
      marcadores.push(marker);
    }
  });

  if (ruta) ruta = null;

  if (puntos.length > 1) {
    ruta = L.polyline(puntos, {
      color: "#1f4d3a",
      weight: 3
    }).addTo(map);

    map.fitBounds(puntos);
  } else if (puntos.length === 1) {
    map.setView(puntos[0], 14);
  }

  // El mapa vive dentro de un contenedor que estaba oculto (display:none)
  // durante la carga; hay que forzar un recalculo de tamaño.
  setTimeout(() => map.invalidateSize(), 150);
}

/* ---------- TABLA PAGINADA ---------- */

function prepararTabla(datos) {
  filasTabla = datos;
  paginaActual = 1;
  renderizarTabla();
}

function cambiarPagina(delta) {
  const totalPaginas = Math.max(1, Math.ceil(filasTabla.length / FILAS_POR_PAGINA));
  paginaActual = Math.min(totalPaginas, Math.max(1, paginaActual + delta));
  renderizarTabla();
}

function renderizarTabla() {

  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";

  const totalPaginas = Math.max(1, Math.ceil(filasTabla.length / FILAS_POR_PAGINA));
  paginaActual = Math.min(paginaActual, totalPaginas);

  const inicio = (paginaActual - 1) * FILAS_POR_PAGINA;
  const pagina = filasTabla.slice(inicio, inicio + FILAS_POR_PAGINA);

  pagina.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.fecha}</td>
      <td>${d.temp_objeto}</td>
      <td>${d.ritmo_cardiaco}</td>
      <td>${d.latitud}</td>
      <td>${d.longitud}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("pageIndicator").textContent =
    `Página ${paginaActual} de ${totalPaginas}`;

  document.getElementById("tableCount").textContent =
    `${filasTabla.length} registro${filasTabla.length === 1 ? "" : "s"}`;

  document.getElementById("prevPage").disabled = paginaActual <= 1;
  document.getElementById("nextPage").disabled = paginaActual >= totalPaginas;
}

/* ---------- EXPORTAR PDF ---------- */

async function exportPDF() {

  if (!reporteActual) {
    alert("Primero genera un reporte");
    return;
  }

  const btnExport = document.getElementById("exportPDF");
  btnExport.disabled = true;

  try {

    const doc = new window.jspdf.jsPDF();

    let y = 20;

    doc.setFontSize(18);
    doc.text("FarmWatch - Informe de Monitoreo", 20, y);

    y += 10;

    doc.setFontSize(12);

    const analisis = doc.splitTextToSize(
      document.getElementById("analisis").innerText,
      170
    );

    doc.text("Analisis:", 20, y);
    y += 8;

    doc.text(analisis, 20, y);

    y += analisis.length * 6 + 5;

    doc.text("Estadisticas:", 20, y);
    y += 8;

    doc.text("Temp promedio: " + document.getElementById("temp_avg").innerText, 20, y); y += 6;
    doc.text("Temp maxima: " + document.getElementById("temp_max").innerText, 20, y); y += 6;
    doc.text("Ritmo promedio: " + document.getElementById("hr_avg").innerText, 20, y); y += 6;
    doc.text("Ritmo maximo: " + document.getElementById("hr_max").innerText, 20, y); y += 6;
    doc.text("Estado: " + document.getElementById("estado").innerText, 20, y);

    y += 10;

    /* -------- GRAFICA TEMPERATURA -------- */

    const tempCanvas = document.getElementById("tempChart");
    const tempImg = tempCanvas.toDataURL("image/png");

    doc.text("Grafica de temperatura", 20, y);
    y += 5;

    doc.addImage(tempImg, "PNG", 20, y, 170, 60);

    doc.addPage();
    y = 20;

    /* -------- GRAFICA RITMO -------- */

    const hrCanvas = document.getElementById("hrChart");
    const hrImg = hrCanvas.toDataURL("image/png");

    doc.text("Grafica de ritmo cardiaco", 20, y);
    y += 5;

    doc.addImage(hrImg, "PNG", 20, y, 170, 60);

    doc.addPage();
    y = 20;

    /* -------- MAPA -------- */

    const mapElement = document.getElementById("map");

    await new Promise(r => setTimeout(r, 1000));

    const canvasMapa = await html2canvas(mapElement, {
      useCORS: true,
      scale: 2
    });

    const mapaImg = canvasMapa.toDataURL("image/png");

    doc.text("Ruta recorrida del animal", 20, 20);
    doc.addImage(mapaImg, "PNG", 20, 30, 170, 100);

    /* -------- TABLA (todos los registros, no solo la pagina visible) -------- */

    const rows = filasTabla.map(d => [
      d.fecha, d.temp_objeto, d.ritmo_cardiaco, d.latitud, d.longitud
    ]);

    doc.addPage();

    doc.text("Registros", 20, 20);

    doc.autoTable({
      startY: 28,
      head: [["Fecha", "Temp", "Ritmo", "Lat", "Lng"]],
      body: rows,
      styles: { fontSize: 8 }
    });

    doc.save("informe_farmwatch.pdf");

  } catch (e) {
    console.error("Error exportando PDF", e);
    alert("Error al exportar el PDF");
  } finally {
    btnExport.disabled = false;
  }
}

async function cargarVacas() {

  try {

    const res = await fetch("/api/vacasnew");
    const vacas = await res.json();

    const select = document.getElementById("vaca");

    vacas.forEach(v => {
      const option = document.createElement("option");
      option.value = v;
      option.textContent = v;
      select.appendChild(option);
    });

  } catch (e) {
    console.error("Error cargando vacas", e);
  }

}