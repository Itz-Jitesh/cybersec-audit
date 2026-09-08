/**
 * Round-trip suite for the QR generator.
 *
 *   pnpm test:qr
 *
 * A QR code that cannot be decoded back to the exact otpauth:// URI it was
 * generated from is broken by definition, regardless of whether it "looks
 * right" to a human. This suite generates a QR from a known URI, decodes the
 * resulting PNG back to text, and asserts the two match byte-for-byte.
 */

import jsQR from "jsqr";
import { PNG } from "pngjs";

import { generateQrDataUrl } from "./qr.ts";

let failures = 0;

function report(pass: boolean, label: string, detail = ""): void {
  if (!pass) failures += 1;
  console.warn(
    `${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

/**
 * Decode a PNG data URL back to the text it encodes. Round-tripping is the
 * only reliable way to assert a QR contains the right payload: visual
 * inspection proves nothing, and re-encoding the PNG would mask a broken
 * generator.
 */
function decodeQrDataUrl(dataUrl: string): string | null {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  const base64 = dataUrl.slice(prefix.length);
  const buffer = Buffer.from(base64, "base64");
  const png = PNG.sync.read(buffer);
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return result ? result.data : null;
}

const VECTORS = [
  {
    uri: "otpauth://totp/dev.club:admin@cybersec.local?secret=JBSWY3DPEHPK3PXP&issuer=dev.club",
    note: "standard otpauth URI with issuer and account",
  },
  {
    uri: "otpauth://totp/dev.club:user%40example.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=dev.club&algorithm=SHA256&digits=8&period=60",
    note: "full-featured URI with SHA256, 8 digits, 60s period",
  },
  {
    // A URI containing characters that commonly break naive encoders:
    // spaces, ampersands, plus signs, percent signs, and unicode.
    uri: "otpauth://totp/My%20App:user+tag@ex.com?secret=GEZDGNBVGY3TQOJQ&issuer=My%20App",
    note: "URI with spaces, plus, and percent encoding",
  },
];

for (const vector of VECTORS) {
  const dataUrl = await generateQrDataUrl(vector.uri);

  report(
    dataUrl.startsWith("data:image/png;base64,"),
    `emits a PNG data URL (${vector.note})`,
    dataUrl.slice(0, 40),
  );

  const decoded = decodeQrDataUrl(dataUrl);
  report(
    decoded === vector.uri,
    `round-trips exact URI (${vector.note})`,
    decoded === null ? "decode returned null" : `got: ${decoded}`,
  );
}

console.warn(
  failures === 0
    ? `QR SUITE: pass (${VECTORS.length * 2} assertions)`
    : `QR SUITE: ${failures} FAILURE(S) of ${VECTORS.length * 2}`,
);

if (failures > 0) process.exitCode = 1;
