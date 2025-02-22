# Frugal Static Site

A modern, responsive static site for the Frugal price tracking service that helps users save money on Costco purchases.

## Features

- 💰 WhatsApp integration for price tracking
- 📱 Mobile-first responsive design
- 🎯 Clear, step-by-step user guidance
- 🔒 Privacy-focused design
- ⚡ Fast-loading static pages

## Project Structure

```
frugal-static/
├── public/
│   ├── index.html         # Landing page
│   ├── how-it-works.html  # Process explanation
│   ├── privacy-policy.html# Privacy policy
│   ├── terms.html         # Terms and conditions
│   ├── css/              # Stylesheets
│   └── assets/           # Images and icons
├── .htaccess             # URL rewriting rules
└── firebase.json         # Firebase configuration
```

## Local Development

You can run this site locally using any static file server. Here are a few options:

1. Using Python (Python 3):
```bash
python -m http.server 8000
```

2. Using Node.js (requires `http-server`):
```bash
npx http-server
```

3. Using PHP:
```bash
php -S localhost:8000
```

Visit `http://localhost:8000` in your browser to view the site.

## Deployment

The site is configured to deploy to Firebase Hosting. To deploy:

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Deploy the site:
```bash
firebase deploy
```

## Support

For support, email support@getfrugal.ai or visit our website at https://getfrugal.ai 