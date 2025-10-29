const prisma = require("../lib/prisma");
const asyncHandler = require("express-async-handler");

// ==================== GET MESSAGES ====================
const getMessages = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const currentUserId = req.user?.id; // Assuming auth middleware adds user

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const messages = await prisma.message.findMany({
    where: {
      chatRoomId: chatRoomId,
      system: { not: true }
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
    },
    orderBy: { createdAt: "asc" },
    skip: skip,
    take: parseInt(limit)
  });

  // Transform messages for frontend
  const transformedMessages = messages.map((message) => ({
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
    chatRoomId: message.chatRoomId,
    // Helper: check if current user has read this message
    isRead: currentUserId ? message.readers.includes(currentUserId) : false
  }));

  res.json(transformedMessages);
});

// ==================== SEND MESSAGE (HTTP fallback) ====================
const sendMessage = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { senderId, content, type = "TEXT", mediaUrl = null, duration = null } = req.body;

  // Validate required fields based on message type
  if (!senderId) {
    return res.status(400).json({ error: "Sender ID is required" });
  }

  if (type === "TEXT" && !content) {
    return res.status(400).json({ error: "Content is required for text messages" });
  }

  if ((type === "AUDIO" || type === "IMAGE") && !mediaUrl) {
    return res.status(400).json({ error: "Media URL is required for audio/image messages" });
  }

  // Verify chatroom exists and user is a member
  const chatRoom = await prisma.chatRoom.findFirst({
    where: {
      id: chatRoomId,
      members: {
        some: {
          userId: String(senderId)
        }
      }
    },
    include: {
      members: {
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
      }
    }
  });

  if (!chatRoom) {
    return res.status(404).json({ error: "Chat room not found or access denied" });
  }

  // Create the message
  const message = await prisma.message.create({
    data: {
      chatRoomId: chatRoomId,
      userId: String(senderId),
      content: content || null,
      type: type,
      mediaUrl: mediaUrl,
      duration: duration,
      readers: [], // Initialize as empty
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

  // Update chatroom's updatedAt timestamp
  await prisma.chatRoom.update({
    where: { id: chatRoomId },
    data: { updatedAt: new Date() }
  });

  // Transform for frontend
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

  // Emit socket events
  const io = req.app.get("io");

  if (io) {
    // Emit to the room
    io.to(chatRoomId).emit("message:received", transformedMessage);

    // Emit chat list update to all members
    chatRoom.members.forEach((member) => {
      io.to(member.userId).emit("chatList:update", {
        chatRoomId: chatRoomId,
        message: transformedMessage
      });
    });
  }

  res.status(201).json(transformedMessage);
});

// ==================== GET UNREAD COUNT ====================
const getUnreadCount = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const currentUserId = req.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Count messages where current user is NOT in readers array
  const unreadCount = await prisma.message.count({
    where: {
      chatRoomId: chatRoomId,
      userId: { not: currentUserId }, // Don't count own messages
      readers: {
        none: currentUserId // User ID not in readers array
      }
    }
  });

  res.json({ unreadCount });
});

module.exports = {
  getMessages,
  sendMessage,
  getUnreadCount
};