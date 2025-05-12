const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3002; // Removed environment variable, using fixed port
const users = {}; // Store connected users

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Simulated async welcome message fetch
async function fetchWelcomeMessage() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("Welcome to the Simple WebSocket Chat!");
        }, 1500);
    });
}

// Error Handling to Prevent Crashes
process.on('uncaughtException', (err) => {
    console.error("🔥 Uncaught Exception:", err);
});

process.on('unhandledRejection', (reason) => {
    console.error("⚠️ Unhandled Promise Rejection:", reason);
});

// Socket.IO Logic
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Set username
    socket.on('set username', async (username) => {
        users[socket.id] = username?.trim() || 'Guest'; // Default to "Guest"
        console.log(`👤 ${socket.id} set username: ${users[socket.id]}`);

        socket.broadcast.emit('system message', `${users[socket.id]} has joined the chat!`);

        try {
            const welcomeMessage = await fetchWelcomeMessage();
            socket.emit('system message', welcomeMessage);
        } catch (error) {
            console.error("Error fetching welcome message:", error);
        }
    });

    // Typing indicator with debouncing
    let typingTimer;
    socket.on('typing', () => {
        clearTimeout(typingTimer);
        const username = users[socket.id] || 'Anonymous';
        socket.broadcast.emit('typing', username);

        typingTimer = setTimeout(() => {
            socket.broadcast.emit('stop typing');
        }, 2000);
    });

    // Handle chat messages with validation
    socket.on('chat message', (msg) => {
        const username = users[socket.id] || 'Guest';
        if (!msg.trim()) return; // Prevent empty messages
        io.emit('chat message', { user: username, msg });
    });

    // Private Messaging with User Validation
    socket.on('private message', ({ to, msg }) => {
        if (!users[to]) {
            socket.emit('system message', "⚠️ User not found.");
        } else {
            io.to(to).emit('chat message', { user: users[socket.id], msg, private: true });
        }
    });

    // Message reactions
    socket.on('reaction', (data) => {
        io.emit('reaction', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const username = users[socket.id];
        if (username) {
            console.log(`❌ User ${username} disconnected`);
            socket.broadcast.emit('system message', `${username} has left the chat.`);
            delete users[socket.id];
        }
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
});
