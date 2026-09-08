import QRCode from "qrcode";

/**
 * Generates a PNG data URL encoding the given authenticator URI as a QR code.
 *
 * Supabase's GoTrue returns an SVG data URI for TOTP enrolment that browsers
 * render as unscannable (the raw SVG contains un-encoded "#" colour values
 * that the data-URI parser treats as a fragment delimiter, and the SVG
 * itself lacks a reliable quiet zone). Generating the PNG ourselves from the
 * canonical otpauth:// URI gives us full control over size, colours, and
 * margin, and produces a universally scannable code.
 *
 * @param uri - The otpauth:// URI to encode (from `enrolled.totp.uri`).
 * @returns A PNG data URL suitable for use as an `<img>` src.
 */
export async function generateQrDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    width: 240,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}
