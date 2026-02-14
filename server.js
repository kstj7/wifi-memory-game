const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' folder
app.use(express.static('public'));

let players = [];
let cards = [];
let currentPlayerIndex = 0;
let expectedValue = 1;
let isPaused = false; 

// Initialize a new deck
function initGame() {
    cards = [];
    for (let i = 1; i <= 10; i++) {
        cards.push({ id: i - 1, value: i, isFlipped: false });
    }
    // Shuffle the deck
    cards.sort(() => Math.random() - 0.5);
    expectedValue = 1;
    currentPlayerIndex = 0;
    isPaused = false;
}

initGame();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Assign player roles (only allow 2 players to actively play)
    if (players.length < 2) {
        players.push(socket.id);
        socket.emit('role', `Player ${players.length}`);
    } else {
        socket.emit('role', 'Spectator');
    }

    // Send current game state to the newly connected player
    io.emit('gameState', {
        cards,
        currentPlayer: `Player ${currentPlayerIndex + 1}`,
        expectedValue,
        playersCount: players.length
    });

    // Handle a card flip
    socket.on('flipCard', (index) => {
        if (isPaused || socket.id !== players[currentPlayerIndex] || cards[index].isFlipped) {
            return;
        }

        const card = cards[index];

        if (card.value === expectedValue) {
            card.isFlipped = true;
            expectedValue++;

            if (expectedValue > 10) {
                io.emit('gameOver', `Player ${currentPlayerIndex + 1} Wins!`);
            } else {
                io.emit('gameState', { cards, currentPlayer: `Player ${currentPlayerIndex + 1}`, expectedValue, playersCount: players.length });
            }
        } else {
            isPaused = true;
            card.isFlipped = true; 

            io.emit('gameState', { cards, currentPlayer: `Player ${currentPlayerIndex + 1} (Mistake!)`, expectedValue, playersCount: players.length });

            setTimeout(() => {
                cards.forEach(c => c.isFlipped = false); 
                expectedValue = 1; 
                currentPlayerIndex = 1 - currentPlayerIndex; 
                isPaused = false;

                io.emit('gameState', { cards, currentPlayer: `Player ${currentPlayerIndex + 1}`, expectedValue, playersCount: players.length });
            }, 2000);
        }
    });

    socket.on('restart', () => {
        initGame();
        io.emit('gameState', { cards, currentPlayer: `Player ${currentPlayerIndex + 1}`, expectedValue, playersCount: players.length });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        players = players.filter(id => id !== socket.id);
        if (players.length < 2) {
            initGame(); 
            io.emit('gameState', { cards, currentPlayer: `Waiting for Player 2...`, expectedValue, playersCount: players.length });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Game running on port ${PORT}`);
});
