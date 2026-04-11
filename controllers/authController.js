const User = require("../models/User");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/mailer");
const crypto = require("crypto");

// GET register page
exports.getRegister = (req, res) => {
  res.render("auth/register", {
    title: "Register",
    hideSidebar: true,
  });
};

// POST register
exports.postRegister = async (req, res) => {
  const {
    fullName,
    organizationName,
    email,
    password,
    confirmPassword,
    location,
    mobileNumber,
    socialMediaLink,
    role,
  } = req.body;

  const verificationDoc = req.file ? req.file.path : null;

  if (!email || !password || !confirmPassword || !role) {
    req.flash("error", "All required fields must be filled");
    return res.redirect("/register");
  }

  const allowedRoles = ["citizen", "organization", "communityAdmin"];

  if (!allowedRoles.includes(role)) {
    req.flash("error", "Invalid role selected");
    return res.redirect("/register");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.flash("error", "Enter a valid email address");
    return res.redirect("/register");
  }

  if (password.length < 6) {
    req.flash("error", "Password must be at least 6 characters");
    return res.redirect("/register");
  }

  if (password !== confirmPassword) {
    req.flash("error", "Passwords do not match");
    return res.redirect("/register");
  }

  if (role === "citizen" && !fullName) {
    req.flash("error", "Full name is required for citizens");
    return res.redirect("/register");
  }

  if (role === "organization" && !organizationName) {
    req.flash("error", "Organization name is required");
    return res.redirect("/register");
  }

  if (role === "communityAdmin" && (!fullName || !mobileNumber)) {
    req.flash("error", "Full name and mobile number are required for community admins");
    return res.redirect("/register");
  }

  if ((role === "organization" || role === "communityAdmin") && !verificationDoc) {
    req.flash("error", "Verification document is required");
    return res.redirect("/register");
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      req.flash("error", "Email already registered");
      return res.redirect("/register");
    }

  let token = "";

if (role === "citizen") {
  token = crypto.randomBytes(32).toString("hex");
}

    const user = new User({
      fullName: role !== "organization" ? fullName : undefined,
      organizationName: role === "organization" ? organizationName : undefined,
      email,
      password,
      location,
      mobileNumber: role === "communityAdmin" ? mobileNumber : undefined,
      socialMediaLink: role === "organization" ? socialMediaLink : undefined,
      role,
      verificationDoc,
      verificationToken: token,
      isVerified: false,
    });

    await user.save();

    // Citizen: email verification required before login
    if (user.role === "citizen") {
      sendEmail({
        to: user.email,
        subject: "Verify Your Email - Local Connect",
        text: `Hi ${user.fullName || "User"},

Please verify your email by clicking the link below:

http://localhost:3000/verify/${token}

You must verify your email before logging in.

Thank you,
Local Connect`,
      });

      req.flash("info", "Please check your email and verify your account before logging in.");
      return res.redirect("/login");
    }

    // Organization / Community Admin: verify email first, then wait for admin review
sendEmail({
  to: user.email,
  subject: "Registration Received - Local Connect",
  text: `Hi ${user.organizationName || user.fullName || "User"},

Your registration has been received and is currently under review.

You will be notified once your account is approved.

Thank you for using Local Connect.`,
});

    req.flash("info", "Your registration is under review. You will be notified once approved.");
    return res.redirect("/login");
  } catch (err) {
    console.log(err);
    req.flash("error", "Error registering user");
    return res.redirect("/register");
  }
};

// GET login page
exports.getLogin = (req, res) => {
  res.render("auth/login", {
    title: "Login",
    hideSidebar: true,
  });
};

// POST login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    req.flash("error", "All fields are required");
    return res.redirect("/login");
  }

  try {
    const user = await User.findOne({ email });

    // 1. Check user exists FIRST
    if (!user) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }
    // 3. Rejected user
    if (user.status === "rejected") {
      req.flash("error", `Your registration was rejected: ${user.rejectionReason}`);
      return res.redirect("/login");
    }

        // 4. Organization approval check
    if (
      (user.role === "organization" || user.role === "communityAdmin") &&
      !user.isApproved
    ) {
      req.flash("info", "Your account is under review. You will be notified once approved.");
      return res.redirect("/login");
    }
    // 2. Email verification check
    if (!user.isVerified) {
      req.flash("info", "Please verify your email before logging in.");
      return res.redirect("/login");
    }

    // 5. Password check
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    // 6. Session
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.fullName = user.fullName;
    req.session.organizationName = user.organizationName;
    req.session.profileCompleted = user.profileCompleted;

    // 7. Admin redirect
    if (user.role === "systemAdmin") {
      req.flash("success", "Welcome back, Admin!");
      return res.redirect("/admin");
    }

    // 8. Profile completion check
    if (
      (user.role === "organization" || user.role === "communityAdmin") &&
      !user.profileCompleted
    ) {
      req.flash("info", "Please complete your profile setup first.");
      return res.redirect("/profile/edit");
    }

    // 9. Success
    req.flash("success", "Welcome back!");
    return res.redirect("/");

  } catch (err) {
    console.log(err);
    req.flash("error", "Error logging in");
    return res.redirect("/login");
  }
};


// LOGOUT
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      req.flash("error", "Error logging out");
      return res.redirect("/");
    }

    res.clearCookie("connect.sid");
    return res.redirect("/");
  });
};

exports.verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });

    if (!user) {
      req.flash("error", "Invalid or expired verification link");
      return res.redirect("/login");
    }

    user.isVerified = true;
    user.verificationToken = "";
    await user.save();

    req.flash("success", "Email verified successfully. You can now log in.");
    return res.redirect("/login");
  } catch (err) {
    console.log(err);
    req.flash("error", "Error verifying email");
    return res.redirect("/login");
  }
};