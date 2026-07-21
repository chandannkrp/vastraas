import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Pencil,
  Store,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { assetUrl } from "../lib/api";
import {
  downloadImagesZip,
  getShopifyCollections,
  getSubmission,
  publishToShopify,
  updateListing,
  type ImageOut,
  type ShopifyCollection,
  type SubmissionDetail,
} from "../lib/catalog";
import { usePipelineDock } from "../lib/pipelineDock";
import { BrandLoader, BrandLoaderPanel } from "./BrandLoader";
import { ImageFeed } from "./ImageFeed";
import { SkeletonImage } from "./SkeletonImage";
import { StatusBadge } from "./StatusBadge";
import { StyleSuggestions } from "./StyleSuggestions";

export function ProductModal({ submissionId, onClose }: { submissionId: string; onClose: () => void }) {
  const { notify } = usePipelineDock();
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [images, setImages] = useState<ImageOut[]>([]);
  const [tab, setTab] = useState<"details" | "publish">("details");

  useEffect(() => {
    getSubmission(submissionId).then((d) => {
      setDetail(d);
      setImages(d.images);
    });
  }, [submissionId]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-cream shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-semibold text-ink">
              {(detail?.listing?.title as string) || detail?.submission.title || "Product"}
            </h2>
            {detail && <StatusBadge status={detail.shopify_status ?? detail.submission.status} />}
          </div>
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "details"} onClick={() => setTab("details")} icon={ImageIcon} label="Visuals & details" />
            <TabBtn active={tab === "publish"} onClick={() => setTab("publish")} icon={Store} label="Publish" />
            <button onClick={onClose} className="ml-2 rounded-full p-1.5 text-ink-soft hover:bg-black/5"><X size={20} /></button>
          </div>
        </div>

        {!detail ? (
          <div className="flex-1 py-16"><BrandLoaderPanel /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {tab === "details" ? (
                  <DetailsTab detail={detail} images={images} setImages={setImages} notify={notify} submissionId={submissionId} />
                ) : (
                  <PublishTab detail={detail} images={images} notify={notify} submissionId={submissionId} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Human-readable spec points pulled from the extracted fabric attributes. */
const SPEC_FIELDS: { keys: string[]; label: string }[] = [
  { keys: ["fabric_type"], label: "Fabric" },
  { keys: ["composition", "material"], label: "Composition" },
  { keys: ["color", "colour"], label: "Colour" },
  { keys: ["pattern", "print"], label: "Pattern" },
  { keys: ["weave", "texture"], label: "Weave / texture" },
  { keys: ["finish"], label: "Finish" },
  { keys: ["gsm", "weight"], label: "Weight / GSM" },
  { keys: ["width", "width_inches"], label: "Width" },
  { keys: ["care", "care_instructions"], label: "Care" },
];

function buildSpecs(attrs: Record<string, unknown>, listing: Record<string, unknown>): { label: string; value: string }[] {
  const src = { ...attrs, ...listing };
  const out: { label: string; value: string }[] = [];
  for (const f of SPEC_FIELDS) {
    for (const k of f.keys) {
      const v = src[k];
      if (v == null || v === "") continue;
      const value = Array.isArray(v) ? v.join(", ") : String(v);
      if (value.trim()) { out.push({ label: f.label, value }); break; }
    }
  }
  return out;
}

function DetailsTab({
  detail, images, setImages, notify, submissionId,
}: {
  detail: SubmissionDetail;
  images: ImageOut[];
  setImages: (i: ImageOut[]) => void;
  notify: (m: string, k?: "info" | "success" | "error") => void;
  submissionId: string;
}) {
  const listing = (detail.listing ?? {}) as Record<string, unknown>;
  const attrs = (detail.attributes ?? {}) as Record<string, unknown>;
  const marketing = (detail.marketing ?? {}) as Record<string, string | string[]>;

  const [title, setTitle] = useState((listing.title as string) ?? detail.submission.title ?? "");
  const [tags, setTags] = useState(((listing.tags as string[]) ?? []).join(", "));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
  const specs = buildSpecs(attrs, listing);
  const descHtml = (listing.description_html as string) || "";
  const enhancedCount = images.filter((i) => i.kind === "enhanced").length;

  async function save() {
    setSaving(true);
    try {
      await updateListing(submissionId, { title, tags: tagList });
      notify("Details saved.", "success");
      setEditing(false);
    } catch {
      notify("Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Product info — read-first, lightly editable. No raw HTML in sight. */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            {editing ? (
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="vinput font-display text-lg font-semibold" />
            ) : (
              <h3 className="font-display text-2xl font-semibold text-ink">{title || "Untitled fabric"}</h3>
            )}
            <button
              onClick={() => (editing ? save() : setEditing(true))}
              disabled={saving}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
            >
              {saving ? <BrandLoader size={13} /> : editing ? <Check size={13} /> : <Pencil size={13} />}
              {editing ? "Save" : "Edit"}
            </button>
          </div>

          {/* Key spec points */}
          {specs.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
              {specs.map((s) => (
                <div key={s.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/70">{s.label}</dt>
                  <dd className="text-sm font-medium capitalize text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* Description — rendered, never an HTML editor */}
          {descHtml && (
            <div
              className="prose-product mt-5 border-t border-black/5 pt-4 text-sm leading-relaxed text-ink-soft"
              dangerouslySetInnerHTML={{ __html: descHtml }}
            />
          )}

          {/* Tags */}
          <div className="mt-5 border-t border-black/5 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft/70">
              <Tag size={12} /> Tags
            </p>
            {editing ? (
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated, tags" className="vinput text-sm" />
            ) : tagList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tagList.map((t) => (
                  <span key={t} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{t}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft/60">No tags yet.</p>
            )}
          </div>

          {marketing.marketing_blurb && (
            <div className="mt-5 rounded-2xl bg-cream-deep/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Marketing hook</p>
              <p className="mt-1 text-sm text-ink">{marketing.marketing_blurb as string}</p>
              {Array.isArray(marketing.hashtags) && (
                <p className="mt-2 text-sm font-medium text-indigo-700">{(marketing.hashtags as string[]).join(" ")}</p>
              )}
            </div>
          )}

          <button
            onClick={() => downloadImagesZip(submissionId, `${title || "product"}.zip`)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-indigo-300"
          >
            <Download size={16} /> Download all {enhancedCount} images (ZIP)
          </button>
        </div>

        {/* Styling / selling suggestions */}
        <StyleSuggestions fabricType={detail.submission.fabric_type ?? (attrs.fabric_type as string)} tags={tagList} />
      </div>

      {/* The star: the big visual gallery */}
      <ImageFeed submissionId={submissionId} images={images} onImagesChange={setImages} />
      <VInputStyle />
    </div>
  );
}

function PublishTab({
  detail, images, notify, submissionId,
}: {
  detail: SubmissionDetail;
  images: ImageOut[];
  notify: (m: string, k?: "info" | "success" | "error") => void;
  submissionId: string;
}) {
  const enhanced = useMemo(() => images.filter((i) => i.kind === "enhanced"), [images]);
  const attrs = (detail.attributes ?? {}) as Record<string, unknown>;
  const listing = (detail.listing ?? {}) as Record<string, unknown>;

  const [form, setForm] = useState({
    title: (listing.title as string) || detail.submission.title || "",
    description_html: (listing.description_html as string) || "",
    product_type: (listing.product_type as string) || "Fabric",
    price: "",
    compare_at_price: "",
    set_contents: "",
    care: (listing.care_instructions as string) || "",
    gsm: "",
    width: "",
    composition: (attrs.composition as string) || "",
    status: "DRAFT" as "DRAFT" | "ACTIVE",
  });
  const [selected, setSelected] = useState<string[]>(enhanced.map((i) => i.id));
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [chosenCollections, setChosenCollections] = useState<string[]>([]);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ admin_url: string; online_url?: string } | null>(null);

  useEffect(() => {
    getShopifyCollections()
      .then((c) => { setCollections(c); setConnected(true); })
      .catch(() => setConnected(false));
  }, []);

  function toggleImage(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function publish() {
    setPublishing(true);
    try {
      const r = await publishToShopify(submissionId, {
        title: form.title,
        description_html: form.description_html,
        product_type: form.product_type,
        status: form.status,
        price: form.price ? Number(form.price) : undefined,
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : undefined,
        image_ids: selected,
        collection_ids: chosenCollections,
        set_contents: form.set_contents,
        care: form.care,
        gsm: form.gsm,
        width: form.width,
        composition: form.composition,
        tags: (listing.tags as string[]) ?? [],
      });
      setResult(r);
      notify(`Published to Shopify as ${form.status}.`, "success");
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      notify(msg ?? "Publish failed.", "error");
    } finally {
      setPublishing(false);
    }
  }

  if (connected === false) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-cream-deep/40 p-8 text-center">
        <Store className="mx-auto mb-3 text-ink-soft" size={30} />
        <p className="font-semibold text-ink">Shopify isn't connected</p>
        <p className="mt-1 text-sm text-ink-soft">Add your store's Admin API token in Connectors to publish products.</p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <Check className="mx-auto mb-3 text-emerald-600" size={34} strokeWidth={3} />
        <p className="font-display text-xl font-semibold text-ink">Published to Shopify!</p>
        <p className="mt-1 text-sm text-ink-soft">Status: {form.status}. Review and finalize in your store.</p>
        <div className="mt-5 flex justify-center gap-3">
          <a href={result.admin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-indigo-800">
            <ExternalLink size={15} /> Open in Shopify admin
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Image selection */}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">Images to publish ({selected.length})</p>
        <div className="grid grid-cols-3 gap-2.5">
          {enhanced.map((img) => {
            const on = selected.includes(img.id);
            return (
              <button key={img.id} onClick={() => toggleImage(img.id)}
                className={`relative overflow-hidden rounded-xl border-2 transition ${on ? "border-indigo-600" : "border-transparent opacity-60"}`}>
                <SkeletonImage src={assetUrl(img.url)} className="aspect-square w-full" />
                {on && <span className="absolute right-1 top-1 rounded-full bg-indigo-600 p-0.5 text-white"><Check size={11} strokeWidth={3} /></span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-ink-soft">First selected image becomes the main product image.</p>
      </div>

      {/* Shopify fields */}
      <div className="space-y-4">
        <Field label="Product title"><input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="vinput" /></Field>
        <Field label="Description (HTML)"><textarea value={form.description_html} onChange={(e) => setForm((f) => ({ ...f, description_html: e.target.value }))} rows={4} className="vinput font-mono text-xs" /></Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (₹)"><input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="per meter" className="vinput" /></Field>
          <Field label="Compare-at (₹)"><input type="number" value={form.compare_at_price} onChange={(e) => setForm((f) => ({ ...f, compare_at_price: e.target.value }))} placeholder="optional" className="vinput" /></Field>
          <Field label="Product type"><input value={form.product_type} onChange={(e) => setForm((f) => ({ ...f, product_type: e.target.value }))} className="vinput" /></Field>
          <Field label="Composition"><input value={form.composition} onChange={(e) => setForm((f) => ({ ...f, composition: e.target.value }))} placeholder="100% silk" className="vinput" /></Field>
          <Field label="GSM"><input value={form.gsm} onChange={(e) => setForm((f) => ({ ...f, gsm: e.target.value }))} className="vinput" /></Field>
          <Field label="Width (in)"><input value={form.width} onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))} className="vinput" /></Field>
        </div>

        <Field label="What's in the set"><textarea value={form.set_contents} onChange={(e) => setForm((f) => ({ ...f, set_contents: e.target.value }))} rows={2} placeholder="e.g. 2.5m blouse piece + 5.5m saree + 0.8m border" className="vinput" /></Field>
        <Field label="Care instructions"><input value={form.care} onChange={(e) => setForm((f) => ({ ...f, care: e.target.value }))} placeholder="Dry clean only" className="vinput" /></Field>

        {collections.length > 0 && (
          <Field label="Collections">
            <div className="flex flex-wrap gap-1.5">
              {collections.map((c) => {
                const on = chosenCollections.includes(c.id);
                return (
                  <button key={c.id} onClick={() => setChosenCollections((cc) => on ? cc.filter((x) => x !== c.id) : [...cc, c.id])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-black/10 text-ink-soft hover:border-indigo-300"}`}>
                    {c.title}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Publish as">
          <div className="flex gap-1.5 rounded-xl bg-cream-deep p-1">
            {(["DRAFT", "ACTIVE"] as const).map((s) => (
              <button key={s} onClick={() => setForm((f) => ({ ...f, status: s }))}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${form.status === s ? "bg-white text-indigo-700 shadow-sm" : "text-ink-soft"}`}>
                {s === "DRAFT" ? "Draft" : "Active (live)"}
              </button>
            ))}
          </div>
        </Field>

        <button onClick={publish} disabled={publishing || selected.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 font-semibold text-cream shadow-lg shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:opacity-60">
          {publishing ? <BrandLoader size={18} /> : <Store size={18} />}
          {publishing ? "Publishing…" : "Publish to Shopify"}
        </button>
      </div>
      <VInputStyle />
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Store; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${active ? "bg-indigo-50 text-indigo-700" : "text-ink-soft hover:text-ink"}`}>
      <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>{children}</label>;
}

function VInputStyle() {
  return <style>{`.vinput{width:100%;border-radius:0.75rem;border:1px solid rgba(0,0,0,0.1);background:#fff;padding:0.6rem 0.9rem;font-size:0.875rem;outline:none;color:#1c1633}.vinput:focus{border-color:#5f43c4;box-shadow:0 0 0 2px rgba(95,67,196,0.15)}.prose-product p{margin:0 0 0.6rem}.prose-product ul{margin:0.3rem 0 0.6rem;padding-left:1.1rem;list-style:disc}.prose-product li{margin:0.2rem 0}.prose-product strong{color:#1c1633;font-weight:600}.prose-product h1,.prose-product h2,.prose-product h3{font-weight:600;color:#1c1633;margin:0.4rem 0 0.3rem;font-size:0.95rem}`}</style>;
}
