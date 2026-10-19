// toda.js - Print the current real date and time

const now = new Date();

const options = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
};

console.log('Current date and time:', now.toLocaleString('en-US', options));