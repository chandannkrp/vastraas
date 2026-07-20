import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Coins, Images, LayoutGrid, Plug, Plus } from "lucide-react";
import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../lib/auth";
import { Connectors } from "./sections/Connectors";
import { Lookbooks } from "./sections/Lookbooks";
import { NewProduct } from "./sections/NewProduct";
import { Overview } from "./sections/Overview";
import { Products } from "./sections/Products";
import { Tokens } from "./sections/Tokens";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "new", label: "Add product", icon: Plus },
  { key: "products", label: "Gallery", icon: Images },
  { key: "lookbooks", label: "Lookbooks", icon: BookOpen },
  { key: "tokens", label: "Tokens", icon: Coins },
  { key: "connectors", label: "Connectors", icon: Plug },
];

export default function SellerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Seller workspace
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink">Hello, {firstName}</h1>
          <p className="mt-1 text-ink-soft">Upload fabrics and let your agents build the storefront.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* Sidebar nav */}
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
                      layoutId="tab-bg"
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

          {/* Section content */}
          <div className="min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                {tab === "overview" && <Overview onOpen={setTab} />}
                {tab === "new" && <NewProduct />}
                {tab === "products" && <Products onOpen={setTab} />}
                {tab === "lookbooks" && <Lookbooks />}
                {tab === "tokens" && <Tokens />}
                {tab === "connectors" && <Connectors />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
