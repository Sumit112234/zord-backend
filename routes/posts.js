const express = require("express")
const Post = require("../models/Post")
const Comment = require("../models/Comment")
const Like = require("../models/Like")
const Notification = require("../models/Notification")
const { isAuth } = require("../middleware/auth")
const { validatePost, validateComment } = require("../middleware/validation")
const { deleteFromCloudinary } = require("../utils/cloudinary")
const { sendNotification } = require("../utils/socket")

const router = express.Router()

// Create post
router.post("/", isAuth, validatePost, async (req, res) => {
  try {
    const { caption, mediaUrl, mediaType, mediaPublicId, visibility } = req.body

    if (!mediaUrl || !mediaType || !mediaPublicId) {
      return res.status(400).json({ message: "Media URL, type, and public ID are required" })
    }

    const post = new Post({
      userId: req.user._id,
      caption,
      mediaUrl,
      mediaType,
      mediaPublicId,
      visibility: visibility || "everyone",
    })

    await post.save()
    await post.populate("userId", "name avatar")

    res.status(201).json({ message: "Post created successfully", post })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get all posts (with pagination)
router.get("/", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const posts = await Post.find({ isActive: true })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Post.countDocuments({ isActive: true })

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

// Get post by ID
router.get("/:id", isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate("userId", "name avatar").populate("likes", "name avatar")

    if (!post || !post.isActive) {
      return res.status(404).json({ message: "Post not found" })
    }

    // Check if current user liked the post
    const isLiked = post.likes.some((like) => like._id.toString() === req.user._id.toString())

    res.json({
      post: {
        ...post.toObject(),
        isLiked,
      },
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Update post
router.put("/:id", isAuth, validatePost, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post || !post.isActive) {
      return res.status(404).json({ message: "Post not found" })
    }

    // Check if user owns the post
    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" })
    }

    const { caption, visibility } = req.body

    post.caption = caption !== undefined ? caption : post.caption
    post.visibility = visibility !== undefined ? visibility : post.visibility

    await post.save()
    await post.populate("userId", "name avatar")

    res.json({ message: "Post updated successfully", post })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete post
router.delete("/:id", isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post) {
      return res.status(404).json({ message: "Post not found" })
    }

    // Check if user owns the post or is admin
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    // Delete from Cloudinary
    await deleteFromCloudinary(post.mediaPublicId)

    // Delete associated comments and likes
    await Comment.deleteMany({ postId: req.params.id })
    await Like.deleteMany({ postId: req.params.id })
    await Notification.deleteMany({ postId: req.params.id })

    // Delete post
    await Post.findByIdAndDelete(req.params.id)

    res.json({ message: "Post deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Like/Unlike post
router.post("/:id/like", isAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post || !post.isActive) {
      return res.status(404).json({ message: "Post not found" })
    }

    const existingLike = await Like.findOne({
      postId: req.params.id,
      userId: req.user._id,
    })

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id)
      post.likes.pull(req.user._id)
      post.likesCount = Math.max(0, post.likesCount - 1)
      await post.save()

      res.json({ message: "Post unliked", isLiked: false, likesCount: post.likesCount })
    } else {
      // Like
      const like = new Like({
        postId: req.params.id,
        userId: req.user._id,
      })
      await like.save()

      post.likes.push(req.user._id)
      post.likesCount += 1
      await post.save()

      // Create notification (don't notify if user likes their own post)
      if (post.userId.toString() !== req.user._id.toString()) {
        const notification = new Notification({
          receiverId: post.userId,
          senderId: req.user._id,
          type: "like",
          postId: req.params.id,
          message: `${req.user.name} liked your post`,
        })
        await notification.save()

        // Send real-time notification
        sendNotification(post.userId.toString(), {
          type: "like",
          message: notification.message,
          sender: {
            _id: req.user._id,
            name: req.user.name,
            avatar: req.user.avatar,
          },
          postId: req.params.id,
        })
      }

      res.json({ message: "Post liked", isLiked: true, likesCount: post.likesCount })
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get post likes
router.get("/:id/likes", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const likes = await Like.find({ postId: req.params.id })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Like.countDocuments({ postId: req.params.id })

    res.json({
      likes: likes.map((like) => like.userId),
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Add comment
router.post("/:id/comments", isAuth, validateComment, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)

    if (!post || !post.isActive) {
      return res.status(404).json({ message: "Post not found" })
    }

    const comment = new Comment({
      postId: req.params.id,
      userId: req.user._id,
      content: req.body.content,
    })

    await comment.save()
    await comment.populate("userId", "name avatar")

    // Update post comments count
    post.commentsCount += 1
    await post.save()

    // Create notification (don't notify if user comments on their own post)
    if (post.userId.toString() !== req.user._id.toString()) {
      const notification = new Notification({
        receiverId: post.userId,
        senderId: req.user._id,
        type: "comment",
        postId: req.params.id,
        message: `${req.user.name} commented on your post`,
      })
      await notification.save()

      // Send real-time notification
      sendNotification(post.userId.toString(), {
        type: "comment",
        message: notification.message,
        sender: {
          _id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar,
        },
        postId: req.params.id,
      })
    }

    res.status(201).json({ message: "Comment added successfully", comment })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get post comments
router.get("/:id/comments", isAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query

    const comments = await Comment.find({
      postId: req.params.id,
      isActive: true,
    })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Comment.countDocuments({
      postId: req.params.id,
      isActive: true,
    })

    res.json({
      comments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Delete comment
router.delete("/comments/:id", isAuth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)

    if (!comment) {
      return res.status(404).json({ message: "Comment not found" })
    }

    // Check if user owns the comment or is admin
    if (comment.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" })
    }

    // Update post comments count
    const post = await Post.findById(comment.postId)
    if (post) {
      post.commentsCount = Math.max(0, post.commentsCount - 1)
      await post.save()
    }

    await Comment.findByIdAndDelete(req.params.id)

    res.json({ message: "Comment deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

module.exports = router
