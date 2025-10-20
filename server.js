const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3050;
const cors = require("cors");
const http = require('http');
//const { Server } = require('socket.io');
const setupSocket = require("./middleware/socket")
const server = http.createServer(app);


const io = setupSocket(server);

app.use(express.json());
app.use(cookieParser());


// ✅ Make io accessible in routes
app.set('io', io);

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



server.listen(port, () => {
  // console.log(`Server is running on port ${port}`);
});
