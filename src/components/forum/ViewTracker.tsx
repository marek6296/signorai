"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function ViewTracker({ threadId }: { threadId: string }) {
  useEffect(() => {
    void supabase.rpc("increment_forum_views", { thread_uuid: threadId });
  }, [threadId]);
  return null;
}
