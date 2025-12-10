/**
 * Rideau Canal Dashboard - Frontend Application
 * Handles data fetching, UI updates, and chart rendering
 */

// Configuration
const API_BASE_URL = window.location.origin;
const REFRESH_INTERVAL = 30000; // 30 seconds

// Global state – now 4 charts
let iceChart = null;
let tempChart = null;
let snowChart = null;
let extChart = null;

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    console.log('🚀 Initializing Rideau Canal Dashboard...');

    await updateDashboard();
    setInterval(updateDashboard, REFRESH_INTERVAL);

    console.log('✅ Dashboard initialized successfully');
}

/**
 * Update all dashboard data
 */
async function updateDashboard() {
  try {
    // 1) Latest aggregates
    const latestResponse = await fetch(`${API_BASE_URL}/api/latest`);
    const latestData = await latestResponse.json();

    if (latestData.success) {
      updateLocationCards(latestData.data);
      updateLastUpdateTime();
    }

    // 2) Overall status (own try/catch so charts still run if this fails)
    try {
      const statusResponse = await fetch(`${API_BASE_URL}/api/status`);
      const statusData = await statusResponse.json();
      if (statusData.success) {
        updateOverallStatus(statusData.overallStatus);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }

    // 3) Charts
    await updateCharts();
  } catch (error) {
    console.error('Error updating dashboard:', error);
    showError('Failed to fetch latest data. Retrying...');
  }
}


/**
 * Update the location cards (4 metrics)
 * Expects:
 *  - avgIceThickness
 *  - avgSurfaceTemperature
 *  - maxSnowAccumulation
 *  - avgExternalTemperature
 */
function updateLocationCards(locations) {
    locations.forEach(location => {
        const locationKey = getLocationKey(location.location);

        document.getElementById(`ice-${locationKey}`).textContent =
            location.avgIceThickness.toFixed(1);
        document.getElementById(`temp-${locationKey}`).textContent =
            location.avgSurfaceTemperature.toFixed(1);
        document.getElementById(`snow-${locationKey}`).textContent =
            location.maxSnowAccumulation.toFixed(1);
        document.getElementById(`ext-${locationKey}`).textContent =
            location.avgExternalTemperature.toFixed(1);

        const statusBadge = document.getElementById(`status-${locationKey}`);
        statusBadge.textContent = location.safetyStatus;
        statusBadge.className = `safety-badge ${location.safetyStatus.toLowerCase()}`;
    });
}

/**
 * Update overall status badge
 */
function updateOverallStatus(status) {
    const statusBadge = document.getElementById('overallStatus');
    statusBadge.className = `status-badge ${status.toLowerCase()}`;
    statusBadge.innerHTML = `<span class="status-text">Canal Status: ${status}</span>`;
}

/**
 * Update last update timestamp
 */
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-CA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = timeString;
}

/**
 * Update charts with historical data
 * Uses:
 *  - avgIceThickness
 *  - avgSurfaceTemperature
 *  - maxSnowAccumulation
 *  - avgExternalTemperature
 */
async function updateCharts() {
    try {
        const locations = [
          { id: 'dows', name: "Dow's Lake" },
          { id: 'fifth', name: 'Fifth Avenue' },
          { id: 'nac', name: 'NAC' }
        ];
        const colors = {
            "Dow's Lake": 'rgb(75, 192, 192)',
            "Fifth Avenue": 'rgb(255, 99, 132)',
            "NAC": 'rgb(54, 162, 235)'
        };

        const historicalData = await Promise.all(
            locations.map(async ({ id, name }) => {
               const response = await fetch(`${API_BASE_URL}/api/history/${id}`);
               const data = await response.json();
               return { location: name, data };
            })
        );

        // Labels (time)
        const labels = historicalData[0].data.map(d =>
            new Date(d.windowEndTime).toLocaleTimeString('en-CA', {
                hour: '2-digit',
                minute: '2-digit'
            })
        );

        // Datasets for each metric
        const iceDatasets = historicalData.map(({ location, data }) => ({
            label: location,
            data: data.map(d => d.avgIceThickness),
            borderColor: colors[location],
            backgroundColor: colors[location] + '33',
            tension: 0.4,
            fill: false
        }));

        const tempDatasets = historicalData.map(({ location, data }) => ({
            label: location,
            data: data.map(d => d.avgSurfaceTemperature),
            borderColor: colors[location],
            backgroundColor: colors[location] + '33',
            tension: 0.4,
            fill: false
        }));

        const snowDatasets = historicalData.map(({ location, data }) => ({
            label: location,
            data: data.map(d => d.maxSnowAccumulation),
            borderColor: colors[location],
            backgroundColor: colors[location] + '33',
            tension: 0.4,
            fill: false
        }));

        const extDatasets = historicalData.map(({ location, data }) => ({
            label: location,
            data: data.map(d => d.avgExternalTemperature),
            borderColor: colors[location],
            backgroundColor: colors[location] + '33',
            tension: 0.4,
            fill: false
        }));

        // Helper to create/update a chart
        function createOrUpdateChart(chartRef, canvasId, datasets, yLabel) {
            const ctx = document.getElementById(canvasId).getContext('2d');
            if (chartRef.chart) {
                chartRef.chart.data.labels = labels;
                chartRef.chart.data.datasets = datasets;
                chartRef.chart.update();
            } else {
                chartRef.chart = new Chart(ctx, {
                    type: 'line',
                    data: { labels, datasets },
                    options: {
                        responsive: false,
                        maintainAspectRatio: true,
                        plugins: {
                            legend: { position: 'top' },
                            title: { display: false }
                        },
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: {
                                    display: true,
                                    text: yLabel
                                }
                            }
                        }
                    }
                });
            }
        }

        // Create/update the 4 charts
        createOrUpdateChart({ get chart() { return iceChart; }, set chart(v) { iceChart = v; } },
            'iceThicknessChart', iceDatasets, 'Ice Thickness (cm)');
        createOrUpdateChart({ get chart() { return tempChart; }, set chart(v) { tempChart = v; } },
            'surfaceTempChart', tempDatasets, 'Surface Temperature (°C)');
        createOrUpdateChart({ get chart() { return snowChart; }, set chart(v) { snowChart = v; } },
            'snowChart', snowDatasets, 'Snow Accumulation (cm)');
        createOrUpdateChart({ get chart() { return extChart; }, set chart(v) { extChart = v; } },
            'externalTempChart', extDatasets, 'External Temperature (°C)');

    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

/**
 * Convert location name to key for DOM IDs
 */
function getLocationKey(location) {
    const keyMap = {
        "Dow's Lake": "dows",
        "Fifth Avenue": "fifth",
        "NAC": "nac"
    };
    return keyMap[location] || location.toLowerCase().replace(/[^a-z]/g, '');
}

function showError(message) {
    console.error(message);
}

document.addEventListener('DOMContentLoaded', initDashboard);
