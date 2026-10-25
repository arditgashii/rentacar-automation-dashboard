# Design

The QA Hub is an internal tool people keep open all day. It should feel calm and dense, like Linear,
GitHub or the Vercel dashboard, and never like a landing page.

## Tokens

All tokens live in one place, the `@theme` block of `src/app/globals.css`. Tailwind 4 reads them from
CSS, so there is no `tailwind.config.ts`; every utility (`bg-surface`, `text-muted`, `border-line`,
`bg-pass-soft`, ...) comes from these names.

| Token | Value | Used for |
| --- | --- | --- |
| `bg` | `#F7F7F5` | Page background |
| `surface` | `#FFFFFF` | Cards, tables, dialogs |
| `subtle` / `hover` | `#FBFBFA` / `#F2F1EE` | Table headers, row hover |
| `line` / `line-strong` | `#E7E5E0` / `#D6D3CC` | 1 px borders, dashed empty states |
| `ink` / `muted` / `faint` | `#1B1B19` / `#6B6963` / `#9A978F` | Text, secondary text, hints |
| `accent` | `#0F5F56` (hover `#0B4A43`) | The one accent: primary buttons, links, focus ring |

Status colours are used only for status, each with a soft tint for badges (tint background,
colour text):

| Status | Colour |
| --- | --- |
| Passed | `#1E7F4F` |
| Failed | `#C2362B` |
| Flaky, Blocked | `#B7791F` |
| Skipped, Not tested | `#7A7873` |
| Known bug | `#6E4BB5` |
| Running, In progress | `#1F5FBF` |

Priority and state in Test Plans do not borrow status colours: priority is weight (High and
Critical are darker), state is a neutral or accent badge.

## Type

- Inter through `next/font`, 14 px base, 20 px line height. Sizes: 12, 13, 14, 16, 18, 22.
- JetBrains Mono for run numbers, test IDs (`TC-005`), commands, paths and commit SHAs.
- Tabular figures everywhere numbers line up (tables get them by default, other places use `.tabular`).
- Hierarchy comes from weight and size, not from colour.

## Shape

- Radius 6 px for controls and cards, 8 px for dialogs and larger cards.
- Borders, not shadows. Only dialogs, menus and the save bar have a shadow (`--shadow-pop`).
- No gradients, no glass, no glow, no emojis, no illustrations, no "AI sparkle" icons. Icons are
  16 px Lucide icons and appear only where they help (a button without text, a file type).

## Patterns

- Every list has three states: skeleton rows while loading, a message with Retry on error, and one
  sentence with the main action when empty (`src/components/ui/states.tsx`).
- Copy is short, plain and specific: "2 of 10 runs not clean", "36 items are still Not tested.",
  never "Oops!".
- Long names are cut with an ellipsis and the full text is in the `title`; on phones some cells wrap
  instead.
- Destructive actions ask first with a dialog that names what goes and whether it can come back.
- Changes that are quick to undo (a regression result) apply at once and roll back if saving fails;
  forms with many fields (a suite, a test case, the Teams templates) have Save and warn before leaving.
- Tables turn into stacked rows below 768 px. At 390 px no page scrolls sideways (checked by
  `e2e/phone.spec.ts` on every page).
- Keyboard: everything is reachable with Tab and has a visible focus ring. In dialogs, Escape closes
  an open menu first, then the dialog. Shortcuts: `/` search and `N` new test case in Test Plans,
  `Ctrl+S` save in the test case panel.
