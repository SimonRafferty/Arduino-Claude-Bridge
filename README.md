# Arduino Claude Bridge

A web-based development tool that connects Claude AI with Arduino CLI for embedded development.

## Quick Start

1. **Get a Claude API key** from https://console.anthropic.com/
2. **Download/Clone this repository**
3. **Download `arduino-cli.exe`** and put it in the same folder
4. **Double-click `start.bat`** 
5. **Open browser to http://localhost:3000** (or click `open-browser.bat`)
6. **Enter your API key** and click "Connect"
7. **Start coding with Claude!**

## Installation

### Prerequisites

- **Node.js** - Download from https://nodejs.org/
- **Arduino CLI** - Download `arduino-cli.exe` from https://arduino.github.io/arduino-cli/installation/
- **Claude API key** - Get from https://console.anthropic.com/

### Setup

**Easy Method:**
1. Put `arduino-cli.exe` in the same folder as `start.bat`
2. Double-click `start.bat` to install dependencies and start server
3. Browser opens automatically to http://localhost:3000

**Manual Method:**
```bash
npm install
npm start
```

### Board Configuration

Install cores for your boards:
```bash
# ESP32
arduino-cli core update-index --additional-urls https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core install esp32:esp32

# Teensy  
arduino-cli core update-index --additional-urls https://www.pjrc.com/teensy/package_teensy_index.json
arduino-cli core install teensy:avr

# Arduino boards
arduino-cli core install arduino:samd
```

## Usage

1. **Connect API key** - Enter your Claude API key (saved for future sessions)
2. **Load/Create sketches** - Load existing projects or start fresh
3. **Chat with Claude** - Ask for code, debugging help, or improvements
4. **Select board and port** - Choose your hardware from dropdowns
5. **Compile and upload** - One-click compilation and upload to your board
6. **Monitor serial output** - Real-time serial data with scrolling history

## Features

- Chat interface with Claude for Arduino development
- Load/save sketches with project context awareness
- Auto-detects your installed Arduino boards and ports
- Real-time compilation and upload
- Serial monitor with history and timestamps
- Persistent settings (API key, board/port selections)

## Troubleshooting

- **"Arduino CLI not found"** - Make sure `arduino-cli.exe` is in the project folder
- **"No boards in dropdown"** - Install board cores with `arduino-cli core install`
- **"Upload failed"** - Check board/port selection, close Arduino IDE if open
- **"No serial data"** - Verify baud rate matches your sketch, ensure Arduino is sending data

## File Structure

```
arduino-claude-bridge/
├── arduino-cli.exe       # Download separately
├── start.bat            # Windows startup script
├── open-browser.bat     # Open browser to app
├── server.js           # Bridge server
├── package.json        # Dependencies
├── public/index.html   # Web interface
└── README.md          # This file
```

## License

MIT License
