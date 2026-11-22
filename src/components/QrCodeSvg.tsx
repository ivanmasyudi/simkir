import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrCodeSvgProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeSvg: React.FC<QrCodeSvgProps> = ({
  value,
  size = 96,
  className = '',
}) => {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    let active = true;
    QRCode.toString(
      value || 'SIMKIR',
      {
        type: 'svg',
        margin: 1,
        width: size,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      },
      (err, svg) => {
        if (!active) return;
        if (!err && svg) {
          setSvgContent(svg);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svgContent) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-500 ${className}`}
      >
        QR
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`inline-block shrink-0 ${className}`}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
};
