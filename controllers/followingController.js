const Follow = require("../models/Follow");

exports.getFollowing = async (req, res) => {
    try {
        const currentUserId = req.session.userId;
        const currentUserRole = req.session.role;

        const follows = await Follow.find({ follower: currentUserId }).populate("following");
        const followingUsers = follows.map((f) => f.following).filter(Boolean);

        let followerUsers = [];
        if (currentUserRole === "organization" || currentUserRole === "communityAdmin") {
            const followers = await Follow.find({ following: currentUserId }).populate("follower");
            followerUsers = followers.map((f) => f.follower).filter(Boolean);
        }

        res.render("following/index", {
            title: "Following",
            followingUsers,
            followerUsers,
            role: currentUserRole,
        });
    } catch (err) {
        console.log(err);
        res.send("Error loading following page");
    }
};
