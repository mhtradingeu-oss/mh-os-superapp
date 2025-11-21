/**
 * Document Logo Handler
 * Manages logo loading, caching, and embedding for documents
 */

import { promises as fs } from 'fs';
import path from 'path';

class DocumentLogoService {
  private readonly LOGO_PATH = path.join(
    process.cwd(),
    'client/src/assets/mh-logo.png'
  );
  private logoBase64Cache: string | null = null;
  private logoBufferCache: Buffer | null = null;

  /**
   * Get logo as base64 data URI (for HTML)
   */
  async getLogoBase64(): Promise<string> {
    if (this.logoBase64Cache) {
      return this.logoBase64Cache;
    }

    try {
      const logoBuffer = await this.getLogoBuffer();
      this.logoBase64Cache = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      return this.logoBase64Cache;
    } catch (error) {
      console.error('[DocumentLogoService] Error encoding logo to base64:', error);
      return '';
    }
  }

  /**
   * Get logo as Buffer (for PDF embedding)
   */
  async getLogoBuffer(): Promise<Buffer> {
    if (this.logoBufferCache) {
      return this.logoBufferCache;
    }

    try {
      this.logoBufferCache = await fs.readFile(this.LOGO_PATH);
      return this.logoBufferCache;
    } catch (error) {
      console.error('[DocumentLogoService] Error reading logo file:', error);
      throw new Error('Logo file not found');
    }
  }

  /**
   * Check if logo exists
   */
  async logoExists(): Promise<boolean> {
    try {
      await fs.access(this.LOGO_PATH);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear logo cache (useful after logo update)
   */
  clearCache(): void {
    this.logoBase64Cache = null;
    this.logoBufferCache = null;
  }
}

export const documentLogoService = new DocumentLogoService();
