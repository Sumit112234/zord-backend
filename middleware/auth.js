const jwt = require("jsonwebtoken")
const User = require("../models/User")

// Verify JWT token
const isAuth = async (req, res, next) => {
  try {

    console.log("Checking authentication for request:", req.header,  req.headers)
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      return res.status(401).json({ message: "Access denied. No token provided." })
    }

    console.log("Token received:", token)

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.id).select("-password")

    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid token or user not found." })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token." })
  }
}

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin role required." })
  }
  next()
}

// Check if user is teacher
const isTeacher = (req, res, next) => {
  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Teacher role required." })
  }
  next()
}

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.user.role !== "student" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Student role required." })
  }
  next()
}

module.exports = { isAuth, isAdmin, isTeacher, isStudent }
