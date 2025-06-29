let io

const initializeSocket = (socketIo) => {
  io = socketIo

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id)

    // Join user to their personal room for notifications
    socket.on("join", (userId) => {
      socket.join(userId)
      console.log(`User ${userId} joined their room`)
    })

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id)
    })
  })
}

const sendNotification = (userId, notification) => {
  if (io) {
    io.to(userId.toString()).emit("notification", notification)
  }
}

module.exports = { initializeSocket, sendNotification }
