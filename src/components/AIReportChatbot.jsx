import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box, Paper, Typography, TextField, IconButton, Button,
  CircularProgress, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination,
  TableSortLabel, Tooltip, Divider, Alert, Fade,
} from "@mui/material";
import {
  Send as SendIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Download as DownloadIcon,
  SmartToy as BotIcon,
  Person as UserIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import axios from "axios";

// ── API client (matches existing apiservice.js pattern) ─────────────────────
const api = axios.create();
api.interceptors.request.use((config) => {
  const token     = localStorage.getItem("jwtToken");
  const tenancyId = localStorage.getItem("tenancyId");
  config.baseURL  = `/api/${tenancyId}`;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Quick-prompt suggestions shown at start ──────────────────────────────────
const QUICK_PROMPTS = [
  "Show today's sales branch-wise",
  "Item-wise sales this month",
  "Purchase summary this month",
  "Stock report",
  "Stock value by branch",
  "Slow moving items",
];

// ──────────────────────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────────────────────
export default function AIReportChatbot() {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [sessionId,   setSessionId]   = useState(null);
  const [listening,   setListening]   = useState(false);
  const [startDate,   setStartDate]   = useState("");
  const [endDate,     setEndDate]     = useState("");

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const recognition = useRef(null);

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || loading) return;

    const userMsg = text.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const { data } = await api.post("/ai-report/chat", {
        sessionId,
        message: userMsg,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
      });

      setSessionId(data.sessionId);
      setMessages(prev => [...prev, { role: "assistant", data }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        data: {
          responseType: "ERROR",
          message: "Connection error. Please check the server and try again.",
        },
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, sessionId, startDate, endDate]);

  // ── Voice input ─────────────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("");
      setInput(transcript);
    };

    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognition.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportExcel = useCallback(async (message) => {
    try {
      const res = await api.post("/ai-report/export", {
        sessionId,
        message,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
      }, { responseType: "blob" });

      const url  = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href  = url;
      link.download = `report_${Date.now()}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    }
  }, [sessionId, startDate, endDate]);

  // ── Clear chat ──────────────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)", gap: 1 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <Paper elevation={2} sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
        <BotIcon sx={{ color: "#ffe3a3", fontSize: 28 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            AI Report Assistant
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ask for any report in plain English
          </Typography>
        </Box>
        <Tooltip title="Clear chat">
          <IconButton size="small" onClick={clearChat}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* ── Date override bar ───────────────────────────────────────────────── */}
      <Paper elevation={1} sx={{ px: 2, py: 1, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
          Optional date range override:
        </Typography>
        <TextField
          label="From"
          type="date"
          size="small"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 150 }}
        />
        {(startDate || endDate) && (
          <Button size="small" onClick={() => { setStartDate(""); setEndDate(""); }}>
            Clear
          </Button>
        )}
      </Paper>

      {/* ── Message list ────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1.5, px: 1, py: 1 }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <Box sx={{ textAlign: "center", mt: 4 }}>
            <BotIcon sx={{ fontSize: 56, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Ask me anything about your ERP data.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, mt: 2 }}>
              {QUICK_PROMPTS.map(p => (
                <Chip
                  key={p}
                  label={p}
                  variant="outlined"
                  size="small"
                  clickable
                  onClick={() => sendMessage(p)}
                  sx={{ cursor: "pointer" }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <Fade in key={idx}>
            <Box>
              {msg.role === "user"
                ? <UserBubble text={msg.content} />
                : <AssistantBubble
                    data={msg.data}
                    onExport={() => exportExcel(
                      // find the preceding user message
                      messages.slice(0, idx).reverse().find(m => m.role === "user")?.content || ""
                    )}
                  />
              }
            </Box>
          </Fade>
        ))}

        {/* Typing indicator */}
        {loading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 1 }}>
            <BotIcon sx={{ color: "#ffe3a3", fontSize: 20 }} />
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Searching reports & asking AI…
            </Typography>
          </Box>
        )}

        <div ref={bottomRef} />
      </Box>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <Paper elevation={3} sx={{ p: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Tooltip title={listening ? "Stop recording" : "Voice input"}>
          <IconButton
            onClick={toggleVoice}
            color={listening ? "error" : "default"}
            sx={{ flexShrink: 0 }}
          >
            {listening ? <MicOffIcon /> : <MicIcon />}
          </IconButton>
        </Tooltip>

        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={`Ask for a report… e.g. "Show today's sales branch-wise"`}
          disabled={loading}
          multiline
          maxRows={3}
          sx={{ "& fieldset": { borderRadius: 2 } }}
        />

        <Tooltip title="Send">
          <span>
            <IconButton
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              color="primary"
              sx={{ flexShrink: 0 }}
            >
              {loading ? <CircularProgress size={22} /> : <SendIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Paper>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function UserBubble({ text }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
      <Box sx={{
        maxWidth: "75%",
        bgcolor: "primary.main",
        color: "primary.contrastText",
        borderRadius: "16px 16px 4px 16px",
        px: 2, py: 1,
        display: "flex", alignItems: "center", gap: 1,
      }}>
        <UserIcon sx={{ fontSize: 16, opacity: 0.7 }} />
        <Typography variant="body2">{text}</Typography>
      </Box>
    </Box>
  );
}

function AssistantBubble({ data, onExport }) {
  if (!data) return null;

  // ── Error ──────────────────────────────────────────────────────────────────
  if (data.responseType === "ERROR") {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <BotIcon sx={{ color: "#ffe3a3", fontSize: 20, mt: 0.5, flexShrink: 0 }} />
        <Alert severity="error" sx={{ flex: 1 }}>{data.message}</Alert>
      </Box>
    );
  }

  // ── Clarification ──────────────────────────────────────────────────────────
  if (data.responseType === "CLARIFICATION") {
    return (
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <BotIcon sx={{ color: "#ffe3a3", fontSize: 20, mt: 0.5, flexShrink: 0 }} />
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="body2" gutterBottom>{data.message}</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
            {data.clarificationOptions?.map(opt => (
              <Chip key={opt} label={opt} size="small" variant="outlined" />
            ))}
          </Box>
        </Paper>
      </Box>
    );
  }

  // ── Report result ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
      <BotIcon sx={{ color: "#ffe3a3", fontSize: 20, mt: 0.5, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Report header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
          <Chip
            label={data.reportName || "Report"}
            size="small"
            color={data.responseType === "GENERATED_REPORT" ? "warning" : "success"}
            sx={{ fontWeight: 600 }}
          />
          {data.responseType === "GENERATED_REPORT" && (
            <Chip label="AI Generated" size="small" variant="outlined"
              sx={{ borderColor: "warning.main", color: "warning.main", fontSize: 10 }} />
          )}
          <Typography variant="caption" color="text.secondary">
            {data.totalRows} rows · {data.executionTimeMs}ms
          </Typography>
          {data.canExportExcel && (
            <Tooltip title="Download Excel">
              <IconButton size="small" onClick={onExport} color="primary">
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {data.message}
        </Typography>

        {/* Data grid */}
        {data.columns && data.data && data.data.length > 0 && (
          <ReportGrid columns={data.columns} rows={data.data} />
        )}
      </Box>
    </Box>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Data grid with sorting + pagination
// ──────────────────────────────────────────────────────────────────────────────
function ReportGrid({ columns, rows }) {
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [orderBy,     setOrderBy]     = useState(null);
  const [order,       setOrder]       = useState("asc");

  const handleSort = (col) => {
    const isAsc = orderBy === col && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(col);
    setPage(0);
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (!orderBy) return 0;
    const av = a[orderBy], bv = b[orderBy];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return order === "asc" ? cmp : -cmp;
  });

  const visible = sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: 380 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(col => (
                <TableCell
                  key={col.name}
                  align={col.type === "NUMBER" ? "right" : "left"}
                  sx={{ fontWeight: 700, bgcolor: "background.paper", whiteSpace: "nowrap" }}
                >
                  <TableSortLabel
                    active={orderBy === col.name}
                    direction={orderBy === col.name ? order : "asc"}
                    onClick={() => handleSort(col.name)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row, ri) => (
              <TableRow key={ri} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                {columns.map(col => (
                  <TableCell
                    key={col.name}
                    align={col.type === "NUMBER" ? "right" : "left"}
                    sx={{ py: 0.5 }}
                  >
                    {col.type === "NUMBER"
                      ? formatNumber(row[col.name])
                      : row[col.name] != null ? String(row[col.name]) : "—"
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Divider />
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50]}
        sx={{ "& .MuiTablePagination-toolbar": { minHeight: 36 } }}
      />
    </Paper>
  );
}

function formatNumber(val) {
  if (val == null) return "—";
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
