import { io, type Socket } from "socket.io-client";

import { getAccessToken, SERVER_URL } from "./api";

/*
 * `auth` is a callback so every reconnect sends the
 * latest access token instead of the one the socket
 * was created with.
 */
export function createSocket(): Socket {
  return io(SERVER_URL, {
    autoConnect: false,
    withCredentials: true,
    auth: (callback) => callback({ token: getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  });
}
