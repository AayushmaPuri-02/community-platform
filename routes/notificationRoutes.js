const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");

router.get("/notifications/:id/read", isLoggedIn, notificationController.markRead);

module.exports = router;
