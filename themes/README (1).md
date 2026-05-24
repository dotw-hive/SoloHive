# SoloHive — Tech/Dev Dark Theme

A dark, terminal-inspired theme for developers and tech bloggers.

## Preview

- Deep dark background (#0d1117 — GitHub dark style)
- Terminal green accent (#39d353)
- Monospace fonts throughout UI elements
- Sharp corners for a technical feel
- Accent left border on post cards
- Terminal prompt prefix (`> `) on site title
- Terminal prompt prefix (`$ `) on sidebar name
- Green glow on card hover
- Code blocks with dark background and accent left border
- Slightly desaturated card images for a consistent dark feel

## Installation

1. Replace your current `style.css` with this file
2. Update the font `<link>` tags in `index.html` and `post.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
```

That's it.

## Customization

Open `style.css` and edit the CSS variables in the `:root` block at the top.
The most common changes:

```css
--color-accent: #39d353;   /* change to your preferred accent colour */
--color-bg:     #0d1117;   /* page background */
--sidebar-w:    280px;     /* sidebar width */
```

## Light Mode

This theme defaults to dark mode but includes a full light mode palette
triggered by the dark mode toggle. Light mode uses a GitHub-inspired
light colour scheme with a darker green accent for readability.

## Notes

- Designed for CSS-only swap — no HTML changes required
- All SoloHive features supported (YouTube embeds, image captions, share buttons, etc.)
- `--radius: 2px` gives sharp corners throughout — change to `8px` for a rounder feel
