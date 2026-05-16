const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const { ensureProfileComplete } = require("../middleware/authMiddleware");
const followingController = require("../controllers/followingController");

router.get("/", isLoggedIn, ensureProfileComplete, followingController.getFollowing);

module.exports = router;
