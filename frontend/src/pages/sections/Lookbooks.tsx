import { motion } from "framer-motion";
import { BookOpen, Sparkles, Wand2 } from "lucide-react";
import { usePipelineDock } from "../../lib/pipelineDock";

const IDEAS = [
  { title: "Festive Edit", desc: "Silks & brocades styled for wedding season buyers.", tone: "from-rose-200 to-amber-200" },
  { title: "Summer Linens", desc: "Breathable cottons and linens for boutique lines.", tone: "from-emerald-200 to-cyan-200" },
  { title: "Heritage Weaves", desc: "Handloom stories for the conscious designer.", tone: "from-indigo-200 to-fuchsia-200" },
];

export function Lookbooks() {
  const { notify } = usePipelineDock();
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Lookbooks & selling ideas</h2>
          <p className="text-ink-soft">
            Turn your catalogue into shoppable stories — auto-generated and on-brand.
          </p>
        </div>
        <button
          onClick={() => notify("Lookbook studio is coming in the next release.", "info")}
          className="inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-indigo-800"
        >
          <Wand2 size={16} /> Generate lookbook
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {IDEAS.map((idea, i) => (
          <motion.div
            key={idea.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm"
          >
            <div className={`flex h-40 items-center justify-center bg-gradient-to-br ${idea.tone}`}>
              <BookOpen className="text-ink/40" size={40} />
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-ink">{idea.title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{idea.desc}</p>
              <button
                onClick={() => notify(`"${idea.title}" lookbook — coming soon.`, "info")}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:underline"
              >
                <Sparkles size={14} /> Preview idea
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="rounded-3xl border border-dashed border-black/10 bg-cream-deep/40 px-6 py-8 text-center text-ink-soft">
        Full lookbook studio — pick products, choose a theme, and get a ready-to-share
        lookbook with AI copy — arrives in the next release.
      </div>
    </div>
  );
}
