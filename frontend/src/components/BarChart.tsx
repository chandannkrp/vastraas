import { motion } from "framer-motion";

export interface BarDatum {
  label: string;
  value: number;
}

/** Minimal, brand-consistent bar chart (indigo→saffron). Accessible labels. */
export function BarChart({
  data,
  height = 140,
  format = (n) => n.toLocaleString(),
}: {
  data: BarDatum[];
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          return (
            <div key={i} className="group flex flex-1 flex-col items-center justify-end">
              <div className="relative flex w-full flex-1 items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(h, d.value > 0 ? 4 : 0)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.02 }}
                  className="w-full rounded-t-md bg-gradient-to-t from-indigo-600 to-saffron-500"
                  title={`${d.label}: ${format(d.value)}`}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] font-medium text-cream opacity-0 transition group-hover:opacity-100">
                  {format(d.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-ink-soft/70">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
