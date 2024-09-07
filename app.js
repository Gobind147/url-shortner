const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

app.use(express.json()); // Parse JSON request bodies

// Serve static files 
app.use(express.static(path.join(__dirname)));

// MySQL connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // MySQL username
    password: 'xxxxxx', // MySQL password
    database: 'url_shortener'
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Connected to MySQL');
    }
});

// Utility function to generate a random short code
function generateShortCode() {
    return Math.random().toString(36).substring(2, 8);
}

// Function to validate URL format
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (err) {
        return false;
    }
}

// Create Short URL 
app.post('/shorten', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Check if the URL is valid
    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const shortCode = generateShortCode();
    const query = 'INSERT INTO urls (original_url, short_code, access_count) VALUES (?, ?, 0)';
    
    db.query(query, [url, shortCode], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        const fullShortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;

        res.status(201).json({
            id: result.insertId,
            url: url,
            shortCode: shortCode,
            shortUrl: fullShortUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    });
});

// Retrieve Original URL and increment access count
app.get('/:code', (req, res) => {
    const { code } = req.params;

    const query = 'SELECT * FROM urls WHERE short_code = ?';
    db.query(query, [code], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Short URL not found' });

        const originalUrl = results[0].original_url;

        // Increment the access count
        const updateQuery = 'UPDATE urls SET access_count = access_count + 1 WHERE short_code = ?';
        db.query(updateQuery, [code]);

        res.redirect(originalUrl);
    });
});

// Update an existing short URL 
app.put('/shorten/:code', (req, res) => {
    const { code } = req.params;
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Check if the URL is valid
    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    const query = 'UPDATE urls SET original_url = ?, updated_at = NOW() WHERE short_code = ?';
    
    db.query(query, [url, code], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Short URL not found' });

        res.status(200).json({
            shortCode: code,
            url: url,
            updatedAt: new Date().toISOString()
        });
    });
});

// Delete a short URL 
app.delete('/shorten/:code', (req, res) => {
    const { code } = req.params;

    const query = 'DELETE FROM urls WHERE short_code = ?';
    
    db.query(query, [code], (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Short URL not found' });

        res.status(204).send(); // No content response on successful deletion
    });
});

// Get URL statistics 
app.get('/shorten/:code/stats', (req, res) => {
    const { code } = req.params;

    const query = 'SELECT * FROM urls WHERE short_code = ?';
    
    db.query(query, [code], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length === 0) return res.status(404).json({ error: 'Short URL not found' });

        const stats = {
            id: results[0].id,
            url: results[0].original_url,
            shortCode: results[0].short_code,
            createdAt: results[0].created_at,
            updatedAt: results[0].updated_at,
            accessCount: results[0].access_count
        };

        res.status(200).json(stats);
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
