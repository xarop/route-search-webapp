# Design System (Minimalist)

Inspired by xarop.com: clean, light, generous whitespace, subtle borders, no heavy shadows.

## Principles
- Less is more: remove decorative elements.
- Neutral palette: white background, dark text, single accent.
- Generous spacing and readable typography.
- Flat surfaces, thin borders, no gradients.

## Colors
- Background: #ffffff
- Surface: #f8fafc
- Text: #111827
- Muted: #6b7280
- Accent: #111827 (or #2563eb for links)
- Border: #e5e7eb

## Typography
- Font: system-ui, -apple-system, Segoe UI, Roboto, sans-serif
- Base size: 16px
- Headings: 600 weight, tight letter-spacing
- Muted text: 0.875rem

## Spacing
- Section padding: 1.5rem
- Card padding: 1rem
- Gap: 1rem

## Components
- Buttons: flat, 6px radius, no shadow, solid fill
- Cards: 1px border, 8px radius, white background
- Tables: thin bottom borders, no zebra
- Inputs: 1px border, 6px radius

## Layout
- Max width: 1100px (or 1200px for dashboards)
- Centered content with side padding

## Theme
- Support light/dark via toggle, persist in localStorage.
- Use CSS variables for colors.

## Responsive
- Hamburger menu on mobile (<=768px).
- Stack columns on small screens.
- Tables scroll horizontally.

## Icons
- Use inline SVG icons only. Do not use unicode/emoji icons.

## Developed in Barcelona by xarop.com
https://xarop.com