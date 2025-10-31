const { Server } = require("socket.io");
const prisma = require("../lib/prisma");

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
    path: "/socket.io/",
    pingTimeout: 60000,
    pingInterval: 25000,
    allowEIO3: true,
    cookies: {
      name: "io",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "none"
    }
  });

  io.on("connection", (socket) => {
    console.log("✅ Socket connected:", socket.id);

    const userId = socket.handshake.query.userId;
    
    // Join user's personal room for direct notifications
    if (userId) {
      socket.join(userId);
      console.log(`👤 User ${userId} joined personal room`);
    }

    // ==================== JOIN CHAT ROOM ====================
    socket.on("joinRoom", async ({ chatRoomId }) => {
      try {
        socket.join(chatRoomId);
        console.log(`📥 Socket ${socket.id} joined room ${chatRoomId}`);

        // Update lastReadAt when joining room
        if (userId) {
          await prisma.chatMember.updateMany({
            where: {
              userId: userId,
              chatRoomId: chatRoomId
            },
            data: {
              lastReadAt: new Date()
            }
          });
        }
      } catch (error) {
        console.error("Error joining room:", error);
      }
    });

    // ==================== LEAVE CHAT ROOM ====================
    socket.on("leaveRoom", ({ chatRoomId }) => {
      socket.leave(chatRoomId);
      console.log(`📤 Socket ${socket.id} left room ${chatRoomId}`);
    });

    // ==================== SEND MESSAGE ====================
    socket.on("message:send", async (data) => {
      try {
        const { chatRoomId, content, type = "TEXT", mediaUrl = null, duration = null } = data;

        // Validate required fields
        if (!chatRoomId || !userId) {
          socket.emit("error", { message: "Missing required fields" });
          return;
        }

        // Verify user is a member of the chat
        const membership = await prisma.chatMember.findUnique({
          where: {
            userId_chatRoomId: {
              userId: userId,
              chatRoomId: chatRoomId
            }
          }
        });

        if (!membership) {
          socket.emit("error", { message: "Not a member of this chat" });
          return;
        }

        // Create the message in database
        const message = await prisma.message.create({
          data: {
            chatRoomId: chatRoomId,
            userId: userId,
            content: content || null,
            type: type,
            mediaUrl: mediaUrl,
            duration: duration,
            readers: [], // Initialize as empty array
            system: false
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true
              }
            }
          }
        });

        // Update chatroom timestamp
        await prisma.chatRoom.update({
          where: { id: chatRoomId },
          data: { updatedAt: new Date() }
        });

        // Transform message for frontend
        const transformedMessage = {
          id: message.id,
          content: message.content,
          type: message.type,
          mediaUrl: message.mediaUrl,
          duration: message.duration,
          createdAt: message.createdAt,
          senderId: message.userId,
          sender: message.user,
          readers: message.readers,
          system: message.system,
          chatRoomId: message.chatRoomId
        };

        // Get all chat room members
        const members = await prisma.chatMember.findMany({
          where: { chatRoomId: chatRoomId },
          select: { userId: true }
        });

        // Emit to all members in the chat room
        io.to(chatRoomId).emit("message:received", transformedMessage);

        // Emit chat list update to all members (even those not currently in room)
        members.forEach((member) => {
          io.to(member.userId).emit("chatList:update", {
            chatRoomId: chatRoomId,
            message: transformedMessage
          });
        });

        console.log(`📨 Message sent in room ${chatRoomId} by user ${userId}`);

      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // ==================== MARK MESSAGES AS READ ====================
    socket.on("message:read", async (data) => {
      try {
        const { chatRoomId, messageIds } = data;

        if (!chatRoomId || !userId || !Array.isArray(messageIds)) {
          return;
        }

        // Update all specified messages to include current user in readers array
        await prisma.message.updateMany({
          where: {
            id: { in: messageIds },
            chatRoomId: chatRoomId,
            userId: { not: userId } // Don't mark own messages as read
          },
          data: {
            readers: {
              push: userId // Add userId to readers array
            }
          }
        });

        // Update member's lastReadAt
        await prisma.chatMember.updateMany({
          where: {
            userId: userId,
            chatRoomId: chatRoomId
          },
          data: {
            lastReadAt: new Date()
          }
        });

        // Notify other members about read status
        const members = await prisma.chatMember.findMany({
          where: { 
            chatRoomId: chatRoomId,
            userId: { not: userId }
          },
          select: { userId: true }
        });

        members.forEach((member) => {
          io.to(member.userId).emit("message:readUpdate", {
            chatRoomId: chatRoomId,
            messageIds: messageIds,
            readBy: userId
          });
        });

        console.log(`✅ Messages marked as read by ${userId} in room ${chatRoomId}`);

      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // ==================== TYPING INDICATORS ====================
    socket.on("typing:start", ({ chatRoomId }) => {
      if (!chatRoomId || !userId) return;

      // Broadcast to everyone in the room except sender
      socket.to(chatRoomId).emit("typing:show", {
        chatRoomId: chatRoomId,
        userId: userId
      });

      console.log(`⌨️ User ${userId} started typing in room ${chatRoomId}`);
    });

    socket.on("typing:stop", ({ chatRoomId }) => {
      if (!chatRoomId || !userId) return;

      // Broadcast to everyone in the room except sender
      socket.to(chatRoomId).emit("typing:hide", {
        chatRoomId: chatRoomId,
        userId: userId
      });

      console.log(`⌨️ User ${userId} stopped typing in room ${chatRoomId}`);
    });

    // ==================== DISCONNECT ====================
    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", socket.id);
    });
  });

  return io;
};

module.exports = setupSocket;