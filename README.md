# Arduino Claude Bridge

A web-based development environment that connects Claude AI with Arduino CLI for seamless embedded development. Perfect for 'Vibe' coding Arduino, ESP & Teensy microcontrollers.

This uses the Arduino Command Line Interface, however it expects the regular Arduino IDE to be installed too.  It uses it to load the profiles for boards you have installed & to grab the preferred folders for the sketchbook & library files.

## Features

- **Web-based chat interface** - Talk to Claude about Arduino projects
- **Automatic Arduino integration** - Uses your existing Arduino IDE configuration and installed boards
- **Dynamic board detection** - Shows only the boards you have cores installed for
- **Sketch management** - Load existing sketches, save new ones, with automatic context awareness
- **Project context** - Claude understands your current sketch and can suggest improvements or modifications
- **Sketchbook integration** - Can save sketches to your Arduino sketchbook folder
- **Direct compilation** - Compile sketches with one click
- **Automatic upload** - Upload to your boards without leaving the browser  
- **Advanced serial monitoring** - Scrolling terminal with pause/play controls and 1000-line history
- **Multi-board support** - Any boards you have installed (ESP32, Arduino, Teensy, etc.)
- **Error feedback** - Compilation errors automatically sent back to Claude for fixes

## Quick Start

1. **Get a Claude API key** from https://console.anthropic.com/
2. **Download/Clone this repository**
3. **Download `arduino-cli.exe`** and put it in the same folder
4. **Double-click `start.bat`** (automatically runs `npm install`)
5. **When you see "Server running"**, double-click `open-browser.bat` OR manually open browser to http://localhost:3000
6. **Enter your API key** and click "Connect" (automatically saved for future use)
7. **Start coding with Claude!**

## Prerequisites

### 1. Get a Claude API Key

**Get your API key from Anthropic:**
1. Visit https://console.anthropic.com/
2. Sign up or log in to your account
3. Go to "API Keys" in your account settings
4. Create a new API key
5. Copy the key (it starts with `sk-ant-`)

**Note:** Claude API usage is pay-per-use. Check Anthropic's pricing for current rates.

### 2. Install Node.js

**Download:** https://nodejs.org/
- Choose the LTS version (recommended for most users)
- Run the installer with default settings
- Verify installation: Open Command Prompt and type `node --version`

### 3. Install Arduino CLI

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

### 4. Configure Arduino CLI for Your Boards

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
   - **Automatically run `npm install`** to install dependencies
   - Start the server
   - Open your browser automatically

### Option 2: Manual Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd arduino-claude-bridge

# Install dependencies (REQUIRED)
npm install

# Start the server
npm start
```

**Important:** You **must run `npm install`** before the first use to install required dependencies including the `cors` package.

## Usage

### 1. Starting the System

- **Easy way:** Double-click `start.bat`
- **Manual way:** Run `npm start` in the project folder
- Browser should open automatically to http://localhost:3000

### 2. Basic Workflow

1. **Enter your API key:** If not connected, enter your Claude API key and click "Connect" (saved automatically for future sessions)
2. **Load existing sketch (optional):** Use the sketch dropdown to load an existing project, or start fresh
3. **Ask Claude for code:** "Write code for ESP32 to blink an LED" - Claude will see your current sketch context
4. **Save your work:** Click "Save" to save your sketch to your sketchbook or local folder
5. **Select your board:** Choose from the dropdown (ESP32, Teensy, etc.)
6. **Select your port:** Refresh ports and choose your connected device
7. **Compile:** Click "Compile" - errors automatically go back to Claude
8. **Upload:** Click "Upload" to program your board
9. **Monitor:** Serial output appears automatically in scrolling terminal

**API Key Management:** Once connected, use the "⚙️ API" dropdown in the header to update or clear your API key.

**Serial Monitor:** 
- Scrolling terminal with 1000-line history
- Pause/Play button to freeze output while continuing to read data
- Clear button to reset the display
- Auto-scroll to bottom on new data

### 3. Example Conversations

**Starting a new project:**
```
You: "Write code for ESP32 that blinks an LED on pin 2 with a 1-second interval"

Claude: "Here's code for blinking an LED..."
[Code appears in chat and is ready for compilation]

[Click Save] → [Click Compile] → [Click Upload] → [LED starts blinking]
```

**Working with existing sketches:**
```
[Load existing sketch from dropdown]

You: "Add a button on pin 4 that changes the blink speed when pressed"

Claude: "I can see your current LED blink code. Here's how to add button control..."
[Modified code appears, understanding your existing project]

[Click Save] → [Click Compile] → [Click Upload] → [Enhanced functionality]
```

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

## Recent Improvements

- **Enhanced Serial Monitor:** Scrolling terminal with pause/play controls, 1000-line history buffer, and proper scroll bars
- **Improved Compilation:** Extended timeouts (60s compile, 45s upload) to handle toolchain downloads
- **Better Error Handling:** More reliable Arduino CLI integration and port management
- **CORS Support:** Added required dependencies for proper API communication

## Troubleshooting

### "Arduino CLI not found"
- **If using local method:** Make sure `arduino-cli.exe` is in the same folder as `start.bat`
- **If using PATH method:** Make sure Arduino CLI is installed and in your PATH
- Try double-clicking `arduino-cli.exe` directly to test it
- Restart Command Prompt after PATH changes

### "Module not found" errors
- **Run `npm install`** in the project folder to install all dependencies
- Make sure Node.js is properly installed
- If the `start.bat` script fails, try running `npm install` manually first

### "Claude API key issues"
- Make sure your API key starts with `sk-ant-`
- Check that your API key is valid at https://console.anthropic.com/
- Ensure you have sufficient credits in your Anthropic account
- Use the "⚙️ API" dropdown to update your key if needed

### "No boards detected"
- Check USB cable connection
- Install proper drivers for your board
- Click "Refresh Ports" button
- For ESP32: Install CP210x or CH340 drivers

### "Compilation timeouts"
- First compilation may take 60+ seconds to download toolchains
- Subsequent compilations will be much faster
- Check internet connection for toolchain downloads

### "Serial monitor not updating"
- **Access via http://localhost:3000** - never open the HTML file directly
- Check that correct port and baud rate are selected
- Use pause/play button to control data flow
- Arduino must be sending data for monitor to display anything

## Development Applications

This tool is particularly useful for:

**Iterative Development:**
- Load existing sketches and ask Claude to add new features
- Claude understands your current code and suggests contextual improvements
- Seamlessly evolve projects from simple prototypes to complex systems

**Sensor Integration:**
- Rapid prototyping of accelerometers, pressure sensors, temperature sensors
- Testing sensor fusion and data processing with AI assistance
- Real-time monitoring with the enhanced serial terminal

**Hardware Controllers:**
- Programming multiple microcontrollers with AI guidance
- High-speed servo and motor control systems
- Precise timing applications and real-time debugging

## Security Notes

**API Key Handling:**
- API keys are saved to your browser's localStorage for convenience
- Keys persist between sessions (no need to re-enter each time)
- Use the "Clear" button to remove your saved key when needed
- Keys are stored locally on your machine only

**Network Security:**
- All API calls use HTTPS encryption
- The bridge server runs locally on your machine
- No data is sent to third-party servers except Anthropic's API

## Safety Notes

**For Production Systems:**
- Always test code in safe environments before deploying to production
- Use proper isolation and protection for high-voltage or high-current applications
- This tool is for development and prototyping - production systems should have additional safety layers

## License

MIT License - See LICENSE file for details

## Contributing

This is an open-source tool designed for Arduino developers. Feel free to fork, contribute improvements, and adapt for your specific needs!

## Support

For issues with this tool, check the troubleshooting section above. For Arduino CLI issues, see the official Arduino CLI documentation.
