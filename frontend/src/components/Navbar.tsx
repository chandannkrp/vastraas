import { motion } from "framer-motion";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Logo } from "./Logo";
import { TokenBalance } from "./TokenBalance";

export function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = role === "admin" ? "/admin" : "/dashboard";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-40 border-b border-black/5 bg-cream/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo dark />
        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {role === "seller" && <TokenBalance />}
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-indigo-700"
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-indigo-800"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-indigo-700"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-indigo-700 px-5 py-2 text-sm font-semibold text-cream shadow-sm transition hover:bg-indigo-800"
              >
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </motion.header>
  );
}
