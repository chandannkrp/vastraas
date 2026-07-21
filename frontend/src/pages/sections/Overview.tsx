import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  Images,
  Layers,
  Lightbulb,
  RefreshCw,
  Rocket,
  Shirt,
  Sparkles,
  Sun,
  Type,
  Wand2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLoaderPanel } from "../../components/BrandLoader";
import { ProductModal } from "../../components/ProductModal";
import { SkeletonImage } from "../../components/SkeletonImage";
import { StatusBadge } from "../../components/StatusBadge";
import { assetUrl } from "../../lib/api";
import {
  getAnalytics,
  listSubmissions,
  type AnalyticsSummary,
  type SubmissionListItem,
} from "../../lib/catalog";

const GENERATION_TIPS = [
  { icon: Sun, title: "Shoot in natural light", body: "A window-lit photo gives the studio real texture and colour to work from." },
  { icon: Camera, title: "Fill the frame", body: "Get close, keep the fabric flat or naturally draped — less background, more weave." },
  { icon: Type, title: "Be specific in the prompt", body: "\"Softbox lighting, seamless grey backdrop\" beats \"nice photo\"." },
  { icon: Shirt, title: "Try on-model for social", body: "On-model shots convert best on Instagram and product pages alike." },
];

const WHATS_NEW = [
  { tag: "New", title: "Choose your image model", body: "Pick Standard, Balanced or Premium before a shoot — see the token cost up front." },
  { tag: "New", title: "Publish fabrics as a set", body: "Select several fabrics in the catalogue and list them as one Shopify product." },
  { tag: "Improved", title: "Sharper, true-to-fabric studio shots", body: "Full-body studio framing that keeps your real weave and colour intact." },
];

const PROMPT_INSPO = [
  "Full-length studio shot — a model wearing this as a flowing saree, soft window light, seamless ivory backdrop",
  "On-model co-ord set, editorial fashion photography, natural pose, minimalist studio",
  "Draped over a stand to show the fall and sheen, golden-hour side light",
  "Flat-lay on warm marble with a marigold sprig, crisp top-down light",
];

export function Overview({ onOpen }: { onOpen: (tab: string) => void }) {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [subs, setSubs] = useState<SubmissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAnalytics(), listSubmissions()])
      .then(([a, s]) => {
        setAnalytics(a);
        setSubs(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <BrandLoaderPanel />;
  }

  const stats = [
    { icon: Layers, label: "Total products", value: analytics?.total_submissions ?? 0, tone: "text-indigo-700 bg-indigo-50" },
    { icon: RefreshCw, label: "Processing now", value: analytics?.processing ?? 0, tone: "text-saffron-600 bg-saffron-300/40" },
    { icon: CheckCircle2, label: "Ready / published", value: analytics?.ready ?? 0, tone: "text-emerald-700 bg-emerald-50" },
    { icon: Images, label: "Images generated", value: analytics?.images_generated ?? 0, tone: "text-indigo-700 bg-indigo-50" },
  ];

  return (
    <div className="space-y-8">
      {/* USP hero — the studio is the headline feature, not an afterthought */}
      <motion.button
        onClick={() => onOpen("new")}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-600 p-7 text-left shadow-xl shadow-indigo-900/20 sm:p-9"
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-saffron-300">
              <Sparkles size={12} /> Studio · your USP
            </span>
            <h2 className="mt-4 font-display text-2xl font-semibold text-cream sm:text-3xl">
              Turn one fabric photo into a full studio shoot
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/70 sm:text-base">
              Professional, model-worn visuals of your fabric or garment — draped, on-model,
              flat-lay, macro texture — generated from your filters and a custom description.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-indigo-800 shadow-lg transition group-hover:gap-3">
            <Wand2 size={16} /> Open the studio <ArrowRight size={15} />
          </span>
        </div>
      </motion.button>

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
            <p className="font-display text-3xl font-semibold text-ink">{s.value}</p>
            <p className="text-sm text-ink-soft">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tips to get sharper generations */}
      <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="inline-flex rounded-xl bg-saffron-300/40 p-2 text-saffron-600"><Lightbulb size={18} /></span>
          <div>
            <h3 className="font-display text-lg font-semibold text-ink">Get better studio shots</h3>
            <p className="text-xs text-ink-soft">Small tweaks at upload time make a big difference to the result.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GENERATION_TIPS.map((t) => (
            <div key={t.title} className="rounded-2xl bg-cream-deep/40 p-4">
              <div className="mb-2.5 inline-flex rounded-lg bg-white p-2 text-indigo-700 shadow-sm"><t.icon size={16} /></div>
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* What's new + prompt inspiration */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex rounded-xl bg-indigo-50 p-2 text-indigo-700"><Rocket size={18} /></span>
            <h3 className="font-display text-lg font-semibold text-ink">What's new</h3>
          </div>
          <ul className="space-y-3">
            {WHATS_NEW.map((n) => (
              <li key={n.title} className="flex gap-3">
                <span className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${n.tag === "New" ? "bg-emerald-100 text-emerald-700" : "bg-saffron-300/50 text-saffron-600"}`}>{n.tag}</span>
                <div>
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="text-xs leading-relaxed text-ink-soft">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-cream-deep/30 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="inline-flex rounded-xl bg-white p-2 text-indigo-700 shadow-sm"><Wand2 size={18} /></span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">Prompt inspiration</h3>
              <p className="text-xs text-ink-soft">Tap to copy — paste into the studio's "Describe your vision".</p>
            </div>
          </div>
          <div className="space-y-2">
            {PROMPT_INSPO.map((p) => (
              <PromptChip key={p} text={p} />
            ))}
          </div>
        </div>
      </div>

      {/* Recent products — structured cards, not a flat list */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-ink">Recent products</h3>
          {subs.length > 0 && (
            <button onClick={() => onOpen("catalog")} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 hover:underline">
              View catalogue <ArrowRight size={14} />
            </button>
          )}
        </div>

        {subs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-cream-deep/40 px-6 py-12 text-center text-ink-soft">
            No products yet. Add your first fabric to see the agents in action.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subs.slice(0, 6).map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setOpenId(s.id)}
                className="group overflow-hidden rounded-2xl border border-black/5 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-cream-deep">
                  {s.thumbnail_url ? (
                    <SkeletonImage
                      src={assetUrl(s.thumbnail_url)}
                      className="absolute inset-0 h-full w-full"
                      imgClassName="transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-soft/30">
                      <Images size={26} />
                    </div>
                  )}
                  <div className="absolute right-2 top-2">
                    <StatusBadge status={s.status} />
                  </div>
                  {(s.status === "processing" || s.status === "pending") && (
                    <div className="absolute inset-x-0 bottom-0 bg-ink/30 px-3 py-2 backdrop-blur-sm">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-saffron-400 to-saffron-500"
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="truncate font-semibold text-ink">{s.title || "Untitled fabric"}</p>
                  <p className="truncate text-sm text-ink-soft">{s.fabric_type || "—"}</p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {openId && <ProductModal submissionId={openId} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </div>
  );
}

function PromptChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="group flex w-full items-start gap-2 rounded-xl border border-black/5 bg-white px-3 py-2.5 text-left text-xs text-ink-soft transition hover:border-indigo-300"
    >
      <Copy size={13} className={`mt-0.5 shrink-0 transition ${copied ? "text-emerald-600" : "text-indigo-500 group-hover:text-indigo-700"}`} />
      <span className="flex-1">{text}</span>
      {copied && <span className="shrink-0 font-semibold text-emerald-600">Copied</span>}
    </button>
  );
}
