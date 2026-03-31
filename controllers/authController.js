const User = require("../models/User");
const bcrypt = require("bcrypt");

// GET register page
exports.getRegister = (req, res) => {
  res.render("auth/register", { title: "Register",hideSidebar: true });
};

// POST register
exports.postRegister = async (req, res) => {
  const { fullName, organizationName, email, password, confirmPassword, location,mobileNumber, socialMediaLink,role } = req.body;

  const verificationDoc = req.file ? req.file.path : null; //for oraganixzation added later
  console.log("hello",req.file);

  if (!email || !password || !confirmPassword || !role) {
    return res.send("All required fields must be filled");
  }
  const allowedRoles = ["citizen", "organization", "communityAdmin"];

  if (!allowedRoles.includes(role)) {
    return res.send("Invalid role selected");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.send("Enter a valid email address");
  }

  if (password.length < 6) {
    return res.send("Password must be at least 6 characters");
  }

  if (password !== confirmPassword) {
    return res.send("Passwords do not match");
  }

  if (role === "citizen" && !fullName) {
    return res.send("Full name is required for citizens");
  }

  if (role === "organization" && !organizationName) {
    return res.send("Organization name is required");
  }

  if (role === "communityAdmin" && (!fullName || !mobileNumber)) {
    return res.send("Full name and mobile number are required for community admins");
  }

    if ((role === "organization" || role === "communityAdmin") && !verificationDoc) { //this is also added later for orgnization
    return res.send("Verification document is required");
  } 
  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.send("Email already registered");
    }

    const user = new User({
      fullName: role !== "organization" ? fullName : undefined,
      organizationName: role === "organization" ? organizationName : undefined,
      email, password, location,
      mobileNumber: role === "communityAdmin" ? mobileNumber : undefined,
      socialMediaLink: role === "organization" ? socialMediaLink : undefined,
      role,
      verificationDoc,
    });
    console.log("This is user",user);
    await user.save();

    if (user.role === "citizen") {
  req.session.userId = user._id;
  req.session.role = user.role;
  req.session.fullName = user.fullName;

  return res.redirect("/");
}
    // for organization and community admin
    return res.send("Your registration is pending . You will be able to login after approval.");
  } catch (err) {
    console.log(err);
    res.send("Error registering user");
  }
};

// GET login page
exports.getLogin = (req, res) => {
  res.render("auth/login", { title: "Login",hideSidebar: true });
};

// POST login
exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.send("All fields are required");
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.send("Invalid email or password");
    }

    if (user.status === "rejected") {
      return res.send(`Your registration was rejected: ${user.rejectionReason}`);
    }

    if (!user.isApproved) {
      return res.send("Your account is pending ");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.send("Invalid email or password");
    }

req.session.userId = user._id;
req.session.role = user.role;
req.session.fullName = user.fullName;
req.session.organizationName = user.organizationName;

// system admin goes to admin dashboard
if (user.role === "systemAdmin") {
  return res.redirect("/admin");
}

// force profile setup for org/community admin (first login only)
if (
  (user.role === "organization" || user.role === "communityAdmin") &&
  !user.profileCompleted
) {
  return res.redirect("/profile/edit");
}

// everyone else
return res.redirect("/");
  } catch (err) {
    console.log(err);
    return res.send("Error logging in");
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.send("Error logging out");
    }

    return res.redirect("/");
  });
};
