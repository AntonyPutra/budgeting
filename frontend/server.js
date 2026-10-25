const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const backendUrl = process.env.BACKEND_API_URL || 'http://finbot-backend:8000';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy endpoint untuk mengambil statistik dari backend
app.get('/api/proxy/stats', async (req, res) => {
  try {
    const response = await fetch(`${backendUrl}/api/dashboard/stats`);
    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy stats to backend:', err.message);
    res.status(502).json({
      success: false,
      error: 'Tidak dapat terhubung ke Backend Engine (finbot-backend:8000)',
      details: err.message,
    });
  }
});

// Proxy endpoint untuk test chat langsung dari web dashboard
app.post('/api/proxy/chat', async (req, res) => {
  try {
    const response = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to proxy chat to backend:', err.message);
    res.status(502).json({
      success: false,
      error: 'Gagal mengirim pesan ke Backend',
      details: err.message,
    });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`
==================================================
📊 FinBot Web Dashboard (Port ${port})
📡 Proxy Target: ${backendUrl}
🌐 Open via Tailscale: http://100.73.16.92:3002
==================================================
  `);
});
