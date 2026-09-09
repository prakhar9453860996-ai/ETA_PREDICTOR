// Smart Transit ETA Prediction Dashboard
let treeChart = null;
let importanceChart = null;
let currentBatchData = [];
let batchPage = 1;
const BATCH_PAGE_SIZE = 10;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initControls();
    initGauge();
    loadModelInfo();
    loadDatasetStats();
    runPrediction();
});

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.add('hidden'));
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active', 'border-cyan-500', 'text-cyan-400'));
            
            document.getElementById(target).classList.remove('hidden');
            tab.classList.add('active', 'border-cyan-500', 'text-cyan-400');

            if (target === 'tab-analytics' && !importanceChart) {
                loadModelInfo();
            }
        });
    });
}

// Controls synchronization
function initControls() {
    const distanceSlider = document.getElementById('distSlider');
    const distanceInput = document.getElementById('distInput');
    const speedSlider = document.getElementById('speedSlider');
    const speedInput = document.getElementById('speedInput');
    const haltedToggle = document.getElementById('haltedToggle');

    // Distance
    distanceSlider.addEventListener('input', (e) => {
        distanceInput.value = parseFloat(e.target.value).toFixed(1);
        debouncePredict();
    });
    distanceInput.addEventListener('change', (e) => {
        distanceSlider.value = e.target.value;
        debouncePredict();
    });

    // Speed
    speedSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        speedInput.value = val.toFixed(1);
        drawSpeedGauge(val);
        if (val === 0) {
            haltedToggle.checked = true;
            updateHaltState(true);
        } else if (haltedToggle.checked) {
            haltedToggle.checked = false;
            updateHaltState(false);
        }
        debouncePredict();
    });
    speedInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        speedSlider.value = val;
        drawSpeedGauge(val);
        debouncePredict();
    });

    // Congestion radio cards
    document.querySelectorAll('input[name="congestion"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.congestion-card').forEach(c => c.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-950/40'));
            radio.closest('.congestion-card').classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-950/40');
            debouncePredict();
        });
    });

    // Weather buttons
    document.querySelectorAll('input[name="weather"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.querySelectorAll('.weather-card').forEach(c => c.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-950/40'));
            radio.closest('.weather-card').classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-950/40');
            debouncePredict();
        });
    });

    // Halted switch
    haltedToggle.addEventListener('change', (e) => {
        updateHaltState(e.target.checked);
        if (e.target.checked) {
            speedSlider.value = 0;
            speedInput.value = 0;
            drawSpeedGauge(0);
        } else if (parseFloat(speedInput.value) === 0) {
            speedSlider.value = 50;
            speedInput.value = 50;
            drawSpeedGauge(50);
        }
        debouncePredict();
    });

    // Batch Drag & Drop
    const dropZone = document.getElementById('dropZone');
    const csvFileInput = document.getElementById('csvFileInput');
    if (dropZone && csvFileInput) {
        dropZone.addEventListener('click', () => csvFileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-cyan-400'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-cyan-400'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-cyan-400');
            if (e.dataTransfer.files.length) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });
        csvFileInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }

    // Search
    const batchSearch = document.getElementById('batchSearch');
    if (batchSearch) {
        batchSearch.addEventListener('input', () => renderBatchTable());
    }
}

function updateHaltState(isHalted) {
    const badge = document.getElementById('haltStatusBadge');
    if (isHalted) {
        badge.innerHTML = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/60 text-red-300 border border-red-500/40"><span class="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 animate-pulse"></span>HALTED AT SIGNAL / STATION</span>';
    } else {
        badge.innerHTML = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-900/60 text-emerald-300 border border-emerald-500/40"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>IN TRANSIT (MOVING)</span>';
    }
}

// Preset Scenario loader
function loadScenario(type) {
    const scenarios = {
        express: { dist: 420.0, speed: 115.0, congestion: 1, weather: 0, halted: false },
        monsoon: { dist: 280.0, speed: 45.0, congestion: 4, weather: 1, halted: false },
        stationHalt: { dist: 95.0, speed: 0.0, congestion: 5, weather: 1, halted: true },
        fog: { dist: 175.0, speed: 25.0, congestion: 3, weather: 2, halted: false },
        terminal: { dist: 28.0, speed: 65.0, congestion: 0, weather: 0, halted: false }
    };

    const s = scenarios[type];
    if (!s) return;

    document.getElementById('distSlider').value = s.dist;
    document.getElementById('distInput').value = s.dist;
    document.getElementById('speedSlider').value = s.speed;
    document.getElementById('speedInput').value = s.speed;
    drawSpeedGauge(s.speed);

    // Congestion
    const congRadio = document.querySelector('input[name="congestion"][value="' + s.congestion + '"]');
    if (congRadio) {
        congRadio.checked = true;
        document.querySelectorAll('.congestion-card').forEach(c => c.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-950/40'));
        congRadio.closest('.congestion-card').classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-950/40');
    }

    // Weather
    const weatherRadio = document.querySelector('input[name="weather"][value="' + s.weather + '"]');
    if (weatherRadio) {
        weatherRadio.checked = true;
        document.querySelectorAll('.weather-card').forEach(c => c.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-950/40'));
        weatherRadio.closest('.weather-card').classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-950/40');
    }

    // Halted
    const haltToggle = document.getElementById('haltedToggle');
    haltToggle.checked = s.halted;
    updateHaltState(s.halted);

    runPrediction();
}

let predictTimeout = null;
function debouncePredict() {
    clearTimeout(predictTimeout);
    predictTimeout = setTimeout(runPrediction, 120);
}

// Run single prediction
async function runPrediction() {
    const remaining_km = parseFloat(document.getElementById('distInput').value) || 0;
    const current_speed_kmh = parseFloat(document.getElementById('speedInput').value) || 0;
    const congestion_score = parseInt(document.querySelector('input[name="congestion"]:checked')?.value || 0);
    const weather_encoded = parseInt(document.querySelector('input[name="weather"]:checked')?.value || 0);
    const is_halted = document.getElementById('haltedToggle').checked ? 1 : 0;

    const payload = {
        remaining_km,
        current_speed_kmh,
        congestion_score,
        weather_encoded,
        is_halted
    };

    try {
        const res = await fetch('/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.status === 'success') {
            displayPrediction(json.data);
        }
    } catch (err) {
        console.error('Prediction request error:', err);
    }
}

function displayPrediction(data) {
    document.getElementById('resEtaMinutes').textContent = data.predicted_remaining_minutes.toFixed(1);
    document.getElementById('resFormattedEta').textContent = data.formatted_eta;
    document.getElementById('resClockArrival').textContent = data.estimated_arrival_clock || '--:--';
    document.getElementById('resArrivalDate').textContent = data.estimated_arrival_date || '';

    document.getElementById('resConfidenceScore').textContent = `${data.confidence_score}%`;
    document.getElementById('resConfidenceBar').style.width = `${data.confidence_score}%`;
    document.getElementById('resCiRange').textContent = `${data.ci_95.lower}m — ${data.ci_95.upper}m`;
    document.getElementById('resStdDev').textContent = `± ${data.std_deviation} mins (tree dispersion)`;

    document.getElementById('resIdealMinutes').textContent = `${data.theoretical_minutes} mins`;
    document.getElementById('resDelayMinutes').textContent = `+${data.delay_minutes} mins delay`;

    renderTreeChart(data.tree_distribution, data.predicted_remaining_minutes);
}

function renderTreeChart(distribution, meanVal) {
    const ctx = document.getElementById('treeVoteChart');
    if (!ctx) return;

    const min = Math.min(...distribution);
    const max = Math.max(...distribution);
    const numBins = 12;
    const step = (max - min) / numBins || 1;
    const bins = Array(numBins).fill(0);
    const binLabels = [];

    for (let i = 0; i < numBins; i++) {
        const binStart = min + i * step;
        const binEnd = binStart + step;
        binLabels.push(`${binStart.toFixed(0)}-${binEnd.toFixed(0)}m`);
    }

    distribution.forEach(val => {
        let idx = Math.floor((val - min) / step);
        if (idx >= numBins) idx = numBins - 1;
        bins[idx]++;
    });

    if (treeChart) {
        treeChart.data.labels = binLabels;
        treeChart.data.datasets[0].data = bins;
        treeChart.update();
    } else {
        treeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: 'Tree Votes',
                    data: bins,
                    backgroundColor: 'rgba(6, 182, 212, 0.45)',
                    borderColor: '#06b6d4',
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.y} trees predicted in this range`
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#94a3b8', font: { size: 10 } },
                        grid: { color: 'rgba(51, 65, 85, 0.25)' }
                    }
                }
            }
        });
    }
}

function initGauge() {
    drawSpeedGauge(parseFloat(document.getElementById('speedInput')?.value || 65));
}

function drawSpeedGauge(speed) {
    const canvas = document.getElementById('speedGauge');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height - 10;
    const radius = Math.min(centerX, centerY) - 15;

    ctx.clearRect(0, 0, width, height);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.lineCap = 'round';
    ctx.stroke();

    const maxSpeed = 140;
    const clampedSpeed = Math.max(0, Math.min(speed, maxSpeed));
    const angle = Math.PI + (clampedSpeed / maxSpeed) * Math.PI;

    const grad = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    grad.addColorStop(0, '#06b6d4');
    grad.addColorStop(0.6, '#3b82f6');
    grad.addColorStop(1, '#f43f5e');

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, angle, false);
    ctx.lineWidth = 14;
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.stroke();

    const needleLen = radius - 10;
    const nx = centerX + needleLen * Math.cos(angle);
    const ny = centerY + needleLen * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
}

async function loadModelInfo() {
    try {
        const res = await fetch('/api/model-info');
        const json = await res.json();
        if (json.status !== 'success') return;
        const data = json.data;

        document.getElementById('metaEstimators').textContent = data.n_estimators || 100;
        document.getElementById('metaDepth').textContent = data.max_depth || 12;
        document.getElementById('metaSamples').textContent = data.trained_samples ? data.trained_samples.toLocaleString() : '12,000';
        document.getElementById('metaFeatures').textContent = data.feature_names.length;

        renderImportanceChart(data.feature_importances);
    } catch (err) {
        console.error('Error fetching model info:', err);
    }
}

function renderImportanceChart(importances) {
    const ctx = document.getElementById('featureImportanceChart');
    if (!ctx) return;

    const labels = Object.keys(importances).map(name => {
        const friendly = {
            remaining_km: 'Remaining Distance (km)',
            congestion_score: 'Congestion Score (0-5)',
            weather_encoded: 'Weather Condition (0-2)',
            current_speed_kmh: 'Current Speed (km/h)',
            is_halted: 'Movement Halt Status (0/1)'
        };
        return friendly[name] || name;
    });

    const values = Object.values(importances).map(v => +(v * 100).toFixed(2));

    if (importanceChart) {
        importanceChart.destroy();
    }

    importanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Relative Importance (%)',
                data: values,
                backgroundColor: [
                    'rgba(6, 182, 212, 0.75)',
                    'rgba(59, 130, 246, 0.75)',
                    'rgba(16, 185, 129, 0.75)',
                    'rgba(245, 158, 11, 0.75)',
                    'rgba(244, 63, 94, 0.75)'
                ],
                borderColor: [
                    '#06b6d4',
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#f43f5e'
                ],
                borderWidth: 1.5,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `Contribution: ${ctx.parsed.x}%`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Importance (%)', color: '#94a3b8' },
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.25)' }
                },
                y: {
                    ticks: { color: '#e2e8f0', font: { weight: 500 } },
                    grid: { display: false }
                }
            }
        }
    });
}

async function loadDatasetStats() {
    try {
        const res = await fetch('/api/dataset-stats');
        const json = await res.json();
        if (json.status !== 'success') return;
        const stats = json.stats;

        const container = document.getElementById('datasetStatsCards');
        if (!container) return;

        const cards = [
            { label: 'Total Records', val: stats.total_records ? stats.total_records.toLocaleString() : '15,000', icon: 'fa-database', color: 'text-cyan-400' },
            { label: 'Distance Range', val: `${stats.remaining_km.min} - ${stats.remaining_km.max} km`, icon: 'fa-route', color: 'text-blue-400' },
            { label: 'Avg Speed', val: `${stats.current_speed_kmh.mean} km/h`, icon: 'fa-gauge-high', color: 'text-emerald-400' },
            { label: 'Avg Target ETA', val: `${stats.target_remaining_minutes.mean} mins`, icon: 'fa-clock', color: 'text-amber-400' }
        ];

        container.innerHTML = cards.map(c => `
            <div class="glass-card p-4 rounded-xl flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center ${c.color}">
                    <i class="fa-solid ${c.icon} text-lg"></i>
                </div>
                <div>
                    <div class="text-xs text-slate-400">${c.label}</div>
                    <div class="text-lg font-bold text-white">${c.val}</div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Error fetching dataset stats:', err);
    }
}

async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);

    showBatchLoading(true);
    try {
        const res = await fetch('/api/predict-batch', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        showBatchLoading(false);
        if (json.status === 'success') {
            currentBatchData = json.predictions;
            batchPage = 1;
            renderBatchMetrics(json.metrics, json.total_count);
            renderBatchTable();
        } else {
            alert('Upload error: ' + (json.message || 'Unknown error'));
        }
    } catch (err) {
        showBatchLoading(false);
        alert('Failed to upload and predict batch CSV.');
    }
}

async function loadSampleBatch() {
    showBatchLoading(true);
    try {
        const res = await fetch('/api/sample-data');
        const json = await res.json();
        if (json.status === 'success') {
            const predRes = await fetch('/api/predict-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: json.samples })
            });
            const predJson = await predRes.json();
            showBatchLoading(false);
            if (predJson.status === 'success') {
                currentBatchData = predJson.predictions;
                batchPage = 1;
                renderBatchMetrics(predJson.metrics, predJson.total_count);
                renderBatchTable();
            }
        }
    } catch (err) {
        showBatchLoading(false);
        console.error('Error loading sample batch:', err);
    }
}

function showBatchLoading(show) {
    const el = document.getElementById('batchLoading');
    if (el) el.classList.toggle('hidden', !show);
}

function renderBatchMetrics(metrics, totalCount) {
    const container = document.getElementById('batchMetricsPanel');
    if (!container) return;

    if (!metrics) {
        container.innerHTML = `
            <div class="glass-card p-4 rounded-xl flex items-center justify-between col-span-full">
                <span class="text-sm text-slate-300">Processed <strong>${totalCount}</strong> rows.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="glass-card p-4 rounded-xl border border-cyan-500/30">
            <div class="text-xs text-slate-400">Evaluated Rows</div>
            <div class="text-2xl font-bold text-white">${metrics.evaluated_samples}</div>
        </div>
        <div class="glass-card p-4 rounded-xl border border-emerald-500/30">
            <div class="text-xs text-slate-400">MAE (Mean Absolute Error)</div>
            <div class="text-2xl font-bold text-emerald-400">${metrics.mae} <span class="text-xs text-slate-400">mins</span></div>
        </div>
        <div class="glass-card p-4 rounded-xl border border-blue-500/30">
            <div class="text-xs text-slate-400">RMSE</div>
            <div class="text-2xl font-bold text-blue-400">${metrics.rmse} <span class="text-xs text-slate-400">mins</span></div>
        </div>
        <div class="glass-card p-4 rounded-xl border border-amber-500/30">
            <div class="text-xs text-slate-400">R² Score (Accuracy)</div>
            <div class="text-2xl font-bold text-amber-400">${metrics.r2_score}</div>
        </div>
    `;
}

function renderBatchTable() {
    const tableBody = document.getElementById('batchTableBody');
    const pagination = document.getElementById('batchPagination');
    if (!tableBody) return;

    const searchTerm = (document.getElementById('batchSearch')?.value || '').toLowerCase();
    const filtered = currentBatchData.filter(row => {
        return row.remaining_km.toString().includes(searchTerm) ||
               row.current_speed_kmh.toString().includes(searchTerm) ||
               row.predicted_remaining_minutes.toString().includes(searchTerm);
    });

    const totalPages = Math.ceil(filtered.length / BATCH_PAGE_SIZE) || 1;
    if (batchPage > totalPages) batchPage = totalPages;
    const startIdx = (batchPage - 1) * BATCH_PAGE_SIZE;
    const pageRows = filtered.slice(startIdx, startIdx + BATCH_PAGE_SIZE);

    if (pageRows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No records to display.</td></tr>`;
        if (pagination) pagination.innerHTML = '';
        return;
    }

    tableBody.innerHTML = pageRows.map((r, i) => {
        const errorHtml = r.actual_remaining_minutes !== undefined ? `
            <span class="px-2 py-0.5 rounded text-xs ${Math.abs(r.error) < 10 ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/60 text-amber-300'}">
                ${r.actual_remaining_minutes}m (${r.error > 0 ? '+' : ''}${r.error}m)
            </span>
        ` : `<span class="text-slate-500">--</span>`;

        return `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 text-sm">
                <td class="py-2.5 px-3 text-slate-400 font-mono">#${startIdx + i + 1}</td>
                <td class="py-2.5 px-3 font-semibold text-white">${r.remaining_km} km</td>
                <td class="py-2.5 px-3">${r.current_speed_kmh} km/h</td>
                <td class="py-2.5 px-3"><span class="px-1.5 py-0.5 rounded text-xs bg-slate-800 text-cyan-300 border border-slate-700">Level ${r.congestion_score}</span></td>
                <td class="py-2.5 px-3">${r.weather_encoded === 0 ? '☀️ Clear' : r.weather_encoded === 1 ? '🌧️ Rain' : '⛈️ Storm'}</td>
                <td class="py-2.5 px-3">${r.is_halted ? '🛑 Halted' : '🟢 Moving'}</td>
                <td class="py-2.5 px-3 text-cyan-400 font-bold font-mono">${r.predicted_remaining_minutes}m (${r.formatted_eta})</td>
                <td class="py-2.5 px-3">${errorHtml}</td>
            </tr>
        `;
    }).join('');

    if (pagination) {
        pagination.innerHTML = `
            <div class="text-xs text-slate-400">Showing ${startIdx + 1} to ${Math.min(startIdx + BATCH_PAGE_SIZE, filtered.length)} of ${filtered.length} entries</div>
            <div class="flex gap-1.5">
                <button onclick="changeBatchPage(${batchPage - 1})" ${batchPage === 1 ? 'disabled' : ''} class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-300">Prev</button>
                <span class="px-3 py-1 text-xs text-slate-300 bg-slate-900 rounded border border-slate-700">${batchPage} / ${totalPages}</span>
                <button onclick="changeBatchPage(${batchPage + 1})" ${batchPage === totalPages ? 'disabled' : ''} class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs text-slate-300">Next</button>
            </div>
        `;
    }
}

function changeBatchPage(newPage) {
    batchPage = newPage;
    renderBatchTable();
}

function downloadBatchCSV() {
    if (!currentBatchData.length) {
        alert('No batch predictions available to export.');
        return;
    }

    const headers = ['remaining_km', 'current_speed_kmh', 'congestion_score', 'weather_encoded', 'is_halted', 'predicted_remaining_minutes', 'formatted_eta', 'actual_remaining_minutes', 'error'];
    const csvRows = [headers.join(',')];

    currentBatchData.forEach(r => {
        const row = [
            r.remaining_km,
            r.current_speed_kmh,
            r.congestion_score,
            r.weather_encoded,
            r.is_halted,
            r.predicted_remaining_minutes,
            '"' + r.formatted_eta + '"',
            r.actual_remaining_minutes !== undefined ? r.actual_remaining_minutes : '',
            r.error !== undefined ? r.error : ''
        ];
        csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eta_predictions_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
