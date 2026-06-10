import Image from "next/image";

import { BRAND, BRAND_LOGO_VARIANTS, type BrandLogoVariant } from "@/lib/brand";

const SIZE_CLASSES = {
  full: {
    sm: "h-8 w-auto max-w-[11rem]",
    md: "h-10 w-auto max-w-[14rem]",
    lg: "h-12 w-auto max-w-[17rem]",
    hero: "h-14 w-auto max-w-[20rem] sm:h-16 sm:max-w-[24rem]",
  },
  mark: {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    hero: "h-16 w-16 sm:h-20 sm:w-20",
  },
} as const;

export type BrandLogoSize = keyof typeof SIZE_CLASSES.full;

type BrandLogoProps = {
  /** `full` = wordmark lockup; `mark` = tri-spire monogram */
  variant?: BrandLogoVariant;
  size?: BrandLogoSize;
  className?: string;
  priority?: boolean;
};

/**
 * Responsive AEGIS brand mark. Asset paths come from `lib/brand.ts`.
 * SVGs render via Next.js `Image` (unoptimized) for crisp scaling on dark UI.
 */
export default function BrandLogo({
  variant = "full",
  size = "md",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const { src, dimensions } = BRAND_LOGO_VARIANTS[variant];
  const sizeClass = SIZE_CLASSES[variant][size];

  return (
    <Image
      src={src}
      alt={BRAND.fullName}
      width={dimensions.width}
      height={dimensions.height}
      className={[sizeClass, className].filter(Boolean).join(" ")}
      priority={priority}
      unoptimized
    />
  );
}
