const express = require('express');
const serverless = require('serverless-http');
const app = require('../server');

// Mount the app at root so all /api/* paths map correctly as defined in server.js
const wrapper = express();
wrapper.use('/', app);

module.exports = serverless(wrapper);


