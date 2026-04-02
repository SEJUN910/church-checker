# Design System Document: The Editorial Sanctuary

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Vesper"**
This design system moves away from the sterile, utility-first nature of standard apps to create a space that feels like a quiet chapel at golden hour. We reject the "grid of boxes" in favor of an **Editorial Sanctuary**—a layout style that prioritizes breathing room, asymmetric grace, and a sense of calm authority.

By utilizing oversized serif displays against a backdrop of layered, warm neutrals, we create an experience that is not just functional, but spiritual. The interface should feel like a premium physical journal: tactile, intentional, and human. We break the "template" look by allowing elements to overlap slightly and by using varying surface depths to guide the eye, rather than rigid lines.

---

## 2. Colors: Tonal Depth over Borders
Our palette is a dialogue between the earth (`surface`) and the sky (`primary`).

### The "No-Line" Rule
**Standard 1px borders are strictly prohibited.** To define sections, use background color shifts. A list of community events should not be "boxed in"; instead, place it on a `surface-container-low` (#f6f3ee) background sitting atop the main `surface` (#fcf9f4). This creates a "soft edge" that feels approachable rather than restrictive.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked fine papers.
*   **Base:** `surface` (#fcf9f4)
*   **Content Areas:** `surface-container` (#f0ede8)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff) to provide a "lifted" feel.

### The "Glass & Gold" Rule
For floating action buttons or navigational overlays, use **Glassmorphism**. Apply `surface` with 80% opacity and a `20px` backdrop blur. This allows the warmth of the underlying content to bleed through. Use the `tertiary` (Gold) tokens exclusively for "Divine Accents"—small icons, active states, or high-impact callouts to provide a sense of preciousness.

---

## 3. Typography: The Voice of the Word
We pair the timeless wisdom of a serif with the modern clarity of a sans-serif.

*   **Display & Headlines (Noto Serif):** Used for scripture, sermon titles, and welcoming headers. This is our "voice." Use `display-lg` (3.5rem) with negative letter-spacing (-0.02em) for hero moments to create a high-end editorial feel.
*   **Body & Titles (Plus Jakarta Sans):** Used for functional text, community posts, and instructions. The geometric nature of Jakarta Sans provides a "supportive" feel that balances the tradition of the serif.
*   **Hierarchy Note:** Always maintain a high contrast between headline and body. If a headline is `headline-lg`, ensure the surrounding body text is `body-md` to give the headline room to "breathe" and command respect.

---

## 4. Elevation & Depth: Atmospheric Layering
We do not use shadows to create "pop"; we use them to create "atmosphere."

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-lowest` (#ffffff) card on a `surface-container-high` (#ebe8e3) background. The delta in hex value provides enough contrast for the eye to perceive depth without a single pixel of shadow.
*   **Ambient Shadows:** For elevated modals, use a custom shadow: `0px 20px 40px rgba(28, 28, 25, 0.06)`. Note the use of the `on-surface` color (#1c1c19) at a very low opacity—this mimics a natural shadow cast by warm light.
*   **The Ghost Border:** If high-contrast accessibility is required, use `outline-variant` (#c1c7cd) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components: Soft & Approachable

### Buttons
*   **Primary:** Uses `primary` (#32617d) with `on-primary` (#ffffff) text. Use `xl` (1.5rem) corner radius for a "pill" shape that feels friendly.
*   **Secondary:** Use `secondary-container` (#c4eaea). This soft blue-green provides a calm alternative for less urgent actions.
*   **Signature CTA:** Apply a subtle linear gradient from `primary` to `primary-container` at a 135-degree angle to give the button a "jeweled" depth.

### Cards & Lists
*   **No Dividers:** Prohibit the use of horizontal lines. To separate list items, use `Spacing 4` (1.4rem) or alternate background tints between `surface` and `surface-container-low`.
*   **Corners:** Use `lg` (1rem) for standard cards. Large hero cards should use `xl` (1.5rem).

### Input Fields
*   **Style:** Minimalist. Use `surface-container-highest` (#e5e2dd) as the background fill with a `md` (0.75rem) corner radius. The label should use `label-md` in `on-surface-variant` (#41484d), floating above the field.

### Spiritual Specialty Components
*   **Scripture Block:** A `surface-container-lowest` card with a `tertiary_fixed` (Gold) left-accent bar (4px wide). Use `display-sm` for the verse text.
*   **Meditation Timer:** A circular `surface-variant` track with a `primary` stroke, utilizing Glassmorphism for the center "Play" trigger.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical margins. If the left margin is `Spacing 8`, try a right margin of `Spacing 12` for editorial layouts.
*   **Do** use `tertiary` (Gold) sparingly. It should feel like a reward or a sacred highlight, not a primary UI color.
*   **Do** use white space as a structural element. If in doubt, add more space.

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on-surface` (#1c1c19) to maintain the "warmth" of the system.
*   **Don't** use "Drop Shadows" from default software settings. Always tint your shadows with the background hue.
*   **Don't** use sharp 90-degree corners. Everything in the community is "soft" and "inviting."
