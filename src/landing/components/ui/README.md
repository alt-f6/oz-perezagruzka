# `src/landing/components/ui`

Landing-specific UI primitives: `Atmosphere.tsx`, `Card.tsx`, `Section.tsx`, `motion.ts`,
plus consent/legal widgets (`ConsentBanner.tsx`, `ConsentBannerClient.tsx`,
`LegalCheckbox.tsx`, `LegalSection.tsx`, `ProtectedDocumentViewer.tsx`).

## Why this exists separately from `src/shared/components/ui`

This is a deliberate duplication, not an oversight. `src/shared/components/ui` serves the
CRM/LMS dashboards: dense, functional, low-motion UI built for daily internal use.
`src/landing/components/ui` serves the public marketing site: it exists specifically to
carry heavy motion (`framer-motion` variants in `motion.ts`, ambient background effects in
`Atmosphere.tsx`), marketing-grade visual polish (`Card.tsx`, `Section.tsx` layout rhythm
tuned for conversion, not data density), and 152-FZ consent/legal UI that has no dashboard
equivalent.

Merging the two would mean either:
- adding motion/animation props to every dashboard component that don't belong there, or
- stripping landing components down to dashboard-level plainness, which would blunt the
  marketing page's actual job (converting visitors into leads).

## When to add something here vs. `src/shared/components/ui`

- If a primitive is genuinely generic (e.g. a plain button with no marketing-specific
  motion) and would be used identically in both a dashboard and the landing page, it
  belongs in `src/shared/components/ui`.
- If a primitive is landing-specific — carries marketing motion, ambient decoration, or
  legal/consent copy specific to the public site — it belongs here.
