import { AxiosError } from "axios";
import { motion } from "framer-motion";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { createSubmission, type Customization } from "../../lib/catalog";
import { usePipelineDock } from "../../lib/pipelineDock";

const SHOTS = [
  { key: "flatlay", label: "Flat-lay" },
  { key: "draped", label: "Draped" },
  { key: "macro", label: "Macro weave" },
  { key: "on_model", label: "On-model" },
];
const TONES = ["minimal", "editorial", "technical", "storytelling"];
const AUDIENCES = ["designers", "garmenters", "boutiques"];
const LENGTHS = ["short", "standard", "detailed"];

export function NewProduct() {
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState({ title: "", fabric_type: "", color: "", notes: "" });
  const [cust, setCust] = useState<Customization>({
    image_shots: ["flatlay", "draped"],
    tone: "editorial",
    audience: "designers",
    length: "standard",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { track, notify } = usePipelineDock();

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
      notify("Sent to the studio — track progress in the corner.", "success");
      // Reset so they can immediately add another; the dock shows progress.
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
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      {/* Left: uploads + details */}
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Add a product</h2>
          <p className="text-ink-soft">Raw phone photos are fine — the agents clean them up.</p>
        </div>

        {/* Dropzone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="cursor-pointer rounded-3xl border-2 border-dashed border-black/15 bg-white p-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30"
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="mx-auto mb-3 inline-flex rounded-2xl bg-indigo-50 p-3 text-indigo-700">
            <ImagePlus size={26} />
          </div>
          <p className="font-medium text-ink">Drop photos or click to browse</p>
          <p className="text-sm text-ink-soft">Up to 8 images</p>
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {files.map((f, i) => (
              <div key={i} className="group relative overflow-hidden rounded-xl bg-cream-deep">
                <img
                  src={URL.createObjectURL(f)}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Title (optional)" value={fields.title} onChange={(v) => setFields((f) => ({ ...f, title: v }))} placeholder="Emerald silk" />
          <Input label="Fabric type" value={fields.fabric_type} onChange={(v) => setFields((f) => ({ ...f, fabric_type: v }))} placeholder="Silk" />
          <Input label="Colour" value={fields.color} onChange={(v) => setFields((f) => ({ ...f, color: v }))} placeholder="Emerald green" />
          <Input label="Notes" value={fields.notes} onChange={(v) => setFields((f) => ({ ...f, notes: v }))} placeholder="Anything else" />
        </div>
      </div>

      {/* Right: customization */}
      <div className="space-y-6 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-saffron-500" />
          <h3 className="font-semibold text-ink">Customize the output</h3>
        </div>

        <Group label="Image shots to generate">
          <div className="flex flex-wrap gap-2">
            {SHOTS.map((s) => (
              <Chip key={s.key} active={cust.image_shots.includes(s.key)} onClick={() => toggleShot(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group label="Description tone">
          <Segmented options={TONES} value={cust.tone} onChange={(v) => setCust((c) => ({ ...c, tone: v }))} />
        </Group>
        <Group label="Audience">
          <Segmented options={AUDIENCES} value={cust.audience} onChange={(v) => setCust((c) => ({ ...c, audience: v }))} />
        </Group>
        <Group label="Length">
          <Segmented options={LENGTHS} value={cust.length} onChange={(v) => setCust((c) => ({ ...c, length: v }))} />
        </Group>

        {error && <p className="rounded-lg bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta">{error}</p>}

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={submit}
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 font-semibold text-cream shadow-lg shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:opacity-60"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {submitting ? "Uploading…" : "Run the agents"}
        </motion.button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink">{label}</p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-black/10 bg-white text-ink-soft hover:border-indigo-300"
      }`}
    >
      {children}
    </button>
  );
}

function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl bg-cream-deep p-1">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
            value === o ? "bg-white text-indigo-700 shadow-sm" : "text-ink-soft hover:text-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
