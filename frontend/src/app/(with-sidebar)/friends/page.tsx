"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/Button";
import { FriendAvatar } from "@/components/profile/FriendAvatar";
import {
  fetchFriends,
  fetchFriendRequests,
  fetchBlocked,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  blockUser,
  unblockUser,
  type BlockedUser,
  type Friend,
  type FriendRequest,
  type FriendRequestsResponse,
} from "@/lib/friends";
import { useNotifications } from "@/components/NotificationProvider";

/** All three lists in one round trip. State-free on purpose — see `reload` below. */
function fetchLists(): Promise<[Friend[], FriendRequestsResponse, BlockedUser[]]> {
  return Promise.all([fetchFriends(), fetchFriendRequests(), fetchBlocked()]);
}

export default function FriendsPage() {
  const { onlineFriendIds, refresh } = useNotifications();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequestsResponse | null>(null);
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [searchLogin, setSearchLogin] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyLists = useCallback(
    ([f, r, b]: [Friend[], FriendRequestsResponse, BlockedUser[]]) => {
      setFriends(f);
      setRequests(r);
      setBlocked(b);
    },
    [],
  );

  /** Re-read both lists after an action. Effects use fetchLists + applyLists
   *  directly instead: an effect may not call a function that sets state. */
  const reload = useCallback(async () => {
    applyLists(await fetchLists());
  }, [applyLists]);

  useEffect(() => {
    let cancelled = false;
    fetchLists()
      .then((lists) => {
        if (!cancelled) applyLists(lists);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [applyLists]);

  // Listen for real-time events: friend request received / accepted / presence
  // change. The event payloads carry the full data (see NotificationProvider),
  // so they're applied to local state directly — reloading both REST lists on
  // every event was tripping the backend rate limiter (429s). Only
  // profile:update still reloads: its payload is just a userId, and profile
  // edits are rare.
  useEffect(() => {
    const handleFriendRequest = (e: Event) => {
      const request = (e as CustomEvent<{ request: FriendRequest }>).detail?.request;
      if (!request) return;
      setRequests((prev) =>
        prev ? { ...prev, incoming: [request, ...prev.incoming] } : prev,
      );
    };
    const handleFriendAccept = (e: Event) => {
      const friend = (e as CustomEvent<{ friend: Friend }>).detail?.friend;
      if (!friend) return;
      // Our outgoing request became a friendship: move it between sections.
      setFriends((prev) => (prev ? [friend, ...prev.filter((f) => f.id !== friend.id)] : prev));
      setRequests((prev) =>
        prev ? { ...prev, outgoing: prev.outgoing.filter((r) => r.login !== friend.login) } : prev,
      );
    };
    const handlePresence = (e: Event) => {
      const detail = (e as CustomEvent<{ userId: string; online: boolean }>).detail;
      if (!detail) return;
      setFriends((prev) =>
        prev ? prev.map((f) => (f.id === detail.userId ? { ...f, online: detail.online } : f)) : prev,
      );
    };
    const handleFriendReject = (e: Event) => {
      const requestId = (e as CustomEvent<{ requestId: number }>).detail?.requestId;
      if (typeof requestId !== "number") return;
      // They turned us down. The row is gone server-side; drop it here too so
      // the entry stops sitting in "Outgoing / PENDING" until a reload.
      setRequests((prev) =>
        prev ? { ...prev, outgoing: prev.outgoing.filter((r) => r.id !== requestId) } : prev,
      );
    };
    const handleProfileUpdate = () => { reload(); };

    window.addEventListener("friends:request", handleFriendRequest);
    window.addEventListener("friends:accept", handleFriendAccept);
    window.addEventListener("friends:reject", handleFriendReject);
    window.addEventListener("presence:update", handlePresence);
    window.addEventListener("profile:update", handleProfileUpdate);

    return () => {
      window.removeEventListener("friends:request", handleFriendRequest);
      window.removeEventListener("friends:accept", handleFriendAccept);
      window.removeEventListener("friends:reject", handleFriendReject);
      window.removeEventListener("presence:update", handlePresence);
      window.removeEventListener("profile:update", handleProfileUpdate);
    };
  }, [reload]);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    const login = searchLogin.trim();
    if (!login) return;
    setNotice(null);
    setError(null);
    try {
      const result = await sendFriendRequest(login);
      setNotice(result.message);
      setSearchLogin("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to send request");
    }
  }

  async function handleAccept(id: number) {
    try { await acceptFriendRequest(id); await reload(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
  }
  async function handleReject(id: number) {
    try { await rejectFriendRequest(id); await reload(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
  }
  async function handleUnfriend(login: string) {
    if (!confirm(`Unfriend ${login}?`)) return;
    try { await unfriend(login); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "failed"); }
  }

  async function handleBlock(login: string) {
    if (
      !confirm(
        `Block ${login}?\n\nThey will be removed from your friends, neither of you can message the other, and you will not see each other's lobbies.`,
      )
    ) {
      return;
    }
    setNotice(null);
    setError(null);
    // reload() covers all three lists at once: blocking ends the friendship
    // and any pending request, so friends, requests and blocked all move.
    try {
      const result = await blockUser(login);
      setNotice(result.message);
      await reload();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to block");
    }
  }

  async function handleUnblock(login: string) {
    setNotice(null);
    setError(null);
    try {
      const result = await unblockUser(login);
      setNotice(`${result.message} — you are not friends again, send a request to reconnect`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to unblock");
    }
  }

  // Online status: the REST response's flag is correct at fetch time, and
  // onlineFriendIds layers real-time presence on top. Union of the two —
  // going offline is handled by handlePresence flipping f.online to false
  // (and the Set dropping the id), so the union never pins someone online.
  const friendsWithOnline = friends?.map((f) => ({
    ...f,
    online: f.online || onlineFriendIds.has(f.id),
  })) ?? null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="mb-6 font-arcade text-xl text-neon-cyan">FRIENDS</h1>
      {notice && <p className="mb-4 font-mono text-xs text-neon-green">{notice}</p>}
      {error && <p className="mb-4 font-mono text-xs text-neon-red">{error}</p>}
      <form onSubmit={handleSendRequest} className="mb-8 flex gap-2">
        <input type="text" value={searchLogin} onChange={(e) => setSearchLogin(e.target.value)} placeholder="ENTER LOGIN TO ADD" className="min-w-0 flex-1 border border-arcade-border bg-arcade-bg px-3 py-1.5 font-mono text-xs text-foreground outline-none focus:border-neon-cyan" />
        <Button type="submit">ADD</Button>
      </form>
      {requests && (requests.incoming.length > 0 || requests.outgoing.length > 0) && (
        <div className="mb-8">
          <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">PENDING REQUESTS</h2>
          {requests.incoming.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 font-mono text-[10px] uppercase text-neon-yellow">Incoming ({requests.incoming.length})</p>
              {requests.incoming.map((req) => (
                <div key={req.id} className="mb-2 flex items-center gap-3 border border-arcade-border bg-arcade-card p-2">
                  <FriendAvatar login={req.login} avatarUrl={req.avatarUrl} size="sm" />
                  <span className="flex-1 font-mono text-xs">{req.login}</span>
                  <Button onClick={() => handleAccept(req.id)}>ACCEPT</Button>
                  <Button onClick={() => handleReject(req.id)}>REJECT</Button>
                  {/* Reject only clears this request — they can send another.
                      Block is the one that makes it stop. */}
                  <Button
                    onClick={() => handleBlock(req.login)}
                    className="border-neon-red/40 text-neon-red hover:border-neon-red hover:shadow-[0_0_8px_#ff004040]"
                  >
                    BLOCK
                  </Button>
                </div>
              ))}
            </div>
          )}
          {requests.outgoing.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase text-arcade-muted">Outgoing</p>
              {requests.outgoing.map((req) => (
                <div key={req.id} className="mb-2 flex items-center gap-3 border border-arcade-border bg-arcade-card p-2">
                  <FriendAvatar login={req.login} avatarUrl={req.avatarUrl} size="sm" />
                  <span className="flex-1 font-mono text-xs">{req.login}</span>
                  <span className="font-mono text-[10px] text-arcade-muted">PENDING</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div>
        <h2 className="mb-3 font-arcade text-[10px] text-arcade-muted">YOUR FRIENDS</h2>
        {friendsWithOnline === null ? (<p className="py-4 text-center font-mono text-xs text-arcade-muted animate-blink">LOADING...</p>) : friendsWithOnline.length === 0 ? (<p className="py-4 text-center font-mono text-xs text-arcade-muted">NO FRIENDS YET</p>) : (
          <ul className="flex flex-col gap-2">
            {friendsWithOnline.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 border border-arcade-border bg-arcade-card p-2">
                <div className="flex items-center gap-3">
                  <FriendAvatar login={f.login} avatarUrl={f.avatarUrl} online={f.online} size="sm" />
                  <div className="min-w-0 flex-1"><p className="truncate font-mono text-xs">{f.login}</p><p className="truncate font-mono text-[10px] text-arcade-muted">{f.displayName}</p></div>
                  <a href={`/profile/${f.login}`} className="font-mono text-[10px] text-neon-cyan hover:underline">PROFILE</a>
                  <a href={`/chat?peer=${f.login}`} className="font-mono text-[10px] text-neon-green hover:underline">MESSAGE</a>
                  <Button onClick={() => handleUnfriend(f.login)}>UNFRIEND</Button>
                  <Button
                    onClick={() => handleBlock(f.login)}
                    className="border-neon-red/40 text-neon-red hover:border-neon-red hover:shadow-[0_0_8px_#ff004040]"
                  >
                    BLOCK
                  </Button>
                </div>
                <div className="flex justify-around border-t border-arcade-border/50 pt-1">
                  <span className="font-mono text-[9px] text-arcade-muted">{f.stats?.gamesPlayed ?? 0} GAMES</span>
                  <span className="font-mono text-[9px] text-neon-green">{f.stats?.wins ?? 0}W</span>
                  <span className="font-mono text-[9px] text-neon-red">{f.stats?.losses ?? 0}L</span>
                  <span className="font-mono text-[9px] text-arcade-muted">{f.stats?.draws ?? 0}D</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Only rendered when non-empty: an always-visible "BLOCKED (0)" heading
          is noise for the overwhelming majority of accounts. */}
      {blocked && blocked.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 font-arcade text-[10px] text-neon-red">BLOCKED</h2>
          <p className="mb-3 font-mono text-[10px] text-arcade-muted">
            You cannot message each other, and neither of you sees the other&apos;s lobbies.
          </p>
          <ul className="flex flex-col gap-2">
            {blocked.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 border border-neon-red/30 bg-arcade-card p-2"
              >
                <FriendAvatar login={b.login} avatarUrl={b.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{b.login}</p>
                  <p className="truncate font-mono text-[10px] text-arcade-muted">
                    Blocked {new Date(b.blockedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button onClick={() => handleUnblock(b.login)}>UNBLOCK</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
