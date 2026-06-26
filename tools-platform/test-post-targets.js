const req = require('supertest');
const express = require('express');
const app = express();
app.use(express.json());

// Mock requireAuth
app.use((req, res, next) => next());

app.use('/api/sla', require('./backend/routes/sla'));

const request = req(app);

(async () => {
  try {
    console.log('Testing POST /api/sla/targets ...');
    let res = await request.post('/api/sla/targets').send({
      "test_target": {
         label: "Test Target",
         type: "gte",
         "5": 100
      }
    });
    console.log('targets post status:', res.status, res.body);

  } catch(e) {
    console.error(e);
  }
})();
