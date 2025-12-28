/**
 * Vercel Serverless Function - Image Proxy
 * Menyembunyikan URL gambar dari core.akun.vip
 */

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Get image path from query parameter
    const imagePath = req.query.path;

    if (!imagePath) {
        res.status(400).json({
            status: 'error',
            message: 'Image path is required'
        });
        return;
    }

    // URL base yang disembunyikan
    const BASE_URL = 'https://core.akun.vip/apps/simka/';
    const IILI_BASE_URL = 'https://iili.io/';

    // Construct full URL
    let imageUrl;
    if (imagePath.startsWith('s/')) {
        // Decode base64 filename untuk menyembunyikan "iili"
        try {
            const encoded = imagePath.substring(2);
            const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
            imageUrl = IILI_BASE_URL + decoded;
        } catch (e) {
            imageUrl = IILI_BASE_URL; // Fallback bad request handled later by fetch
        }
    } else if (imagePath.startsWith('http')) {
        imageUrl = imagePath;
    } else {
        imageUrl = BASE_URL + imagePath;
    }

    try {
        // Create AbortController untuk timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik timeout

        // Fetch gambar dari backend
        const response = await fetch(imageUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'SIMKA-Laporan-Client/1.0'
            },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle HTTP error codes
        if (!response.ok) {
            res.status(response.status).json({
                status: 'error',
                message: `Image request failed with HTTP code: ${response.status}`
            });
            return;
        }

        // Get content type from response
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Set appropriate headers untuk gambar
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 1 hari

        // Get image buffer
        const imageBuffer = await response.arrayBuffer();

        // Return image
        res.status(200).send(Buffer.from(imageBuffer));

    } catch (error) {
        // Error handling
        console.error('Image proxy error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Image proxy error: ' + (error.message || 'Unknown error')
        });
    }
}

