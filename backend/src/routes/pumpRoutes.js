const express = require("express");
const router = express.Router();

const {
  getPumpStatus,
  setPumpStatus,
} = require("../controllers/pumpController");

router.get("/", getPumpStatus);
router.post("/", setPumpStatus);

module.exports = router;
