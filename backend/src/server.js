const express = require("express");
const cors = require("cors");
require("dotenv").config();

const sensorRoutes = require("./routes/sensorRoutes");
const pumpRoutes = require("./routes/pumpRoutes");
const alertRoutes = require("./routes/alertRoutes");

const connectDB = require("./config/database");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/sensors", sensorRoutes);
app.use("/api/pump", pumpRoutes);
app.use("/api/alerts", alertRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Smart Greenhouse API is running!",
  });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Smart Greenhouse API running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
  }
};

startServer();
