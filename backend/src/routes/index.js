const express = require('express');
const authRoutes = require('./auth');
const contactRoutes = require('./contacts');
const contactTypeRoutes = require('./contactTypes');
const hierarchyRoutes = require('./hierarchy');

const router = express.Router();

// API versioning
const API_VERSION = '/v1';

// Route mounting
router.use(`${API_VERSION}/auth`, authRoutes);
router.use(`${API_VERSION}/contacts`, contactRoutes);
router.use(`${API_VERSION}/contact-types`, contactTypeRoutes);
router.use(`${API_VERSION}/hierarchy`, hierarchyRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Pathfinder API v1.0.0',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      contacts: '/api/v1/contacts',
      contactTypes: '/api/v1/contact-types',
      hierarchy: '/api/v1/hierarchy'
    },
    documentation: '/api-docs'
  });
});

module.exports = router;
