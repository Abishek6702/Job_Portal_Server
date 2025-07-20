const express = require('express');
const router = express.Router();
const controller = require('../controllers/templateController');

router.post('/', controller.createTemplate);
router.get('/', controller.getTemplates);
router.get('/:id', controller.getTemplate);
router.put('/:id', controller.updateTemplate);
router.delete('/:id', controller.deleteTemplate);

module.exports = router;
