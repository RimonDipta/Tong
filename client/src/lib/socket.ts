import { io, type Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export function createSocket(accessToken: string): Socket {
  return io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: {
      token: accessToken,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });
}
