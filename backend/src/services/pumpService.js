let mode = "MANUAL";
let desiredPumpStatus = "OFF";

const getPumpStatus = () => desiredPumpStatus;

const setPumpStatus = (status) => {
  desiredPumpStatus = status;
};

const getPumpMode = () => mode;

const setPumpMode = (newMode) => {
  mode = newMode;

  // Chuyển chế độ thì mặc định tắt bơm.
  // AUTO sẽ do ESP32 quyết định trạng thái sau đó.
  desiredPumpStatus = "OFF";
};

const getPumpControl = () => ({
  mode,
  pumpStatus: desiredPumpStatus,
});

module.exports = {
  getPumpStatus,
  setPumpStatus,
  getPumpMode,
  setPumpMode,
  getPumpControl,
};
