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
      console.log(`✅ User ${userId} connected (Socket ID: ${socket.id})`);
    } else {
      console.warn("⚠️ User connected without userId");
    }

    // Join a specific chatroom
    socket.on("joinRoom", ({ chatRoomId }) => {
      if (chatRoomId) {
        socket.join(chatRoomId); // ✅ Join without prefix to match backend emission
        console.log(`📥 User ${userId} joined room: ${chatRoomId}`);
      }
    });

    // Leave a specific chatroom
    socket.on("leaveRoom", ({ chatRoomId }) => {
      if (chatRoomId) {
        socket.leave(chatRoomId);
        console.log(`📤 User ${userId} left room: ${chatRoomId}`);
      }
    });

    // ❌ REMOVE THIS - Backend handles it via HTTP route
    // socket.on("sendMessage", ({ chatRoomId, message }) => {
    //   if (chatRoomId && message) {
    //     console.log(`💬 Message sent to room ${chatRoomId}:`, message);
    //     io.to(chatRoomId).emit("newMessage", message);
    //   }
    // });

    socket.on("disconnect", (reason) => {
      console.log(`❌ User ${userId} disconnected (Reason: ${reason})`);
    });

    socket.on("error", (error) => {
      console.error(`🔴 Socket error for user ${userId}:`, error);
    });
  });

  return io;
};

module.exports = setupSocket;
