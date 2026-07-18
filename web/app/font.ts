// Single import point for the site's fonts — the Geist family only.
//
// - GeistSans        → body (`--font-geist-sans`, variable 100–900)
// - GeistMono        → labels, eyebrows, numerics, addresses (`--font-geist-mono`)
// - GeistPixelSquare → headings (`--font-geist-pixel-square`, weight 500 only);
//   the base-layer h1–h6 rule in globals.css points `--font-heading` at it.
//
// The other pixel variants (Grid/Circle/Triangle/Line) are available for
// decorative one-offs — import from here and apply `.className` locally so the
// face is only loaded where used.
export { GeistSans } from 'geist/font/sans';
export { GeistMono } from 'geist/font/mono';
export {
  GeistPixelSquare,
  GeistPixelGrid,
  GeistPixelCircle,
  GeistPixelTriangle,
  GeistPixelLine,
} from 'geist/font/pixel';
