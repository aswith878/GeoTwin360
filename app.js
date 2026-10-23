import {
  MINE,
  MAIN_NODES,
  SUB_NODES,
  REFERENCE_NODES,
  SATELLITES,
  buildHistory,
  csvEscape,
  formatIST,
  riskBand,
  snapshotForMinute,
  vector3d
} from "./src/model.mjs";

const app = document.querySelector("#app");
const toastElement = document.querySelector("#toast");
const validRoutes = ["overview", "nodes", "satellite", "reference", "fusion", "alerts"];
const navItems = [
  ["overview", "Overview", "▦"],
  ["nodes", "Surface Node Network", "⌾"],
  ["satellite", "Satellite Monitoring", "◉"],
  ["reference", "Stable Reference Zone", "⌖"],
  ["fusion", "AI Fusion & Prediction", "⌁"],
  ["alerts", "Alerts & Response", "△"]
];

let authorized = sessionStorage.getItem("geotwin-access") === "true";
let mode = "api";
let apiUrl = localStorage.getItem("geotwin-api-url") || window.GEOTWIN_CONFIG?.apiUrl || "http://localhost:8000/api";
let minuteKey = Math.floor(Date.now() / 60000);
let snapshot = snapshotForMinute(minuteKey);
let riskHistory = buildHistory(snapshot, 122);
let expandedNode = "MN-03";

let alertStatus = localStorage.getItem("geotwin-alert-status") || "Open";
let alertFilter = "All";
let mapSerial = 0;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const fmt = (value, digits = 1) => Number(value).toFixed(digits);
const statusText = score => riskBand(score).toUpperCase();

function logoSvg(className = "geotwin-logo") {
  return `<svg class="${className}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M7 25c6 0 9 2 14 5 3 2 5 3 8 2 5-2 7-5 12-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M8 17h32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"/><circle cx="16" cy="17" r="2.3" fill="currentColor"/><circle cx="32" cy="17" r="2.3" fill="currentColor"/><circle cx="24" cy="31" r="2.8" fill="currentColor"/></svg>`;
}

function formatTimeIST(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function currentRoute() {
  const route = location.pathname.split("/").filter(Boolean)[0] || "overview";
  return validRoutes.includes(route) ? route : "overview";
}

function toast(message, tone = "info") {
  toastElement.textContent = message;
  toastElement.dataset.tone = tone;
  toastElement.classList.add("show");
  clearTimeout(toastElement.timer);
  toastElement.timer = setTimeout(() => toastElement.classList.remove("show"), 3200);
}

function landing() {
  document.title = "GeoTwin 360 – Mine Subsidence Early Warning";
  app.innerHTML = `
    <main class="landing">
      <form id="mine-form" class="login-card" aria-labelledby="login-title">
        ${logoSvg("login-logo")}
        <h1 id="login-title">GeoTwin <b>360</b></h1>
        <p class="login-subtitle">AI-Enabled Mine Subsidence Monitoring and Early Warning System</p>
        <label for="mine">MINE ID</label>
        <input id="mine" name="mine" value="CHURCHA-01" autocomplete="off" spellcheck="false" autofocus />
        <p class="form-help">Enter Mine ID to access the monitoring dashboard.</p>
        <p id="login-error" class="form-error" role="alert"></p>
        <button class="primary-button wide" type="submit">Load Dashboard</button>
      </form>
    </main>`;
  document.querySelector("#mine-form").addEventListener("submit", event => {
    event.preventDefault();
    const entered = new FormData(event.currentTarget).get("mine").trim().toUpperCase();
    if (entered !== MINE.id) {
      document.querySelector("#login-error").textContent = `Mine ID not found. Use ${MINE.id} for this prototype.`;
      return;
    }
    authorized = true;
    sessionStorage.setItem("geotwin-access", "true");
    window.history.replaceState({}, "", "/overview");
    renderDashboard();
  });
}

function riskPill(score, extra = "") {
  const band = riskBand(score);
  return `<span class="risk-pill ${band}">${extra || band.toUpperCase()}</span>`;
}

function header() {
  const band = riskBand(snapshot.fusedRisk);
  return `
    <header class="topbar">
      <a class="brand" href="/overview" data-route="overview">${logoSvg()}<span><strong>GeoTwin 360</strong><small>${MINE.name} · ${MINE.id} · ${MINE.lat.toFixed(4)}° N, ${MINE.lon.toFixed(4)}° E</small></span></a>
      <div class="top-actions">
        <button class="risk-summary ${band}" data-route="fusion"><span>RISK</span><b>${statusText(snapshot.fusedRisk)}</b><em>${fmt(snapshot.fusedRisk)}</em></button>
        <div class="cycle-meta"><span>Last processed <b id="last-processed">${formatIST(new Date(snapshot.minuteKey * 60000))} IST</b></span><span class="countdown-box">Next update in <b id="countdown">00:00</b></span></div>
      </div>
    </header>`;
}

function navigation(route) {
  return `<nav class="main-nav" aria-label="Dashboard sections">${navItems.map(([id, label, icon]) => `
    <a href="/${id}" data-route="${id}" class="${route === id ? "active" : ""}">${label}${id === "alerts" && alertStatus === "Open" ? '<i>1</i>' : ""}</a>`).join("")}</nav>`;
}

function footer() {
  return `<footer>Surface-only monitoring · LoRa / ESP32 network · 60-second synchronized cycle (server clock) · AOI circle is approximate, not an official mine boundary.</footer>`;
}

function metricCard(label, value, detail, tone = "blue") {
  return `<article class="metric-card ${tone}"><div class="metric-head"><span>${label}</span></div><strong>${value}</strong><small>${detail}</small></article>`;
}

function mapView({ compact = false, title = "GIS MAP · CHURCHA AOI" } = {}) {
  const id = `geotwin-map-${++mapSerial}`;
  return `<section class="map-card ${compact ? "compact" : ""}">
    <div class="panel-title"><span>${title}</span><time>${formatIST(new Date(snapshot.minuteKey * 60000))} IST</time></div>
    <div class="map-stage leaflet-host" id="${id}" data-compact="${compact}"><div class="map-fallback">Map tiles require internet access</div></div>
    <div class="legend"><span class="normal">● Normal</span><span class="watch">● Watch</span><span class="warning">● Warning</span><span class="critical">● Critical</span><span class="reference">◆ Stable reference</span><span class="offline">● Offline</span><span class="insar">▰ InSAR deformation</span></div>
  </section>`;
}

function initMaps(attempt = 0) {
  const hosts = [...document.querySelectorAll(".leaflet-host:not([data-ready])")];
  if (!hosts.length) return;
  if (!window.L) {
    if (attempt < 15) setTimeout(() => initMaps(attempt + 1), 250);
    return;
  }
  const color = {normal:"#16a36a",watch:"#e5b80b",warning:"#f97316",critical:"#ef4444",reference:"#3b82f6",offline:"#6b7280"};
  const nodeState = node => node.offline ? "offline" : node.parent === "MN-03" || node.id === "MN-03" ? "watch" : node.parent === "MN-05" || node.id === "MN-05" ? "watch" : "normal";
  hosts.forEach(host => {
    host.dataset.ready = "true";
    const map = L.map(host, { zoomControl: true, attributionControl: true }).setView([MINE.lat, MINE.lon], host.dataset.compact === "true" ? 13 : 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
    L.circle([MINE.lat,MINE.lon], {radius:1700,color:"#64748b",weight:1,dashArray:"5 5",fillColor:"#6366f1",fillOpacity:.025}).bindTooltip("Approximate AOI — not an official mine boundary",{permanent:true,direction:"center"}).addTo(map);
    L.circle([23.3389,82.531], {radius:430,color:"#ef4444",weight:2,dashArray:"6 5",fillColor:"#a855f7",fillOpacity:.12}).addTo(map);
    [...MAIN_NODES,...SUB_NODES].forEach(node => {
      const state=nodeState(node); L.circleMarker([node.lat,node.lon],{radius:node.parent?5:7,color:"#111827",weight:2,fillColor:color[state],fillOpacity:1}).bindTooltip(`<b>${node.id}</b><br>${state.toUpperCase()}`).addTo(map);
    });
    REFERENCE_NODES.forEach(node => L.circleMarker([node.lat,node.lon],{radius:8,color:"#172033",weight:2,fillColor:color.reference,fillOpacity:1}).bindTooltip(`<b>${node.id}</b><br>STABLE REFERENCE`).addTo(map));
    setTimeout(()=>map.invalidateSize(),0);
  });
}

function svgLineChart(series, lines, { min = 0, max = 100, height = 220 } = {}) {
  const width = 900, padX = 44, padY = 22;
  const plotW = width - padX * 2, plotH = height - padY * 2;
  const x = index => padX + (index / Math.max(1, series.length - 1)) * plotW;
  const y = value => padY + (1 - (value - min) / (max - min)) * plotH;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = max - index * (max - min) / 4;
    const gy = padY + index * plotH / 4;
    return `<line x1="${padX}" y1="${gy}" x2="${width-padX}" y2="${gy}"/><text x="6" y="${gy+4}">${fmt(value, 0)}</text>`;
  }).join("");
  const paths = lines.map(line => {
    const points = series.map((item, index) => `${x(index)},${y(item[line.key])}`).join(" ");
    return `<polyline points="${points}" stroke="${line.color}"/>`;
  }).join("");
  return `<div class="chart-wrap"><svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Time-series chart"><g class="chart-grid">${grid}</g>${paths}<text class="time-start" x="${padX}" y="${height-2}">-${series.length} min</text><text class="time-end" x="${width-padX}" y="${height-2}">now</text></svg><div class="chart-legend">${lines.map(line => `<span><i style="background:${line.color}"></i>${line.label}</span>`).join("")}</div></div>`;
}

function overviewPage() {
  const clusterScores = [0, 0, 0, 0, 0, 0, 0];
  return `
    <section class="metric-grid">
      ${metricCard("FUSED RISK", `${fmt(snapshot.fusedRisk)}`, riskPill(snapshot.fusedRisk), riskBand(snapshot.fusedRisk))}
      ${metricCard("GROUND RISK", `${fmt(snapshot.groundRisk)}`, `Worst cluster ${snapshot.worstCluster}`, riskBand(snapshot.groundRisk))}
      ${metricCard("SATELLITE RISK", `${fmt(snapshot.satelliteRisk)}`, "Sentinel-1 + NISAR", "plain")}
      ${metricCard("MAX CORRECTED SUBSIDENCE", `${fmt(snapshot.maxSubsidence)}<em>mm</em>`, "Vertical, reference-corrected", "plain")}
      ${metricCard("NODES ONLINE", `${snapshot.nodesOnline}/${snapshot.totalNodes}`, `${snapshot.rtkFixed} RTK fixed`, "plain")}
      ${metricCard("OPEN ALERTS", `${alertStatus === "Open" ? 1 : 0}`, "View alerts", "plain")}
    </section>
    <section class="overview-grid">
      ${mapView()}
      <div class="side-stack">
        <section class="panel cluster-panel"><div class="panel-title"><span>CLUSTER RISK</span></div>${MAIN_NODES.map((node, index) => `<button data-route="nodes" class="cluster-row"><b>${node.id}</b><strong>${fmt(clusterScores[index])}</strong>${riskPill(clusterScores[index])}</button>`).join("")}</section>
        <section class="panel alert-panel"><div class="panel-title"><span>RECENT ALERTS</span></div><div class="alert-item"><i></i><div><strong>MN-05-E heartbeat lost (offline)</strong><em>${formatTimeIST(new Date(snapshot.minuteKey * 60000))} · ${alertStatus}</em></div></div></section>
      </div>
    </section>
    <section class="panel chart-panel"><div class="panel-title"><span>RISK SCORES · LAST 60 ONE-MINUTE CYCLES</span></div>${svgLineChart(riskHistory.slice(-60), [{key:"fused",label:"Fused",color:"#f0c54a"},{key:"ground",label:"Ground",color:"#3dd7c1"},{key:"satellite",label:"Satellite",color:"#9d7cff"}], {min:0,max:100})}</section>`;
}

function mainNodeRow(node) {
  const open = expandedNode === node.id;
  const nodeScore = 0;
  const index = MAIN_NODES.findIndex(item => item.id === node.id);
  const temp = 19 + index * .1;
  return `<tr class="cluster-toggle" data-expand="${node.id}"><td colspan="16"><button class="expand-button" data-expand="${node.id}">${open ? "▾" : "▸"}</button><b>${node.id} cluster</b>${node.geophone ? ' · 3-component geophone' : ""}</td></tr><tr class="main-node ${open ? "expanded" : ""}" data-expand="${node.id}"><td><b>${node.id}</b></td><td>${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}</td><td><span class="rtk ${node.rtk.toLowerCase()}">${node.rtk}</span></td><td>0.00 / 0.00 / 0.00</td><td>0.00</td><td>—</td><td>0.000 / 0.000</td><td>0.000</td><td>0.00</td><td>0</td><td>0.0</td><td>${node.battery}%</td><td>Idle</td><td>${node.rssi}</td><td>${formatTimeIST(new Date(snapshot.minuteKey*60000))}</td><td>${riskPill(nodeScore)}</td></tr>`;
}

function subNodeRows(parent) {
  if (expandedNode !== parent.id) return "";
  return SUB_NODES.filter(node => node.parent === parent.id).map((node,index) => `<tr class="sub-node"><td><span class="branch"></span><b>${node.id}</b></td><td>${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}</td><td>—</td><td>—</td><td>—</td><td>0.00</td><td>0.000 / 0.000</td><td>0.000</td><td>—</td><td>0</td><td>0.0</td><td>${node.battery}%</td><td>Idle</td><td>${node.rssi}</td><td>${formatTimeIST(new Date(snapshot.minuteKey*60000))}</td><td>${node.offline ? '<span class="risk-pill offline">OFFLINE</span>' : riskPill(0)}</td></tr>`).join("");
}

function nodesPage() {
  const changes = [
    ["MN-03 ↔ MN-04",0],["MN-03 ↔ MN-06",0],["MN-03 ↔ MN-01",0],["MN-03 ↔ MN-05",0],["MN-03 ↔ MN-02",0],["MN-03 ↔ MN-03-W",0],["MN-03 ↔ MN-03-N",0],["MN-07 ↔ MN-05",0]
  ];
  const displacementHistory = riskHistory.slice(-60).map(item => ({...item, mn1:0, mn3:0, mn5:0}));
  return `<section class="panel table-panel"><div class="panel-title"><span>MAIN NODES & SUB-NODES</span><small>Click a main node to expand its 4 sub-nodes · displacements are reference-corrected (mm)</small></div><div class="table-scroll"><table class="sensor-table"><thead><tr><th>NODE</th><th>LAT, LON</th><th>RTK</th><th>E / N / U</th><th>3D</th><th>REL. Δ</th><th>TILT X / Y °</th><th>VIB G</th><th>PPV MM/S</th><th>AE/MIN</th><th>°C</th><th>BATT</th><th>SOLAR</th><th>RSSI</th><th>HEARTBEAT</th><th>STATUS</th></tr></thead><tbody>${snapshot.nodes.map(node => mainNodeRow(node)+subNodeRows(node)).join("")}</tbody></table></div></section>
  <section class="two-column nodes-lower">${mapView({compact:true,title:"NETWORK MAP"})}<section class="panel distance-panel"><div class="panel-title"><span>NEIGHBOUR DISTANCE CHANGES</span></div><div class="distance-head"><span>LINK</span><span>Δ MM</span><span>STATE</span></div>${changes.map(([link,value],index)=>`<div class="distance-row"><span>${link}</span><b>${fmt(value,2)}</b><em>${index===0?"watch":"ok"}</em></div>`).join("")}</section></section>
  <section class="panel chart-panel"><div class="panel-title"><div><span>CORRECTED VERTICAL DISPLACEMENT · MAIN NODES</span><small>mm · one-minute samples</small></div></div>${svgLineChart(displacementHistory,[{key:"mn1",label:"MN-01",color:"#5ad8c5"},{key:"mn3",label:"MN-03",color:"#f0c54a"},{key:"mn5",label:"MN-05",color:"#ff8e58"}],{min:-22,max:2})}</section>`;
}

function satelliteCard(satellite, acquired, processed) {
  return `<article class="panel satellite-card"><div class="satellite-head"><div><span>${satellite.name.toUpperCase()} · ${satellite.band.toUpperCase()}</span><small>Regional deformation validation</small></div><span class="valid">✓ VALID</span></div><div class="sat-metrics"><div><span>LOS DISPLACEMENT</span><b>${fmt(satellite.displacement)}<small> mm</small></b></div><div><span>VELOCITY</span><b>${fmt(satellite.velocity)}<small> mm/month</small></b></div><div><span>COHERENCE</span><b>${fmt(satellite.coherence,2)}<small> 0–1</small></b></div></div><dl><div><dt>Acquired</dt><dd>${acquired}</dd></div><div><dt>Processed</dt><dd>${processed}</dd></div><div><dt>Orbit</dt><dd>${satellite.orbit}</dd></div><div><dt>Quality</dt><dd>${satellite.quality}</dd></div><div><dt>Age</dt><dd>${satellite.age}</dd></div><div><dt>Source</dt><dd>${satellite.name === "NISAR" ? "NASA–ISRO NISAR L-band" : "ESA Copernicus Sentinel-1 IW SLC"} (configured feed)</dd></div></dl></article>`;
}

function satellitePage() {
  const acquisition = [
    {label:"08 Jun",nisar:-17.1,sentinel:-18.6},{label:"25 Jun",nisar:-18.4,sentinel:-20.1},{label:"14 Jul",nisar:-19.8,sentinel:-21.7},{label:"31 Jul",nisar:-21.0,sentinel:-23.0},{label:"19 Aug",nisar:-22.8,sentinel:-24.8},{label:"05 Sep",nisar:-24.1,sentinel:-26.2},{label:"24 Sep",nisar:-25.5,sentinel:-28.0}
  ];
  return `<div class="info-banner">◉ Satellite data provides periodic regional deformation validation. Ground nodes provide minute-level local monitoring.</div><section class="two-column satellite-grid">${satelliteCard(SATELLITES.sentinel,"24 Sept 2026, 06:12 IST","24 Sept 2026, 12:42 IST")}${satelliteCard(SATELLITES.nisar,"17 Sept 2026, 17:48 IST","18 Sept 2026, 00:18 IST")}</section><section class="two-column"><section class="panel heat-panel"><div class="panel-title"><div><span>DEFORMATION HEAT-MAP OVERLAY</span><small>InSAR line-of-sight displacement</small></div><label class="switch-label"><input type="checkbox" checked> Show raster</label></div>${mapView({compact:true})}</section><section class="panel acquisition-panel"><div class="panel-title"><div><span>LOS DISPLACEMENT PER ACQUISITION</span><small>mm · regional mean</small></div></div>${svgLineChart(acquisition,[{key:"nisar",label:"NISAR",color:"#9d7cff"},{key:"sentinel",label:"Sentinel-1",color:"#49c8ed"}],{min:-32,max:-12,height:285})}</section></section>`;
}

function referencePage() {
  const med = {east:-0.35,north:-2.31,up:-0.48};
  return `<div class="formula-banner"><b>REFERENCE CORRECTION</b><span>Corrected mine displacement = Mine-node displacement − Median stable-reference displacement</span><strong>Current median (E / N / U): ${fmt(med.east,2)} / ${fmt(med.north,2)} / ${fmt(med.up,2)} mm</strong></div><section class="panel table-panel"><div class="panel-title"><div><span>STABLE REFERENCE NODES</span><small>Outside the mining influence zone</small></div><span class="valid">✓ ALL STABLE</span></div><div class="table-scroll"><table><thead><tr><th>NODE</th><th>LAT, LON</th><th>RTK</th><th>RAW E / N / U MM</th><th>RAW 3D</th><th>BATTERY</th><th>RSSI</th></tr></thead><tbody>${REFERENCE_NODES.map(node=>`<tr><td><b>${node.id}</b></td><td>${node.lat.toFixed(5)}, ${node.lon.toFixed(5)}</td><td><span class="rtk fixed">Fixed</span></td><td>0.00 / 0.00 / 0.00</td><td>0.00</td><td>${node.battery}%</td><td>${node.rssi} dBm</td></tr>`).join("")}</tbody></table></div></section><section class="panel table-panel"><div class="panel-title"><div><span>RAW VS REFERENCE-CORRECTED · MAIN NODES</span><small>Common-mode GNSS motion removed using reference median</small></div></div><div class="table-scroll"><table><thead><tr><th>NODE</th><th>RAW E / N / U</th><th>RAW 3D</th><th>CORRECTED E / N / U</th><th>CORRECTED 3D</th></tr></thead><tbody>${snapshot.nodes.map(node=>{const raw={east:node.east+med.east,north:node.north+med.north,up:node.up+med.up};return `<tr><td><b>${node.id}</b></td><td>${fmt(raw.east,2)} / ${fmt(raw.north,2)} / ${fmt(raw.up,2)}</td><td>${fmt(vector3d(raw.east,raw.north,raw.up),2)}</td><td>0.00 / 0.00 / 0.00</td><td>${fmt(node.displacement3d,2)}</td></tr>`}).join("")}</tbody></table></div></section>${mapView({compact:true})}`;
}

function contribution(label, raw, weight, color) {
  const contribution = raw * weight;
  return `<div class="contribution"><div><span>${label} · ${Math.round(weight*100)}%</span><b>${fmt(raw,0)} → ${fmt(contribution,1)}</b></div><span class="meter"><i style="width:${raw}%;background:${color}"></i></span></div>`;
}

function fusionPage() {
  const projected = Math.max(0,snapshot.fusedRisk-1.9);
  return `<section class="fusion-cards"><article class="panel score-card"><div class="panel-title"><span>GROUND RISK SCORE</span>${riskPill(snapshot.groundRisk)}</div><strong>${fmt(snapshot.groundRisk)}</strong><small>Worst cluster ${snapshot.worstCluster}</small>${contribution("RTK displacement",37,.30,"#3dd7c1")}${contribution("Relative node-distance change",24,.20,"#3dd7c1")}${contribution("Tilt",37,.15,"#3dd7c1")}${contribution("Geophone PPV",9,.15,"#3dd7c1")}${contribution("Vibration",24,.10,"#3dd7c1")}${contribution("Acoustic emission",22,.10,"#3dd7c1")}</article><article class="panel score-card"><div class="panel-title"><span>SATELLITE RISK SCORE</span><span class="risk-pill satellite">VALID</span></div><strong>${fmt(snapshot.satelliteRisk)}</strong><small>Sentinel-1 + NISAR regional validation</small>${contribution("InSAR displacement",33,.50,"#9d7cff")}${contribution("Deformation velocity",49,.30,"#9d7cff")}${contribution("Coherence loss",58,.20,"#9d7cff")}</article><article class="panel score-card fused-card"><div class="panel-title"><span>FINAL FUSED RISK</span>${riskPill(snapshot.fusedRisk)}</div><strong>${fmt(snapshot.fusedRisk)}</strong><small>= 75% × Ground + 25% × Satellite</small><div class="risk-gauge"><i style="left:${snapshot.fusedRisk}%"></i></div><div class="thresholds"><span>NORMAL<br><b>0–24</b></span><span>WATCH<br><b>25–49</b></span><span>WARNING<br><b>50–74</b></span><span>CRITICAL<br><b>75–100</b></span></div></article></section><section class="panel trend-panel"><div class="panel-title"><div><span>TREND DETECTION & SHORT-TERM PROJECTION</span><small>Indicative linear trend · not a guarantee</small></div></div><div class="trend-metrics"><div><span>TREND (15 MIN)</span><b>Falling</b></div><div><span>SLOPE</span><b>-0.064 /min</b></div><div><span>PROJECTED IN 30 MIN</span><b>${fmt(projected)}</b></div><div><span>NEXT THRESHOLD</span><b>Not approaching</b></div></div></section><section class="panel chart-panel"><div class="panel-title"><div><span>RISK HISTORY</span><small>${riskHistory.length} one-minute results stored this session</small></div><div class="range-tabs"><button>30m</button><button class="active">2h</button><button>6h</button><button>12h</button></div></div>${svgLineChart(riskHistory,[{key:"fused",label:"Fused",color:"#f0c54a"},{key:"ground",label:"Ground",color:"#3dd7c1"},{key:"satellite",label:"Satellite",color:"#9d7cff"}],{min:0,max:100})}</section>`;
}

function alertsPage() {
  const visible = alertFilter === "All" || alertFilter === alertStatus;
  return `<section class="panel alerts-panel"><div class="alerts-header"><div><p class="eyebrow">INCIDENT MANAGEMENT</p><h2>Alerts & Response</h2><small>Operator actions are recorded locally in this prototype.</small></div><button class="outline-button" data-action="export">⇩ Export report</button></div><div class="filter-tabs">${["All","Open","Acknowledged","Escalated"].map(filter=>`<button data-filter="${filter}" class="${alertFilter===filter?"active":""}">${filter}</button>`).join("")}</div>${visible?`<article class="alert-record"><div class="severity watch"><span>!</span><b>WATCH</b></div><div class="alert-copy"><h3>MN-05-E heartbeat lost (offline)</h3><p>Action: Check LoRa gateway / ESP32 power. Inspect solar charging, enclosure ingress, and antenna connection before entering the deformation zone.</p><small>${formatIST(new Date(snapshot.minuteKey*60000))} IST · MN-05-E · <b>${alertStatus}</b></small></div><div class="alert-actions">${alertStatus!=="Acknowledged"?'<button class="primary-button" data-alert="Acknowledged">✓ Acknowledge</button>':""}${alertStatus!=="Escalated"?'<button class="danger-button" data-alert="Escalated">↑ Escalate</button>':""}</div></article>`:'<div class="empty-state"><span>✓</span><h3>No alerts in this filter</h3><p>Select another status to review the current incident.</p></div>'}</section><section class="response-grid"><article class="panel"><div class="panel-title"><span>RECOMMENDED RESPONSE</span></div><ol class="response-list"><li><b>Verify remotely</b><span>Check gateway packets and neighbouring node heartbeats.</span></li><li><b>Restrict the local zone</b><span>Keep people and vehicles outside the marked deformation area.</span></li><li><b>Dispatch a trained team</b><span>Only after mine safety authorization and gas/ground checks.</span></li><li><b>Document the outcome</b><span>Record observations, photos and the restored heartbeat time.</span></li></ol></article><article class="panel"><div class="panel-title"><span>COMMUNICATION CHANNELS</span></div><div class="channel"><span>SMS gateway</span><b class="online">READY</b></div><div class="channel"><span>Email notifications</span><b class="online">READY</b></div><div class="channel"><span>LoRa gateway</span><b class="online">ONLINE</b></div><div class="channel"><span>Cloud synchronization</span><b class="watch-text">PERIODIC</b></div></article></section>`;
}

function pageFor(route) {
  return ({overview:overviewPage,nodes:nodesPage,satellite:satellitePage,reference:referencePage,fusion:fusionPage,alerts:alertsPage}[route] || overviewPage)();
}

function renderDashboard() {
  if (!authorized) return landing();
  const route = currentRoute();
  const titles = {overview:"Overview",nodes:"Surface Node Network",satellite:"Satellite Monitoring",reference:"Stable Reference Zone",fusion:"AI Fusion & Prediction",alerts:"Alerts & Response"};
  document.title = `${titles[route]} – GeoTwin 360`;
  app.innerHTML = `${header()}${navigation(route)}<main class="dashboard">${pageFor(route)}</main>${footer()}<div id="modal-root"></div>`;
  updateCountdown();
  initMaps();
}

function openSettings() {
  const root = document.querySelector("#modal-root");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><button class="modal-close" data-action="close-modal">×</button><p class="eyebrow">DATA CONNECTION</p><h2>API settings</h2><p>Enter the base URL for your ESP32/LoRa gateway backend. No credentials are stored by this prototype.</p><form id="settings-form"><label>API base URL<input name="apiUrl" type="url" value="${esc(apiUrl)}" required></label><button class="primary-button wide" type="submit">Save settings</button></form></section></div>`;
  root.querySelector("#settings-form").addEventListener("submit", event => {
    event.preventDefault(); apiUrl = new FormData(event.currentTarget).get("apiUrl").trim().replace(/\/$/,""); localStorage.setItem("geotwin-api-url",apiUrl); root.innerHTML=""; renderDashboard(); toast("API endpoint saved.","success");
  });
}

function exportAlerts() {
  const rows = [["severity","node","event","time_ist","status","recommended_action"],["WATCH","MN-05-E","Heartbeat lost (offline)",`${formatIST(new Date(snapshot.minuteKey*60000))} IST`,alertStatus,"Check LoRa gateway / ESP32 power"]];
  const csv = rows.map(row=>row.map(csvEscape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  const link = document.createElement("a"); link.href=url; link.download=`GeoTwin_${MINE.id}_alerts.csv`; link.click(); URL.revokeObjectURL(url);
  toast("Alert report exported.","success");
}

async function refreshSnapshot(newMinute) {
  let overrides = {
    groundRisk: 0, satelliteRisk: 0, fusedRisk: 0, maxSubsidence: 0,
    nodesOnline: 0, totalNodes: 35, rtkFixed: 0, alertCount: 0, worstCluster: "—"
  };
  try {
    const response = await fetch(`${apiUrl}/snapshot?mineId=${encodeURIComponent(MINE.id)}`, {headers:{Accept:"application/json"},signal:AbortSignal.timeout(4500)});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    overrides = {...overrides,...await response.json()};
    toast("Live API snapshot received.","success");
  } catch (error) {
    toast(`Live API unavailable (${error.message}); values remain at zero until connected.`, "warning");
  }
  snapshot = snapshotForMinute(newMinute, overrides);
  riskHistory = [...riskHistory, {key:newMinute,ground:snapshot.groundRisk,satellite:snapshot.satelliteRisk,fused:snapshot.fusedRisk}].slice(-720);
  renderDashboard();
}

function updateCountdown() {
  const element = document.querySelector("#countdown");
  if (!element) return;
  const seconds = 60 - Math.floor(Date.now()/1000)%60;
  element.textContent = `00:${String(seconds%60).padStart(2,"0")}`;
}

document.addEventListener("click", event => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) { event.preventDefault(); window.history.pushState({},"",`/${routeTarget.dataset.route}`); renderDashboard(); return; }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "settings") return openSettings();
  if (action === "close-modal") { const root=document.querySelector("#modal-root"); if(root) root.innerHTML=""; return; }
  if (action === "logout") { authorized=false; sessionStorage.removeItem("geotwin-access"); window.history.replaceState({},"","/"); landing(); return; }
  if (action === "export") return exportAlerts();
  const modeTarget = event.target.closest("[data-mode]");
  if (modeTarget) { mode=modeTarget.dataset.mode; localStorage.setItem("geotwin-mode",mode); renderDashboard(); toast(`${mode.toUpperCase()} mode selected.`); return; }
  const expandTarget = event.target.closest("[data-expand]");
  if (expandTarget) { expandedNode = expandedNode===expandTarget.dataset.expand ? null : expandTarget.dataset.expand; renderDashboard(); return; }
  const alertTarget = event.target.closest("[data-alert]");
  if (alertTarget) { alertStatus=alertTarget.dataset.alert; localStorage.setItem("geotwin-alert-status",alertStatus); renderDashboard(); toast(`Alert ${alertStatus.toLowerCase()}.`,"success"); return; }
  const filterTarget = event.target.closest("[data-filter]");
  if (filterTarget) { alertFilter=filterTarget.dataset.filter; renderDashboard(); }
});

window.addEventListener("popstate", renderDashboard);
setInterval(() => {
  updateCountdown();
  const nowKey = Math.floor(Date.now()/60000);
  if (authorized && nowKey !== minuteKey) { minuteKey = nowKey; refreshSnapshot(nowKey); }
}, 1000);

if (!authorized && location.pathname !== "/") window.history.replaceState({},"","/");
renderDashboard();
