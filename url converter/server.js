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
const ALLOWED_DOMAINS = ['s.careerup.kr', 's.myown.kr', 's.solcompany.kr'];

// API: Shorten URL
app.post('/api/shorten', (req, res) => {
  const { url, customCode, domain } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Please enter a valid URL (must start with http:// or https://).' });
  }

  const targetDomain = domain || 's.careerup.kr';
  if (!ALLOWED_DOMAINS.includes(targetDomain)) {
    return res.status(400).json({ error: 'Invalid domain selected.' });
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
    
    const dbKey = `${targetDomain}:${code}`;
    if (database[dbKey]) {
      return res.status(400).json({ error: 'This custom code is already in use for this domain.' });
    }
  } else {
    // Generate unique random code
    let attempts = 0;
    let dbKey;
    do {
      code = generateShortCode();
      dbKey = `${targetDomain}:${code}`;
      attempts++;
    } while (database[dbKey] && attempts < 100);

    if (database[dbKey]) {
      return res.status(500).json({ error: 'Failed to generate a unique short code. Please try again.' });
    }
  }

  const dbKey = `${targetDomain}:${code}`;
  database[dbKey] = {
    originalUrl: url,
    clicks: 0,
    createdAt: new Date().toISOString()
  };

  saveData(database);

  const shortUrl = `https://${targetDomain}/${code}`;
  res.status(201).json({
    domain: targetDomain,
    shortCode: code,
    shortUrl,
    originalUrl: url,
    clicks: 0,
    createdAt: database[dbKey].createdAt
  });
});

// API: Shorten URLs in batch
app.post('/api/shorten-batch', (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required.' });
  }

  const database = loadData();
  const results = [];
  let updated = false;

  for (const item of items) {
    const { url, domain, customCode } = item;
    const targetDomain = domain || 's.careerup.kr';

    if (!url) {
      results.push({ success: false, error: 'URL is required.', originalUrl: url });
      continue;
    }

    if (!isValidUrl(url)) {
      results.push({ success: false, error: 'Invalid URL format (must start with http:// or https://).', originalUrl: url });
      continue;
    }

    if (!ALLOWED_DOMAINS.includes(targetDomain)) {
      results.push({ success: false, error: 'Invalid domain.', originalUrl: url });
      continue;
    }

    let code = customCode ? customCode.trim() : '';
    let dbKey;

    if (code) {
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
        results.push({ success: false, error: 'Code must be 3-20 letters/numbers/hyphens/underscores.', originalUrl: url, customCode: code });
        continue;
      }
      if (RESERVED_PATHS.has(code.toLowerCase())) {
        results.push({ success: false, error: 'Reserved custom code.', originalUrl: url, customCode: code });
        continue;
      }
      dbKey = `${targetDomain}:${code}`;
      if (database[dbKey]) {
        results.push({ success: false, error: 'Code already in use for this domain.', originalUrl: url, customCode: code });
        continue;
      }
    } else {
      let attempts = 0;
      do {
        code = generateShortCode();
        dbKey = `${targetDomain}:${code}`;
        attempts++;
      } while (database[dbKey] && attempts < 100);

      if (database[dbKey]) {
        results.push({ success: false, error: 'Failed to generate unique code.', originalUrl: url });
        continue;
      }
    }

    database[dbKey] = {
      originalUrl: url,
      clicks: 0,
      createdAt: new Date().toISOString()
    };
    updated = true;

    results.push({
      success: true,
      domain: targetDomain,
      shortCode: code,
      shortUrl: `https://${targetDomain}/${code}`,
      originalUrl: url,
      clicks: 0,
      createdAt: database[dbKey].createdAt
    });
  }

  if (updated) {
    saveData(database);
  }

  res.json({ results });
});

// API: Delete URLs in batch
app.post('/api/delete-batch', (req, res) => {
  const { keys } = req.body; // array of "domain:code" strings

  if (!keys || !Array.isArray(keys)) {
    return res.status(400).json({ error: 'keys array is required.' });
  }

  const database = loadData();
  let updated = false;

  for (const dbKey of keys) {
    if (database[dbKey]) {
      delete database[dbKey];
      updated = true;
    }
  }

  if (updated) {
    saveData(database);
  }

  res.json({ success: true });
});

// API: Get history of shortened URLs
app.get('/api/history', (req, res) => {
  const database = loadData();
  const history = Object.keys(database).map(key => {
    let domain = 's.careerup.kr';
    let code = key;

    // Check if the key contains a colon (format is domain:code)
    const colonIndex = key.indexOf(':');
    if (colonIndex !== -1) {
      domain = key.substring(0, colonIndex);
      code = key.substring(colonIndex + 1);
    }

    return {
      domain,
      shortCode: code,
      shortUrl: `https://${domain}/${code}`,
      originalUrl: database[key].originalUrl,
      clicks: database[key].clicks,
      createdAt: database[key].createdAt,
      dbKey: key
    };
  });

  // Sort by createdAt descending
  history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(history);
});

// API: Get stats for a single URL
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const database = loadData();

  if (database[code]) {
    return res.json({
      shortCode: code,
      shortUrl: `https://s.careerup.kr/${code}`,
      originalUrl: database[code].originalUrl,
      clicks: database[code].clicks,
      createdAt: database[code].createdAt
    });
  }

  for (const d of ALLOWED_DOMAINS) {
    const dbKey = `${d}:${code}`;
    if (database[dbKey]) {
      return res.json({
        domain: d,
        shortCode: code,
        shortUrl: `https://${d}/${code}`,
        originalUrl: database[dbKey].originalUrl,
        clicks: database[dbKey].clicks,
        createdAt: database[dbKey].createdAt
      });
    }
  }

  res.status(404).json({ error: 'Short URL not found.' });
});

// Redirect short URL to long URL
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const database = loadData();

  if (RESERVED_PATHS.has(code.toLowerCase())) {
    return res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
  }

  const host = req.get('host').split(':')[0].toLowerCase();
  const dbKey = `${host}:${code}`;

  if (database[dbKey]) {
    database[dbKey].clicks += 1;
    saveData(database);
    return res.redirect(database[dbKey].originalUrl);
  }

  // Fallback for local testing
  if (host === 'localhost' || host === '127.0.0.1' || /^192\.168\./.test(host)) {
    for (const d of ALLOWED_DOMAINS) {
      const fallbackKey = `${d}:${code}`;
      if (database[fallbackKey]) {
        database[fallbackKey].clicks += 1;
        saveData(database);
        return res.redirect(database[fallbackKey].originalUrl);
      }
    }
  }

  // Legacy fallback
  if (database[code]) {
    database[code].clicks += 1;
    saveData(database);
    return res.redirect(database[code].originalUrl);
  }

  res.redirect('/?error=notfound');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
