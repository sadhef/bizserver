const TodoTask = require('../models/TodoTask');
const { AppError } = require('../../utils/errorHandler');

/**
 * Get all todo tasks for the current cloud user
 * @route GET /api/cloud/todos
 * @access Private (Cloud Users)
 */
exports.getAllTodos = async (req, res, next) => {
  try {
    const { status, priority, search, sortBy = 'dueDate', sortOrder = 'asc', page = 1, limit = 20 } = req.query;
    
    // Build filter query
    const filter = {
      assignedTo: req.user.id,
      isDeleted: false
    };
    
    if (status) {
      filter.status = status;
    }
    
    if (priority) {
      filter.priority = priority;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get tasks with pagination
    const tasks = await TodoTask.find(filter)
      .populate('createdBy', 'name email')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalTasks = await TodoTask.countDocuments(filter);
    
    // Get statistics
    const stats = await TodoTask.aggregate([
      { $match: { assignedTo: req.user.id, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const statusCounts = {
      pending: 0,
      'in-progress': 0,
      completed: 0,
      cancelled: 0
    };
    
    stats.forEach(stat => {
      statusCounts[stat._id] = stat.count;
    });
    
    res.status(200).json({
      status: 'success',
      results: tasks.length,
      totalTasks,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTasks / parseInt(limit)),
      statistics: statusCounts,
      tasks
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single todo task
 * @route GET /api/cloud/todos/:id
 * @access Private (Cloud Users)
 */
exports.getTodo = async (req, res, next) => {
  try {
    const task = await TodoTask.findOne({
      _id: req.params.id,
      assignedTo: req.user.id,
      isDeleted: false
    }).populate('createdBy', 'name email');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      task
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new todo task
 * @route POST /api/cloud/todos
 * @access Private (Cloud Users)
 */
exports.createTodo = async (req, res, next) => {
  try {
    const { title, description, priority, dueDate, reminderTime, isRecurring, recurringType, tags } = req.body;
    
    // Validate required fields
    if (!title || !dueDate) {
      throw new AppError('Title and due date are required', 400);
    }
    
    // Validate due date is in the future
    if (new Date(dueDate) <= new Date()) {
      throw new AppError('Due date must be in the future', 400);
    }
    
    // Validate reminder time if provided
    if (reminderTime && new Date(reminderTime) >= new Date(dueDate)) {
      throw new AppError('Reminder time must be before due date', 400);
    }
    
    const taskData = {
      title,
      description,
      priority,
      dueDate,
      reminderTime,
      isRecurring,
      recurringType,
      tags: tags ? tags.filter(tag => tag.trim()) : [],
      createdBy: req.user.id,
      assignedTo: req.user.id
    };
    
    const task = await TodoTask.create(taskData);
    
    res.status(201).json({
      status: 'success',
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a todo task
 * @route PATCH /api/cloud/todos/:id
 * @access Private (Cloud Users)
 */
exports.updateTodo = async (req, res, next) => {
  try {
    const allowedUpdates = ['title', 'description', 'priority', 'status', 'dueDate', 'reminderTime', 'isRecurring', 'recurringType', 'tags'];
    const updates = {};
    
    // Filter allowed updates
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });
    
    // Validate due date if being updated
    if (updates.dueDate && new Date(updates.dueDate) <= new Date() && req.body.status !== 'completed') {
      throw new AppError('Due date must be in the future for non-completed tasks', 400);
    }
    
    // Validate reminder time if being updated
    if (updates.reminderTime && updates.dueDate && new Date(updates.reminderTime) >= new Date(updates.dueDate)) {
      throw new AppError('Reminder time must be before due date', 400);
    }
    
    const task = await TodoTask.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedTo: req.user.id,
        isDeleted: false
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    ).populate('createdBy', 'name email');
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a todo task (soft delete)
 * @route DELETE /api/cloud/todos/:id
 * @access Private (Cloud Users)
 */
exports.deleteTodo = async (req, res, next) => {
  try {
    const task = await TodoTask.findOneAndUpdate(
      {
        _id: req.params.id,
        assignedTo: req.user.id,
        isDeleted: false
      },
      {
        isDeleted: true,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Task deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark task as completed
 * @route PATCH /api/cloud/todos/:id/complete
 * @access Private (Cloud Users)
 */
exports.completeTodo = async (req, res, next) => {
  try {
    const task = await TodoTask.findOne({
      _id: req.params.id,
      assignedTo: req.user.id,
      isDeleted: false
    });
    
    if (!task) {
      throw new AppError('Task not found', 404);
    }
    
    await task.markCompleted();
    
    res.status(200).json({
      status: 'success',
      message: 'Task marked as completed',
      task
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard statistics
 * @route GET /api/cloud/todos/stats
 * @access Private (Cloud Users)
 */
exports.getTodoStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Get various statistics
    const [
      totalTasks,
      completedTasks,
      overdueTasks,
      dueTodayTasks,
      dueTomorrowTasks,
      dueThisWeekTasks,
      priorityStats,
      recentActivity
    ] = await Promise.all([
      TodoTask.countDocuments({ assignedTo: userId, isDeleted: false }),
      TodoTask.countDocuments({ assignedTo: userId, status: 'completed', isDeleted: false }),
      TodoTask.countDocuments({ 
        assignedTo: userId, 
        dueDate: { $lt: now }, 
        status: { $ne: 'completed' },
        isDeleted: false 
      }),
      TodoTask.countDocuments({ 
        assignedTo: userId, 
        dueDate: { $gte: today, $lt: tomorrow },
        status: { $ne: 'completed' },
        isDeleted: false 
      }),
      TodoTask.countDocuments({ 
        assignedTo: userId, 
        dueDate: { $gte: tomorrow, $lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) },
        status: { $ne: 'completed' },
        isDeleted: false 
      }),
      TodoTask.countDocuments({ 
        assignedTo: userId, 
        dueDate: { $gte: today, $lt: nextWeek },
        status: { $ne: 'completed' },
        isDeleted: false 
      }),
      TodoTask.aggregate([
        { $match: { assignedTo: userId, isDeleted: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      TodoTask.find({ 
        assignedTo: userId, 
        isDeleted: false 
      })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status updatedAt')
    ]);
    
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    const priorityDistribution = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    priorityStats.forEach(stat => {
      priorityDistribution[stat._id] = stat.count;
    });
    
    res.status(200).json({
      status: 'success',
      statistics: {
        totalTasks,
        completedTasks,
        overdueTasks,
        dueTodayTasks,
        dueTomorrowTasks,
        dueThisWeekTasks,
        completionRate,
        priorityDistribution,
        recentActivity
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update tasks
 * @route PATCH /api/cloud/todos/bulk
 * @access Private (Cloud Users)
 */
exports.bulkUpdateTodos = async (req, res, next) => {
  try {
    const { taskIds, operation, data } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      throw new AppError('Task IDs are required', 400);
    }
    
    if (!operation) {
      throw new AppError('Operation is required', 400);
    }
    
    let updateData = {};
    
    switch (operation) {
      case 'complete':
        updateData = { status: 'completed', completedAt: new Date() };
        break;
      case 'delete':
        updateData = { isDeleted: true };
        break;
      case 'update-priority':
        if (!data || !data.priority) {
          throw new AppError('Priority is required for priority update', 400);
        }
        updateData = { priority: data.priority };
        break;
      case 'update-status':
        if (!data || !data.status) {
          throw new AppError('Status is required for status update', 400);
        }
        updateData = { status: data.status };
        break;
      default:
        throw new AppError('Invalid operation', 400);
    }
    
    const result = await TodoTask.updateMany(
      {
        _id: { $in: taskIds },
        assignedTo: req.user.id,
        isDeleted: false
      },
      {
        ...updateData,
        updatedAt: new Date()
      }
    );
    
    res.status(200).json({
      status: 'success',
      message: `${result.modifiedCount} tasks updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
};