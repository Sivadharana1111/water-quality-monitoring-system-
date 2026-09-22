#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <WiFi.h>
#include <Wire.h>
#include <WebServer.h>

WebServer server(80);

// ---------------- WIFI CONFIGURATION ----------------
const char *ssid = "Dharana11^2";
const char *password = "12345678910";

// ---------------- PIN DEFINITIONS ----------------

#define TDS_PIN 34
#define TURBIDITY_PIN 35
#define TEMP_PIN 4

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

// ---------------- OLED ----------------

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ---------------- TEMPERATURE ----------------

OneWire oneWire(TEMP_PIN);
DallasTemperature temperatureSensor(&oneWire);

// ---------------- SETTINGS ----------------

float temperature = 25.0;
float currentTdsValue = 0;
float currentTurbidityVoltage = 0;

void handleData() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String json = "{";
  json += "\"tds\":" + String(currentTdsValue) + ",";
  json += "\"turbidity\":" + String(currentTurbidityVoltage) + ",";
  json += "\"temperature\":" + String(temperature) + ",";
  json += "\"battery\": 100,";
  json += "\"solarCharging\": true,";
  json += "\"esp32Status\": \"ONLINE\"";
  json += "}";
  
  server.send(200, "application/json", json);
}

void setup() {

  Serial.begin(115200);

  // ADC
  analogReadResolution(12);

  analogSetPinAttenuation(TDS_PIN, ADC_11db);
  analogSetPinAttenuation(TURBIDITY_PIN, ADC_11db);

  // I2C
  Wire.begin(21, 22);

  // OLED
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {

    Serial.println("OLED not found!");

    while (true)
      ;
  }

  // Connect to WiFi
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 25);
  display.print("Connecting WiFi...");
  display.display();

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    
    server.on("/data", handleData);
    server.enableCORS(true);
    server.begin();
    Serial.println("HTTP server started");
  } else {
    Serial.println("\nWiFi Connection Failed! Proceeding offline.");
  }

  // Temperature sensor
  temperatureSensor.begin();

  display.clearDisplay();
  display.setCursor(20, 25);
  display.println("Water Monitor");

  display.display();

  delay(2000);
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    server.handleClient();
  }

  static unsigned long lastUpdate = 0;
  if (millis() - lastUpdate < 2000) {
    return;
  }
  lastUpdate = millis();

  // ---------------- TEMPERATURE ----------------

  temperatureSensor.requestTemperatures();

  float tempC = temperatureSensor.getTempCByIndex(0);

  if (tempC != DEVICE_DISCONNECTED_C) {
    temperature = tempC;
  }

  // ---------------- TDS ----------------

  long tdsTotal = 0;

  for (int i = 0; i < 30; i++) {

    tdsTotal += analogRead(TDS_PIN);

    delay(2);
  }

  float tdsADC = tdsTotal / 30.0;

  float tdsVoltage = tdsADC * 3.3 / 4095.0;

  // Temperature compensation

  float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);

  float compensatedVoltage = tdsVoltage / compensationCoefficient;

  float tdsValue =
      (133.42 * compensatedVoltage * compensatedVoltage * compensatedVoltage -
       255.86 * compensatedVoltage * compensatedVoltage +
       857.39 * compensatedVoltage) *
      0.5;

  if (tdsValue < 0) {
    tdsValue = 0;
  }

  // ---------------- TURBIDITY ----------------

  long turbidityTotal = 0;

  for (int i = 0; i < 30; i++) {

    turbidityTotal += analogRead(TURBIDITY_PIN);

    delay(2);
  }

  float turbidityADC = turbidityTotal / 30.0;

  float turbidityVoltage = turbidityADC * 3.3 / 4095.0;

  currentTdsValue = tdsValue;
  currentTurbidityVoltage = turbidityVoltage;
  
  // ---------------- WATER STATUS ----------------

  bool highTDS = tdsValue > 500;

  // Temporary threshold for testing only.
  // We should replace this with the calibration
  // appropriate for your exact turbidity sensor.
  bool highTurbidity = turbidityVoltage < 1.0;

  bool waterOK = !highTDS && !highTurbidity;

  // ---------------- SERIAL ----------------

  Serial.println("--------------------");

  Serial.print("Temperature: ");
  Serial.print(temperature);
  Serial.println(" C");

  Serial.print("TDS: ");
  Serial.print(tdsValue);
  Serial.println(" ppm");

  Serial.print("Turbidity ADC: ");
  Serial.println(turbidityADC);

  Serial.print("Turbidity Voltage: ");
  Serial.print(turbidityVoltage, 3);
  Serial.println(" V");

  Serial.print("Status: ");

  if (waterOK) {
    Serial.println("NORMAL");
  } else {
    Serial.println("UNSAFE");
  }

  // ---------------- OLED ----------------

  display.clearDisplay();

  display.setTextSize(1);

  display.setCursor(0, 0);
  display.println("WATER QUALITY");

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setCursor(0, 15);
  display.print("TDS: ");
  display.print(tdsValue, 0);
  display.println(" ppm");

  display.setCursor(0, 28);
  display.print("Turb: ");
  display.print(turbidityVoltage, 2);
  display.println(" V");

  display.setCursor(0, 41);
  display.print("Temp: ");
  display.print(temperature, 1);
  display.println(" C");

  display.setCursor(0, 54);

  if (waterOK) {
    display.print("STATUS: NORMAL");
  } else {
    display.print("STATUS: UNSAFE");
  }

  display.display();
}
