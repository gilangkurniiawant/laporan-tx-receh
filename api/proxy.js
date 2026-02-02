/**
 * Vercel Serverless Function - API Proxy
 * Menyembunyikan URL API asli dari frontend
 */

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // URL API yang dinamis
    const endpoint = req.query.endpoint || 'api_laporan_lengkap.php';
    const API_URL = `https://core.akun.vip/apps/receh/${endpoint}`;

    try {
        // Create AbortController untuk timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik timeout

        // Persiapkan options untuk fetch
        const fetchOptions = {
            method: req.method,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'RECEH-Laporan-Client/1.0'
            },
            signal: controller.signal
        };

        // Jika ada body (POST/PUT), teruskan
        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            fetchOptions.headers['Content-Type'] = 'application/json';
        }

        // Fetch dari API backend
        const response = await fetch(API_URL, fetchOptions);

        clearTimeout(timeoutId);

        // Handle HTTP error codes
        if (!response.ok) {
            res.status(response.status).json({
                status: 'error',
                message: `API request failed with HTTP code: ${response.status}`
            });
            return;
        }

        // Parse JSON response
        const data = await response.json();

        // Process data for efficiency if it's the main report list
        if (data.status === 'success' && data.data && data.data.pengeluaran && endpoint === 'api_laporan_lengkap.php') {
            const d = new Date();
            const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
            const idTime = new Date(utc + (3600000 * 7)); // Indonesia GMT+7

            const targetMonth = idTime.getMonth();
            const targetYear = idTime.getFullYear();
            const todayDay = idTime.getDate();

            const allExp = data.data.pengeluaran;
            let yearlyTotal = 0;
            let monthlyTotal = 0;

            const monthlyExp = allExp.filter(item => {
                const itemDate = new Date(item.created_at.replace(' ', 'T'));
                const itemMonth = itemDate.getMonth();
                const itemYear = itemDate.getFullYear();
                const amount = parseInt(item.jumlah) || 0;

                if (itemYear === targetYear) {
                    yearlyTotal += amount;
                    if (itemMonth === targetMonth) {
                        monthlyTotal += amount;
                        return true;
                    }
                }
                return false;
            });

            // Calculate efficient summary
            const dailyAvg = monthlyTotal / todayDay;

            // Update data structure to be more efficient
            data.data.pengeluaran = monthlyExp;
            data.data.summary = {
                yearlyTotal,
                monthlyTotal,
                dailyAverage: dailyAvg,
                dataMonth: targetMonth,
                dataYear: targetYear,
                todayDay: todayDay
            };
        }

        // Return response ke frontend
        res.status(200).json(data);

    } catch (error) {
        // Error handling
        console.error('Proxy error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Proxy error: ' + (error.message || 'Unknown error')
        });
    }
}

