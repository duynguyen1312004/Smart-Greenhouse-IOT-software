const Sensor = require("../models/sensorTemp");
const { checkSensorAlerts } = require("./alertService");

// Lưu dữ liệu cảm biến và kiểm tra cảnh báo
const createSensor = async (sensorData) => {
  const sensor = await Sensor.create(sensorData);

  try {
    await checkSensorAlerts({
      temperature: sensor.temperature,
      airHumidity: sensor.airHumidity,
      soilRaw: sensor.soilRaw,
      soilMoisture: sensor.soilMoisture,
    });
  } catch (error) {
    // Lỗi cảnh báo không làm mất dữ liệu cảm biến đã lưu
    console.error("Check sensor alerts error:", error);
  }

  return sensor;
};

// Lấy toàn bộ dữ liệu cảm biến, mới nhất trước
const getAllSensors = async () => {
  return await Sensor.find().sort({ createdAt: -1 });
};

// Lấy bản ghi cảm biến mới nhất
const getLatestSensor = async () => {
  return await Sensor.findOne().sort({ createdAt: -1 });
};

module.exports = {
  createSensor,
  getAllSensors,
  getLatestSensor,
};
