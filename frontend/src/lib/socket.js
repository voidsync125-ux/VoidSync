import { io } from "socket.io-client";
import { API_URL, getToken } from "./api";

let socket = null;

// Returns a singleton authenticated socket connection. Creates it on
// first call; reuses the same connection across the app afterwards.
export function getSocket() {
  if (socket) return socket;

  socket = io(API_URL, {
    auth: { token: getToken() },
    autoConnect: true,
  });

  return socket;
}

// Call on logout to fully tear down the connection.
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
