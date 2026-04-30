const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { isLoggedIn } = require("../middleware/authMiddleware");
const { createNotification } = require("../utils/notifications");

// helper to build conversation sidebar/inbox data
async function getConversationList(currentUser) {
  const allMessages = await Message.find({
    $or: [
      { sender: currentUser },
      { receiver: currentUser }
    ]
  })
    .populate("sender")
    .populate("receiver")
    .sort({ createdAt: -1 });

  const conversationMap = new Map();

  for (const msg of allMessages) {
    // Skip messages where either party's account has been deleted
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

// inbox
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.userId;
    const conversations = await getConversationList(currentUser);

    return res.render("messages/index", {
      title: "Messages",
      conversations,
      userId: currentUser
    });
  } catch (err) {
    console.log(err);
    return res.send("Error loading messages");
  }
});

// open chat
router.get("/:userId", isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.userId;
    const otherUser = req.params.userId;

    await Message.updateMany(
      {
        sender: otherUser,
        receiver: currentUser,
        isRead: false
      },
      { isRead: true }
    );

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser, receiver: currentUser }
      ]
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
      userId: currentUser
    });
  } catch (err) {
    console.log(err);
    return res.send("Error loading chat");
  }
});

// send message
router.post("/:userId", isLoggedIn, async (req, res) => {
  try {
    const trimmedText = req.body.text ? req.body.text.trim() : "";

    if (!trimmedText) {
      req.flash("error", "Message cannot be empty");
      return res.redirect(`/messages/${req.params.userId}`);
    }

    const newMessage = new Message({
      sender: req.session.userId,
      receiver: req.params.userId,
      text: trimmedText
    });

    await newMessage.save();

    // Notify the receiver
    const sender = await User.findById(req.session.userId).select("fullName organizationName");
    const senderName = sender ? (sender.organizationName || sender.fullName) : "Someone";
    await createNotification(
      req.params.userId,
      `New message from ${senderName}`,
      `/messages/${req.session.userId}`
    );

    return res.redirect(`/messages/${req.params.userId}`);
  } catch (err) {
    console.log(err);
    return res.send("Error sending message");
  }
});

// soft delete own sent message
router.post("/:messageId/delete", isLoggedIn, async (req, res) => {
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
});

module.exports = router;