const express = require("express")
const User = require("../models/User")
const Notification = require("../models/Notification")
const { isAuth, isAdmin } = require("../middleware/auth")
const { validateProfileUpdate } = require("../middleware/validation")
const { sendNotification } = require("../utils/socket")

const router = express.Router()

// Get user by ID
router.get("/:id", isAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("followers", "name avatar")
      .populate("following", "name avatar")
      .select("-refreshToken")

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if current user follows this user
    const isFollowing = user.followers.some((follower) => follower._id.toString() === req.user._id.toString())

    res.json({
      user: {
        ...user.toObject(),
        isFollowing,
        followersCount: user.followers.length,
        followingCount: user.following.length,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update user profile
router.put("/:id", isAuth, validateProfileUpdate, async (req, res) => {
  try {
    // Users can only update their own profile (unless admin)
    if (req.params.id !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    const { name, bio, avatar } = req.body

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, bio, avatar },
      { new: true, runValidators: true },
    ).select("-password -refreshToken")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "Profile updated successfully", user })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update user role (admin only)
router.put("/:id/role", isAuth, isAdmin, async (req, res) => {
  try {
    const { role } = req.body

    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" })
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password -refreshToken")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ message: "User role updated successfully", user })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get users by college
router.get("/college/:collegeId", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const users = await User.find({
      collegeId: req.params.collegeId,
      isActive: true,
      _id: { $ne: req.user._id }, // Exclude current user
    })
      .select("name avatar bio role")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })

    const total = await User.countDocuments({
      collegeId: req.params.collegeId,
      isActive: true,
      _id: { $ne: req.user._id },
    })

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Follow user
router.post("/:id/follow", isAuth, async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id)
    const currentUser = await User.findById(req.user._id)

    if (!userToFollow || !userToFollow.isActive) {
      return res.status(404).json({ message: "User not found" })
    }

    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" })
    }

    // Check if already following
    const isAlreadyFollowing = currentUser.following.includes(req.params.id)

    if (isAlreadyFollowing) {
      // Unfollow
      currentUser.following.pull(req.params.id)
      userToFollow.followers.pull(req.user._id)

      await currentUser.save()
      await userToFollow.save()

      res.json({ message: "User unfollowed successfully", isFollowing: false })
    } else {
      // Follow
      currentUser.following.push(req.params.id)
      userToFollow.followers.push(req.user._id)

      await currentUser.save()
      await userToFollow.save()

      // Create notification
      const notification = new Notification({
        receiverId: req.params.id,
        senderId: req.user._id,
        type: "follow",
        message: `${req.user.name} started following you`,
      })
      await notification.save()

      // Send real-time notification
      sendNotification(req.params.id, {
        type: "follow",
        message: notification.message,
        sender: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar,
        },
      })

      res.json({ message: "User followed successfully", isFollowing: true })
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get followers
router.get("/:id/followers", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const user = await User.findById(req.params.id).populate({
      path: "followers",
      select: "name avatar bio",
      options: {
        limit: limit * 1,
        skip: (page - 1) * limit,
      },
    })

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" })
    }

    const totalFollowers = await User.findById(req.params.id).select("followers")

    res.json({
      followers: user.followers,
      totalPages: Math.ceil(totalFollowers.followers.length / limit),
      currentPage: page,
      total: totalFollowers.followers.length,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get following
router.get("/:id/following", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const user = await User.findById(req.params.id).populate({
      path: "following",
      select: "name avatar bio",
      options: {
        limit: limit * 1,
        skip: (page - 1) * limit,
      },
    })

    if (!user || !user.isActive) {
      return res.status(404).json({ message: "User not found" })
    }

    const totalFollowing = await User.findById(req.params.id).select("following")

    res.json({
      following: user.following,
      totalPages: Math.ceil(totalFollowing.following.length / limit),
      currentPage: page,
      total: totalFollowing.following.length,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
