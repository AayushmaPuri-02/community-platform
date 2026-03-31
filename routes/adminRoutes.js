const express = require("express");
const router = express.Router();

const { isSystemAdmin } = require("../middleware/authMiddleware");
const User = require("../models/User");

router.get("/", isSystemAdmin, (req, res) => {
  res.render("admin/index", { title: "Admin Dashboard",hideSidebar: true, });
});


router.get("/requests", isSystemAdmin, async (req, res) => {
  try {
    const pendingUsers = await User.find({
    //   isApproved: false,
    status: "pending",
      role: { $in: ["organization", "communityAdmin"] },
    });

    res.render("admin/requests", { title: "Verification Requests", pendingUsers, hideSidebar: true,});
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

    res.render("admin/requestDetail", { title:"Request detail", user ,hideSidebar: true });
  } catch (err) {
    console.log(err);
    res.send("Error loading request");
  }
});


router.post("/requests/:id/approve", isSystemAdmin, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      isApproved: true,
      status: "approved",
      rejectionReason: "", // optional cleanup
    });

    return res.redirect("/admin/requests");
  } catch (err) {
    console.log(err);
    return res.send("Error approving user");
  }
});

router.post("/requests/:id/reject", isSystemAdmin, async (req, res) => {
  try {
    const { rejectionReason } = req.body;

    await User.findByIdAndUpdate(req.params.id, {
      isApproved: false,
      status: "rejected",
      rejectionReason,
    });

    return res.redirect("/admin/requests");
  } catch (err) {
    console.log(err);
    res.send("Error rejecting user");
  }
});

module.exports = router;