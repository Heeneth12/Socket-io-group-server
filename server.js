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

// Room management
const rooms = new Map(); // Maps roomId to array of {id, name} objects
const userRooms = new Map(); // Maps socketId to roomId

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);

  // Join room handler
  socket.on('join-room', (data) => {
    const { roomId, userId, userName } = data;
    
    console.log(`User ${userName} (${socket.id}) joining room: ${roomId}`);
    
    // Add user to room mapping
    if (!rooms.has(roomId)) {
      rooms.set(roomId, []);
    }
    
    // Join socket.io room
    socket.join(roomId);
    
    // Add user to our room tracking
    const roomUsers = rooms.get(roomId);
    roomUsers.push({
      id: socket.id,
      name: userName
    });
    
    // Associate this socket with the room
    userRooms.set(socket.id, roomId);
    
    // Send list of all users in the room to the newly joined user
    socket.emit('room-users', roomUsers);
    
    // Broadcast to others in the room that a new user joined
    socket.to(roomId).emit('user-joined', {
      callerId: socket.id,
      callerName: userName,
      signal: null // Signal will be sent in the 'sending-signal' event
    });
  });

  // Sending signal to users in the room
  socket.on('sending-signal', (data) => {
    const roomId = userRooms.get(socket.id);
    if (!roomId) return;
    
    console.log(`User ${socket.id} sending signal to ${data.userToSignal}`);
    
    io.to(data.userToSignal).emit('user-joined', { 
      signal: data.signal,
      callerId: data.callerId,
      callerName: data.callerName
    });
  });

  // Returning signal to the caller
  socket.on('returning-signal', (data) => {
    console.log(`User ${socket.id} returning signal to ${data.callerId}`);
    
    io.to(data.callerId).emit('receiving-returned-signal', { 
      signal: data.signal,
      id: socket.id
    });
  });

  // Leave room handler
  socket.on('leave-room', (data) => {
    handleUserLeaving(socket);
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    handleUserLeaving(socket);
  });

  // Helper function to handle user leaving
  function handleUserLeaving(socket) {
    const roomId = userRooms.get(socket.id);
    if (roomId) {
      console.log(`User ${socket.id} leaving room ${roomId}`);
      
      // Remove user from room users array
      const roomUsers = rooms.get(roomId);
      if (roomUsers) {
        const index = roomUsers.findIndex(user => user.id === socket.id);
        if (index !== -1) {
          roomUsers.splice(index, 1);
        }
        
        // If room is empty, remove it
        if (roomUsers.length === 0) {
          console.log(`Room ${roomId} is now empty, removing it`);
          rooms.delete(roomId);
        } else {
          // Notify other users in the room that this user has left
          socket.to(roomId).emit('user-left', socket.id);
        }
      }
      
      // Leave socket.io room
      socket.leave(roomId);
      
      // Remove from user room mapping
      userRooms.delete(socket.id);
    }
  }
});

server.listen(9000, () => {
  console.log("Server is running on port 4444");
});

function generateRandomRoomName() {
  return Math.random().toString(36).substring(7);
}
