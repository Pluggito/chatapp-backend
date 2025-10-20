const { Server } = require("socket.io");

const setupSocket = (server) => {
   const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as needed
    credentials: true,
  },
});

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    
    if (userId) {
      // ✅ Join user to their personal room (for chatListUpdate)
      socket.join(userId);
      // console.log(`✅ User ${userId} connected to personal room`);
    }

    // Join a specific chatroom
    socket.on("joinRoom", ({ chatRoomId }) => {
      socket.join(chatRoomId);
      // console.log(`📥 User ${userId} joined room: ${chatRoomId}`);
    });

    // Leave a specific chatroom
    socket.on("leaveRoom", ({ chatRoomId }) => {
      socket.leave(chatRoomId);
      // console.log(`📤 User ${userId} left room: ${chatRoomId}`);
    });

    // Handle sending messages (optional - you might handle this via HTTP)
    socket.on("sendMessage", ({ chatRoomId, message }) => {
      // console.log(`💬 Message sent to room ${chatRoomId}:`, message);
      
      // Broadcast to everyone in the room
      io.to(chatRoomId).emit("newMessage", message);
    });

    socket.on("disconnect", () => {
      // console.log(`❌ User ${userId} disconnected`);
    });
  });

  return io;
};

module.exports = setupSocket;