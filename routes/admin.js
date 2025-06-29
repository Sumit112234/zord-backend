const express = require("express")
const User = require("../models/User")
const Post = require("../models/Post")
const Comment = require("../models/Comment")
const Notification = require("../models/Notification")
const { isAuth, isAdmin } = require("../middleware/auth")
const { deleteFromCloudinary } = require("../utils/cloudinary")

const router = express.Router()

// Get all users (admin only)
router.get("/users", isAuth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, college, search } = req.query

    const filter = {}

    if (role && ["student", "teacher", "admin"].includes(role)) {
      filter.role = role
    }

    if (college) {
      filter.collegeId = college
    }

    if (search) {
      const searchRegex = new RegExp(search, "i")
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { collegeName: searchRegex }]
    }

    const users = await User.find(filter)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await User.countDocuments(filter)

    // Get user statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ])

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count
        return acc
      }, {}),
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete user (admin only)
router.delete("/users/:id", isAuth, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Prevent admin from deleting themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account" })
    }

    // Get all posts by this user to delete media from Cloudinary
    const userPosts = await Post.find({ userId: req.params.id })

    // Delete media from Cloudinary
    for (const post of userPosts) {
      if (post.mediaPublicId) {
        await deleteFromCloudinary(post.mediaPublicId)
      }
    }

    // Delete user's posts, comments, likes, and notifications
    await Post.deleteMany({ userId: req.params.id })
    await Comment.deleteMany({ userId: req.params.id })
    await Notification.deleteMany({
      $or: [{ senderId: req.params.id }, { receiverId: req.params.id }],
    })

    // Remove user from followers/following lists
    await User.updateMany({ followers: req.params.id }, { $pull: { followers: req.params.id } })
    await User.updateMany({ following: req.params.id }, { $pull: { following: req.params.id } })

    // Delete user
    await User.findByIdAndDelete(req.params.id)

    res.json({ message: "User and all associated data deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get all posts (admin only)
router.get("/posts", isAuth, isAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, userId, visibility } = req.query

    const filter = {}

    if (userId) {
      filter.userId = userId
    }

    if (visibility && ["everyone", "collegeOnly", "studentsOnly"].includes(visibility)) {
      filter.visibility = visibility
    }

    const posts = await Post.find(filter)
      .populate("userId", "name email avatar role")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Post.countDocuments(filter)

    // Get post statistics
    const stats = await Post.aggregate([
      {
        $group: {
          _id: "$visibility",
          count: { $sum: 1 },
        },
      },
    ])

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      stats: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count
        return acc
      }, {}),
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete post (admin only)
router.delete("/posts/:id", isAuth, isAdmin, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ message: "Post not found" })
    }

    // Delete from Cloudinary
    if (post.mediaPublicId) {
      await deleteFromCloudinary(post.mediaPublicId)
    }

    // Delete associated comments and notifications
    await Comment.deleteMany({ postId: req.params.id })
    await Notification.deleteMany({ postId: req.params.id })

    // Delete post
    await Post.findByIdAndDelete(req.params.id)

    res.json({ message: "Post deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get platform statistics (admin only)
router.get("/stats", isAuth, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const totalPosts = await Post.countDocuments()
    const totalComments = await Comment.countDocuments()

    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ])

    const postsByVisibility = await Post.aggregate([
      {
        $group: {
          _id: "$visibility",
          count: { $sum: 1 },
        },
      },
    ])

    const recentActivity = await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          posts: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    const topColleges = await User.aggregate([
      {
        $group: {
          _id: "$collegeName",
          userCount: { $sum: 1 },
        },
      },
      { $sort: { userCount: -1 } },
      { $limit: 10 },
    ])

    res.json({
      overview: {
        totalUsers,
        totalPosts,
        totalComments,
        activeUsers: await User.countDocuments({ isActive: true }),
      },
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      postsByVisibility: postsByVisibility.reduce((acc, item) => {
        acc[item._id] = item.count
        return acc
      }, {}),
      recentActivity,
      topColleges,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get reported content (placeholder for future implementation)
router.get("/reports", isAuth, isAdmin, async (req, res) => {
  try {
    // This would be implemented when a reporting system is added
    res.json({
      message: "Reporting system not yet implemented",
      reports: [],
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Deactivate/Activate user (admin only)
router.put("/users/:id/status", isAuth, isAdmin, async (req, res) => {
  try {
    const { isActive } = req.body

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be a boolean value" })
    }

    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Prevent admin from deactivating themselves
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot change your own status" })
    }

    user.isActive = isActive
    await user.save()

    res.json({
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
