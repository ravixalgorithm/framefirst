"use client";

import { CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";

import { scriptTagFor } from "../lib/config";
import { Button } from "./ui/button";

export function CopySnippetButton({ siteId }: { siteId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(scriptTagFor(siteId));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? (
        <>
          <CheckCircle2 size={16} className="mr-2" /> Copied
        </>
      ) : (
        <>
          <Copy size={16} className="mr-2" /> Snippet
        </>
      )}
    </Button>
  );
}
