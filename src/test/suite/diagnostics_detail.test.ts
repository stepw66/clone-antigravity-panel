import * as assert from 'assert';
import { ProcessFinder } from '../../shared/platform/process_finder';
import { PlatformStrategy } from '../../shared/platform/platform_strategies';

/**
 * Mock strategy that returns JSON-parsed input to allow easy control in tests
 */
class MockStrategy implements PlatformStrategy {
    getProcessListCommand(_name: string) { return 'mock_ps'; }
    getPortListCommand(_pid: number) { return 'mock_netstat'; }

    parseProcessInfo(stdout: string) {
        if (!stdout) return null;
        try {
            return JSON.parse(stdout);
        } catch {
            return null;
        }
    }

    parseListeningPorts(stdout: string) {
        if (!stdout) return [];
        try {
            return JSON.parse(stdout);
        } catch {
            return [];
        }
    }
}

/**
 * controllable ProcessFinder subclass
 */
class DiagnosticTestFinder extends ProcessFinder {
    public mockStdout: string = '';
    public mockPortStdout: string = '';
    public mockTestResults: Record<number, { success: boolean; statusCode: number; error?: string }> = {};

    constructor(strategy: PlatformStrategy) {
        super();
        (this as any).strategy = strategy;
    }

    protected async execute(command: string): Promise<{ stdout: string; stderr: string }> {
        if (command === 'mock_ps') {
            return { stdout: this.mockStdout, stderr: '' };
        }
        if (command === 'mock_netstat') {
            return { stdout: this.mockPortStdout, stderr: '' };
        }
        return { stdout: '', stderr: '' };
    }

    protected async testPort(port: number, _csrf: string): Promise<{ success: boolean; statusCode: number; error?: string }> {
        return this.mockTestResults[port] || { success: false, statusCode: 500, error: 'Conn error' };
    }

    // Expose protected tryDetect for testing
    public async runTryDetect() {
        return await this.tryDetect();
    }
}

suite('Diagnostics Detail Test Suite', () => {
    let finder: DiagnosticTestFinder;
    let strategy: MockStrategy;

    setup(() => {
        strategy = new MockStrategy();
        finder = new DiagnosticTestFinder(strategy);
    });

    test('should set no_process when strategy returns null', async () => {
        finder.mockStdout = ''; // MockStrategy returns null for empty string
        await finder.runTryDetect();
        assert.strictEqual(finder.failureReason, 'no_process');
        assert.strictEqual(finder.candidateCount, 0);
    });

    test('should set ambiguous when multiple processes found but none match', async () => {
        const procs = [
            { pid: 101, ppid: 999123, extensionPort: 0, csrfToken: 't1' },
            { pid: 102, ppid: 888123, extensionPort: 0, csrfToken: 't2' }
        ];
        finder.mockStdout = JSON.stringify(procs);

        await finder.runTryDetect();
        assert.strictEqual(finder.failureReason, 'ambiguous');
        assert.strictEqual(finder.candidateCount, 2);
    });

    test('should set no_port when process found but no port responds', async () => {
        const proc = { pid: 101, ppid: process.ppid, extensionPort: 0, csrfToken: 't1' };
        finder.mockStdout = JSON.stringify([proc]);
        finder.mockPortStdout = JSON.stringify([58001, 58002]);

        finder.mockTestResults = {
            58001: { success: false, statusCode: 404 },
            58002: { success: false, statusCode: 503 }
        };

        await finder.runTryDetect();
        assert.strictEqual(finder.failureReason, 'no_port');
        assert.strictEqual(finder.attemptDetails.length, 2);
        assert.strictEqual(finder.attemptDetails[0].statusCode, 404);
    });

    test('should set auth_failed when a port returns 401/403', async () => {
        const proc = { pid: 101, ppid: process.ppid, extensionPort: 0, csrfToken: 't1' };
        finder.mockStdout = JSON.stringify([proc]);
        finder.mockPortStdout = JSON.stringify([58001]);

        finder.mockTestResults = {
            58001: { success: false, statusCode: 403, error: 'CSRF invalid' }
        };

        await finder.runTryDetect();
        assert.strictEqual(finder.failureReason, 'auth_failed');
    });

    test('should populate attemptDetails on success', async () => {
        const proc = { pid: 101, ppid: process.ppid, extensionPort: 0, csrfToken: 't1' };
        finder.mockStdout = JSON.stringify([proc]);
        finder.mockPortStdout = JSON.stringify([58001, 58002]);

        finder.mockTestResults = {
            58001: { success: false, statusCode: 404 },
            58002: { success: true, statusCode: 200 }
        };

        const result = await finder.runTryDetect();
        assert.ok(result);
        assert.strictEqual(result!.port, 58002);
        assert.strictEqual(finder.attemptDetails.length, 2);
        assert.strictEqual(finder.attemptDetails[1].statusCode, 200);
    });
});
