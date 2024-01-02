const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://findme-g66u.vercel.app",
    methods: ["GET", "POST"],
  },
});

const waitingUsers = []; // Store users waiting to be paired

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join_room", (room) => {
    if (!room) {
      // If no room is specified, generate a random room ID
      room = generateRandomRoomName();
    }

    const partner = waitingUsers.pop(); // Get a waiting user, if available

    if (partner) {
      // If a waiting user is available, pair the users in the same room
      socket.join(room);
      partner.join(room);
      io.to(room).emit("user_paired", { room });
    } else {
      // If no waiting user, add the current user to the waiting list
      waitingUsers.push(socket);
    }
  });

  // Handle sending messages
  socket.on("send_message", (data) => {
    
    socket.to(data.room).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const index = waitingUsers.indexOf(socket);
    if (index !== -1) {
      // Remove user from the waiting list if they disconnect
      waitingUsers.splice(index, 1);
    }
    io.emit("user_disconnected", { message: " user disconnected" });
  });
});

server.listen(9000, () => {
  console.log("Server is running on port 4444");
});

function generateRandomRoomName() {
  return Math.random().toString(36).substring(7);
}
