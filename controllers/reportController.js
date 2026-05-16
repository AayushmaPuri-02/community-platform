const Report = require("../models/Report");
const Post = require("../models/Post");
const { createNotification } = require("../utils/notifications");

const ALLOWED_REASONS = ["spam", "misinformation", "harassment", "hate_speech", "scam_fraud", "inappropriate"];

exports.submitReport = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            req.flash("error", "Post not found");
            return res.redirect("/home");
        }

        if (post.author.toString() === req.session.userId.toString()) {
            req.flash("error", "You cannot report your own post");
            return res.redirect(`/posts/${post._id}`);
        }

        const { reason, note } = req.body;

        if (!reason || !ALLOWED_REASONS.includes(reason)) {
            req.flash("error", "Please select a valid reason");
            return res.redirect(`/posts/${post._id}`);
        }

        const trimmedNote = note ? note.trim() : "";
        if (trimmedNote) {
            const wordCount = trimmedNote.split(/\s+/).filter(Boolean).length;
            if (wordCount > 10) {
                req.flash("error", "Note must be 10 words or less");
                return res.redirect(`/posts/${post._id}`);
            }
        }

        await Report.create({
            post: post._id,
            reportedBy: req.session.userId,
            reason,
            note: trimmedNote,
        });

        await createNotification(
            req.session.userId,
            `Your report on "${post.title}" has been submitted and is under review`,
            `/posts/${post._id}`
        );

        req.flash("success", "Report submitted. Thank you for helping keep the community safe.");
        return res.redirect(`/posts/${post._id}`);
    } catch (err) {
        console.log(err);
        req.flash("error", "Error submitting report");
        return res.redirect("/home");
    }
};
