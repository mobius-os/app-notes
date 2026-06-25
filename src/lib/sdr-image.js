// Flatten an uploaded image to SDR sRGB before it is stored.
//
// WHY: modern Android cameras (and Google Photos) default to "Ultra HDR" JPEGs —
// an SDR base image plus an embedded gain map (MPF secondary image + an
// `hdrgm:Version` XMP block, per Adobe/Google's hdr-gain-map spec). When Chrome
// on Android paints such an image it promotes the whole display surface to HDR
// and tone-shifts every surrounding SDR pixel (the shell drawer, the app
// background) for as long as the image is on screen. The shift is real to the
// eye but INVISIBLE to screenshots/screen-recording, which are captured in SDR —
// so it never shows up in any capture and looks like a phantom bug. It also
// crosses the iframe boundary because the promotion is a property of the device
// display surface, not the DOM.
//
// THE FLATTEN: drawing the decoded image onto a 2D <canvas> and re-encoding it
// drops the gain map and any wide-gamut/HDR ICC profile. A 2D canvas's backing
// store is sRGB SDR by default (we do NOT request `colorSpace: 'display-p3'`),
// so toBlob() emits a plain SDR sRGB image with no `hdrgm`/MPF metadata. That is
// the guaranteed fix for every newly attached image.
//
// SAFETY: this is best-effort and NON-DESTRUCTIVE on failure. If decode or
// encode fails for any reason (HEIC/AVIF the browser can't decode to a canvas, a
// tainted/odd file, a missing API in a non-browser test env), we return the
// ORIGINAL File unchanged rather than lose the attachment. A degraded-but-stored
// image always beats a dropped one.

// Cap the longest side so a 12-megapixel phone photo doesn't land as a multi-MB
// blob. 2048 keeps thumbnails and the in-editor preview crisp without bloating
// storage; images already smaller are left at native resolution.
const MAX_DIMENSION = 2048

// Quality for the re-encode. ~0.9 is visually lossless for photos at this size
// while still shrinking a typical Ultra HDR capture by ~5x.
const ENCODE_QUALITY = 0.9

function isBrowserImageEnv() {
  return (
    typeof document !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof createImageBitmap === 'function'
  )
}

// Decode a File to an ImageBitmap, falling back to an <img> element decode if
// createImageBitmap rejects (some formats decode in <img> but not the bitmap
// path, and vice versa). Returns null if neither path can decode it.
async function decodeImage(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    // <img> fallback: load via object URL, await decode().
  }
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      try {
        if (img.decode) await img.decode()
      } catch {}
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function sourceDimensions(source) {
  // ImageBitmap exposes width/height; HTMLImageElement uses naturalWidth/Height.
  const w = source.naturalWidth || source.width || 0
  const h = source.naturalHeight || source.height || 0
  return { w, h }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((blob) => resolve(blob), type, quality)
    } else {
      resolve(null)
    }
  })
}

// Choose the output encoding. Re-encode to JPEG for opaque photo formats (the
// common Ultra HDR case) and to WebP when the source may carry transparency
// (PNG/WebP) so we don't flatten an alpha channel onto black. GIF is handled
// upstream (passed through, never reaches here). Either way the 2D canvas
// guarantees SDR sRGB output.
function outputFormat(file) {
  const t = (file.type || '').toLowerCase()
  const mayHaveAlpha = t.includes('png') || t.includes('webp')
  return mayHaveAlpha
    ? { type: 'image/webp', ext: 'webp' }
    : { type: 'image/jpeg', ext: 'jpeg' }
}

// Re-derive a sensible filename for the flattened blob: keep the original base
// name, swap the extension to match the new encoding so the stored ext and the
// markdown ref stay truthful.
function renameForOutput(originalName, ext) {
  const base = String(originalName || 'image').replace(/\.[^./\\]+$/, '')
  return `${base}.${ext}`
}

// Convert an uploaded image File to an SDR sRGB blob. Returns a File (same shape
// the caller passes to putAttachment). On any failure, returns the ORIGINAL file
// untouched so the attachment is never lost.
export async function toSdrImage(file) {
  if (!file || !(file.type || '').startsWith('image/')) return file
  const type = (file.type || '').toLowerCase()
  // SVG is vector + same-origin trusted markup; canvas-flattening it would
  // rasterize and lose scalability for no HDR benefit (it carries no gain map).
  if (type.includes('svg')) return file
  // GIF carries no Ultra HDR gain map (it's an indexed/SDR format), so it never
  // triggers the bug — and a single canvas draw would silently flatten an
  // ANIMATED GIF to its first frame. Pass it through untouched.
  if (type.includes('gif')) return file
  if (!isBrowserImageEnv()) return file

  let source = null
  try {
    source = await decodeImage(file)
    if (!source) return file

    const { w, h } = sourceDimensions(source)
    if (!w || !h) return file

    const longest = Math.max(w, h)
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1
    const outW = Math.max(1, Math.round(w * scale))
    const outH = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    // Default 2D context => sRGB color space => SDR. Explicitly NOT display-p3.
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(source, 0, 0, outW, outH)

    const { type, ext } = outputFormat(file)
    let blob = await canvasToBlob(canvas, type, ENCODE_QUALITY)
    // Some engines refuse a requested type and emit PNG; if the encode produced
    // nothing usable, keep the original rather than store an empty/odd blob.
    if (!blob || !blob.size) return file

    const outName = renameForOutput(file.name, ext)
    // Wrap as a File so putAttachment's extFromType/extFromName see the new type.
    try {
      return new File([blob], outName, { type: blob.type || type })
    } catch {
      // File constructor unavailable (older env): hand back the Blob with the
      // fields putAttachment reads bolted on.
      blob.name = outName
      return blob
    }
  } catch {
    return file
  } finally {
    if (source && typeof source.close === 'function') {
      try { source.close() } catch {}
    }
  }
}
