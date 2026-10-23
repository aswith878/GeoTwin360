export const MINE = {
  id: "CHURCHA-01",
  name: "Churcha Coal Mining Region",
  lat: 23.34,
  lon: 82.53,
  state: "Chhattisgarh, India"
};

export const MAIN_NODES = [
  { id: "MN-01", lat: 23.34467, lon: 82.52364, east: 0.39, north: -0.89, up: -3.74, tiltX: 0.039, tiltY: 0.023, vib: 0.012, ppv: 0.92, ae: 3, battery: 96, rssi: -101, rtk: "Fixed", geophone: true },
  { id: "MN-02", lat: 23.34629, lon: 82.53411, east: -0.76, north: -0.97, up: -7.45, tiltX: 0.073, tiltY: 0.037, vib: 0.013, ppv: null, ae: 4, battery: 71, rssi: -96, rtk: "Fixed" },
  { id: "MN-03", lat: 23.33928, lon: 82.53078, east: -2.84, north: -3.47, up: -18.62, tiltX: 0.158, tiltY: 0.088, vib: 0.029, ppv: 0.44, ae: 8, battery: 65, rssi: -92, rtk: "Float", geophone: true },
  { id: "MN-04", lat: 23.33569, lon: 82.52198, east: 0.74, north: 0.46, up: -4.71, tiltX: 0.020, tiltY: 0.009, vib: 0.011, ppv: null, ae: 2, battery: 70, rssi: -90, rtk: "Fixed" },
  { id: "MN-05", lat: 23.33623, lon: 82.53704, east: -1.91, north: 1.56, up: -11.54, tiltX: 0.088, tiltY: 0.053, vib: 0.026, ppv: 0.52, ae: 11, battery: 68, rssi: -89, rtk: "Fixed", geophone: true },
  { id: "MN-06", lat: 23.33174, lon: 82.52883, east: 0.44, north: 0.80, up: -5.67, tiltX: 0.050, tiltY: 0.025, vib: 0.008, ppv: null, ae: 5, battery: 64, rssi: -89, rtk: "Fixed" },
  { id: "MN-07", lat: 23.34225, lon: 82.54027, east: -0.53, north: -1.21, up: -5.45, tiltX: 0.025, tiltY: 0.017, vib: 0.010, ppv: null, ae: 4, battery: 87, rssi: -98, rtk: "Float" }
];

export const REFERENCE_NODES = [
  { id: "REF-01", lat: 23.36336, lon: 82.56131, east: -0.33, north: -2.31, up: -0.39, battery: 79, rssi: -95 },
  { id: "REF-02", lat: 23.36066, lon: 82.49674, east: -0.75, north: -2.39, up: -0.48, battery: 71, rssi: -77 },
  { id: "REF-03", lat: 23.31215, lon: 82.55837, east: -0.35, north: -2.00, up: -0.88, battery: 89, rssi: -86 }
];

const OFFSETS = {
  N: [0.00162, 0],
  E: [0, 0.00176],
  S: [-0.00162, 0],
  W: [0, -0.00176]
};

export const SUB_NODES = MAIN_NODES.flatMap((main, mainIndex) =>
  Object.entries(OFFSETS).map(([direction, [dLat, dLon]], index) => {
    const riskMultiplier = main.id === "MN-03" ? 1.65 : main.id === "MN-05" ? 1.25 : 0.65;
    const rel = Number((Math.abs(main.up) * (0.19 + index * 0.025) * riskMultiplier).toFixed(2));
    return {
      id: `${main.id}-${direction}`,
      parent: main.id,
      lat: main.lat + dLat,
      lon: main.lon + dLon,
      rel,
      tiltX: Number((main.tiltX * (0.66 + index * 0.08)).toFixed(3)),
      tiltY: Number((main.tiltY * (0.66 + index * 0.08)).toFixed(3)),
      vib: Number((main.vib * (0.72 + index * 0.07)).toFixed(3)),
      ae: Math.max(1, Math.round(main.ae * (0.55 + index * 0.11))),
      battery: Math.max(54, 85 - mainIndex - index * 2),
      rssi: -82 - mainIndex - index * 2,
      offline: main.id === "MN-05" && direction === "E"
    };
  })
);

export const SATELLITES = {
  sentinel: { name: "Sentinel-1", band: "C-Band SAR", displacement: -28.0, velocity: -10.9, coherence: 0.62, orbit: "Descending · Rel. orbit 63", age: "4.2 days", quality: "Moderate" },
  nisar: { name: "NISAR", band: "L-Band SAR", displacement: -25.5, velocity: -8.6, coherence: 0.57, orbit: "Ascending · Track 126", age: "10.8 days", quality: "Moderate" }
};

export const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function riskBand(score) {
  if (score >= 75) return "critical";
  if (score >= 50) return "warning";
  if (score >= 25) return "watch";
  return "normal";
}

export function fusedRisk(groundRisk, satelliteRisk, groundWeight = 0.75) {
  return Number((groundRisk * groundWeight + satelliteRisk * (1 - groundWeight)).toFixed(1));
}

export function vector3d(east, north, up) {
  return Math.sqrt(east ** 2 + north ** 2 + up ** 2);
}

export function snapshotForMinute(minuteKey = Math.floor(Date.now() / 60000), overrides = {}) {
  const random = mulberry32((minuteKey ^ 0x36025) >>> 0);
  const wave = Math.sin(minuteKey / 17) * 1.3;
  const groundRisk = Number(clamp(30.2 + wave + (random() - 0.5) * 2.6, 24, 48).toFixed(1));
  const satelliteRisk = 42.9;
  const fused = fusedRisk(groundRisk, satelliteRisk);
  const nodes = MAIN_NODES.map((node, index) => {
    const jitter = (random() - 0.5) * (index === 2 ? 0.75 : 0.24);
    const up = Number((node.up + jitter).toFixed(2));
    return { ...node, up, displacement3d: Number(vector3d(node.east, node.north, up).toFixed(2)) };
  });
  return {
    minuteKey,
    groundRisk,
    satelliteRisk,
    fusedRisk: fused,
    maxSubsidence: Math.min(...nodes.map(node => node.up)),
    nodesOnline: 34,
    totalNodes: 35,
    rtkFixed: 7,
    alertCount: 1,
    worstCluster: "MN-03",
    nodes,
    ...overrides,
    fusedRisk: overrides.fusedRisk ?? fusedRisk(overrides.groundRisk ?? groundRisk, overrides.satelliteRisk ?? satelliteRisk)
  };
}

export function buildHistory(current, count = 60) {
  return Array.from({ length: count }, (_, index) => {
    const key = current.minuteKey - (count - index - 1);
    const item = snapshotForMinute(key);
    return { key, ground: item.groundRisk, satellite: item.satelliteRisk, fused: item.fusedRisk };
  });
}

export function formatIST(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
