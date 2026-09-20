"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/**
 * A floating chat button that sits at the bottom-right of the viewport.
 * It provides a quick way for users to start a conversation.
 */
export function ChatButton() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <a
      href="/en/app"
      className="chat-button"
      aria-label="Chat with us"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
    >
      <span className="chat-button-icon">
        <Icon name="chat" />
      </span>
      <span className={`chat-button-label${isHovered ? " chat-button-label--visible" : ""}`}>
        Chat with us
      </span>
      <span className="chat-button-pulse" aria-hidden="true" />
    </a>
  );
}
