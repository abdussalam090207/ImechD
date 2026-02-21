// ========== KODE ASLI ==========
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt');
let lastGateStatus = "";

document.addEventListener('DOMContentLoaded', () => {
    loadSavedLogs('log-water');
    loadSavedLogs('log-gate');
});

function getTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ":" +
        now.getMinutes().toString().padStart(2, '0') + ":" +
        now.getSeconds().toString().padStart(2, '0');
}

function addLog(targetId, col1, col2, colorClass = "", save = true) {
    const tbody = document.getElementById(targetId);
    const time = getTime();
    const rowHTML = `<tr><td class="text-time">${time}</td><td>${col1}</td><td class="${colorClass}">${col2}</td></tr>`;

    tbody.insertAdjacentHTML('afterbegin', rowHTML);
    if (tbody.rows.length > 30) tbody.deleteRow(tbody.rows.length - 1);

    if (save) {
        let logs = JSON.parse(localStorage.getItem(targetId)) || [];
        logs.unshift({ time, col1, col2, colorClass });
        if (logs.length > 30) logs.pop();
        localStorage.setItem(targetId, JSON.stringify(logs));
    }
}

function loadSavedLogs(targetId) {
    const tbody = document.getElementById(targetId);
    const logs = JSON.parse(localStorage.getItem(targetId)) || [];
    logs.reverse().forEach(log => {
        const rowHTML = `<tr><td class="text-time">${log.time}</td><td>${log.col1}</td><td class="${log.colorClass}">${log.col2}</td></tr>`;
        tbody.insertAdjacentHTML('afterbegin', rowHTML);
    });
}

function clearLog(type) {
    const targetId = 'log-' + type;
    localStorage.removeItem(targetId);
    document.getElementById(targetId).innerHTML = "";
}

function sendUnlock() {
    client.publish("robot/control", "unlock");
    addLog("log-gate", "Intervensi Web", "Pintu Terbuka ", "text-danger fw-bold");

    const btn = document.querySelector('.btn-unlock');
    btn.innerText = "🔒 Mengunci Paksa...";
    btn.className = "btn btn-danger w-100 mt-3";
    btn.disabled = true;

    setTimeout(() => {
        btn.innerText = "🔓 Membuka Pengunci";
        btn.className = "btn-unlock";
        btn.disabled = false;
    }, 5000);
}

client.on('connect', () => {
    client.subscribe('robot/#');
});

client.on('message', (topic, message) => {
    const rawMsg = message.toString().trim();

    if (topic === 'robot/air') {
        const dist = parseFloat(rawMsg);
        if (isNaN(dist)) return;
        const el = document.getElementById('air-text');

        if (dist < 10) {
            el.innerText = "Waspada Banjir Rop, kedalaman Air +- 11 cm";
            el.className = "status-box text-danger blink";
            addLog("log-water", `${dist} cm`, "Banjir Rop (+-11cm)", "text-danger fw-bold");
        } else if (dist < 14) {
            el.innerText = "Status siaga, kedalaman Air +- 7 cm";
            el.className = "status-box text-warning";
            addLog("log-water", `${dist} cm`, "Siaga (+-7cm)", "text-warning");
        } else {
            el.innerText = `Kondisi Air Normal (${dist} cm)`;
            el.className = "status-box text-info";
            addLog("log-water", `${dist} cm`, "Normal", "text-info");
        }
    }

    if (topic === 'robot/kapal') {
        const el = document.getElementById('ir-text');
        if (rawMsg === 'buka_gate') {
            el.innerText = "Kapal Terdeteksi";
            el.className = "status-box text-success";
            if (lastGateStatus !== "OPEN") {
                addLog("log-gate", "Kapal Terdeteksi", "Gate Terkunci", "text-success fw-bold");
                lastGateStatus = "OPEN";
            }
        } else if (rawMsg === 'standby') {
            el.innerText = "STANDBY";
            el.className = "status-box text-danger";
            if (lastGateStatus !== "IDLE") {
                addLog("log-gate", "Kapal Tidak Berlabuh", "Siaga/Tertutup", "text-muted");
                lastGateStatus = "IDLE";
            }
        }
    }

    if (topic === 'robot/led') {
        document.querySelectorAll('.led').forEach(l => l.classList.remove('on'));
        if (rawMsg === 'merah') document.getElementById('led-m').classList.add('on');
        if (rawMsg === 'kuning') document.getElementById('led-k').classList.add('on');
        if (rawMsg === 'hijau') document.getElementById('led-h').classList.add('on');
    }
});

// ========== KODE BARU: FITUR SIDEBAR + CHART + TOGGLE ICON ==========
const cities = [
    { name: "Jakarta", lat: -6.2088, lon: 106.8456 },
    { name: "Surabaya", lat: -7.2575, lon: 112.7521 },
    { name: "Bandung", lat: -6.9175, lon: 107.6191 }
];

let hourlyChart = null;

async function fetchWeather() {
    const container = document.getElementById('weather-container');
    let html = '';
    for (let city of cities) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&timezone=auto`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            const w = data.current_weather;
            const temperature = w.temperature;
            const wind = w.windspeed;
            const code = w.weathercode;
            let desc = getWeatherDesc(code);
            html += `
                        <div class="weather-card d-flex justify-content-between align-items-center">
                            <div>
                                <div class="weather-city">${city.name}</div>
                                <div class="weather-desc">${desc}</div>
                                <div class="small text-white">💨 ${wind} km/h</div>
                            </div>
                            <div class="weather-temp">${temperature}°C</div>
                        </div>
                    `;
        } catch (e) {
            html += `<div class="weather-card text-danger">Gagal memuat ${city.name}</div>`;
        }
    }
    container.innerHTML = html || '<div class="text-muted">Data tidak tersedia</div>';
    document.getElementById('weather-refresh').innerText = `⏱️ ${getTime()}`;
}

function getWeatherDesc(code) {
    if (code === 0) return 'Cerah';
    if (code === 1) return 'Umumnya cerah';
    if (code === 2) return 'Berawan';
    if (code === 3) return 'Berawan tebal';
    if (code >= 45 && code <= 49) return 'Kabut';
    if (code >= 51 && code <= 55) return 'Gerimis';
    if (code >= 61 && code <= 65) return 'Hujan';
    if (code >= 71 && code <= 75) return 'Salju';
    if (code >= 80 && code <= 82) return 'Hujan deras';
    if (code >= 95) return 'Badai';
    return 'Berawan';
}

async function fetchHourlyWeather() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-6.2088&longitude=106.8456&hourly=temperature_2m&timezone=auto&forecast_days=1';
    try {
        const res = await fetch(url);
        const data = await res.json();
        const hourly = data.hourly;
        const times = hourly.time.slice(0, 12).map(t => {
            const date = new Date(t);
            return date.getHours() + ':00';
        });
        const temps = hourly.temperature_2m.slice(0, 12);

        updateChart(times, temps);
        document.getElementById('chart-refresh').innerText = `⏱️ ${getTime()}`;
    } catch (e) {
        console.error('Gagal ambil data hourly:', e);
    }
}

function updateChart(labels, data) {
    const ctx = document.getElementById('hourlyTempChart').getContext('2d');
    if (hourlyChart) {
        hourlyChart.destroy();
    }
    hourlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Suhu (°C)',
                data: data,
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                borderWidth: 2,
                pointBackgroundColor: '#f0f6fc',
                pointBorderColor: '#58a6ff',
                tension: 0.2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    grid: { color: '#30363d' },
                    ticks: { color: '#8b949e' }
                },
                y: {
                    grid: { color: '#30363d' },
                    ticks: { color: '#8b949e' },
                    beginAtZero: false
                }
            }
        }
    });
}

const STORMGLASS_API_KEY = "3e6ed918-0eb5-11f1-b7ff-0242ac120004-3e6ed97c-0eb5-11f1-b7ff-0242ac120004";

async function updateTide() {
    try {
        const lat = -6.12;
        const lng = 106.83;

        const response = await fetch(
            `https://api.stormglass.io/v2/tide/sea-level/point?lat=${lat}&lng=${lng}`,
            {
                headers: {
                    "Authorization": STORMGLASS_API_KEY
                }
            }
        );

        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            document.getElementById('tide-desc').innerText = "Data tidak tersedia";
            return;
        }

        // Ambil data terbaru
        const latest = data.data[0];
        const level = parseFloat(latest.sg);

        document.getElementById('tide-value').innerText = level.toFixed(2) + " m";

        // Progress bar (estimasi min 0m max 3m)
        const percent = Math.min(Math.max((level / 3) * 100, 0), 100);
        document.getElementById('tide-progress').style.width = percent + "%";

        let desc = "";
        if (level < 0.8) desc = "Surut";
        else if (level > 1.6) desc = "Pasang Tinggi";
        else desc = "Normal";

        document.getElementById('tide-desc').innerText = desc + " (Realtime)";
        document.querySelector('.badge-bmkg').innerText = "Sumber: Stormglass API";

    } catch (error) {
        console.error("Gagal ambil data pasut:", error);
        document.getElementById('tide-desc').innerText = "Gagal koneksi API";
    }
}

function updateSidebarStatus() {
    document.getElementById('server-time').innerText = getTime();
    document.getElementById('last-update').innerText = getTime();
}

// ========== TOGGLE ICON SIDEBAR ==========
const sidebar = document.getElementById('fiturSidebar');
const toggleBtn = document.getElementById('sidebarToggle');

sidebar.addEventListener('show.bs.offcanvas', function () {
    toggleBtn.classList.add('icon-only');
    toggleBtn.innerHTML = '🌦️'; // hanya ikon
});

sidebar.addEventListener('hide.bs.offcanvas', function () {
    toggleBtn.classList.remove('icon-only');
    toggleBtn.innerHTML = '🌦️ Fitur &nbsp; ▸'; // kembali ke teks
});

// Initial fetch
fetchWeather();
fetchHourlyWeather();
updateTide();
updateSidebarStatus();

setInterval(() => {
    fetchWeather();
    fetchHourlyWeather();
    updateTide();
    updateSidebarStatus();
}, 30000);