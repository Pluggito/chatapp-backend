const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require("cors");
const http = require('http');
const setupSocket = require("./middleware/socket");

const app = express();
const port = process.env.PORT || 3050;
const server = http.createServer(app);

// ✅ Setup Socket.io FIRST
const io = setupSocket(server);

// ✅ Make io accessible in routes (before defining routes)
app.set('io', io);

// ==================== MIDDLEWARE ====================
// CORS should come first
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);    
    return callback(null, origin);
  },
  credentials: true,
}));

// Body parsers
app.use(express.json({ limit: "10mb" })); // Increased for base64 images
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ==================== ROUTES ====================
app.use('/chatserver/auth', require('./routes/authroutes'));
app.use('/chatserver/chat', require('./routes/chatroomroutes'));
app.use('/chatserver/users', require('./routes/userroutes'));

// ==================== HEALTH CHECK ====================
app.get("/chatserver/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount // Shows active socket connections
  });
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== START SERVER ====================
server.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('❌ HTTP server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };