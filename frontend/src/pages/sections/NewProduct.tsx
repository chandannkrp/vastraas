import { AxiosError } from "axios";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Gauge, ImagePlus, PenLine, Plus, Sparkles, User, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BrandLoader } from "../../components/BrandLoader";
import { SubmissionProgress } from "../../components/SubmissionProgress";
import { createSubmission, getImageModels, type Customization, type ImageModel } from "../../lib/catalog";
import { usePipelineDock } from "../../lib/pipelineDock";

// "On-model" leads — a professional, studio-shot model wearing the seller's
// fabric is the core thing this product does. Everything else supports it.
const BASE_SHOTS: { key: string; label: string; signature?: boolean }[] = [
  { key: "on_model", label: "On-model studio shot", signature: true },
  { key: "draped", label: "Draped" },
  { key: "flatlay", label: "Flat-lay" },
  { key: "macro", label: "Macro weave" },
  { key: "flat_fold", label: "Flat-fold" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "closeup_texture", label: "Texture close-up" },
];

const PROMPT_IDEAS = [
  "Professional studio shot — a model wearing this as a saree, softbox lighting, seamless grey backdrop",
  "Model wearing this fabric as a tailored kurta, editorial fashion photography, shallow depth of field",
  "Draped on a mannequin, natural window light, minimal styling",
  "Flat-lay on a marble surface with a marigold garland prop, top-down light",
  "Close-up macro of the weave and texture, warm golden-hour light",
];
const COLORS = [
  { name: "Original", value: "", hex: "" },
  { name: "Indigo", value: "indigo blue", hex: "#3d2986" },
  { name: "Marigold", value: "marigold yellow", hex: "#f59e0b" },
  { name: "Madder", value: "madder red", hex: "#c0392b" },
  { name: "Emerald", value: "emerald green", hex: "#127a5c" },
  { name: "Turmeric", value: "turmeric", hex: "#e0a70a" },
  { name: "Rani Pink", value: "rani pink", hex: "#d6336c" },
  { name: "Ivory", value: "ivory cream", hex: "#f4efe0" },
  { name: "Charcoal", value: "charcoal grey", hex: "#3a3a44" },
];
const TEXTURES = ["smooth", "slub", "ribbed", "handloom", "brocade", "jacquard", "linen-weave", "raw-silk"];
const PATTERNS = ["solid", "floral", "geometric", "block-print", "stripe", "paisley", "ikat", "bandhani", "chevron"];
const FINISHES = ["original", "matte", "glossy", "sheen", "textured"];
const TONES = ["minimal", "editorial", "technical", "storytelling"];
const AUDIENCES = ["designers", "garmenters", "boutiques"];
const LENGTHS = ["short", "standard", "detailed"];

export function NewProduct() {
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState({ title: "", fabric_type: "", color: "", notes: "" });
  const [cust, setCust] = useState<Customization>({
    image_shots: ["on_model", "draped", "flatlay"],
    tone: "editorial",
    audience: "designers",
    length: "standard",
    finish: "original",
    dye: "",
    texture: "",
    pattern: "",
    custom_prompt: "",
    image_quality: "balanced",
  });
  const [models, setModels] = useState<ImageModel[]>([]);

  useEffect(() => {
    getImageModels().then(setModels).catch(() => setModels([]));
  }, []);
  const [customShots, setCustomShots] = useState<{ key: string; label: string; signature?: boolean }[]>([]);
  const [addingShot, setAddingShot] = useState(false);
  const [newShotText, setNewShotText] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { track, notify } = usePipelineDock();
  const [active, setActive] = useState<{ id: string; title: string } | null>(null);
  // Collapse the (tall) input form once a shoot is running, so the live
  // processing below is front-and-centre.
  const [formOpen, setFormOpen] = useState(true);

  const shots = [...BASE_SHOTS, ...customShots];

  // Token estimate for the model chooser. The backend caps a shoot at 4 images,
  // so the estimate uses the same cap.
  const selectedModel = models.find((m) => m.key === cust.image_quality) ?? models[0];
  const nShots = Math.min(cust.image_shots.length, 4);
  const estTokens = selectedModel ? selectedModel.tokens_per_image * nShots : 0;

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 8));
  }

  function toggleShot(key: string) {
    setCust((c) => ({
      ...c,
      image_shots: c.image_shots.includes(key)
        ? c.image_shots.filter((s) => s !== key)
        : [...c.image_shots, key],
    }));
  }

  function commitCustomShot() {
    const label = newShotText.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    setCustomShots((prev) => [...prev, { key, label }]);
    setCust((c) => ({ ...c, image_shots: [...c.image_shots, key] }));
    setNewShotText("");
    setAddingShot(false);
  }

  async function submit() {
    if (files.length === 0) {
      setError("Add at least one photo.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const title = fields.title || fields.fabric_type || "New product";
      const { id } = await createSubmission(files, fields, cust);
      track(id, title);
      notify("Agents are on it — your gallery is generating below.", "success");
      setActive({ id, title });
      setFormOpen(false); // collapse the form so the live processing leads
      setFiles([]);
      setFields({ title: "", fabric_type: "", color: "", notes: "" });
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>;
      setError(ax.response?.data?.detail ?? "Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="hidden rounded-2xl bg-gradient-to-br from-indigo-800 to-indigo-600 p-3 text-saffron-300 shadow-md shadow-indigo-900/20 sm:inline-flex">
          <Wand2 size={22} />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Studio</h2>
          <p className="text-ink-soft">
            Upload your fabric, tell the studio what to shoot, and get back professional,
            model-worn visuals in minutes.
          </p>
        </div>
      </div>

      {/* Collapsed summary bar — shown while a shoot is generating below */}
      {!formOpen && (
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setFormOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-5 py-3.5 text-left shadow-sm transition hover:border-indigo-300"
        >
          <span className="inline-flex rounded-xl bg-indigo-50 p-2 text-indigo-700"><Wand2 size={16} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Studio inputs collapsed</p>
            <p className="truncate text-xs text-ink-soft">Watch the generation below · tap to start another shoot</p>
          </div>
          <span className="rounded-full bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-cream">New shoot</span>
        </motion.button>
      )}

      <AnimatePresence initial={false}>
      {formOpen && (
      <motion.div
        key="studio-form"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload + basics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5 rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
        >
          <SectionTitle icon={ImagePlus} title="Your fabric" />
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-black/15 bg-cream-deep/30 p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40"
          >
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            <div className="mx-auto mb-3 inline-flex rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <ImagePlus size={24} />
            </div>
            <p className="font-medium text-ink">Drop photos or click to browse</p>
            <p className="text-sm text-ink-soft">Raw phone photos are fine · up to 8</p>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5">
              {files.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="group relative overflow-hidden rounded-xl bg-cream-deep"
                >
                  <img src={URL.createObjectURL(f)} alt="" className="aspect-square w-full object-cover" />
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Title (optional)" value={fields.title} onChange={(v) => setFields((f) => ({ ...f, title: v }))} placeholder="Emerald silk" />
            <Input label="Fabric type" value={fields.fabric_type} onChange={(v) => setFields((f) => ({ ...f, fabric_type: v }))} placeholder="Silk" />
            <Input label="Colour" value={fields.color} onChange={(v) => setFields((f) => ({ ...f, color: v }))} placeholder="Emerald green" />
            <Input label="Notes" value={fields.notes} onChange={(v) => setFields((f) => ({ ...f, notes: v }))} placeholder="Anything else" />
          </div>
        </motion.div>

        {/* Designer customization */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-5 rounded-3xl border border-black/5 bg-white p-6 shadow-sm"
        >
          <SectionTitle icon={Sparkles} title="Imagine your fabric" accent />

          <Group label="Colour / dye">
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCust((s) => ({ ...s, dye: c.value }))}
                  title={c.name}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
                    cust.dye === c.value ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-black/10 text-ink-soft hover:border-indigo-300"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ background: c.hex || "linear-gradient(135deg,#fff,#ddd)" }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </Group>

          <Group label="Texture">
            <ChipRow options={TEXTURES} value={cust.texture ?? ""} onChange={(v) => setCust((c) => ({ ...c, texture: c.texture === v ? "" : v }))} />
          </Group>
          <Group label="Pattern">
            <ChipRow options={PATTERNS} value={cust.pattern ?? ""} onChange={(v) => setCust((c) => ({ ...c, pattern: c.pattern === v ? "" : v }))} />
          </Group>
          <Group label="Finish">
            <Segmented options={FINISHES} value={cust.finish ?? "original"} onChange={(v) => setCust((c) => ({ ...c, finish: v }))} />
          </Group>

          <Group label="Shots to generate">
            <div className="flex flex-wrap gap-2">
              {shots.map((s) => (
                <Chip key={s.key} active={cust.image_shots.includes(s.key)} onClick={() => toggleShot(s.key)} signature={s.signature}>
                  {s.signature && <User size={12} />}
                  {s.label}
                </Chip>
              ))}
              <AddChip open={addingShot} value={newShotText} onOpen={() => setAddingShot(true)} onChange={setNewShotText} onCommit={commitCustomShot} onCancel={() => { setAddingShot(false); setNewShotText(""); }} placeholder="e.g. on a rack" />
            </div>
          </Group>

          {/* Image model chooser — pick quality vs token spend up front. */}
          {models.length > 0 && (
            <Group label="Image model">
              <div className="grid gap-2 sm:grid-cols-3">
                {models.map((m) => {
                  const active = cust.image_quality === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setCust((c) => ({ ...c, image_quality: m.key }))}
                      className={`rounded-2xl border p-3 text-left transition ${
                        active ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-black/10 bg-white hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{m.label}</span>
                        {m.recommended && (
                          <span className="rounded-full bg-saffron-300/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-saffron-600">Best</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{m.blurb}</p>
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-indigo-700">
                        <Coins size={11} /> {m.tokens_per_image.toLocaleString()} / image
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-xl bg-cream-deep/50 px-3 py-2 text-xs text-ink-soft">
                <Gauge size={13} className="text-indigo-700" />
                Estimated <span className="font-semibold text-ink">{estTokens.toLocaleString()} tokens</span> for {nShots}
                {nShots === 1 ? " shot" : " shots"}
                {selectedModel ? ` at ${selectedModel.label} quality` : ""}.
              </div>
            </Group>
          )}

          {/* The custom description box — this is what actually drives the
              image generation model, so it gets the most visual weight. */}
          <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-700" />
              <p className="text-sm font-semibold text-ink">Describe your vision</p>
              <span className="ml-auto text-xs text-ink-soft">Feeds the image model directly</span>
            </div>
            <div className="relative">
              <PenLine size={14} className="absolute left-3 top-3 text-ink-soft" />
              <textarea
                value={cust.custom_prompt}
                onChange={(e) => setCust((c) => ({ ...c, custom_prompt: e.target.value }))}
                rows={3}
                placeholder="e.g. 'Professional studio shot — a model wearing this as a saree, softbox lighting, seamless grey backdrop'"
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-8 pr-3 text-sm text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PROMPT_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setCust((c) => ({ ...c, custom_prompt: idea }))}
                  title={idea}
                  className="max-w-[220px] truncate rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SmallGroup label="Tone"><MiniSelect options={TONES} value={cust.tone} onChange={(v) => setCust((c) => ({ ...c, tone: v }))} /></SmallGroup>
            <SmallGroup label="Audience"><MiniSelect options={AUDIENCES} value={cust.audience} onChange={(v) => setCust((c) => ({ ...c, audience: v }))} /></SmallGroup>
            <SmallGroup label="Length"><MiniSelect options={LENGTHS} value={cust.length} onChange={(v) => setCust((c) => ({ ...c, length: v }))} /></SmallGroup>
          </div>

          {error && <p className="rounded-lg bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta">{error}</p>}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 font-semibold text-cream shadow-lg shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:opacity-60"
          >
            {submitting ? <BrandLoader size={18} /> : <Sparkles size={18} />}
            {submitting ? "Uploading…" : "Generate my studio shoot"}
          </motion.button>
        </motion.div>
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      {/* Results reveal — the animated gallery that appears once a product
          has been submitted, so the studio pipeline feels alive. */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="space-y-4 rounded-3xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-transparent p-1 sm:p-2"
        >
          <div className="flex items-center justify-between px-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-indigo-100 p-1.5 text-indigo-700">
                <Sparkles size={14} />
              </span>
              <h3 className="font-display text-xl font-semibold text-ink">{active.title}</h3>
            </div>
            <button onClick={() => setActive(null)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink-soft hover:border-indigo-300">
              Dismiss
            </button>
          </div>
          <SubmissionProgress id={active.id} />
        </motion.div>
      )}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, accent }: { icon: typeof Sparkles; title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className={accent ? "text-saffron-500" : "text-indigo-700"} />
      <h3 className="font-semibold text-ink">{title}</h3>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-2 text-sm font-medium text-ink">{label}</p>{children}</div>;
}
function SmallGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="mb-1.5 text-xs font-medium text-ink-soft">{label}</p>{children}</div>;
}

function Chip({ active, onClick, children, signature }: { active: boolean; onClick: () => void; children: React.ReactNode; signature?: boolean }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? signature
            ? "border-indigo-700 bg-gradient-to-r from-indigo-700 to-indigo-600 text-white shadow-sm shadow-indigo-700/30"
            : "border-indigo-600 bg-indigo-600 text-white"
          : signature
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:border-indigo-400"
            : "border-black/10 bg-white text-ink-soft hover:border-indigo-300"
      }`}>
      {children}
    </button>
  );
}

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${value === o ? "border-indigo-600 bg-indigo-600 text-white" : "border-black/10 bg-white text-ink-soft hover:border-indigo-300"}`}>
          {o.replace(/-/g, " ")}
        </button>
      ))}
    </div>
  );
}

function MiniSelect({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-sm capitalize text-ink outline-none focus:border-indigo-500">
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-cream-deep p-1">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${value === o ? "bg-white text-indigo-700 shadow-sm" : "text-ink-soft hover:text-ink"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function AddChip({ open, value, onOpen, onChange, onCommit, onCancel, placeholder }: {
  open: boolean; value: string; onOpen: () => void; onChange: (v: string) => void; onCommit: () => void; onCancel: () => void; placeholder: string;
}) {
  if (!open) {
    return (
      <button onClick={onOpen} className="flex items-center gap-1 rounded-full border border-dashed border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50">
        <Plus size={14} /> Add your own
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-indigo-300 bg-white px-2 py-1">
      <input autoFocus value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onCommit(); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder} className="w-36 border-none bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60" />
      <button onClick={onCommit} className="rounded-full bg-indigo-700 px-2 py-1 text-xs font-semibold text-cream">Add</button>
      <button onClick={onCancel} className="text-ink-soft"><X size={14} /></button>
    </div>
  );
}
