# SoloHive — Photography & Travel Theme

A clean, editorial theme built for visual storytellers — photographers,
travel bloggers, and anyone whose content is driven by imagery.

## Preview

- Warm off-white background (#faf8f5)
- Terracotta accent (#b5651d)
- Large card images (320px tall) with subtle zoom on hover
- Elegant italic serif typography (Cormorant Garamond)
- Clean sans-serif UI labels (Jost)
- Borderless cards with editorial bottom dividers
- Animated underline on "Read more" links
- Uppercase spaced meta labels for a magazine feel
- Slightly desaturated avatars for warmth
- Accent top border on sidebar widgets
- Generous whitespace throughout

## Installation

1. Replace your current `style.css` with this file
2. Update the font `<link>` tags in `index.html` and `post.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
```

That's it.

## Customization

Open `style.css` and edit the CSS variables in the `:root` block at the top.
The most common changes:

```css
--color-accent: #b5651d;   /* terracotta — change to your brand colour */
--color-bg:     #faf8f5;   /* warm off-white background */
--sidebar-w:    260px;     /* sidebar width */
```

Some other accent colour ideas that work well with this theme:
- `#2d6a4f` — forest green (nature/travel)
- `#1d4e89` — deep blue (ocean/travel)
- `#6b4226` — dark brown (earthy/rustic)
- `#8b5e3c` — warm bronze (golden hour)

## Dark Mode

Full dark mode support via the toggle. Uses warm dark tones
(#18160f background) to maintain the cozy feel in low light.

## Notes

- Designed for CSS-only swap — no HTML changes required
- All SoloHive features supported
- Image captions render in italic with generous spacing
- `--radius: 3px` gives slightly soft corners — change to `0` for sharp or `8px` for round
