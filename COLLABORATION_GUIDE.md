# How to Collaborate with CodeCollab

## Quick Start Guide

### For the Project Owner (Person Creating the Project)

1. **Start the Backend Server**
   ```bash
   npm run server
   ```
   This server handles:
   - Code execution
   - Real-time collaboration via WebSocket
   - Sharing project data

2. **Start the Frontend** (in a new terminal)
   ```bash
   npm run dev
   ```

3. **Create a Project**
   - Sign up/Login
   - Click "Create New Project"
   - Give it a name
   - Start coding!

4. **Share Your Project**
   - Click the "Share" button in the editor
   - Copy the link (e.g., `http://localhost:5173/editor/abc-123-def`)
   - Send this link to your friend

### For Your Friend (Joining the Project)

1. **Make Sure Backend Server is Running**
   - The project owner should have started it, OR
   - You can start it yourself:
     ```bash
     npm run server
     ```
   - **Important**: Both of you need to connect to the same server!

2. **Start the Frontend** (if not already running)
   ```bash
   npm run dev
   ```

3. **Join the Project**
   - Sign up/Login (can use a different account)
   - Paste the share link in your browser, OR
   - Go to Dashboard → Enter the Project ID → Click "Join Project"

4. **Start Collaborating!**
   - You'll see the same code as the owner
   - Type in the editor - changes sync in real-time
   - Use the chat panel to communicate
   - Both can run code and see results

## How It Works

### Real-Time Collaboration
- **Code Changes**: When you type, changes sync instantly to all users
- **File Operations**: Creating/deleting files syncs to everyone
- **Chat**: Messages appear in real-time for all users
- **Code Execution**: Anyone can run code, everyone sees the output

### Data Storage
- **Local Storage**: Each browser stores its own copy of projects
- **Server Sync**: The backend server temporarily stores project data for sharing
- **WebSocket**: Real-time updates flow through WebSocket connections

## Important Notes

### Same Network Required
- Both users need to be on the same network OR
- The backend server needs to be accessible to both (e.g., deployed online)

### For Remote Collaboration (Different Networks)

**Option 1: Use ngrok (Recommended for Testing)**
1. Install ngrok: https://ngrok.com/
2. Start your backend server: `npm run server`
3. In another terminal: `ngrok http 3001`
4. Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
5. Update `VITE_SOCKET_URL` in your `.env` file:
   ```env
   VITE_SOCKET_URL=https://abc123.ngrok.io
   ```
6. Restart your frontend: `npm run dev`
7. Share both the frontend URL and make sure your friend uses the same ngrok URL

**Option 2: Deploy to a Cloud Service**
- Deploy backend server to Railway, Render, or Heroku
- Update `VITE_SOCKET_URL` to point to your deployed server
- Deploy frontend to Vercel, Netlify, etc.

### Troubleshooting

**"Project not found" error:**
- Make sure the project owner has opened the project first
- The owner needs to be connected so the project data can be shared

**Changes not syncing:**
- Check that backend server is running (`npm run server`)
- Check browser console for WebSocket errors
- Make sure both users are connected to the same server

**Can't see other user's changes:**
- Refresh the page
- Check WebSocket connection in browser DevTools → Network → WS
- Make sure both users are in the same project (same URL)

## Example Workflow

1. **Alice** creates project "game"
2. **Alice** clicks "Share" and copies link
3. **Alice** sends link to **Bob**: `http://localhost:5173/editor/abc-123`
4. **Bob** opens link and signs in
5. **Bob** sees Alice's code automatically
6. **Both** can now edit together in real-time!

## Tips

- Use the chat panel to coordinate
- The project owner's changes are authoritative
- If you lose connection, refresh to re-sync
- Each user's local storage keeps a backup copy

