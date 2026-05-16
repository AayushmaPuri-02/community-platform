const Notification = require("../models/Notification");

exports.markRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) return res.redirect("/home");

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
};
