// Secure credential retrieval for cross-platform support
import { execSync } from 'child_process';
import { platform } from 'os';

const SERVICE_NAME = 'gemini-notion-extension';

/**
 * Retrieve credential from secure storage
 */
export function getCredential(name: string): string | null {
  const targetName = `GeminiNotionExtension_${name}`;
  
  try {
    switch (platform()) {
      case 'win32':
        return getWindowsCredential(targetName);
      case 'darwin':
        return getMacCredential(name);
      case 'linux':
        return getLinuxCredential(name);
      default:
        throw new Error(`Unsupported platform: ${platform()}`);
    }
  } catch (error: any) {
    console.error(`Failed to retrieve credential '${name}':`, error.message);
    return null;
  }
}

/**
 * Windows Credential Manager  
 * Note: cmdkey stores credentials but doesn't easily retrieve passwords programmatically
 * Using environment variable set by PowerShell session as workaround
 */
function getWindowsCredential(target: string): string | null {
  // Check if environment variable was set (from PowerShell profile or session)
  if (process.env.NOTION_API_KEY) {
    return process.env.NOTION_API_KEY;
  }
  
  // Try to verify credential exists (but can't retrieve password with cmdkey alone)
  try {
    const result = execSync(`cmdkey /list:"${target}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (result.includes(target)) {
      console.error(`\n⚠️  Credential stored in Windows Credential Manager, but retrieval requires environment variable.`);
      console.error(`   Run: $env:NOTION_API_KEY = (cmdkey /list:"${target}" | Select-String "Password").ToString().Split(":")[1].Trim()\n`);
    }
  } catch {
    // Credential doesn't exist
  }
  
  return null;
}

/**
 * macOS Keychain
 */
function getMacCredential(name: string): string | null {
  try {
    const password = execSync(
      `security find-generic-password -s "${SERVICE_NAME}" -a "${name}" -w`,
      { encoding: 'utf-8' }
    ).trim();
    
    return password || null;
  } catch (error) {
    return null;
  }
}

/**
 * Linux secret-tool (libsecret)
 */
function getLinuxCredential(name: string): string | null {
  try {
    const password = execSync(
      `secret-tool lookup service "${SERVICE_NAME}" account "${name}"`,
      { encoding: 'utf-8' }
    ).trim();
    
    return password || null;
  } catch (error) {
    return null;
  }
}

/**
 * Get Notion API key with fallbacks
 */
export function getNotionApiKey(): string {
  // Try secure credential storage first
  const apiKey = getCredential('API_KEY');
  
  if (apiKey) {
    return apiKey;
  }
  
  // Fallback to environment variable
  if (process.env.NOTION_API_KEY && process.env.NOTION_API_KEY !== 'secret_your_integration_token_here') {
    return process.env.NOTION_API_KEY;
  }
  
  throw new Error(
    'Notion API key not found!\n\n' +
    'Please run the setup script:\n' +
    '  Windows: .\\setup-windows.ps1\n' +
    '  Linux/Mac: ./setup-unix.sh\n\n' +
    'Or set NOTION_API_KEY environment variable.'
  );
}
