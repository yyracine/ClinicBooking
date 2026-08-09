import { useEffect, useState } from "react";
import { useConvex } from "convex/react";

export type ConnectionStatus = "online" | "reconnecting" | "offline";

/**
 * Connection status of the app:
 * - "offline": the browser reports no network (`navigator.onLine` / offline
 *   event) — the user's internet is down.
 * - "reconnecting": the browser is online but the WebSocket to the Convex
 *   backend is not connected (server restart, Wi-Fi without internet…).
 *   Only reported after the client has connected at least once, so the brief
 *   "connecting" moment at app startup is not shown as a problem.
 * - "online": browser online and WebSocket connected (or state not yet known).
 */
export function useConnection(): ConnectionStatus {
  const convex = useConvex();
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [ws, setWs] = useState<"unknown" | "connected" | "reconnecting">(
    "unknown",
  );

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const apply = (state: {
      isWebSocketConnected: boolean;
      hasEverConnected: boolean;
    }) => {
      setWs(
        state.isWebSocketConnected
          ? "connected"
          : state.hasEverConnected
            ? "reconnecting"
            : "unknown",
      );
    };
    apply(convex.connectionState());
    return convex.subscribeToConnectionState(apply);
  }, [convex]);

  if (!browserOnline) return "offline";
  if (ws === "reconnecting") return "reconnecting";
  return "online";
}
