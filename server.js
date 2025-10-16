const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3050;
const cors = require("cors");
const http = require('http');
const { Server } = require('socket.io');

app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    return callback(null, origin);
  },
  credentials: true,
}));

// Mount each router separately
app.use('/chatserver/auth', require('./routes/authroutes'));
app.use('/chatserver/chat', require('./routes/chatroomroutes'));
app.use('/chatserver/users', require('./routes/userroutes'));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as needed
    credentials: true,
  },
});

// Socket.io events
io.on("connection", (socket) => {
  // Join room
  socket.on("joinRoom", ({ chatRoomId }) => {
    socket.join(chatRoomId);
  });

  // Leave room
  socket.on("leaveRoom", ({ chatRoomId }) => {
    socket.leave(chatRoomId);
  });

  // Receive and broadcast message
  socket.on("sendMessage", ({ chatRoomId, message }) => {
    socket.to(chatRoomId).emit("newMessage", message);
    io.emit("chatListUpdate", { chatRoomId, message });
  });

  socket.on("disconnect", () => {
    // Handle disconnect if needed
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
