const storageRoutes = require('./routes/storage');
const express = require('express');
const app = express();
app.use('/api/storage', storageRoutes);

const request = require('supertest');
request(app)
  .get('/api/storage/status')
  .expect('Content-Type', /json/)
  .end(function(err, res) {
    if (err) throw err;
    console.log(JSON.stringify(res.body, null, 2));
  });
