import { useState, useEffect, useCallback } from "react";
import type { EngineStatus } from "../lib/types";
import { checkHealth } from "../lib/api";

export function useEngine(): { status: EngineStatus } {
  const [status, setStatus] = useState<EngineStatus>("starting");

  const poll = useCallback(async () => {
    const ok = await checkHealth();
    setStatus(ok ? "ready" : "starting");
  }, []);

  useEffect(() => {
    poll();
    // Poll every 4s while starting, 10s once ready
    const interval = setInterval(poll, status === "ready" ? 10_000 : 4_000);
    return () => clearInterval(interval);
  }, [poll, status]);

  return { status };
}
