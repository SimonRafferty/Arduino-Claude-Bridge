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

// Helper function to run shell commands
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

// Serial monitor
app.get('/api/monitor/:port', async (req, res) => {
    const { port } = req.params;
    const { baud = 115200, timeout = 5 } = req.query;
    
    try {
        // Use timeout to avoid hanging
        const monitorCommand = `timeout ${timeout} arduino-cli monitor -p ${port} --config baudrate=${baud}`;
        const result = await runCommand(monitorCommand);
        res.json(result);
    } catch (error) {
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
