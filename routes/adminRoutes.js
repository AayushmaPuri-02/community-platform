const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { isSystemAdmin } = require("../middleware/authMiddleware");
const User = require("../models/User");
const Post = require("../models/Post");
const Report = require("../models/Report");
const { sendEmail } = require("../utils/mailer");
const { generateEmailTemplate } = require("../utils/emailTemplate");

router.get("/", isSystemAdmin, async (req, res) => {
  try {
    const pendingOrgRequests = await User.countDocuments({
      status: "pending",
      role: "organization",
    });

    const pendingCommunityRequests = await User.countDocuments({
      status: "pending",
      role: "communityAdmin",
    });

    const totalOrganizations = await User.countDocuments({
      status: "approved",
      role: "organization",
    });

    const totalCommunityAdmins = await User.countDocuments({
      status: "approved",
      role: "communityAdmin",
    });

    const totalCitizens = await User.countDocuments({
      role: "citizen",
    });

    const approvedCount = await User.countDocuments({
      status: "approved",
      role: { $in: ["organization", "communityAdmin"] },
    });

    const pendingCount = await User.countDocuments({
      status: "pending",
      role: { $in: ["organization", "communityAdmin"] },
    });

    const rejectedCount = await User.countDocuments({
      status: "rejected",
      role: { $in: ["organization", "communityAdmin"] },
    });

    // Recent activity: only last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivityUsers = await User.find({
      role: { $in: ["organization", "communityAdmin"] },
      updatedAt: { $gte: sevenDaysAgo },
    })
      .sort({ updatedAt: -1 })
      .limit(8);

    const recentActivities = recentActivityUsers.map((user) => {
      let actionText = "Registration updated";

      if (user.status === "approved") {
        actionText = `${user.organizationName || user.fullName} was approved`;
      } else if (user.status === "rejected") {
        actionText = `${user.organizationName || user.fullName} was rejected`;
      } else if (user.status === "pending") {
        actionText = `${user.organizationName || user.fullName} submitted a registration`;
      }

      return {
        text: actionText,
        date: user.updatedAt || user.createdAt,
        status: user.status,
      };
    });

    const totalReports = await Report.countDocuments({ warningSent: false });

    res.render("admin/index", {
      title: "System Admin Dashboard",
      layout: "layouts/admin",
      pendingOrgRequests,
      pendingCommunityRequests,
      totalOrganizations,
      totalCommunityAdmins,
      totalCitizens,
      approvedCount,
      pendingCount,
      rejectedCount,
      recentActivities,
      totalReports,
      activeAdminTab: "dashboard",
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading admin dashboard");
  }
});

router.get("/requests", isSystemAdmin, async (req, res) => {
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
});

router.get("/requests/:id", isSystemAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.send("User not found");
    }

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
});

router.get("/directory", isSystemAdmin, async (req, res) => {
  try {
    const selected = req.query.type || "organization";

    let roleFilter = "organization";
    if (selected === "communityAdmin") roleFilter = "communityAdmin";
    if (selected === "citizen") roleFilter = "citizen";

    const directoryUsers = await User.find({
      role: roleFilter,
      ...(roleFilter === "citizen" ? {} : { status: "approved" }),
    }).sort({ createdAt: -1 });

    const organizationCount = await User.countDocuments({
      role: "organization",
      status: "approved",
    });

    const communityAdminCount = await User.countDocuments({
      role: "communityAdmin",
      status: "approved",
    });

    const citizenCount = await User.countDocuments({
      role: "citizen",
    });

    res.render("admin/directory", {
      title: "Directory",
      layout: "layouts/admin",
      activeAdminTab: "directory",
      directoryUsers,
      selected,
      organizationCount,
      communityAdminCount,
      citizenCount,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading directory");
  }
});

router.get("/directory/:id", isSystemAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/directory");
    }

    const userPosts = await Post.find({ author: user._id })
      .sort({ createdAt: -1 })
      .select("title type createdAt description alertStatus alertCategory alertRadius volunteerDate maxVolunteers");

    res.render("admin/directoryDetail", {
      title: "Directory Detail",
      layout: "layouts/admin",
      activeAdminTab: "directory",
      user,
      userPosts,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading directory detail");
  }
});

router.post("/requests/:id/approve", isSystemAdmin, async (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString("hex");

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: true,
        status: "approved",
        rejectionReason: "",
        verificationToken: token,
        isVerified: false,
      },
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
});

router.post("/requests/:id/reject", isSystemAdmin, async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: false,
        status: "rejected",
        rejectionReason,
      },
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
});

// GET /admin/reports — view all reports
router.get("/reports", isSystemAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate({ path: "post", populate: { path: "author" } })
      .populate("reportedBy")
      .sort({ createdAt: -1 });

    const warnedUsers = await User.find(
      { "warningHistory.0": { $exists: true } },
      { fullName: 1, organizationName: 1, communityName: 1, role: 1, warningHistory: 1 }
    ).sort({ "warningHistory.warnedAt": -1 });

    res.render("admin/reports", {
      title: "Reports",
      layout: "layouts/admin",
      activeAdminTab: "reports",
      reports,
      warnedUsers,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading reports");
  }
});

// GET /admin/reports/post/:postId — admin review view for a reported post
router.get("/reports/post/:postId", isSystemAdmin, async (req, res) => {
  try {
    const Post = require("../models/Post");
    const post = await Post.findById(req.params.postId).populate("author");

    if (!post) {
      req.flash("error", "Post not found");
      return res.redirect("/admin/reports");
    }

    // Get all reports for this post, newest first
    const reports = await Report.find({ post: post._id })
      .populate("reportedBy")
      .sort({ createdAt: -1 });

    res.render("admin/reportReview", {
      title: "Review Reported Post",
      layout: "layouts/admin",
      activeAdminTab: "reports",
      post,
      reports,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading report review");
  }
});

// GET /admin/reports/user/:userId — admin-side user profile view for moderation
router.get("/reports/user/:userId", isSystemAdmin, async (req, res) => {
  try {
    const Post = require("../models/Post");
    const Follow = require("../models/Follow");

    const user = await User.findById(req.params.userId);
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/admin/reports");
    }

    const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });

    let followerCount = 0;
    let followingCount = 0;
    if (user.role === "organization" || user.role === "communityAdmin") {
      followerCount = await Follow.countDocuments({ following: user._id });
    }
    followingCount = await Follow.countDocuments({ follower: user._id });

    // ?from= lets the back button return to the right page
    const backUrl = req.query.from || "/admin/reports";

    res.render("admin/userReview", {
      title: "User Profile — Moderation View",
      layout: "layouts/admin",
      activeAdminTab: "reports",
      user,
      posts,
      followerCount,
      followingCount,
      backUrl,
    });
  } catch (err) {
    console.log(err);
    res.send("Error loading user review");
  }
});

// POST /admin/reports/:id/warn — send custom warning email to post author
router.post("/reports/:id/warn", isSystemAdmin, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate({ path: "post", populate: { path: "author" } });

    if (!report || !report.post) {
      req.flash("error", "Report or post not found");
      return res.redirect("/admin/reports");
    }

    const author = report.post.author;
    if (!author) {
      req.flash("error", "Post author not found");
      return res.redirect("/admin/reports");
    }

    const customMessage = req.body.message ? req.body.message.trim() : "";
    if (!customMessage) {
      req.flash("error", "Warning message cannot be empty");
      return res.redirect("/admin/reports");
    }

    const msgWordCount = customMessage.split(/\s+/).filter(Boolean).length;
    if (msgWordCount > 50) {
      req.flash("error", "Warning message must be 50 words or less");
      return res.redirect("/admin/reports");
    }

    const authorName = author.organizationName || author.fullName || "User";
    const postTitle = report.post.title;

    sendEmail({
      to: author.email,
      subject: "Content Warning — Local Connect",
      html: generateEmailTemplate({
        heading: "Content Warning Notice",
        name: authorName,
        body: "One of your posts has been reported by a community member and reviewed by our moderation team.\nPlease review the message below and ensure your future content follows our community guidelines.\nRepeated violations may result in account restriction.",
        highlight: `<strong>Post:</strong> ${postTitle}<br><br><strong>Message from moderation team:</strong><br>${customMessage}`,
        highlightLabel: "Details",
        footer: "If you believe this was a mistake, please contact our support team.",
      }),
    });

    report.warningSent = true;
    await report.save();

    // Record warning in author's history
    await User.findByIdAndUpdate(author._id, {
      $push: {
        warningHistory: {
          reason: report.reason,
          note: customMessage,
          reportId: report._id,
          warnedAt: new Date(),
        }
      }
    });

    req.flash("success", "Warning email sent to post author");
    return res.redirect("/admin/reports");
  } catch (err) {
    console.log(err);
    req.flash("error", "Error sending warning");
    return res.redirect("/admin/reports");
  }
});

module.exports = router;