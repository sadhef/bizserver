// File: api/routes/todos.js
const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const { protect, restrictToCloud } = require('../middleware/auth');

// Protect all routes and restrict to cloud users
router.use(protect);
router.use(restrictToCloud);

// Get dashboard statistics
router.get('/stats', todoController.getTodoStats);

// Bulk operations
router.patch('/bulk', todoController.bulkUpdateTodos);

// Get all todos with filtering and pagination
router.get('/', todoController.getAllTodos);

// Create new todo
router.post('/', todoController.createTodo);

// Get, update, delete specific todo
router.route('/:id')
  .get(todoController.getTodo)
  .patch(todoController.updateTodo)
  .delete(todoController.deleteTodo);

// Mark todo as completed
router.patch('/:id/complete', todoController.completeTodo);

module.exports = router;