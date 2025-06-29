const express = require("express")
const User = require("../models/User")
const { generateTokens, verifyRefreshToken } = require("../utils/jwt")
const { sendVerificationEmail } = require("../utils/email")
const { validateRegister, validateLogin } = require("../middleware/validation")
const { isAuth } = require("../middleware/auth")

const router = express.Router()

// Register
router.post("/register", validateRegister, async (req, res) => {
  try {
    const { name, email, password, collegeId, collegeName, role } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email" })
    }

    // Create user
    const user = new User({
      name,
      email,
      password,
      collegeId,
      collegeName,
      role: role || "student",
    })

    // Generate verification token
    const verificationToken = user.generateVerificationToken()
    await user.save()

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, name)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
    }

    res.status(201).json({
      message: "User registered successfully. Please check your email to verify your account.",
      userId: user._id,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Login
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body
    console.log("Login attempt with email:", email, password)

    // Find user and include password
    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: "Account has been deactivated" })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id)

    // Save refresh token
    user.refreshToken = refreshToken
    await user.save()

    // Remove password from response
    user.password = undefined

    res.json({
      message: "Login successful",
      user,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Logout
router.get("/logout", isAuth, async (req, res) => {
  try {
    // Clear refresh token
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null })

    res.json({ message: "Logged out successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get current user
router.get("/me", isAuth, async (req, res) => {
  // try {
  console.log("Fetching current user:", req.user)
    const user = await User.findById(req.user._id)
      .populate("followers", "name avatar")
      .populate("following", "name avatar")

    res.json({ user })
  // } catch (error) {
  //   res.status(500).json({ message: "Server error", error: error.message })
  // }
})

// Verify email
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpire: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired verification token" })
    }

    user.verified = true
    user.verificationToken = undefined
    user.verificationTokenExpire = undefined
    await user.save()

    res.json({ message: "Email verified successfully" })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Refresh token
router.post("/refresh-token", async (req, res) => {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" })
    }

    const decoded = verifyRefreshToken(refreshToken)
    const user = await User.findById(decoded.id)

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" })
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id)

    user.refreshToken = newRefreshToken
    await user.save()

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" })
  }
})

module.exports = router
