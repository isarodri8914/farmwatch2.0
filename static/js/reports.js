let map;
let tempChart;
let hrChart;

document.addEventListener("DOMContentLoaded", function () {

document.getElementById("generar").onclick = generarInforme;

document.getElementById("exportPDF").onclick = exportPDF;

});

async function generarInforme() {

const vaca = document.getElementById("vaca").value;
const inicio = document.getElementById("inicio").value;
const fin = document.getElementById("fin").value;

const res = await fetch(`/api/reporte?vaca=${vaca}&inicio=${inicio}&fin=${fin}`);
const data = await res.json();

if(data.error){
alert(data.error);
return;
}

mostrarAnalisis(data);
crearGraficas(data.datos);
crearMapa(data.datos);
crearTabla(data.datos);

}

function mostrarAnalisis(data){

document.getElementById("analisis").innerText = data.analisis;

document.getElementById("temp_avg").innerText = data.estadisticas.temp_avg.toFixed(2);
document.getElementById("temp_max").innerText = data.estadisticas.temp_max.toFixed(2);

document.getElementById("hr_avg").innerText = data.estadisticas.hr_avg.toFixed(2);
document.getElementById("hr_max").innerText = data.estadisticas.hr_max.toFixed(2);

document.getElementById("estado").innerText = data.estadisticas.estado;

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
borderColor:"red"
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
borderColor:"blue"
}]
}

});

}

function crearMapa(datos){

if(!map){

map = L.map("map").setView([20.97,-89.62],12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

}

const puntos=[];

datos.forEach(d=>{

if(d.latitud && d.longitud){

puntos.push([d.latitud,d.longitud]);

L.circleMarker([d.latitud,d.longitud],{
radius:5,
color:"blue"
}).addTo(map);

}

});

if(puntos.length>1){

L.polyline(puntos,{
color:"red",
weight:3
}).addTo(map);

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
document.getElementById("exportPDF").onclick = function(){

const { jsPDF } = window.jspdf;

const doc = new jsPDF();

doc.text("FarmWatch - Informe de Monitoreo",20,20);

doc.text(document.getElementById("analisis").innerText,20,40);

doc.save("informe_farmwatch.pdf");

}

function exportPDF(){

const { jsPDF } = window.jspdf;

const doc = new jsPDF();

doc.text("FarmWatch - Informe de Monitoreo",20,20);

doc.text(document.getElementById("analisis").innerText,20,40);

doc.save("informe_farmwatch.pdf");

}