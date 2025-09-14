const express = require("express");
const router = express.Router();
const ShiftSwap = require("../models/shift");
const Schedule = require("../models/schedule");
const User = require("../models/user");
const UserProfile = require("../models/userprofile");
const jwt = require("jsonwebtoken");

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required"
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token"
      });
    }
    req.user = user;
    next();
  });
};

// Admin check middleware
const adminOnly = (req, res, next) => {
 if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }
  next();
};

// 🔹 POST /api/shifts/request-swap - Request shift swap
router.post("/request-swap", authenticateToken, async (req, res) => {
  try {
    const { 
      targetUserId, 
      requesterScheduleId, 
      targetScheduleId, 
      reason 
    } = req.body;
    const requesterId = req.user.id;

    // Validate input
    if (!targetUserId || !requesterScheduleId || !targetScheduleId || !reason) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: targetUserId, requesterScheduleId, targetScheduleId, reason"
      });
    }

    // Check if trying to swap with yourself
    if (requesterId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: "Cannot request shift swap with yourself"
      });
    }

    // Verify schedules exist and belong to correct users
    const requesterSchedule = await Schedule.findById(requesterScheduleId);
    const targetSchedule = await Schedule.findById(targetScheduleId);

    if (!requesterSchedule || !targetSchedule) {
      return res.status(404).json({
        success: false,
        message: "One or both schedules not found"
      });
    }

    if (requesterSchedule.userId.toString() !== requesterId) {
      return res.status(403).json({
        success: false,
        message: "You can only swap your own shifts"
      });
    }

    if (targetSchedule.userId.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: "Target schedule doesn't belong to specified user"
      });
    }

    // Check if schedules are already involved in pending swaps
    const existingSwap = await ShiftSwap.findOne({
      $or: [
        { requesterScheduleId, status: 'pending' },
        { targetScheduleId: requesterScheduleId, status: 'pending' },
        { requesterScheduleId: targetScheduleId, status: 'pending' },
        { targetScheduleId, status: 'pending' }
      ]
    });

    if (existingSwap) {
      return res.status(400).json({
        success: false,
        message: "One or both shifts are already involved in a pending swap request"
      });
    }

    // Check skill compatibility (optional enhancement)
    const requesterProfile = await UserProfile.findOne({ userId: requesterId });
    const targetProfile = await UserProfile.findOne({ userId: targetUserId });

    if (requesterProfile && targetProfile) {
      // Basic department check
      if (requesterSchedule.department !== targetSchedule.department) {
        // Allow but warn about different departments
        console.log(`Warning: Shift swap requested between different departments: ${requesterSchedule.department} <-> ${targetSchedule.department}`);
      }
    }

    // Create swap request
    const swapRequest = new ShiftSwap({
      requesterId,
      targetUserId,
      requesterScheduleId,
      targetScheduleId,
      reason: reason.trim()
    });

    await swapRequest.save();

    // Populate for response
    await swapRequest.populate('requesterId', 'username email');
    await swapRequest.populate('targetUserId', 'username email');
    await swapRequest.populate('requesterScheduleId');
    await swapRequest.populate('targetScheduleId');

    res.status(201).json({
      success: true,
      message: "Shift swap request submitted successfully",
      swapRequest
    });

  } catch (error) {
    console.error("Request shift swap error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request shift swap"
    });
  }
});

// 🔹 GET /api/shifts/my-requests - Get user's swap requests (both sent and received)
router.get("/my-requests", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = {
      $or: [
        { requesterId: userId },
        { targetUserId: userId }
      ]
    };

    if (status) {
      query.status = status;
    }

    const swapRequests = await ShiftSwap.find(query)
      .populate('requesterId', 'username email')
      .populate('targetUserId', 'username email')
      .populate('requesterScheduleId')
      .populate('targetScheduleId')
      .sort({ createdAt: -1 });

    // Categorize requests
    const categorized = {
      sent: swapRequests.filter(req => req.requesterId._id.toString() === userId),
      received: swapRequests.filter(req => req.targetUserId._id.toString() === userId)
    };

    res.status(200).json({
      success: true,
      requests: categorized,
      total: swapRequests.length
    });

  } catch (error) {
    console.error("Get my swap requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch swap requests"
    });
  }
});

// 🔹 PUT /api/shifts/respond/:swapId - Respond to swap request (accept/reject)
router.put("/respond/:swapId", authenticateToken, async (req, res) => {
  try {
    const { swapId } = req.params;
    const { action, responseMessage } = req.body; // action: 'accepted' or 'rejected'
    const userId = req.user.id;

    if (!action || !['accepted', 'rejected'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'accepted' or 'rejected'"
      });
    }

    const swapRequest = await ShiftSwap.findById(swapId)
      .populate('requesterScheduleId')
      .populate('targetScheduleId');

    if (!swapRequest) {
      return res.status(404).json({
        success: false,
        message: "Swap request not found"
      });
    }

    // Check if user is the target of this swap request
    if (swapRequest.targetUserId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only respond to swap requests sent to you"
      });
    }

    // Check if request is still pending
    if (swapRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "This swap request has already been processed"
      });
    }

    // Check if request hasn't expired
    if (new Date() > swapRequest.expiresAt) {
      swapRequest.status = 'cancelled';
      await swapRequest.save();
      return res.status(400).json({
        success: false,
        message: "This swap request has expired"
      });
    }

    // Update swap request
    swapRequest.status = action;
    swapRequest.responseMessage = responseMessage || '';

    if (action === 'accepted') {
      // If accepted and admin approval is required, set to pending admin approval
      if (swapRequest.adminApproval.required) {
        swapRequest.adminApproval.status = 'pending';
        swapRequest.status = 'accepted'; // User accepted, but waiting for admin
      } else {
        // No admin approval required, execute swap immediately
        await executeShiftSwap(swapRequest);
      }
    }

    await swapRequest.save();

    await swapRequest.populate('requesterId', 'username email');
    await swapRequest.populate('targetUserId', 'username email');

    const message = action === 'accepted' 
      ? (swapRequest.adminApproval.required 
          ? "Swap request accepted. Waiting for admin approval." 
          : "Swap request accepted and schedules have been updated.")
      : "Swap request rejected.";

    res.status(200).json({
      success: true,
      message,
      swapRequest
    });

  } catch (error) {
    console.error("Respond to swap request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to respond to swap request"
    });
  }
});

// 🔹 GET /api/shifts/admin/pending - Get pending admin approvals (admin only)
router.get("/admin/pending", authenticateToken, adminOnly, async (req, res) => {
  try {
    const pendingApprovals = await ShiftSwap.find({
      status: 'accepted',
      'adminApproval.status': 'pending'
    })
    .populate('requesterId', 'username email')
    .populate('targetUserId', 'username email')
    .populate('requesterScheduleId')
    .populate('targetScheduleId')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      pendingApprovals,
      total: pendingApprovals.length
    });

  } catch (error) {
    console.error("Get pending approvals error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch pending approvals"
    });
  }
});

// 🔹 PUT /api/shifts/admin/approve/:swapId - Admin approve/reject swap
router.put("/admin/approve/:swapId", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { swapId } = req.params;
    const { action, approvalNotes } = req.body; // action: 'approved' or 'rejected'

    if (!action || !['approved', 'rejected'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approved' or 'rejected'"
      });
    }

    const swapRequest = await ShiftSwap.findById(swapId)
      .populate('requesterScheduleId')
      .populate('targetScheduleId');

    if (!swapRequest) {
      return res.status(404).json({
        success: false,
        message: "Swap request not found"
      });
    }

    if (swapRequest.adminApproval.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "This swap request is not pending admin approval"
      });
    }

    // Update admin approval
    swapRequest.adminApproval.status = action;
    swapRequest.adminApproval.approvedBy = req.user.id;
    swapRequest.adminApproval.approvalDate = new Date();
    swapRequest.adminApproval.approvalNotes = approvalNotes || '';

    if (action === 'approved') {
      // Execute the shift swap
      await executeShiftSwap(swapRequest);
    } else {
      // If rejected, set overall status to rejected
      swapRequest.status = 'rejected';
      swapRequest.responseMessage = 'Rejected by admin: ' + (approvalNotes || 'No reason provided');
    }

    await swapRequest.save();

    await swapRequest.populate('requesterId', 'username email');
    await swapRequest.populate('targetUserId', 'username email');

    res.status(200).json({
      success: true,
      message: `Shift swap ${action} successfully`,
      swapRequest
    });

  } catch (error) {
    console.error("Admin approve swap error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process admin approval"
    });
  }
});

// 🔹 PUT /api/shifts/cancel/:swapId - Cancel swap request
router.put("/cancel/:swapId", authenticateToken, async (req, res) => {
  try {
    const { swapId } = req.params;
    const userId = req.user.id;

    const swapRequest = await ShiftSwap.findById(swapId);

    if (!swapRequest) {
      return res.status(404).json({
        success: false,
        message: "Swap request not found"
      });
    }

    // Only requester can cancel, and only if still pending
    if (swapRequest.requesterId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own swap requests"
      });
    }

    if (swapRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Can only cancel pending swap requests"
      });
    }

    swapRequest.status = 'cancelled';
    await swapRequest.save();

    res.status(200).json({
      success: true,
      message: "Swap request cancelled successfully"
    });

  } catch (error) {
    console.error("Cancel swap request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel swap request"
    });
  }
});

// 🔹 GET /api/shifts/available-partners/:scheduleId - Get available swap partners
router.get("/available-partners/:scheduleId", authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user.id;

    const userSchedule = await Schedule.findById(scheduleId);
    if (!userSchedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    if (userSchedule.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only find partners for your own shifts"
      });
    }

    // Find other schedules on the same date with different users
    const potentialSwaps = await Schedule.find({
      date: userSchedule.date,
      userId: { $ne: userId },
      status: 'scheduled' // Only scheduled shifts can be swapped
    })
    .populate('userId', 'username email')
    .populate({
      path: 'userId',
      select: 'username email',
      populate: {
        path: 'userId',
        model: 'UserProfile',
        select: 'name department jobTitle shift skills'
      }
    });

    // Filter out schedules already involved in pending swaps
    const availablePartners = [];
    for (const schedule of potentialSwaps) {
      const existingSwap = await ShiftSwap.findOne({
        $or: [
          { requesterScheduleId: schedule._id, status: 'pending' },
          { targetScheduleId: schedule._id, status: 'pending' }
        ]
      });

      if (!existingSwap) {
        availablePartners.push(schedule);
      }
    }

    res.status(200).json({
      success: true,
      availablePartners,
      total: availablePartners.length,
      userSchedule
    });

  } catch (error) {
    console.error("Get available partners error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available swap partners"
    });
  }
});

// Helper function to execute shift swap
async function executeShiftSwap(swapRequest) {
  try {
    const requesterSchedule = await Schedule.findById(swapRequest.requesterScheduleId);
    const targetSchedule = await Schedule.findById(swapRequest.targetScheduleId);

    if (!requesterSchedule || !targetSchedule) {
      throw new Error("One or both schedules not found");
    }

    // Store original user IDs
    const originalRequesterId = requesterSchedule.userId;
    const originalTargetId = targetSchedule.userId;

    // Swap the user assignments
    requesterSchedule.userId = originalTargetId;
    targetSchedule.userId = originalRequesterId;

    // Mark schedules as swapped
    requesterSchedule.status = 'swapped';
    targetSchedule.status = 'swapped';

    // Add reference to swap request
    requesterSchedule.swapRequestId = swapRequest._id;
    targetSchedule.swapRequestId = swapRequest._id;

    // Save both schedules
    await requesterSchedule.save();
    await targetSchedule.save();

    // Update swap request status
    swapRequest.status = 'accepted';

    return true;
  } catch (error) {
    console.error("Execute shift swap error:", error);
    throw error;
  }
}

// 🔹 GET /api/shifts/admin/all - Get all swap requests (admin only)
router.get("/admin/all", authenticateToken, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = {};
    if (status) query.status = status;

    const swapRequests = await ShiftSwap.find(query)
      .populate('requesterId', 'username email')
      .populate('targetUserId', 'username email')
      .populate('requesterScheduleId')
      .populate('targetScheduleId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ShiftSwap.countDocuments(query);

    res.status(200).json({
      success: true,
      swapRequests,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      totalRequests: total
    });

  } catch (error) {
    console.error("Get all swap requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch swap requests"
    });
  }
});

module.exports = router;