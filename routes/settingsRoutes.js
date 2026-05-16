const express = require("express");
const router = express.Router();
const { isLoggedIn } = require("../middleware/authMiddleware");
const settingsController = require("../controllers/settingsController");

function canAccessSettings(req, res, next) {
    if (req.session.role !== "organization" && req.session.role !== "communityAdmin") {
        req.flash("error", "Access denied");
        return res.redirect("/home");
    }
    next();
}

router.get("/", isLoggedIn, settingsController.getSettings);
router.post("/account", isLoggedIn, canAccessSettings, settingsController.updateAccount);
router.post("/password", isLoggedIn, canAccessSettings, settingsController.updatePassword);
router.post("/notifications", isLoggedIn, settingsController.updateNotifications);

module.exports = router;
