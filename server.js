const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Create submissions table on startup
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                gender VARCHAR(1) NOT NULL,
                age INTEGER NOT NULL,
                weight REAL NOT NULL,
                weight_unit VARCHAR(5) DEFAULT 'lbs',
                email VARCHAR(200),
                version VARCHAR(5) DEFAULT 'en',
                assessment_data JSONB,
                open_percentile INTEGER,
                tier VARCHAR(30),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('Database table ready');
    } catch (err) {
        console.error('DB init error:', err.message);
    }
}
if (process.env.DATABASE_URL) initDB();

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/health', (req, res) => res.json({ status: 'ok', version: '2.0' }));

// Submit assessment data
app.post('/api/submit', async (req, res) => {
    try {
        const { name, gender, age, weight, email, assessment_data, open_percentile, tier } = req.body;
        if (!name || !gender || !age || !weight) {
            return res.status(400).json({ error: 'Missing required fields: name, gender, age, weight' });
        }
        const result = await pool.query(
            `INSERT INTO submissions (name, gender, age, weight, weight_unit, email, version, assessment_data, open_percentile, tier)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [name, gender, age, weight, 'lbs', email || null, 'en', assessment_data || null, open_percentile || null, tier || null]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error('Submit error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get all submissions (admin)
app.get('/api/submissions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM submissions ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Query error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => console.log(`CrossFit AI Assessment (EN) running on port ${PORT}`));
