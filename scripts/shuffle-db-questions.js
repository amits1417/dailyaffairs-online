const storage = require('../services/storage');

console.log('🔄 Shuffling all stored questions in data/current_affairs.json...');
storage.shuffleAllExistingQuestions();
console.log('✨ All questions shuffled successfully!');
