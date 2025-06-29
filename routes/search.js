const express = require("express")
const User = require("../models/User")
const Post = require("../models/Post")
const { isAuth } = require("../middleware/auth")

const router = express.Router()

// Search users
router.get("/users", isAuth, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" })
    }

    const searchRegex = new RegExp(q.trim(), "i")

    const users = await User.find({
      $and: [
        { isActive: true },
        { _id: { $ne: req.user._id } }, // Exclude current user
        {
          $or: [{ name: searchRegex }, { email: searchRegex }, { bio: searchRegex }],
        },
      ],
    })
      .select("name avatar bio role collegeId collegeName")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 })

    const total = await User.countDocuments({
      $and: [
        { isActive: true },
        { _id: { $ne: req.user._id } },
        {
          $or: [{ name: searchRegex }, { email: searchRegex }, { bio: searchRegex }],
        },
      ],
    })

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      query: q,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Search posts
router.get("/posts", isAuth, async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" })
    }

    const searchRegex = new RegExp(q.trim(), "i")

    // Search in caption and hashtags
    const posts = await Post.find({
      $and: [
        { isActive: true },
        {
          $or: [{ caption: searchRegex }, { hashtags: { $in: [searchRegex] } }],
        },
      ],
    })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    // Filter posts based on visibility and user role
    const filteredPosts = posts.filter((post) => {
      if (post.visibility === "everyone") return true
      if (post.visibility === "collegeOnly") {
        return post.userId.collegeId === req.user.collegeId
      }
      if (post.visibility === "studentsOnly") {
        return post.userId.collegeId === req.user.collegeId && req.user.role === "student"
      }
      return false
    })

    const total = await Post.countDocuments({
      $and: [
        { isActive: true },
        {
          $or: [{ caption: searchRegex }, { hashtags: { $in: [searchRegex] } }],
        },
      ],
    })

    res.json({
      posts: filteredPosts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total: filteredPosts.length,
      query: q,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Search hashtags
router.get("/hashtags", isAuth, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required" })
    }

    const searchRegex = new RegExp(q.trim(), "i")

    // Aggregate hashtags with post counts
    const hashtags = await Post.aggregate([
      { $match: { isActive: true, hashtags: { $exists: true, $ne: [] } } },
      { $unwind: "$hashtags" },
      { $match: { hashtags: searchRegex } },
      {
        $group: {
          _id: "$hashtags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit * 1 },
      {
        $project: {
          hashtag: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ])

    res.json({
      hashtags,
      query: q,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get trending hashtags
router.get("/trending-hashtags", isAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const trendingHashtags = await Post.aggregate([
      {
        $match: {
          isActive: true,
          createdAt: { $gte: oneDayAgo },
          hashtags: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$hashtags" },
      {
        $group: {
          _id: "$hashtags",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit * 1 },
      {
        $project: {
          hashtag: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ])

    res.json({ hashtags: trendingHashtags })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
