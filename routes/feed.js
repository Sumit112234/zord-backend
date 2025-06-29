const express = require("express")
const Post = require("../models/Post")
const User = require("../models/User")
const { isAuth } = require("../middleware/auth")

const router = express.Router()

// Get personalized feed
router.get("/", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const currentUser = req.user

    // Build visibility filter based on user role
    let visibilityFilter = {}

    if (currentUser.role === "student") {
      // Students can see: everyone, collegeOnly, studentsOnly
      visibilityFilter = {
        $or: [
          { visibility: "everyone" },
          {
            visibility: "collegeOnly",
            userId: { $in: await getUsersByCollege(currentUser.collegeId) },
          },
          {
            visibility: "studentsOnly",
            userId: { $in: await getStudentsByCollege(currentUser.collegeId) },
          },
        ],
      }
    } else if (currentUser.role === "teacher") {
      // Teachers can see: everyone, collegeOnly (but NOT studentsOnly)
      visibilityFilter = {
        $or: [
          { visibility: "everyone" },
          {
            visibility: "collegeOnly",
            userId: { $in: await getUsersByCollege(currentUser.collegeId) },
          },
        ],
      }
    } else if (currentUser.role === "admin") {
      // Admins can see everything
      visibilityFilter = {}
    }

    // Get posts with visibility and college filtering
    const posts = await Post.find({
      isActive: true,
      ...visibilityFilter,
    })
      .populate("userId", "name avatar role collegeId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    // Filter posts based on college for collegeOnly and studentsOnly
    const filteredPosts = posts.filter((post) => {
      if (post.visibility === "everyone") return true
      if (post.visibility === "collegeOnly") {
        return post.userId.collegeId === currentUser.collegeId
      }
      if (post.visibility === "studentsOnly") {
        return post.userId.collegeId === currentUser.collegeId && currentUser.role === "student"
      }
      return true
    })

    // Add interaction data for each post
    const postsWithInteractions = await Promise.all(
      filteredPosts.map(async (post) => {
        const isLiked = post.likes.includes(currentUser._id)
        return {
          ...post.toObject(),
          isLiked,
          likesCount: post.likes.length,
          commentsCount: post.commentsCount || 0,
        }
      }),
    )

    const total = await Post.countDocuments({
      isActive: true,
      ...visibilityFilter,
    })

    res.json({
      posts: postsWithInteractions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get trending posts (most liked in last 24 hours)
router.get("/trending", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const posts = await Post.find({
      isActive: true,
      createdAt: { $gte: oneDayAgo },
    })
      .populate("userId", "name avatar")
      .sort({ likesCount: -1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Post.countDocuments({
      isActive: true,
      createdAt: { $gte: oneDayAgo },
    })

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Helper functions
async function getUsersByCollege(collegeId) {
  const users = await User.find({ collegeId, isActive: true }).select("_id")
  return users.map((user) => user._id)
}

async function getStudentsByCollege(collegeId) {
  const students = await User.find({
    collegeId,
    role: "student",
    isActive: true,
  }).select("_id")
  return students.map((student) => student._id)
}

module.exports = router
