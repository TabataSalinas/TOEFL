import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File storage for speaking recordings and cached TTS audio.
 * Files live under STORAGE_DIR (default ./storage relative to the process cwd);
 * mount it as a volume in Docker. Keys are relative paths; path traversal is rejected.
 */
@Injectable()
export class StorageService {
  private readonly root = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), 'storage'));

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (full !== this.root && !full.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async save(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
}
