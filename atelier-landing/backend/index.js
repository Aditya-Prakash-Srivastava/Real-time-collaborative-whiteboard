const express = require('express');
const cors = require('cors');
const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const { initSocketServer } = require('./sockets');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

/**
 * Application Entry Point
 * Initializes the Express server, connects to MongoDB, sets up REST API routes,
 * configures rate limiting, and bootstraps the Socket.IO real-time server.
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Successfully connected to MongoDB');

    app.use(cors());
    app.use(express.json());
    
    const rateLimit = require('express-rate-limit');
    
    // Phase 9: API Rate Limiting to prevent brute-force attacks
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
      standardHeaders: true,
      legacyHeaders: false,
    });
    
    // Routes
    app.use('/api/auth', authLimiter, authRoutes);
    
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'Whiteboard backend is running smoothly.' });
    });

    // Initialize Socket.IO with optional Redis
    await initSocketServer(server);

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
};

startServer();
