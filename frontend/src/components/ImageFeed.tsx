import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  Maximize2,
  PenLine,
  Plus,
  Shirt,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { assetUrl } from "../lib/api";
import {
  deleteImage,
  regenerateImage,
  selectImage,
  type ImageOut,
} from "../lib/catalog";
import { BrandLoader } from "./BrandLoader";
import { GenerationLoader } from "./GenerationLoader";
import { SkeletonImage } from "./SkeletonImage";

const SHOTS = [
  { key: "on_model", label: "On-model", icon: User },
  { key: "draped", label: "Draped", icon: Shirt },
  { key: "flatlay", label: "Flat-lay", icon: ImageIcon },
  { key: "macro", label: "Macro weave", icon: Layers },
  { key: "flat_fold", label: "Flat-fold", icon: ImageIcon },
  { key: "lifestyle", label: "Lifestyle", icon: Sparkles },
  { key: "closeup_texture", label: "Texture close-up", icon: Layers },
];

const PROMPT_IDEAS = [
  "Studio shot, model wearing this, softbox lighting, seamless backdrop",
  "Draped on a mannequin, natural window light",
  "Close-up macro of the weave, golden-hour light",
];

/**
 * Gallery of generated product images with an explicit "Generate more" action.
 * New images append to the grid on request — nothing generates automatically.
 */
export function ImageFeed({
  submissionId,
  images,
  onImagesChange,
  allowSelect = true,
  onPreview,
}: {
  submissionId: string;
  images: ImageOut[];
  onImagesChange: (next: ImageOut[]) => void;
  allowSelect?: boolean;
  onPreview?: (img: ImageOut) => void;
}) {
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [shot, setShot] = useState("on_model");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [lightbox, setLightbox] = useState<ImageOut | null>(null);

  const enhanced = images.filter((i) => i.kind === "enhanced");

  function openPreview(img: ImageOut) {
    if (onPreview) onPreview(img);
    else setLightbox(img);
  }

  async function generateMore() {
    setError(null);
    setGenerating(true);
    try {
      const img = await regenerateImage(submissionId, { shot_type: shot, prompt: prompt || undefined });
      onImagesChange([...images, img]);
      setPrompt("");
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(msg ?? "Could not generate image. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id: string) {
    onImagesChange(images.filter((i) => i.id !== id));
    try {
      await deleteImage(id);
    } catch {
      /* best-effort */
    }
  }

  async function toggleApprove(id: string) {
    const next = !approved[id];
    setApproved((p) => ({ ...p, [id]: next }));
    try {
      await selectImage(id, next);
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="font-display text-xl font-semibold text-ink">Visualisation gallery</h4>
          <p className="text-xs text-ink-soft">{enhanced.length} studio shots · tap to enlarge, select the ones you love</p>
        </div>
      </div>

      {/* Gallery grid — a large image palette. Big portrait tiles that suit
          on-model/lookbook shots; new generations append to the bottom. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <AnimatePresence initial={false}>
          {enhanced.map((img) => {
            const on = approved[img.id];
            return (
              <motion.div
                key={img.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -3 }}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 shadow-sm transition ${
                  on ? "border-emerald-500" : "border-transparent"
                }`}
                onClick={() => openPreview(img)}
              >
                <SkeletonImage src={assetUrl(img.url)} alt={img.shot_type ?? ""} className="aspect-[3/4] w-full" imgClassName="transition duration-500 group-hover:scale-105" />

                {/* overlay */}
                <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-ink/60 via-transparent to-ink/10 opacity-0 transition group-hover:opacity-100">
                  <div className="flex justify-end gap-1.5 p-2">
                    <button onClick={(e) => { e.stopPropagation(); openPreview(img); }} title="Preview" className="rounded-full bg-white/90 p-1.5 text-ink hover:bg-white">
                      <Maximize2 size={13} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); remove(img.id); }} title="Remove" className="rounded-full bg-white/90 p-1.5 text-terracotta hover:bg-white">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2">
                    <span className="rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-medium capitalize text-cream">
                      {img.shot_type?.replace(/_/g, " ")}
                    </span>
                    {allowSelect && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleApprove(img.id); }}
                        title="Select for publishing"
                        className={`rounded-full p-1.5 ${on ? "bg-emerald-600 text-white" : "bg-white/90 text-ink-soft"}`}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>

                {on && (
                  <span className="absolute left-2 top-2 rounded-full bg-emerald-600 p-1 text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {generating && (
          <div className="col-span-2 sm:col-span-1">
            <GenerationLoader compact />
          </div>
        )}
      </div>

      {/* Generate more — creative, explicit, token-costing */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-cream-deep/40">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <span className="inline-flex rounded-full bg-indigo-100 p-1.5 text-indigo-700">
            <Sparkles size={14} />
          </span>
          <span className="text-sm font-semibold text-ink">Generate more</span>
          <span className="text-xs text-ink-soft">— explore another angle or mood</span>
          <ChevronDown size={16} className={`ml-auto text-ink-soft transition ${expanded ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 px-4 pb-4">
                <div className="flex flex-wrap gap-1.5">
                  {SHOTS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setShot(s.key)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        shot === s.key ? "border-indigo-600 bg-indigo-600 text-white" : "border-black/10 bg-white text-ink-soft hover:border-indigo-300"
                      }`}
                    >
                      <s.icon size={12} />
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <PenLine size={14} className="pointer-events-none absolute left-3 top-3 text-ink-soft" />
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={2}
                    placeholder="Optional direction — 'studio shot, model wearing this, soft daylight'…"
                    className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-8 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      onClick={() => setPrompt(idea)}
                      title={idea}
                      className="max-w-[200px] truncate rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
                    >
                      {idea}
                    </button>
                  ))}
                </div>

                <button
                  onClick={generateMore}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-cream shadow-md shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:opacity-60 sm:w-auto"
                >
                  {generating ? <BrandLoader size={15} /> : <Plus size={15} />}
                  Generate more
                </button>
                <p className="text-xs text-ink-soft">Each generation uses tokens from your balance.</p>
                {error && <p className="text-sm text-terracotta">{error}</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-h-[88vh] max-w-3xl overflow-hidden rounded-2xl bg-ink shadow-2xl"
            >
              <img src={assetUrl(lightbox.url)} alt="" className="max-h-[88vh] w-auto object-contain" />
              <span className="absolute left-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-xs font-medium capitalize text-cream">
                {lightbox.shot_type?.replace(/_/g, " ")}
              </span>
              <button
                onClick={() => setLightbox(null)}
                className="absolute right-3 top-3 rounded-full bg-white/90 p-1.5 text-ink hover:bg-white"
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
