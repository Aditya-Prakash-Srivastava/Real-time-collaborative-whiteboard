/**
 * Socket.IO Implementation and Real-Time Synchronization Engine
 * 
 * Architecture Overview:
 * 1. Manages real-time drawing state (board:update), user presence (room:users), and cursor tracking (pointer:update).
 * 2. Utilizes a Redis Adapter (optional) for horizontal scaling if deployed across multiple instances.
 * 3. Implements debounced MongoDB persistence to save board snapshots without overwhelming the database.
 * 4. Implements Role-Based Access Control (RBAC) to allow room creators to kick participants.
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');
const BoardSnapshot = require('../models/BoardSnapshot');

// Phase 5: Presence & Cursors state
const roomUsers = new Map(); // roomId -> Map(socketId -> { id, username, color })
const roomOwners = new Map(); // roomId -> ownerEmail

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
      origin: "*", // Allow all origins for local development flexibility (e.g. 127.0.0.1, localhost, LAN IPs)
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
    socket.on('room:join', async (rawRoomId) => {
      if (!rawRoomId) return;
      
      const roomId = String(rawRoomId).trim();
      
      // Leave previous rooms if any (excluding default socket.id room)
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
          if (roomUsers.has(room)) {
            roomUsers.get(room).delete(socket.id);
            io.to(room).emit('room:users', {
              users: getRoomUsersArray(room),
              ownerEmail: roomOwners.get(room)
            });
          }
        }
      });

      socket.join(roomId);
      socket.currentRoom = roomId; // Phase 9: Track current room for faster disconnect cleanup
      console.log(`[Socket] User ${socket.user.email} joined room: ${roomId}`);
      
      // --- Atomic Ownership & State Fetching ---
      let ownerEmail = null;
      let elements = null;
      let version = 0;

      try {
        // Initialize room if it doesn't exist, assigning the first person as owner
        const result = await BoardSnapshot.findOneAndUpdate(
          { roomId },
          { $setOnInsert: { elements: [], version: 0, ownerEmail: socket.user.email } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        
        if (result) {
          ownerEmail = result.ownerEmail;
          roomOwners.set(roomId, ownerEmail);
          
          // Override elements from pending saves if they exist in memory
          if (pendingSaves.has(roomId)) {
            const pending = pendingSaves.get(roomId);
            elements = pending.elements;
            version = pending.version;
          } else {
            elements = result.elements;
            version = result.version;
          }
        }
      } catch (err) {
        console.error(`[MongoDB] Error initializing room ${roomId}:`, err);
        // Fallback to memory if DB fails
        if (!roomOwners.has(roomId)) {
          roomOwners.set(roomId, socket.user.email);
        }
        ownerEmail = roomOwners.get(roomId);
      }

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

      // Broadcast updated user list with owner info
      io.to(roomId).emit('room:users', {
        users: getRoomUsersArray(roomId),
        ownerEmail
      });

      // STEP 15: Send latest snapshot to joining user
      if (elements && elements.length > 0) {
        socket.emit('initial:state', {
          roomId,
          elements,
          version
        });
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

    // RBAC: Handle Kick Event
    socket.on('room:kick', ({ roomId, userIdToKick }) => {
      if (!roomId || !userIdToKick) return;

      // Verify ownership
      if (roomOwners.get(roomId) !== socket.user.email) {
        return; // Unauthorized
      }

      // Ensure the target user is in the room
      const usersMap = roomUsers.get(roomId);
      if (usersMap && usersMap.has(userIdToKick)) {
        // Find the target socket and forcefully remove them
        const targetSocket = io.sockets.sockets.get(userIdToKick);
        if (targetSocket) {
          targetSocket.emit('room:kicked');
          targetSocket.leave(roomId);
          targetSocket.currentRoom = null;
        }

        // Clean up from tracking map and broadcast update
        usersMap.delete(userIdToKick);
        io.to(roomId).emit('room:users', {
          users: getRoomUsersArray(roomId),
          ownerEmail: roomOwners.get(roomId)
        });
        
        console.log(`[Socket] User ${socket.user.email} kicked ${userIdToKick} from room ${roomId}`);
      }
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
          roomOwners.delete(roomId); // Prevent memory leak, will reload from MongoDB
          console.log(`[Socket] Room ${roomId} is empty. Deleted from tracking maps.`);
        } else {
          io.to(roomId).emit('room:users', {
            users: getRoomUsersArray(roomId),
            ownerEmail: roomOwners.get(roomId)
          });
        }
      }
    });
  });

  return io;
};

module.exports = { initSocketServer };
