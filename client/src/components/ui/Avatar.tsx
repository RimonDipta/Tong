import { Users } from "lucide-react";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-24 w-24 text-3xl",
} as const;

const dotSizes = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
  xl: "h-5 w-5",
} as const;

/*
 * Muted, deterministic background per name so
 * initials are easy to tell apart.
 */
const tints = [
  "bg-zinc-800 text-zinc-300",
  "bg-sky-950 text-sky-300",
  "bg-emerald-950 text-emerald-300",
  "bg-amber-950 text-amber-300",
  "bg-rose-950 text-rose-300",
  "bg-violet-950 text-violet-300",
  "bg-teal-950 text-teal-300",
];

function tintFor(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return tints[Math.abs(hash) % tints.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface AvatarProps {
  name?: string;
  src?: string;
  size?: keyof typeof sizes;
  online?: boolean;
  group?: boolean;
  className?: string;
}

export default function Avatar({
  name = "",
  src,
  size = "md",
  online = false,
  group = false,
  className = "",
}: AvatarProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`flex items-center justify-center overflow-hidden rounded-full font-medium ${sizes[size]} ${
          src ? "bg-zinc-800" : tintFor(name)
        }`}
      >
        {src ? (
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : group ? (
          <Users className="h-1/2 w-1/2" aria-hidden />
        ) : (
          initials(name)
        )}
      </span>

      {online && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-[var(--surface)] ${dotSizes[size]}`}
          aria-label="Online"
        />
      )}
    </span>
  );
}
