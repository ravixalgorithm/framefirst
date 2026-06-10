"use client";

import { Folder, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { CreateProjectForm } from "./create-project-form";

import { Button } from "./ui/button";

export function NewProjectModal() {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Folder size={16} aria-hidden="true" className="mr-2" />
        New Project
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            className="bg-background border shadow-lg rounded-xl w-full max-w-lg p-6 sm:rounded-2xl"
            role="dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 id={titleId} className="text-xl font-bold tracking-tight">Create new project</h2>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={20} aria-hidden="true" />
              </Button>
            </div>
            <CreateProjectForm />
          </section>
        </div>
      ) : null}
    </>
  );
}
