const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const followController = require("../controllers/followController");

router.post("/:id/toggle", isLoggedIn, followController.toggleFollow);

module.exports = router;
