const sensorService = require("../services/sensorService");

// POST /api/sensors
const createSensor = async (req, res) => {
  try {
    const { temperature, airHumidity, soilRaw, soilMoisture, pumpStatus } =
      req.body;

    if (
      temperature === undefined ||
      airHumidity === undefined ||
      soilRaw === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required sensor data",
      });
    }

    const sensor = await sensorService.createSensor({
      temperature,
      airHumidity,
      soilRaw,
      soilMoisture,
      pumpStatus,
    });

    return res.status(201).json({
      success: true,
      message: "Sensor data saved successfully",
      data: sensor,
    });
  } catch (error) {
    console.error("Create sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save sensor data",
    });
  }
};

// GET /api/sensors
const getAllSensors = async (req, res) => {
  try {
    const sensors = await sensorService.getAllSensors();

    return res.status(200).json({
      success: true,
      count: sensors.length,
      data: sensors,
    });
  } catch (error) {
    console.error("Get sensors error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sensor data",
    });
  }
};

// GET /api/sensors/latest
const getLatestSensor = async (req, res) => {
  try {
    const sensor = await sensorService.getLatestSensor();

    if (!sensor) {
      return res.status(404).json({
        success: false,
        message: "No sensor data found",
      });
    }

    return res.status(200).json({
      success: true,
      data: sensor,
    });
  } catch (error) {
    console.error("Get latest sensor error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve latest sensor data",
    });
  }
};

module.exports = {
  createSensor,
  getAllSensors,
  getLatestSensor,
};
