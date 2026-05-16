const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const messageController = require("../controllers/messageController");

router.get("/", isLoggedIn, messageController.getInbox);
router.get("/:userId", isLoggedIn, messageController.getChat);
router.post("/:userId", isLoggedIn, messageController.sendMessage);
router.post("/:messageId/delete", isLoggedIn, messageController.deleteMessage);

module.exports = router;
