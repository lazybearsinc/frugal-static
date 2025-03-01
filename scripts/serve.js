const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 5004;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: (res, filePath) => {
        // Set correct MIME types
        if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Redirect root to costco-deals
app.get('/', (req, res) => {
    res.redirect('/costco-deals');
});

// Handle all routes by serving index.html from the corresponding directory
app.get('*', (req, res) => {
    const normalizedPath = req.path.replace(/\/$/, '');
    res.sendFile(path.join(__dirname, '..', 'public', normalizedPath, 'index.html'));
});

app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
}); 