import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
function getGitHash() {
    try {
        var hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        return hash || 'unknown';
    }
    catch (_a) {
        return 'unknown';
    }
}
var buildTime = new Date().toISOString();
var gitHash = getGitHash();
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(gitHash),
        __BUILD_TIME__: JSON.stringify(buildTime),
    },
});
