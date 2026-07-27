"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function InviteQrCode({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 160 }).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!dataUrl) return null;
  return <img src={dataUrl} alt={`QR code d'invitation vers ${url}`} width={160} height={160} />;
}
