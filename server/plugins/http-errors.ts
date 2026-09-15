import { definePlugin } from 'nitro';
import { documentCacheHeaders } from '../../lib/http-policy';

export default definePlugin((app) => {
  app.hooks.hook('response', (response) => {
    // Missing assets must not inherit the cache lifetime of real JS/audio files.
    if (response.status >= 400) {
      for (const [key, value] of Object.entries(documentCacheHeaders)) {
        response.headers.set(key, value);
      }
    }
  });
});
