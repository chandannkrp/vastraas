import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./Logo";

/** Split-screen shell for auth pages: brand panel + form panel. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="weave-bg relative hidden flex-col justify-between bg-indigo-900 p-12 lg:flex">
        <div className="relative">
          <Logo to="/" />
        </div>
        <div className="relative max-w-md">
          <Quote className="mb-4 text-saffron-400" size={36} />
          <p className="font-display text-3xl font-medium leading-snug text-cream">
            The loom did the weaving. Let the agents do the selling.
          </p>
          <p className="mt-6 text-indigo-300">
            Clean imagery, generated shots, and ready-to-publish listings — from a
            few phone photos.
          </p>
        </div>
        <div className="relative text-sm text-indigo-300/80">
          © {new Date().getFullYear()} vastraas.ai
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-cream px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <Logo to="/" dark />
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          <p className="mt-2 text-ink-soft">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

export function Divider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-black/10" />
      <span className="text-xs font-medium uppercase tracking-wider text-ink-soft">{label}</span>
      <span className="h-px flex-1 bg-black/10" />
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-ink outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
}
