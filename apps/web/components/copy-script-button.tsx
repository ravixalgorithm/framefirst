"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyScriptButton({ scriptTag }: { scriptTag: string }) {
  const [copied, setCopied] = useState(false);

  async function copyScript() {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button className="button" type="button" onClick={copyScript}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      {copied ? "Copied" : "Copy script"}
    </button>
  );
}
