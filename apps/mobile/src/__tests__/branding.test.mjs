import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Inari Kicchin branding', () => {
  it('uses Inari Kicchin mobile app identity', () => {
    const config = require(join(root, 'apps/mobile/app.json')).expo;
    assert.equal(config.name, 'Inari Kicchin');
    assert.equal(config.slug, 'inari-kicchin');
    assert.equal(config.ios.bundleIdentifier, 'com.inarikicchin.app');
    assert.equal(config.android.package, 'com.inarikicchin.app');
  });

  it('does not embed Sukari production hosts in EAS env', () => {
    const eas = read('apps/mobile/eas.json');
    assert.doesNotMatch(eas, /sukariburgers\.onrender\.com/i);
    assert.doesNotMatch(eas, /Sukari Burgers/i);
  });

  it('uses Inari Kicchin for web identity and metadata', () => {
    assert.match(read('apps/web/src/lib/constants/config.ts'), /APP_NAME = "Inari Kicchin"/);
    assert.match(read('apps/web/src/app/layout.tsx'), /Inari Kicchin/);
  });

  it('uses Inari Kicchin on mobile authentication interfaces', () => {
    assert.match(read('apps/mobile/src/screens/auth/LoginScreen.tsx'), /Inari Kicchin Login/);
    assert.match(read('apps/mobile/src/screens/auth/RegisterScreen.tsx'), /Inari Kicchin/);
  });
});
