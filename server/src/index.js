const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
require('dotenv').config();
const bcrypt = require('bcrypt');

console.log('EMAIL_USER:', process.env.EMAIL_USER); // Should print your email
console.log('EMAIL_PASS:', process.env.EMAIL_PASS); // Should print your password

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

  app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Banking System API');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));