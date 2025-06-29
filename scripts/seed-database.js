const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const User = require("../models/User")
const Post = require("../models/Post")
require("dotenv").config()

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/zord")
    console.log("Connected to MongoDB")

    // Clear existing data
    await User.deleteMany({})
    await Post.deleteMany({})
    console.log("Cleared existing data")

    // Create admin user
    const adminPassword = await bcrypt.hash("admin123", 12)
    const admin = new User({
      name: "Admin User",
      email: "admin@zord.com",
      password: adminPassword,
      collegeId: "ADMIN001",
      collegeName: "ZORD Administration",
      role: "admin",
      verified: true,
      isActive: true,
    })
    await admin.save()

    // Create sample users
    const sampleUsers = [
      {
        name: "John Student",
        email: "john@college.edu",
        password: await bcrypt.hash("password123", 12),
        collegeId: "COL001",
        collegeName: "Tech University",
        role: "student",
        verified: true,
        bio: "Computer Science student passionate about coding",
      },
      {
        name: "Jane Teacher",
        email: "jane@college.edu",
        password: await bcrypt.hash("password123", 12),
        collegeId: "COL001",
        collegeName: "Tech University",
        role: "teacher",
        verified: true,
        bio: "Professor of Computer Science",
      },
      {
        name: "Mike Student",
        email: "mike@college.edu",
        password: await bcrypt.hash("password123", 12),
        collegeId: "COL001",
        collegeName: "Tech University",
        role: "student",
        verified: true,
        bio: "Engineering student and tech enthusiast",
      },
      {
        name: "Sarah Student",
        email: "sarah@othercollege.edu",
        password: await bcrypt.hash("password123", 12),
        collegeId: "COL002",
        collegeName: "Arts College",
        role: "student",
        verified: true,
        bio: "Art student and creative designer",
      },
    ]

    const createdUsers = await User.insertMany(sampleUsers)
    console.log(`Created ${createdUsers.length} sample users`)

    // Create sample posts
    const samplePosts = [
      {
        userId: createdUsers[0]._id,
        caption: "Just finished my first React project! #coding #react #webdev",
        mediaUrl: "https://via.placeholder.com/600x400/4F46E5/FFFFFF?text=React+Project",
        mediaType: "image",
        mediaPublicId: "sample_post_1",
        visibility: "everyone",
        hashtags: ["coding", "react", "webdev"],
      },
      {
        userId: createdUsers[1]._id,
        caption: "Teaching advanced algorithms today. Students are doing great! #teaching #algorithms",
        mediaUrl: "https://via.placeholder.com/600x400/059669/FFFFFF?text=Algorithm+Class",
        mediaType: "image",
        mediaPublicId: "sample_post_2",
        visibility: "collegeOnly",
        hashtags: ["teaching", "algorithms"],
      },
      {
        userId: createdUsers[2]._id,
        caption: "Study group session for finals! #studygroup #finals #engineering",
        mediaUrl: "https://via.placeholder.com/600x400/DC2626/FFFFFF?text=Study+Group",
        mediaType: "image",
        mediaPublicId: "sample_post_3",
        visibility: "studentsOnly",
        hashtags: ["studygroup", "finals", "engineering"],
      },
    ]

    const createdPosts = await Post.insertMany(samplePosts)
    console.log(`Created ${createdPosts.length} sample posts`)

    console.log("Database seeded successfully!")
    console.log("\nSample login credentials:")
    console.log("Admin: admin@zord.com / admin123")
    console.log("Student: john@college.edu / password123")
    console.log("Teacher: jane@college.edu / password123")

    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seedDatabase()
