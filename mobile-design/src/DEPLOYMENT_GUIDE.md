# 🚀 DEPLOYMENT GUIDE
## Main Din Collection Mobile ERP - Production Deployment

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Backend Integration Complete
- [ ] All API endpoints integrated
- [ ] Authentication working
- [ ] All modules tested with real data
- [ ] Error handling implemented
- [ ] Loading states added
- [ ] Permissions enforced

### Environment Setup
- [ ] Production `.env` file configured
- [ ] API URLs updated to production
- [ ] SSL certificates ready
- [ ] Domain name configured

### Testing Complete
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] User acceptance testing done
- [ ] Mobile device testing done
- [ ] Tablet testing done
- [ ] Performance testing done

---

## 🌐 DEPLOYMENT OPTIONS

### Option 1: Vercel (Recommended for React Apps)
### Option 2: Netlify
### Option 3: Custom Server (VPS/Dedicated)
### Option 4: Main Din Collection's Own Server

---

## 🔧 OPTION 1: VERCEL DEPLOYMENT

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Configure Build Settings

Create `vercel.json`:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_BASE_URL": "@api-base-url",
    "VITE_API_VERSION": "v1"
  }
}
```

### Step 4: Set Environment Variables
```bash
vercel env add VITE_API_BASE_URL production
# Enter: https://api.maindincollection.com

vercel env add VITE_AUTH_TOKEN_KEY production
# Enter: mdc_auth_token
```

### Step 5: Deploy
```bash
# Preview deployment
vercel

# Production deployment
vercel --prod
```

### Step 6: Configure Custom Domain
```bash
vercel domains add erp.maindincollection.com
```

---

## 🔧 OPTION 2: NETLIFY DEPLOYMENT

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Login to Netlify
```bash
netlify login
```

### Step 3: Configure Build

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_API_BASE_URL = "https://api.maindincollection.com"
  VITE_API_VERSION = "v1"
```

### Step 4: Deploy
```bash
# Initialize
netlify init

# Deploy
netlify deploy --prod
```

---

## 🔧 OPTION 3: CUSTOM SERVER (VPS)

### Prerequisites
- Ubuntu 22.04 LTS Server
- Node.js 18+ installed
- Nginx installed
- SSL certificate (Let's Encrypt)

### Step 1: Setup Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Build Application

```bash
# On your local machine
npm run build

# This creates /dist folder
```

### Step 3: Upload to Server

```bash
# Using SCP
scp -r dist/* user@your-server-ip:/var/www/mdc-erp/

# Or using rsync
rsync -avz dist/ user@your-server-ip:/var/www/mdc-erp/
```

### Step 4: Configure Nginx

Create `/etc/nginx/sites-available/mdc-erp`:

```nginx
server {
    listen 80;
    server_name erp.maindincollection.com;

    root /var/www/mdc-erp;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing - send all requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/mdc-erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Setup SSL Certificate

```bash
sudo certbot --nginx -d erp.maindincollection.com
```

### Step 6: Setup Auto-Deploy (Optional)

Create deployment script `/home/user/deploy-mdc-erp.sh`:

```bash
#!/bin/bash

# Pull latest code
cd /var/www/mdc-erp-source
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Copy to web root
rm -rf /var/www/mdc-erp/*
cp -r dist/* /var/www/mdc-erp/

# Restart Nginx
sudo systemctl reload nginx

echo "Deployment completed at $(date)"
```

Make executable:
```bash
chmod +x /home/user/deploy-mdc-erp.sh
```

---

## 🔧 OPTION 4: SAME SERVER AS BACKEND

If backend is already running on a server:

### Step 1: Build Application
```bash
npm run build
```

### Step 2: Copy to Backend's Public Directory

```bash
# If backend is Node.js/Express
cp -r dist/* /path/to/backend/public/

# If backend is PHP
cp -r dist/* /var/www/html/erp/
```

### Step 3: Configure Backend to Serve Frontend

**Express.js Example**:
```javascript
const express = require('express');
const path = require('path');
const app = express();

// API routes
app.use('/api', apiRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback - send all other requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000);
```

---

## 📱 MOBILE APP DEPLOYMENT (PWA)

### Step 1: Ensure PWA Configuration

Check `vite.config.ts` has PWA plugin:
```typescript
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Main Din Collection ERP',
        short_name: 'MDC ERP',
        description: 'Mobile ERP for Main Din Collection',
        theme_color: '#111827',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
};
```

### Step 2: Test PWA

1. Deploy to production
2. Open in mobile browser
3. Look for "Add to Home Screen" prompt
4. Install and test offline functionality

---

## 🔒 SECURITY CHECKLIST

### SSL/HTTPS
- [ ] SSL certificate installed
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header enabled

### Environment Variables
- [ ] No secrets in code
- [ ] `.env` file not committed to Git
- [ ] Production secrets stored securely

### API Security
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] SQL injection prevented
- [ ] XSS protection enabled

### Frontend Security
- [ ] Content Security Policy set
- [ ] X-Frame-Options header set
- [ ] Sensitive data not in localStorage
- [ ] API tokens expire and refresh

---

## 📊 MONITORING & ANALYTICS

### Setup Error Tracking

Install Sentry:
```bash
npm install @sentry/react
```

Configure in `main.tsx`:
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
```

### Setup Analytics

Google Analytics example:
```typescript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 🔄 CI/CD SETUP (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build
      env:
        VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
      run: npm run build
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID }}
        vercel-project-id: ${{ secrets.PROJECT_ID }}
        vercel-args: '--prod'
```

---

## 📝 POST-DEPLOYMENT

### Step 1: Verify Deployment
- [ ] Visit production URL
- [ ] Test login functionality
- [ ] Test each module
- [ ] Test on mobile devices
- [ ] Test on tablets
- [ ] Check console for errors
- [ ] Verify API calls working

### Step 2: Performance Check
- [ ] Run Lighthouse audit
- [ ] Check page load speed
- [ ] Verify image optimization
- [ ] Check bundle size
- [ ] Test on slow 3G network

### Step 3: User Training
- [ ] Train staff on mobile app
- [ ] Provide user documentation
- [ ] Setup support channel
- [ ] Collect feedback

### Step 4: Monitoring
- [ ] Setup uptime monitoring
- [ ] Configure error alerts
- [ ] Setup performance monitoring
- [ ] Monitor server resources

---

## 🆘 TROUBLESHOOTING

### Issue: White screen after deployment
```bash
# Check browser console for errors
# Usually a path issue - check vite.config.ts base path

# vite.config.ts
export default {
  base: '/', // or '/erp/' if deployed to subdirectory
}
```

### Issue: API calls failing
```bash
# Check CORS settings on backend
# Verify API URL in .env
# Check network tab in DevTools
# Verify SSL certificate
```

### Issue: PWA not installing
```bash
# Must be served over HTTPS
# Check manifest.json
# Check service worker registration
# Clear browser cache and try again
```

### Issue: Slow performance
```bash
# Enable gzip compression
# Optimize images
# Enable caching headers
# Use CDN for static assets
# Code splitting and lazy loading
```

---

## 📞 SUPPORT CONTACTS

**Technical Issues:**
- Development Team: dev@maindincollection.com
- System Admin: admin@maindincollection.com

**Deployment Issues:**
- Hosting Provider Support
- Backend Team

**User Training:**
- Training Coordinator: training@maindincollection.com

---

## 🎯 SUCCESS METRICS

After deployment, monitor:

1. **Uptime**: > 99.9%
2. **Response Time**: < 500ms
3. **Error Rate**: < 0.1%
4. **User Adoption**: Track daily active users
5. **Feature Usage**: Which modules are used most
6. **Mobile Usage**: % of mobile vs desktop users

---

## 🔄 MAINTENANCE PLAN

### Daily
- Monitor error logs
- Check server health
- Review user feedback

### Weekly
- Security updates
- Database backup verification
- Performance review

### Monthly
- Feature updates
- User training sessions
- System optimization

---

## 📅 DEPLOYMENT TIMELINE

**Week 1: Preparation**
- Finalize backend integration
- Complete testing
- Setup production environment

**Week 2: Deployment**
- Deploy to production
- User training
- Monitor closely

**Week 3: Stabilization**
- Fix any issues
- Optimize performance
- Collect feedback

**Week 4: Full Launch**
- Full rollout to all users
- Marketing/announcement
- Celebrate success! 🎉

---

**Your app is ready for the world! Let's make Main Din Collection's operations smoother than ever! 🚀**

---

*Last Updated: February 13, 2026*  
*Version: 2.0*  
*Status: Production Deployment Ready*
