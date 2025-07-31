const express = require('express');
const { exec, spawn } = require('child_process');
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

// Enhanced function to find preferred sketch directory
function getPreferredSketchDirectory() {
    // Priority 1: Arduino IDE sketchbook location
    if (sketchbookPath && fs.existsSync(sketchbookPath)) {
        console.log('Using Arduino IDE sketchbook:', sketchbookPath);
        return sketchbookPath;
    }
    
    // Priority 2: Try to find Arduino sketchbook in standard locations
    const possibleSketchbookPaths = [
        path.join(os.homedir(), 'Documents', 'Arduino'),
        path.join(os.homedir(), 'Arduino'),
        path.join(os.homedir(), 'Sketchbook')
    ];
    
    for (const sketchPath of possibleSketchbookPaths) {
        if (fs.existsSync(sketchPath)) {
            console.log('Found Arduino sketchbook at:', sketchPath);
            return sketchPath;
        }
    }
    
    // Priority 3: User Documents folder
    const documentsPath = path.join(os.homedir(), 'Documents', 'Arduino Sketches');
    console.log('Using Documents folder:', documentsPath);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(documentsPath)) {
        fs.mkdirSync(documentsPath, { recursive: true });
    }
    
    return documentsPath;
}

// Enhanced function to discover Arduino configuration
async function discoverArduinoConfig() {
    console.log('Discovering Arduino configuration...');
    
    try {
        // Method 1: Try arduino-cli config
        const configResult = await runCommand('arduino-cli config dump');
        if (configResult.success) {
            const lines = configResult.stdout.split('\n');
            const sketchbookLine = lines.find(line => line.includes('sketchbook'));
            if (sketchbookLine) {
                const match = sketchbookLine.match(/sketchbook.*?:\s*(.+)/);
                if (match) {
                    const foundPath = match[1].replace(/['"]/g, '').trim();
                    if (fs.existsSync(foundPath)) {
                        sketchbookPath = foundPath;
                        console.log('✅ Found Arduino sketchbook via CLI config:', sketchbookPath);
                        return;
                    }
                }
            }
        }
    } catch (error) {
        console.log('Arduino CLI config not available:', error.message);
    }
    
    try {
        // Method 2: Try Arduino IDE preferences file (Windows)
        const prefsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Arduino15', 'preferences.txt');
        if (fs.existsSync(prefsPath)) {
            const prefs = fs.readFileSync(prefsPath, 'utf8');
            const lines = prefs.split('\n');
            const sketchbookLine = lines.find(line => line.startsWith('sketchbook.path='));
            if (sketchbookLine) {
                const foundPath = sketchbookLine.split('=')[1].trim();
                if (fs.existsSync(foundPath)) {
                    sketchbookPath = foundPath;
                    console.log('✅ Found Arduino sketchbook via IDE preferences:', sketchbookPath);
                    return;
                }
            }
        }
    } catch (error) {
        console.log('Could not read Arduino IDE preferences:', error.message);
    }
    
    try {
        // Method 3: Try common default locations
        const defaultPaths = [
            path.join(os.homedir(), 'Documents', 'Arduino'),
            path.join(os.homedir(), 'Arduino'),
            path.join(os.homedir(), 'Sketchbook')
        ];
        
        for (const defaultPath of defaultPaths) {
            if (fs.existsSync(defaultPath)) {
                sketchbookPath = defaultPath;
                console.log('✅ Found Arduino sketchbook at default location:', sketchbookPath);
                return;
            }
        }
    } catch (error) {
        console.log('Error checking default paths:', error.message);
    }
    
    console.log('ℹ️ No Arduino sketchbook found, will use Documents folder');
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

// Modified save sketch endpoint with preferred location support
app.post('/api/sketch', async (req, res) => {
    const { code, name = 'sketch', usePreferredLocation = false } = req.body;
    
    try {
        let baseDir;
        let locationDescription;
        
        if (usePreferredLocation) {
            // Use the preferred location (Arduino sketchbook or Documents)
            baseDir = getPreferredSketchDirectory();
            
            if (baseDir.includes('Arduino') && baseDir !== path.join(__dirname, 'sketches')) {
                locationDescription = 'Arduino sketchbook';
            } else {
                locationDescription = 'Documents folder';
            }
        } else {
            // Fallback to local sketches folder (backward compatibility)
            baseDir = path.join(__dirname, 'sketches');
            locationDescription = 'local project folder';
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
        
        console.log(`Sketch "${name}" saved to: ${sketchPath}`);
        
        res.json({ 
            success: true, 
            message: `Sketch saved to ${locationDescription}`,
            path: sketchPath,
            location: locationDescription
        });
    } catch (error) {
        console.error('Error saving sketch:', error);
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
        let sketchDir;
        
        // Save sketch first if provided, using same directory structure as compile
        if (code) {
            sketchDir = path.join(__dirname, 'sketches', name);
            if (!fs.existsSync(sketchDir)) {
                fs.mkdirSync(sketchDir, { recursive: true });
            }
            
            const sketchPath = path.join(sketchDir, `${name}.ino`);
            fs.writeFileSync(sketchPath, code);
            currentSketch = sketchPath;
        } else {
            // Use the directory from the current sketch
            sketchDir = path.dirname(currentSketch);
        }
        
        currentBoard = board;
        currentPort = port;
        
        // Ensure sketch directory exists and has .ino file
        const expectedSketchFile = path.join(sketchDir, `${name}.ino`);
        if (!fs.existsSync(expectedSketchFile)) {
            return res.status(400).json({ 
                error: `Sketch file not found: ${expectedSketchFile}. Please compile first.` 
            });
        }
        
        console.log(`Upload using sketch directory: ${sketchDir}`);
        console.log(`Upload using sketch file: ${expectedSketchFile}`);
        
        // Upload with longer timeout - use the same directory structure as compile
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

// Enhanced config endpoint
app.get('/api/config', async (req, res) => {
    try {
        const configResult = await runCommand('arduino-cli config dump');
        const preferredDir = getPreferredSketchDirectory();
        
        res.json({ 
            success: true, 
            config: configResult.success ? configResult.stdout : 'Config not available',
            sketchbookPath: sketchbookPath || 'Not found',
            preferredSketchDirectory: preferredDir,
            isArduinoSketchbook: preferredDir.includes('Arduino')
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

// Enhanced sketch listing endpoint
app.get('/api/sketches', async (req, res) => {
    try {
        const sketches = [];
        const preferredDir = getPreferredSketchDirectory();
        
        const searchDirs = [
            preferredDir,
            path.join(__dirname, 'sketches') // Keep local sketches as backup
        ].filter((dir, index, self) => 
            dir && fs.existsSync(dir) && self.indexOf(dir) === index // Remove duplicates
        );
        
        console.log('Searching for sketches in:', searchDirs);
        
        for (const dir of searchDirs) {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const itemPath = path.join(dir, item);
                    if (fs.statSync(itemPath).isDirectory()) {
                        const sketchFile = path.join(itemPath, `${item}.ino`);
                        if (fs.existsSync(sketchFile)) {
                            const stats = fs.statSync(sketchFile);
                            
                            // Determine source type
                            let source = 'local';
                            if (dir === preferredDir && preferredDir.includes('Arduino')) {
                                source = 'sketchbook';
                            } else if (dir === preferredDir) {
                                source = 'documents';
                            }
                            
                            sketches.push({
                                name: item,
                                path: itemPath,
                                modified: stats.mtime,
                                source: source
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
        
        console.log(`Found ${sketches.length} total sketches`);
        res.json({ success: true, sketches });
    } catch (error) {
        console.error('Error listing sketches:', error);
        res.status(500).json({ error: error.message });
    }
});

// Load a specific sketch
app.get('/api/sketches/:name', async (req, res) => {
    const { name } = req.params;
    
    try {
        const preferredDir = getPreferredSketchDirectory();
        const searchDirs = [
            preferredDir,
            path.join(__dirname, 'sketches')
        ].filter((dir, index, self) => 
            dir && fs.existsSync(dir) && self.indexOf(dir) === index
        );
        
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

// Start server with enhanced configuration discovery
app.listen(PORT, async () => {
    console.log(`\n🚀 Arduino Bridge Server running on http://localhost:${PORT}`);
    console.log('Make sure Arduino CLI is installed and available in PATH');
    
    // Create local sketches directory (fallback)
    const sketchesDir = path.join(__dirname, 'sketches');
    if (!fs.existsSync(sketchesDir)) {
        fs.mkdirSync(sketchesDir, { recursive: true });
    }
    
    // Discover Arduino configuration
    await discoverArduinoConfig();
    
    // Show preferred sketch directory
    const preferredDir = getPreferredSketchDirectory();
    console.log(`📁 Preferred sketch directory: ${preferredDir}`);
    
    // Show startup message
    console.log('\n=================================');
    console.log('  ✅ Server ready!');  
    console.log('  🌐 Open: http://localhost:3000');
    console.log('=================================\n');
});

module.exports = app;