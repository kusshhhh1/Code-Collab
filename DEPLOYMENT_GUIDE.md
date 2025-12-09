# Deployment Guide for CodeCollab

## Overview

CodeCollab requires **two separate deployments**:
1. **Frontend** (React app) → Netlify, Vercel, etc.
2. **Backend Server** (Node.js/Express/Socket.io) → Railway, Render, Heroku, etc.

## Why Two Deployments?

- **Netlify/Vercel**: Only host static files (HTML, CSS, JS). They cannot run Node.js servers.
- **Backend Server**: Needs to run continuously for:
  - WebSocket connections (real-time collaboration)
  - Code execution
  - Project data sharing

## Deployment Steps

### Part 1: Deploy Backend Server

Choose one of these services:

#### Option A: Railway (Recommended - Easiest)

1. **Sign up** at [railway.app](https://railway.app)
2. **Create New Project** → "Deploy from GitHub repo"
3. **Add your repository**
4. **Configure:**
   - Root Directory: `/` (or leave default)
   - Build Command: (leave empty - no build needed)
   - Start Command: `node server.js`
5. **Set Environment Variables:**
   - `PORT` = (auto-set by Railway)
6. **Deploy!**
7. **Copy your Railway URL** (e.g., `https://your-app.railway.app`)

#### Option B: Render

1. **Sign up** at [render.com](https://render.com)
2. **New** → **Web Service**
3. **Connect your repository**
4. **Configure:**
   - Name: `codecollab-backend`
   - Environment: `Node`
   - Build Command: (leave empty)
   - Start Command: `node server.js`
   - Plan: Free (or paid)
5. **Advanced** → Set `PORT` environment variable (Render sets this automatically)
6. **Deploy!**
7. **Copy your Render URL** (e.g., `https://codecollab-backend.onrender.com`)

#### Option C: Heroku

1. **Install Heroku CLI**
2. **Login:** `heroku login`
3. **Create app:** `heroku create your-app-name`
4. **Deploy:** `git push heroku main`
5. **Set PORT:** (Heroku sets this automatically)
6. **Get URL:** `heroku info` or check dashboard

### Part 2: Deploy Frontend to Netlify

1. **Build your frontend:**
   ```bash
   npm run build
   ```
   This creates a `dist` folder.

2. **Deploy to Netlify:**

   **Option A: Via Netlify Dashboard**
   - Go to [netlify.com](https://netlify.com)
   - Sign up/Login
   - Click "Add new site" → "Deploy manually"
   - Drag and drop the `dist` folder
   - Your site is live!

   **Option B: Via Netlify CLI**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

   **Option C: Via GitHub (Recommended)**
   - Push your code to GitHub
   - In Netlify: "Add new site" → "Import from Git"
   - Connect GitHub → Select repository
   - **Build settings:**
     - Build command: `npm run build`
     - Publish directory: `dist`
   - **Deploy!**

3. **Configure Environment Variables in Netlify:**
   - Go to Site Settings → Environment Variables
   - Add: `VITE_SOCKET_URL` = `https://your-backend-url.com`
   - **Important:** Redeploy after adding environment variables!

### Part 3: Update Backend CORS Settings

Your backend needs to allow requests from your Netlify domain.

**Update `server.js`:**

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://your-netlify-app.netlify.app',
      'http://localhost:5173', // For local development
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: [
    'https://your-netlify-app.netlify.app',
    'http://localhost:5173',
  ],
  credentials: true,
}));
```

Or for production, allow all origins (less secure but easier):

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
```

## Testing Collaboration After Deployment

1. **You:** Open `https://your-app.netlify.app`
2. **Sign up** and create a project
3. **Click "Share"** and copy the link
4. **Your friend:** Opens the same link
5. **Both collaborate** in real-time!

## Important Notes

### Environment Variables

- **Frontend (Netlify):** Set `VITE_SOCKET_URL` to your backend URL
- **Backend:** Usually doesn't need env vars (PORT is auto-set)

### Free Tier Limitations

- **Railway:** Free tier has usage limits
- **Render:** Free tier spins down after inactivity (takes ~30s to wake up)
- **Netlify:** Free tier is generous for static sites

### Code Execution on Backend

Make sure your backend hosting supports:
- **Python** (for Python code execution)
- **Node.js** (for JavaScript execution)
- **g++** (for C++ - may not be available on free tiers)

Some platforms may require Docker or custom buildpacks for these.

## Troubleshooting

### "Failed to fetch" when running code
- Check backend is running (visit backend URL in browser)
- Verify `VITE_SOCKET_URL` is set correctly in Netlify
- Check CORS settings in backend

### Real-time collaboration not working
- Verify WebSocket URL is correct
- Check browser console for WebSocket errors
- Ensure backend server is running (not sleeping)

### Backend keeps sleeping (Render free tier)
- Consider upgrading to paid tier
- Or use Railway/Heroku which don't sleep
- Or add a ping service to keep it awake

## Example Configuration

**Backend URL:** `https://codecollab-backend.railway.app`
**Frontend URL:** `https://codecollab.netlify.app`

**Netlify Environment Variable:**
```
VITE_SOCKET_URL=https://codecollab-backend.railway.app
```

**Backend CORS (server.js):**
```javascript
origin: ['https://codecollab.netlify.app', 'http://localhost:5173']
```

## Quick Deploy Checklist

- [ ] Backend deployed and running
- [ ] Backend URL copied
- [ ] Frontend built (`npm run build`)
- [ ] Frontend deployed to Netlify
- [ ] `VITE_SOCKET_URL` set in Netlify env vars
- [ ] CORS configured in backend for Netlify domain
- [ ] Test collaboration with a friend!

