import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve built static files
app.use(express.static(path.join(__dirname, 'dist/public')));

// API routes (working)
app.get('/api/instances', (req, res) => {
  res.json({message: "Fresh app instances endpoint", working: true});
});

// Runtime dashboard APIs
app.get('/api/runtime-dashboard/metrics', (req, res) => {
  res.json({
    system: { cpu: 45, memory: 67, uptime: 3600, requests: 1234 },
    performance: { avgResponseTime: 42, errorRate: "0.1", throughput: 89 },
    timestamp: new Date().toISOString()
  });
});

// Catch-all for frontend routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Static server running on http://localhost:${PORT}`);
});
