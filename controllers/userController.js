const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");

exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.send("User not found");
        }

        const posts = await Post.find({ author: user._id }).sort({ createdAt: -1 });

        let isFollowing = false;
        if (req.session.userId) {
            const existingFollow = await Follow.findOne({
                follower: req.session.userId,
                following: user._id,
            });
            isFollowing = !!existingFollow;
        }

        let followerCount = 0;
        let followingCount = 0;

        if (user.role === "organization" || user.role === "communityAdmin") {
            followerCount = await Follow.countDocuments({ following: user._id });
        }
        followingCount = await Follow.countDocuments({ follower: user._id });

        let backUrl = null;
        if (req.query.from === "following" || req.query.from === "followers") {
            backUrl = "/following";
        }

        let volunteerHistory = [];
        let upcomingVolunteers = [];
        let rejectedVolunteers = [];
        let attendedVolunteers = [];

        if (user.role === "citizen") {
            volunteerHistory = await Post.find({
                "volunteers.user": user._id,
                type: "volunteer",
            }).populate("author").sort({ volunteerDate: -1 });

            volunteerHistory.forEach((vp) => {
                const entry = vp.volunteers.find(
                    (v) => v.user && v.user.toString() === user._id.toString()
                );
                if (!entry) return;
                if (entry.status === "attended") attendedVolunteers.push({ post: vp, entry });
                else if (entry.status === "rejected") rejectedVolunteers.push({ post: vp, entry });
                else upcomingVolunteers.push({ post: vp, entry });
            });
        }

        res.render("users/show", {
            title:
                user.role === "communityAdmin"
                    ? user.communityName || user.location + " Locals"
                    : user.organizationName || user.fullName,
            user,
            posts,
            isFollowing,
            followerCount,
            followingCount,
            backUrl,
            userId: req.session.userId,
            role: req.session.role,
            volunteerHistory,
            upcomingVolunteers,
            rejectedVolunteers,
            attendedVolunteers,
            googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
        });
    } catch (err) {
        console.log(err);
        return res.send("Error loading profile");
    }
};
