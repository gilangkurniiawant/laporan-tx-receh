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

    // URL API yang disembunyikan (tidak terlihat di frontend)
    const API_URL = 'https://core.akun.vip/apps/receh/api_laporan_lengkap.php';

    try {
        // Create AbortController untuk timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik timeout

        // Fetch dari API backend
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'RECEH-Laporan-Client/1.0'
            },
            signal: controller.signal
        });

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

