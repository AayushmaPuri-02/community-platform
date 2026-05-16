const express = require("express");
const router = express.Router();
const { isSystemAdmin } = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

router.get("/", isSystemAdmin, adminController.getDashboard);
router.get("/requests", isSystemAdmin, adminController.getRequests);
router.get("/requests/:id", isSystemAdmin, adminController.getRequestDetail);
router.post("/requests/:id/approve", isSystemAdmin, adminController.approveRequest);
router.post("/requests/:id/reject", isSystemAdmin, adminController.rejectRequest);
router.get("/directory", isSystemAdmin, adminController.getDirectory);
router.get("/directory/:id", isSystemAdmin, adminController.getDirectoryDetail);
router.get("/reports", isSystemAdmin, adminController.getReports);
router.get("/reports/post/:postId", isSystemAdmin, adminController.getReportReview);
router.get("/reports/user/:userId", isSystemAdmin, adminController.getUserReview);
router.post("/reports/:id/warn", isSystemAdmin, adminController.sendWarning);
router.post("/reports/:id/delete", isSystemAdmin, adminController.deleteReport);

module.exports = router;
