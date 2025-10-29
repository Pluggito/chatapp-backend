const { Server } = require("socket.io");

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust as needed for production
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    
    if (userId) {
      // ✅ Join user to their personal room (for chatListUpdate)
      socket.join(userId);
      // console.log(`✅ User ${userId} connected (Socket ID: ${socket.id})`);
    } else {
      console.warn("⚠️ User connected without userId");
    }

    // Join a specific chatroom
    socket.on("joinRoom", ({ chatRoomId }) => {
      if (chatRoomId) {
        socket.join(chatRoomId);
        // console.log(`📥 User ${userId} joined room: ${chatRoomId}`);
      }
    });

    // Leave a specific chatroom
    socket.on("leaveRoom", ({ chatRoomId }) => {
      if (chatRoomId) {
        socket.leave(chatRoomId);
        // console.log(`📤 User ${userId} left room: ${chatRoomId}`);
      }
    });

    // Handle sending messages (optional - you might handle this via HTTP)
    socket.on("sendMessage", ({ chatRoomId, message }) => {
      if (chatRoomId && message) {
        // console.log(`💬 Message sent to room ${chatRoomId}:`, message);
        
        // Broadcast to everyone in the room (including sender)
        io.to(chatRoomId).emit("newMessage", message);
      }
    });

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      // console.log(`❌ User ${userId} disconnected (Reason: ${reason})`);
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`🔴 Socket error for user ${userId}:`, error);
    });
  });

  // Store io instance for access in routes
  return io;
};

module.exports = setupSocket;