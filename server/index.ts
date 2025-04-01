import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Database connections
mongoose.connect(process.env.MONGODB_URI!);
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Session model
interface ISession extends mongoose.Document {
  inviteCode: string;
  files: Record<string, string>;
  structure: any[];
  createdAt: Date;
}

const sessionSchema = new mongoose.Schema<ISession>({
  inviteCode: { type: String, unique: true },
  files: Object,
  structure: Array,
  createdAt: { type: Date, default: Date.now }
});

const Session = mongoose.model<ISession>('Session', sessionSchema);

// Socket.io logic
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('joinSession', async (inviteCode, callback) => {
    const session = await Session.findOne({ inviteCode });
    if (!session) return callback({ error: 'Invalid invite code' });
    
    socket.join(inviteCode);
    callback({ success: true, files: session.files, structure: session.structure });
    
    // Broadcast to others in the room
    socket.to(inviteCode).emit('userJoined', socket.id);
  });
  
  socket.on('fileChange', async ({ inviteCode, path, content }) => {
    await Session.updateOne(
      { inviteCode },
      { $set: { [`files.${path}`]: content } }
    );
    socket.to(inviteCode).emit('fileChanged', { path, content });
  });
  
  // Add more event handlers for folder creation, etc.
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});