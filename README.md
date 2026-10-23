# GeoTwin 360

A clean-room, editable recreation of the deployed GeoTwin Safeguard dashboard for the Churcha Coal Mining Region. Its layout, typography, colour system, navigation and visible monitoring workflows were matched against the public application. It models a 35-node LoRa/ESP32 surface network, stable RTK reference correction, Sentinel-1/NISAR validation, AI risk fusion, one-minute processing, and alert response.

## Run in VS Code

1. Install Node.js 18 or newer.
2. Extract this ZIP and open the folder in VS Code.
3. Open **Terminal → New Terminal**.
4. Run:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.
6. Enter Mine ID `CHURCHA-01` and press **Enter** or click **Load Dashboard**.

No `npm install` is required: the project uses only browser APIs and Node's built-in web server.

## Features

- Six routes: Overview, Surface Node Network, Satellite Monitoring, Stable Reference Zone, AI Fusion & Prediction, and Alerts & Response.
- Values appear only after the Mine ID is submitted.
- Data is held steady during each synchronized 60-second cycle and changes at the next minute boundary.
- Ground and satellite risks are combined as `75% ground + 25% satellite`.
- 7 main nodes, 28 wireless sub-nodes, and 3 stable reference nodes.
- Expandable node clusters, neighbour-distance changes, SVG trend charts, and an OpenStreetMap-backed AOI view.
- Live API connection only. Configure `GEOTWIN_API_URL=http://localhost:8000/api` to set the endpoint; if the API is unavailable, risk and sensor readings remain at zero rather than using placeholder values.
- Alert filtering, acknowledgement, escalation, and CSV report export.

## Expected live API shape

The frontend requests:

```text
GET /snapshot?mineId=CHURCHA-01
```

It accepts a JSON object with any of these optional properties:

```json
{
  "groundRisk": 31.8,
  "satelliteRisk": 42.9,
  "nodesOnline": 34,
  "maxSubsidence": -18.3,
  "alertCount": 1
}
```

Missing values remain zero until live sensor data is received.

## Important safety note

This student prototype is for visualization and engineering development. Do not use it as the sole life-safety system. A production deployment requires calibrated instruments, site-specific geotechnical thresholds, redundant communications and power, field validation, formal emergency procedures, and approval by the responsible mine-safety authorities.

OpenStreetMap tiles require internet access. All dashboards and sensor data remain usable when map tiles are unavailable, and the map panel shows a fallback notice.

## Source notice

This package is an independently written, editable recreation based on the public application. It does not contain Lovable's private project history, private platform files, credentials, or minified production bundle. To obtain those exact originals, export the codebase from the owning Lovable project.


## Push to GitHub

From this project folder, run:

```bash
git init
git add .
git commit -m "Remove demo data and default sensor values to zero"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the remote URL with your GitHub repository URL. If the repository already has a Git remote, skip `git remote add origin` and use its existing remote.
