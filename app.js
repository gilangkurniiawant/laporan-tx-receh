// URL API disembunyikan melalui proxy backend (Vercel Serverless Function)
const API_URL = '/api/proxy';
const IMAGE_PROXY_URL = '/api/image'; // Proxy untuk gambar dari core.akun.vip

// Fallback data in case of CORS/Network issues during development
const FALLBACK_DATA = {
    "status": "success",
    "message": "Data laporan berhasil diambil",
    "timestamp": "2025-12-12 20:42:53",
    "data": {
    }
};

let allTransactions = [];
let currentFilterType = 'all';
let isDataLoaded = false;
let currentPage = 1;
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
    toggleSummaryLoading(true);
});

async function init() {
    toggleLoading(true);
    toggleSummaryLoading(true);
    try {
        // Attempt to fetch from API
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();

        if (json.status === 'success') {
            processData(json.data);
            isDataLoaded = true;
        } else {
            console.error('API Error:', json.message);
            // Fallback
            processData(FALLBACK_DATA.data);
            isDataLoaded = true;
        }
    } catch (error) {
        console.warn('Fetch failed, using fallback data:', error);
        processData(FALLBACK_DATA.data);
        isDataLoaded = true;
    } finally {
        toggleLoading(false);
        toggleSummaryLoading(false);
    }
}

function processData(data) {
    // Render Summary
    document.getElementById('totalPengeluaran').textContent = data.saldo.total_pengeluaran ? formatRupiah(data.saldo.total_pengeluaran) : 'Rp 0';
    // Removed Balance and Income updates as requested

    // Hitung Pengeluaran Bulan Ini & Rata-rata Harian
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Pastikan format tanggal kompatibel (Safari/Firefox mungkin butuh 'T')
    const parseDate = (dateStr) => {
        if (!dateStr) return new Date();
        return new Date(dateStr.replace(' ', 'T'));
    };

    // Filter data pengeluaran bulan ini
    const monthlyItems = (data.pengeluaran || []).filter(item => {
        const date = parseDate(item.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Total Pengeluaran Bulan Ini
    const monthlyExpense = monthlyItems.reduce((acc, item) => acc + (parseInt(item.jumlah) || 0), 0);

    // Rata-rata Harian (dihitung berdasarkan jumlah HARI AKTIF yang ada pengeluaran)
    let dailyAverage = 0;
    if (monthlyItems.length > 0) {
        // Ambil tanggal unik (YYYY-MM-DD) dari setiap transaksi
        const activeDays = new Set();
        monthlyItems.forEach(item => {
            const date = parseDate(item.created_at);
            // Format YYYY-MM-DD
            const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            activeDays.add(dateString);
        });

        const activeDaysCount = activeDays.size;
        // console.log('Active Days:', activeDaysCount, activeDays); // Debugging

        if (activeDaysCount > 0) {
            dailyAverage = monthlyExpense / activeDaysCount;
        }
    }

    const elMonthExp = document.getElementById('totalPengeluaranBulanIni');
    const elDailyAvg = document.getElementById('rataRataPengeluaranHarian');

    if (elMonthExp) elMonthExp.textContent = formatRupiah(monthlyExpense);
    if (elDailyAvg) elDailyAvg.textContent = formatRupiah(dailyAverage);

    // Merge and Sort Transactions
    // Merge and Sort Transactions
    const expense = (data.pengeluaran || []).map(item => ({ ...item, type: 'pengeluaran' }));

    // Sort by date descending (newest first)
    // Assuming created_at 'YYYY-MM-DD HH:MM:SS'
    allTransactions = [...expense].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // Reset pagination to page 1 on new data
    currentPage = 1;
    renderTransactions();
}

function renderTransactions() {
    const listContainer = document.getElementById('transactionsList');
    const paginationContainer = document.getElementById('paginationControls');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();

    listContainer.innerHTML = '';
    paginationContainer.innerHTML = ''; // Clear pagination
    paginationContainer.classList.add('hidden');

    // Filter
    const filtered = allTransactions.filter(t => {
        const matchesType = currentFilterType === 'all' || t.type === currentFilterType;

        // Search in various fields
        const text = (t.keperluan || t.keterangan || t.user_nama || t.admin_nama || '').toLowerCase();
        const matchesSearch = text.includes(searchVal);

        return matchesType && matchesSearch;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                <i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 10px;"></i>
                <p>Tidak ada transaksi ditemukan.</p>
            </div>
        `;
        return;
    }

    // Pagination Logic
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Validate currentPage
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    // Render Items
    paginatedItems.forEach(t => {
        const isIncome = false; // Always false
        const title = t.keperluan || 'Pengeluaran';
        const user = t.user_nama;
        const amount = t.jumlah_formatted; // API provided formatted

        // Image handling - menggunakan proxy untuk menyembunyikan URL
        let imageBtn = '';
        if (t.link_foto) {
            // Gunakan proxy untuk menyembunyikan URL asli
            let rawPath = t.link_foto;

            // Logika khusus untuk menyembunyikan domain iili.io
            if (rawPath.includes('iili.io/')) {
                const parts = rawPath.split('iili.io/');
                if (parts.length > 1) {
                    // Encode dengan base64 agar tidak terbaca "iili"
                    rawPath = 's/' + btoa(parts[1]);
                }
            }

            const imagePath = encodeURIComponent(rawPath);
            const photoUrl = `${IMAGE_PROXY_URL}?path=${imagePath}`;
            imageBtn = `<div class="photo-badge" onclick="showImage('${photoUrl}', '${title}')"><i class="fa-solid fa-image"></i> Lihat Foto</div>`;
        }

        const iconClass = isIncome ? 'fa-arrow-down' : 'fa-shopping-cart'; // Arrow down for income (inbox), cart for expense

        const item = document.createElement('div');
        item.className = `transaction-item type-${t.type}`;
        item.innerHTML = `
            <div class="t-left">
                <div class="t-icon">
                    <i class="fa-solid ${iconClass}"></i>
                </div>
                <div class="t-details">
                    <h4>${title}</h4>
                    <p><i class="fa-solid fa-user" style="font-size: 0.8em"></i> ${user}</p>
                    ${imageBtn}
                </div>
            </div>
            <div class="t-right">
                <span class="t-amount">${isIncome ? '+' : '-'} ${amount}</span>
                <span class="t-date">${t.tanggal_formatted}</span>
                ${t.status ? `<span class="t-status status-${t.status.toLowerCase()}">${t.status}</span>` : ''}
            </div>
        `;
        listContainer.appendChild(item);
    });

    // Render Pagination Controls
    if (totalPages > 1) {
        paginationContainer.classList.remove('hidden');
        renderPaginationControls(totalPages);
    }
}

function renderPaginationControls(totalPages) {
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    const createButton = (text, page, isActive = false, isDisabled = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = text;
        if (isDisabled) {
            btn.disabled = true;
        } else {
            btn.onclick = () => {
                currentPage = page;
                renderTransactions();
                // Scroll to top of transaction list
                document.querySelector('.transactions-container').scrollIntoView({ behavior: 'smooth' });
            };
        }
        return btn;
    };

    // Prev Button
    container.appendChild(createButton('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));

    // Page Numbers Logic
    // Show: 1 ... 4 5 [6] 7 8 ... 20
    const maxVisibleButtons = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    // First Page
    if (startPage > 1) {
        container.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-info';
            container.appendChild(dots);
        }
    }

    // Numeric Pages
    for (let i = startPage; i <= endPage; i++) {
        container.appendChild(createButton(i, i, i === currentPage));
    }

    // Last Page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.className = 'pagination-info';
            container.appendChild(dots);
        }
        container.appendChild(createButton(totalPages, totalPages));
    }

    // Next Button
    container.appendChild(createButton('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, false, currentPage === totalPages));
}

function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilterType = e.target.dataset.tab;
            currentPage = 1; // RESET PAGE

            // Sync select box if exists
            const select = document.getElementById('typeFilter');
            if (select) select.value = currentFilterType;

            renderTransactions();
        });
    });

    // Select Filter
    // Select Filter removed
    /*
    document.getElementById('typeFilter').addEventListener('change', (e) => {
        currentFilterType = e.target.value;
        currentPage = 1; // RESET PAGE
        // Update tabs visual
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === currentFilterType);
        });
        renderTransactions();
    });
    */

    // Search
    document.getElementById('searchInput').addEventListener('input', () => {
        currentPage = 1; // RESET PAGE
        renderTransactions();
    });

    // Print (Modified with validation)
    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (!isDataLoaded) {
                showToast('Data sedang dimuat, mohon tunggu sebentar...', 'error');
                return;
            }
            if (allTransactions.length === 0) {
                showToast('Tidak ada data transaksi untuk dicetak.', 'error');
                return;
            }
            window.print();
        });
    }

    // Modal Close
    const modal = document.getElementById('imageModal');
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            document.getElementById('modalImage').src = '';
        }, 300);
    };

    document.querySelector('.close-modal').addEventListener('click', closeModal);

    // Close on click outside (background or caption)
    modal.addEventListener('click', (event) => {
        // Close if clicking the modal backdrop itself or the caption
        if (event.target === modal || event.target.id === 'caption' || event.target.classList.contains('modal-body')) {
            closeModal();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            closeModal();
        }
    });
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
    const cards = document.querySelectorAll('.summary-card');
    cards.forEach(card => {
        const amountElement = card.querySelector('.amount');
        if (show) {
            card.classList.add('loading');
            if (amountElement) {
                amountElement.classList.add('skeleton');
            }
        } else {
            card.classList.remove('loading');
            if (amountElement) {
                amountElement.classList.remove('skeleton');
            }
        }
    });
}

// Global scope for onclick
window.showImage = function (url, caption) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const captionText = document.getElementById('caption');
    const loader = document.getElementById('modalLoader');

    // Reset and show loader
    modalImg.style.display = 'none';
    if (loader) loader.classList.remove('hidden');

    // Show modal container
    modal.style.display = "flex";

    // Add animation class after small delay
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });

    // Set caption
    captionText.textContent = caption || '';

    // Load Image
    modalImg.src = url;

    modalImg.onload = function () {
        if (loader) loader.classList.add('hidden');
        modalImg.style.display = 'block';
    };

    modalImg.onerror = function () {
        if (loader) loader.classList.add('hidden');
        // showToast('Gagal memuat gambar', 'error');
    };
}

function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('active');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
