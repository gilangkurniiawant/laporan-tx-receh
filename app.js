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
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        return new Date(dateStr.replace(' ', 'T'));
    };

    // 1. Calculate Global Stats for Analysis Modal (Always Monthly, regardless of filter)
    const globalMonthlyItems = allTransactions.filter(item => {
        const date = parseDate(item.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const globalYearlyTotal = allTransactions.filter(item => {
        const date = parseDate(item.created_at);
        return date.getFullYear() === currentYear;
    }).reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    const globalMonthlyTotal = globalMonthlyItems.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    let globalDailyAvg = 0;
    if (globalMonthlyItems.length > 0) {
        const days = new Set(globalMonthlyItems.map(i => parseDate(i.created_at).toDateString())).size;
        if (days > 0) globalDailyAvg = globalMonthlyTotal / days;
    }

    window.currentStats = {
        yearlyTotal: globalYearlyTotal,
        monthlyTotal: globalMonthlyTotal,
        dailyAverage: globalDailyAvg,
        monthlyItems: globalMonthlyItems
    };

    // 2. Calculate Filtered Stats for Dashboard Cards
    const filteredData = allTransactions.filter(t => {
        let matchesCategory = false;
        if (currentCategoryFilter === 'Semua') {
            matchesCategory = true;
        } else if (currentCategoryFilter === 'Belum Ada Kategori') {
            matchesCategory = !t.kategori;
        } else {
            matchesCategory = t.kategori === currentCategoryFilter;
        }
        const text = (t.keperluan || t.keterangan || t.user_nama || '').toLowerCase();
        return matchesCategory && text.includes(searchVal);
    });

    const yearlyFiltered = filteredData.filter(item => parseDate(item.created_at).getFullYear() === currentYear);
    const monthlyFiltered = yearlyFiltered.filter(item => parseDate(item.created_at).getMonth() === currentMonth);

    const cardsYearlyTotal = yearlyFiltered.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);
    const cardsMonthlyTotal = monthlyFiltered.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    let cardsDailyAvg = 0;
    if (monthlyFiltered.length > 0) {
        const days = new Set(monthlyFiltered.map(i => parseDate(i.created_at).toDateString())).size;
        if (days > 0) cardsDailyAvg = cardsMonthlyTotal / days;
    }

    // Update Dashboard UI with Filtered stats
    document.getElementById('totalPengeluaran').textContent = formatRupiah(cardsYearlyTotal);
    document.getElementById('totalPengeluaranBulanIni').textContent = formatRupiah(cardsMonthlyTotal);
    document.getElementById('rataRataPengeluaranHarian').textContent = formatRupiah(cardsDailyAvg);

    // Update Filter Labels in Cards
    let filterText = '';
    if (currentCategoryFilter !== 'Semua') {
        filterText = `Filter: ${currentCategoryFilter}`;
    }
    if (searchVal) {
        filterText = filterText ? `${filterText} + "${searchVal}"` : `Cari: "${searchVal}"`;
    }

    const filterElements = [
        'totalPengeluaranFilter',
        'totalPengeluaranBulanIniFilter',
        'rataRataPengeluaranHarianFilter'
    ];

    filterElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = filterText;
            el.style.opacity = filterText ? '1' : '0';
        }
    });
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
    if (!container) return;

    if (!window.currentStats || !window.currentStats.monthlyItems || window.currentStats.monthlyItems.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary); opacity: 0.6;">
                <i class="fa-solid fa-chart-pie" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Belum ada data pengeluaran bulan ini.</p>
            </div>
        `;
        return;
    }

    const items = window.currentStats.monthlyItems;
    const monthlyTotal = window.currentStats.monthlyTotal || 1;

    // Group items by category for breakdown
    const itemsByCategory = {};
    CATEGORIES.forEach(cat => itemsByCategory[cat] = []);
    itemsByCategory['Belum Ada Kategori'] = [];

    items.forEach(t => {
        const cat = t.kategori || 'Belum Ada Kategori';
        if (itemsByCategory[cat]) {
            itemsByCategory[cat].push(t);
        } else {
            if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
            itemsByCategory[cat].push(t);
        }
    });

    const breakdown = Object.entries(itemsByCategory)
        .map(([name, catItems]) => ({
            name,
            items: catItems,
            total: catItems.reduce((sum, i) => sum + (parseInt(i.jumlah) || 0), 0)
        }))
        .filter(b => b.items.length > 0)
        .sort((a, b) => b.total - a.total);

    container.innerHTML = breakdown.map(b => {
        const tableRows = b.items.map(t => {
            const dateStr = t.tanggal_formatted ? t.tanggal_formatted.split(',')[0] : '?';
            const desc = t.keperluan || t.keterangan || 'Pengeluaran';
            return `
                <tr>
                    <td class="td-date">${dateStr}</td>
                    <td>${desc}</td>
                    <td class="td-price">${formatRupiah(t.jumlah)}</td>
                </tr>
            `;
        }).join('');

        const percent = ((b.total / monthlyTotal) * 100).toFixed(1);

        return `
            <div class="cat-detail-row" onclick="this.classList.toggle('open')" style="border-left-color: ${getCategoryColor(b.name)}">
                <div class="cat-row-main">
                    <div class="cat-name-info">
                        <span class="cat-name">${b.name}</span>
                        <span class="cat-count">${b.items.length} Transaksi</span>
                    </div>
                    <div class="cat-amount-info">
                        <span class="cat-amount">- ${formatRupiah(b.total)}</span>
                        <span class="cat-percent">${percent}% <i class="fa-solid fa-chevron-down"></i></span>
                    </div>
                </div>
                <div class="cat-detail-table">
                    <table class="mini-table">
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
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

// Prevent Double-Tap Zoom on iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);
