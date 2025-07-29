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
function runCommand(command) {
    return new Promise((resolve, reject) => {
        // If command starts with 'arduino-cli', try local executable first
        if (command.startsWith('arduino-cli')) {
            const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
            if (fs.existsSync(localArduinoCli)) {
                command = command.replace('arduino-cli', `"${localArduinoCli}"`);
            }
        }
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: error.message, stdout, stderr });
            } else {
                resolve({ success: true, stdout, stderr });
            }
        });
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
        
        // Compile
        const compileCommand = `arduino-cli compile --fqbn ${board} "${sketchDir}"`;
        console.log('Compiling:', compileCommand);
        
        const result = await runCommand(compileCommand);
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
        
        // Upload
        const sketchDir = path.dirname(currentSketch);
        const uploadCommand = `arduino-cli upload -p ${port} --fqbn ${board} "${sketchDir}"`;
        console.log('Uploading:', uploadCommand);
        
        const result = await runCommand(uploadCommand);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serial monitor (updated to use working spawn method)
app.get('/api/monitor/:port', async (req, res) => {
    const { port } = req.params;
    const { baud = 9600, timeout = 5 } = req.query;
    
    try {
        const { spawn } = require('child_process');
        
        // Apply local executable check and handle paths with spaces properly
        let arduinoCliPath = 'arduino-cli';
        const localArduinoCli = path.join(__dirname, 'arduino-cli.exe');
        if (fs.existsSync(localArduinoCli)) {
            arduinoCliPath = localArduinoCli; // No quotes needed for spawn
        }
        
        console.log(`Starting serial monitor: ${arduinoCliPath} monitor -p ${port} --config baudrate=${baud}`);
        
        // Create a promise that resolves with collected output after timeout
        const result = await new Promise((resolve) => {
            let output = '';
            let errorOutput = '';
            let dataReceived = false;
            let dataChunks = [];
            
            // Use spawn with proper path handling
            const child = spawn(arduinoCliPath, ['monitor', '-p', port, '--config', `baudrate=${baud}`], {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            
            console.log('Serial monitor process started, PID:', child.pid);
            
            // Collect data as it comes in
            child.stdout.on('data', (data) => {
                const dataStr = data.toString();
                output += dataStr;
                dataReceived = true;
                dataChunks.push(dataStr);
                console.log('📡 SERIAL DATA RECEIVED:', JSON.stringify(dataStr));
                console.log('📡 SERIAL DATA (readable):', dataStr.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
            });
            
            child.stderr.on('data', (data) => {
                const errorStr = data.toString();
                errorOutput += errorStr;
                console.log('❌ Serial error output:', errorStr.trim());
            });
            
            // Handle process events
            child.on('spawn', () => {
                console.log('✅ Serial monitor process spawned successfully');
            });
            
            child.on('error', (error) => {
                console.log('❌ Serial monitor spawn error:', error.message);
                resolve({ 
                    success: false, 
                    stdout: '', 
                    stderr: `Spawn error: ${error.message}`,
                    method: 'spawn-fixed'
                });
            });
            
            child.on('exit', (code, signal) => {
                console.log(`🔚 Serial monitor exited with code ${code}, signal ${signal}`);
                console.log(`📊 Total data chunks received: ${dataChunks.length}`);
                console.log(`📊 Total characters received: ${output.length}`);
            });
            
            // Set timeout to kill process and return collected data
            setTimeout(() => {
                console.log(`⏰ Timeout reached (${timeout}s), terminating serial monitor...`);
                
                if (child && !child.killed) {
                    console.log('🔪 Killing serial monitor process...');
                    child.kill('SIGTERM');
                }
                
                console.log(`📈 Final data summary:`);
                console.log(`   - Data received: ${dataReceived}`);
                console.log(`   - Output length: ${output.length}`);
                console.log(`   - Error length: ${errorOutput.length}`);
                console.log(`   - Raw output:`, JSON.stringify(output));
                
                if (dataReceived && output.trim()) {
                    console.log('✅ Returning successful result with data');
                    resolve({ success: true, stdout: output.trim(), stderr: errorOutput });
                } else if (errorOutput.trim()) {
                    console.log('❌ Returning error result');
                    resolve({ success: false, stdout: '', stderr: errorOutput.trim() });
                } else {
                    console.log('⚠️ No data received, returning timeout message');
                    resolve({ 
                        success: true, 
                        stdout: '', 
                        stderr: `No data received at ${baud} baud in ${timeout}s. Check: 1) Arduino is sending data, 2) Correct baud rate (${baud}), 3) Port ${port} is not busy, 4) Serial cable connected` 
                    });
                }
            }, timeout * 1000);
        });
        
        console.log('📤 Sending response to client:', result);
        res.json(result);
    } catch (error) {
        console.error('💥 Serial monitor error:', error);
        res.status(500).json({ error: error.message });
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

// Helper function with timeout
function runCommand(command, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command}`);
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
