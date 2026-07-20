import { motion } from "framer-motion";
import { Building2, CheckCircle2, Coins, Layers, Loader2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { BarChart } from "../../components/BarChart";
import { getGrowth, type GrowthMetrics } from "../../lib/catalog";

export function AdminGrowth() {
  const [g, setG] = useState<GrowthMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGrowth()
      .then(setG)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !g) {
    return (
      <div className="flex items-center gap-2 text-ink-soft">
        <Loader2 className="animate-spin" size={18} /> Loading growth…
      </div>
    );
  }

  const stats = [
    { icon: Building2, label: "Businesses", value: g.total_sellers, hint: `+${g.new_sellers_7d} this week`, tone: "bg-indigo-50 text-indigo-700" },
    { icon: Layers, label: "Submissions", value: g.total_submissions, hint: "all-time", tone: "bg-saffron-300/40 text-saffron-600" },
    { icon: CheckCircle2, label: "Published", value: g.total_published, hint: "ready or live", tone: "bg-emerald-50 text-emerald-700" },
    { icon: Coins, label: "Tokens used", value: g.total_tokens, hint: "across platform", tone: "bg-indigo-50 text-indigo-700" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
          >
            <div className={`mb-4 inline-flex rounded-xl p-2.5 ${s.tone}`}>
              <s.icon size={20} />
            </div>
            <p className="font-display text-3xl font-semibold text-ink">{s.value.toLocaleString()}</p>
            <p className="text-sm text-ink-soft">{s.label}</p>
            <p className="mt-0.5 text-xs text-ink-soft/70">{s.hint}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="New businesses" subtitle="Signups per day (14d)">
          <BarChart
            data={g.signups_daily.map((d) => ({ label: d.date.slice(5), value: d.count }))}
            height={150}
          />
        </ChartCard>
        <ChartCard title="Submissions" subtitle="Products submitted per day (14d)">
          <BarChart
            data={g.submissions_daily.map((d) => ({ label: d.date.slice(5), value: d.count }))}
            height={150}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={18} className="text-indigo-700" />
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          <p className="text-xs text-ink-soft">{subtitle}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}
