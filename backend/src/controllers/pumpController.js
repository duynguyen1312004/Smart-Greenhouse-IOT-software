const pumpService = require("../services/pumpService");

// GET /api/pump
const getPumpStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    data: pumpService.getPumpControl(),
  });
};

// POST /api/pump
const setPumpStatus = (req, res) => {
  const { status, mode } = req.body;

  // Nếu gửi mode thì cập nhật chế độ
  if (mode !== undefined) {
    if (!["AUTO", "MANUAL"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'Mode must be "AUTO" or "MANUAL"',
      });
    }

    pumpService.setPumpMode(mode);

    return res.status(200).json({
      success: true,
      message: `Pump mode set to ${mode}`,
      data: pumpService.getPumpControl(),
    });
  }

  // Lệnh ON/OFF chỉ được dùng ở MANUAL
  if (!["ON", "OFF"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be "ON" or "OFF"',
    });
  }

  if (pumpService.getPumpMode() !== "MANUAL") {
    return res.status(409).json({
      success: false,
      message: "Switch to MANUAL mode to control the pump",
      data: pumpService.getPumpControl(),
    });
  }

  pumpService.setPumpStatus(status);

  return res.status(200).json({
    success: true,
    message: `Pump command set to ${status}`,
    data: pumpService.getPumpControl(),
  });
};

module.exports = { getPumpStatus, setPumpStatus };
