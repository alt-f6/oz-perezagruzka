import type { Config } from "tailwindcss";

// Tailwind v4 is CSS-first: all three source apps (crm, lms, landing) already
// declare their design tokens via @theme in their own globals.css. Those
// tokens collide by name across apps with incompatible values, so they are
// NOT merged into one global @theme block; each app's tokens stay independent
// and there is currently no cross-app merging or scoping mechanism.
//
// This file carries no `content` globs (v4 auto-detects template files) and
// exists only for tooling that still reads a JS config.
const config: Config = {
  darkMode: "media",
};

export default config;
