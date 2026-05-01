"use client";

import { useState } from "react";

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function CopyButton({ value, label, className, size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      window.prompt("Copiá manualmente:", value);
    }
  }

  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 ${padding} font-medium text-white/75 transition hover:bg-white/10 hover:text-white ${className ?? ""}`}
      title={label ?? "Copiar"}
    >
      {copied ? "✓ copiado" : (label ?? "copiar")}
    </button>
  );
}
