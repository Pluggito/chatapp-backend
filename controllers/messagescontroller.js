const prisma = require("../lib/prisma");
const asyncHandler = require("express-async-handler");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/audio');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `voice-note-${uniqueSuffix}${ext}`);
  },
});

// File filter - only accept audio files
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/mp4'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only audio files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Export multer middleware
const uploadAudio = upload.single('audio');

// ==================== UPLOAD AUDIO HANDLER ====================
const handleAudioUpload = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const { chatRoomId } = req.body;

  if (!chatRoomId) {
    // Delete uploaded file if validation fails
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Chat room ID is required' });
  }

  // Verify user has access to this chat room (optional but recommended)
  if (req.user?.id) {
    const isMember = await prisma.chatMember.findUnique({
      where: {
        userId_chatRoomId: {
          userId: req.user.id,
          chatRoomId: chatRoomId
        }
      }
    });

    if (!isMember) {
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Not authorized to upload to this chat' });
    }
  }

  // Generate public URL
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/audio/${req.file.filename}`;

  console.log('✅ Audio uploaded:', {
    filename: req.file.filename,
    size: (req.file.size / 1024).toFixed(2) + 'KB',
    chatRoomId,
  });

  res.status(200).json({
    success: true,
    url: fileUrl,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// ==================== DELETE AUDIO (OPTIONAL) ====================
const deleteAudio = asyncHandler(async (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('🗑️ Audio deleted:', filename);
    res.status(200).json({ success: true, message: 'Audio deleted' });
  } else {
    res.status(404).json({ error: 'Audio file not found' });
  }
});

// ==================== EXISTING MESSAGE HANDLERS ====================
const getMessages = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const currentUserId = req.user?.id;

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
    isRead: currentUserId ? message.readers.includes(currentUserId) : false
  }));

  res.json(transformedMessages);
});

const sendMessage = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const { senderId, content, type = "TEXT", mediaUrl = null, duration = null } = req.body;

  if (!senderId) {
    return res.status(400).json({ error: "Sender ID is required" });
  }

  if (type === "TEXT" && !content) {
    return res.status(400).json({ error: "Content is required for text messages" });
  }

  if ((type === "AUDIO" || type === "IMAGE") && !mediaUrl) {
    return res.status(400).json({ error: "Media URL is required for audio/image messages" });
  }

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

  const message = await prisma.message.create({
    data: {
      chatRoomId: chatRoomId,
      userId: String(senderId),
      content: content || null,
      type: type,
      mediaUrl: mediaUrl,
      duration: duration,
      readers: [],
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

  await prisma.chatRoom.update({
    where: { id: chatRoomId },
    data: { updatedAt: new Date() }
  });

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

  const io = req.app.get("io");

  if (io) {
    io.to(chatRoomId).emit("message:received", transformedMessage);

    chatRoom.members.forEach((member) => {
      io.to(member.userId).emit("chatList:update", {
        chatRoomId: chatRoomId,
        message: transformedMessage
      });
    });
  }

  res.status(201).json(transformedMessage);
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const { chatRoomId } = req.params;
  const currentUserId = req.user?.id;

  if (!currentUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const unreadCount = await prisma.message.count({
    where: {
      chatRoomId: chatRoomId,
      userId: { not: currentUserId },
      readers: {
        none: currentUserId
      }
    }
  });

  res.json({ unreadCount });
});

module.exports = {
  getMessages,
  sendMessage,
  getUnreadCount,
  uploadAudio,        // Export multer middleware
  handleAudioUpload,  // Export handler
  deleteAudio        // Export delete handler (optional)
};