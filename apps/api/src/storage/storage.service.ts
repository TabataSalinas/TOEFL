import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly root = path.resolve(process.cwd(), 'storage');

  private resolve(key: string): string {
    return path.join(this.root, key);
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

    await fs.mkdir(path.dirname(file), {
      recursive: true,
    });

    await fs.writeFile(file, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
}
