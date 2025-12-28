/**
 * Vercel Serverless Function - API Proxy for Quest
 * Mengarahkan request ke api_quest.php di backend
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

    const API_URL = 'https://core.akun.vip/apps/receh/api_quest.php';

    try {
        // Prepare fetch options
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json', // Backend expects JSON? Or just for client? 
                // api_quest.php receives standard POST or GET. If passing JSON body, php needs to read php://input
                'User-Agent': 'RECEH-Quest-Proxy/1.0'
            }
        };

        // Construct target URL with query params for GET
        let targetUrl = API_URL;
        if (req.method === 'GET' && Object.keys(req.query).length > 0) {
            const queryParams = new URLSearchParams(req.query);
            targetUrl += `?${queryParams.toString()}`;
        }

        // Add body for POST
        if (req.method === 'POST') {
            // req.body is usually an object in Vercel functions if content-type was json
            fetchOptions.body = JSON.stringify(req.body);
        }

        // Fetch from backend
        const response = await fetch(targetUrl, fetchOptions);

        // Handle response
        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({
                success: false,
                message: `Backend API error: ${response.status}`,
                debug: errorText
            });
            return;
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('Quest Proxy error:', error);
        res.status(500).json({
            success: false,
            message: 'Proxy connection error: ' + (error.message || 'Unknown')
        });
    }
}
