/**
 * ═══════════════════════════════════════════════════════════════
 * Heimdall Decompiler Microservice
 * ═══════════════════════════════════════════════════════════════
 *
 * POST /decompile
 *   Body: { "bytecode": "0x608060..." }
 *   Response: { "success": true, "decompiled": "...", "bytecodeLength": 1234 }
 *
 * Runs Heimdall as a subprocess inside Docker.
 * No external API keys. No Cloudflare. Pure local execution.
 */

const express = require("express");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 8080;

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    try {
        const version = execSync("heimdall --version", { encoding: "utf-8" }).trim();
        res.json({ status: "ok", heimdall: version });
    } catch (err) {
        res.status(500).json({ status: "error", error: err.message });
    }
});

// ─── Decompile Endpoint ──────────────────────────────────────────────────────
app.post("/decompile", async (req, res) => {
    const startTime = Date.now();
    const { bytecode } = req.body;

    if (!bytecode || bytecode.length <= 2) {
        return res.status(400).json({
            success: false,
            error: "Empty or invalid bytecode",
        });
    }

    // Ensure 0x prefix for Heimdall
    const cleanBytecode = bytecode.startsWith("0x") ? bytecode : `0x${bytecode}`;

    console.log(`[HEIMDALL] Decompiling ${cleanBytecode.length} hex chars...`);

    // Write bytecode to temp file (Heimdall reads from stdin or file)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "heimdall-"));
    const tmpFile = path.join(tmpDir, "bytecode.hex");

    try {
        fs.writeFileSync(tmpFile, cleanBytecode);

        // Run Heimdall decompile with:
        //   --include-sol  → generate decompiled.sol in output dir
        //   --output <dir> → write files to directory
        //   -d             → auto-select defaults (no interactive prompts)
        //   -q             → quiet mode (suppress log noise)
        const outputDir = path.join(tmpDir, "output");
        fs.mkdirSync(outputDir, { recursive: true });

        const cmd = `heimdall decompile ${cleanBytecode} --include-sol --output ${outputDir} -d -q 2>&1`;
        let heimdallStdout = "";

        try {
            heimdallStdout = execSync(cmd, {
                encoding: "utf-8",
                timeout: 120000,
                maxBuffer: 10 * 1024 * 1024,
            });
        } catch (execErr) {
            heimdallStdout = execErr.stdout || execErr.stderr || execErr.message;
        }

        // Read decompiled.sol from output directory
        let decompiled = "";
        const solFile = path.join(outputDir, "decompiled.sol");
        if (fs.existsSync(solFile)) {
            decompiled = fs.readFileSync(solFile, "utf-8");
        } else {
            // Fallback: read any file in the output directory
            if (fs.existsSync(outputDir)) {
                const files = fs.readdirSync(outputDir);
                for (const file of files) {
                    const content = fs.readFileSync(path.join(outputDir, file), "utf-8");
                    decompiled += `// --- ${file} ---\n${content}\n\n`;
                }
            }
            // Last resort: use stdout
            if (!decompiled && heimdallStdout) {
                decompiled = heimdallStdout;
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[HEIMDALL] Decompilation complete: ${decompiled.length} chars in ${elapsed}ms`);

        // Truncate if needed
        if (decompiled.length > 15000) {
            decompiled = decompiled.slice(0, 15000);
            console.log(`[HEIMDALL] Output truncated to 15000 chars`);
        }

        res.json({
            success: decompiled.length > 0,
            decompiled,
            bytecodeLength: cleanBytecode.length,
            elapsedMs: elapsed,
        });
    } catch (err) {
        console.error(`[HEIMDALL] Error: ${err.message}`);
        res.status(500).json({
            success: false,
            error: err.message,
        });
    } finally {
        // Cleanup temp files
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
    }
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
    console.log(`[HEIMDALL] Decompiler microservice running on port ${PORT}`);
    console.log(`[HEIMDALL] POST /decompile — send { "bytecode": "0x..." }`);
    console.log(`[HEIMDALL] GET  /health    — check Heimdall installation`);
});
