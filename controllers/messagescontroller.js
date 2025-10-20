const prisma = require("../lib/prisma");
const asyncHandler = require("express-async-handler");

// Get messages for a chatroom
const getMessages = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { page = 1, limit = 50 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const messages = await prisma.message.findMany({
    where: {
      chatRoomId: chatRoomId,
      system: { not: true } // Exclude system messages from display
    },
    include: {
      user: { // Note: your schema uses 'user' not 'sender'
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          // avatar: true // Add this if you add avatar field to User model
        }
      }
    },
    orderBy: { createdAt: 'asc' },
    skip: skip,
    take: parseInt(limit),
  });

  // Transform the response to match frontend expectations
  const transformedMessages = messages.map(message => ({
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    senderId: message.userId, // Frontend expects 'senderId'
    sender: message.user, // Frontend expects 'sender'
    system: message.system,
    chatRoomId: message.chatRoomId
  }));

  res.json(transformedMessages);
});

// Send message to chatroom
const sendMessage = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { senderId, content, image } = req.body;

  if (!senderId || (!content && !image)) {
    return res.status(400).json({ error: "Sender ID and content are required" });
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
              username: true,
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
      userId: String(senderId), // Note: your schema uses 'userId' not 'senderId'
      content: content || "",
      system: false,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          // avatar: true // Add this if you add avatar field
        }
      }
    }
  });

  // Update chatroom's updatedAt timestamp
  await prisma.chatRoom.update({
    where: { id: chatRoomId },
    data: { updatedAt: new Date() }
  });

  // Transform the response to match frontend expectations
  const transformedMessage = {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    senderId: message.userId, // Frontend expects 'senderId'
    sender: message.user, // Frontend expects 'sender'
    system: message.system,
    chatRoomId: message.chatRoomId
  };

  // ✅ EMIT SOCKET EVENT TO ALL MEMBERS IN THE CHATROOM
  const io = req.app.get('io'); // Get socket.io instance from app
  
  if (io) {
    // Emit to the room (people actively in the chat)
    io.to(chatRoomId).emit("newMessage", transformedMessage);
    
    // ✅ CRITICAL: Emit chatListUpdate to ALL members (even those not in the room)
    chatRoom.members.forEach(member => {
      io.to(member.userId).emit("chatListUpdate", {
        chatRoomId: chatRoomId,
        message: transformedMessage
      });
    });
    
    // console.log(`📤 Emitted chatListUpdate to ${chatRoom.members.length} members`);
  }

  res.status(201).json(transformedMessage);
});

module.exports = {
  getMessages,
  sendMessage
};