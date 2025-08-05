const express = require('express');
const router = express.Router();

// GET /api/v1/contact-types
router.get('/', async (req, res) => {
  try {
    // TODO: Implement get all contact types
    const mockData = [
      { id: 1, name: 'COMPANY', description: 'Corporate entity', count: 24 },
      { id: 2, name: 'DIVISION', description: 'Department/Division', count: 52 },
      { id: 3, name: 'PERSON', description: 'Individual person', count: 120 }
    ];
    
    res.json({ 
      success: true, 
      data: mockData,
      message: 'Contact types retrieved successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/contact-types
router.post('/', async (req, res) => {
  try {
    // TODO: Implement create contact type
    res.status(201).json({ 
      success: true, 
      data: req.body,
      message: 'Contact type created successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
