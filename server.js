#!/usr/bin/env node

/**
 * Local server to bridge web interface to Claude Code CLI
 * This creates a WebSocket server that communicates with the Claude Code process
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const PORT = 3000;

// MIME types for serving files
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

// Create HTTP server
const server = http.createServer((req, res) => {
    // Handle skills list endpoint
    if (req.url === '/api/skills' && req.method === 'GET') {
        const { execSync } = require('child_process');

        try {
            // Find all SKILL.md files in plugins
            const pluginsPath = path.join(process.env.HOME, '.claude/plugins');
            const commandsPath = path.join(process.env.HOME, '.claude/commands');

            // Find SKILL.md in plugins and .md files in commands
            const findPluginsCmd = `find "${pluginsPath}" -name "SKILL.md" -o -name "skill.md" -type f 2>/dev/null`;
            const findCommandsCmd = `find "${commandsPath}" -name "*.md" -type f 2>/dev/null`;

            const pluginSkills = execSync(findPluginsCmd, { encoding: 'utf8' })
                .split('\n')
                .filter(line => line.trim());

            const commandSkills = execSync(findCommandsCmd, { encoding: 'utf8' })
                .split('\n')
                .filter(line => line.trim());

            const skillFiles = [...pluginSkills, ...commandSkills];

            const skills = [];

            // Extract skill info from each file path
            const seenSkills = new Set();

            // Custom/user-created skill patterns
            const customSkillPatterns = [
                '/photo-rename/',
                '/google-slides-custom/',
                'create_project_brief_slide',
                '/commands/'
            ];

            skillFiles.forEach(filePath => {
                // Parse path to get plugin/namespace and skill name
                const parts = filePath.split('/');

                // Handle commands directory differently
                if (filePath.includes('/.claude/commands/')) {
                    const fileName = path.basename(filePath, '.md');
                    skills.push({
                        name: fileName,
                        namespace: null,
                        displayName: fileName.replace(/_/g, ' ').replace(/-/g, ' '),
                        category: 'my-skills',
                        isCustom: true
                    });
                    seenSkills.add(fileName);
                    return;
                }

                // Example: .claude/plugins/cache/plugin-name/namespace/version/skills/skill-name/SKILL.md
                const skillIndex = parts.indexOf('skills');

                if (skillIndex > 0 && skillIndex < parts.length - 2) {
                    const skillName = parts[skillIndex + 1];

                    // Find plugin/namespace (skip version hashes and cache dirs)
                    let namespace = 'general';
                    for (let i = skillIndex - 1; i >= 0; i--) {
                        const part = parts[i];
                        // Skip cache dirs, version numbers, and hash-like strings
                        if (part !== 'cache' && part !== 'marketplaces' &&
                            !part.match(/^\d+\.\d+\.\d+$/) &&
                            !part.match(/^[a-f0-9]{16,}$/) &&
                            part !== '.claude' && part !== 'plugins') {
                            namespace = part;
                            break;
                        }
                    }

                    // Clean up namespace (remove hash suffixes like .308468ae4843e0c1)
                    namespace = namespace.replace(/\.[a-f0-9]{16,}$/, '');

                    // Check if this is a custom skill
                    const isCustom = customSkillPatterns.some(pattern =>
                        filePath.includes(pattern) || skillName === pattern
                    );
                    if (isCustom) {
                        namespace = 'my-skills';
                    }

                    const fullName = namespace !== 'general' ? `${namespace}:${skillName}` : skillName;

                    // Deduplicate skills
                    if (!seenSkills.has(fullName)) {
                        seenSkills.add(fullName);
                        skills.push({
                            name: fullName,
                            namespace: namespace !== 'general' ? namespace : null,
                            displayName: skillName.replace(/-/g, ' '),
                            category: namespace,
                            isCustom: isCustom
                        });
                    }
                }
            });

            // Sort skills: custom skills first, then alphabetically by category
            skills.sort((a, b) => {
                if (a.isCustom && !b.isCustom) return -1;
                if (!a.isCustom && b.isCustom) return 1;
                return a.category.localeCompare(b.category);
            });

            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ skills }));
        } catch (error) {
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ error: 'Failed to fetch skills', skills: [] }));
        }

        return;
    }

    // Handle auth trigger endpoint
    if (req.url === '/api/auth-trigger' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const { service } = JSON.parse(body);

                let command, args;
                if (service === 'salesforce') {
                    command = 'sf';
                    args = ['org', 'login', 'web'];
                } else if (service === 'google') {
                    // Use mcp-adaptor for MCP authentication
                    const { execSync } = require('child_process');
                    try {
                        // Find mcp-adaptor binary
                        let mcpBin;
                        try {
                            mcpBin = execSync('which mcp-adaptor', { encoding: 'utf8' }).trim();
                        } catch {
                            if (fs.existsSync(path.join(process.env.HOME, '.mcp-adaptor/bin/mcp-adaptor'))) {
                                mcpBin = path.join(process.env.HOME, '.mcp-adaptor/bin/mcp-adaptor');
                            } else {
                                throw new Error('mcp-adaptor not found');
                            }
                        }
                        command = mcpBin;
                        args = ['auth'];
                    } catch (err) {
                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        });
                        res.end(JSON.stringify({
                            success: false,
                            error: 'mcp-adaptor not installed. Cannot authenticate with MCP services.'
                        }));
                        return;
                    }
                } else {
                    res.writeHead(400, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, error: 'Unknown service' }));
                    return;
                }

                // Spawn the auth process (it will open a browser)
                try {
                    const authProcess = spawn(command, args, {
                        cwd: process.env.HOME,
                        env: process.env,
                        detached: true,
                        stdio: 'ignore'
                    });

                    // Handle spawn errors
                    authProcess.on('error', (err) => {
                        console.error(`Failed to start ${service} auth:`, err);
                    });

                    // Detach so it runs independently
                    authProcess.unref();

                    res.writeHead(200, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        success: true,
                        message: `${service} authentication started`
                    }));
                } catch (spawnError) {
                    res.writeHead(500, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        success: false,
                        error: `Failed to start ${command}: ${spawnError.message}`
                    }));
                }
            } catch (error) {
                res.writeHead(500, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });

        return;
    }

    // Handle auth status check endpoint
    if (req.url === '/api/auth-status' && req.method === 'GET') {
        // Check Salesforce and Google auth status
        Promise.all([
            new Promise((resolve) => {
                execFile('sf', ['org', 'list', '--json'], { cwd: process.env.HOME }, (error, stdout) => {
                    if (error || !stdout) {
                        resolve({ service: 'salesforce', authenticated: false });
                    } else {
                        try {
                            const result = JSON.parse(stdout);
                            const hasOrgs = result.result && result.result.nonScratchOrgs && result.result.nonScratchOrgs.length > 0;
                            resolve({ service: 'salesforce', authenticated: hasOrgs });
                        } catch {
                            resolve({ service: 'salesforce', authenticated: false });
                        }
                    }
                });
            }),
            new Promise((resolve) => {
                // Check if MCP adaptor is running (indicates successful auth)
                const { exec } = require('child_process');
                exec('ps aux | grep "mcp-adaptor.*google" | grep -v grep', {
                    cwd: process.env.HOME
                }, (error, stdout, stderr) => {
                    // If the google_workspace mcp-adaptor is running, consider it authenticated
                    const isRunning = stdout.includes('google');
                    resolve({ service: 'google', authenticated: isRunning });
                });
            })
        ]).then(results => {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ status: results }));
        });

        return;
    }

    // Handle API endpoint
    if (req.url === '/api/message' && req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { message, model } = JSON.parse(body);

                // Run non-interactively so the CLI produces output and exits,
                // instead of launching the interactive terminal UI (which never
                // returns and leaves the request hanging on "thinking").
                let claudeArgs = ['--print'];

                // Add model flag if specified
                if (model) {
                    claudeArgs.push('--model', model);
                }

                // The full message (including a leading "/" for skill/slash
                // commands) is passed as the prompt via stdin.
                let inputMessage = message;

                // Spawn Claude Code process
                const claude = spawn('claude', claudeArgs, {
                    cwd: process.env.HOME,
                    env: process.env
                });

                let response = '';
                let errorOutput = '';
                let responded = false;

                // Always send exactly one response, no matter which event fires
                // first. Without this guard a slow/failed call could leave the
                // browser hanging on "thinking" forever.
                const sendOnce = (statusCode, payload) => {
                    if (responded) return;
                    responded = true;
                    clearTimeout(watchdog);
                    res.writeHead(statusCode, {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify(payload));
                };

                // Safety net: if the CLI never exits, kill it and reply so the
                // request can't hang indefinitely.
                const watchdog = setTimeout(() => {
                    claude.kill('SIGTERM');
                    sendOnce(504, {
                        response: response || errorOutput,
                        error: 'Claude Code timed out after 5 minutes. Please try again.'
                    });
                }, 5 * 60 * 1000);

                claude.stdout.on('data', (data) => {
                    response += data.toString();
                });

                claude.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                // If `claude` isn't installed / not on PATH, spawn emits 'error'
                // and 'close' never fires — handle it so we don't hang.
                claude.on('error', (spawnError) => {
                    sendOnce(500, {
                        response: '',
                        error: spawnError.code === 'ENOENT'
                            ? "Could not find the 'claude' command. Make sure Claude Code CLI is installed and on your PATH."
                            : `Failed to start Claude Code: ${spawnError.message}`
                    });
                });

                // Send the message to Claude if there's input
                if (inputMessage) {
                    claude.stdin.write(inputMessage + '\n');
                }
                claude.stdin.end();

                claude.on('close', (code) => {
                    sendOnce(200, {
                        response: response || errorOutput,
                        error: code !== 0 ? errorOutput : null
                    });
                });

            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });

        return;
    }

    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Claude Code Web Interface running at http://localhost:${PORT}\n`);
    console.log(`Open your browser to: http://localhost:${PORT}\n`);
});
