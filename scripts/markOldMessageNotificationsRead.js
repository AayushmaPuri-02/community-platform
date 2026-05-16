/**
 * One-time cleanup script.
 * Marks all unread "New message from ..." notifications as read.
 *
 * Run once from the project root:
 *   node scripts/markOldMessageNotificationsRead.js
 *
 * Safe to run multiple times — only affects isRead: false records.
 * Do NOT delete this file; keep it for documentation.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const Notification = require("../models/Notification");

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const result = await Notification.updateMany(
        {
            isRead: false,
            message: { $regex: /^New message from /i },
        },
        { $set: { isRead: true } }
    );

    console.log(`Done. Marked ${result.modifiedCount} old message notification(s) as read.`);
    await mongoose.disconnect();
}

run().catch((err) => {
    console.error("Script failed:", err.message);
    process.exit(1);
});
