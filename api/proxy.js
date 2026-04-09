// Vercel Serverless Function - API Proxy for external services
// This allows your customers to use the API without CORS issues

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // API Documentation endpoint
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'AgenticImage API',
      version: '1.0.0',
      description: 'AI-powered image processing with TensorFlow.js & Transformers.js',
      endpoints: {
        'POST /api/upload': 'Upload and process image',
        'GET /api/status': 'Check API status',
        'GET /api/models': 'List available models'
      },
      docs: 'https://agenticimage.vercel.app',
      status: 'operational',
      models: [
        { name: 'MobileNet', type: 'classification' },
        { name: 'Coco SSD', type: 'object-detection' },
        { name: 'Swin2SR', type: 'super-resolution' },
        { name: 'Real-CUGAN', type: 'super-resolution' }
      ]
    });
  }
  
  // Handle POST requests (image upload proxy)
  if (req.method === 'POST') {
    try {
      // This is where you'd proxy to imgbb.com or your own storage
      // For now, return info that client-side processing is used
      return res.status(200).json({
        success: true,
        message: 'Client-side processing active. Use the web interface or SDK.',
        webInterface: 'https://agenticimage.vercel.app',
        sdk: {
          npm: 'npm install agenticimage-sdk',
          cdn: 'https://agenticimage.vercel.app/sdk.js'
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}
