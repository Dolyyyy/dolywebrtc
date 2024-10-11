const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use("/", express.static(path.join(__dirname, "public")));

// Route wildcard pour servir index.html pour toutes les autres routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

io.on("connection", (socket) => {
  socket.on("join", (roomId) => {
    const selectedRoom = io.sockets.adapter.rooms.get(roomId);
    const numberOfClients = selectedRoom ? selectedRoom.size : 0;

    // Rejoindre la room
    socket.join(roomId);

    // Informer le client de la situation actuelle de la room
    if (numberOfClients === 0) {
      console.log(
        `Creating room ${roomId} and emitting room_created socket event`
      );
      socket.emit("room_created", roomId);
    } else {
      console.log(
        `Joining room ${roomId} and emitting room_joined socket event`
      );
      socket.emit("room_joined", roomId);
      socket.to(roomId).emit("user_joined", roomId); // Notifier les autres participants
    }
  });

  // Renvoyer l'offre WebRTC quand un nouvel utilisateur rejoint après un rafraîchissement
  socket.on("start_call", (roomId) => {
    console.log(`Broadcasting start_call event to peers in room ${roomId}`);
    socket.to(roomId).emit("start_call");
  });

  socket.on("webrtc_offer", (event) => {
    console.log(
      `Broadcasting webrtc_offer event to peers in room ${event.roomId}`
    );
    socket.to(event.roomId).emit("webrtc_offer", event.sdp);
  });

  socket.on("webrtc_answer", (event) => {
    console.log(
      `Broadcasting webrtc_answer event to peers in room ${event.roomId}`
    );
    socket.to(event.roomId).emit("webrtc_answer", event.sdp);
  });

  socket.on("webrtc_ice_candidate", (event) => {
    console.log(
      `Broadcasting webrtc_ice_candidate event to peers in room ${event.roomId}`
    );
    socket.to(event.roomId).emit("webrtc_ice_candidate", event);
  });
});

const port = process.env.PORT || 3892;
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`);
});
