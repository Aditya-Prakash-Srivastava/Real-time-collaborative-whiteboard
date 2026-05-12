const io = require('socket.io-client');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

// Create a dummy token for testing (sgoenka522)
const token = jwt.sign({ email: 'sgoenka522@gmail.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const socket = io('http://localhost:5000', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('Test Client Connected! ID:', socket.id);
  const roomId = 'TEST12';
  socket.emit('room:join', roomId);
  console.log('Joined room:', roomId);

  socket.on('initial:state', (data) => {
    console.log('Received initial:state', data.elements.length, 'elements');
  });

  socket.on('board:update', (data) => {
    console.log('Received board:update! Elements:', data.elements.length, 'Version:', data.version);
  });
  
  socket.on('pointer:update', (data) => {
    // console.log('Pointer update from', data.userId);
  });
});
