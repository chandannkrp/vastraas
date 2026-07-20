import { motion } from "framer-motion";
import { Coins, Loader2, Plus, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { BarChart } from "../../components/BarChart";
import { getTokenSummary, topUpTokens, type TokenSummary } from "../../lib/catalog";
import { usePipelineDock } from "../../lib/pipelineDock";

const PACKS = [
  { label: "Starter", tokens: 100_000, price: "₹499" },
  { label: "Studio", tokens: 500_000, price: "₹1,999" },
  { label: "Scale", tokens: 2_000_000, price: "₹6,999" },
];

export function Tokens() {
  const [summary, setSummary] = useState<TokenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const { notify } = usePipelineDock();

  useEffect(() => {
    getTokenSummary()
      .then(setSummary)
      .finally(() => setLoading(false));
  }, []);

  async function buy(amount: number) {
    setBusy(true);
    try {
      const s = await topUpTokens(amount);
      setSummary(s);
      notify(`Added ${amount.toLocaleString()} tokens to your balance.`, "success");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !summary) {
    return (
      <div className="flex items-center gap-2 text-ink-soft">
        <Loader2 className="animate-spin" size={18} /> Loading usage…
      </div>
    );
  }

  const chartData = summary.daily.map((d) => ({
    label: d.date.slice(5),
    value: d.tokens,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-semibold text-ink">Tokens & usage</h2>
        <p className="text-ink-soft">Every product run spends tokens on the AI agents. Top up any time.</p>
      </div>

      {/* Balance */}
      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm"
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
                <Coins size={20} />
              </div>
              <h3 className="font-semibold text-ink">Balance</h3>
            </div>
            <span className="text-sm font-medium text-ink-soft">
              {summary.percent_used}% used
            </span>
          </div>

          <p className="font-display text-4xl font-semibold text-ink">
            {summary.remaining.toLocaleString()}
            <span className="ml-2 text-lg font-normal text-ink-soft">
              / {summary.limit.toLocaleString()} left
            </span>
          </p>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-cream-deep">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-saffron-500"
              initial={{ width: 0 }}
              animate={{ width: `${summary.percent_used}%` }}
              transition={{ duration: 0.7 }}
            />
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            {summary.used.toLocaleString()} tokens used so far
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm"
        >
          <h3 className="mb-1 font-semibold text-ink">Last 14 days</h3>
          <p className="mb-4 text-sm text-ink-soft">Token consumption per day</p>
          <BarChart data={chartData} height={120} />
        </motion.div>
      </div>

      {/* Top-up packs */}
      <div>
        <h3 className="mb-4 font-semibold text-ink">Top up</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {PACKS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
            >
              <div className="mb-3 inline-flex rounded-lg bg-saffron-300/40 p-2 text-saffron-600">
                <Zap size={18} />
              </div>
              <p className="font-semibold text-ink">{p.label}</p>
              <p className="font-display text-2xl font-semibold text-ink">{p.price}</p>
              <p className="text-sm text-ink-soft">{p.tokens.toLocaleString()} tokens</p>
              <button
                disabled={busy}
                onClick={() => buy(p.tokens)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-indigo-800 disabled:opacity-60"
              >
                <Plus size={15} /> Add tokens
              </button>
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">
          Demo billing — top-up adds tokens instantly without payment.
        </p>
      </div>
    </div>
  );
}
