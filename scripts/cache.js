const fs = require('fs').promises;
const path = require('path');

class BuildCache {
    constructor() {
        this.cacheDir = path.join(__dirname, '..', '.cache');
        this.cacheFile = path.join(this.cacheDir, 'build-cache.json');
    }

    async init() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }

    async get(key) {
        try {
            const cache = await this.readCache();
            const entry = cache[key];
            
            if (!entry) return null;
            
            // Check if cache is still valid (24 hours)
            if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
                delete cache[key];
                await this.writeCache(cache);
                return null;
            }
            
            return entry.data;
        } catch (error) {
            console.log('Cache read error:', error);
            return null;
        }
    }

    async set(key, data) {
        try {
            const cache = await this.readCache();
            cache[key] = {
                timestamp: Date.now(),
                data
            };
            await this.writeCache(cache);
        } catch (error) {
            console.log('Cache write error:', error);
        }
    }

    async readCache() {
        try {
            const data = await fs.readFile(this.cacheFile, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return {};
        }
    }

    async writeCache(cache) {
        await fs.writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
    }

    async clear() {
        try {
            await fs.writeFile(this.cacheFile, '{}');
        } catch (error) {
            console.log('Cache clear error:', error);
        }
    }
}

module.exports = new BuildCache(); 