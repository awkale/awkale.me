# Fonts

Self-hosted, per ADR-0004. Not loaded from a third party: the site being replaced
pulled `harfang-pro` from Adobe Fonts via a blocking Typekit script, which cost
an extra DNS and TLS handshake on every page and made the typography depend on a
live subscription. **That subscription has lapsed** — access appears to persist,
which is the worst shape of dependency: it works today, will stop at an unknown
date, and fails silently with no deploy on our side.

All three faces below are **SIL Open Font License 1.1**, so self-hosting is
permitted outright. That matters because Adobe Fonts access does *not* confer
self-hosting rights — different licences, and the paths do not blend.

| File | Family | Source | Licence |
| --- | --- | --- | --- |
| `fraunces-latin-var.woff2` | Fraunces | Google Fonts | OFL 1.1 |
| `inter-latin-var.woff2` | Inter | Google Fonts | OFL 1.1 |
| `jetbrains-mono-latin-var.woff2` | JetBrains Mono | Google Fonts | OFL 1.1 |

## These are latin-subset builds

Each is the `U+0000-00FF` subset of the variable font — the slice Google Fonts
serves for basic latin. Small (67 / 48 / 31 KB) and enough for the site today.

**One thing to check before launch.** The archive currently holds exactly one
non-ASCII string across 1,228 composer / work / hall / soloist / conductor
records, because diacritics were never captured: it stores `Dvorak`,
`Saint-Saens`, `Bartok`, `Faure`, `Petroushka`. ADR-0007's IMSLP pass restores
them (`Dvořák`, `Saint-Saëns`, `Bartók`, `Fauré`), and ADR-0008 stores slugs
separately so a name can be corrected without moving a URL.

`ř`, `á`, `ó` and `ë` are **outside** `U+0000-00FF`. So when that pass runs,
re-cut these subsets to cover latin-extended or the restored names will render
in a fallback face. Nothing breaks before then, and nothing about it is visible
in the current data — which is exactly why it is written down here.

## Re-cutting

The originals are variable fonts; these are Google's pre-subset slices. To widen
coverage, pull the `latin-ext` subset alongside `latin` from the same CSS
endpoint and add a second `@font-face` with the matching `unicode-range`, rather
than replacing these — that keeps the common case small.

`harfang-pro` remains an option if you want the old display face back, but it is
a purchase: a webfont licence direct from Coppers & Brasses.
