import QRCode from 'qrcode';

/**
 * Generates a Base64 QR Code string for a given text.
 * @param {string} text 
 * @returns {Promise<string>} Base64 Data URL
 */
export async function generateQRCode(text) {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      margin: 1,
      color: {
        dark: '#0f172a',  // slate-900
        light: '#ffffff'  // white
      }
    });
    return dataUrl;
  } catch (error) {
    console.error('QR Code Generation Error:', error);
    throw new Error('Failed to generate ticket QR code');
  }
}
