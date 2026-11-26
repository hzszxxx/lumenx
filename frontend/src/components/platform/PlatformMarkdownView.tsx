"use client";

import React from "react";
import { FileText } from "lucide-react";

interface PlatformMarkdownViewProps {
  content?: string | null;
  className?: string;
}

export default function PlatformMarkdownView({
  content,
  className = "",
}: PlatformMarkdownViewProps) {
  if (!content) return null;

  // 1. Normalize escaped newlines and line breaks
  const rawNormalized = content
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n");

  const lines = rawNormalized.split("\n");

  // Helper to parse simple bold text **bold**
  const renderInlineFormatted = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const blocks: React.ReactNode[] = [];
  let currentListItems: React.ReactNode[] = [];
  let currentListType: "ordered" | "unordered" | null = null;

  const flushList = () => {
    if (currentListItems.length > 0) {
      if (currentListType === "ordered") {
        blocks.push(
          <div key={`list-${blocks.length}`} className="my-2.5 space-y-2">
            {currentListItems}
          </div>
        );
      } else {
        blocks.push(
          <div key={`list-${blocks.length}`} className="my-2.5 space-y-1.5">
            {currentListItems}
          </div>
        );
      }
      currentListItems = [];
      currentListType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    // Heading: ### or ## or #
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const title = headingMatch[2];
      blocks.push(
        <div
          key={`heading-${index}`}
          className={`font-bold flex items-center gap-2 ${
            level <= 2
              ? "text-sm mt-4 mb-2 pt-2 border-t border-glass-border/40 text-foreground"
              : "text-xs mt-3 mb-1.5 text-primary"
          }`}
        >
          <FileText size={13} className="text-primary shrink-0" />
          <span>{renderInlineFormatted(title)}</span>
        </div>
      );
      return;
    }

    // Numbered list item: 1. or 2.
    const numberedMatch = trimmed.match(/^(\d+)[.)、]\s*(.+)$/);
    if (numberedMatch) {
      if (currentListType !== "ordered") flushList();
      currentListType = "ordered";
      const num = numberedMatch[1];
      const itemContent = numberedMatch[2];
      currentListItems.push(
        <div
          key={`ol-${index}`}
          className="flex items-start gap-2.5 text-xs text-text-secondary leading-relaxed bg-surface/50 p-2 rounded-xl border border-glass-border/40 shadow-xs"
        >
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-lg bg-primary/15 text-primary font-bold text-[11px] mt-0.5">
            {num}
          </span>
          <div className="flex-1 pt-0.5">{renderInlineFormatted(itemContent)}</div>
        </div>
      );
      return;
    }

    // Bullet list item: - or *
    const bulletMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (currentListType !== "unordered") flushList();
      currentListType = "unordered";
      const itemContent = bulletMatch[1];
      currentListItems.push(
        <div
          key={`ul-${index}`}
          className="flex items-start gap-2 text-xs text-text-secondary leading-relaxed"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
          <div className="flex-1">{renderInlineFormatted(itemContent)}</div>
        </div>
      );
      return;
    }

    // Regular paragraph
    flushList();
    blocks.push(
      <p key={`p-${index}`} className="text-xs text-text-secondary leading-relaxed my-1">
        {renderInlineFormatted(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className={`platform-markdown-view space-y-1 ${className}`}>{blocks}</div>;
}
