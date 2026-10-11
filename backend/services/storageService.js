const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(__dirname, '..', 'private-verification-storage');

class LocalPrivateStorage {
  constructor(root = process.env.VERIFICATION_STORAGE_LOCAL_PATH || DEFAULT_ROOT) {
    this.root = path.resolve(root);
  }

  async put(buffer, metadata = {}) {
    const extension = metadata.extension ? `.${String(metadata.extension).replace(/[^a-z0-9]/gi, '').slice(0, 8)}` : '';
    const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${extension}`;
    const destination = this.resolve(key);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fs.writeFile(destination, buffer, { mode: 0o600 });
    return key;
  }

  resolve(key) {
    if (!key || path.isAbsolute(key)) throw Object.assign(new Error('Invalid storage key'), { statusCode: 400 });
    const destination = path.resolve(this.root, key);
    if (!destination.startsWith(`${this.root}${path.sep}`)) {
      throw Object.assign(new Error('Invalid storage key'), { statusCode: 400 });
    }
    return destination;
  }

  async read(key) {
    return fs.readFile(this.resolve(key));
  }
}

const createStorageService = () => {
  const provider = (process.env.VERIFICATION_STORAGE_PROVIDER || 'local').toLowerCase();
  if (provider !== 'local') throw new Error(`Unsupported verification storage provider: ${provider}`);
  return new LocalPrivateStorage();
};

module.exports = { LocalPrivateStorage, createStorageService };
