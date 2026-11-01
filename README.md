# Ivora Dental: demo website (plain HTML, CSS, JS)

A demo to show dentists. No framework, no build step, no dependencies.

## Open it
- Quick look: double-click `index.html`.
- Best (same as a real server): `python3 -m http.server 8000` in this folder, then open http://localhost:8000

## Files
| File | What it is |
|---|---|
| `index.html` | All sections and copy. Search and replace "Ivora Dental" / "Dr. Hana Lee" to rebrand for a doctor. |
| `css/styles.css` | Design tokens at the top (`:root`): colours, fonts, easing. Change `--primary` to recolour the whole site. |
| `js/main.js` | Scroll-driven hero, pinned sections, slider, marquee, FAQ, form. |
| `js/tooth.js` | The hero tooth: a real 3D molar drawn by a WebGL shader (no images, no libraries). It makes a full turn as you scroll while plaque is brushed off behind a foam front, then the enamel is polished and sparkles appear. Tweak `CFG` at the top (`cleanFrom`, `cleanUntil`, `spinFrom`, `spinTo`) and the colour arrays. |
| `assets/tooth/*.webp` | Only used as a still picture if a visitor's browser has no WebGL. |
| `download-images.sh` | Optional: downloads every Pexels photo into `assets/img` so the site works offline. |

## Rebranding for a doctor (about 5 minutes)
1. Replace the name, doctor name, phone, email and address in `index.html` (all dummy values now: `example@gmail.com`, `+00 000 000 0000`, `123 Example Street, City`).
2. Change `--primary` in `css/styles.css` to the clinic's colour.
3. Swap photos: any `images.pexels.com/photos/ID/...` URL can be replaced with the clinic's own image.

## Notes
- Photos are free Pexels images, linked directly. Run `bash download-images.sh` once to host them yourself.
- The booking form is a front-end demo: it validates and shows a confirmation, but sends nothing. Connect it to a backend or a form service before going live.
- Fonts: Switzer (Fontshare) for text, Geist Mono and Inter (Google Fonts).
- Respects `prefers-reduced-motion`. Fully responsive: desktop, tablet, phone.
