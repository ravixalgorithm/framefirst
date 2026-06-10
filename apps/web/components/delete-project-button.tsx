"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete ${projectName}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to delete project");
      }
      router.refresh();
    } catch (error: any) {
      alert("Delete failed: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Button 
      variant="destructive"
      size="sm"
      onClick={handleDelete} 
      disabled={isDeleting}
    >
      <Trash2 size={16} className="mr-2" /> {isDeleting ? "DELETING..." : "DELETE"}
    </Button>
  );
}
