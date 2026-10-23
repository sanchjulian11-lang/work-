import { createHash } from "node:crypto";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export function inspectUpload(
  name: string,
  bytes: Buffer,
): { mime: string; extension: string; sha256: string } {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES)
    throw new Error("Upload a non-empty file no larger than 4 MB");
  let mime = "",
    extension = "";
  if (bytes.subarray(0, 5).toString() === "%PDF-" && /\.pdf$/i.test(name)) {
    mime = "application/pdf";
    extension = "pdf";
  } else if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    /\.png$/i.test(name)
  ) {
    mime = "image/png";
    extension = "png";
  } else if (
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    /\.jpe?g$/i.test(name)
  ) {
    mime = "image/jpeg";
    extension = "jpg";
  } else
    throw new Error(
      "Only PDF, PNG, or JPEG files with matching file signatures are accepted",
    );
  return {
    mime,
    extension,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
