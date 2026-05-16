const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const chatbotController = require("../controllers/chatbotController");

router.post("/", isLoggedIn, chatbotController.chat);

module.exports = router;
