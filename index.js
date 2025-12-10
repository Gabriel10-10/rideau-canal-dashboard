// index.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { CosmosClient } = require('@azure/cosmos');

const app = express();
const port = process.env.PORT || 3000;

// ---- Cosmos config from .env ----
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const COSMOS_DB_NAME = process.env.COSMOS_DB_NAME;
const COSMOS_CONTAINER_NAME = process.env.COSMOS_CONTAINER_NAME;

if (!COSMOS_ENDPOINT || !COSMOS_KEY || !COSMOS_DB_NAME || !COSMOS_CONTAINER_NAME) {
  throw new Error('COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DB_NAME, COSMOS_CONTAINER_NAME must be set in .env');
}

const cosmosClient = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  key: COSMOS_KEY
});
const container = cosmosClient
  .database(COSMOS_DB_NAME)
  .container(COSMOS_CONTAINER_NAME);

// Locations shown on the dashboard
// id = what frontend uses in URLs (dows, fifth, nac)
// name = value stored in Cosmos DB (location field)
const LOCATIONS = [
  { id: 'dows',  name: "Dow's Lake" },
  { id: 'fifth', name: 'Fifth Avenue' },
  { id: 'nac',   name: 'NAC' }
];

// Serve the Vue/JS frontend
app.use(express.static(path.join(__dirname, 'public')));

// ---- Helper: get latest aggregate for a location ----
async function getLatestForLocation(loc) {
  const querySpec = {
    query: `
      SELECT TOP 1
        c.location,
        c.windowEndTime,
        c.avgIceThicknessCm,
        c.avgSurfaceTemperatureC,
        c.maxSnowAccumulationCm,
        c.avgExternalTemperatureC,
        c.safetyStatus
      FROM c
      WHERE c.location = @loc
      ORDER BY c.windowEndTime DESC
    `,
    parameters: [{ name: '@loc', value: loc.name }]
  };

  const { resources } = await container.items
    .query(querySpec, { enableCrossPartitionQuery: true })
    .fetchAll();

  if (!resources.length) {
    return null;
  }

  const row = resources[0];

  // Map aggregated fields → what the dashboard expects
  return {
    sensorId: loc.id,
    location: row.location,
    timestamp: row.windowEndTime,
    avgIceThickness: row.avgIceThicknessCm,
    avgSurfaceTemperature: row.avgSurfaceTemperatureC,
    maxSnowAccumulation: row.maxSnowAccumulationCm,
    avgExternalTemperature: row.avgExternalTemperatureC,
    safetyStatus: row.safetyStatus
  };

}

// ---- API: latest per location (used by cards at the top) ----
// ---- API: latest per location (used by cards at the top) ----
app.get('/api/latest', async (req, res) => {
  try {
    const results = [];
    for (const loc of LOCATIONS) {
      const latest = await getLatestForLocation(loc);
      if (latest) results.push(latest);
    }

    
    res.json({
      success: true,
      data: results
    });

  } catch (err) {
    console.error('Error in /api/latest:', err);
    res.status(500).json({ error: 'Latest query failed' });
  }
});

// ---- API: history for charts (last hour, per location) ----
app.get('/api/history/:sensorId', async (req, res) => {
  const sensorId = req.params.sensorId;
  const loc = LOCATIONS.find(l => l.id === sensorId);

  if (!loc) {
    return res.status(400).json({ error: 'Unknown sensor id' });
  }

  const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const querySpec = {
      query: `
        SELECT
          c.location,
          c.windowEndTime,
          c.avgIceThicknessCm,
          c.avgSurfaceTemperatureC,
          c.maxSnowAccumulationCm,
          c.avgExternalTemperatureC,
          c.safetyStatus
        FROM c
        WHERE c.location = @loc AND c.windowEndTime >= @since
        ORDER BY c.windowEndTime ASC
      `,
      parameters: [
        { name: '@loc', value: loc.name },
        { name: '@since', value: oneHourAgoIso }
      ]
    };

    const { resources } = await container.items
      .query(querySpec, { enableCrossPartitionQuery: true })
      .fetchAll();

    const mapped = resources.map(row => ({
      sensorId,
      location: row.location,
      windowEndTime: row.windowEndTime,      // label source expected by frontend
      avgIceThickness: row.avgIceThicknessCm,
      avgSurfaceTemperature: row.avgSurfaceTemperatureC,
      maxSnowAccumulation: row.maxSnowAccumulationCm,
      avgExternalTemperature: row.avgExternalTemperatureC,
      safetyStatus: row.safetyStatus
    }));

    // Return a raw array (NOT wrapped in { success, data })
    res.json(mapped);
  } catch (err) {
    console.error('Error in /api/history:', err);
    res.status(500).json({ error: 'History query failed' });
  }
});


app.get('/api/status', async (req, res) => {
  try {
    const results = [];
    for (const loc of LOCATIONS) {
      const latest = await getLatestForLocation(loc);
      if (latest) results.push(latest);
    }

    let overall = 'Unknown';
    if (results.length) {
      if (results.some(r => r.safetyStatus === 'Unsafe')) overall = 'Unsafe';
      else if (results.some(r => r.safetyStatus === 'Caution')) overall = 'Caution';
      else overall = 'Safe';
    }

    res.json({ success: true, overallStatus: overall });
  } catch (e) {
    console.error('Error in /api/status:', e);
    res.status(500).json({ success: false, error: 'Status failed' });
  }
});

// Fallback → SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Rideau Canal dashboard backend running on http://localhost:${port}`);
  console.log(`Using Cosmos DB: ${COSMOS_DB_NAME} / ${COSMOS_CONTAINER_NAME}`);
});