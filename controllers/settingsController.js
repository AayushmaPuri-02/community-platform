const bcrypt = require("bcrypt");
const User = require("../models/User");

exports.getSettings = async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect("/login");

        res.render("settings/index", { title: "Settings", user });
    } catch (err) {
        console.log(err);
        res.send("Error loading settings");
    }
};

exports.updateAccount = async (req, res) => {
    try {
        const { fullName, email } = req.body;

        const trimmedName = fullName ? fullName.trim() : "";
        const trimmedEmail = email ? email.trim().toLowerCase() : "";

        if (!trimmedName) {
            req.flash("error", "Full name is required");
            return res.redirect("/settings");
        }

        if (!trimmedEmail) {
            req.flash("error", "Email is required");
            return res.redirect("/settings");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            req.flash("error", "Enter a valid email address");
            return res.redirect("/settings");
        }

        const existing = await User.findOne({
            email: trimmedEmail,
            _id: { $ne: req.session.userId },
        });

        if (existing) {
            req.flash("error", "That email is already in use by another account");
            return res.redirect("/settings");
        }

        await User.findByIdAndUpdate(req.session.userId, {
            fullName: trimmedName,
            email: trimmedEmail,
        });

        req.session.fullName = trimmedName;

        req.flash("success", "Account information updated");
        return res.redirect("/settings");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error updating account");
        return res.redirect("/settings");
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmNewPassword) {
            req.flash("error", "All password fields are required");
            return res.redirect("/settings");
        }

        if (newPassword.length < 6) {
            req.flash("error", "New password must be at least 6 characters");
            return res.redirect("/settings");
        }

        if (newPassword !== confirmNewPassword) {
            req.flash("error", "New passwords do not match");
            return res.redirect("/settings");
        }

        const user = await User.findById(req.session.userId);
        if (!user) return res.redirect("/login");

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            req.flash("error", "Current password is incorrect");
            return res.redirect("/settings");
        }

        user.password = newPassword;
        await user.save();

        req.flash("success", "Password updated successfully");
        return res.redirect("/settings");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error updating password");
        return res.redirect("/settings");
    }
};

exports.updateNotifications = async (req, res) => {
    try {
        const prefs = {
            emailEnabled: req.body.emailEnabled === "on",
            messageEmails: req.body.messageEmails === "on",
            alertEmails: req.body.alertEmails === "on",
            postEmails: req.body.postEmails === "on",
        };

        await User.findByIdAndUpdate(req.session.userId, {
            $set: { notificationPreferences: prefs },
        });

        req.flash("success", "Notification preferences saved");
        return res.redirect("/settings");
    } catch (err) {
        console.log(err);
        req.flash("error", "Error saving notification preferences");
        return res.redirect("/settings");
    }
};
