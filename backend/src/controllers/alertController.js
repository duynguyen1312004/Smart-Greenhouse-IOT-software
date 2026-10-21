const Alert = require("../models/Alert");

// GET /api/alerts
const getAlerts = async (req, res) => {
  try {
    const filter = {};

    // Cho phép lọc theo trạng thái ACTIVE hoặc RESOLVED
    if (req.query.status) {
      const status = req.query.status.toUpperCase();

      if (!["ACTIVE", "RESOLVED"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be ACTIVE or RESOLVED",
        });
      }

      filter.status = status;
    }

    const alerts = await Alert.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    console.error("Get alerts error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve alerts",
    });
  }
};

module.exports = {
  getAlerts,
};
