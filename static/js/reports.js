let map;
let ruta;
let marcadores=[];
let tempChart;
let hrChart;
let reporteActual = null;

document.addEventListener("DOMContentLoaded", function () {

document.getElementById("generar").onclick = generarInforme;

document.getElementById("exportPDF").onclick = exportPDF;

cargarVacas();

});

async function generarInforme() {

const vaca = document.getElementById("vaca").value;
const inicio = document.getElementById("inicio").value;
const fin = document.getElementById("fin").value;

try{

const res = await fetch(`/api/reporte?vaca=${vaca}&inicio=${inicio}&fin=${fin}`);
let data;

try {
    data = await res.json();
} catch (err) {
    const text = await res.text();
    console.error("Respuesta NO JSON:", text);
    throw new Error("El servidor no devolvió JSON");
}
reporteActual = data;

if(data.error){
alert(data.error);
return;
}

mostrarAnalisis(data);
crearGraficas(data.datos);
crearMapa(data.datos);
crearTabla(data.datos);

}catch(e){

console.error("Error generando informe",e);
alert("Error al generar informe");

}

}

function mostrarAnalisis(data){

document.getElementById("analisis").innerText = data.analisis;

document.getElementById("temp_avg").innerText = data.estadisticas.temp_avg.toFixed(2);
document.getElementById("temp_max").innerText = data.estadisticas.temp_max.toFixed(2);

document.getElementById("hr_avg").innerText = data.estadisticas.hr_avg.toFixed(2);
document.getElementById("hr_max").innerText = data.estadisticas.hr_max.toFixed(2);

document.getElementById("estado").innerText = data.estadisticas.estado;

if(data.movimiento){

document.getElementById("analisis").innerText +=
"\n\nDistancia recorrida: " + data.movimiento.distancia_km.toFixed(2) + " km";

}

if(data.analisis_sistema){

document.getElementById("analisis").innerText +=
"\n\n" + data.analisis_sistema;

}

}

function crearGraficas(datos){

const labels = datos.map(d => d.fecha);
const temps = datos.map(d => d.temp_objeto);
const hr = datos.map(d => d.ritmo_cardiaco);

if(tempChart) tempChart.destroy();

tempChart = new Chart(document.getElementById("tempChart"),{

type:"line",

data:{
labels:labels,
datasets:[{
label:"Temperatura",
data:temps,
borderColor:"red",
fill:false,
tension: 0.4,
pointRadius: 2,
borderWidth: 2
}]
}

});

if(hrChart) hrChart.destroy();

hrChart = new Chart(document.getElementById("hrChart"),{

type:"line",

data:{
labels:labels,
datasets:[{
label:"Ritmo cardiaco",
data:hr,
borderColor:"blue",
fill:false,
tension: 0.4,
pointRadius: 2,
borderWidth: 2
}]
}

});

}

function crearMapa(datos){

if(!map){

map = L.map("map").setView([20.97,-89.62],12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
attribution:"© OpenStreetMap"
}).addTo(map);

}

marcadores.forEach(m=>map.removeLayer(m));
marcadores=[];

if(ruta){
map.removeLayer(ruta);
}

const puntos=[];

datos.forEach(d=>{

if(d.latitud && d.longitud && d.latitud!=0 && d.longitud!=0){

const punto=[d.latitud,d.longitud];

puntos.push(punto);

const marker=L.marker(punto).addTo(map);

marcadores.push(marker);

}

});

if(puntos.length>1){

ruta=L.polyline(puntos,{
color:"red",
weight:3
}).addTo(map);

map.fitBounds(puntos);

}

}

function crearTabla(datos){

const tbody = document.querySelector("#tabla tbody");
tbody.innerHTML="";

datos.forEach(d=>{

const tr=document.createElement("tr");

tr.innerHTML=`

<td>${d.fecha}</td>
<td>${d.temp_objeto}</td>
<td>${d.ritmo_cardiaco}</td>
<td>${d.latitud}</td>
<td>${d.longitud}</td>

`;

tbody.appendChild(tr);

});

}

async function exportPDF(){

const doc = new window.jspdf.jsPDF();

doc.setFontSize(18);
doc.text("FarmWatch - Informe de Monitoreo",20,20);

doc.setFontSize(12);

doc.text("Analisis:",20,35);

const texto = document.getElementById("analisis").innerText || "Sin datos";

const lineas = doc.splitTextToSize(texto, 170);

doc.text(lineas, 20, 45);

doc.text("Estadisticas:",20,80);

doc.text("Temp promedio: "+document.getElementById("temp_avg").innerText,20,90);
doc.text("Temp maxima: "+document.getElementById("temp_max").innerText,20,98);

doc.text("Ritmo promedio: "+document.getElementById("hr_avg").innerText,20,106);
doc.text("Ritmo maximo: "+document.getElementById("hr_max").innerText,20,114);

doc.text("Estado: "+document.getElementById("estado").innerText,20,122);
doc.text(
"Distancia recorrida: " + 
(reporteActual?.movimiento?.distancia_km?.toFixed(2) || "0") + " km",
20,
130
);
let y = 135;

/* -------- GRAFICA TEMPERATURA -------- */

const tempCanvas = document.getElementById("tempChart");

const tempImg = tempCanvas.toDataURL("image/png");

doc.text("Grafica de temperatura",20,y);
y += 5;

doc.addImage(tempImg,"PNG",20,y,170,60);

y += 70;

/* -------- GRAFICA RITMO -------- */

const hrCanvas = document.getElementById("hrChart");

const hrImg = hrCanvas.toDataURL("image/png");

doc.text("Grafica de ritmo cardiaco",20,y);
y += 5;

doc.addImage(hrImg,"PNG",20,y,170,60);

doc.addPage();

/* -------- MAPA -------- */

const mapElement = document.getElementById("map");

await new Promise(r => setTimeout(r, 1000));
const canvasMapa = await html2canvas(mapElement, {
    useCORS: true,
    allowTaint: true,
    scale: 2
});

const mapaImg = canvasMapa.toDataURL("image/png");

doc.text("Ruta recorrida del animal",20,20);

doc.addImage(mapaImg,"PNG",20,30,170,100);

/* -------- TABLA -------- */

const rows=[];

document.querySelectorAll("#tabla tbody tr").forEach(tr=>{

const cols=[...tr.children].map(td=>td.innerText);

rows.push(cols);

});

doc.autoTable({
startY:140,
head:[["Fecha","Temp","Ritmo","Lat","Lng"]],
body:rows
});

doc.save("informe_farmwatch.pdf");

}



async function cargarVacas(){

try{

const res = await fetch("/api/vacasnew");
const vacas = await res.json();

const select = document.getElementById("vaca");

vacas.forEach(v=>{

const option = document.createElement("option");

option.value=v;
option.textContent=v;

select.appendChild(option);

});

}catch(e){

console.error("Error cargando vacas",e);

}

}
