# Arduino Claude Bridge

A web-based development environment that connects Claude AI with Arduino CLI for seamless embedded development. Perfect for work with ESP32, Teensy, and SAMD21 boards.

## Features

- **Web-based chat interface** - Talk to Claude about Arduino projects
- **Direct compilation** - Compile sketches with one click
- **Automatic upload** - Upload to your boards without leaving the browser  
- **Serial monitoring** - View output in real-time
- **Multi-board support** - ESP32 variants, Teensy, SAMD21
- **Error feedback** - Compilation errors automatically sent back to Claude for fixes

## Quick Start

1. **Download/Clone this repository**
2. **Run `start.bat`** (it will handle everything else)
3. **Open browser to http://localhost:3000**
4. **Start coding with Claude!**

## Prerequisites

### 1. Install Node.js

**Download:** https://nodejs.org/
- Choose the LTS version (recommended for most users)
- Run the installer with default settings
- Verify installation: Open Command Prompt and type `node --version`

### 2. Install Arduino CLI

**Download:** https://arduino.github.io/arduino-cli/installation/

**Windows Installation:**
1. Download the Windows zip file
2. Extract to a folder (e.g., `C:\arduino-cli\`)
3. Add the folder to your PATH:
   - Search "Environment Variables" in Start Menu
   - Click "Environment Variables"
   - Under "System Variables", find "Path" and click "Edit"
   - Click "New" and add your arduino-cli folder path
   - Click "OK" to save

**Verify installation:** Open Command Prompt and type `arduino-cli version`

### 3. Configure Arduino CLI for Your Boards

**ESP32 Setup:**
```bash
arduino-cli core update-index
arduino-cli core install esp32:esp32
```

**Teensy Setup:**
```bash
arduino-cli core update-index --additional-urls https://www.pjrc.com/teensy/package_teensy_index.json
arduino-cli core install teensy:avr
```

**SAMD21 Setup:**
```bash
arduino-cli core update-index
arduino-cli core install arduino:samd
```

## Installation

### Option 1: Use the Startup Script (Recommended)

1. Clone or download this repository
2. Double-click `start.bat`
3. The script will:
   - Check prerequisites
   - Install Node.js dependencies
   - Start the server
   - Open your browser automatically

### Option 2: Manual Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd arduino-claude-bridge

# Install dependencies
npm install

# Start the server
npm start
```

## Usage

### 1. Starting the System

- **Easy way:** Double-click `start.bat`
- **Manual way:** Run `npm start` in the project folder
- Browser should open automatically to http://localhost:3000

### 2. Basic Workflow

1. **Ask Claude for code:** "Write code for ESP32 to blink an LED"
2. **Select your board:** Choose from the dropdown (ESP32, Teensy, etc.)
3. **Select your port:** Refresh ports and choose your connected device
4. **Compile:** Click "Compile" - errors automatically go back to Claude
5. **Upload:** Click "Upload" to program your board
6. **Monitor:** Serial output appears automatically

### 3. Example Conversation

```
You: "Write code for ESP32 that reads a temperature sensor on pin A0 and prints the value"

Claude: "Here's code for reading a temperature sensor..."
[Code appears in chat and is ready for compilation]

[Click Compile] → [Click Upload] → [Serial monitor shows temperature readings]
```

### 4. Advanced Features

**Library Management:**
- Claude can suggest libraries needed for your project
- Install libraries through the interface

**Multiple Sketches:**
- Change the sketch name before compiling
- Organize different effects projects

**Serial Monitoring:**
- Auto-refreshes every 5 seconds
- Click "Read Serial" for immediate update
- Useful for debugging effects timing

## Supported Boards

**ESP32 Family:**
- ESP32 Dev Module (`esp32:esp32:esp32`)
- ESP32-S3 (`esp32:esp32:esp32s3`)
- ESP32-C3 (`esp32:esp32:esp32c3`)

**Teensy Family:**
- Teensy 4.0 (`teensy:avr:teensy40`)
- Teensy 4.1 (`teensy:avr:teensy41`)

**SAMD21 Family:**
- Arduino Zero (`arduino:samd:arduino_zero_native`)
- Arduino MKR1000 (`arduino:samd:mkr1000`)

*Note: More boards can be added by editing the dropdown in index.html*

## Special Effects Applications

This tool is particularly useful for:

**Sensor Integration:**
- Rapid prototyping of accelerometers, pressure sensors
- Testing sensor fusion for motion effects
- Calibrating environmental sensors

**Effect Controllers:**
- Programming multiple ESP32s for synchronized effects
- Teensy-based high-speed servo control
- SAMD21 for precise timing applications

**Development Workflow:**
- Quick iteration on effect sequences
- Real-time debugging during setup
- Automated compilation for multiple controller variants

## API Endpoints

The bridge server provides these endpoints:

- `GET /api/health` - Check Arduino CLI status
- `GET /api/boards` - List connected boards/ports
- `POST /api/compile` - Compile Arduino sketch
- `POST /api/upload` - Upload sketch to board
- `GET /api/monitor/:port` - Read serial output
- `GET /api/libraries` - List installed libraries
- `POST /api/library/install` - Install library

## Troubleshooting

### "Arduino CLI not found"
- Make sure Arduino CLI is installed and in your PATH
- Restart Command Prompt after PATH changes
- Try running `arduino-cli version` in Command Prompt

### "No boards detected"
- Check USB cable connection
- Install proper drivers for your board
- Click "Refresh Ports" button
- For ESP32: Install CP210x or CH340 drivers

### "Compilation failed"
- Check that the correct core is installed
- Ask Claude to fix the code based on error messages
- Verify board selection matches your hardware

### "Upload failed"
- Ensure correct port is selected
- Check that board is not running other serial programs
- Try pressing reset button during upload
- For ESP32: Hold BOOT button during upload if needed

### Port Access Issues
- Close Arduino IDE if it's open
- Close other serial terminal programs
- Restart the bridge server

## Development

### Adding New Boards

Edit `public/index.html` and add options to the board-select dropdown:

```html
<option value="your:board:fqbn">Your Board Name</option>
```

### Customizing the Interface

- **Colors/Styling:** Edit the CSS in `public/index.html`
- **Board Presets:** Modify the board dropdown options
- **Serial Settings:** Adjust baud rates and timeouts in the JavaScript

### Claude API Integration

*Note: This prototype doesn't include Claude API integration. For full functionality, you would need to:*

1. Get an Anthropic API key
2. Add API calling code to the `sendMessage()` function
3. Handle streaming responses from Claude

## File Structure

```
arduino-claude-bridge/
├── server.js              # Bridge server (Node.js)
├── package.json           # Dependencies
├── start.bat             # Windows startup script
├── public/
│   └── index.html        # Web frontend
├── sketches/             # Generated Arduino sketches
└── README.md            # This file
```

## Safety Notes

## License

MIT License - See LICENSE file for details

## Contributing

This is a prototype designed for special effects work. Feel free to fork and adapt for your specific needs!

## Support

For issues with this tool, check the troubleshooting section above. For Arduino CLI issues, see the official Arduino CLI documentation.
