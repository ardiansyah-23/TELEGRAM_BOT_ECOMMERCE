import crypto from 'crypto';

/**
 * Validates the Telegram Web App initData string.
 * @param initData The raw initData string received from Telegram Web App
 * @param botToken The bot token used for validation
 * @returns boolean True if the data is valid and trusted
 */
export function validateInitData(initData: string, botToken: string): boolean {
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) return false;
    
    // Remove hash from params to build the data-check-string
    urlParams.delete('hash');
    
    // Sort keys alphabetically
    const keys = Array.from(urlParams.keys()).sort();
    
    // Build data-check-string
    const dataCheckString = keys.map(key => `${key}=${urlParams.get(key)}`).join('\n');
    
    // Calculate secret key using WebAppData
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Calculate the expected hash
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    return calculatedHash === hash;
  } catch (error) {
    console.error('Error validating initData', error);
    return false;
  }
}

/**
 * Parses the user object from a validated initData string.
 */
export function parseInitDataUser(initData: string): any | null {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
    return null;
  } catch (error) {
    return null;
  }
}
