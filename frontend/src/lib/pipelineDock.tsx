import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface TrackedRun {
  id: string;
  title: string;
}

export interface Toast {
  id: string;
  message: string;
  kind: "info" | "success" | "error";
}

interface DockState {
  tracked: TrackedRun[];
  track: (id: string, title: string) => void;
  untrack: (id: string) => void;
  toasts: Toast[];
  notify: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
}

const DockContext = createContext<DockState | undefined>(undefined);
const STORAGE_KEY = "vastra_tracked_runs";

export function PipelineDockProvider({ children }: { children: ReactNode }) {
  const [tracked, setTracked] = useState<TrackedRun[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracked));
  }, [tracked]);

  const track = useCallback((id: string, title: string) => {
    setTracked((prev) => (prev.some((t) => t.id === id) ? prev : [{ id, title }, ...prev]));
  }, []);

  const untrack = useCallback((id: string) => {
    setTracked((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, kind: Toast["kind"] = "info") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast],
  );

  const value = useMemo<DockState>(
    () => ({ tracked, track, untrack, toasts, notify, dismissToast }),
    [tracked, toasts, track, untrack, notify, dismissToast],
  );

  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePipelineDock(): DockState {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error("usePipelineDock must be used within PipelineDockProvider");
  return ctx;
}
