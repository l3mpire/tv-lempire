"use client";

import { memo } from "react";

type ChatMessageProps = {
  id: string;
  userName: string;
  time: string;
  content: string;
  isOwn: boolean;
  isAdmin: boolean;
  onDelete: (id: string) => void;
};

export default memo(function ChatMessage({ id, userName, time, content, isOwn, isAdmin, onDelete }: ChatMessageProps) {
  return (
    <div className="chat-message">
      <div className="chat-message-header">
        <span className="chat-message-user">{userName}</span>
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
      <div className="chat-message-content">{content}</div>
    </div>
  );
});
