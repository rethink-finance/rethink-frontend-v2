/**
 * The vault image, from a dropped file to the URL that goes on chain.
 *
 * The bytes deliberately do not leave the browser when the curator picks them.
 * The upload endpoint is unauthenticated, and feeding it from every abandoned
 * draft would turn it into a general-purpose file host stocked by people who
 * never launched anything. Instead the image is squared down and carried in the
 * draft as a data URL, and it is posted once — at the moment the curator signs
 * the initialize transaction and the URL is actually needed for the metadata.
 */

/** Matches the size the backend re-encodes to; agreeing here saves a resample. */
export const VAULT_IMAGE_SIZE = 512;

export const VAULT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * The source file, not the upload. A phone photo is well over the wire budget
 * but downscales to a couple of hundred kilobytes, and rejecting it before that
 * happens would be rejecting it for no reason.
 */
export const VAULT_IMAGE_MAX_SOURCE_BYTES = 10 * 1024 * 1024;

/** An image chosen but not yet uploaded, as held in the draft. */
export const isPendingVaultImage = (value?: unknown): value is string =>
  typeof value === "string" && value.startsWith("data:image/");

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });

/**
 * Centre-crops to a square and scales to 512, returning a data URL.
 *
 * Doing this client-side is what keeps the draft inside the localStorage
 * budget: a 4 MB source would base64 to over 5 MB on its own, and drafts are
 * kept per chain. WebP is the output because it is a third of the PNG for the
 * same picture; the backend re-encodes to PNG regardless, so nothing downstream
 * depends on this choice.
 */
export const squareVaultImage = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);

  try {
    const canvas = document.createElement("canvas");
    canvas.width = VAULT_IMAGE_SIZE;
    canvas.height = VAULT_IMAGE_SIZE;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not process the image.");

    // Cover rather than contain: a vault tile is a filled square everywhere it
    // appears, and letterboxing one would make it the odd one out.
    const scale = Math.max(
      VAULT_IMAGE_SIZE / bitmap.width,
      VAULT_IMAGE_SIZE / bitmap.height,
    );
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(
      bitmap,
      (VAULT_IMAGE_SIZE - width) / 2,
      (VAULT_IMAGE_SIZE - height) / 2,
      width,
      height,
    );

    const blob =
      (await toBlob(canvas, "image/webp", 0.92)) ??
      (await toBlob(canvas, "image/png"));
    if (!blob) throw new Error("This browser could not encode the image.");

    return await toDataUrl(blob);
  } finally {
    bitmap.close();
  }
};

/**
 * Posts a pending image and returns the hosted URL to store in the metadata.
 * Anything already hosted is handed back untouched, so this is safe to call on
 * whatever the field happens to hold.
 */
export const uploadVaultImage = async (value: string): Promise<string> => {
  if (!isPendingVaultImage(value)) return value;

  const config = useRuntimeConfig();
  const blob = await (await fetch(value)).blob();

  const form = new FormData();
  form.append("file", blob, `vault-image.${blob.type === "image/png" ? "png" : "webp"}`);

  const response = await fetch(`${config.public.BACKEND_URL}/vault-image`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    // The endpoint says why a file was refused; only its own failures are
    // opaque, and those are not the curator's to interpret.
    const detail = await response.json().catch(() => undefined);
    throw new Error(detail?.message || `the image service returned ${response.status}`);
  }

  const { url } = await response.json();
  if (!url) throw new Error("the image service returned no URL");

  return url;
};
