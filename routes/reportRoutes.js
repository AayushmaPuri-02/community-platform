const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const reportController = require("../controllers/reportController");

router.post("/posts/:id/report", isLoggedIn, reportController.submitPostReport);
router.post("/users/:id/report", isLoggedIn, reportController.submitAccountReport);

module.exports = router;
