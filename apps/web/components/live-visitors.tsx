"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";

export function LiveVisitors({ siteId }: { siteId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const eventSource = new EventSource(`/api/live/${siteId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === "number") {
          setCount(data.count);
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      eventSource.close();
    };
  }, [siteId]);

  return (
    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-500">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600 dark:bg-emerald-500"></span>
      </span>
      {count} live views
    </div>
  );
}
