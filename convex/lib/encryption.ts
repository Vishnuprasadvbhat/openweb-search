// Simple encryption utility for API keys in Convex
// Uses base64 encoding with obfuscation

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

// Get encryption key from environment
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    throw new EncryptionError(
      `ENCRYPTION_KEY not found. Please set it in Convex environment: npx convex env set ENCRYPTION_KEY "your-32-char-key"`
    );
  }
  
  return key;
}

// Simple obfuscation for API keys
// This provides basic protection against casual viewing of database contents
export async function encrypt(text: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    
    // Simple obfuscation: reverse the string, interleave with key chars, and base64 encode
    const reversed = text.split('').reverse().join('');
    let obfuscated = '';
    
    for (let i = 0; i < reversed.length; i++) {
      obfuscated += reversed[i];
      obfuscated += key[i % key.length];
    }
    
    // Base64 encode the result using btoa (works in Convex)
    const encoded = btoa(obfuscated);
    
    // Add a version prefix
    return 'v1:' + encoded;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(`Encryption failed: ${error}`);
  }
}

// Decrypt a string
export async function decrypt(encryptedText: string): Promise<string> {
  try {
    const key = getEncryptionKey();
    
    // Check version prefix
    if (!encryptedText.startsWith('v1:')) {
      throw new EncryptionError('Invalid encrypted format');
    }
    
    // Remove prefix and decode base64 using atob (works in Convex)
    const encoded = encryptedText.substring(3);
    const obfuscated = atob(encoded);
    
    // Remove interleaved key characters
    let reversed = '';
    for (let i = 0; i < obfuscated.length; i += 2) {
      reversed += obfuscated[i];
    }
    
    // Reverse to get original
    const original = reversed.split('').reverse().join('');
    
    return original;
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error;
    }
    throw new EncryptionError(`Decryption failed: ${error}`);
  }
}

// Check if a string is encrypted
export function isEncrypted(text: string): boolean {
  return !!text && text.startsWith('v1:');
}