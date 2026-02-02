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

    try {
        // URL API yang dinamis
        const endpoint = req.query.endpoint || 'api_laporan_lengkap.php';
        let targetUrl = `https://core.akun.vip/apps/receh/${endpoint}`;

        // Teruskan query params (period, month, year, dll)
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'endpoint') params.append(key, value);
        }
        if (params.toString()) {
            targetUrl += `?${params.toString()}`;
        }

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
        const response = await fetch(targetUrl, fetchOptions);

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

        // No more manual filtering here as PHP backend handles it now.
        if (data.status === 'success' && data.data && data.data.pengeluaran && !data.data.summary) {
            data.data.summary = {
                yearlyTotal: 0,
                monthlyTotal: data.data.pengeluaran.reduce((acc, t) => acc + (parseInt(t.jumlah) || 0), 0),
                dailyAverage: 0
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
