const prisma = require("../lib/prisma");
const asyncHandler = require("express-async-handler");

// Create or get chatroom between two users
const createOrGetChatRoom = asyncHandler(async (req, res) => {
  const { currentUserId, otherUserId } = req.body;

  if (!currentUserId || !otherUserId) {
    return res.status(400).json({ error: "Missing user IDs" });
  }

  // Check if a chat already exists between them
  // Since you use ChatMember as junction table, we need to check differently
  let chatRoom = await prisma.chatRoom.findFirst({
    where: {
      type: "direct",
      AND: [
        { members: { some: { userId: String(currentUserId) } } },
        { members: { some: { userId: String(otherUserId) } } },
        { members: { none: { userId: { notIn: [String(currentUserId), String(otherUserId)] } } } }
      ],
    },
    include: { 
      members: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { user: true } // Note: your schema uses 'user' not 'sender'
      }
    },
  });

  // If not exist, create
  if (!chatRoom) {
    chatRoom = await prisma.chatRoom.create({
      data: {
        type: "direct",
        members: {
          create: [
            { userId: String(currentUserId) },
            { userId: String(otherUserId) },
          ],
        },
      },
      include: { 
        members: { include: { user: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: true }
        }
      },
    });

    // 🔑 Create a system message so the chat shows up immediately
    await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        userId: String(currentUserId), // Note: your schema uses 'userId' not 'senderId'
        content: "Chat started",
        system: true,
      },
    });

    // Refetch to include the system message
    chatRoom = await prisma.chatRoom.findUnique({
      where: { id: chatRoom.id },
      include: { 
        members: { include: { user: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: true }
        }
      },
    });

    // Update updatedAt so it floats to the top
    await prisma.chatRoom.update({
      where: { id: chatRoom.id },
      data: { updatedAt: new Date() },
    });
  }

  res.json(chatRoom);
});

// Get chatroom by ID
const getChatRoom = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;

  const chatRoom = await prisma.chatRoom.findFirst({
    where: { id: chatRoomId }, // Keep as string since your IDs are cuid()
    include: { 
      members: { include: { user: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { user: true }
      }
    },
  });

  if (!chatRoom) {
    return res.status(404).json({ error: "Chat room not found" });
  }

  res.json(chatRoom);
});

// Get user's chatrooms
const getUserChatRooms = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  const chatRooms = await prisma.chatRoom.findMany({
    where: {
      members: {
        some: {
          userId: String(userId),
        },
      },
    },
    include: {
      members: { 
        include: { user: true }
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { user: true }
      },
      _count: {
        select: {
          messages: true // Since you don't have 'read' field, just count all messages for now
        }
      }
    },
    orderBy: { updatedAt: 'desc' }, // Most recent chats first
  });

  // Format the response to include lastMessage and unreadCount
  const formattedChatRooms = chatRooms.map(chatRoom => ({
    ...chatRoom,
    lastMessage: chatRoom.messages[0] || null,
    unreadCount: 0, // Set to 0 for now since you don't have read receipts
  }));

  res.json(formattedChatRooms);
});

// Get chatroom members
const getChatRoomMembers = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;

  const chatRoom = await prisma.chatRoom.findUnique({
    where: { id: chatRoomId }, // Keep as string
    include: { 
      members: { 
        include: { user: true }
      }
    },
  });

  if (!chatRoom) {
    return res.status(404).json({ error: "Chat room not found" });
  }

  res.json(chatRoom.members);
});

// ✅ Get active members in a chatroom (updated for your schema)
const getActiveMembers = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;

  const chatRoom = await prisma.chatRoom.findUnique({
    where: { id: chatRoomId }, // Keep as string
    include: { 
      members: { 
        include: { user: true }
      }
    },
  });

  if (!chatRoom) {
    return res.status(404).json({ error: "Chat room not found" });
  }

  // For now, return all members since you don't have isActive field
  res.json(chatRoom.members);
});

module.exports = { 
  createOrGetChatRoom, 
  getChatRoom, 
  getUserChatRooms,
  getChatRoomMembers,
  getActiveMembers 
};