// Chat API calls + types. Mirrors the backend's ChatController + ChatGateway.
import { apiFetch } from "./api";
import { getToken } from "./auth-storage";
import { io, Socket } from "socket.io-client";

export type Message = {
  id: number;
  senderLogin: string;
  receiverLogin: string;
  content: string;
  readAt: string | null;
  createdAt: string;
};

export type Conversation = {
  peerLogin: string;
  peerDisplayName: string;
  peerAvatarUrl: string | null;
  lastMessage: {
    content: string;
    senderLogin: string;
    createdAt: string;
  };
  unreadCount: number;
};

export type HistoryResponse = {
  messages: Message[];
  nextCursor: number | null;
};

// ----- REST endpoints (fallback / initial load) -----

export function fetchConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/chat/conversations");
}

export function fetchHistory(peerLogin: string, cursor?: number | null): Promise<HistoryResponse> {
  const params = cursor ? `?cursor=${cursor}` : "";
  return apiFetch<HistoryResponse>(`/chat/${encodeURIComponent(peerLogin)}/history${params}`);
}

export function sendMessageRest(peerLogin: string, content: string): Promise<Message> {
  return apiFetch<Message>(`/chat/${encodeURIComponent(peerLogin)}`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ----- WebSocket connection -----

const WS_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/chat`;

/**
 * Create a socket.io connection to the /chat namespace.
 *
 * The token is read from localStorage on every connection attempt — as a
 * callback rather than a literal, so socket.io's automatic reconnects pick
 * up a reissued token instead of replaying a stale one. Without a token the
 * server rejects the socket (chat:error unauthorized).
 *
 * @returns A connected socket (or a socket that will connect when auth is available).
 */
export function createChatSocket(): Socket {
  return io(WS_URL, {
    auth: (cb) => cb({ token: getToken() }),
    transports: ["websocket"],
  });
}
