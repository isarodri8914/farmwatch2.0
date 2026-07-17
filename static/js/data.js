let cowData = [];       // todo lo que llega del servidor
let filteredData = [];  // después de aplicar búsqueda + filtro de vaca
let currentPage = 1;
const PAGE_SIZE = 12;

// ---------- Elementos ----------
const tableBody = document.getElementById("table-body");
const dataTable = document.getElementById("data-table");
const searchInput = document.getElementById("search-input");
const cowFilter = document.getElementById("cow-filter");
const pagePrevBtn = document.getElementById("page-prev");
const pageNextBtn = document.getElementById("page-next");
const pageInfoEl = document.getElementById("page-info");
const statTotalRows = document.getElementById("stat-total-rows");
const statShowing = document.getElementById("stat-showing");
const statLastUpdate = document.getElementById("stat-last-update");
const exportExcelBtn = document.getElementById("export-excel");
const exportPdfBtn = document.getElementById("export-pdf");

// ==================== CARGA DE DATOS ====================
async function fetchData() {
    try {
        const response = await fetch("/api/datos");
        const datos = await response.json();
        cowData = Array.isArray(datos) ? datos : [];

        populateCowFilter(cowData);
        applyFilters(); // recalcula filteredData y vuelve a pintar

        statTotalRows.textContent = cowData.length;
        statLastUpdate.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// Llena el <select> de vacas con los IDs que realmente existen en los datos,
// en vez de una lista fija (#101/#104/#109) que se desactualiza sola.
function populateCowFilter(data) {
    const previousValue = cowFilter.value || "all";
    const ids = [...new Set(data.map(d => d.id_vaca).filter(Boolean))].sort();

    cowFilter.innerHTML = '<option value="all">Todas</option>' +
        ids.map(id => `<option value="${id}">#${id}</option>`).join("");

    // Si la vaca que estaba seleccionada sigue existiendo, se respeta.
    if (previousValue !== "all" && ids.includes(previousValue)) {
        cowFilter.value = previousValue;
    } else {
        cowFilter.value = "all";
    }
}

// ==================== FILTROS ====================
function applyFilters() {
    const term = (searchInput.value || "").toLowerCase().trim();
    const cow = cowFilter.value;

    filteredData = cowData.filter(d => {
        const matchesCow = cow === "all" || String(d.id_vaca) === cow;
        if (!matchesCow) return false;

        if (!term) return true;

        return (
            (d.id_vaca && String(d.id_vaca).toLowerCase().includes(term)) ||
            (d.fecha && String(d.fecha).toLowerCase().includes(term)) ||
            (d.temp_objeto !== undefined && String(d.temp_objeto).includes(term)) ||
            (d.ritmo_cardiaco !== undefined && String(d.ritmo_cardiaco).includes(term))
        );
    });

    currentPage = 1;
    renderPage();
}

// ==================== PAGINACIÓN ====================
function totalPages() {
    return Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
}

function renderPage() {
    const pages = totalPages();
    if (currentPage > pages) currentPage = pages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageSlice = filteredData.slice(start, start + PAGE_SIZE);

    renderTable(pageSlice);

    pageInfoEl.textContent = `Página ${currentPage} de ${pages}`;
    pagePrevBtn.disabled = currentPage <= 1;
    pageNextBtn.disabled = currentPage >= pages;

    const showingFrom = filteredData.length === 0 ? 0 : start + 1;
    const showingTo = Math.min(start + PAGE_SIZE, filteredData.length);
    statShowing.textContent = filteredData.length === 0
        ? "0"
        : `${showingFrom}–${showingTo} de ${filteredData.length}`;

    const hasData = filteredData.length > 0;
    exportExcelBtn.disabled = !hasData;
    exportPdfBtn.disabled = !hasData;
}

pagePrevBtn.addEventListener("click", () => {
    currentPage--;
    renderPage();
});

pageNextBtn.addEventListener("click", () => {
    currentPage++;
    renderPage();
});

// ==================== RENDER DE TABLA ====================
function renderTable(data) {
    tableBody.innerHTML = "";

    if (!data.length) {
        const tr = document.createElement("tr");
        tr.className = "empty-row";
        tr.innerHTML = `<td colspan="10">No se encontraron registros con estos filtros. Prueba con otra búsqueda o vaca.</td>`;
        tableBody.appendChild(tr);
        return;
    }

    data.forEach(row => {
        const tr = document.createElement("tr");

        const fmt = (val, unit, flagIfZero) => {
            const isEmptyReading = flagIfZero && (val === null || val === undefined || val === 0);
            if (isEmptyReading) return `<span class="cell-flag">sin señal</span>`;
            return `${val ?? 0}${unit ? " " + unit : ""}`;
        };

        tr.innerHTML = `
            <td data-col="vaca"><strong>${row.id_vaca}</strong></td>
            <td data-col="temp_amb">${fmt(row.temp_ambiente, "°C")}</td>
            <td data-col="temp_obj">${fmt(row.temp_objeto, "°C")}</td>
            <td data-col="ritmo">${fmt(row.ritmo_cardiaco, "bpm", true)}</td>
            <td data-col="oxigeno">${fmt(row.oxigeno, "%", true)}</td>
            <td data-col="gyro_x">${row.gyro_x ?? 0}</td>
            <td data-col="gyro_y">${row.gyro_y ?? 0}</td>
            <td data-col="gyro_z">${row.gyro_z ?? 0}</td>
            <td data-col="ubicacion">${(row.latitud && row.longitud) ? `${row.latitud}, ${row.longitud}` : `<span class="cell-flag">sin GPS</span>`}</td>
            <td data-col="fecha">${row.fecha ?? ""}</td>
        `;

        tableBody.appendChild(tr);
    });
}

// ==================== EVENTOS DE FILTRO ====================
searchInput.addEventListener("input", applyFilters);
cowFilter.addEventListener("change", applyFilters);

// ==================== PESTAÑAS DE COLUMNAS ====================
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        dataTable.dataset.activeTab = btn.dataset.tab;
    });
});

// ==================== CARGA INICIAL + REFRESCO ====================
fetchData();
setInterval(fetchData, 10000);

// ========================================
// EXPORTAR A EXCEL (respeta la búsqueda y el filtro de vaca activos)
// ========================================
exportExcelBtn.addEventListener("click", () => {
    if (!filteredData.length) {
        alert("No hay datos para exportar con los filtros actuales");
        return;
    }

    const dataExport = filteredData.map(d => ({
        "Vaca": d.id_vaca,
        "Temp Ambiente (°C)": d.temp_ambiente,
        "Temp Objeto (°C)": d.temp_objeto,
        "Ritmo Cardíaco (bpm)": d.ritmo_cardiaco,
        "Oxígeno (%)": d.oxigeno,
        "Gyro X": d.gyro_x,
        "Gyro Y": d.gyro_y,
        "Gyro Z": d.gyro_z,
        "Latitud": d.latitud,
        "Longitud": d.longitud,
        "Fecha": d.fecha
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Vacas");

    XLSX.writeFile(workbook, `historial_vacas_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ========================================
// EXPORTAR A PDF (respeta la búsqueda y el filtro de vaca activos)
// ========================================
exportPdfBtn.addEventListener("click", function () {
    if (!filteredData.length) {
        alert("No hay datos para exportar con los filtros actuales");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("landscape");

    doc.setFontSize(20);
    doc.text("Historial de Datos de Vacas", 14, 18);

    const columns = [
        "Vaca", "Temp Amb", "Temp Obj", "Ritmo", "Oxígeno",
        "Gyro X", "Gyro Y", "Gyro Z", "Ubicación", "Fecha"
    ];

    const rows = filteredData.map(d => [
        d.id_vaca,
        d.temp_ambiente ?? 0,
        d.temp_objeto ?? 0,
        d.ritmo_cardiaco ?? 0,
        d.oxigeno ?? 0,
        d.gyro_x ?? 0,
        d.gyro_y ?? 0,
        d.gyro_z ?? 0,
        `${d.latitud ?? 0}, ${d.longitud ?? 0}`,
        d.fecha
    ]);

    doc.autoTable({
        head: [columns],
        body: rows,
        startY: 28,
        theme: "grid",
        styles: { fontSize: 9 },
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: 255,
            fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`historial_vacas_${new Date().toISOString().slice(0,10)}.pdf`);
});