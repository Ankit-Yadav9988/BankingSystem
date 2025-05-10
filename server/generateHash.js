const bcrypt = require('bcrypt');

const passwords = {
  "Ankit": "sbi123",
  "Atul": "ubi123",
  "Sunil": "pnb123"
};

Object.entries(passwords).forEach(([name, password]) => {
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) console.error(`Error hashing ${name}'s password:`, err);
    else console.log(`${name}'s Hash: ${hash}`);
  });
});