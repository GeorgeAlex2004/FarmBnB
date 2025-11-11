const express = require('express');
const serverless = require('serverless-http');
const app = require('../server');

// Mount the app at root so server routes like /api/health resolve at /api/health
const wrapper = express();
wrapper.use('/', app);

module.exports = serverless(wrapper);


