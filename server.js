const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SILK_API_KEY;

function requireApiKey(req, res, next) {
  if (!API_KEY || req.headers['x-api-key'] !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

async function getConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    typeCast: function (field, next) {
      if (field.type === 'TINY' && field.length === 1) {
        return field.string() === '1';
      }
      return next();
    }
  });
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
    connection = await getConn();
    const [rows] = await connection.execute('SELECT 1 AS test');
    res.json({ status: 'connected', result: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

const ENTITY_TABLES = {
  entertainers: 'entertainers',
  'room-entries': 'room_entries',
  'room-prices': 'room_prices',
  transactions: 'transactions'
};

app.get('/api/:entity', requireApiKey, async (req, res) => {
  let connection;
  try {
    const table = ENTITY_TABLES[req.params.entity];
    if (!table) return res.status(404).json({ error: 'Unknown entity' });
    connection = await getConn();
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/api/:entity', requireApiKey, async (req, res) => {
  let connection;
  try {
    const table = ENTITY_TABLES[req.params.entity];
    if (!table) return res.status(404).json({ error: 'Unknown entity' });
    const data = req.body || {};
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No data provided' });
    const columns = keys.map(k => `\`${k}\``).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);
    connection = await getConn();
    const [result] = await connection.query(
      `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`,
      values
    );
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.put('/api/:entity/:id', requireApiKey, async (req, res) => {
  let connection;
  try {
    const table = ENTITY_TABLES[req.params.entity];
    if (!table) return res.status(404).json({ error: 'Unknown entity' });
    const id = req.params.id;
    const data = req.body || {};
    const keys = Object.keys(data);
    if (keys.length === 0) return res.status(400).json({ error: 'No data to update' });
    const setClause = keys.map(k => `\`${k}\` = ?`).join(', ');
    const values = keys.map(k => data[k]);
    connection = await getConn();
    await connection.query(`UPDATE \`${table}\` SET ${setClause} WHERE id = ?`, [...values, id]);
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.delete('/api/:entity/:id', requireApiKey, async (req, res) => {
  let connection;
  try {
    const table = ENTITY_TABLES[req.params.entity];
    if (!table) return res.status(404).json({ error: 'Unknown entity' });
    const id = req.params.id;
    connection = await getConn();
    await connection.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    res.json({ success: true, id: parseInt(id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.end();
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
