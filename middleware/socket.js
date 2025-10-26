const { Server } = require("socket.io");

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        "https://convo-chat-xi.vercel.app",
        "http://localhost:5173"
      ],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) socket.join(userId);

    socket.on("joinRoom", ({ chatRoomId }) => {
      socket.join(chatRoomId);
    });

    socket.on("leaveRoom", ({ chatRoomId }) => {
      socket.leave(chatRoomId);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = setupSocket;
