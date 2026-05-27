const User = require("../models/User");
const bcrypt = require("bcrypt");
const { sendEmail } = require("../utils/mailer");
const { generateEmailTemplate } = require("../utils/emailTemplate");
const crypto = require("crypto");

// GET register page
exports.getRegister = async (req, res) => {
  const formData = req.session.formData || {};
  delete req.session.formData;

  // Find all locations already claimed by a communityAdmin (any status)
  const takenAdmins = await User.find(
    { role: "communityAdmin" },
    { location: 1 }
  );
  const unavailableCommunityAreas = takenAdmins
    .map(u => u.location)
    .filter(Boolean);

  res.render("auth/register", {
    title: "Register",
    hideSidebar: true,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    formData,
    unavailableCommunityAreas,
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
    mobileNumber,
    socialMediaLink,
    role,
  } = req.body;

  // communityAdmin uses a dropdown (locationDropdown), others use free-text (location)
  const location = role === "communityAdmin" ? req.body.locationDropdown : req.body.location;

  // Structured location fields (all roles)
  const locationName = req.body.locationName || "";
  const homeLatitude = req.body.homeLatitude;
  const homeLongitude = req.body.homeLongitude;
  const parsedHomeLat = parseFloat(homeLatitude);
  const parsedHomeLng = parseFloat(homeLongitude);

  // Save form data for repopulation on validation errors (passwords excluded)
  req.session.formData = {
    fullName: req.body.fullName || "",
    organizationName: req.body.organizationName || "",
    email: req.body.email || "",
    location: req.body.location || "",
    locationName: req.body.locationName || "",
    homeLatitude: req.body.homeLatitude || "",
    homeLongitude: req.body.homeLongitude || "",
    mobileNumber: req.body.mobileNumber || "",
    socialMediaLink: req.body.socialMediaLink || "",
    role: req.body.role || "",
    locationDropdown: req.body.locationDropdown || "",
  };

  // uploadRegistration uses .fields() so files land in req.files
  const verificationDoc = req.files && req.files["verificationDoc"] ? req.files["verificationDoc"][0].path : null;
  const profileImageFromReg = req.files && req.files["profileImage"] ? req.files["profileImage"][0].path : null;

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

  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) || !/[@#$%&*!]/.test(password)) {
    req.flash("error", "Password must be at least 8 characters and include a letter, a number, and a special character.");
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

  if (role === "citizen" && (fullName.trim().length < 2 || fullName.trim().length > 60)) {
    req.flash("error", "Full name must be between 2 and 60 characters.");
    return res.redirect("/register");
  }

  if (role === "organization" && !organizationName) {
    req.flash("error", "Organization name is required");
    return res.redirect("/register");
  }

  if (role === "organization" && (organizationName.trim().length < 2 || organizationName.trim().length > 100)) {
    req.flash("error", "Organization name must be between 2 and 100 characters.");
    return res.redirect("/register");
  }

  if (role === "communityAdmin" && (!fullName || !mobileNumber)) {
    req.flash("error", "Full name and mobile number are required for community admins");
    return res.redirect("/register?role=communityAdmin");
  }

  if (role === "communityAdmin" && (fullName.trim().length < 2 || fullName.trim().length > 60)) {
    req.flash("error", "Full name must be between 2 and 60 characters.");
    return res.redirect("/register?role=communityAdmin");
  }

  if (role === "communityAdmin" && !location) {
    req.flash("error", "Location is required for community admins");
    return res.redirect("/register?role=communityAdmin");
  }

  // Prevent duplicate community admin for the same area
  if (role === "communityAdmin" && location) {
    const existingAdmin = await User.findOne({ role: "communityAdmin", location });
    if (existingAdmin) {
      req.flash("error", "This community area already has an admin request or approved admin.");
      return res.redirect("/register?role=communityAdmin");
    }
  }

  const nepalMobileRegex = /^(97|98)\d{8}$/;
  if (role === "communityAdmin" && !nepalMobileRegex.test(mobileNumber)) {
    req.flash("error", "Mobile number must be a valid Nepal number starting with 97 or 98 (10 digits)");
    return res.redirect("/register?role=communityAdmin");
  }

  if (role === "communityAdmin" && !profileImageFromReg) {
    req.flash("error", "Profile image is required for community admins");
    return res.redirect("/register?role=communityAdmin");
  }

  if ((role === "organization" || role === "communityAdmin") && !verificationDoc) {
    req.flash("error", "Verification document is required");
    return res.redirect("/register");
  }

  // ── Community admin: auto-assign coordinates from lookup ─────────────────────
  const communityAreaCoordinates = {
    Kalanki: { locationName: "Kalanki, Kathmandu, Nepal", lat: 27.6939, lng: 85.2795 },
    Baneshwor: { locationName: "Baneshwor, Kathmandu, Nepal", lat: 27.6933, lng: 85.3417 },
    Koteshwor: { locationName: "Koteshwor, Kathmandu, Nepal", lat: 27.6786, lng: 85.3469 },
    Balaju: { locationName: "Balaju, Kathmandu, Nepal", lat: 27.7333, lng: 85.2983 },
    Chabahil: { locationName: "Chabahil, Kathmandu, Nepal", lat: 27.7167, lng: 85.3500 },
    Kirtipur: { locationName: "Kirtipur, Kathmandu, Nepal", lat: 27.6767, lng: 85.2783 },
    Bhaktapur: { locationName: "Bhaktapur, Nepal", lat: 27.6710, lng: 85.4298 },
    Lalitpur: { locationName: "Lalitpur, Nepal", lat: 27.6644, lng: 85.3188 },
    Patan: { locationName: "Patan, Lalitpur, Nepal", lat: 27.6588, lng: 85.3247 },
    Thamel: { locationName: "Thamel, Kathmandu, Nepal", lat: 27.7150, lng: 85.3123 },
    Boudha: { locationName: "Boudha, Kathmandu, Nepal", lat: 27.7215, lng: 85.3621 },
    Gongabu: { locationName: "Gongabu, Kathmandu, Nepal", lat: 27.7367, lng: 85.3133 },
    Sitapaila: { locationName: "Sitapaila, Kathmandu, Nepal", lat: 27.7217, lng: 85.2817 },
    Swayambhu: { locationName: "Swayambhu, Kathmandu, Nepal", lat: 27.7147, lng: 85.2903 },
    Naxal: { locationName: "Naxal, Kathmandu, Nepal", lat: 27.7133, lng: 85.3283 },
    Maharajgunj: { locationName: "Maharajgunj, Kathmandu, Nepal", lat: 27.7367, lng: 85.3317 },
    Lazimpat: { locationName: "Lazimpat, Kathmandu, Nepal", lat: 27.7200, lng: 85.3183 },
    Dillibazar: { locationName: "Dillibazar, Kathmandu, Nepal", lat: 27.7083, lng: 85.3317 },
    Putalisadak: { locationName: "Putalisadak, Kathmandu, Nepal", lat: 27.7017, lng: 85.3283 },
    Jawalakhel: { locationName: "Jawalakhel, Lalitpur, Nepal", lat: 27.6717, lng: 85.3133 },
  };

  let finalLocationName = locationName;
  let finalLat = parsedHomeLat;
  let finalLng = parsedHomeLng;

  if (role === "communityAdmin") {
    const areaData = communityAreaCoordinates[location];
    if (!areaData) {
      req.flash("error", "Selected community area is not recognised. Please choose a valid area.");
      return res.redirect("/register?role=communityAdmin");
    }
    finalLocationName = areaData.locationName;
    finalLat = areaData.lat;
    finalLng = areaData.lng;
  } else {
    // Citizen / organization: validate geocoder hidden fields
    const redirectBack = "/register";
    if (!locationName.trim()) {
      req.flash("error", "Please select a valid location in Nepal.");
      return res.redirect(redirectBack);
    }
    if (isNaN(parsedHomeLat) || isNaN(parsedHomeLng)) {
      req.flash("error", "Please select a valid location in Nepal.");
      return res.redirect(redirectBack);
    }
    if (parsedHomeLat < 26.3 || parsedHomeLat > 30.5 || parsedHomeLng < 80.0 || parsedHomeLng > 88.5) {
      req.flash("error", "Please select a valid location in Nepal.");
      return res.redirect(redirectBack);
    }
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
      communityName: role === "communityAdmin" ? `${location} Locals` : undefined,
      email,
      password,
      // communityAdmin keeps location = dropdown value (used for communityName)
      // citizen/org use locationName as their location string
      location: role === "communityAdmin" ? location : locationName.trim(),
      locationName: finalLocationName.trim(),
      homeLatitude: finalLat,
      homeLongitude: finalLng,
      mobileNumber: role === "communityAdmin" ? mobileNumber : undefined,
      socialMediaLink: role === "organization" ? socialMediaLink : undefined,
      role,
      verificationDoc,
      profileImage: role === "communityAdmin" ? profileImageFromReg : undefined,
      verificationToken: token,
      isVerified: false,
    });

    await user.save();
    delete req.session.formData; // clear on success

    // Citizen: email verification required before login
    if (user.role === "citizen") {
      sendEmail({
        to: user.email,
        subject: "Verify Your Email - Local Connect",
        html: generateEmailTemplate({
          heading: "Verify Your Email",
          name: user.fullName || "User",
          body: "Thank you for registering on Local Connect.\nPlease verify your email address by clicking the link below. You must verify before you can log in.",
          highlight: `<a href="${process.env.BASE_URL || "http://localhost:3000"}/verify/${token}" style="color:#04888D;font-weight:600;">Verify my email</a>`,
          highlightLabel: "Verification link",
          footer: "If you did not create an account, you can safely ignore this email.",
        }),
      });

      req.flash("info", "Please check your email and verify your account before logging in.");
      return res.redirect("/login");
    }

    // Organization / Community Admin: verify email first, then wait for admin review
    sendEmail({
      to: user.email,
      subject: "Registration Received - Local Connect",
      html: generateEmailTemplate({
        heading: "Registration Received",
        name: user.organizationName || user.fullName || "User",
        body: "Thank you for registering with Local Connect.\nYour account is currently under review by our admin team. You will be notified by email once your account is approved.",
        footer: "This process usually takes 1–2 business days.",
      }),
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
    loggedOut: req.query.loggedOut === "1",
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

    if (user.isSuspended) {
      req.flash("error", "Your account has been suspended by the system administrator.");
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
    if (user.role === "organization") {
      return res.redirect("/org-dashboard");
    }
    if (user.role === "communityAdmin") {
      return res.redirect("/community-dashboard");
    }
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
    return res.redirect("/login?loggedOut=1");
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

// GET /forgot-password
exports.getForgotPassword = (req, res) => {
  res.render("auth/forgot-password", { title: "Forgot Password", hideSidebar: true });
};

// POST /forgot-password
exports.postForgotPassword = async (req, res) => {
  const { email } = req.body;
  const generic = "If that email exists, a reset link has been sent.";

  try {
    const user = await User.findOne({ email: email ? email.trim().toLowerCase() : "" });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await user.save();

      const resetUrl = `${process.env.BASE_URL || "http://localhost:3000"}/reset-password/${token}`;

      sendEmail({
        to: user.email,
        subject: "Password Reset — Local Connect",
        html: generateEmailTemplate({
          heading: "Reset Your Password",
          name: user.fullName || user.organizationName || "User",
          body: "We received a request to reset your password.\nClick the link below to set a new password. This link expires in 10 minutes.",
          highlight: `<a href="${resetUrl}" style="color:#04888D;font-weight:600;">${resetUrl}</a>`,
          highlightLabel: "Reset link",
          footer: "If you did not request a password reset, you can safely ignore this email.",
        }),
      });
    }

    req.flash("info", generic);
    return res.redirect("/forgot-password");
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong. Please try again.");
    return res.redirect("/forgot-password");
  }
};

// GET /reset-password/:token
exports.getResetPassword = async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      req.flash("error", "Password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    res.render("auth/reset-password", {
      title: "Reset Password",
      hideSidebar: true,
      token: req.params.token,
    });
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong.");
    return res.redirect("/forgot-password");
  }
};

// POST /reset-password/:token
exports.postResetPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      req.flash("error", "Password reset link is invalid or has expired.");
      return res.redirect("/forgot-password");
    }

    if (!password || password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect(`/reset-password/${req.params.token}`);
    }

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/reset-password/${req.params.token}`);
    }

    user.password = password; // pre-save hook will hash it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash("success", "Password reset successfully. You can now log in.");
    return res.redirect("/login");
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong. Please try again.");
    return res.redirect("/forgot-password");
  }
};
