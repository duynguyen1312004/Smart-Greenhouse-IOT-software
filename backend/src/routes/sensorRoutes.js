const express = require("express");
const router = express.Router();

const {
  createSensor,
  getLatestSensor,
  getAllSensors,
} = require("../controllers/sensorController");

router.post("/", createSensor);
router.get("/", getAllSensors);
router.get("/latest", getLatestSensor);

module.exports = router;
