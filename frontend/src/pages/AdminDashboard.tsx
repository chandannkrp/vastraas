import { AnimatePresence, motion } from "framer-motion";
import { Bot, Building2, Server, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../lib/auth";
import { getShopifyStatus, type ConnectorStatus } from "../lib/catalog";
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
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink">vastra.ai HQ</h1>
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
    </div>
  );
}
