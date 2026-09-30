import React, { useEffect, useState } from "react";
import { App, Button, Card, DatePicker, Space, Statistic, Table, Tag } from "antd";
import dayjs from "dayjs";
import { wb, kg, showDate } from "../api";

// Qt's Daily Weights report: vouchers for a period, total amount, last voucher, reprint.
export default function ReportPage({ active }) {
  const { message } = App.useApp();
  const [range, setRange] = useState([dayjs().startOf("day"), dayjs().endOf("day")]);
  const [data, setData] = useState({ rows: [], total: 0, count: 0, lastVoucher: "" });

  const args = () => ({ from: range[0].format("YYYY-MM-DD HH:mm:ss"), to: range[1].add(1, "second").format("YYYY-MM-DD HH:mm:ss") });
  const load = () => wb("report", args()).then(setData).catch((e) => message.error(e.message));
  useEffect(() => { if (active) load(); }, [active, range]);

  const reprint = (id) => wb("reprint", { id })
    .then((r) => (r.print.error ? message.error(r.print.error) : message.success("Sent to printer")))
    .catch((e) => message.error(e.message));

  return (
    <Card>
      <Space wrap style={{ marginBottom: 12 }} size="large">
        <DatePicker.RangePicker showTime value={range} onChange={(v) => v && setRange(v)} allowClear={false} format="DD/MM/YYYY HH:mm" />
        <Button onClick={() => setRange([dayjs().startOf("day"), dayjs().endOf("day")])}>Today</Button>
        <Button onClick={() => wb("reportCsv", args()).then((r) => r.saved && message.success(`Saved ${r.filePath}`)).catch((e) => message.error(e.message))}>Export CSV</Button>
        <Statistic title="Vouchers" value={data.count} />
        <Statistic title="Total amount" value={data.total} precision={2} prefix="₹" />
        <Statistic title="Last voucher" value={data.lastVoucher || "—"} groupSeparator="" />
      </Space>
      <Table size="small" rowKey="id" dataSource={data.rows} pagination={{ pageSize: 20 }} columns={[
        { title: "Voucher", dataIndex: "voucherNumber", width: 90 },
        { title: "Date", dataIndex: "voucherDate", render: showDate, width: 150 },
        { title: "Vehicle", dataIndex: "vehicleNumber" },
        { title: "Wheel", dataIndex: "wheelType" },
        { title: "Material", dataIndex: "material" },
        { title: "Weight", dataIndex: "weight", align: "right", render: (v) => kg(v) },
        { title: "First wt", dataIndex: "firstWeight", align: "right", render: (v) => (v ? kg(v) : "") },
        { title: "Net", key: "net", align: "right", render: (_, r) => (r.firstWeight ? kg(Math.abs(r.weight - r.firstWeight)) : "") },
        { title: "Amount", dataIndex: "amount", align: "right", render: (v) => Number(v || 0).toFixed(2) },
        { title: "", dataIndex: "synced", width: 90, render: (v) => (v ? <Tag color="green">Uploaded</Tag> : <Tag color="gold">Waiting</Tag>) },
        { title: "", key: "p", width: 80, render: (_, r) => <Button size="small" onClick={() => reprint(r.id)}>Reprint</Button> },
      ]} />
    </Card>
  );
}
