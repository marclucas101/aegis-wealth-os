export const BRAND = {
  name: "AEGIS",
  fullName: "AEGIS Strategic Wealth Architecture",
  appName: "AEGIS Wealth Operating System",
  tagline: "Institutional-grade wealth architecture platform",
  assets: {
    logo: "/brand/aegis-logo.svg",
    monogram: "/brand/aegis-monogram.svg",
  },
  dimensions: {
    logo: { width: 1734, height: 371 },
    monogram: { width: 824, height: 839 },
  },
} as const;

export type BrandLogoVariant = "full" | "mark";

export const BRAND_LOGO_VARIANTS = {
  full: {
    src: BRAND.assets.logo,
    dimensions: BRAND.dimensions.logo,
  },
  mark: {
    src: BRAND.assets.monogram,
    dimensions: BRAND.dimensions.monogram,
  },
} as const;
