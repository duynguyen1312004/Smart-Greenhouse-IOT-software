
#include <Wire.h>
#include <Adafruit_AHTX0.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>

// ===== API =====
const char* API_URL =
  "http://192.168.196.74:5000/api/sensors";

const char* PUMP_API_URL =
  "http://192.168.196.74:5000/api/pump";

// ===== WIFI =====
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ===== SENSOR =====
Adafruit_AHTX0 aht;

const int SOIL_PIN = 34;
const int RELAY_PIN = 26;

// ===== SOIL CALIBRATION (TEMPORARY) =====
const int SOIL_DRY = 1280;
const int SOIL_WET = 650;
const bool SOIL_CALIBRATED = true;

bool manualSafetyLock = false;

// ===== AUTOMATIC IRRIGATION =====
const int SOIL_START_THRESHOLD = 30;
const int SOIL_STOP_THRESHOLD = 45;

const unsigned long MAX_PUMP_RUNTIME_MS = 10000;
const unsigned long PUMP_COOLDOWN_MS = 60000;

// ===== RELAY =====
const int RELAY_ON = LOW;
const int RELAY_OFF = HIGH;

String currentPumpStatus = "OFF";
String currentMode = "MANUAL";

bool backendOK = false;
bool cooldownActive = false;

unsigned long pumpStartedAt = 0;
unsigned long cooldownUntil = 0;

// ===== SENSOR INITIALIZATION =====
void initSensors() {
  Wire.begin(21, 22);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  if (!aht.begin()) {
    Serial.println("ERROR: AHT20 not detected!");

    while (true) {
      setPumpStatus("OFF");
      delay(1000);
    }
  }

  Serial.println("AHT20 initialized!");
  Serial.println("FC-28 initialized!");
}

// ===== PUMP CONTROL =====
void setPumpStatus(String status) {
  if (status == "ON") {
    // MANUAL: require an OFF command before restarting
    // after the maximum runtime safety limit.
    if (currentMode == "MANUAL" && manualSafetyLock) {
      digitalWrite(RELAY_PIN, RELAY_OFF);
      currentPumpStatus = "OFF";
      Serial.println("MANUAL blocked: press OFF, then ON to restart.");
      return;
    }

    // AUTO cooldown protection.
    if (currentMode == "AUTO" && cooldownActive) {
      if ((long)(millis() - cooldownUntil) < 0) {
        digitalWrite(RELAY_PIN, RELAY_OFF);
        currentPumpStatus = "OFF";
        return;
      }

      cooldownActive = false;
    }

    if (currentPumpStatus != "ON") {
      pumpStartedAt = millis();
      digitalWrite(RELAY_PIN, RELAY_ON);
      currentPumpStatus = "ON";
      Serial.println("PUMP ON");
    }
  } else {
    if (currentPumpStatus == "ON") {
      Serial.println("PUMP OFF");
    }

    digitalWrite(RELAY_PIN, RELAY_OFF);
    currentPumpStatus = "OFF";

    // User explicitly turned the pump OFF in MANUAL.
    if (currentMode == "MANUAL") {
      manualSafetyLock = false;
    }
  }
}
void initPump() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_OFF);
  currentPumpStatus = "OFF";

  Serial.println("Pump relay initialized. Pump OFF.");
}

// ===== WIFI =====
void connectWiFi() {
  Serial.println("\nConnecting to WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    setPumpStatus("OFF");
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    setPumpStatus("OFF");
    Serial.println("\nWiFi connection failed!");
  }
}

// ===== GET MODE AND PUMP COMMAND =====
// ===== GET MODE AND PUMP COMMAND =====
void getPumpCommand() {
  backendOK = false;

  if (WiFi.status() != WL_CONNECTED) {
    currentMode = "MANUAL";
    setPumpStatus("OFF");
    Serial.println("Backend unavailable: WiFi disconnected.");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  http.setTimeout(2000);

  if (!http.begin(client, PUMP_API_URL)) {
    currentMode = "MANUAL";
    setPumpStatus("OFF");
    Serial.println("Cannot initialize pump API.");
    return;
  }

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();

    // Read a JSON string field, tolerating spaces.
    auto readJsonString = [](String json, String key) -> String {
      String searchKey = "\"" + key + "\"";

      int keyPos = json.indexOf(searchKey);
      if (keyPos < 0) return "";

      int colonPos = json.indexOf(':', keyPos + searchKey.length());
      if (colonPos < 0) return "";

      int firstQuote = json.indexOf('"', colonPos + 1);
      if (firstQuote < 0) return "";

      int secondQuote = json.indexOf('"', firstQuote + 1);
      if (secondQuote < 0) return "";

      return json.substring(firstQuote + 1, secondQuote);
    };

    String mode = readJsonString(response, "mode");
    String pumpStatus = readJsonString(response, "pumpStatus");

    mode.trim();
    pumpStatus.trim();

    if ((mode == "AUTO" || mode == "MANUAL") &&
        (pumpStatus == "ON" || pumpStatus == "OFF")) {

      backendOK = true;
      currentMode = mode;

      Serial.print("Backend mode: ");
      Serial.println(currentMode);

      Serial.print("Backend pump command: ");
      Serial.println(pumpStatus);

      if (currentMode == "MANUAL") {
        setPumpStatus(pumpStatus);
      }

      // AUTO mode is handled by controlAutomaticPump().
    } else {
      currentMode = "MANUAL";
      setPumpStatus("OFF");
      Serial.println("Invalid API response. Pump OFF.");
      Serial.println(response);
    }
  } else {
    currentMode = "MANUAL";
    setPumpStatus("OFF");

    Serial.print("Pump API HTTP error: ");
    Serial.println(httpCode);
  }

  http.end();
}

// ===== SOIL SENSOR =====
int readSoilRaw() {
  long total = 0;

  for (int i = 0; i < 10; i++) {
    total += analogRead(SOIL_PIN);
    delay(10);
  }

  return total / 10;
}

int calculateSoilMoisture(int soilRaw) {
  if (!SOIL_CALIBRATED || SOIL_DRY == SOIL_WET) {
    return -1;
  }

  int moisture = map(soilRaw, SOIL_DRY, SOIL_WET, 0, 100);

  return constrain(moisture, 0, 100);
}

// ===== AHT20 =====
bool readAirSensor(float &temperature, float &humidity) {
  sensors_event_t humidityEvent, tempEvent;

  if (!aht.getEvent(&humidityEvent, &tempEvent)) {
    return false;
  }

  temperature = tempEvent.temperature;
  humidity = humidityEvent.relative_humidity;

  return true;
}

// ===== AUTOMATIC IRRIGATION =====
void controlAutomaticPump(int soilMoisture) {
  if (!backendOK) {
    setPumpStatus("OFF");
    return;
  }

  if (!SOIL_CALIBRATED || soilMoisture < 0) {
    setPumpStatus("OFF");
    Serial.println("AUTO disabled: soil sensor not calibrated.");
    return;
  }

  // Enforce maximum runtime in AUTO mode.
  if (currentPumpStatus == "ON" &&
      millis() - pumpStartedAt >= MAX_PUMP_RUNTIME_MS) {
    setPumpStatus("OFF");

    cooldownActive = true;
    cooldownUntil = millis() + PUMP_COOLDOWN_MS;

    Serial.println("Safety timeout: 10 seconds reached.");
    Serial.println("Pump cooldown: 60 seconds.");
    return;
  }

  if (cooldownActive) {
    if ((long)(millis() - cooldownUntil) < 0) {
      setPumpStatus("OFF");
      Serial.println("Pump is in cooldown.");
      return;
    }

    cooldownActive = false;
  }

  if (soilMoisture <= SOIL_START_THRESHOLD &&
      currentPumpStatus == "OFF") {
    setPumpStatus("ON");
    Serial.println("AUTO: Soil is dry. Watering started.");
  } else if (soilMoisture >= SOIL_STOP_THRESHOLD &&
             currentPumpStatus == "ON") {
    setPumpStatus("OFF");
    Serial.println("AUTO: Soil is moist enough. Watering stopped.");
  }
}

// ===== MAXIMUM RUNTIME SAFETY =====
void enforceMaximumRuntime() {
  if (currentPumpStatus != "ON" ||
      millis() - pumpStartedAt < MAX_PUMP_RUNTIME_MS) {
    return;
  }

  setPumpStatus("OFF");

  if (currentMode == "AUTO") {
    cooldownActive = true;
    cooldownUntil = millis() + PUMP_COOLDOWN_MS;

    Serial.println("AUTO safety timeout: 10 seconds reached.");
    Serial.println("Pump cooldown: 60 seconds.");
  } else {
    manualSafetyLock = true;

    Serial.println("MANUAL safety timeout: pump stopped.");
    Serial.println("Press OFF, then ON to restart.");
  }
}

// ===== DISPLAY =====
void displayData(
  int soilRaw,
  int soilMoisture,
  float temperature,
  float humidity,
  bool airSensorOK
) {
  Serial.println("\n===== SMART GREENHOUSE =====");

  Serial.print("Mode: ");
  Serial.println(currentMode);

  Serial.print("Soil raw ADC: ");
  Serial.println(soilRaw);

  Serial.print("Soil moisture: ");

  if (soilMoisture >= 0) {
    Serial.print(soilMoisture);
    Serial.println("%");
  } else {
    Serial.println("NOT CALIBRATED");
  }

  if (airSensorOK) {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Air humidity: ");
    Serial.print(humidity);
    Serial.println("%");
  } else {
    Serial.println("ERROR: AHT20 reading failed.");
  }

  Serial.print("WiFi: ");
  Serial.println(
    WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected"
  );

  Serial.print("Backend: ");
  Serial.println(backendOK ? "OK" : "UNAVAILABLE");

  Serial.print("Pump: ");
  Serial.println(currentPumpStatus);

  Serial.println("============================");
}

// ===== SEND SENSOR DATA =====
void sendSensorData(
  int soilRaw,
  int soilMoisture,
  float temperature,
  float humidity,
  bool airSensorOK
) {
  if (!backendOK || WiFi.status() != WL_CONNECTED) {
    Serial.println("Skipping sensor upload: backend unavailable.");
    return;
  }

  if (!airSensorOK) {
    Serial.println("Skipping sensor upload: AHT20 reading failed.");
    return;
  }

  WiFiClient client;
  HTTPClient http;

  http.setTimeout(2000);

  if (!http.begin(client, API_URL)) {
    Serial.println("Sensor API initialization failed.");
    return;
  }

  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"temperature\":" + String(temperature, 2) + ",";
  json += "\"airHumidity\":" + String(humidity, 2) + ",";
  json += "\"soilRaw\":" + String(soilRaw) + ",";
  json += "\"soilMoisture\":";

  json += soilMoisture >= 0 ? String(soilMoisture) : "null";

  json += ",\"pumpStatus\":\"" + currentPumpStatus + "\"";
  json += "}";

  int httpCode = http.POST(json);

  Serial.print("Sensor API HTTP status: ");
  Serial.println(httpCode);

  http.end();
}

// ===== SETUP =====
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\nSmart Greenhouse IoT");

  initPump();
  initSensors();
  connectWiFi();

  Serial.println("System ready!");
}

// ===== LOOP =====
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    setPumpStatus("OFF");
    connectWiFi();
  }

  // 1. Read the latest backend mode and command.
  getPumpCommand();

  // 2. Read sensors.
  int soilRaw = readSoilRaw();
  int soilMoisture = calculateSoilMoisture(soilRaw);

  float temperature = 0;
  float humidity = 0;

  bool airSensorOK = readAirSensor(temperature, humidity);

  // 3. Apply automatic watering logic.
  if (currentMode == "AUTO") {
    controlAutomaticPump(soilMoisture);
  }

  // 4. Enforce the runtime limit in both modes.
  enforceMaximumRuntime();

  // 5. Display and upload the real relay state.
  displayData(
    soilRaw,
    soilMoisture,
    temperature,
    humidity,
    airSensorOK
  );

  sendSensorData(
    soilRaw,
    soilMoisture,
    temperature,
    humidity,
    airSensorOK
  );

  delay(2000);
}
