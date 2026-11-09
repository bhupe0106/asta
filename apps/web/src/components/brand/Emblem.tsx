import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EmblemProps {
  size?: number;
  className?: string;
  glow?: boolean;
  animated?: boolean;
}

/** Original five-leaf grimoire emblem. Not derived from any copyrighted artwork. */
export function Emblem({ size = 48, className, glow = false, animated = false }: EmblemProps) {
  const uid = useId().replace(/[:]/g, "");
  const leaf = `leaf-${uid}`;
  const core = `core-${uid}`;
  const Wrapper = animated ? motion.g : "g";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={cn(glow && "drop-shadow-[0_0_18px_rgba(181,44,67,0.45)]", className)}
      role="img"
      aria-label="ASTA five-leaf emblem"
    >
      <defs>
        <radialGradient id={leaf} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#C4384F" />
          <stop offset="55%" stopColor="#8B1E2D" />
          <stop offset="100%" stopColor="#320A11" />
        </radialGradient>
        <radialGradient id={core} cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#F5F2ED" />
          <stop offset="55%" stopColor="#C6A66A" />
          <stop offset="100%" stopColor="#7957C8" />
        </radialGradient>
        <g id={`petal-${uid}`}>
          <path
            d="M100 96 C 82 84, 68 64, 74 45 C 79 29, 94 26, 100 40 C 106 26, 121 29, 126 45 C 132 64, 118 84, 100 96 Z"
            fill={`url(#${leaf})`}
            stroke="#C6A66A"
            strokeOpacity="0.32"
            strokeWidth="1.2"
          />
          <path d="M100 48 L100 88" stroke="#08090D" strokeOpacity="0.45" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      </defs>
      <circle cx="100" cy="100" r="86" fill="none" stroke="#C6A66A" strokeOpacity="0.2" strokeWidth="1" />
      <circle
        cx="100"
        cy="100"
        r="73"
        fill="none"
        stroke="#C6A66A"
        strokeOpacity="0.12"
        strokeWidth="1"
        strokeDasharray="1 7"
      />
      <Wrapper
        {...(animated
          ? {
              animate: { rotate: 360 },
              transition: { duration: 120, repeat: Infinity, ease: "linear" },
              style: { transformOrigin: "100px 100px" },
            }
          : {})}
      >
        {[0, 72, 144, 216, 288].map((angle) => (
          <use key={angle} href={`#petal-${uid}`} transform={`rotate(${angle} 100 100)`} />
        ))}
      </Wrapper>
      <circle cx="100" cy="100" r="15" fill="#08090D" stroke="#C6A66A" strokeOpacity="0.5" />
      <circle cx="100" cy="100" r="8" fill={`url(#${core})`} />
      <circle cx="100" cy="100" r="3" fill="#08090D" />
    </svg>
  );
}
