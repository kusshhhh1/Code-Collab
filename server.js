// Backend server for CodeCollab
// Run with: node server.js

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CORS configuration - update with your frontend URL in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
  credentials: true,
}));
app.use(express.json());

// Code execution endpoint
app.post('/api/execute', async (req, res) => {
  const { code, language } = req.body;

  if (!code || !language) {
    return res.status(400).json({ error: 'Code and language are required' });
  }

  try {
    let output = '';
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const timestamp = Date.now();
    let command = '';
    let filePath = '';

    let exePath = '';
    switch (language) {
      case 'python':
        filePath = path.join(tempDir, `code_${timestamp}.py`);
        fs.writeFileSync(filePath, code);
        command = `python "${filePath}"`;
        break;
      case 'javascript':
        filePath = path.join(tempDir, `code_${timestamp}.js`);
        fs.writeFileSync(filePath, code);
        command = `node "${filePath}"`;
        break;
      case 'cpp':
        filePath = path.join(tempDir, `code_${timestamp}.cpp`);
        exePath = path.join(tempDir, `code_${timestamp}.exe`);
        fs.writeFileSync(filePath, code);
        // Try to compile and run (requires g++ installed)
        command = `g++ "${filePath}" -o "${exePath}" && "${exePath}"`;
        break;
      case 'c':
        filePath = path.join(tempDir, `code_${timestamp}.c`);
        exePath = path.join(tempDir, `code_${timestamp}.exe`);
        fs.writeFileSync(filePath, code);
        // Try to compile and run (requires gcc installed)
        command = `gcc "${filePath}" -o "${exePath}" && "${exePath}"`;
        break;
      case 'java':
        filePath = path.join(tempDir, `Main_${timestamp}.java`);
        exePath = path.join(tempDir, `Main_${timestamp}.class`);
        // Compile and run Java (requires javac and java installed)
        // Extract class name from code or use Main
        const className = 'Main_' + timestamp;
        // Replace class name in code if needed (simple approach: assume Main class)
        let javaCode = code;
        if (!code.includes('public class')) {
          // If no class definition, wrap in Main class
          javaCode = `public class ${className} {\n    public static void main(String[] args) {\n${code.split('\n').map(line => '        ' + line).join('\n')}\n    }\n}`;
        } else {
          // Replace class name with timestamped version
          javaCode = code.replace(/public class\s+(\w+)/, `public class ${className}`);
        }
        fs.writeFileSync(filePath, javaCode);
        command = `cd "${tempDir}" && javac "${path.basename(filePath)}" && java ${className}`;
        break;
      default:
        return res.status(400).json({ error: 'Unsupported language' });
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      output = stdout || stderr || 'No output';
    } catch (error) {
      output = error.stderr || error.message || 'Execution error';
    } finally {
      // Cleanup temp files
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (exePath && fs.existsSync(exePath)) {
          fs.unlinkSync(exePath);
        }
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.json({ output });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// In-memory storage for shared projects (for collaboration)
const sharedProjects = new Map(); // projectId -> { project, files, messages }

// WebSocket connection handling
io.on('connection', (socket) => {
  const { roomId, userId } = socket.handshake.query;
  
  if (roomId) {
    socket.join(roomId);
    console.log(`User ${userId} joined room ${roomId}`);

    // Request project data when joining
    socket.on('request-project-data', () => {
      const projectData = sharedProjects.get(roomId);
      if (projectData) {
        socket.emit('project-data', projectData);
      } else {
        socket.emit('project-data', null);
      }
    });

    // Share project data (when project owner loads it)
    socket.on('share-project-data', (data) => {
      sharedProjects.set(roomId, data);
      // Broadcast to others in the room
      socket.to(roomId).emit('project-data', data);
    });

    // Broadcast code changes
    socket.on('code-change', (data) => {
      // Update shared project data
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        const fileIndex = projectData.files.findIndex(f => f.id === data.fileId);
        if (fileIndex !== -1) {
          projectData.files[fileIndex].content = data.content;
          projectData.files[fileIndex].updated_at = new Date().toISOString();
        }
      }
      socket.to(roomId).emit('code-change', data);
    });

    // Broadcast file creation
    socket.on('file-created', (file) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        projectData.files.push(file);
      }
      socket.to(roomId).emit('file-created', file);
    });

    // Broadcast file deletion
    socket.on('file-deleted', (fileId) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.files) {
        projectData.files = projectData.files.filter(f => f.id !== fileId);
      }
      socket.to(roomId).emit('file-deleted', fileId);
    });

    // Broadcast new messages
    socket.on('new-message', (message) => {
      const projectData = sharedProjects.get(roomId);
      if (projectData && projectData.messages) {
        projectData.messages.push(message);
      }
      socket.to(roomId).emit('new-message', message);
    });

    socket.on('disconnect', () => {
      console.log(`User ${userId} left room ${roomId}`);
    });
  }
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

