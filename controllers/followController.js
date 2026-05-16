const Follow = require("../models/Follow");
const User = require("../models/User");

exports.toggleFollow = async (req, res) => {
    try {
        const targetUserId = req.params.id;
        const currentUserId = req.session.userId;

        const targetUser = await User.findById(targetUserId);

        if (!targetUser) return res.redirect(req.get("Referrer") || "/explore");
        if (targetUserId === currentUserId) return res.redirect(req.get("Referrer") || "/explore");
        if (targetUser.role === "citizen") return res.redirect(req.get("Referrer") || "/explore");

        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: targetUserId,
        });

        if (existingFollow) {
            await Follow.deleteOne({ _id: existingFollow._id });
        } else {
            await Follow.create({ follower: currentUserId, following: targetUserId });
        }

        return res.redirect(req.get("Referrer") || "/explore");
    } catch (err) {
        console.log(err);
        return res.send("Error toggling follow");
    }
};
