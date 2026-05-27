const crypto = require("crypto");
const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Report = require("../models/Report");
const Follow = require("../models/Follow");
const { sendEmail } = require("../utils/mailer");
const { generateEmailTemplate } = require("../utils/emailTemplate");
const {
    buildRecentActivityText,
    enrichPostsForPreview,
} = require("../utils/adminHelpers");
const { getReasonLabel } = require("../utils/reportReasons");

function openReportsQuery() {
    return {
        $or: [
            { status: "pending" },
            { status: { $exists: false }, warningSent: { $ne: true } },
        ],
    };
}

function userDisplayName(user) {
    if (!user) return "Unknown";
    return user.communityName || user.organizationName || user.fullName || "Unknown";
}

exports.getDashboard = async (req, res) => {
    try {
        const pendingOrgRequests = await User.countDocuments({ status: "pending", role: "organization" });
        const pendingCommunityRequests = await User.countDocuments({ status: "pending", role: "communityAdmin" });
        const totalOrganizations = await User.countDocuments({ status: "approved", role: "organization" });
        const totalCommunityAdmins = await User.countDocuments({ status: "approved", role: "communityAdmin" });
        const totalCitizens = await User.countDocuments({ role: "citizen" });
        const approvedCount = await User.countDocuments({ status: "approved", role: { $in: ["organization", "communityAdmin"] } });
        const pendingCount = await User.countDocuments({ status: "pending", role: { $in: ["organization", "communityAdmin"] } });
        const rejectedCount = await User.countDocuments({ status: "rejected", role: { $in: ["organization", "communityAdmin"] } });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentActivityUsers = await User.find({
            role: { $in: ["organization", "communityAdmin"] },
            updatedAt: { $gte: sevenDaysAgo },
        }).sort({ updatedAt: -1 }).limit(8);

        const recentActivities = recentActivityUsers.map((user) => ({
            text: buildRecentActivityText(user),
            date: user.updatedAt || user.createdAt,
            status: user.status,
        }));

        const totalReports = await Report.countDocuments(openReportsQuery());

        res.render("admin/index", {
            title: "System Admin Dashboard",
            layout: "layouts/admin",
            pendingOrgRequests, pendingCommunityRequests, totalOrganizations, totalCommunityAdmins,
            totalCitizens, approvedCount, pendingCount, rejectedCount, recentActivities, totalReports,
            activeAdminTab: "dashboard",
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading admin dashboard");
    }
};

exports.getRequests = async (req, res) => {
    try {
        const pendingUsers = await User.find({
            status: "pending",
            role: { $in: ["organization", "communityAdmin"] },
        }).sort({ createdAt: -1 });

        res.render("admin/requests", {
            title: "Verification Requests",
            layout: "layouts/admin",
            pendingUsers,
            activeAdminTab: "requests",
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading requests");
    }
};

exports.getRequestDetail = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.send("User not found");

        res.render("admin/requestDetail", {
            title: "Request Detail",
            layout: "layouts/admin",
            user,
            activeAdminTab: "requests",
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading request");
    }
};

exports.approveRequest = async (req, res) => {
    try {
        const token = crypto.randomBytes(32).toString("hex");

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isApproved: true, status: "approved", rejectionReason: "", verificationToken: token, isVerified: false },
            { new: true }
        );

        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/admin/requests");
        }

        sendEmail({
            to: user.email,
            subject: "Your Account Has Been Approved - Local Connect",
            html: generateEmailTemplate({
                heading: "Account Approved",
                name: user.organizationName || user.fullName || "User",
                body: "Great news — your Local Connect account has been approved.\nPlease verify your email address by clicking the link below to complete your setup and log in.",
                highlight: `<a href="${process.env.BASE_URL || "http://localhost:3000"}/verify/${token}" style="color:#04888D;font-weight:600;">Verify my email</a>`,
                highlightLabel: "Verification link",
            }),
        });

        req.flash("success", "User approved successfully");
        return res.redirect("/admin/requests");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error approving user");
        return res.redirect("/admin/requests");
    }
};

exports.rejectRequest = async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { isApproved: false, status: "rejected", rejectionReason },
            { new: true }
        );

        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/admin/requests");
        }

        sendEmail({
            to: user.email,
            subject: "Update on Your Local Connect Registration",
            html: generateEmailTemplate({
                heading: "Registration Not Approved",
                name: user.organizationName || user.fullName || "User",
                body: "Thank you for registering with Local Connect.\nUnfortunately, your registration was not approved at this time.",
                highlight: rejectionReason || null,
                highlightLabel: rejectionReason ? "Reason" : null,
                footer: "If you believe this is a mistake or would like to reapply with the correct details, please register again.",
            }),
        });

        req.flash("info", "User rejected successfully");
        return res.redirect("/admin/requests");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error rejecting user");
        return res.redirect("/admin/requests");
    }
};

exports.getDirectory = async (req, res) => {
    try {
        const selected = req.query.type || "organization";
        let roleFilter = "organization";
        if (selected === "communityAdmin") roleFilter = "communityAdmin";
        if (selected === "citizen") roleFilter = "citizen";

        const directoryUsers = await User.find({
            role: roleFilter,
            ...(roleFilter === "citizen" ? {} : { status: "approved" }),
        }).sort({ createdAt: -1 });

        const organizationCount = await User.countDocuments({ role: "organization", status: "approved" });
        const communityAdminCount = await User.countDocuments({ role: "communityAdmin", status: "approved" });
        const citizenCount = await User.countDocuments({ role: "citizen" });

        res.render("admin/directory", {
            title: "Directory",
            layout: "layouts/admin",
            activeAdminTab: "directory",
            directoryUsers, selected, organizationCount, communityAdminCount, citizenCount,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading directory");
    }
};

exports.getDirectoryDetail = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/admin/directory");
        }

        let userPosts = [];
        let attendedVolunteers = [];
        let upcomingVolunteers = [];
        let recentComments = [];

        if (user.role === "citizen") {
            const volunteerHistory = await Post.find({
                "volunteers.user": user._id,
                type: "volunteer",
            })
                .populate("author", "fullName organizationName communityName")
                .sort({ volunteerDate: -1 });

            volunteerHistory.forEach((vp) => {
                const entry = vp.volunteers.find(
                    (v) => v.user && v.user.toString() === user._id.toString()
                );
                if (!entry) return;
                if (entry.status === "attended") {
                    attendedVolunteers.push({ post: vp, entry });
                } else if (entry.status !== "rejected") {
                    upcomingVolunteers.push({ post: vp, entry });
                }
            });

            recentComments = await Comment.find({ author: user._id })
                .populate("post", "title")
                .sort({ createdAt: -1 })
                .limit(8);
        } else {
            const posts = await Post.find({ author: user._id })
                .sort({ createdAt: -1 })
                .select(
                    "title type createdAt description images alertStatus alertCategory alertRadius volunteerDate maxVolunteers"
                );
            userPosts = enrichPostsForPreview(posts);
        }

        res.render("admin/directoryDetail", {
            title: "Directory Detail",
            layout: "layouts/admin",
            activeAdminTab: "directory",
            user,
            userPosts,
            attendedVolunteers,
            upcomingVolunteers,
            recentComments,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading directory detail");
    }
};

exports.getReports = async (req, res) => {
    try {
        const postReports = await Report.find({
            $or: [{ reportType: "post" }, { reportType: { $exists: false } }],
            status: { $ne: "dismissed" },
        })
            .populate({ path: "post", populate: { path: "author" } })
            .populate("reportedBy")
            .sort({ createdAt: -1 });

        const accountReports = await Report.find({
            reportType: "account",
            status: { $ne: "dismissed" },
        })
            .populate("reportedUser")
            .populate("reportedBy")
            .sort({ createdAt: -1 });

        const warnedUsers = await User.find(
            { "warningHistory.0": { $exists: true } },
            {
                fullName: 1,
                organizationName: 1,
                communityName: 1,
                role: 1,
                warningHistory: 1,
                isSuspended: 1,
                suspendedAt: 1,
            }
        ).sort({ "warningHistory.warnedAt": -1 });

        res.render("admin/reports", {
            title: "Reports",
            layout: "layouts/admin",
            activeAdminTab: "reports",
            postReports,
            accountReports,
            warnedUsers,
            getReasonLabel,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading reports");
    }
};

exports.getReportReview = async (req, res) => {
    try {
        const postDoc = await Post.findById(req.params.postId).populate("author");
        if (!postDoc) {
            req.flash("error", "Post not found");
            return res.redirect("/admin/reports");
        }

        const [post] = enrichPostsForPreview([postDoc]);

        const reports = await Report.find({
            post: post._id,
            $or: [{ reportType: "post" }, { reportType: { $exists: false } }],
            status: { $ne: "dismissed" },
        })
            .populate("reportedBy")
            .sort({ createdAt: -1 });

        res.render("admin/reportReview", {
            title: "Review Reported Post",
            layout: "layouts/admin",
            activeAdminTab: "reports",
            post,
            reports,
            getReasonLabel,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading report review");
    }
};

exports.getUserReview = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/admin/reports");
        }

        const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });

        const accountReports = await Report.find({
            reportType: "account",
            reportedUser: user._id,
            status: { $ne: "dismissed" },
        })
            .populate("reportedBy")
            .sort({ createdAt: -1 });

        let followerCount = 0;
        let followingCount = 0;
        if (user.role === "organization" || user.role === "communityAdmin") {
            followerCount = await Follow.countDocuments({ following: user._id });
        }
        followingCount = await Follow.countDocuments({ follower: user._id });

        const backUrl = req.query.from || "/admin/reports";
        const anyReviewed = accountReports.some(
            (r) => r.status === "reviewed" || r.warningSent
        );

        res.render("admin/userReview", {
            title: "User Profile — Moderation View",
            layout: "layouts/admin",
            activeAdminTab: "reports",
            user,
            posts,
            accountReports,
            anyReviewed,
            followerCount,
            followingCount,
            backUrl,
            getReasonLabel,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading user review");
    }
};

exports.sendWarning = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate({ path: "post", populate: { path: "author" } })
            .populate("reportedUser");

        if (!report) {
            req.flash("error", "Report not found");
            return res.redirect("/admin/reports");
        }

        const customMessage = req.body.message ? req.body.message.trim() : "";
        if (!customMessage) {
            req.flash("error", "Warning message cannot be empty");
            return res.redirect(req.body.returnTo || "/admin/reports");
        }

        const msgWordCount = customMessage.split(/\s+/).filter(Boolean).length;
        if (msgWordCount > 50) {
            req.flash("error", "Warning message must be 50 words or less");
            return res.redirect(req.body.returnTo || "/admin/reports");
        }

        let targetUser = null;
        let emailSubject = "Content Warning — Local Connect";
        let emailBody =
            "Your account activity has been reported and reviewed by our moderation team.\nPlease review the message below and ensure you follow our community guidelines.\nRepeated violations may result in account restriction.";
        let emailHighlight = `<strong>Message from moderation team:</strong><br>${customMessage}`;
        let redirectUrl = req.body.returnTo || "/admin/reports";

        if (report.reportType === "account" && report.reportedUser) {
            targetUser = report.reportedUser;
            emailBody =
                "Your profile has been reported by a community member and reviewed by our moderation team.\nPlease review the message below and ensure your profile and behaviour follow our community guidelines.\nRepeated violations may result in account restriction.";
            redirectUrl = `/admin/reports/user/${targetUser._id}?from=/admin/reports`;
        } else if (report.post && report.post.author) {
            targetUser = report.post.author;
            const postTitle = report.post.title || "your post";
            emailBody =
                "One of your posts has been reported by a community member and reviewed by our moderation team.\nPlease review the message below and ensure your future content follows our community guidelines.\nRepeated violations may result in account restriction.";
            emailHighlight = `<strong>Post:</strong> ${postTitle}<br><br><strong>Message from moderation team:</strong><br>${customMessage}`;
            redirectUrl = `/admin/reports/post/${report.post._id}`;
        } else {
            req.flash("error", "Could not find the reported user");
            return res.redirect("/admin/reports");
        }

        const targetName = userDisplayName(targetUser);

        sendEmail({
            to: targetUser.email,
            subject: emailSubject,
            html: generateEmailTemplate({
                heading: "Content Warning Notice",
                name: targetName,
                body: emailBody,
                highlight: emailHighlight,
                highlightLabel: "Details",
                footer: "If you believe this was a mistake, please contact our support team.",
            }),
        });

        if (report.reportType === "account") {
            await Report.updateMany(
                {
                    reportType: "account",
                    reportedUser: targetUser._id,
                    warningSent: { $ne: true },
                    status: { $ne: "dismissed" },
                },
                { $set: { status: "reviewed", warningSent: true } }
            );
        } else {
            await Report.updateMany(
                {
                    post: report.post._id,
                    $or: [{ reportType: "post" }, { reportType: { $exists: false } }],
                    warningSent: { $ne: true },
                    status: { $ne: "dismissed" },
                },
                { $set: { status: "reviewed", warningSent: true } }
            );
        }

        await User.findByIdAndUpdate(targetUser._id, {
            $push: {
                warningHistory: {
                    reason: report.reason,
                    note: customMessage,
                    reportId: report._id,
                    warnedAt: new Date(),
                },
            },
        });

        req.flash("success", "Warning email sent");
        return res.redirect(redirectUrl);
    } catch (err) {
        console.log(err);
        req.flash("error", "Error sending warning");
        return res.redirect("/admin/reports");
    }
};

exports.dismissReport = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            req.flash("error", "Report not found");
            return res.redirect("/admin/reports");
        }

        report.status = "dismissed";
        await report.save();

        req.flash("success", "Report marked as dismissed");
        const returnTo = req.body.returnTo || "/admin/reports";
        return res.redirect(returnTo);
    } catch (err) {
        console.log(err);
        req.flash("error", "Error dismissing report");
        return res.redirect("/admin/reports");
    }
};

function adminReturnRedirect(res, returnTo, fallback) {
    const url = typeof returnTo === "string" ? returnTo.trim() : "";
    if (url && url.startsWith("/admin")) {
        return res.redirect(url);
    }
    return res.redirect(fallback);
}

// Manual suspension only — admins review warnings/reports before suspending.
exports.suspendUser = async (req, res) => {
    const fallback = "/admin/reports";
    try {
        const targetId = req.params.id;
        const adminId = req.session.userId;

        if (targetId === adminId.toString()) {
            req.flash("error", "You cannot suspend your own account");
            return adminReturnRedirect(res, req.body.returnTo, fallback);
        }

        const user = await User.findById(targetId);
        if (!user) {
            req.flash("error", "User not found");
            return adminReturnRedirect(res, req.body.returnTo, fallback);
        }

        if (user.role === "systemAdmin") {
            req.flash("error", "System admin accounts cannot be suspended");
            return adminReturnRedirect(res, req.body.returnTo, fallback);
        }

        const suspendedReason = req.body.suspendedReason ? req.body.suspendedReason.trim() : "";

        user.isSuspended = true;
        user.suspendedAt = new Date();
        user.suspendedReason = suspendedReason;
        user.suspendedBy = adminId;

        user.warningHistory.push({
            reason: "account_suspension",
            note: suspendedReason || "Account suspended by system administrator.",
            warnedAt: new Date(),
        });

        await user.save();

        const targetName = userDisplayName(user);
        let emailBody =
            "Your Local Connect account has been suspended by the system administrator due to a moderation review. You will not be able to log in while the account remains suspended.";
        if (suspendedReason) {
            emailBody += `\n\nReason: ${suspendedReason}`;
        }

        try {
            await sendEmail({
                to: user.email,
                subject: "Local Connect Account Suspension Notice",
                html: generateEmailTemplate({
                    heading: "Account Suspended",
                    name: targetName,
                    body: emailBody,
                    highlight: suspendedReason || null,
                    highlightLabel: suspendedReason ? "Reason" : null,
                    footer: "If you believe this was a mistake, please contact our support team.",
                }),
            });
        } catch (emailErr) {
            console.error("Suspension email failed:", emailErr.message);
        }

        req.flash("success", "Account suspended successfully");
        return adminReturnRedirect(res, req.body.returnTo, `/admin/directory/${targetId}`);
    } catch (err) {
        console.error("suspendUser error:", err);
        req.flash("error", "Error suspending account");
        return adminReturnRedirect(res, req.body.returnTo, fallback);
    }
};

exports.unsuspendUser = async (req, res) => {
    const fallback = "/admin/reports";
    try {
        const targetId = req.params.id;
        const user = await User.findById(targetId);

        if (!user) {
            req.flash("error", "User not found");
            return adminReturnRedirect(res, req.body.returnTo, fallback);
        }

        user.isSuspended = false;
        await user.save();

        const targetName = userDisplayName(user);

        try {
            await sendEmail({
                to: user.email,
                subject: "Local Connect Account Reinstated",
                html: generateEmailTemplate({
                    heading: "Account Reinstated",
                    name: targetName,
                    body: "Your Local Connect account has been reinstated. You can now log in and continue using Local Connect.",
                    footer: "Thank you for your cooperation with our community guidelines.",
                }),
            });
        } catch (emailErr) {
            console.error("Unsuspension email failed:", emailErr.message);
        }

        req.flash("success", "Account unsuspended successfully");
        return adminReturnRedirect(res, req.body.returnTo, `/admin/directory/${targetId}`);
    } catch (err) {
        console.error("unsuspendUser error:", err);
        req.flash("error", "Error unsuspending account");
        return adminReturnRedirect(res, req.body.returnTo, fallback);
    }
};

exports.deleteReport = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);

        if (!report) {
            req.flash("error", "Report not found");
            return res.redirect("/admin/reports");
        }

        // Delete only the report record — post, user, and warningHistory are untouched
        await Report.findByIdAndDelete(req.params.id);

        req.flash("success", "Report record removed successfully.");
        return res.redirect("/admin/reports");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error removing report");
        return res.redirect("/admin/reports");
    }
};
