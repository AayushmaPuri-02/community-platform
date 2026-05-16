const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

router.post("/posts/:id/report", isLoggedIn, reportController.submitReport);

module.exports = router;
