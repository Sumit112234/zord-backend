const express = require("express")
const Notification = require("../models/Notification")
const { isAuth } = require("../middleware/auth")

const router = express.Router()

// Get user notifications
router.get("/", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query

    const filter = {
      receiverId: req.user._id,
      isActive: true,
    }

    if (unreadOnly === "true") {
      filter.seen = false
    }

    const notifications = await Notification.find(filter)
      .populate("senderId", "name avatar")
      .populate("postId", "mediaUrl mediaType")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Notification.countDocuments(filter)
    const unreadCount = await Notification.countDocuments({
      receiverId: req.user._id,
      seen: false,
      isActive: true,
    })

    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
      unreadCount,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Create notification (for testing purposes)
router.post("/", isAuth, async (req, res) => {
  try {
    const { receiverId, type, message, postId } = req.body

    if (!receiverId || !type || !message) {
      return res.status(400).json({
        message: "Receiver ID, type, and message are required",
      })
    }

    const notification = new Notification({
      receiverId,
      senderId: req.user._id,
      type,
      message,
      postId,
    })

    await notification.save()
    await notification.populate("senderId", "name avatar")

    res.status(201).json({
      message: "Notification created successfully",
      notification,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Mark notification as seen
router.put("/:id/seen", isAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    // Check if user owns the notification
    if (notification.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" })
    }

    notification.seen = true
    await notification.save()

    res.json({ message: "Notification marked as seen", notification })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Mark all notifications as seen
router.put("/mark-all-seen", isAuth, async (req, res) => {
  try {
    await Notification.updateMany({ receiverId: req.user._id, seen: false }, { seen: true })

    res.json({ message: "All notifications marked as seen" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete notification
router.delete("/:id", isAuth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" })
    }

    // Check if user owns the notification
    if (notification.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" })
    }

    await Notification.findByIdAndDelete(req.params.id)

    res.json({ message: "Notification deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
