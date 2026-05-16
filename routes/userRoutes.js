const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

router.get("/:id", isLoggedIn, userController.getUserProfile);

module.exports = router;
