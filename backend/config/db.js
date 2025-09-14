const mongoose = require('mongoose');


const dbURI = 'mongodb+srv://waqas:waqasmangi123@scholorfinder.qeygr.mongodb.net/scholarship_finder_prod?retryWrites=true&w=majority';

const connectDB = async () => {
  try {
    await mongoose.connect(dbURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;