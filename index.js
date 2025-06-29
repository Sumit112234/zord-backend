const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
// const mongoSanitize = require("express-mongo-sanitize")
const sanitizeRequest = require("./middleware/mySanitise")
const xss = require("xss-clean")
const http = require("http")
const socketIo = require("socket.io")
require("dotenv").config()


const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const postRoutes = require("./routes/posts")
const feedRoutes = require("./routes/feed")
const uploadRoutes = require("./routes/upload")
const notificationRoutes = require("./routes/notifications")
const searchRoutes = require("./routes/search")
const adminRoutes = require("./routes/admin")


const errorHandler = require("./middleware/errorHandler")
const { initializeSocket } = require("./utils/socket")



const express = require("express")
const connectDB = require("./utils/connectDB")
const app = express()


const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Initialize Socket.IO
initializeSocket(io)

// Security middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
)



// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// ✅ Data sanitization (correct placement)

app.get("/", (req, res) => {
  res.status(200).json({ status: "OK", message: "Jai Shree Ram! ZORD Backend sahi chal raha h!" })
})





app.use((req, res, next) => {
  req.io = io
  next()
})



// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/posts", postRoutes)
app.use("/api/feed", feedRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/search", searchRoutes)
app.use("/api/admin", adminRoutes)



// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "ZORD Backend sahi chal raha h!" })
})

// Error handling middleware
app.use(errorHandler)


// Database connection
connectDB();


const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`ZORD Backend server running on port ${PORT}`)
})

app.use(sanitizeRequest)
app.use(xss())

module.exports = app


// 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({ message: "Route not found" })
// })
