import React, { useState } from "react";
import { Button, Card, Input, Typography, message, Select, Space } from "antd";
import { decodeJwtPayload } from "./auth";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;

export default function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [lang, setLang] = useState(localStorage.getItem("language") || "en");
  const [loading, setLoading] = useState(false);

  const doLogin = async () => {
    if (!username || !password) {
      message.warning("Enter username and password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data?.success) {
        message.error(data?.message || "Login failed");
        return;
      }

      localStorage.setItem("jwtToken", data.token);
      localStorage.setItem("tenancyId", data.tenancyId);
      localStorage.setItem("roles", JSON.stringify(data.roles || []));

      const payload = decodeJwtPayload(data.token);
      const allowedBranches = payload && Array.isArray(payload.branches) ? payload.branches : [];
      localStorage.setItem("allowedBranches", JSON.stringify(allowedBranches));

      message.success("Login success");
      onLoggedIn?.();
    } catch (e) {
      message.error("Login error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #1e3a5f 0%, #0f2640 100%)",
      padding: 16,
    }}>
      <Card
        style={{
          width: 400,
          borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
        }}
        styles={{ body: { padding: 32 } }}
      >
        {/* Logo / app name */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, color: "#1677ff" }}>MapleERP</Title>
          <Text style={{ color: "#6b7280", fontSize: 13 }}>Point of Sale</Text>
        </div>

        <div style={{ marginBottom: 14 }}>
          <Text strong style={{ display: "block", marginBottom: 4, color: "#374151" }}>Username</Text>
          <Input
            size="large"
            autoFocus
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: "block", marginBottom: 4, color: "#374151" }}>Password</Text>
          <Input.Password
            size="large"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
          />
        </div>

        <Button
          type="primary"
          block
          size="large"
          loading={loading}
          onClick={doLogin}
          style={{ marginBottom: 20, height: 44, fontWeight: 600 }}
        >
          Login
        </Button>

        <div>
          <Text style={{ display: "block", marginBottom: 6, color: "#6b7280", fontSize: 12 }}>Language</Text>
          <Select
            value={lang}
            style={{ width: "100%" }}
            onChange={(v) => {
              setLang(v);
              localStorage.setItem("language", v);
            }}
            options={[
              { value: "en", label: "English" },
              { value: "ml", label: "മലയാളം" },
              { value: "hi", label: "हिन्दी" },
              { value: "ta", label: "தமிழ்" },
              { value: "kn", label: "ಕನ್ನಡ" },
              { value: "te", label: "తెలుగు" },
              { value: "ar", label: "العربية" },
              { value: "fr", label: "Français" },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}
