import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const output = execSync('docker inspect --format="{{.State.Running}} {{.State.StartedAt}} {{.Config.Image}}" aegis-heimdall 2>&1', {
            timeout: 3000,
            encoding: 'utf8',
        }).trim();
        const running = output.includes('true');

        // Parse started time and image name
        const parts = output.split(' ');
        const startedAt = parts[1] || '';
        const image = parts[2] || 'aegis-heimdall';

        let uptime = '';
        if (running && startedAt) {
            try {
                const startMs = new Date(startedAt).getTime();
                const nowMs = Date.now();
                const diffSec = Math.floor((nowMs - startMs) / 1000);
                if (diffSec < 60) uptime = `${diffSec}s`;
                else if (diffSec < 3600) uptime = `${Math.floor(diffSec / 60)}m`;
                else uptime = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
            } catch { /* skip */ }
        }

        return NextResponse.json({ running, container: 'aegis-heimdall', image, uptime, startedAt });
    } catch {
        return NextResponse.json({ running: false, container: 'aegis-heimdall', image: '', uptime: '', startedAt: '' });
    }
}
