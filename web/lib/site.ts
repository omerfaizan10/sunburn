// Public site identity, used by metadata, the sitemap, JSON-LD, the masthead and the colophon.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://sunburn-five.vercel.app"
).replace(/\/$/, "");
export const SITE_NAME = "Sunburn";
export const SITE_TITLE = "Sunburn: shortwave radio fade-outs from solar flares, measured";
export const SITE_DESCRIPTION =
  "Every M and X solar flare of cycle 25 measured in 11 billion WSPR amateur radio reception reports: how much shortwave reception drops on the sunlit side, by flare class and band, plus a blind blackout detector scored against NOAA's flare list.";
export const AUTHOR = {
  name: "Omer Faizan",
  url: "https://omerfaizan.com",
  // Set in web/.env.production so the address lives in one place.
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
};
