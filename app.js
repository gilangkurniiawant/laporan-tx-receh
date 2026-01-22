// URL API disembunyikan melalui proxy backend (Vercel Serverless Function)
const API_URL = '/api/proxy';
const IMAGE_PROXY_URL = '/api/image'; // Proxy untuk gambar dari core.akun.vip

let allTransactions = [];
let isDataLoaded = false;
let currentPage = 1;
const itemsPerPage = 10;

const CATEGORIES = [
    "Kebutuhan Pokok",
    "Kebutuhan Bayi",
    "Tempat Tinggal",
    "Transportasi",
    "Gaya Hidup & Hiburan",
    "Sosial & Tak Terduga"
];

const KEYWORDS = {
    "Kebutuhan Pokok": [
        "tisu",
        "yakult",
        "nanas",
        "pepaya",
        "kerupuk",
        "usus",
        "bawang",
        "ayam",
        "kelapa",
        "tempe",
        "tahu",
        "terasi",
        "loncang",
        "beras",
        "elpiji",
        "gas",
        "tepung",
        "santan",
        "minyak",
        "telur",
        "sayur",
        "lauk",
        "bumbu",
        "belanja bulanan",
        "pasar",
        "alfamart",
        "indomaret",
        "makan",
        "nasi",
        "galon",
        "aqua",
        "terong",
        "cabe setan",
        "cabe merah",
        "tempe",
        "tahu asin",
        "labu siam"
    ],
    "Kebutuhan Bayi": [
        "anak",
        "bayi",
        "abi",
        "pampers",
        "dot",
        "susu",
        "popok",
        "bubur bayi",
        "diaper",
        "mamy poko",
        "sweety",
        "merries"
    ],
    "Tempat Tinggal": [
        "keyboard",
        "cctv",
        "tukang",
        "tangga",
        "kabel",
        "lampu ",
        "listrik",
        "gayung",
        "air",
        "token",
        "sampah",
        "iuran",
        "pbb",
        "sewa",
        "kost",
        "wifi",
        "indihome"
    ],
    "Transportasi": [
        "pertamx",
        "motor",
        "ojol",
        "bensin",
        "pertalite",
        "pertamax",
        "ojek",
        "grab",
        "gojek",
        "parkir",
        "service",
        "ganti oli",
        "ban",
        "tambal"
    ],
    "Gaya Hidup & Hiburan": [
        "sate",
        "cilok",
        "pentol",
        "some",
        "siomay",
        "seblak",
        "kopi",
        "jajan",
        "nonton",
        "netflix",
        "boker",
        "topup",
        "game",
        "shopee",
        "tiktok",
        "pulsa",
        "popmie",
        "lacang atom",
        "potato"
    ],
    "Sosial & Tak Terduga": [
        "sumbangan",
        "kondangan",
        "sedekah",
        "obat",
        "sakit",
        "darurat",
        "rumah sakit",
        "apotek",
        "infak"
    ]
};

let currentCategoryFilter = 'Semua';

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
    updateDateTime();
});

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('id-ID', options);
    const dateEl = document.getElementById('currentDateText');
    if (dateEl) dateEl.textContent = dateStr;

    const hours = now.getHours();
    let greeting = 'Halo, Admin 👋';
    if (hours < 12) greeting = 'Selamat Pagi, Admin ☀️';
    else if (hours < 15) greeting = 'Selamat Siang, Admin 🌤️';
    else if (hours < 18) greeting = 'Selamat Sore, Admin 🌅';
    else greeting = 'Selamat Malam, Admin 🌙';

    const greetingEl = document.getElementById('greetingText');
    if (greetingEl) greetingEl.textContent = greeting;
}

async function init() {
    toggleLoading(true);
    toggleSummaryLoading(true);
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();

        if (json.status === 'success') {
            allTransactions = json.data.pengeluaran || [];
            // Map categories to transactions if not already set
            allTransactions.forEach(t => {
                if (!t.kategori) t.kategori = predictCategory(t.keperluan || t.keterangan);
            });

            isDataLoaded = true;
            updateDisplay();
        } else {
            console.error('API Error:', json.message);
        }
    } catch (error) {
        console.warn('Fetch failed:', error);
    } finally {
        toggleLoading(false);
        toggleSummaryLoading(false);
    }
}

function updateDisplay() {
    const filtered = filterTransactions();
    calculateSummary();
    renderCategoryFilters();
    currentPage = 1;
    renderTransactions(filtered);
}

function filterTransactions() {
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    return allTransactions.filter(t => {
        let matchesCategory = false;
        if (currentCategoryFilter === 'Semua') {
            matchesCategory = true;
        } else if (currentCategoryFilter === 'Belum Ada Kategori') {
            matchesCategory = !t.kategori;
        } else {
            matchesCategory = t.kategori === currentCategoryFilter;
        }

        const text = (t.keperluan || t.keterangan || t.user_nama || '').toLowerCase();
        const matchesSearch = text.includes(searchVal);
        return matchesCategory && matchesSearch;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function calculateSummary() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        return new Date(dateStr.replace(' ', 'T'));
    };

    // Calculate Global Stats (not affected by search/category filters)
    const yearlyItems = allTransactions.filter(item => {
        const date = parseDate(item.created_at);
        return date.getFullYear() === currentYear;
    });

    const monthlyItems = yearlyItems.filter(item => {
        const date = parseDate(item.created_at);
        return date.getMonth() === currentMonth;
    });

    const yearlyTotal = yearlyItems.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);
    const monthlyTotal = monthlyItems.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    // Daily Average (Monthly)
    let dailyAverage = 0;
    if (monthlyItems.length > 0) {
        const activeDays = new Set();
        monthlyItems.forEach(item => {
            const date = parseDate(item.created_at);
            activeDays.add(date.toDateString());
        });
        if (activeDays.size > 0) dailyAverage = monthlyTotal / activeDays.size;
    }

    // Update Dashboard UI
    document.getElementById('totalPengeluaran').textContent = formatRupiah(yearlyTotal);
    document.getElementById('totalPengeluaranBulanIni').textContent = formatRupiah(monthlyTotal);
    document.getElementById('rataRataPengeluaranHarian').textContent = formatRupiah(dailyAverage);

    // Store these for the stats modal
    window.currentStats = { yearlyTotal, monthlyTotal, dailyAverage, monthlyItems };
}

let categoryChart = null;

window.showAnalysis = function () {
    const modal = document.getElementById('statsModal');
    modal.style.display = 'flex';
    requestAnimationFrame(() => modal.classList.add('show'));

    document.getElementById('statsYearTotal').textContent = formatRupiah(window.currentStats.yearlyTotal);
    document.getElementById('statsMonthTotal').textContent = formatRupiah(window.currentStats.monthlyTotal);
    document.getElementById('statsDailyAvg').textContent = formatRupiah(window.currentStats.dailyAverage);

    renderCategoryDetails();
    renderCategoryChart();
};

window.closeStatsModal = function () {
    const modal = document.getElementById('statsModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
};

function renderCategoryDetails() {
    const container = document.getElementById('categoryDetails');
    const items = window.currentStats.monthlyItems;

    // Group by category
    const breakdown = {};
    const uncategorizedItems = items.filter(t => !t.kategori);
    const hasUncategorized = uncategorizedItems.length > 0;

    CATEGORIES.forEach(cat => breakdown[cat] = { amount: 0, count: 0 });
    if (hasUncategorized) breakdown['Belum Ada Kategori'] = { amount: 0, count: 0 };

    items.forEach(t => {
        const cat = t.kategori || 'Belum Ada Kategori';
        if (breakdown[cat]) {
            breakdown[cat].amount += parseInt(t.jumlah) || 0;
            breakdown[cat].count++;
        }
    });

    const sorted = Object.entries(breakdown)
        .filter(([_, data]) => data.count > 0)
        .sort((a, b) => b[1].amount - a[1].amount);

    container.innerHTML = sorted.map(([name, data]) => `
        <div class="cat-detail-row" style="border-left-color: ${getCategoryColor(name)}">
            <div class="cat-name-info">
                <span class="cat-name">${name}</span>
                <span class="cat-count">${data.count} Transaksi</span>
            </div>
            <div class="cat-amount-info">
                <span class="cat-amount">- ${formatRupiah(data.amount)}</span>
                <span class="cat-percent">${((data.amount / window.currentStats.monthlyTotal) * 100).toFixed(1)}%</span>
            </div>
        </div>
    `).join('');
}

function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    const items = window.currentStats.monthlyItems;
    const breakdown = {};

    items.forEach(t => {
        const cat = t.kategori || 'Belum Ada Kategori';
        breakdown[cat] = (breakdown[cat] || 0) + (parseInt(t.jumlah) || 0);
    });

    const labels = Object.keys(breakdown);
    const data = Object.values(breakdown);
    const colors = labels.map(l => getCategoryColor(l));

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { family: 'Outfit', size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${formatRupiah(context.raw)}`;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function getCategoryColor(cat) {
    const colors = {
        "Kebutuhan Pokok": "#6366f1", // Indigo
        "Kebutuhan Bayi": "#8b5cf6", // Purple
        "Tempat Tinggal": "#f59e0b", // Amber
        "Transportasi": "#10b981",    // Emerald
        "Gaya Hidup & Hiburan": "#ec4899", // Pink
        "Sosial & Tak Terduga": "#ef4444", // Red
        "Belum Ada Kategori": "#94a3b8"   // Slate
    };
    return colors[cat] || "#cbd5e1";
}

function renderCategoryFilters() {
    const container = document.getElementById('categoryFilters');

    // Calculate total spending per category for sorting
    const categorySpending = {};
    CATEGORIES.forEach(cat => categorySpending[cat] = 0);
    allTransactions.forEach(t => {
        if (t.kategori && categorySpending.hasOwnProperty(t.kategori)) {
            categorySpending[t.kategori] += (parseInt(t.jumlah) || 0);
        }
    });

    // Sort CATEGORIES copy by spending descending
    const sortedCategories = [...CATEGORIES].sort((a, b) => categorySpending[b] - categorySpending[a]);

    const hasUncategorized = allTransactions.some(t => !t.kategori);
    let categories = ['Semua'];
    if (hasUncategorized) categories.push('Belum Ada Kategori');
    categories = [...categories, ...sortedCategories];

    container.innerHTML = categories.map(cat => `
        <div class="filter-chip ${currentCategoryFilter === cat ? 'active' : ''}" onclick="setCategoryFilter('${cat}')">
            ${cat}
        </div>
    `).join('');
}

window.setCategoryFilter = function (category) {
    currentCategoryFilter = category;
    updateDisplay();
};

function renderTransactions(filtered = null) {
    const listContainer = document.getElementById('transactionsList');
    const paginationContainer = document.getElementById('paginationControls');

    if (!filtered) {
        filtered = filterTransactions();
    }

    listContainer.innerHTML = '';
    paginationContainer.classList.add('hidden');

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.3;"></i>
                <p>Tidak ada transaksi ditemukan.</p>
            </div>
        `;
        return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    paginatedItems.forEach(t => {
        const title = t.keperluan || 'Pengeluaran';
        const user = t.user_nama;
        const amount = formatRupiah(t.jumlah);

        let imageBtn = '';
        if (t.link_foto) {
            let rawPath = t.link_foto;
            if (rawPath.includes('iili.io/')) {
                const parts = rawPath.split('iili.io/');
                if (parts.length > 1) rawPath = 's/' + btoa(parts[1]);
            }
            const photoUrl = `${IMAGE_PROXY_URL}?path=${encodeURIComponent(rawPath)}`;
            imageBtn = `<div class="photo-badge" onclick="showImage('${photoUrl}', '${title}', '${amount}')"><i class="fa-solid fa-image"></i> Lihat Bukti</div>`;
        }

        const item = document.createElement('div');
        item.className = 'transaction-item';

        // AI Categorization Logic
        let category = t.kategori || predictCategory(t.keperluan || t.keterangan);

        // Category Selector UI
        let categoryOptions = CATEGORIES.map(c => `<option value="${c}" ${c === category ? 'selected' : ''}>${c}</option>`).join('');
        const categorySelector = `
            <div class="category-wrapper">
                <select class="category-select ${category ? 'has-category' : ''}" onchange="updateCategory(${t.id}, this.value, this)">
                    <option value="" disabled ${!category ? 'selected' : ''}>Pilih Kategori</option>
                    ${categoryOptions}
                </select>
            </div>
        `;

        item.innerHTML = `
            <div class="t-left">
                <div class="t-icon"><i class="fa-solid fa-receipt"></i></div>
                <div class="t-details">
                    <h4>${title}</h4>
                    <p>${user}</p>
                    <div class="t-meta">
                        ${imageBtn}
                    </div>
                </div>
            </div>
            <div class="t-right">
                <span class="t-amount">- ${amount}</span>
                <span class="t-date">${t.tanggal_formatted}</span>
                <div class="t-meta-right">
                    ${categorySelector}
                    ${t.status && t.status.toLowerCase() !== 'approved' ? `<div class="t-status status-${t.status.toLowerCase()}">${t.status}</div>` : ''}
                </div>
            </div>
        `;
        listContainer.appendChild(item);
    });

    if (totalPages > 1) {
        paginationContainer.classList.remove('hidden');
        renderPaginationControls(totalPages);
    }
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    const scrollTarget = document.querySelector('.section-header');

    const createBtn = (text, page, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = text;
        if (isDisabled) btn.disabled = true;
        else btn.onclick = () => {
            currentPage = page;
            renderTransactions();
            if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth' });
        };
        return btn;
    };

    container.appendChild(createBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            container.appendChild(createBtn(i, i, i === currentPage));
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.padding = '10px';
            container.appendChild(dots);
        }
    }
    container.appendChild(createBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, false, currentPage === totalPages));
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => {
        updateDisplay();
    });

    const modal = document.getElementById('imageModal');
    const closeBtn = document.querySelector('.close-modal');

    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    };

    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const statsModal = document.getElementById('statsModal');
    if (statsModal) {
        statsModal.onclick = (e) => { if (e.target === statsModal) closeStatsModal(); };
    }

    // Scroll Control for Filters
    const scrollLeft = document.getElementById('scrollLeft');
    const scrollRight = document.getElementById('scrollRight');
    const filterContainer = document.getElementById('categoryFilters');

    if (scrollLeft && scrollRight && filterContainer) {
        scrollLeft.onclick = () => filterContainer.scrollBy({ left: -200, behavior: 'smooth' });
        scrollRight.onclick = () => filterContainer.scrollBy({ left: 200, behavior: 'smooth' });
    }
}

function formatRupiah(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
}

function toggleLoading(show) {
    const loader = document.getElementById('loading');
    const list = document.getElementById('transactionsList');
    if (show) {
        loader.classList.remove('hidden');
        list.classList.add('hidden');
    } else {
        loader.classList.add('hidden');
        list.classList.remove('hidden');
    }
}

function toggleSummaryLoading(show) {
    const elements = document.querySelectorAll('.skeleton, .skeleton-small');
    elements.forEach(el => {
        if (show) {
            el.style.opacity = '0.5';
        } else {
            el.style.opacity = '1';
            el.classList.remove('skeleton', 'skeleton-small');
        }
    });
}

window.showImage = function (url, caption, amount) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('caption');
    const loader = document.getElementById('modalLoader');

    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add('show'));

    // Sembunyikan gambar lama & tampilkan loader
    modalImg.classList.add('hidden');
    loader.classList.remove('hidden');

    captionText.textContent = `${caption} • ${amount}`;
    modalImg.src = url;

    modalImg.onload = () => {
        loader.classList.add('hidden');
        modalImg.classList.remove('hidden');
    };

    modalImg.onerror = () => {
        loader.classList.add('hidden');
        captionText.textContent = "Gagal memuat bukti pembayaran";
    };
}

function predictCategory(text) {
    if (!text) return "";
    text = text.toLowerCase();

    for (const [category, keywords] of Object.entries(KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) {
            return category;
        }
    }
    return "";
}

async function updateCategory(id, category, el) {
    if (el) el.classList.add('loading');
    showToast('Memperbarui kategori...', 'info');

    try {
        const response = await fetch(`${API_URL}?endpoint=api_update_kategori.php`, {
            method: 'POST',
            body: JSON.stringify({ id, kategori: category })
        });

        const res = await response.json();
        if (res.status === 'success') {
            const tx = allTransactions.find(t => t.id == id);
            if (tx) tx.kategori = category;
            updateDisplay();
            showToast('Kategori berhasil diperbarui', 'success');
        } else {
            showToast('Gagal: ' + res.message, 'error');
        }
    } catch (error) {
        console.error('Update category failed:', error);
        showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
        if (el) el.classList.remove('loading');
    }
}

let toastTimeout;
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;
    toast.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}
