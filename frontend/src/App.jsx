import { useEffect, useState } from "react";
import axios from "axios";

import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Spin,
  Space,
  Tag,
  Typography,
  Segmented,
} from "antd";

import {
  DashboardOutlined,
  ExperimentOutlined,
  FireOutlined,
  ThunderboltOutlined,
  SyncOutlined,
  LineChartOutlined,
  PoweroffOutlined,
  RobotOutlined,
} from "@ant-design/icons";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

import "./App.css";

const API_URL = "http://localhost:5000/api/sensors";
const PUMP_API_URL = "http://localhost:5000/api/pump";

function App() {
  const [sensor, setSensor] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [pumpStatus, setPumpStatus] = useState("OFF");
  const [pumpMode, setPumpMode] = useState("MANUAL");
  const [pumpLoading, setPumpLoading] = useState(false);
  const [pumpError, setPumpError] = useState("");
  const [pumpMessage, setPumpMessage] = useState("");

  // ===== FETCH SENSOR DATA =====
  useEffect(() => {
    let active = true;

    const fetchSensorData = async () => {
      try {
        const [latestResponse, historyResponse] = await Promise.all([
          axios.get(`${API_URL}/latest`),
          axios.get(API_URL),
        ]);

        if (!active) return;

        setSensor(latestResponse.data.data);

        const records = historyResponse.data.data || [];

        const chartData = [...records].reverse().map((item) => ({
          ...item,
          time: item.createdAt
            ? new Date(item.createdAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "",
        }));

        setHistory(chartData);
        setError("");
      } catch (err) {
        console.error("Fetch sensor data error:", err);

        if (active) {
          setError("Không thể lấy dữ liệu. Hãy kiểm tra backend và MongoDB.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSensorData();
    const intervalId = setInterval(fetchSensorData, 5000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // ===== FETCH PUMP MODE AND STATUS =====
  useEffect(() => {
    let active = true;

    const fetchPumpControl = async () => {
      try {
        const response = await axios.get(PUMP_API_URL, {
          timeout: 3000,
        });

        if (active && response.data.success) {
          setPumpStatus(response.data.data.pumpStatus);
          setPumpMode(response.data.data.mode);
          setPumpError("");
        }
      } catch (err) {
        console.error("Fetch pump status error:", err);

        if (active) {
          setPumpError("Không thể đọc trạng thái máy bơm từ backend.");
        }
      }
    };

    fetchPumpControl();
    const intervalId = setInterval(fetchPumpControl, 2000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // ===== CHANGE AUTO / MANUAL MODE =====
  const handleModeChange = async (mode) => {
    if (mode === pumpMode) return;

    setPumpLoading(true);
    setPumpError("");
    setPumpMessage("");

    try {
      const response = await axios.post(
        PUMP_API_URL,
        { mode },
        { timeout: 5000 },
      );

      if (response.data.success) {
        setPumpMode(response.data.data.mode);
        setPumpStatus(response.data.data.pumpStatus);

        setPumpMessage(
          mode === "AUTO"
            ? "Đã bật chế độ tự động tưới."
            : "Đã chuyển sang chế độ điều khiển thủ công.",
        );
      }
    } catch (err) {
      console.error("Change pump mode error:", err);

      setPumpError(
        err.response?.data?.message ||
          "Không thể đổi chế độ. Hãy kiểm tra backend.",
      );
    } finally {
      setPumpLoading(false);
    }
  };

  // ===== MANUAL PUMP CONTROL =====
  const handlePumpControl = async (status) => {
    if (pumpMode !== "MANUAL") {
      setPumpError("Hãy chuyển sang MANUAL để điều khiển máy bơm.");
      return;
    }

    setPumpLoading(true);
    setPumpError("");
    setPumpMessage("");

    try {
      const response = await axios.post(
        PUMP_API_URL,
        { status },
        { timeout: 5000 },
      );

      if (response.data.success) {
        setPumpStatus(response.data.data.pumpStatus);

        setPumpMessage(
          `Đã gửi lệnh ${status === "ON" ? "BẬT" : "TẮT"} máy bơm.`,
        );
      }
    } catch (err) {
      console.error("Pump control error:", err);

      setPumpError(
        err.response?.data?.message ||
          "Gửi lệnh thất bại. Hãy kiểm tra kết nối backend.",
      );
    } finally {
      setPumpLoading(false);
    }
  };

  const formatTime = (value) => {
    if (!value) return "Chưa có dữ liệu";
    return new Date(value).toLocaleString("vi-VN");
  };

  const metrics = [
    {
      title: "Nhiệt độ không khí",
      value: sensor?.temperature,
      unit: "°C",
      icon: <FireOutlined />,
      color: "#f97316",
    },
    {
      title: "Độ ẩm không khí",
      value: sensor?.airHumidity,
      unit: "%",
      icon: <ExperimentOutlined />,
      color: "#0ea5e9",
    },
    {
      title: "Độ ẩm đất",
      value: sensor?.soilMoisture,
      unit: "%",
      icon: <DashboardOutlined />,
      color: "#16a34a",
    },
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <Typography.Title level={2}>Smart Greenhouse</Typography.Title>

          <Typography.Text type="secondary">
            Hệ thống giám sát nhà kính thông minh
          </Typography.Text>
        </div>

        <Tag color="green" icon={<SyncOutlined spin />}>
          Cập nhật mỗi 5 giây
        </Tag>
      </header>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {loading && !sensor ? (
        <div className="loading">
          <Spin size="large" />
          <p>Đang tải dữ liệu cảm biến...</p>
        </div>
      ) : (
        <>
          <Typography.Title level={4}>
            <DashboardOutlined /> Tổng quan cảm biến
          </Typography.Title>

          <Row gutter={[20, 20]}>
            {metrics.map((item) => (
              <Col xs={24} sm={12} lg={8} key={item.title}>
                <Card className="metric-card">
                  <div className="metric-top">
                    <span>{item.title}</span>
                    <span className="metric-icon" style={{ color: item.color }}>
                      {item.icon}
                    </span>
                  </div>

                  <div className="metric-value">
                    {item.value ?? "--"}
                    <span>{item.unit}</span>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Typography.Title level={4} style={{ marginTop: 32 }}>
            <LineChartOutlined /> Lịch sử cảm biến
          </Typography.Title>

          <Row gutter={[20, 20]}>
            <Col xs={24} lg={12}>
              <Card title="Nhiệt độ theo thời gian" className="chart-card">
                {history.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={history}
                        margin={{
                          top: 10,
                          right: 20,
                          left: 0,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" minTickGap={25} />
                        <YAxis domain={["auto", "auto"]} unit="°C" />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="temperature"
                          name="Nhiệt độ"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Typography.Text type="secondary">
                    Chưa có dữ liệu lịch sử.
                  </Typography.Text>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card
                title="Độ ẩm không khí theo thời gian"
                className="chart-card"
              >
                {history.length > 0 ? (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={history}
                        margin={{
                          top: 10,
                          right: 20,
                          left: 0,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" minTickGap={25} />
                        <YAxis domain={[0, 100]} unit="%" />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="airHumidity"
                          name="Độ ẩm không khí"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Typography.Text type="secondary">
                    Chưa có dữ liệu lịch sử.
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>

          <Typography.Title level={4} style={{ marginTop: 32 }}>
            <ThunderboltOutlined /> Điều khiển thiết bị
          </Typography.Title>

          <Card className="pump-card">
            <div className="pump-row">
              <div>
                <Typography.Title level={5}>
                  <ExperimentOutlined /> Máy bơm nước
                </Typography.Title>

                <Typography.Text type="secondary">
                  Điều khiển qua backend và ESP32
                </Typography.Text>
              </div>

              <Tag color={pumpStatus === "ON" ? "green" : "default"}>
                {pumpStatus === "ON" ? "ON — ĐANG BẬT" : "OFF — ĐANG TẮT"}
              </Tag>
            </div>

            <div style={{ marginTop: 24 }}>
              <Typography.Text strong>
                <RobotOutlined /> Chế độ hoạt động
              </Typography.Text>

              <div style={{ marginTop: 12 }}>
                <Segmented
                  block
                  size="large"
                  value={pumpMode}
                  disabled={pumpLoading}
                  onChange={handleModeChange}
                  options={[
                    {
                      label: "MANUAL — Thủ công",
                      value: "MANUAL",
                    },
                    {
                      label: "AUTO — Tự động",
                      value: "AUTO",
                    },
                  ]}
                />
              </div>
            </div>

            {pumpMode === "AUTO" ? (
              <Alert
                style={{ marginTop: 20 }}
                type="info"
                showIcon
                message="Đang ở chế độ tự động"
                description="ESP32 bật bơm khi độ ẩm đất ≤ 30% và tắt khi độ ẩm đất ≥ 45%. Bơm có giới hạn thời gian chạy và thời gian nghỉ an toàn."
              />
            ) : (
              <Space size="middle" wrap style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  size="large"
                  icon={<PoweroffOutlined />}
                  loading={pumpLoading}
                  disabled={pumpLoading || pumpStatus === "ON"}
                  onClick={() => handlePumpControl("ON")}
                  style={{
                    background: "#16a34a",
                    borderColor: "#16a34a",
                  }}
                >
                  BẬT MÁY BƠM
                </Button>

                <Button
                  danger
                  size="large"
                  icon={<PoweroffOutlined />}
                  loading={pumpLoading}
                  disabled={pumpLoading || pumpStatus === "OFF"}
                  onClick={() => handlePumpControl("OFF")}
                >
                  TẮT MÁY BƠM
                </Button>
              </Space>
            )}

            {pumpMessage && (
              <Alert
                message={pumpMessage}
                type="success"
                showIcon
                style={{ marginTop: 20 }}
              />
            )}

            {pumpError && (
              <Alert
                message={pumpError}
                type="error"
                showIcon
                style={{ marginTop: 20 }}
              />
            )}

            <div style={{ marginTop: 20 }}>
              <Typography.Text type="secondary">
                Trạng thái relay gần nhất ESP32 gửi lên:{" "}
              </Typography.Text>

              <Tag color={sensor?.pumpStatus === "ON" ? "green" : "default"}>
                {sensor?.pumpStatus ?? "CHƯA CÓ DỮ LIỆU"}
              </Tag>
            </div>
          </Card>

          <div className="last-update">
            Dữ liệu cảm biến được ghi nhận lúc: {formatTime(sensor?.createdAt)}
          </div>

          <Typography.Paragraph type="secondary">
            Lưu ý: Độ ẩm đất chỉ mang tính tham khảo cho đến khi hiệu chuẩn
            FC-28 trong đất thực tế.
          </Typography.Paragraph>
        </>
      )}
    </div>
  );
}

export default App;
