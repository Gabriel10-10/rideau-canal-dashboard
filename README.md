# Rideau Canal Skateway – Dashboard Service

This repository contains the **web dashboard and API** for the Rideau Canal Skateway real-time monitoring system.

It provides:

- A **Node.js / Express backend** that reads aggregated sensor data from **Azure Cosmos DB**
- A **single-page web dashboard** (HTML/CSS/JS + Chart.js) that visualizes:
  - Ice thickness  
  - Surface temperature  
  - Snow accumulation  
  - External temperature  
  - Safety status per location and overall canal status  

The data is produced by the IoT sensor simulator and processed by Azure Stream Analytics before being stored in Cosmos DB.

---

## Overview

### Dashboard Features (high level)

- **Real-time status** of three key locations:
  - Dow’s Lake  
  - Fifth Avenue  
  - NAC  
- **Location cards** showing:
  - Average ice thickness (cm)  
  - Average surface temperature (°C)  
  - Maximum snow accumulation (cm)  
  - Average external temperature (°C)  
  - Safety status (Safe / Caution / Unsafe)  
- **Time-series charts** (last hour, 5-minute windows):
  - Ice thickness  
  - Surface temperature  
  - Snow accumulation  
  - External temperature  
- **Overall canal safety indicator**:
  - Aggregates safety across all locations.

### Technologies Used

**Backend**

- Node.js (Runtime)
- Express.js (HTTP server + static file hosting)
- `@azure/cosmos` (Cosmos DB SDK)
- `dotenv` (loads configuration from `.env`)

**Frontend**

- HTML5, CSS3
- Vanilla JavaScript
- Chart.js (via CDN)

**Azure Services (dependencies from the wider project)**

- Azure Cosmos DB (SQL API)
- Azure App Service (hosting this dashboard)
- Azure Stream Analytics (writes aggregates to Cosmos DB)
- Azure IoT Hub + Python simulator (upstream data source)

---

## Prerequisites

To run this dashboard locally or deploy it, you need:

- **Node.js** 18+ (Node 20 recommended)
- **npm** (comes with Node)
- Access to an **Azure Cosmos DB (SQL API)** instance  
  - With a database and container populated by the Stream Analytics job
- The following information from Cosmos DB:
  - `COSMOS_ENDPOINT` – account URI
  - `COSMOS_KEY` – primary key or connection key
  - `COSMOS_DB_NAME` – database name
  - `COSMOS_CONTAINER_NAME` – container name (e.g. `SensorAggregations`)

> ⚠️ The dashboard **only reads** from Cosmos DB.  
> You must have the IoT simulator and Stream Analytics pipeline running to see real data.

---

## Installation

Clone the repository (or this subfolder) and install dependencies:

```bash
git clone <your-repo-url>
cd rideau-canal-dashboard

npm install
```

> Make sure you create a `.env` file (see **Configuration** below) before starting the app.

To run locally:

```bash
npm start
# or
node index.js
```

By default, the app uses `PORT` from `.env`. If you set `PORT=3000`, you can open:

```text
http://localhost:3000
```

to view the dashboard.

---

## Configuration

The dashboard reads configuration values from environment variables via `dotenv` in `index.js`.

Create a `.env` file in the root of `rideau-canal-dashboard`:

```env
# Port for the Express server
PORT=3000

# Cosmos DB configuration
COSMOS_ENDPOINT=https://<your-cosmos-account>.documents.azure.com:443/
COSMOS_KEY=<your-cosmos-primary-key>
COSMOS_DB_NAME=RideauCanalDb
COSMOS_CONTAINER_NAME=SensorAggregations
```

**Variables**

- `PORT`  
  The port Express listens on. Locally, this can be any free port (e.g. 3000).  
  On Azure App Service, the platform provides its own `PORT` value – you usually don’t hard-code it there.

- `COSMOS_ENDPOINT`  
  Cosmos DB account URI from the Azure portal.

- `COSMOS_KEY`  
  Primary key or a read-allowed key for Cosmos DB.

- `COSMOS_DB_NAME`  
  Name of the database that contains the aggregated sensor data.

- `COSMOS_CONTAINER_NAME`  
  Name of the container populated by the Stream Analytics job (for example, `SensorAggregations`).

If any of these variables are missing, `index.js` throws an error on startup so you notice misconfiguration early.

---

## API Endpoints

All endpoints are served from the same host as the dashboard (e.g. `https://your-app.azurewebsites.net`).

The frontend (`public/app.js`) uses these endpoints:

- `GET /api/latest`
- `GET /api/history/:sensorId`
- `GET /api/status`

Internally, the backend maintains a mapping:

```js
const LOCATIONS = [
  { id: 'dows',  name: "Dow's Lake" },
  { id: 'fifth', name: 'Fifth Avenue' },
  { id: 'nac',   name: 'NAC' }
];
```

Where:

- `id` → used in URLs (`/api/history/dows`)
- `name` → stored in Cosmos DB as `location` (`"Dow's Lake"`)

---

### `GET /api/latest`

Returns the **most recent 5-minute aggregate** for each known location.

**Response format**

```json
{
  "success": true,
  "data": [
    {
      "sensorId": "dows",
      "location": "Dow's Lake",
      "timestamp": "2025-12-09T01:30:00Z",
      "avgIceThickness": 32.4,
      "avgSurfaceTemperature": -6.1,
      "maxSnowAccumulation": 12.0,
      "avgExternalTemperature": -8.3,
      "safetyStatus": "Safe"
    },
    {
      "sensorId": "fifth",
      "location": "Fifth Avenue",
      "timestamp": "2025-12-09T01:30:00Z",
      "avgIceThickness": 28.7,
      "avgSurfaceTemperature": -1.0,
      "maxSnowAccumulation": 10.0,
      "avgExternalTemperature": -6.5,
      "safetyStatus": "Caution"
    },
    {
      "sensorId": "nac",
      "location": "NAC",
      "timestamp": "2025-12-09T01:30:00Z",
      "avgIceThickness": 24.2,
      "avgSurfaceTemperature": 0.3,
      "maxSnowAccumulation": 8.0,
      "avgExternalTemperature": -4.2,
      "safetyStatus": "Unsafe"
    }
  ]
}
```

**Example request**

```bash
curl https://your-app.azurewebsites.net/api/latest
```

This endpoint:

- Calls Cosmos DB for each location using `SELECT TOP 1 ... ORDER BY windowEndTime DESC`.
- Maps the row to a simpler object used by the cards in the UI.

---

### `GET /api/history/:sensorId`

Returns **last hour of historical data** for a given location (`dows`, `fifth`, `nac`).

Valid `sensorId` values:

- `dows`
- `fifth`
- `nac`

**Example request**

```bash
curl https://your-app.azurewebsites.net/api/history/dows
```

**Success response**

```json
[
  {
    "sensorId": "dows",
    "location": "Dow's Lake",
    "windowEndTime": "2025-12-09T00:45:00Z",
    "avgIceThickness": 31.2,
    "avgSurfaceTemperature": -5.8,
    "maxSnowAccumulation": 9.0,
    "avgExternalTemperature": -7.5,
    "safetyStatus": "Safe"
  },
  {
    "sensorId": "dows",
    "location": "Dow's Lake",
    "windowEndTime": "2025-12-09T00:50:00Z",
    "avgIceThickness": 31.5,
    "avgSurfaceTemperature": -5.9,
    "maxSnowAccumulation": 9.1,
    "avgExternalTemperature": -7.4,
    "safetyStatus": "Safe"
  }
]
```

The backend:

- Computes `oneHourAgoIso = now - 1 hour`.
- Executes:

  ```sql
  SELECT
    c.location,
    c.windowEndTime,
    c.avgIceThicknessCm,
    c.avgSurfaceTemperatureC,
    c.maxSnowAccumulationCm,
    c.avgExternalTemperatureC,
    c.safetyStatus
  FROM c
  WHERE c.location = @loc
    AND c.windowEndTime >= @since
  ORDER BY c.windowEndTime ASC
  ```

- Maps each row into the shape expected by the charts.

If an unknown `sensorId` is provided, the API responds with `400 Bad Request`.

---

### `GET /api/status`

Returns a **single overall canal safety status** for the header banner.

**Example request**

```bash
curl https://your-app.azurewebsites.net/api/status
```

**Example response**

```json
{
  "success": true,
  "overallStatus": "Caution"
}
```

Aggregation logic:

- If **any** location is `Unsafe` → `overallStatus = "Unsafe"`
- Else, if **any** location is `Caution` → `overallStatus = "Caution"`
- Else (all `Safe`) → `overallStatus = "Safe"`

The frontend uses this to show a colored badge like:

> Canal Status: Safe / Caution / Unsafe

---

## Deployment to Azure App Service

This section assumes you already have:

- An Azure subscription (e.g. Azure for Students)
- A running **Cosmos DB** instance with data from your Stream Analytics job

### 1. Create an Azure Web App

1. In the Azure portal, click **Create a resource** → **Web App**.
2. Select or create a **Resource Group**.
3. Choose:
   - **Publish**: Code  
   - **Runtime stack**: Node 18 LTS or Node 20 LTS  
   - **Region**: close to your Cosmos DB region
4. Give the Web App a **name**, e.g. `rideau-canal-dashboard`.
5. Create or reuse an **App Service Plan** (B1 or Free for testing).

Click **Review + Create**, then **Create**.

---

### 2. Configure application settings

In the Web App:

1. Go to **Configuration** → **Application settings**.
2. Add the same environment variables you use locally:

   - `COSMOS_ENDPOINT`  
   - `COSMOS_KEY`  
   - `COSMOS_DB_NAME`  
   - `COSMOS_CONTAINER_NAME`  


3. Optionally set `NODE_ENV=production`.

> You normally do **not** set `PORT` here – Azure injects the correct value and `index.js` reads it from `process.env.PORT`.

Click **Save** and restart the Web App if needed.

---

### 3. Deploy the code

You have multiple deployment options; two common ones:

#### Option A – Deploy from local machine (zip + run)

1. Build your app locally if needed (here it’s just Node + static files).
2. Zip the contents of `rideau-canal-dashboard`:

   ```bash
   cd rideau-canal-dashboard
   zip -r dashboard.zip .
   ```

3. In the Azure portal, open your Web App → **Deployment Center** → **Zip Deploy**.
4. Upload `dashboard.zip`.

#### Option B – GitHub Actions

1. Push the `rideau-canal-dashboard` folder to GitHub.
2. In the Web App → **Deployment Center** → **GitHub**.
3. Link your repository and branch.
4. Azure can generate a GitHub Actions workflow for a Node.js app automatically.
5. Commit the workflow; every push to that branch will redeploy the dashboard.

---

### 4. Verify deployment

1. Navigate to the Web App URL, e.g.:

   ```text
   https://rideau-canal-dashboard.azurewebsites.net
   ```

2. You should see:
   - The Rideau Canal header  
   - Three location cards  
   - Four charts (once data is available)  

3. Open the browser dev tools (`F12`) → Network tab and confirm:
   - `GET /api/latest`
   - `GET /api/history/dows`
   - `GET /api/status`

return successful responses.

---

## Dashboard Features (Detailed)

### Real-time Updates

- The frontend polls the backend every **30 seconds** (`REFRESH_INTERVAL` in `app.js`):

  ```js
  setInterval(updateDashboard, 30000);
  ```

- `updateDashboard()`:
  - Fetches `/api/latest` to refresh the cards.
  - Fetches `/api/status` for the overall badge.
  - Refreshes all charts by calling `/api/history/:sensorId` for each location.

### Charts and Visualizations

- Uses **Chart.js** line charts for:
  - Ice thickness (cm)
  - Surface temperature (°C)
  - Snow accumulation (cm)
  - External temperature (°C)

- All charts show **last hour** of data with a point every **5 minutes** (as produced by Stream Analytics).

- Different colors per location:
  - Dow’s Lake
  - Fifth Avenue
  - NAC

The labels are derived from `windowEndTime`, converted to local time strings.

### Safety Status Indicators

1. **Per-location badge** (inside each card):
   - Reads `safetyStatus` from `/api/latest`.
   - Applies CSS classes:
     - `.safety-badge.safe`
     - `.safety-badge.caution`
     - `.safety-badge.unsafe`

2. **Overall canal status** (top of page):
   - Based on `/api/status`.
   - Uses a similar badge style:
     - `.status-badge.safe`
     - `.status-badge.caution`
     - `.status-badge.unsafe`

These match the thresholds defined in the Stream Analytics query (based on average ice thickness and surface temperature).

---

## Troubleshooting

### 1. Dashboard loads but shows “Failed to fetch latest data”

**Possible causes**

- Wrong Cosmos DB endpoint or key in `.env` / Azure App Settings.
- Cosmos DB database or container name mismatch.
- Stream Analytics job not writing any documents yet.

**Actions**

- Double-check:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `COSMOS_DB_NAME`
  - `COSMOS_CONTAINER_NAME`
- In the Azure portal, open Cosmos DB → Data Explorer and verify documents exist.
- Check the App Service **Log stream** for errors like:
  - `Error in /api/latest: ...`
  - “Cosmos DB query failed”.

---

### 2. Charts are empty but cards show data

**Possible causes**

- `/api/history/:sensorId` returning an empty array (no data within the last hour).
- Stream Analytics job just started and hasn’t produced enough 5-minute windows yet.

**Actions**

- Wait ~5–10 minutes with the simulator running.
- Call `/api/history/dows` directly in the browser or with `curl` to see raw output.
- Confirm the `windowEndTime` values fall within the last hour.

---

### 3. Overall status is always “Unknown”

**Possible cause**

- `/api/latest` is returning no valid readings (empty array).

**Actions**

- Same as issue 1:
  - Verify Cosmos data is present.
  - Make sure Stream Analytics output alias matches the container the backend reads from.

---

### 4. App doesn’t start locally (missing PORT or Cosmos config)

**Symptom**

- Terminal shows an error like “Cosmos DB is not configured correctly” or the app exits immediately.

**Fix**

- Ensure `.env` exists and includes all required variables.
- Run:

  ```bash
  node index.js
  ```

  and check that no error is thrown.
- If necessary, temporarily log `COSMOS_ENDPOINT` etc. to verify they are loaded.

---

### 5. Azure App Service returns 500 errors on API routes

**Actions**

- In Azure portal → Web App → **Log stream**:
  - Look for stack traces from Express or Cosmos SDK.
- Check that:
  - App Service configuration matches your local `.env` (except `PORT`).
  - Node version in App Service is compatible with your app (e.g. 18 or 20).

---

If you want, we can now create a **separate README** for the sensor simulator or a high-level **project overview** document that links all three parts (simulation, processing, dashboard) together.
