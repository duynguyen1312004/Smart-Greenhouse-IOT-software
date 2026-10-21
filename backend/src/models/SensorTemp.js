const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema(
  {
    temperature: {
      type: Number,
      required: true,
    },
    airHumidity: {
      type: Number,
      required: true,
    },
    soilRaw: {
      type: Number,
      required: true,
    },
    soilMoisture: {
      type: Number,
      min: 0,
      max: 100,
    },
    pumpStatus: {
      type: String,
      enum: ["ON", "OFF"],
      default: "OFF",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Sensor", sensorSchema);
