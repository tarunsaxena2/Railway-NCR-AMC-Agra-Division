const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/authMiddleware');

const {
    createComplaint,
    getUserComplaints,
    getComplaintById,
    submitUserVerification
} = require('../controllers/complaintsController');

// Create Complaint
router.post('/', protect, createComplaint);

// User Complaint List
router.get('/my-complaints', protect, getUserComplaints);

// User Verification (NEW FEATURE)
router.put('/:id/verify', protect, submitUserVerification);

// Track Complaint
router.get('/track/:id', getComplaintById);

module.exports = router;