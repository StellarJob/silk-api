const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SILK_API_KEY;

function requireApiKey(req, res, next) {
  if (!API_KEY || req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/ip', async (req, res) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    res.json({ outbound_ip: data.ip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', requireApiKey, async (req, res) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      connectTimeout: 10000
    });
    const [rows] = await connection.execute('SELECT 1 AS test');
    res.json({ status: 'connected', result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
