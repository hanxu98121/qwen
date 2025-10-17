// Vercel Serverless Function entry point
// This replaces the custom server.ts for Vercel deployment

export default function handler(req: any, res: any) {
  // Handle different API routes
  const { url } = req;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // For now, just return a simple response
  // In a real deployment, you would route to the appropriate API handlers
  res.status(200).json({
    message: 'API Server is running on Vercel',
    timestamp: new Date().toISOString(),
    url: url
  });
}