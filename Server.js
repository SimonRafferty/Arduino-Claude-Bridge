const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store current sketch and sketchbook path
let currentSketch = '';
let currentBoard = '';
let currentPort = '';
let sketchbookPath = '';

// Helper function to run shell commands (original)
function runCommand(command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        // If command starts with 'arduino-cli', try local executable first
        if (command.startsWith('arduino-cli')) {
            const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
            if (fs.existsSync(localArduinoCli)) {
                command = command.replace('arduino-cli', `"${localArduinoCli}"`);
            }
        }
        
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: error.message, stdout, stderr });
            } else {
                resolve({ success: true, stdout, stderr });
            }
        });
        
        // Kill after timeout
        setTimeout(() => {
            if (child && !child.killed) {
                child.kill('SIGTERM');
                resolve({ success: false, error: 'Timeout', stdout: '', stderr: 'Command timed out' });
            }
        }, timeoutMs);
    });
}

// Helper function with timeout for testing
function runCommandWithTimeout(command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command}`);
        
        // Apply local executable check
        if (command.startsWith('arduino-cli')) {
            const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
            if (fs.existsSync(localArduinoCli)) {
                command = command.replace('arduino-cli', `"${localArduinoCli}"`);
            }
        }
        
        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: error.message, stdout, stderr });
            } else {
                resolve({ success: true, stdout, stderr });
            }
        });
        
        // Kill after timeout
        setTimeout(() => {
            if (child && !child.killed) {
                child.kill('SIGTERM');
                resolve({ success: false, error: 'Timeout', stdout: '', stderr: 'Command timed out' });
            }
        }, timeoutMs);
    });
}

// Claude API Proxy - NEW ENDPOINT TO FIX CORS
app.post('/api/claude', async (req, res) => {
    const { apiKey, ...claudeRequest } = req.body;
    
    if (!apiKey) {
        return res.status(400).json({ error: 'API key required' });
    }
    
    try {
        // Dynamic import for fetch (Node.js 18+)
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(claudeRequest)
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Anthropic API error:', response.status, errorData);
            return res.status(response.status).json({ 
                error: `API request failed: ${response.status} ${response.statusText}`,
                details: errorData
            });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Claude API error:', error);
        res.status(500).json({ 
            error: 'Failed to connect to Claude API',
            details: error.message 
        });
    }
});

// Get available boards and ports
app.get('/api/boards', async (req, res) => {
    try {
        const result = await runCommand('arduino-cli board list');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get installed cores
app.get('/api/cores', async (req, res) => {
    try {
        const result = await runCommand('arduino-cli core list');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save sketch
app.post('/api/sketch', async (req, res) => {
    const { code, name = 'sketch', useSketchbook = false } = req.body;
    
    try {
        let baseDir;
        
        // Try to use Arduino sketchbook folder if requested and available
        if (useSketchbook && sketchbookPath && fs.existsSync(sketchbookPath)) {
            baseDir = sketchbookPath;
        } else {
            // Fallback to local sketches folder
            baseDir = path.join(__dirname, 'sketches');
        }
        
        // Create sketch directory
        const sketchDir = path.join(baseDir, name);
        if (!fs.existsSync(sketchDir)) {
            fs.mkdirSync(sketchDir, { recursive: true });
        }
        
        // Write sketch file
        const sketchPath = path.join(sketchDir, `${name}.ino`);
        fs.writeFileSync(sketchPath, code);
        
        currentSketch = sketchPath;
        
        res.json({ 
            success: true, 
            message: `Sketch saved to ${useSketchbook ? 'Arduino sketchbook' : 'local folder'}`,
            path: sketchPath 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Compile sketch
app.post('/api/compile', async (req, res) => {
    const { board, code, name = 'sketch' } = req.body;
    
    if (!board) {
        return res.status(400).json({ error: 'Board FQBN required' });
    }
    
    try {
        // Save sketch first
        const sketchDir = path.join(__dirname, 'sketches', name);
        if (!fs.existsSync(sketchDir)) {
            fs.mkdirSync(sketchDir, { recursive: true });
        }
        
        const sketchPath = path.join(sketchDir, `${name}.ino`);
        fs.writeFileSync(sketchPath, code);
        
        currentSketch = sketchPath;
        currentBoard = board;
        
        // Compile with longer timeout (60 seconds for first-time downloads)
        const compileCommand = `arduino-cli compile --fqbn ${board} "${sketchDir}"`;
        console.log('Compiling:', compileCommand);
        
        const result = await runCommand(compileCommand, 60000); // 60 second timeout
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Upload sketch
app.post('/api/upload', async (req, res) => {
    const { board, port, code, name = 'sketch' } = req.body;
    
    if (!board || !port) {
        return res.status(400).json({ error: 'Board FQBN and port required' });
    }
    
    try {
        // Save sketch first if provided
        if (code) {
            const sketchDir = path.join(__dirname, 'sketches', name);
            if (!fs.existsSync(sketchDir)) {
                fs.mkdirSync(sketchDir, { recursive: true });
            }
            
            const sketchPath = path.join(sketchDir, `${name}.ino`);
            fs.writeFileSync(sketchPath, code);
            currentSketch = sketchPath;
        }
        
        currentBoard = board;
        currentPort = port;
        
        // Upload with longer timeout
        const sketchDir = path.dirname(currentSketch);
        const uploadCommand = `arduino-cli upload -p ${port} --fqbn ${board} "${sketchDir}"`;
        console.log('Uploading:', uploadCommand);
        
        const result = await runCommand(uploadCommand, 45000); // 45 second timeout
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serial monitor (FIXED VERSION - properly captures streaming data)
app.get('/api/monitor/:port', async (req, res) => {
    const { port } = req.params;
    const { baud = 9600, timeout = 5 } = req.query;
    
    try {
        const { spawn } = require('child_process');
        
        // Apply local executable check and handle paths properly
        let arduinoCliPath = 'arduino-cli';
        const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
        if (fs.existsSync(localArduinoCli)) {
            arduinoCliPath = localArduinoCli;
        }
        
        console.log(`📡 REGULAR MONITOR: Starting arduino-cli monitor for ${port} at ${baud} baud`);
        
        // Create a promise that collects streaming data
        const result = await new Promise((resolve) => {
            let output = '';
            let errorOutput = '';
            let dataReceived = false;
            
            // Spawn arduino-cli monitor with proper streaming setup
            const child = spawn(arduinoCliPath, ['monitor', '-p', port, '--config', `baudrate=${baud}`], {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false  // Don't use shell to avoid quote issues
            });
            
            console.log(`📡 REGULAR MONITOR: Process spawned, PID: ${child.pid}`);
            
            // Handle stdout data (this is where arduino data comes from)
            child.stdout.on('data', (data) => {
                const dataStr = data.toString();
                // Skip the initial "Monitor port settings" header
                if (!dataStr.includes('Monitor port settings') && 
                    !dataStr.includes('Connecting to') && 
                    !dataStr.includes('Press CTRL-C') &&
                    dataStr.trim() !== '') {
                    
                    output += dataStr;
                    dataReceived = true;
                    console.log(`📡 REGULAR MONITOR: Received data:`, JSON.stringify(dataStr.trim()));
                }
            });
            
            // Handle stderr 
            child.stderr.on('data', (data) => {
                const errorStr = data.toString();
                errorOutput += errorStr;
                console.log(`📡 REGULAR MONITOR: stderr:`, errorStr.trim());
            });
            
            // Handle process events
            child.on('error', (error) => {
                console.log(`📡 REGULAR MONITOR: spawn error:`, error.message);
                resolve({ 
                    success: false, 
                    stdout: '', 
                    stderr: `Spawn error: ${error.message}`,
                    method: 'regular-monitor'
                });
            });
            
            child.on('exit', (code, signal) => {
                console.log(`📡 REGULAR MONITOR: Process exited: code=${code}, signal=${signal}`);
            });
            
            // Set timeout to collect data then kill process
            setTimeout(() => {
                console.log(`📡 REGULAR MONITOR: Timeout reached, killing process...`);
                
                if (child && !child.killed) {
                    child.kill('SIGTERM');
                }
                
                console.log(`📡 REGULAR MONITOR: Final results:`);
                console.log(`   - Data received: ${dataReceived}`);
                console.log(`   - Output length: ${output.length}`);
                console.log(`   - Raw output: ${JSON.stringify(output)}`);
                
                if (dataReceived && output.trim()) {
                    resolve({ 
                        success: true, 
                        stdout: output.trim(), 
                        stderr: errorOutput,
                        method: 'regular-monitor'
                    });
                } else if (errorOutput.trim()) {
                    resolve({ 
                        success: false, 
                        stdout: '', 
                        stderr: errorOutput.trim(),
                        method: 'regular-monitor'
                    });
                } else {
                    resolve({ 
                        success: false, 
                        stdout: '', 
                        stderr: `No data received at ${baud} baud in ${timeout}s`,
                        method: 'regular-monitor'
                    });
                }
            }, timeout * 1000);
        });
        
        console.log(`📡 REGULAR MONITOR: Sending response:`, result);
        res.json(result);
        
    } catch (error) {
        console.error(`📡 REGULAR MONITOR: Error:`, error);
        res.status(500).json({ 
            error: error.message,
            method: 'regular-monitor'
        });
    }
});

// Get library list
app.get('/api/libraries', async (req, res) => {
    try {
        const result = await runCommand('arduino-cli lib list');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Install library
app.post('/api/library/install', async (req, res) => {
    const { library } = req.body;
    
    if (!library) {
        return res.status(400).json({ error: 'Library name required' });
    }
    
    try {
        const result = await runCommand(`arduino-cli lib install "${library}"`);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Arduino configuration and sketchbook location
app.get('/api/config', async (req, res) => {
    try {
        const configResult = await runCommand('arduino-cli config dump');
        let sketchbookPath = '';
        
        if (configResult.success) {
            // Try to extract sketchbook path from config
            const lines = configResult.stdout.split('\n');
            const sketchbookLine = lines.find(line => line.includes('sketchbook'));
            if (sketchbookLine) {
                const match = sketchbookLine.match(/sketchbook.*?:\s*(.+)/);
                if (match) sketchbookPath = match[1].replace(/['"]/g, '').trim();
            }
        }
        
        // Fallback: try Arduino IDE preferences file
        if (!sketchbookPath) {
            const os = require('os');
            const prefsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino15', 'preferences.txt');
            
            try {
                if (fs.existsSync(prefsPath)) {
                    const prefs = fs.readFileSync(prefsPath, 'utf8');
                    const lines = prefs.split('\n');
                    const sketchbookLine = lines.find(line => line.startsWith('sketchbook.path='));
                    if (sketchbookLine) {
                        sketchbookPath = sketchbookLine.split('=')[1].trim();
                    }
                }
            } catch (error) {
                console.log('Could not read Arduino preferences:', error.message);
            }
        }
        
        res.json({ 
            success: true, 
            config: configResult.stdout,
            sketchbookPath: sketchbookPath || 'Not found'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all available boards from installed cores
app.get('/api/boards/available', async (req, res) => {
    try {
        const result = await runCommand('arduino-cli board listall');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List available sketches
app.get('/api/sketches', async (req, res) => {
    try {
        const sketches = [];
        const searchDirs = [
            path.join(__dirname, 'sketches'),
            sketchbookPath
        ].filter(dir => dir && fs.existsSync(dir));
        
        for (const dir of searchDirs) {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        const sketchFile = path.join(itemPath, `${item}.ino`);
                        if (fs.existsSync(sketchFile)) {
                            const stats = fs.statSync(sketchFile);
                            sketches.push({
                                name: item,
                                path: itemPath,
                                modified: stats.mtime,
                                source: dir === sketchbookPath ? 'sketchbook' : 'local'
                            });
                        }
                    }
                }
            } catch (error) {
                console.log(`Error reading directory ${dir}:`, error.message);
            }
        }
        
        // Sort by modification time, newest first
        sketches.sort((a, b) => new Date(b.modified) - new Date(a.modified));
        
        res.json({ success: true, sketches });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Load a specific sketch
app.get('/api/sketches/:name', async (req, res) => {
    const { name } = req.params;
    
    try {
        const searchDirs = [
            path.join(__dirname, 'sketches'),
            sketchbookPath
        ].filter(dir => dir && fs.existsSync(dir));
        
        let sketchContent = '';
        let sketchPath = '';
        
        for (const dir of searchDirs) {
            const sketchDir = path.join(dir, name);
            const sketchFile = path.join(sketchDir, `${name}.ino`);
            
            if (fs.existsSync(sketchFile)) {
                sketchContent = fs.readFileSync(sketchFile, 'utf8');
                sketchPath = sketchFile;
                currentSketch = sketchPath;
                break;
            }
        }
        
        if (sketchContent) {
            res.json({ 
                success: true, 
                name: name,
                content: sketchContent,
                path: sketchPath
            });
        } else {
            res.status(404).json({ error: 'Sketch not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add direct serial port reading using Node.js SerialPort (alternative approach)
app.get('/api/monitor-direct/:port', async (req, res) => {
    const { port } = req.params;
    const { baud = 9600, timeout = 5 } = req.query;
    
    console.log(`\n=== DIRECT SERIAL PORT READING ===`);
    console.log(`Port: ${port}, Baud: ${baud}, Timeout: ${timeout}s`);
    
    try {
        // Try to read serial port directly using built-in Node.js approach
        const { spawn } = require('child_process');
        
        // Apply local executable check and handle paths with spaces
        let arduinoCliPath = 'arduino-cli';
        const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
        if (fs.existsSync(localArduinoCli)) {
            arduinoCliPath = localArduinoCli; // Don't add quotes here for spawn
        }
        
        console.log(`Using arduino-cli path: ${arduinoCliPath}`);
        
        const result = await new Promise((resolve) => {
            let output = '';
            let errorOutput = '';
            let dataChunks = [];
            
            // Use spawn with proper path handling (no quotes needed for spawn)
            const child = spawn(arduinoCliPath, ['monitor', '-p', port, '--config', `baudrate=${baud}`], {
                stdio: ['pipe', 'pipe', 'pipe']
                // Note: removed shell: true as it was causing quote issues
            });
            
            console.log(`✅ Spawned arduino-cli monitor process, PID: ${child.pid}`);
            console.log(`✅ Command: ${arduinoCliPath} monitor -p ${port} --config baudrate=${baud}`);
            
            child.stdout.on('data', (data) => {
                const dataStr = data.toString();
                output += dataStr;
                dataChunks.push(dataStr);
                console.log(`📡 DIRECT SERIAL DATA:`, JSON.stringify(dataStr));
                console.log(`📡 READABLE:`, dataStr.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
            });
            
            child.stderr.on('data', (data) => {
                const errorStr = data.toString();
                errorOutput += errorStr;
                console.log(`❌ DIRECT SERIAL ERROR:`, errorStr.trim());
            });
            
            child.on('error', (error) => {
                console.log(`💥 Spawn error: ${error.message}`);
                resolve({ 
                    success: false, 
                    stdout: '', 
                    stderr: `Spawn error: ${error.message}`,
                    method: 'direct-spawn'
                });
            });
            
            child.on('exit', (code, signal) => {
                console.log(`🔚 Direct monitor exited: code=${code}, signal=${signal}`);
            });
            
            // Timeout handling
            setTimeout(() => {
                console.log(`⏰ Direct monitor timeout, killing process...`);
                if (child && !child.killed) {
                    child.kill('SIGTERM');
                }
                
                console.log(`📊 Direct results:`);
                console.log(`   - Data chunks: ${dataChunks.length}`);
                console.log(`   - Total chars: ${output.length}`);
                console.log(`   - Error output: ${errorOutput.length} chars`);
                console.log(`   - Raw output: ${JSON.stringify(output)}`);
                
                if (output.trim()) {
                    resolve({ success: true, stdout: output.trim(), stderr: errorOutput, method: 'direct-spawn' });
                } else if (errorOutput.trim()) {
                    resolve({ 
                        success: false, 
                        stdout: '', 
                        stderr: errorOutput.trim(),
                        method: 'direct-spawn'
                    });
                } else {
                    resolve({ 
                        success: false, 
                        stdout: '', 
                        stderr: `No data via direct spawn method at ${baud} baud in ${timeout}s`,
                        method: 'direct-spawn'
                    });
                }
            }, timeout * 1000);
        });
        
        console.log(`📤 Direct serial result:`, result);
        res.json(result);
        
    } catch (error) {
        console.error('💥 Direct serial error:', error);
        res.status(500).json({ error: error.message, method: 'direct-spawn' });
    }
});

// Health check
app.get('/api/health', async (req, res) => {
    try {
        const result = await runCommand('arduino-cli version');
        res.json({ 
            status: 'OK', 
            arduino_cli: result.success,
            version: result.stdout 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, async () => {
    console.log(`Arduino Bridge Server running on http://localhost:${PORT}`);
    console.log('Make sure Arduino CLI is installed and available in PATH');
    
    // Create sketches directory
    const sketchesDir = path.join(__dirname, 'sketches');
    if (!fs.existsSync(sketchesDir)) {
        fs.mkdirSync(sketchesDir, { recursive: true });
    }
    
    // Try to load Arduino configuration and sketchbook path
    try {
        const configResult = await runCommand('arduino-cli config dump');
        if (configResult.success) {
            const lines = configResult.stdout.split('\n');
            const sketchbookLine = lines.find(line => line.includes('sketchbook'));
            if (sketchbookLine) {
                const match = sketchbookLine.match(/sketchbook.*?:\s*(.+)/);
                if (match) {
                    sketchbookPath = match[1].replace(/['"]/g, '').trim();
                    console.log(`Found Arduino sketchbook: ${sketchbookPath}`);
                }
            }
        }
        
        // Fallback: try Arduino IDE preferences file
        if (!sketchbookPath) {
            const prefsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino15', 'preferences.txt');
            
            if (fs.existsSync(prefsPath)) {
                const prefs = fs.readFileSync(prefsPath, 'utf8');
                const lines = prefs.split('\n');
                const sketchbookLine = lines.find(line => line.startsWith('sketchbook.path='));
                if (sketchbookLine) {
                    sketchbookPath = sketchbookLine.split('=')[1].trim();
                    console.log(`Found Arduino sketchbook from IDE preferences: ${sketchbookPath}`);
                }
            }
        }
    } catch (error) {
        console.log('Could not determine Arduino sketchbook location:', error.message);
    }
});

module.exports = app;