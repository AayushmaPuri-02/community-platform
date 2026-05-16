const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const { createNotification, createMessageNotification } = require("../utils/notifications");

async function getConversationList(currentUser) {
    const allMessages = await Message.find({
        $or: [{ sender: currentUser }, { receiver: currentUser }],
    })
        .populate("sender")
        .populate("receiver")
        .sort({ createdAt: -1 });

    const conversationMap = new Map();

    for (const msg of allMessages) {
        if (!msg.sender || !msg.receiver) continue;

        const otherUser =
            msg.sender._id.toString() === currentUser.toString()
                ? msg.receiver
                : msg.sender;

        if (!otherUser) continue;

        const otherUserId = otherUser._id.toString();
        const previewText = msg.isDeleted ? "Message deleted" : msg.text;

        if (!conversationMap.has(otherUserId)) {
            conversationMap.set(otherUserId, {
                user: otherUser,
                latestMessage: previewText,
                latestMessageTime: msg.createdAt,
                hasUnread:
                    msg.receiver &&
                    msg.receiver._id.toString() === currentUser.toString() &&
                    !msg.isRead,
            });
        } else {
            const existing = conversationMap.get(otherUserId);
            if (
                msg.receiver &&
                msg.receiver._id.toString() === currentUser.toString() &&
                !msg.isRead
            ) {
                existing.hasUnread = true;
            }
        }
    }

    return Array.from(conversationMap.values());
}

exports.getInbox = async (req, res) => {
    try {
        const currentUser = req.session.userId;
        const conversations = await getConversationList(currentUser);

        return res.render("messages/index", {
            title: "Messages",
            conversations,
            userId: currentUser,
        });
    } catch (err) {
        console.log(err);
        return res.send("Error loading messages");
    }
};

exports.getChat = async (req, res) => {
    try {
        const currentUser = req.session.userId;
        const otherUser = req.params.userId;

        await Message.updateMany(
            { sender: otherUser, receiver: currentUser, isRead: false },
            { isRead: true }
        );

        // Mark any unread message notifications from this sender as read.
        // Catches both current format (/messages/:senderId) and any old
        // notifications whose link contains the sender's ID string.
        await Notification.updateMany(
            {
                recipient: currentUser,
                isRead: false,
                $or: [
                    { link: `/messages/${otherUser}` },
                    { link: { $regex: otherUser.toString(), $options: "i" } },
                ],
            },
            { isRead: true }
        );

        const messages = await Message.find({
            $or: [
                { sender: currentUser, receiver: otherUser },
                { sender: otherUser, receiver: currentUser },
            ],
        })
            .populate("sender")
            .populate("receiver")
            .sort({ createdAt: 1 });

        const otherUserData = await User.findById(otherUser);
        const conversations = await getConversationList(currentUser);

        return res.render("messages/chat", {
            title: "Messages",
            messages,
            otherUser,
            otherUserData,
            conversations,
            userId: currentUser,
        });
    } catch (err) {
        console.log(err);
        return res.send("Error loading chat");
    }
};

exports.sendMessage = async (req, res) => {
    try {
        const trimmedText = req.body.text ? req.body.text.trim() : "";

        if (!trimmedText) {
            req.flash("error", "Message cannot be empty");
            return res.redirect(`/messages/${req.params.userId}`);
        }

        const newMessage = new Message({
            sender: req.session.userId,
            receiver: req.params.userId,
            text: trimmedText,
        });

        await newMessage.save();

        const sender = await User.findById(req.session.userId).select("fullName organizationName communityName role");
        const senderName = sender
            ? (sender.role === "communityAdmin" ? sender.communityName : sender.organizationName || sender.fullName)
            : "Someone";

        await createMessageNotification(req.params.userId, req.session.userId, senderName);

        return res.redirect(`/messages/${req.params.userId}`);
    } catch (err) {
        console.log(err);
        return res.send("Error sending message");
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.messageId);

        if (!message) {
            req.flash("error", "Message not found");
            return res.redirect("/messages");
        }

        if (message.sender.toString() !== req.session.userId.toString()) {
            req.flash("error", "You can only delete your own messages");
            return res.redirect(`/messages/${message.receiver}`);
        }

        const otherUserId = message.receiver.toString();

        message.text = "";
        message.isDeleted = true;
        message.deletedBy = req.session.userId;
        await message.save();

        req.flash("success", "Message deleted");
        return res.redirect(`/messages/${otherUserId}`);
    } catch (err) {
        console.log(err);
        req.flash("error", "Error deleting message");
        return res.redirect("/messages");
    }
};
