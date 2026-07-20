import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "../../components/StatusBadge";
import {
  getBusinessDetail,
  getBusinesses,
  type BusinessDetail,
  type BusinessRow,
} from "../../lib/catalog";

export function AdminBusinesses() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    getBusinesses()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-soft">
        <Loader2 className="animate-spin" size={18} /> Loading businesses…
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Registered businesses</h2>
      <p className="mb-6 text-ink-soft">{rows.length} accounts · click a row for logs & usage</p>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-ink-soft">
                <th className="px-5 py-3 font-semibold">Business</th>
                <th className="px-5 py-3 font-semibold">Products</th>
                <th className="px-5 py-3 font-semibold">Published</th>
                <th className="px-5 py-3 font-semibold">Tokens</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.token_limit ? Math.round((r.tokens_used / r.token_limit) * 100) : 0;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className="cursor-pointer border-b border-black/5 transition last:border-0 hover:bg-cream-deep/40"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{r.name}</span>
                        {r.is_admin && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            admin
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-ink-soft">{r.email}</span>
                    </td>
                    <td className="px-5 py-3 text-ink">{r.submissions}</td>
                    <td className="px-5 py-3 text-ink">{r.published}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-cream-deep">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-saffron-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-soft">
                          {(r.tokens_used / 1000).toFixed(0)}k / {(r.token_limit / 1000).toFixed(0)}k
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-ink-soft">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selected && <BusinessDrawer id={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function BusinessDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<BusinessDetail | null>(null);

  useEffect(() => {
    getBusinessDetail(id).then(setDetail);
  }, [id]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex justify-end bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        exit={{ x: 400 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md overflow-y-auto bg-cream p-6 shadow-2xl"
      >
        {!detail ? (
          <div className="flex items-center gap-2 text-ink-soft">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="font-display text-2xl font-semibold text-ink">{detail.business.name}</h3>
                <p className="text-sm text-ink-soft">{detail.business.email}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-1 text-ink-soft hover:bg-black/5">
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-3">
              <MiniStat label="Products" value={detail.business.submissions} />
              <MiniStat label="Published" value={detail.business.published} />
              <MiniStat label="Tokens" value={`${(detail.business.tokens_used / 1000).toFixed(0)}k`} />
            </div>

            <h4 className="mb-3 font-semibold text-ink">Activity log</h4>
            <div className="space-y-2">
              {detail.logs.length === 0 && <p className="text-sm text-ink-soft">No activity yet.</p>}
              {detail.logs.map((log) => (
                <div
                  key={log.submission_id}
                  className="flex items-center gap-3 rounded-xl border border-black/5 bg-white p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{log.title || "Untitled"}</p>
                    <p className="text-xs text-ink-soft">
                      {log.tokens.toLocaleString()} tokens · {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={log.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white p-3 text-center">
      <p className="font-display text-xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}
