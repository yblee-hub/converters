const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to load data
function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    return {};
  }
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error reading database file, resetting database:', error);
    return {};
  }
}

// Helper to save data
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to database file:', error);
  }
}

// Helper to generate a random 6-character code
function generateShortCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper to validate URL
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Reserved paths that cannot be used as short codes
const RESERVED_PATHS = new Set(['api', 'public', 'index.html', 'style.css', 'app.js', 'favicon.ico']);

// API: Shorten URL
app.post('/api/shorten', (req, res) => {
  const { url, customCode } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL (must start with http:// or https://).' });
  }

  const database = loadData();
  let code = customCode ? customCode.trim() : '';

  if (code) {
    // Validate custom code
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
      return res.status(400).json({ error: 'Custom code must be 3-20 alphanumeric characters, hyphens, or underscores.' });
    }
    if (RESERVED_PATHS.has(code.toLowerCase())) {
      return res.status(400).json({ error: 'This custom code is reserved.' });
    }
    if (database[code]) {
      return res.status(400).json({ error: 'This custom code is already in use.' });
    }
  } else {
    // Generate unique random code
    let attempts = 0;
    do {
      code = generateShortCode();
      attempts++;
    } while (database[code] && attempts < 100);

    if (database[code]) {
      return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
    }
  }

  database[code] = {
    originalUrl: url,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  saveData(database);

  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;
  res.status(201).json({
    shortCode: code,
    shortUrl,
    originalUrl: url,
    clicks: 0,
    createdAt: database[code].createdAt
  });
});

// API: Get history of shortened URLs
app.get('/api/history', (req, res) => {
  const database = loadData();
  const history = Object.keys(database).map(code => ({
    shortCode: code,
    shortUrl: `${req.protocol}://${req.get('host')}/${code}`,
    originalUrl: database[code].originalUrl,
    clicks: database[code].clicks,
    createdAt: database[code].createdAt
  }));

  // Sort by createdAt descending
  history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(history);
});

// API: Get stats for a single URL
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const database = loadData();

  if (!database[code]) {
    return res.status(404).json({ error: 'Short URL not found.' });
  }

  res.json({
    shortCode: code,
    shortUrl: `${req.protocol}://${req.get('host')}/${code}`,
    originalUrl: database[code].originalUrl,
    clicks: database[code].clicks,
    createdAt: database[code].createdAt
  });
});

// Redirect short URL to long URL
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const database = loadData();

  if (RESERVED_PATHS.has(code.toLowerCase())) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  if (database[code]) {
    database[code].clicks += 1;
    saveData(database);
    return res.redirect(database[code].originalUrl);
  }

  // Redirect to index page with an error state if the code isn't found
  res.redirect('/?error=notfound');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
