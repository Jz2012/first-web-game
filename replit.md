# Ping Pong Web Game

## Overview
A multiplayer ping pong game built with Flask and Socket.IO for real-time gameplay. Players can control paddles using keyboard inputs, with the game state synchronized across all connected clients.

## Project Architecture

### Backend (Python/Flask)
- **Framework**: Flask 3.x with Flask-SocketIO
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Port**: 5000 (configured for Replit environment)
- **Host**: 0.0.0.0 (accepts connections from all interfaces)

### Frontend
- **HTML Canvas**: Game rendering using HTML5 Canvas API
- **JavaScript**: Game logic and Socket.IO client
- **CSS**: Minimal styling for game container and score display

## File Structure
```
.
├── app.py                 # Flask server with Socket.IO handlers
├── requirements.txt       # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css     # Game styling
│   └── js/
│       └── game.js       # Game logic and rendering
└── templates/
    └── index.html        # Game HTML template
```

## Key Features
- Single-player game with predictive AI opponent
- Three difficulty levels (Easy, Medium, Hard)
- Advanced ball trajectory prediction with wall bounce simulation
- Canvas-based game rendering
- Score tracking for both players
- Keyboard controls for player (Arrow Up/Down)
- Smart AI that predicts where the ball will land
- Difficulty-based AI behavior (speed, reaction time, accuracy)
- Ball physics with paddle collision detection
- Automatic ball reset after scoring

## Dependencies
- Flask (>=3.0.0) - Web framework
- Flask-SocketIO (>=5.3.0) - WebSocket support
- python-engineio (>=4.8.0) - Engine.IO protocol
- python-socketio (>=5.10.0) - Socket.IO protocol

## Recent Changes (Oct 26, 2025)
- Imported project from GitHub
- Updated dependencies to use Flask 3.x for compatibility with Werkzeug 3.x
- Configured server to run on 0.0.0.0:5000 for Replit environment
- Added allow_unsafe_werkzeug flag for development server
- Created .gitignore for Python projects
- Set up workflow for automatic server startup
- Implemented advanced AI with ball trajectory prediction
  - AI simulates ball path including wall bounces
  - Predicts where ball will land on its side
  - Moves to intercept position proactively
- Added three difficulty levels with UI selector
  - **Easy**: Slower speed (2.5), longer reaction time (15 frames), high error rate
  - **Medium**: Moderate speed (3.5), medium reaction time (8 frames), some errors
  - **Hard**: Fast speed (5.0), quick reaction time (3 frames), minimal errors
- Added position clamping for accurate physics simulation
- Implemented reaction delays and prediction errors for realistic AI behavior

## Running the Project
The Flask server is configured to run automatically via the Replit workflow system. The game will be accessible through the Replit webview on port 5000.

## Game Controls
- **Arrow Up**: Move paddle up
- **Arrow Down**: Move paddle down

## Technical Notes
- The game uses Socket.IO for real-time communication between players
- Game state is maintained client-side with server broadcasting paddle movements
- Ball physics and collision detection are handled in the browser
- The server is configured for development mode with debug=True
