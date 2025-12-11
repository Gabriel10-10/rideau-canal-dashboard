# Rideau Canal Dashboard – Backend API

This backend is a Node.js/Express service that exposes read-only endpoints used by the Rideau Canal dashboard frontend.  
It reads aggregated telemetry data from **Azure Cosmos DB** and returns JSON responses for the UI.

---

## 1. Configuration

The service is configured via environment variables (usually from a `.env` file):

```env
PORT=3000

COSMOS_ENDPOINT=<your-cosmos-endpoint-url>
COSMOS_KEY=<your-cosmos-key>
COSMOS_DB_NAME=RideauCanalDb
COSMOS_CONTAINER_NAME=SensorAggregations
```

If any Cosmos variable is missing, the server will throw an error at startup.

### Locations

Valid logical sensor IDs used by the API:

- `dows`  → "Dow's Lake"
- `fifth` → "Fifth Avenue"
- `nac`   → "NAC"

These IDs map to the `location` field stored in Cosmos DB.

---

## 2. Endpoints

Base URL (local): `http://localhost:<PORT>`

### 2.1 `GET /api/latest`

Returns the **latest 5-minute aggregate** for each known location.  
Used to populate the cards at the top of the dashboard.

**Response 200**

```json
{
  "success": true,
  "data": [
    {
      "sensorId": "dows",
      "location": "Dow's Lake",
      "timestamp": "2025-12-09T02:50:00Z",
      "avgIceThickness": 32.1,
      "avgSurfaceTemperature": -5.9,
      "maxSnowAccumulation": 24.9,
      "avgExternalTemperature": -9.2,
      "safetyStatus": "Safe"
    },
    {
      "sensorId": "fifth",
      "location": "Fifth Avenue",
      "...": "..."
    }
  ]
}
```

**Error 500**

```json
{ "error": "Latest query failed" }
```

---

### 2.2 `GET /api/history/:sensorId`

Returns the **last hour of aggregate data** for the given sensor/location.  
Data is ordered by `windowEndTime` ascending and is used to draw the charts.

**Path parameter**

- `sensorId` – one of: `dows`, `fifth`, `nac`.

**Examples**

- `/api/history/dows`
- `/api/history/fifth`

**Response 200**

Array of points (no `{ success, data }` wrapper):

```json
[
  {
    "sensorId": "dows",
    "location": "Dow's Lake",
    "windowEndTime": "2025-12-09T02:40:00Z",
    "avgIceThickness": 31.8,
    "avgSurfaceTemperature": -7.1,
    "maxSnowAccumulation": 22.3,
    "avgExternalTemperature": -11.2,
    "safetyStatus": "Safe"
  },
  {
    "sensorId": "dows",
    "location": "Dow's Lake",
    "windowEndTime": "2025-12-09T02:45:00Z",
    "...": "..."
  }
]
```

**Error 400 – unknown sensor ID**

```json
{ "error": "Unknown sensor id" }
```

**Error 500 – query failure**

```json
{ "error": "History query failed" }
```

---

### 2.3 `GET /api/status`

Returns an overall **canal safety status**, computed from the latest record of each location:

- If **any** location is `"Unsafe"` → overall `"Unsafe"`.
- Else if **any** location is `"Caution"` → overall `"Caution"`.
- Else if all are `"Safe"` → overall `"Safe"`.
- If no data → `"Unknown"`.

**Response 200**

```json
{
  "success": true,
  "overallStatus": "Safe"
}
```

**Error 500**

```json
{
  "success": false,
  "error": "Status failed"
}
```

---

## 3. Static Frontend & Fallback Route

- `app.use(express.static(path.join(__dirname, 'public')))`  
  serves the frontend assets from the `public/` directory.

- `GET *` (any other path)  
  falls back to `public/index.html`, allowing the dashboard to act like a single-page app.

---

## 4. Startup

Run the backend after installing dependencies:

```bash
npm install
npm start        # or: node index.js
```

On success, the console shows:

```text
Rideau Canal dashboard backend running on http://localhost:<PORT>
Using Cosmos DB: <COSMOS_DB_NAME> / <COSMOS_CONTAINER_NAME>
```
