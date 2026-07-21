import { AnimatePresence, motion } from "framer-motion";
import { Bot, Building2, Coins, Cpu, HardDrive, Image as ImageIcon, Server, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLoader } from "../components/BrandLoader";
import { Navbar } from "../components/Navbar";
import { SkeletonImage } from "../components/SkeletonImage";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../lib/auth";
import {
  deleteAdminFile,
  getAdminConfig,
  getModelUsage,
  getShopifyStatus,
  listAdminFiles,
  updateAdminConfig,
  type AdminConfig,
  type ConnectorStatus,
  type ModelUsage,
  type StoredFile,
} from "../lib/catalog";
import { usePipelineDock } from "../lib/pipelineDock";
import { AdminBusinesses } from "./sections/AdminBusinesses";
import { AdminGrowth } from "./sections/AdminGrowth";

const TABS = [
  { key: "growth", label: "Growth", icon: TrendingUp },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "system", label: "System", icon: Server },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("growth");

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Admin control room
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink">vastraas.ai HQ</h1>
          <p className="mt-1 text-ink-soft">Signed in as {user?.email}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    active ? "text-indigo-700" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="admin-tab-bg"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <t.icon size={17} className="relative z-10" />
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {tab === "growth" && <AdminGrowth />}
                {tab === "businesses" && <AdminBusinesses />}
                {tab === "system" && <SystemPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemPanel() {
  const [shopify, setShopify] = useState<ConnectorStatus | null>(null);
  useEffect(() => {
    getShopifyStatus().then(setShopify).catch(() => {});
  }, []);

  const agents = [
    { name: "Intake agent", state: "Ready" },
    { name: "Image agent", state: "Ready" },
    { name: "Listing agent", state: "Ready" },
    { name: "Marketing agent", state: "Ready" },
    { name: "Publisher (Shopify)", state: shopify?.connected ? "Ready" : "Not connected" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-700">
            <Bot size={20} />
          </div>
          <h2 className="text-xl font-semibold text-ink">Agent fleet</h2>
        </div>
        <ul className="divide-y divide-black/5">
          {agents.map((a) => (
            <li key={a.name} className="flex items-center justify-between py-3.5">
              <span className="font-medium text-ink">{a.name}</span>
              <StatusBadge status={a.state === "Ready" ? "published" : "failed"} />
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold text-ink">Shopify connection</h3>
        <p className="text-sm text-ink-soft">
          {shopify?.connected
            ? `Connected${shopify.shop_name ? ` — ${shopify.shop_name}` : ""}.`
            : "Not connected. Sellers can still stage products locally."}
        </p>
        <span
          className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-medium ${
            shopify?.connected ? "bg-emerald-50 text-emerald-700" : "bg-cream-deep text-ink-soft"
          }`}
        >
          {shopify?.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <ProvidersCard />
      <UsageCard />
      <div className="lg:col-span-2">
        <FilesCard />
      </div>
    </div>
  );
}

function ProvidersCard() {
  const { notify } = usePipelineDock();
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { getAdminConfig().then(setCfg).catch(() => {}); }, []);

  async function change(key: string, value: string) {
    setSaving(key);
    try {
      const r = await updateAdminConfig({ [key]: value });
      setCfg((c) => (c ? { ...c, effective: r.effective } : c));
      notify(`${key.replace(/_/g, " ")} → ${value}`, "success");
    } catch {
      notify("Could not update provider.", "error");
    } finally {
      setSaving(null);
    }
  }

  const rows: { key: string; label: string }[] = [
    { key: "llm_provider", label: "Text agents (LLM)" },
    { key: "image_provider", label: "Image generation" },
  ];

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><Cpu size={20} /></div>
        <h2 className="text-xl font-semibold text-ink">Model providers</h2>
      </div>
      {!cfg ? (
        <BrandLoader size={18} />
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <div key={r.key}>
              <p className="mb-1.5 text-sm font-medium text-ink">{r.label}</p>
              <div className="flex gap-1.5 rounded-xl bg-cream-deep p-1">
                {(cfg.options[r.key] ?? []).map((opt) => {
                  const active = (cfg.effective[r.key] ?? "") === opt;
                  return (
                    <button key={opt} disabled={saving === r.key} onClick={() => change(r.key, opt)}
                      className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${active ? "bg-white text-indigo-700 shadow-sm" : "text-ink-soft hover:text-ink"}`}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-xs text-ink-soft">Switches take effect immediately — no redeploy. Falls back automatically if a provider is down.</p>
        </div>
      )}
    </div>
  );
}

function UsageCard() {
  const [u, setU] = useState<ModelUsage | null>(null);
  useEffect(() => { getModelUsage().then(setU).catch(() => {}); }, []);

  const stats = u
    ? [
        { icon: Cpu, label: "Pipeline runs", value: u.runs.toLocaleString() },
        { icon: Coins, label: "Tokens used", value: u.total_tokens.toLocaleString() },
        { icon: ImageIcon, label: "Images generated", value: u.images_generated.toLocaleString() },
      ]
    : [];

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="inline-flex rounded-xl bg-saffron-300/40 p-2.5 text-saffron-600"><Coins size={20} /></div>
        <h2 className="text-xl font-semibold text-ink">Model usage</h2>
      </div>
      {!u ? (
        <BrandLoader size={18} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-cream-deep/50 p-4 text-center">
                <s.icon size={18} className="mx-auto mb-2 text-indigo-700" />
                <p className="font-display text-xl font-semibold text-ink">{s.value}</p>
                <p className="text-[11px] text-ink-soft">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-cream-deep/40 px-4 py-2.5 text-sm text-ink-soft">
            Active: <span className="font-medium text-ink">{u.providers.llm_provider}</span> (text) ·{" "}
            <span className="font-medium text-ink">{u.providers.image_provider}</span> (images)
          </div>
        </div>
      )}
    </div>
  );
}

function FilesCard() {
  const { notify } = usePipelineDock();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [backend, setBackend] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(true);

  function load(p = prefix) {
    setLoading(true);
    listAdminFiles(p, 48).then((r) => { setFiles(r.files); setBackend(r.backend); }).finally(() => setLoading(false));
  }
  useEffect(() => { load(""); /* eslint-disable-next-line */ }, []);

  async function remove(key: string) {
    if (!confirm(`Delete ${key}? This cannot be undone.`)) return;
    setFiles((f) => f.filter((x) => x.key !== key));
    try { await deleteAdminFile(key); notify("File deleted.", "success"); }
    catch { notify("Could not delete file.", "error"); load(); }
  }

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-7 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><HardDrive size={20} /></div>
          <div>
            <h2 className="text-xl font-semibold text-ink">Storage browser</h2>
            <p className="text-xs text-ink-soft">{backend ? `${backend.toUpperCase()} · ${files.length} objects` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="prefix e.g. submissions/"
            className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500" />
          <button onClick={() => load()} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-medium text-cream hover:bg-indigo-800">Search</button>
        </div>
      </div>
      {loading ? (
        <BrandLoader size={18} />
      ) : files.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-soft">No files found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((f) => {
            const isImg = /\.(png|jpe?g|webp|gif)$/i.test(f.key);
            return (
              <div key={f.key} className="group relative overflow-hidden rounded-xl border border-black/5">
                {isImg && f.url ? (
                  <SkeletonImage src={f.url} className="aspect-square w-full" />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-cream-deep text-ink-soft/40 text-[10px]">file</div>
                )}
                <button onClick={() => remove(f.key)} title="Delete"
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-terracotta opacity-0 transition group-hover:opacity-100">
                  <Trash2 size={12} />
                </button>
                <p className="truncate bg-white px-1.5 py-1 text-[9px] text-ink-soft" title={f.key}>{f.key.split("/").pop()}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
