const express = require("express");
const router = express.Router();
const {
  createOrGetChatRoom,
  getChatRoom,
  getActiveMembers,
  getUserChatRooms,
  getChatRoomMembers,
} = require("../controllers/chatroomcontroller");
const {
  getMessages,
  sendMessage,
  uploadAudio,
  handleAudioUpload,
  deleteAudio,
  handleImageUpload,
  uploadthingRouter,
} = require("../controllers/messagescontroller");
const validateTokenHandler = require("../middleware/validateTokenHandler");
const { createRouteHandler } = require("uploadthing/express");

//Image - Uploadthing
router.use(
  "/uploadthing",
  createRouteHandler({
    router: uploadthingRouter,
    config: {
      uploadthingId: process.env.UPLOADTHING_APP_ID,
      uploadthingSecret: process.env.UPLOADTHING_SECRET,
      uploadthingToken: process.env.UPLOADTHING_TOKEN,
    },
  })
);

// Apply token validation middleware to all routes
router.use(validateTokenHandler);

// Chatrooms
router.post("/chatrooms", createOrGetChatRoom);
router.get("/chatrooms/user/:userId", getUserChatRooms);
router.get("/chatrooms/:chatRoomId", getChatRoom);
router.get("/chatrooms/:chatRoomId/members", getChatRoomMembers); // Add this route
router.get("/chatrooms/:chatRoomId/active-members", getActiveMembers);

// Messages
router.get("/chatrooms/:chatRoomId/messages", getMessages);
router.post("/chatrooms/:chatRoomId/messages", sendMessage);

// Audio
router.post(
  "/chatrooms/:chatRoomId/messages/audio",
  uploadAudio,
  handleAudioUpload
);
router.delete("/chatrooms/:chatRoomId/messages/audio/:filename", deleteAudio);

//Media
router.post("/chatrooms/:chatRoomId/messages/image", handleImageUpload);

module.exports = router;
