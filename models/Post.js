const mongoose = require("mongoose")

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: {
      type: String,
      maxlength: [2000, "Caption cannot exceed 2000 characters"],
      trim: true,
    },
    mediaUrl: {
      type: String,
      required: [true, "Media URL is required"],
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    mediaPublicId: {
      type: String,
      required: true,
    },
    visibility: {
      type: String,
      enum: ["everyone", "collegeOnly", "studentsOnly"],
      default: "everyone",
    },
    hashtags: [
      {
        type: String,
        lowercase: true,
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Extract hashtags before saving
postSchema.pre("save", function (next) {
  if (this.caption) {
    const hashtags = this.caption.match(/#\w+/g)
    if (hashtags) {
      this.hashtags = hashtags.map((tag) => tag.substring(1).toLowerCase())
    }
  }
  next()
})

// Update likes count
postSchema.methods.updateLikesCount = async function () {
  this.likesCount = this.likes.length
  await this.save()
}

module.exports = mongoose.model("Post", postSchema)
