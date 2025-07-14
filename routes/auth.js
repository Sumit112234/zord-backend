const express = require("express")
const User = require("../models/User")
const { generateTokens, verifyRefreshToken } = require("../utils/jwt")
const { sendVerificationEmail } = require("../utils/email")
const { validateRegister, validateLogin } = require("../middleware/validation")
const { isAuth } = require("../middleware/auth")
const { getOTP } = require("../utils/otp")
const axios = require("axios")
const jwt = require("jsonwebtoken")


const router = express.Router()

// user email enter karega
// and then OTP will be sent to that email

router.post("/send-otp", async (req, res) =>{
  try {
    const { email } = req.body

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Generate OTP 
    const OtP = getOTP()
    user.verificationToken = OtP  ;
    user.verificationTokenExpire = Date.now() + 10 * 60 * 1000 // 10 minutes
    await user.save();

    console.log("Generated OTP:", OtP, email, user.name)  
    // Send OTP via email
    try {
      await sendVerificationEmail(email, OtP, user.name)
      res.json({ message: "OTP sent successfully" })
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError)
      return res.status(500).json({ message: "Failed to send OTP email" })
    }
  }
  catch (error) {
    console.error("Error sending OTP:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})


// user will enter that OTP
// and then vo otp backend ko send hogi
// and then backend will verify that OTP. User will be verified if OTP is correct
// and then ask for name ,collage name


//login krte waqt if user enter opt then call with accessToken = true else only {email, otp} will work
// {email, otp, accessToken} 
// yahi functtion verify bhi kr dega
router.post("/check-otp", async (req, res) =>{
  try {
    const { email, otp , accessToken } = req.body

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    // Check if OTP is valid
    if (user.verificationToken !== otp || user.verificationTokenExpire < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" })
    }

    // OTP is valid, mark user as verified

    if(accessToken){
         const { accessToken, refreshToken } = generateTokens(user._id)

    // Save refresh token
      user.refreshToken = refreshToken
        await user.save()

      // Remove password from response
      user.password = undefined

      res.json({
        message: "Login successful",
        user,
        verified: user.verified,
        accessToken,
        refreshToken,
      })
    }
    user.verified = true  
    user.verificationToken = undefined
    user.verificationTokenExpire = undefined
    await user.save() 
    res.json({ message: "OTP verified successfully", token : accessToken })
  } catch (error) {
    console.error("Error checking OTP:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})




// router.post("/verify-email", async (req, res) => {
//   try {
//     const { email } = req.body

//     const user = await User.findOne({ email: email.toLowerCase() })

//     if (!user) {
//       return res.status(400).json({ message: "User not found!" })
//     }

//     user.verified = true
//     await user.save()

//     res.json({ message: "Email verified successfully" })
//   } catch (error) {
//     res.status(500).json({ message: "Server error", error: error.message })
//   }
// })






// Register

// user enter krte waqt only email send krna h is ko
//aur fir last mai bhi isko hi call krna h sab kuch bhej kr
// { name, email, password, collegeName, role } 

router.post("/register", validateRegister, async (req, res) => {
  try {

    const { name, email, password, collegeName, role } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      
      user.name = name 
      user.password = password
      user.collegeName = collegeName 
      user.role = role || "student"

      await user.save();


      return res.status(200).json({ message: "User updated Successfully!" })
    }

    // Create user
    const user = new User({
      name : name || "Anonymous User",
      email,
      password,
      collegeName : collegeName || "--",
      role: role || "student",
    })

    // Generate verification token
    // const verificationToken = user.generateVerificationToken()
    // const OtP = getOTP();
    await user.save()

    // console.log("Generated verification token:", OtP, email, name)

    // try {
    //   await sendVerificationEmail(email, OtP, name)
    // } catch (emailError) {
    //   console.error("Failed to send verification email:", emailError)
    // }

    res.status(201).json({
      message: "User registered successfully.",
      userId: user._id,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})


// ya to google se direct login krlo ya fir email aur password se login kro , opt se bhi kr sakte h
// otp se kiya h to verification mail jayega fir /cheak-otp ko call krna h aur usme accessToken = true bhejna h
// Login
router.post("/login", validateLogin, async (req, res) => {
  try {
    const { email, password, otp } = req.body
    console.log("Login attempt with email:", email, password, otp)

    // Find user and include password
    const user = await User.findOne({ email }).select("+password")
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    // Check if user is active
    if (!user.verified) {
      return res.status(401).json({ message: "Not Verified account!" })
    }

    // Check password

    if (!user.password) {
      // If password is not set, check OTP
      if (!otp) {
        return res.status(400).json({ message: "OTP required for login" })
      }      
          const OtP = getOTP()
        user.verificationToken = OtP  ;
        user.verificationTokenExpire = Date.now() + 10 * 60 * 1000 // 10 minutes
        await user.save();


        await sendVerificationEmail(email, OtP, user.name);


        console.log("User logged in with OTP:", user.email)

        return res.status(200).json({ message: "OTP sent to your email", userId: user._id })

    }
    else{
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid credentials" })
      }
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
      verified: user.verified,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message })
  }
})


// ispr if user is new then enter krwao name collage name fir register ki call

router.post("/google", async (req, res) => {
  try {
    const { tokenId, collegeId, collegeName, role } = req.body

    // 1. Verify Google Token
    const { data } = await axios.get(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${tokenId}`)
    const { email, name, picture, email_verified } = data

    if (!email_verified) {
      return res.status(400).json({ message: "Google email not verified" })
    }

    // console.log("Google user data:", data)

    // 2. Check if user already exists
    let user = await User.findOne({ email })

    if (!user) {
      // 3. Create new user from Google
      user = await User.create({
        name : name || "Anonymous User",
        email,
        avatar: picture,
        collegeName : collegeName || "--",
        role: role || "student",
        verified: false,
        provider: "google",
      })

       await user.save();

       return res.status(401).json({ message: "User Registered!", user })
    }

    if (!user.verified) {
      return res.status(401).json({ message: "Your account is not verified!" })
    }

    // 4. Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id)

    // 5. Save refresh token
    user.refreshToken = refreshToken
    await user.save()

    user.password = undefined

    res.status(200).json({
      message: "Google login successful",
      user,
      accessToken,
      refreshToken,
    })
  } catch (error) {
    console.error("Google login error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
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
  try {
  console.log("Fetching current user:", req.user)
    const user = await User.findById(req.user._id)
      .populate("followers", "name avatar")
      .populate("following", "name avatar")

    res.json({ user })
  } catch (error) {
    res.status(500).json({ message: "me mai kuch error h.", error: error.message })
  }
})

// Verify email



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


// DELETE /api/auth/users/:id
router.delete("/delete-user/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: Add authentication/authorization here

    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully", user: deletedUser });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});


module.exports = router
