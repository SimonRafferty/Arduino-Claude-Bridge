# Arduino Claude Bridge

A web-based development environment that connects Claude AI with Arduino CLI for seamless embedded development. Perfect for rapid prototyping with ESP32, Teensy, and SAMD21 boards.

## Features

- **Web-based chat interface** - Talk to Claude about Arduino projects
- **Automatic Arduino integration** - Uses your existing Arduino IDE configuration and installed boards
- **Dynamic board detection** - Shows only the boards you have cores installed for
- **Sketchbook integration** - Can save sketches to your Arduino sketchbook folder
- **Direct compilation** - Compile sketches with one click
- **Automatic upload** - Upload to your boards without leaving the browser  
- **Serial monitoring** - View output in real-time
- **Multi-board support** - Any boards you have installed (ESP32, Arduino, Teensy, etc.)
- **Error feedback** - Compilation errors automatically sent back to Claude for fixes

## Quick Start

1. **Download/Clone this repository**
2. **Download `arduino-cli.exe`** and put it in the same folder
3. **Double-click `start.bat`** 
4. **When you see "Server running"**, double-click `open-browser.bat` OR manually open browser to http://localhost:3000
5. **Start coding with Claude!**

## Prerequisites

### 1. Install Node.js

**Download:** https://nodejs.org/
- Choose the LTS version (recommended for most users)
- Run the installer with default settings
- Verify installation: Open Command Prompt and type `node --version`

### 2. Install Arduino CLI

**Easy Method (Recommended):**
1. Download `arduino-cli.exe` from: https://arduino.github.io/arduino-cli/installation/
2. **Put `arduino-cli.exe` directly in your project folder** (same folder as `start.bat`)
3. That's it! No PATH configuration needed.

**Alternative Method:**
1. Download the Windows zip file and extract somewhere (e.g., `C:\arduino-cli\`)
2. Add the folder to your PATH (see Environment Variables in Windows)

**Verify installation:** 
- If using local method: Double-click `arduino-cli.exe` (should show help)
- If using PATH method: Open Command Prompt and type `arduino-cli version`

### 3. Configure Arduino CLI for Your Boards

**The bridge will automatically detect boards from your existing Arduino IDE installation.** If you need additional boards:

**ESP32 Setup:**
```bash
arduino-cli core update-index --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core install esp32:esp32
```

**Teensy Setup:**
```bash
arduino-cli core update-index --additional-urls https://www.pjrc.com/teensy/package_teensy_index.json
arduino-cli core install teensy:avr
```

**Additional Arduino Boards:**
```bash
arduino-cli core update-index
arduino-cli core install arduino:samd    # For MKR boards, Nano 33 IoT, etc.
arduino-cli core install arduino:mbed_nano  # For Nano 33 BLE
```

*Note: The web interface will automatically show all boards from your installed cores.*

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
You: "Write code for ESP32 that blinks an LED on pin 2 with a 1-second interval"

Claude: "Here's code for blinking an LED..."
[Code appears in chat and is ready for compilation]

[Click Compile] → [Click Upload] → [LED starts blinking on your board]
```

### 4. Advanced Features

**Library Management:**
- Claude can suggest libraries needed for your project
- Install libraries through the interface

**Multiple Sketches:**
- Change the sketch name before compiling
- Organize different projects and experiments

**Serial Monitoring:**
- Auto-refreshes every 5 seconds
- Click "Read Serial" for immediate update
- Useful for debugging and monitoring sensor data

## Supported Boards

**The bridge automatically detects and displays all boards from your Arduino installation.** Common boards include:

**ESP32 Family:**
- ESP32 Dev Module, ESP32-S2, ESP32-S3, ESP32-C3, etc.

**Arduino Family:**
- Arduino Uno, Nano, Mega, Leonardo
- Arduino MKR series (MKR1000, MKR WiFi 1010, etc.)
- Arduino Nano 33 IoT, Nano 33 BLE

**Teensy Family:**
- Teensy 3.x, 4.0, 4.1, LC

**Other Boards:**
- Any board supported by Arduino CLI cores you have installed

*The board dropdown will show only the boards you have cores installed for, making selection easier and preventing configuration errors.*

## Development Applications

This tool is particularly useful for:

**Sensor Integration:**
- Rapid prototyping of accelerometers, pressure sensors, temperature sensors
- Testing sensor fusion and data processing
- Calibrating and testing environmental sensors

**Hardware Controllers:**
- Programming multiple microcontrollers for synchronized operation
- High-speed servo and motor control systems
- Precise timing applications and real-time control

**Development Workflow:**
- Quick iteration on embedded software projects
- Real-time debugging during development and testing
- Automated compilation for multiple board variants
- Learning embedded programming with AI assistance

## API Endpoints

The bridge server provides these endpoints:

- `GET /api/health` - Check Arduino CLI status
- `GET /api/config` - Get Arduino configuration and sketchbook location
- `GET /api/boards` - List connected boards/ports
- `GET /api/boards/available` - List all available boards from installed cores
- `POST /api/sketch` - Save Arduino sketch (can save to sketchbook folder)
- `POST /api/compile` - Compile Arduino sketch
- `POST /api/upload` - Upload sketch to board
- `GET /api/monitor/:port` - Read serial output
- `GET /api/libraries` - List installed libraries
- `POST /api/library/install` - Install library

## Troubleshooting

### "Arduino CLI not found"
- **If using local method:** Make sure `arduino-cli.exe` is in the same folder as `start.bat`
- **If using PATH method:** Make sure Arduino CLI is installed and in your PATH
- Try double-clicking `arduino-cli.exe` directly to test it
- Restart Command Prompt after PATH changes
- For local method: Right-click `arduino-cli.exe` → Properties → Unblock if downloaded from internet

### "No boards detected"
- Check USB cable connection
- Install proper drivers for your board
- Click "Refresh Ports" button
- For ESP32: Install CP210x or CH340 drivers

### "No boards in dropdown" or "Loading boards..."
- Make sure you have Arduino cores installed: `arduino-cli core list`
- Install cores for your boards (see configuration section above)
- Check the browser console for error messages
- The dropdown will show "Loading boards..." until it gets a response from Arduino CLI

### "Upload failed"
- Ensure correct port is selected
- Check that board is not running other serial programs
- Try pressing reset button during upload
- For ESP32: Hold BOOT button during upload if needed

### "Can't connect to localhost:3000"
- Make sure the server is actually running (you should see "Server running on http://localhost:3000")
- Check for error messages when running `start.bat`
- Try running `node server.js` directly to see detailed error messages
- Make sure port 3000 isn't being used by another program
- Check Windows Firewall isn't blocking the connection

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
├── arduino-cli.exe       # Arduino CLI executable (download separately)
├── server.js            # Bridge server (Node.js)
├── package.json         # Dependencies
├── start.bat           # Start the server
├── open-browser.bat    # Open browser to the app
├── public/
│   └── index.html      # Web frontend
├── sketches/           # Generated Arduino sketches
└── README.md          # This file
```

## Safety Notes

**For Embedded Development:**
- Always test code in safe environments before deploying to production
- Use proper isolation and protection for high-voltage or high-current applications
- Follow standard electrical safety practices and component ratings
- This tool is for development and prototyping - production systems should have additional safety layers and testing
- Be mindful of proper power supply design and thermal considerations

## License

MIT License - See LICENSE file for details

## Contributing

This is an open-source tool designed for Arduino developers of all kinds. Feel free to fork, contribute improvements, and adapt for your specific needs!

Potential areas for contribution:
- Additional board support
- Claude API integration
- Improved UI/UX
- Library management features
- Serial plotter functionality

## Support

For issues with this tool, check the troubleshooting section above. For Arduino CLI issues, see the official Arduino CLI documentation.
