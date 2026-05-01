import QRCode from "qrcode";

/** Genera un SVG en string para un payload (uid del ticket). Renderiza inline. */
export async function generateTicketQrSvg(payload: string, widthPx = 260): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: widthPx,
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

/** Devuelve un data URI PNG (base64). Útil para incrustar en imágenes/email. */
export async function generateTicketQrPngDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 480,
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
