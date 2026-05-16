const Notification = require("../models/Notification");
const { sendEmail } = require("./mailer");
const { generateEmailTemplate } = require("./emailTemplate");
const User = require("../models/User");

/**
 * Create a notification for a user.
 * If the user now has exactly 5 unread notifications, send a summary email.
 */
async function createNotification(recipientId, message, link) {
    try {
        await Notification.create({ recipient: recipientId, message, link });

        // Count total unread for this user
        const unreadCount = await Notification.countDocuments({
            recipient: recipientId,
            isRead: false,
        });

        // Send email nudge at exactly 5 unread
        if (unreadCount === 5) {
            const user = await User.findById(recipientId).select("email fullName organizationName");
            if (user && user.email) {
                sendEmail({
                    to: user.email,
                    subject: "You have new notifications — Local Connect",
                    html: generateEmailTemplate({
                        heading: "You Have New Notifications",
                        name: user.organizationName || user.fullName || "there",
                        body: "You have unread notifications waiting for you on Local Connect.\nLog in to see what's new in your community.",
                        footer: "You are receiving this because you have 5 or more unread notifications.",
                    }),
                });
            }
        }
    } catch (err) {
        // Notifications are non-critical — log but never throw
        console.log("Notification error:", err.message);
    }
}

/**
 * Create or update a message notification.
 * If an unread notification from the same sender to the same recipient already
 * exists (matched by link), update it instead of creating a duplicate.
 */
async function createMessageNotification(recipientId, senderId, senderName) {
    try {
        const link = `/messages/${senderId}`;
        const message = `New message from ${senderName}`;

        const existing = await Notification.findOne({
            recipient: recipientId,
            link,
            isRead: false,
        });

        if (existing) {
            // Update text and bump timestamp so it surfaces at the top
            existing.message = message;
            existing.updatedAt = new Date();
            await existing.save();
        } else {
            await Notification.create({ recipient: recipientId, message, link });
        }
    } catch (err) {
        console.log("Message notification error:", err.message);
    }
}

module.exports = { createNotification, createMessageNotification };
