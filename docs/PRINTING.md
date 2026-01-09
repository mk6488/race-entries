## Printing

Print styles live in `src/ui/print.css`.

### Utility classes
- `print-hide` — hide in print
- `print-only` — show only in print
- `print-avoid-break` — avoid splitting across pages
- `print-break-before` / `print-break-after` — force page breaks

### Usage
- Wrap printable areas in a container (e.g., `print-root`).
- Hide controls/nav with `print-hide`.
- Apply `print-avoid-break` to cards/rows that should stay together.
- Add captions/headers to tables for clarity; ensure widths allow wrapping.

### Adding print support to a page
1) Import `print.css` is already global; just add class hooks.
2) Hide non-essential controls (filters/buttons).
3) Test in print preview to ensure no clipping and sensible breaks.
