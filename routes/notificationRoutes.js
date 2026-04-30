const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const { isLoggedIn } = require("../middleware/authMiddleware");

// GET /notifications/:id/read — mark as read and redirect to the notification's link
router.get("/notifications/:id/read", isLoggedIn, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.redirect("/home");
        }

        // Only the recipient can mark it read
        if (notification.recipient.toString() !== req.session.userId.toString()) {
            return res.redirect("/home");
        }

        notification.isRead = true;
        await notification.save();

        return res.redirect(notification.link);
    } catch (err) {
        console.log(err);
        return res.redirect("/home");
    }
});

module.exports = router;
