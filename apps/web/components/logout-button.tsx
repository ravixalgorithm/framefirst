"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "./ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button 
      disabled={loading} 
      onClick={logout} 
      className="group/navitem dock-wrapper flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all focus:outline-none text-muted-foreground font-medium hover:bg-slate-200/50 hover:text-foreground w-full"
    >
      <LogOut size={18} aria-hidden="true" className="flex-shrink-0 dock-icon" />
      <span className="transition-opacity duration-200 group-[.collapsed]/sidebar:opacity-0">{loading ? "Logging out..." : "Logout"}</span>
    </button>
  );
}
