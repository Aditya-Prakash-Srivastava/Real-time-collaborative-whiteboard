const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const BoardSnapshot = require('../models/BoardSnapshot');

// Phase 5: Presence & Cursors state
const roomUsers = new Map(); // roomId -> Map(socketId -> { id, username, color })
const CURSOR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F4D03F', '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'];

const getRoomUsersArray = (roomId) => {
  if (!roomUsers.has(roomId)) return [];
  return Array.from(roomUsers.get(roomId).values());
};

// Map to hold pending saves for debounced persistence
const pendingSaves = new Map();

// Global interval to flush pending saves to MongoDB every 5 seconds
setInterval(async () => {
  if (pendingSaves.size === 0) return;
  
  // Clone and clear the map to prevent race conditions
  const savesToProcess = new Map(pendingSaves);
  pendingSaves.clear();

  for (const [roomId, data] of savesToProcess.entries()) {
    try {
      // Phase 10: Use updateOne for better performance since we don't need the returned document
      await BoardSnapshot.updateOne(
        { roomId },
        { 
          $set: {
            elements: data.elements, 
            version: data.version,
            lastUpdatedBy: data.email 
          }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[MongoDB] Save error for room ${roomId}:`, err);
    }
  }
}, 5000);

/**
 * Initialize Socket.IO Server with JWT Authentication, Redis Adapter (Phase 8), and Event Handlers
 * @param {import('http').Server} httpServer 
 */
const initSocketServer = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173", // Frontend Vite default port
      methods: ["GET", "POST"]
    },
    // Phase 10: Enable Payload Compression to save bandwidth on large boards
    perMessageDeflate: {
      threshold: 1024, // only compress messages larger than 1KB
      zlibDeflateOptions: {
        chunkSize: 1024 * 16 // 16KB chunks
      }
    }
  });

  // Phase 8: Redis Pub/Sub adapter for horizontal scaling
  if (process.env.REDIS_URI) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URI });
      const subClient = pubClient.duplicate();
      
      await Promise.all([pubClient.connect(), subClient.connect()]);
      
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Redis] Socket.IO adapter connected for horizontal scaling');
    } catch (err) {
      console.error('[Redis] Failed to connect Redis adapter, falling back to in-memory:', err.message);
    }
  } else {
    console.log('[Redis] No REDIS_URI found. Using default in-memory adapter (Local/Single-Server Mode)');
  }

  // STEP 6: Implement JWT socket authentication.
  // Middleware to authenticate socket connections before allowing them
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    
    if (!token) {
      return next(new Error("Authentication error: Token missing"));
    }

    try {
      // Validate JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // Attach user info to socket
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid or expired token"));
    }
  });

  // Socket Connection Handling
  io.on('connection', (socket) => {
    console.log(`[Socket] User connected: ${socket.user.email} (ID: ${socket.id})`);

    // STEP 7: Implement room joining system.
    socket.on('room:join', async (roomId) => {
      if (!roomId) return;
      
      // Leave previous rooms if any (excluding default socket.id room)
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
          if (roomUsers.has(room)) {
            roomUsers.get(room).delete(socket.id);
            io.to(room).emit('room:users', getRoomUsersArray(room));
          }
        }
      });

      socket.join(roomId);
      socket.currentRoom = roomId; // Phase 9: Track current room for faster disconnect cleanup
      console.log(`[Socket] User ${socket.user.email} joined room: ${roomId}`);
      
      // Phase 5: Add user to tracking map
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      
      const username = socket.user.email.split('@')[0];
      const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
      
      roomUsers.get(roomId).set(socket.id, {
        id: socket.id,
        username,
        color
      });

      // Broadcast updated user list to everyone in the room
      io.to(roomId).emit('room:users', getRoomUsersArray(roomId));

      // STEP 15: Send latest snapshot to joining user
      try {
        // Also check pending saves in memory in case it hasn't flushed yet
        let elements = null;
        let version = 0;
        
        if (pendingSaves.has(roomId)) {
          const pending = pendingSaves.get(roomId);
          elements = pending.elements;
          version = pending.version;
        } else {
          const snapshot = await BoardSnapshot.findOne({ roomId });
          if (snapshot) {
            elements = snapshot.elements;
            version = snapshot.version;
          }
        }

        if (elements) {
          socket.emit('initial:state', {
            roomId,
            elements,
            version
          });
        }
      } catch (err) {
        console.error(`[MongoDB] Error fetching snapshot for room ${roomId}:`, err);
      }
    });

    // STEP 8: Implement realtime scene synchronization.
    socket.on('board:update', (data) => {
      const { roomId, elements, version } = data;
      
      if (!roomId) return;

      // Broadcast updates to all OTHER users in the room
      // To prevent infinite loops (Step 10), we ONLY broadcast to others (`socket.to`)
      socket.to(roomId).emit('board:update', {
        roomId, // Required by frontend to verify room
        elements,
        version,
        userId: socket.id
      });

      // STEP 14: Implement debounced persistence
      // Store in memory map; interval worker will save it to MongoDB
      pendingSaves.set(roomId, {
        elements,
        version,
        email: socket.user.email
      });
    });

    // Phase 7: Board Management (Hard Clear)
    socket.on('board:clear', async (roomId) => {
      if (!roomId) return;
      
      // Remove from memory buffer
      pendingSaves.delete(roomId);
      
      try {
        // Delete from MongoDB
        await BoardSnapshot.deleteOne({ roomId });
        console.log(`[MongoDB] Board ${roomId} hard cleared by user`);
        
        // Broadcast to all other users in the room to reset their canvas
        socket.to(roomId).emit('board:clear');
      } catch (err) {
        console.error(`[MongoDB] Error clearing board ${roomId}:`, err);
      }
    });

    // STEP 18: Handle pointer updates (Cursors)
    socket.on('pointer:update', (data) => {
      const { roomId, pointer } = data;
      if (!roomId) return;

      socket.to(roomId).emit('pointer:update', {
        userId: socket.id,
        pointer
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User disconnected: ${socket.user.email}`);
      
      // Phase 9: Optimized Memory Leak Prevention
      const roomId = socket.currentRoom;
      if (roomId && roomUsers.has(roomId)) {
        const usersMap = roomUsers.get(roomId);
        usersMap.delete(socket.id);
        
        if (usersMap.size === 0) {
          // Clean up empty room to prevent memory leak
          roomUsers.delete(roomId);
          console.log(`[Socket] Room ${roomId} is empty. Deleted from tracking map.`);
        } else {
          io.to(roomId).emit('room:users', getRoomUsersArray(roomId));
        }
      }
    });
  });

  return io;
};

module.exports = { initSocketServer };
