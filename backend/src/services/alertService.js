const Alert = require("../models/Alert");

// Tạo hoặc cập nhật cảnh báo đang hoạt động.
// Nếu điều kiện không còn đúng, chuyển cảnh báo sang RESOLVED.
const syncAlert = async ({
  type,
  message,
  severity = "WARNING",
  value = null,
  isActive,
}) => {
  const activeAlert = await Alert.findOne({
    type,
    status: "ACTIVE",
  });

  if (isActive) {
    if (activeAlert) {
      activeAlert.message = message;
      activeAlert.severity = severity;
      activeAlert.value = value;
      await activeAlert.save();
      return activeAlert;
    }

    return await Alert.create({
      type,
      message,
      severity,
      value,
      status: "ACTIVE",
    });
  }

  if (activeAlert) {
    activeAlert.status = "RESOLVED";
    activeAlert.resolvedAt = new Date();
    activeAlert.value = value;
    await activeAlert.save();
    return activeAlert;
  }

  return null;
};

// Kiểm tra dữ liệu cảm biến và đồng bộ cảnh báo.
const checkSensorAlerts = async ({
  temperature,
  airHumidity,
  soilRaw,
  soilMoisture,
}) => {
  // 1. Phát hiện dữ liệu cảm biến bất thường.
  const sensorError =
    !Number.isFinite(temperature) ||
    temperature < -40 ||
    temperature > 85 ||
    !Number.isFinite(airHumidity) ||
    airHumidity < 0 ||
    airHumidity > 100 ||
    !Number.isFinite(soilRaw) ||
    soilRaw < 0 ||
    soilRaw > 4095 ||
    (soilMoisture !== null &&
      soilMoisture !== undefined &&
      (!Number.isFinite(soilMoisture) ||
        soilMoisture < 0 ||
        soilMoisture > 100));

  await syncAlert({
    type: "SENSOR_ERROR",
    message:
      "Dữ liệu cảm biến không hợp lệ. Cần kiểm tra cảm biến hoặc dữ liệu gửi lên.",
    severity: "CRITICAL",
    isActive: sensorError,
  });

  // 2. Cảnh báo đất khô.
  // Bật cảnh báo khi độ ẩm <= 30%.
  // Chỉ đóng cảnh báo khi độ ẩm > 35% để tránh bật/tắt liên tục.
  const moistureIsValid =
    Number.isFinite(soilMoisture) && soilMoisture >= 0 && soilMoisture <= 100;

  if (moistureIsValid && soilMoisture <= 30) {
    await syncAlert({
      type: "SOIL_TOO_DRY",
      message: `Đất đang khô, độ ẩm hiện tại ${soilMoisture}%.`,
      severity: soilMoisture <= 15 ? "CRITICAL" : "WARNING",
      value: soilMoisture,
      isActive: true,
    });
  } else if (moistureIsValid && soilMoisture > 35) {
    await syncAlert({
      type: "SOIL_TOO_DRY",
      message: "Độ ẩm đất đã trở lại mức an toàn.",
      value: soilMoisture,
      isActive: false,
    });
  }
};

module.exports = {
  syncAlert,
  checkSensorAlerts,
};
