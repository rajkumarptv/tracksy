# Tracksy design guidelines

Tracksy is a money app, so the interface should feel calm, precise and trustworthy. These rules keep every page consistent. The tokens live in `src/index.css` (mirrored for chart code in `src/theme.js`).

## Colour carries meaning, never decoration
| Meaning | Token | Use for |
|---|---|---|
| Brand / action | `--accent`, `--accent-btn` | Primary buttons, links, active navigation, focus rings |
| Income / positive | `--green` | Money coming in, savings, "on track" |
| Expense / negative | `--red` (fills, icons), `--red-text` (text) | Money going out, overspending, errors |
| Warning | `--orange` (fills, icons), `--orange-text` (text) | Needs attention soon (low balance, due date) |
| Info / neutral | `--blue`, `--text3` | Transfers, hints |
| Surfaces | `--bg`, `--surface`, `--surface2`, `--border` | Page, cards, wells, dividers |

- **One brand colour.** No second accent, no purple/neon, no gradients (a faint fill under a chart line is fine).
- **Green and red are reserved for money meaning.** Don't use them as decoration or for categories. Charts use the categorical palette in `theme.js` (`pie`), which excludes both.
- **Never rely on colour alone.** Every amount keeps its sign (`+`/`−`), and status badges carry text or an icon. About 1 in 12 men can't tell red from green.
- **Contrast.** Text must reach 4.5:1 (WCAG AA). Use `--red-text` / `--orange-text` for text and keep `--red` / `--orange` for fills and icons. `src/lib/contrast.test.mjs` enforces this for both themes, so run `npm test` after changing any colour.
- **Dark mode** uses the same meanings with lighter shades. Don't hard-code a colour that only works on white.

## Typography
- Inter, with tabular numerals on every money figure so digits line up in columns.
- Scale: 12 · 13 · 14 (body) · 16 · 20 · 24 · 32 (`--text-xs … --text-2xl`).
- Weights 400 / 500 / 600. Use 700 only for the single most important figure on a screen. Avoid 800 and 900.
- Page title 20–24 px / 600. Section title 14–16 px / 600. Labels 12–13 px, `--text3`.

## Shape and spacing
- Radius: **6** chips · **8** buttons and inputs · **12** cards · **16** modals and sheets (`--radius-xs/sm/radius/lg`).
- Spacing follows a 4 px grid (`--space-1 … --space-10`). Cards use 20 px padding (14 px on phones).
- Elevation: a 1 px border does the work and shadows stay faint (`--shadow-xs`, `--shadow-sm`). No glows, no coloured shadows.

## Components
- Buttons are 40 px tall (32 small, 44 large): `.btn-primary` for the one main action per screen, `.btn-ghost` for secondary, `.btn-danger` for destructive. Never put two primary buttons side by side.
- Inputs are 40 px with a visible label above. Errors appear next to the field and in a top-level message, with an icon and text.
- Use icons from the icon libraries (Phosphor in the shell, Lucide in pages) for interface chrome. Emoji is only for user-chosen content such as categories and goals.
- Tables use `className="table"`: sticky-feeling header, right-aligned numeric columns (`.num`), subtle row hover.
- Every interactive element needs a visible focus state and a hit area of at least 40 px on touch screens.

## Writing
- Sentence case for headings and buttons ("Create account", not "Create Account →"). No exclamation marks, no arrows in labels.
- Say what happened and what to do next. Don't make claims we can't prove (for example "bank-grade").
- Amounts: `₹1,23,456` with the Indian grouping, always with the sign for flows.

## Breakpoints
- ≤ 768 px: phone layout (bottom navigation, single column, sheets for modals).
- ≥ 1024 px: full desktop layout with the sidebar and split sign-in screen.
