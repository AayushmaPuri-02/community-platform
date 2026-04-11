const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { isSystemAdmin } = require("../middleware/authMiddleware");
const User = require("../models/User");
const { sendEmail } = require("../utils/mailer");

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

    const recentActivityUsers = await User.find({
      role: { $in: ["organization", "communityAdmin"] },
    })
      .sort({ updatedAt: -1 })
      .limit(6);

    const recentActivities = recentActivityUsers.map((user) => {
      let actionText = "Registration updated";

      if (user.status === "approved") {
        actionText = `${user.organizationName || user.fullName} was approved`;
      } else if (user.status === "rejected") {
        actionText = `${user.organizationName || user.fullName} was rejected`;
      } else if (user.status === "pending") {
        actionText = `${user.organizationName || user.fullName} is pending review`;
      }

      return {
        text: actionText,
        date: user.updatedAt || user.createdAt,
        status: user.status,
      };
    });

    res.render("admin/index", {
      title: "System Admin Dashboard",
      layout: "layouts/admin",
      pendingOrgRequests,
      pendingCommunityRequests,
      totalOrganizations,
      totalCitizens,
      approvedCount,
      pendingCount,
      rejectedCount,
      recentActivities,
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

    res.render("admin/directoryDetail", {
      title: "Directory Detail",
      layout: "layouts/admin",
      activeAdminTab: "directory",
      user,
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
      text: `Hi ${user.organizationName || user.fullName || "User"},

Your account has been approved.

Please verify your email by clicking the link below:

http://localhost:3000/verify/${token}

After verification, you will be able to log in.

Thank you,
Local Connect`,
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
      text: `Hi ${user.organizationName || user.fullName || "User"},

Thank you for registering with Local Connect.

We are sorry to inform you that your registration was not approved at this time.
${rejectionReason ? `Reason: ${rejectionReason}\n` : ""}

If needed, you may register again with the correct details and documents.

Thank you for visiting Local Connect.`,
    });

    req.flash("info", "User rejected successfully");
    return res.redirect("/admin/requests");
  } catch (err) {
    console.log(err);
    req.flash("error", "Error rejecting user");
    return res.redirect("/admin/requests");
  }
});

module.exports = router;