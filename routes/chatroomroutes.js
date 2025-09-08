const express = require("express");
const router = express.Router();
const {
  createOrGetChatRoom,
  getChatRoom,
  getActiveMembers,
  getUserChatRooms,
  getChatRoomMembers,
} = require("../controllers/chatroomcontroller");
const { getMessages, sendMessage } = require("../controllers/messagescontroller");

// Chatrooms
router.post("/chatrooms", createOrGetChatRoom);
router.get("/chatrooms/user/:userId", getUserChatRooms); 
router.get("/chatrooms/:chatRoomId", getChatRoom);
router.get("/chatrooms/:chatRoomId/members", getChatRoomMembers); // Add this route
router.get("/chatrooms/:chatRoomId/active-members", getActiveMembers);

// Messages
router.get("/chatrooms/:chatRoomId/messages", getMessages);
router.post("/chatrooms/:chatRoomId/messages", sendMessage);

module.exports = router;