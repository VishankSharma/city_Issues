// server.js
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectionToDB from "./config/dbConnection.js"; // ✅ bring DB connect here

const PORT = process.env.PORT || 5000;

// Create HTTP server around Express app
const server = http.createServer(app);

// Socket.IO server
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", // in prod, set exact domain
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  },
});

// Make io available to routes/controllers
app.set("io", io);

// Socket connections
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

   socket.on("join", (userId) => {
    socket.join(userId); // ✅ user joins their own room
  });

  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);
  });
});

// ✅ Connect to DB first, then start server
const startServer = async () => {
  try {
    await connectionToDB();
    server.listen(PORT, () => {
      console.log(`🚀 Server running with sockets on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to connect DB:", err.message);
    process.exit(1);
  }
};

startServer();
