import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  Images,
  Layers,
  PackageOpen,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandLoader, BrandLoaderPanel } from "../../components/BrandLoader";
import { ProductModal } from "../../components/ProductModal";
import { StatusBadge } from "../../components/StatusBadge";
import { SkeletonImage } from "../../components/SkeletonImage";
import { assetUrl } from "../../lib/api";
import { listProducts, publishSetToShopify, type ProductCard } from "../../lib/catalog";
import { usePipelineDock } from "../../lib/pipelineDock";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "processing", label: "Processing" },
  { key: "awaiting_review", label: "Ready to publish" },
  { key: "published", label: "Published" },
  { key: "failed", label: "Failed" },
];

const SORTS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "name", label: "Name (A–Z)" },
];

function cardStatus(p: ProductCard): string {
  return p.shopify_status ?? p.status;
}

/**
 * The seller's product catalogue — presented like an actual catalogue, with the
 * ability to select several fabrics and publish them to Shopify as a single set.
 */
export function Catalog({ onOpen }: { onOpen: (tab: string) => void }) {
  const { notify } = usePipelineDock();
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [setModal, setSetModal] = useState(false);

  function reload() {
    return listProducts().then(setProducts);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (status !== "all") {
      list = list.filter((p) => cardStatus(p) === status || p.status === status);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.fabric_type ?? "").toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    const sorted = [...list];
    if (sort === "newest") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "oldest") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [products, query, status, sort]);

  const selecting = selected.length > 0;
  const selectedProducts = products.filter((p) => selected.includes(p.submission_id));

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function handleCardClick(id: string) {
    if (selecting) toggleSelect(id);
    else setOpenId(id);
  }

  if (loading) {
    return <BrandLoaderPanel label="Loading catalogue…" />;
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-black/10 bg-cream-deep/40 px-6 py-20 text-center">
        <div className="mb-4 inline-flex rounded-2xl bg-white p-4 text-indigo-700 shadow-sm">
          <PackageOpen size={30} />
        </div>
        <h3 className="text-lg font-semibold text-ink">Your catalogue is empty</h3>
        <p className="mt-1 max-w-sm text-ink-soft">
          Products appear here once the studio finishes generating their visuals.
        </p>
        <button
          onClick={() => onOpen("new")}
          className="mt-5 rounded-full bg-indigo-700 px-6 py-2.5 text-sm font-semibold text-cream"
        >
          Open the studio
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Editorial masthead */}
      <div className="rounded-3xl border border-black/5 bg-gradient-to-br from-ink via-indigo-950 to-indigo-900 p-7 text-cream shadow-xl sm:p-9">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-saffron-300">
          <span className="h-px w-8 bg-saffron-300/60" /> The Catalogue
        </div>
        <h2 className="mt-3 font-display text-4xl font-semibold leading-tight sm:text-5xl">
          Your fabric collection
        </h2>
        <p className="mt-2 max-w-lg text-cream/70">
          {products.length} piece{products.length === 1 ? "" : "s"} in your line. Browse, refine, or
          select a few to publish together as a set.
        </p>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, fabric or tag…"
              className="w-full rounded-xl border border-black/10 bg-cream-deep/40 py-2 pl-9 pr-3 text-sm text-ink outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-indigo-500"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition sm:hidden ${
              showFilters ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-black/10 text-ink-soft"
            }`}
          >
            <SlidersHorizontal size={14} /> Filters
          </button>
        </div>
        <div className={`${showFilters ? "flex" : "hidden"} mt-2.5 flex-wrap gap-1.5 sm:flex`}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                status === f.key
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-black/10 bg-white text-ink-soft hover:border-indigo-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-soft">
          {filtered.length} of {products.length} product{products.length === 1 ? "" : "s"}
          {selecting && <span className="ml-2 text-indigo-700">· {selected.length} selected</span>}
        </p>
        {selecting && (
          <button onClick={() => setSelected([])} className="text-xs font-semibold text-ink-soft hover:text-ink">
            Clear selection
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-cream-deep/40 px-6 py-14 text-center text-ink-soft">
          Nothing matches those filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p, i) => {
            const on = selected.includes(p.submission_id);
            return (
              <motion.div
                key={p.submission_id}
                layout
                onClick={() => handleCardClick(p.submission_id)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.04 }}
                className={`group relative cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                  on ? "border-indigo-600 ring-2 ring-indigo-600" : "border-black/5"
                }`}
              >
                {/* Catalogue plate number */}
                <span className="absolute left-3 top-3 z-10 font-display text-xs font-semibold text-cream/90 mix-blend-difference">
                  {String(i + 1).padStart(2, "0")}
                </span>

                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelect(p.submission_id); }}
                  className={`absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur transition ${
                    on ? "border-indigo-600 bg-indigo-600 text-white" : "border-white/70 bg-black/20 text-transparent hover:text-white/80"
                  } ${selecting ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  title="Select for a set"
                >
                  <CheckCheck size={14} strokeWidth={3} />
                </button>

                <div className="relative aspect-[4/5] overflow-hidden bg-cream-deep">
                  {p.thumbnail_url ? (
                    <SkeletonImage
                      src={assetUrl(p.thumbnail_url)}
                      alt={p.title}
                      className="absolute inset-0 h-full w-full"
                      imgClassName="transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-ink-soft/40">
                      <Images size={28} />
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3.5 text-cream">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cream/70">
                      {p.fabric_type ?? "Fabric"}
                    </p>
                    <h3 className="truncate font-display text-lg font-semibold">{p.title}</h3>
                  </div>
                  <div className="absolute right-3 top-12">
                    <StatusBadge status={cardStatus(p)} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating set-publish bar */}
      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-black/5 bg-white/95 px-4 py-2.5 shadow-2xl shadow-indigo-900/20 backdrop-blur"
          >
            <span className="flex items-center gap-2 pl-1 text-sm font-medium text-ink">
              <Layers size={16} className="text-indigo-700" />
              {selected.length} selected
            </span>
            <button
              disabled={selected.length < 2}
              onClick={() => setSetModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Store size={15} /> Publish as a set
            </button>
            <button onClick={() => setSelected([])} className="rounded-full p-1.5 text-ink-soft hover:bg-black/5">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openId && <ProductModal submissionId={openId} onClose={() => setOpenId(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {setModal && (
          <SetPublishModal
            products={selectedProducts}
            onClose={() => setSetModal(false)}
            onDone={() => { setSetModal(false); setSelected([]); reload(); }}
            notify={notify}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SetPublishModal({
  products,
  onClose,
  onDone,
  notify,
}: {
  products: ProductCard[];
  onClose: () => void;
  onDone: () => void;
  notify: (m: string, k?: "info" | "success" | "error") => void;
}) {
  const [title, setTitle] = useState(`${products[0]?.title ?? "Fabric"} Set`);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">("DRAFT");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ admin_url: string } | null>(null);

  async function publish() {
    setPublishing(true);
    try {
      const r = await publishSetToShopify({
        submission_ids: products.map((p) => p.submission_id),
        title,
        description_html: description ? `<p>${description}</p>` : undefined,
        price: price ? Number(price) : undefined,
        status,
      });
      setResult(r);
      notify(`Set of ${products.length} published to Shopify as ${status}.`, "success");
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      notify(msg ?? "Could not publish the set.", "error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-3xl bg-cream shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/5 bg-white px-6 py-4">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-700" />
            <h2 className="font-display text-lg font-semibold text-ink">Publish as a set</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-black/5"><X size={18} /></button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          {result ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
              <CheckCheck className="mx-auto mb-3 text-emerald-600" size={34} strokeWidth={3} />
              <p className="font-display text-xl font-semibold text-ink">Set published!</p>
              <p className="mt-1 text-sm text-ink-soft">{products.length} fabrics, listed as one product.</p>
              <div className="mt-5 flex justify-center gap-3">
                <a href={result.admin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-indigo-800">
                  <Store size={15} /> Open in Shopify
                </a>
                <button onClick={onDone} className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium text-ink hover:border-indigo-300">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Members preview */}
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">{products.length} fabrics in this set</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {products.map((p) => (
                    <div key={p.submission_id} className="w-24 shrink-0">
                      {p.thumbnail_url ? (
                        <SkeletonImage src={assetUrl(p.thumbnail_url)} className="aspect-[4/5] rounded-xl" />
                      ) : (
                        <div className="flex aspect-[4/5] items-center justify-center rounded-xl bg-cream-deep text-ink-soft/40"><Images size={20} /></div>
                      )}
                      <p className="mt-1 truncate text-[11px] text-ink-soft">{p.title}</p>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Set title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Short description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="A curated set of coordinating fabrics…" className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Price for the set (₹)</span>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="optional" className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200" />
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink">Publish as</span>
                <div className="flex gap-1.5 rounded-xl bg-cream-deep p-1">
                  {(["DRAFT", "ACTIVE"] as const).map((s) => (
                    <button key={s} onClick={() => setStatus(s)}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === s ? "bg-white text-indigo-700 shadow-sm" : "text-ink-soft"}`}>
                      {s === "DRAFT" ? "Draft" : "Active (live)"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={publish}
                disabled={publishing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 font-semibold text-cream shadow-lg shadow-indigo-700/20 transition hover:bg-indigo-800 disabled:opacity-60"
              >
                {publishing ? <BrandLoader size={18} /> : <Store size={18} />}
                {publishing ? "Publishing set…" : `Publish set of ${products.length}`}
              </button>
              <p className="text-center text-xs text-ink-soft">All images from the selected fabrics are combined into one Shopify product.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
