const express = require("express");
const multer = require("multer");
const { uploadToCloudinary } = require("../utils/cloudinary");
const { isAuth } = require("../middleware/auth");
const Post = require("../models/Post");

const router = express.Router();

// Use memory storage to avoid local file creation
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image and video files are allowed"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

// Upload media file
router.post("/", isAuth, upload.single("media"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const mediaType = req.file.mimetype.startsWith("image/") ? "image" : "video";

    const result = await uploadToCloudinary(req.file, "zord/posts");

    // Create post in DB
    const post = await Post.create({
      userId: req.user._id,
      caption: req.body.caption || "",
      mediaUrl: result.url,
      mediaPublicId: result.publicId,
      mediaType: mediaType,
      visibility: req.body.visibility || "everyone",
    });

    res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    res.status(500).json({
      message: "Upload failed",
      error: error.message,
    });
  }
});



// Upload avatar
router.post("/avatar", isAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image files are allowed for avatars" });
    }

    const result = await uploadToCloudinary(req.file, "zord/avatars");

    res.json({
      message: "Avatar uploaded successfully",
      avatarUrl: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Avatar upload failed",
      error: error.message,
    });
  }
});

module.exports = router;


// const express = require("express")
// const multer = require("multer")
// const path = require("path")
// const { uploadToCloudinary } = require("../utils/cloudinary")
// const { isAuth } = require("../middleware/auth")
// const storage = multer.memoryStorage();

// const router = express.Router()

// // Configure multer for file uploads
// // const storage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     cb(null, "uploads/")
// //   },
// //   filename: (req, file, cb) => {
// //     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
// //     cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
// //   },
// // })

// const fileFilter = (req, file, cb) => {
//   // Check file type
//   if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
//     cb(null, true)
//   } else {
//     cb(new Error("Only image and video files are allowed"), false)
//   }
// }

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 50 * 1024 * 1024, // 50MB limit
//   },
//   fileFilter: fileFilter,
// })

// // Create uploads directory if it doesn't exist
// const fs = require("fs")
// const uploadsDir = "uploads"
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir)
// }

// // Upload media file
// router.post("/", isAuth, upload.single("media"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" })
//     }

//     // Determine media type
//     const mediaType = req.file.mimetype.startsWith("image/") ? "image" : "video"

//     // Upload to Cloudinary
//     const result = await uploadToCloudinary(req.file, "zord/posts")

//     // Delete local file after upload
//     fs.unlinkSync(req.file.path)

//     res.json({
//       message: "File uploaded successfully",
//       mediaUrl: result.url,
//       mediaPublicId: result.publicId,
//       mediaType: mediaType,
//     })
//   } catch (error) {
//     // Clean up local file if upload fails
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path)
//     }

//     res.status(500).json({
//       message: "Upload failed",
//       error: error.message,
//     })
//   }
// })

// // Upload avatar
// router.post("/avatar", isAuth, upload.single("avatar"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" })
//     }

//     // Check if it's an image
//     if (!req.file.mimetype.startsWith("image/")) {
//       fs.unlinkSync(req.file.path)
//       return res.status(400).json({ message: "Only image files are allowed for avatars" })
//     }

//     // Upload to Cloudinary
//     const result = await uploadToCloudinary(req.file, "zord/avatars")

//     // Delete local file after upload
//     fs.unlinkSync(req.file.path)

//     res.json({
//       message: "Avatar uploaded successfully",
//       avatarUrl: result.url,
//       publicId: result.publicId,
//     })
//   } catch (error) {
//     // Clean up local file if upload fails
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path)
//     }

//     res.status(500).json({
//       message: "Avatar upload failed",
//       error: error.message,
//     })
//   }
// })

// module.exports = router
