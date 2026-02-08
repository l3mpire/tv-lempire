"use client";

import { memo } from "react";
import LinkedContent from "./LinkedContent";

type ChatMessageProps = {
  id: string;
  userName: string;
  time: string;
  content: string;
  isOwn: boolean;
  isAdmin: boolean;
  isBreakingNews?: boolean;
  onDelete: (id: string) => void;
};

export default memo(function ChatMessage({ id, userName, time, content, isOwn, isAdmin, isBreakingNews, onDelete }: ChatMessageProps) {
  return (
    <div className={`chat-message${isBreakingNews ? " chat-message-breaking" : ""}`}>
      <div className="chat-message-header">
        <span className={`chat-message-user${isBreakingNews ? " chat-message-user-bn" : ""}`}>
          {isBreakingNews ? "BREAKING NEWS" : userName}
        </span>
        <span className="chat-message-time">{time}</span>
        {(isOwn || isAdmin) && (
          <button
            className="chat-delete-btn"
            onClick={() => onDelete(id)}
            aria-label="Delete message"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="chat-message-content"><LinkedContent content={content} /></div>
    </div>
  );
});
