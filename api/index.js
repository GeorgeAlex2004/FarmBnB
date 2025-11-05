const express = require('express');
const serverless = require('serverless-http');
const app = require('../server');

// Wrap the main app under /api so routes like /api/health resolve correctly
const wrapper = express();
wrapper.use('/api', app);

module.exports = serverless(wrapper);


