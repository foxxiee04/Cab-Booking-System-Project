export interface QRCodeGenerateOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const buildQrServerUrl = (text: string, options: QRCodeGenerateOptions = {}) => {
  const width = options.width || 256;
  const margin = options.margin || 2;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${width}&margin=${margin}&data=${encodeURIComponent(text)}`;
};

export const generateQRCodeDataUrl = async (
  text: string,
  options: QRCodeGenerateOptions = {}
): Promise<string> => {
  return buildQrServerUrl(text, options);
};

export const generateQRCodeCanvas = async (
  text: string,
  canvas: HTMLCanvasElement,
  options: QRCodeGenerateOptions = {}
): Promise<void> => {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context unavailable');
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  const src = buildQrServerUrl(text, options);

  await new Promise<void>((resolve, reject) => {
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = () => reject(new Error('Failed to generate QR image'));
    image.src = src;
  });
};

export const buildVNPayQRString = (paymentUrl: string): string => paymentUrl;

export const buildMoMoDeeplink = (momoDeeplink: string): string => momoDeeplink;

export const getVNPayQRCodeUrl = (vnpayResponse: any): string | null => {
  return vnpayResponse?.qrCodeUrl || null;
};

export const getMoMoQRCodeUrl = (momoResponse: any): string | null => {
  return momoResponse?.qrCodeUrl || null;
};

export const buildMobilePaymentDeeplink = (
  method: 'MOMO' | 'VNPAY' | 'CARD',
  params: {
    amount: number;
    orderId: string;
    deeplink?: string;
    payUrl?: string;
  }
): string => {
  if (method === 'MOMO' && params.deeplink) {
    return params.deeplink;
  }

  if (method === 'VNPAY' && params.payUrl) {
    return params.payUrl;
  }

  return '';
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    return false;
  }
};

export const downloadQRCode = async (
  text: string,
  filename: string = 'qrcode.png'
): Promise<void> => {
  const dataUrl = await generateQRCodeDataUrl(text);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
