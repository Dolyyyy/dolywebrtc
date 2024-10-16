// DOM elements
const roomSelectionContainer = document.getElementById(
  "room-selection-container"
);
const roomInput = document.getElementById("room-input");
const connectButton = document.getElementById("connect-button");

const videoChatContainer = document.getElementById("video-chat-container");
const localVideoComponent = document.getElementById("local-video");
const remoteVideoComponent = document.getElementById("remote-video");

const socket = io();
const mediaConstraints = {
  audio: true,
  video: { width: 1280, height: 720 },
};
let localStream;
let remoteStream;
let isRoomCreator;
let rtcPeerConnection;
let roomId;

const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
};

document.addEventListener("DOMContentLoaded", () => {
  const path = window.location.pathname;
  if (path !== "/") {
    const roomFromUrl = path.substring(1);
    joinRoom(roomFromUrl);
  }
});

connectButton.addEventListener("click", () => {
  joinRoom(roomInput.value);
});

socket.on("room_created", async () => {
  console.log("Socket event callback: room_created");
  await setLocalStream(mediaConstraints);
  isRoomCreator = true;
});

socket.on("room_joined", async () => {
  console.log("Socket event callback: room_joined");
  await setLocalStream(mediaConstraints);
  socket.emit("start_call", roomId);
});

socket.on("full_room", () => {
  console.log("Socket event callback: full_room");
  alert("The room is full, please try another one");
});

socket.on("start_call", async () => {
  console.log("Socket event callback: start_call");
  if (isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    addLocalTracks(rtcPeerConnection);
    rtcPeerConnection.ontrack = setRemoteStream;
    rtcPeerConnection.onicecandidate = sendIceCandidate;
    await createOffer(rtcPeerConnection);
  }
});

socket.on("webrtc_offer", async (event) => {
  console.log("Socket event callback: webrtc_offer");
  if (!isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers);
    addLocalTracks(rtcPeerConnection);
    rtcPeerConnection.ontrack = setRemoteStream;
    rtcPeerConnection.onicecandidate = sendIceCandidate;
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
    await createAnswer(rtcPeerConnection);
  }
});

socket.on("webrtc_answer", (event) => {
  console.log("Socket event callback: webrtc_answer");
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
});

socket.on("webrtc_ice_candidate", (event) => {
  console.log("Socket event callback: webrtc_ice_candidate");
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  });
  rtcPeerConnection.addIceCandidate(candidate);
});

function joinRoom(room) {
  if (room === "") {
    alert("Please type a room ID");
  } else {
    roomId = room;
    socket.emit("join", room);
    showVideoConference();
    window.history.pushState({}, "", `/${roomId}`);
  }
}

let isAudioMuted = false;
let isVideoStopped = false;

const muteButton = document.getElementById("mute-button");
const cameraButton = document.getElementById("camera-button");
const muteIcon = document.getElementById("mute-icon");
const cameraIcon = document.getElementById("camera-icon");

muteButton.addEventListener("click", () => {
  if (localStream && localStream.getAudioTracks().length > 0) {
    isAudioMuted = !isAudioMuted;
    localStream.getAudioTracks()[0].enabled = !isAudioMuted;

    muteIcon.className = isAudioMuted
      ? "fas fa-microphone-slash"
      : "fas fa-microphone";
  }
});

cameraButton.addEventListener("click", () => {
  if (localStream && localStream.getVideoTracks().length > 0) {
    isVideoStopped = !isVideoStopped;
    localStream.getVideoTracks()[0].enabled = !isVideoStopped;

    cameraIcon.className = isVideoStopped
      ? "fas fa-video-slash"
      : "fas fa-video";
  }
});

function showVideoConference() {
  roomSelectionContainer.style.display = "none";
  videoChatContainer.style.display = "block";
}

async function setLocalStream(mediaConstraints) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
    localVideoComponent.srcObject = localStream;
  } catch (error) {
    console.error("Could not get user media", error);
  }
}

function addLocalTracks(rtcPeerConnection) {
  localStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localStream);
  });
}

async function createOffer(rtcPeerConnection) {
  try {
    const sessionDescription = await rtcPeerConnection.createOffer();
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit("webrtc_offer", {
      type: "webrtc_offer",
      sdp: sessionDescription,
      roomId,
    });
  } catch (error) {
    console.error(error);
  }
}

async function createAnswer(rtcPeerConnection) {
  try {
    const sessionDescription = await rtcPeerConnection.createAnswer();
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit("webrtc_answer", {
      type: "webrtc_answer",
      sdp: sessionDescription,
      roomId,
    });
  } catch (error) {
    console.error(error);
  }
}

function setRemoteStream(event) {
  remoteVideoComponent.srcObject = event.streams[0];
  remoteStream = event.stream;
}

function sendIceCandidate(event) {
  if (event.candidate) {
    socket.emit("webrtc_ice_candidate", {
      roomId,
      label: event.candidate.sdpMLineIndex,
      candidate: event.candidate.candidate,
    });
  }
}
