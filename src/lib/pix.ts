
export function generatePixPayload(pixKey: string, amount: number, merchantName: string = 'BOLAO FC', merchantCity: string = 'BRASILIA'): string {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  };

  const gui = 'br.gov.bcb.pix';
  const merchantAccountInfo = formatField('00', gui) + formatField('01', pixKey);
  
  const amountStr = amount.toFixed(2);

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += formatField('26', merchantAccountInfo); // Merchant Account Information
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986'); // Transaction Currency (BRL)
  payload += formatField('54', amountStr); // Transaction Amount
  payload += formatField('58', 'BR'); // Country Code
  payload += formatField('59', merchantName.substring(0, 25)); // Merchant Name
  payload += formatField('60', merchantCity.substring(0, 15)); // Merchant City
  payload += formatField('62', formatField('05', 'BOLAO')); // Additional Data Field Template (Reference Label)
  
  payload += '6304'; // CRC16 ID and length

  // CRC16 Calculation
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
    }
  }
  const crcStr = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  
  return payload + crcStr;
}
