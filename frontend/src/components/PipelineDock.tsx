import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getSubmission, type PipelineProgress } from "../lib/catalog";
import { usePipelineDock, type TrackedRun } from "../lib/pipelineDock";

export function PipelineDock() {
  const { tracked, toasts, dismissToast } = usePipelineDock();
  const [collapsed, setCollapsed] = useState(false);

  const hasRuns = tracked.length > 0;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[340px] max-w-[calc(100vw-2.5rem)] flex-col items-end gap-3">
      {/* Toasts */}
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            className={`pointer-events-auto flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === "success"
                ? "bg-emerald-600 text-white"
                : t.kind === "error"
                  ? "bg-terracotta text-white"
                  : "bg-ink text-cream"
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismissToast(t.id)} className="opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Running pipelines */}
      {hasRuns && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto w-full overflow-hidden rounded-2xl border border-black/5 bg-white shadow-2xl shadow-indigo-900/10"
        >
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2 border-b border-black/5 bg-cream-deep/60 px-4 py-3"
          >
            <Sparkles size={16} className="text-saffron-500" />
            <span className="text-sm font-semibold text-ink">
              Studio · {tracked.length} running
            </span>
            <span className="ml-auto text-ink-soft">
              {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </button>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                exit={{ height: 0 }}
                className="max-h-[60vh] overflow-y-auto"
              >
                {tracked.map((run) => (
                  <DockRunCard key={run.id} run={run} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function DockRunCard({ run }: { run: TrackedRun }) {
  const { untrack, notify } = usePipelineDock();
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [title, setTitle] = useState(run.title);
  const timer = useRef<number>(undefined);
  const notified = useRef(false);

  useEffect(() => {
    let stopped = false;
    async function tick() {
      try {
        const d = await getSubmission(run.id);
        if (stopped) return;
        setProgress(d.progress);
        const t = (d.listing?.title as string) || d.submission.title || run.title;
        setTitle(t);
        if (d.progress.done && !notified.current) {
          notified.current = true;
          notify(`"${t}" is ready to review.`, "success");
        }
        if (d.progress.failed && !notified.current) {
          notified.current = true;
          notify(`"${t}" failed to process.`, "error");
        }
        if (!d.progress.done && !d.progress.failed) {
          timer.current = window.setTimeout(tick, 2500);
        }
      } catch {
        if (!stopped) timer.current = window.setTimeout(tick, 4000);
      }
    }
    tick();
    return () => {
      stopped = true;
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.id]);

  const percent = progress?.percent ?? 0;
  const done = progress?.done ?? false;
  const failed = progress?.failed ?? false;
  const stageLabel =
    progress?.stages.find((s) => s.status === "running")?.label ??
    (done ? "Complete" : failed ? "Failed" : "Starting…");

  return (
    <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3 last:border-b-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          done ? "bg-emerald-600 text-white" : failed ? "bg-terracotta text-white" : "bg-indigo-50 text-indigo-700"
        }`}
      >
        {done ? <Check size={18} /> : failed ? <X size={18} /> : <Loader2 size={18} className="animate-spin" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
            <motion.div
              className={`h-full rounded-full ${failed ? "bg-terracotta" : "bg-gradient-to-r from-indigo-600 to-saffron-500"}`}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="w-8 text-right text-[11px] font-medium text-ink-soft">{percent}%</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-soft">{stageLabel}</p>
      </div>
      {(done || failed) && (
        <button onClick={() => untrack(run.id)} className="text-ink-soft hover:text-ink">
          <X size={15} />
        </button>
      )}
    </div>
  );
}
