import { useState } from "react";

/**
 * Image with a shimmering skeleton until it loads, then a soft fade-in.
 * Lazy-loads and decodes async so grids of thumbnails don't block. Drop-in
 * replacement for <img> wherever a remote/thumbnail image is shown.
 */
export function SkeletonImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  rounded = "rounded-none",
}: {
  src: string | undefined;
  alt?: string;
  className?: string;
  imgClassName?: string;
  rounded?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-cream-deep ${rounded} ${className}`}>
      {/* Shimmer while not yet loaded */}
      {!loaded && !errored && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, rgba(0,0,0,0.03) 20%, rgba(95,67,196,0.08) 45%, rgba(245,158,11,0.08) 55%, rgba(0,0,0,0.03) 75%)",
            backgroundSize: "220% 100%",
            animation: "vastra-shimmer 1.4s linear infinite",
          }}
        />
      )}
      {src && !errored && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"} ${imgClassName}`}
        />
      )}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center text-ink-soft/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
      )}
      <style>{`@keyframes vastra-shimmer{0%{background-position-x:220%}100%{background-position-x:-20%}}`}</style>
    </div>
  );
}
