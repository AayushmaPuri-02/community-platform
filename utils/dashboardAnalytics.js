const Post = require("../models/Post");
const Comment = require("../models/Comment");

const CHART_TYPES = [
  { key: "volunteer", label: "Volunteer" },
  { key: "event", label: "Event" },
  { key: "alert", label: "Alert" },
  { key: "notice", label: "Notice" },
  { key: "training", label: "Training" },
];

const CHART_COLORS = ["#04888D", "#0d6efd", "#dc3545", "#6c757d", "#f59e0b"];

function buildPostTypeChartData(aggregation) {
  const countMap = {};
  (aggregation || []).forEach((item) => {
    if (item._id) countMap[item._id] = item.count;
  });

  return {
    labels: CHART_TYPES.map((t) => t.label),
    values: CHART_TYPES.map((t) => countMap[t.key] || 0),
    colors: CHART_COLORS,
    hasData: CHART_TYPES.some((t) => (countMap[t.key] || 0) > 0),
  };
}

function activeVolunteerSignupCount(volunteers) {
  if (!volunteers || !volunteers.length) return 0;
  return volunteers.filter((v) => {
    const status = v.status || (v.attended ? "attended" : "pending");
    return status === "pending" || status === "attended";
  }).length;
}

async function getTopPerformingPost(authorId) {
  const posts = await Post.find({ author: authorId })
    .select("title type likes volunteers createdAt")
    .lean();

  if (!posts.length) return null;

  const postIds = posts.map((p) => p._id);
  const commentAgg = await Comment.aggregate([
    { $match: { post: { $in: postIds } } },
    { $group: { _id: "$post", count: { $sum: 1 } } },
  ]);

  const commentMap = {};
  commentAgg.forEach((c) => {
    commentMap[c._id.toString()] = c.count;
  });

  let top = null;
  let topScore = -1;

  for (const post of posts) {
    const likeCount = post.likes ? post.likes.length : 0;
    const commentCount = commentMap[post._id.toString()] || 0;
    const volunteerSignupCount =
      post.type === "volunteer" ? activeVolunteerSignupCount(post.volunteers) : 0;
    const engagementScore = likeCount + commentCount + volunteerSignupCount;

    const isBetter =
      engagementScore > topScore ||
      (engagementScore === topScore &&
        top &&
        new Date(post.createdAt) > new Date(top.createdAt));

    if (isBetter) {
      topScore = engagementScore;
      top = {
        _id: post._id,
        title: post.title,
        type: post.type,
        createdAt: post.createdAt,
        likeCount,
        commentCount,
        volunteerSignupCount,
        engagementScore,
      };
    }
  }

  return top;
}

async function getDashboardAnalytics(authorId) {
  const typeAggregation = await Post.aggregate([
    { $match: { author: authorId } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);

  const postTypeChart = buildPostTypeChartData(typeAggregation);
  const topPerformingPost = await getTopPerformingPost(authorId);

  return { postTypeCounts: typeAggregation, postTypeChart, topPerformingPost };
}

module.exports = {
  buildPostTypeChartData,
  getTopPerformingPost,
  getDashboardAnalytics,
};
