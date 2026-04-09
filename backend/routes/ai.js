const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Route to evaluate the student's solution
router.post('/check', aiController.evaluateSolution);

// Route to generate a new practice question
router.get('/question', aiController.generateNewQuestion);

// Route to skip the current question
router.post('/skip', aiController.skipQuestion);

// Route to submit feedback and trigger AI context reflection
router.post('/feedback', aiController.submitFeedback);

// Route to get available languages from curriculum
router.get('/languages', aiController.getAvailableLanguages);

module.exports = router;
