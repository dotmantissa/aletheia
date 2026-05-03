"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { truncateAddress } from "@/lib/format";

interface CopyableTextProps {
  value: string;
  className?: string;
  head?: number;
  tail?: number;
}

export default function CopyableText({ value, className = "", head = 8, tail = 6 }: CopyableTextProps) {
  const { notify } = useToast();
  const [hovered, setHovered] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied to clipboard.", "success");
    } catch {
      notify("Clipboard was denied by this browser context.", "error");
    }
  }

  return (
    <span
      className={`group inline-flex items-center gap-2 ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="font-mono">{truncateAddress(value, head, tail)}</span>
      <button
        type="button"
        onClick={copy}
        className={`rounded-[4px] border border-[#1e1e1e] px-2 py-[2px] text-[10px] text-[#6b6560] transition-soft ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
      >
        Copy
      </button>
    </span>
  );
}
