const express = require('express');
const router = express.Router();
const controller = require('../controllers/resumeController');

router.post('/', controller.createResume);
router.get('/:id', controller.getResume);
router.put('/:id', controller.updateResume);
router.delete('/:id', controller.deleteResume);
router.post('/render/:id', controller.renderResume); 
router.get('/render-pdf/:id', controller.renderResumePDF);


module.exports = router;
