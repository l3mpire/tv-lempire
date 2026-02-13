"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getSupabaseBrowser } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import Tooltip from "@/app/Tooltip";
import type { ProductConfig, Config } from "@/lib/types";

const PRODUCTS = [
  { key: "lemlist", label: "lemlist" },
  { key: "lemwarm", label: "lemwarm" },
  { key: "lemcal", label: "lemcal" },
  { key: "claap", label: "Claap" },
  { key: "taplio", label: "Taplio" },
  { key: "tweethunter", label: "Tweet Hunter" },
] as const;

type ProductKey = (typeof PRODUCTS)[number]["key"];

const GROUPS = [
  {
    name: "Sales Engagement",
    products: ["lemlist", "lemwarm", "lemcal"] as ProductKey[],
  },
  {
    name: "Conversation Intelligence",
    products: ["claap"] as ProductKey[],
  },
  {
    name: "Social Selling",
    products: ["taplio", "tweethunter"] as ProductKey[],
  },
];

function formatCurrency(value: number): string {
  return "$" + Math.round(value).toLocaleString("en-US");
}

function formatPercent(value: number, decimals = 1): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type User = {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  verified: boolean;
  last_online: string | null;
  created_at: string;
};

type Video = {
  id: number;
  youtube_id: string;
  title: string;
  position: number;
  tv_enabled: boolean;
};

function SortableVideoRow({
  video,
  onRemove,
  onToggleTV,
  onPlayNow,
  onFetchTitle,
}: {
  video: Video;
  onRemove: (id: number) => void;
  onToggleTV: (id: number, enabled: boolean) => void;
  onPlayNow: (youtubeId: string) => void;
  onFetchTitle: (id: number) => void;
}) {
  const [playSent, setPlaySent] = useState(false);
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePlayNow = () => {
    onPlayNow(video.youtube_id);
    setPlaySent(true);
    setTimeout(() => setPlaySent(false), 1500);
  };

  const handleFetchTitle = async () => {
    setFetchingTitle(true);
    await onFetchTitle(video.id);
    setFetchingTitle(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between bg-zinc-900/50 rounded p-3"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-zinc-300 px-1 touch-none flex-shrink-0"
          aria-label="Drag to reorder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="4" y="2" width="8" height="1.5" rx="0.75" />
            <rect x="4" y="5.5" width="8" height="1.5" rx="0.75" />
            <rect x="4" y="9" width="8" height="1.5" rx="0.75" />
            <rect x="4" y="12.5" width="8" height="1.5" rx="0.75" />
          </svg>
        </button>
        <img
          src={`https://img.youtube.com/vi/${video.youtube_id}/default.jpg`}
          alt=""
          className="w-20 h-15 rounded object-cover flex-shrink-0"
        />
        <div className="flex items-center gap-2 min-w-0">
          {video.title ? (
            <span className="text-zinc-200 text-sm truncate" title={video.title}>{video.title}</span>
          ) : (
            <button
              onClick={handleFetchTitle}
              disabled={fetchingTitle}
              className="px-2 py-0.5 rounded text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700"
            >
              {fetchingTitle ? "..." : "Get title"}
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Tooltip label="Force play on all /?tv screens">
          <button
            onClick={handlePlayNow}
            disabled={playSent}
            className={`px-2 py-1 rounded text-xs cursor-pointer transition-all border ${
              playSent
                ? "bg-green-900 text-green-300 border-green-700 scale-95"
                : "bg-green-950 text-green-400 border-green-800 hover:bg-green-900 active:scale-95"
            }`}
          >
            {playSent ? "Sent ✓" : "Play now"}
          </button>
        </Tooltip>
        <Tooltip label={video.tv_enabled ? "Shown on /?tv screens" : "Hidden on /?tv screens"}>
          <button
            onClick={() => onToggleTV(video.id, !video.tv_enabled)}
            className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors border ${
              video.tv_enabled
                ? "bg-blue-950 text-blue-400 border-blue-800 hover:bg-blue-900"
                : "bg-zinc-900 text-zinc-500 border-zinc-700 hover:bg-zinc-800"
            }`}
          >
            TV
          </button>
        </Tooltip>
        <button
          onClick={() => onRemove(video.id)}
          className="px-3 py-1 rounded text-sm cursor-pointer transition-colors bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-800"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);
  const [addingVideo, setAddingVideo] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [refreshResult, setRefreshResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const videosChannelRef = useRef<RealtimeChannel | null>(null);
  const chatChannelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const videosChannel = supabase.channel("videos");
    videosChannel.subscribe();
    videosChannelRef.current = videosChannel;
    const chatChannel = supabase.channel("chat");
    chatChannel.subscribe();
    chatChannelRef.current = chatChannel;
    return () => {
      supabase.removeChannel(videosChannel);
      supabase.removeChannel(chatChannel);
    };
  }, []);

  const broadcastVideosChanged = useCallback(() => {
    videosChannelRef.current?.send({ type: "broadcast", event: "videos_changed", payload: {} });
  }, []);

  const broadcastUsersChanged = useCallback(() => {
    chatChannelRef.current?.send({ type: "broadcast", event: "users_changed", payload: {} });
  }, []);

  const broadcastPlayNow = useCallback((youtubeId: string) => {
    videosChannelRef.current?.send({ type: "broadcast", event: "play_now", payload: { youtube_id: youtubeId } });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const reorderVideos = useCallback(async (reordered: Video[]) => {
    const previous = videos;
    setVideos(reordered);

    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((v) => v.id) }),
      });

      if (!res.ok) {
        setVideos(previous);
        console.error("Failed to reorder videos");
      } else {
        broadcastVideosChanged();
      }
    } catch (e) {
      setVideos(previous);
      console.error("Failed to reorder videos:", e);
    }
  }, [videos, broadcastVideosChanged]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = videos.findIndex((v) => v.id === active.id);
    const newIndex = videos.findIndex((v) => v.id === over.id);
    const reordered = arrayMove(videos, oldIndex, newIndex);
    reorderVideos(reordered);
  }

  async function toggleTVEnabled(id: number, tv_enabled: boolean) {
    const previous = videos;
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, tv_enabled } : v)));

    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tv_enabled }),
      });
      if (!res.ok) {
        setVideos(previous);
        console.error("Failed to toggle TV mode");
      } else {
        broadcastVideosChanged();
      }
    } catch (e) {
      setVideos(previous);
      console.error("Failed to toggle TV mode:", e);
    }
  }

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (data.users) setUsers(data.users);
    } catch (e) {
      console.error("Failed to fetch users:", e);
    }
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.user) setCurrentUserId(data.user.id);
    } catch (e) {
      console.error("Failed to fetch current user:", e);
    }
  }

  async function patchUser(userId: string, patch: Record<string, unknown>) {
    setTogglingUser(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...patch }),
      });
      if (res.ok) {
        await fetchUsers();
        broadcastUsersChanged();
      } else {
        const data = await res.json();
        console.error("Failed to update user:", data.error);
      }
    } catch (e) {
      console.error("Failed to update user:", e);
    }
    setTogglingUser(null);
  }

  async function deleteUser(userId: string, userName: string) {
    if (!confirm(`Delete ${userName} and all their messages?`)) return;
    setTogglingUser(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        await fetchUsers();
        broadcastUsersChanged();
      } else {
        const data = await res.json();
        console.error("Failed to delete user:", data.error);
      }
    } catch (e) {
      console.error("Failed to delete user:", e);
    }
    setTogglingUser(null);
  }

  async function resendVerificationEmail(userId: string) {
    setResendingEmail(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, resendVerification: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to resend verification email:", data.error);
      }
    } catch (e) {
      console.error("Failed to resend verification email:", e);
    }
    setResendingEmail(null);
  }

  async function fetchVideos() {
    try {
      const res = await fetch("/api/videos");
      const data = await res.json();
      if (data.videos) setVideos(data.videos);
    } catch (e) {
      console.error("Failed to fetch videos:", e);
    }
  }

  async function addVideo() {
    if (!videoUrl.trim()) return;
    setAddingVideo(true);
    setVideoError(null);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVideoError(data.error || "Failed to add video");
      } else {
        setVideoUrl("");
        await fetchVideos();
        broadcastVideosChanged();
      }
    } catch (e) {
      console.error("Failed to add video:", e);
      setVideoError("Failed to add video");
    }
    setAddingVideo(false);
  }

  async function fetchVideoTitle(id: number) {
    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fetch_title: true }),
      });
      const data = await res.json();
      if (res.ok && data.videos) {
        setVideos(data.videos);
        broadcastVideosChanged();
      }
    } catch (e) {
      console.error("Failed to fetch video title:", e);
    }
  }

  async function removeVideo(id: number) {
    try {
      const res = await fetch("/api/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchVideos();
        broadcastVideosChanged();
      }
    } catch (e) {
      console.error("Failed to remove video:", e);
    }
  }

  async function fetchConfig() {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error("Failed to fetch config:", e);
    }
  }

  async function refreshFromHolistics() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await fetch("/api/cron/refresh-holistics", {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setRefreshResult({ type: "error", message: data.error || "Sync failed" });
      } else if (data.config) {
        setConfig(data.config as Config);
        setRefreshResult({ type: "success", message: `Synced ${data.updated ?? ""} products from Holistics` });
      } else {
        await fetchConfig();
        setRefreshResult({ type: "success", message: "Sync completed" });
      }
    } catch (e) {
      setRefreshResult({ type: "error", message: "Network error — could not reach Holistics" });
    }
    setRefreshing(false);
  }

  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchUsers(), fetchCurrentUser(), fetchVideos()])
      .finally(() => setLoading(false));
  }, []);

  const sortedUsers = useMemo(() =>
    [...users].sort((a, b) => {
      if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? 1 : -1;
      return a.name.localeCompare(b.name);
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    if (!userSearch) return sortedUsers;
    const q = userSearch.toLowerCase();
    return sortedUsers.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [sortedUsers, userSearch]);

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <span className="text-zinc-500">Loading...</span>
      </div>
    );
  }

  // Calculate totals
  const totalARR = PRODUCTS.reduce((sum, p) => sum + config[p.key].arr, 0);
  const totalMonthGrowth = PRODUCTS.reduce((sum, p) => sum + config[p.key].monthGrowth, 0);
  const totalPrevARR = totalARR - totalMonthGrowth;
  const totalMoM = totalPrevARR > 0 ? (totalMonthGrowth / totalPrevARR) * 100 : 0;
  const totalYoY = (Math.pow(1 + totalMoM / 100, 12) - 1) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm">
              Last Holistics sync:{" "}
              {new Date(config.lemlist.updatedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <button
              onClick={refreshFromHolistics}
              disabled={refreshing}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed rounded text-sm transition-colors flex items-center gap-2"
            >
              {refreshing && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              {refreshing ? "Syncing..." : "Sync from Holistics"}
            </button>
          </div>
        </div>

        {refreshResult && (
          <div
            className={`mb-6 px-4 py-3 rounded text-sm ${
              refreshResult.type === "error"
                ? "bg-red-950/50 text-red-400 border border-red-800"
                : "bg-green-950/50 text-green-400 border border-green-800"
            }`}
          >
            {refreshResult.type === "error" ? "Sync failed: " : ""}{refreshResult.message}
          </div>
        )}

        {/* USERS */}
        <div className="border border-zinc-800 rounded-lg p-6 mb-8" style={{ contain: 'content' }}>
          <h2 className="text-lg font-semibold mb-4 text-zinc-200">Users <span className="ml-2 px-2 py-0.5 text-xs font-mono font-normal text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full">{users.length}</span></h2>
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full px-3 py-2 mb-4 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          {userSearch && (
            <div className="text-zinc-500 text-xs mb-2 font-mono">
              {filteredUsers.length} / {users.length} users
            </div>
          )}
          {users.length === 0 ? (
            <span className="text-zinc-500">Loading users...</span>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between bg-zinc-900/50 rounded p-3"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-zinc-200 font-medium">{user.name}</span>
                      <span className="text-zinc-500 text-sm ml-2">{user.email}</span>
                      <span className="text-zinc-600 text-xs ml-2" title={user.last_online ?? "never"}>
                        {timeAgo(user.last_online)}
                      </span>
                    </div>
                    {user.is_admin && (
                      <span className="text-xs bg-amber-900/50 text-amber-400 border border-amber-800 px-2 py-0.5 rounded">
                        admin
                      </span>
                    )}
                    {!user.verified && (
                      <span className="text-xs bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                        unverified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!user.verified && (
                      <>
                        <button
                          onClick={() => resendVerificationEmail(user.id)}
                          disabled={resendingEmail === user.id || togglingUser === user.id}
                          className="px-3 py-1 rounded text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                        >
                          {resendingEmail === user.id ? "Sending..." : "Resend email"}
                        </button>
                        <button
                          onClick={() => patchUser(user.id, { verified: true })}
                          disabled={togglingUser === user.id}
                          className="px-3 py-1 rounded text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-950 hover:bg-blue-900 text-blue-400 border border-blue-800"
                        >
                          Verify
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => patchUser(user.id, { isAdmin: !user.is_admin })}
                      disabled={togglingUser === user.id || user.id === currentUserId}
                      className={`px-3 py-1 rounded text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        user.is_admin
                          ? "bg-red-950 hover:bg-red-900 text-red-400 border border-red-800"
                          : "bg-green-950 hover:bg-green-900 text-green-400 border border-green-800"
                      }`}
                      title={user.id === currentUserId ? "Cannot change your own role" : undefined}
                    >
                      {user.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                    {user.id !== currentUserId && (
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        disabled={togglingUser === user.id}
                        className="px-3 py-1 rounded text-sm cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-800"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BACKGROUND VIDEOS */}
        <div className="border border-zinc-800 rounded-lg p-6 mb-8" style={{ contain: 'content' }}>
          <h2 className="text-lg font-semibold mb-4 text-zinc-200">Background Videos <span className="ml-2 px-2 py-0.5 text-xs font-mono font-normal text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-full">{videos.length}</span></h2>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => { setVideoUrl(e.target.value); setVideoError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") addVideo(); }}
              placeholder="YouTube URL or video ID"
              className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={addVideo}
              disabled={addingVideo || !videoUrl.trim()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed rounded text-sm transition-colors"
            >
              {addingVideo ? "Adding..." : "Add"}
            </button>
          </div>

          {videoError && (
            <div className="text-red-400 text-sm mb-4">{videoError}</div>
          )}

          <div className="max-h-[600px] overflow-y-auto">
            {videos.length === 0 ? (
              <p className="text-zinc-500 text-sm">No videos configured. Default video will be used.</p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={videos.map((v) => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {videos.map((video) => (
                      <SortableVideoRow
                        key={video.id}
                        video={video}
                        onRemove={removeVideo}
                        onToggleTV={toggleTVEnabled}
                        onPlayNow={broadcastPlayNow}
                        onFetchTitle={fetchVideoTitle}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* TOTAL */}
        <div className="border border-green-900 bg-green-950/30 rounded-lg p-6 mb-8" style={{ contain: 'content' }}>
          <h2 className="text-lg font-semibold mb-4 text-green-400">
            Total lempire
          </h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-3xl font-bold text-white mb-2">
                {formatCurrency(totalARR)}
              </div>
              <div className="text-green-400 font-mono">
                {formatCurrency(totalMonthGrowth)} ({formatPercent(totalMoM)} MoM · {formatPercent(totalYoY, 0)} YoY)
              </div>
            </div>
            <div className="text-sm text-zinc-400 font-mono space-y-1">
              <div>Current ARR: {formatCurrency(totalARR)}</div>
              <div>Previous ARR: {formatCurrency(totalPrevARR)}</div>
              <div>Month Growth: {formatCurrency(totalMonthGrowth)}</div>
              <div>MoM: {totalMonthGrowth.toFixed(2)} / {totalPrevARR.toFixed(2)} = {formatPercent(totalMoM)}</div>
              <div>YoY: (1 + {(totalMoM / 100).toFixed(4)})^12 - 1 = {formatPercent(totalYoY)}</div>
            </div>
          </div>
        </div>

        {/* GROUPS */}
        {GROUPS.map((group) => {
          const groupARR = group.products.reduce((sum, p) => sum + config[p].arr, 0);
          const groupMonthGrowth = group.products.reduce((sum, p) => sum + config[p].monthGrowth, 0);
          const groupPrevARR = groupARR - groupMonthGrowth;
          const groupMoM = groupPrevARR > 0 ? (groupMonthGrowth / groupPrevARR) * 100 : 0;
          const groupYoY = (Math.pow(1 + groupMoM / 100, 12) - 1) * 100;

          return (
            <div key={group.name} className="border border-zinc-800 rounded-lg p-6 mb-6" style={{ contain: 'content' }}>
              <h2 className="text-lg font-semibold mb-4 text-zinc-200">
                {group.name}
              </h2>

              {/* Group total */}
              <div className="bg-zinc-900/50 rounded p-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xl font-bold text-white">
                      {formatCurrency(groupARR)}
                    </div>
                    <div className={`font-mono text-sm ${groupMonthGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatCurrency(groupMonthGrowth)} ({formatPercent(groupMoM)} MoM · {formatPercent(groupYoY, 0)} YoY)
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 font-mono text-right space-y-0.5">
                    <div>Sum of: {group.products.join(" + ")}</div>
                    <div>Prev: {formatCurrency(groupPrevARR)}</div>
                  </div>
                </div>
              </div>

              {/* Individual products */}
              <div className="space-y-3">
                {group.products.map((productKey) => {
                  const p = config[productKey];
                  const prevARR = p.arr - p.monthGrowth;
                  const mom = prevARR > 0 ? (p.monthGrowth / prevARR) * 100 : 0;
                  const yoy = (Math.pow(1 + mom / 100, 12) - 1) * 100;
                  const perSec = (p.arr * p.growth) / (365.25 * 24 * 3600);

                  const product = PRODUCTS.find((x) => x.key === productKey)!;

                  return (
                    <div
                      key={productKey}
                      className="border border-zinc-800 rounded p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium text-zinc-300">
                            {product.label}
                          </div>
                          <div className="text-lg font-bold text-white">
                            {formatCurrency(p.arr)}
                          </div>
                          <div
                            className={`font-mono text-sm ${
                              p.monthGrowth >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {formatCurrency(p.monthGrowth)} ({formatPercent(mom)} MoM · {formatPercent(yoy, 0)} YoY)
                          </div>
                        </div>
                      </div>

                      <details className="bg-zinc-900 rounded font-mono text-xs text-zinc-500">
                        <summary className="p-3 cursor-pointer text-zinc-400 font-semibold hover:text-zinc-300 select-none">Calculation details</summary>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1 px-3 pb-3">
                          <div>Current ARR (Feb):</div>
                          <div className="text-zinc-300">{formatCurrency(p.arr)}</div>

                          <div>Previous ARR (Jan):</div>
                          <div className="text-zinc-300">{formatCurrency(prevARR)}</div>

                          <div>Month Growth:</div>
                          <div className="text-zinc-300">
                            {formatCurrency(p.arr)} - {formatCurrency(prevARR)} = {formatCurrency(p.monthGrowth)}
                          </div>

                          <div>MoM %:</div>
                          <div className="text-zinc-300">
                            {p.monthGrowth.toFixed(2)} / {prevARR.toFixed(2)} = {formatPercent(mom)}
                          </div>

                          <div>YoY % (annualized):</div>
                          <div className="text-zinc-300">
                            (1 + {(mom / 100).toFixed(4)})^12 - 1 = {formatPercent(yoy)}
                          </div>

                          <div>Ticker growth rate:</div>
                          <div className="text-zinc-300">{(p.growth * 100).toFixed(1)}% / year</div>

                          <div>Ticker speed:</div>
                          <div className="text-zinc-300">${perSec.toFixed(4)} / second</div>

                          <div>Last updated:</div>
                          <div className="text-zinc-300">{new Date(p.updatedAt).toLocaleString()}</div>
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="mt-8 pt-8 border-t border-zinc-800 flex gap-4">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            Open Dashboard
          </a>
          <a
            href="/api/config"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors"
          >
            View Raw API Response
          </a>
        </div>
      </div>
    </div>
  );
}
