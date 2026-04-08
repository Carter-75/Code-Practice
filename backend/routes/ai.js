const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route to evaluate the student's solution
router.post('/check', aiController.evaluateSolution);

// Route to generate a new practice question
router.get('/question', aiController.generateNewQuestion);

module.exports = router;
