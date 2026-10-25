const PREVIEW_MAX = 1600

/**
 * Decode an uploaded file into two bitmaps:
 *  - full:   the original resolution (used for export)
 *  - preview: downscaled to <= PREVIEW_MAX (used for smooth live editing)
 *
 * EXIF orientation is applied automatically so portrait photos aren't sideways.
 */
export async function loadImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.')
  }

  let full
  try {
    full = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Fallback for browsers that don't accept the options object.
    full = await createImageBitmap(file)
  }

  const longest = Math.max(full.width, full.height)
  let preview = full
  if (longest > PREVIEW_MAX) {
    const scale = PREVIEW_MAX / longest
    const w = Math.max(1, Math.round(full.width * scale))
    const h = Math.max(1, Math.round(full.height * scale))
    try {
      preview = await createImageBitmap(full, {
        resizeWidth: w,
        resizeHeight: h,
        resizeQuality: 'high',
      })
    } catch {
      preview = full
    }
  }

  return {
    full,
    preview,
    width: full.width,
    height: full.height,
    name: file.name,
  }
}

/**
 * Produce a small canvas source (used for preset thumbnails) so we don't
 * re-render the full preview once per preset.
 */
export function makeThumbnail(bitmap, max = 170) {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  return c
}

export function revokeImage(loaded) {
  try {
    loaded?.preview?.close?.()
    if (loaded?.full && loaded.full !== loaded.preview) loaded.full.close?.()
  } catch {
    /* ignore */
  }
}
