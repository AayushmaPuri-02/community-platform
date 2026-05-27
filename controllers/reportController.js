const Report = require("../models/Report");
const Post = require("../models/Post");
const User = require("../models/User");
const { createNotification } = require("../utils/notifications");
const { isValidPostReason, isValidAccountReason } = require("../utils/reportReasons");

function displayName(user) {
    if (!user) return "Unknown";
    return user.communityName || user.organizationName || user.fullName || "Unknown";
}

exports.submitPostReport = async (req, res) => {
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

        if (!reason || !isValidPostReason(reason)) {
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
            reportType: "post",
            post: post._id,
            reportedBy: req.session.userId,
            reason,
            note: trimmedNote,
            status: "pending",
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

exports.submitAccountReport = async (req, res) => {
    try {
        const reportedUser = await User.findById(req.params.id);
        if (!reportedUser) {
            req.flash("error", "User not found");
            return res.redirect("/home");
        }

        if (reportedUser._id.toString() === req.session.userId.toString()) {
            req.flash("error", "You cannot report your own profile");
            return res.redirect(`/users/${reportedUser._id}`);
        }

        if (reportedUser.role === "systemAdmin") {
            req.flash("error", "This profile cannot be reported");
            return res.redirect(`/users/${reportedUser._id}`);
        }

        const { reason, note } = req.body;

        if (!reason || !isValidAccountReason(reason)) {
            req.flash("error", "Please select a valid reason");
            return res.redirect(`/users/${reportedUser._id}`);
        }

        const trimmedNote = note ? note.trim() : "";
        if (trimmedNote.length > 300) {
            req.flash("error", "Note must be 300 characters or less");
            return res.redirect(`/users/${reportedUser._id}`);
        }

        await Report.create({
            reportType: "account",
            reportedUser: reportedUser._id,
            reportedBy: req.session.userId,
            reason,
            note: trimmedNote,
            status: "pending",
        });

        await createNotification(
            req.session.userId,
            `Your report on ${displayName(reportedUser)} has been submitted and is under review`,
            `/users/${reportedUser._id}`
        );

        req.flash("success", "Report submitted. Thank you for helping keep the community safe.");
        return res.redirect(`/users/${reportedUser._id}`);
    } catch (err) {
        console.log(err);
        req.flash("error", "Error submitting report");
        return res.redirect("/home");
    }
};
