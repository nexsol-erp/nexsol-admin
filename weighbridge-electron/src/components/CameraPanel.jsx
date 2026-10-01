import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Card, Tag } from "antd";
import { wb } from "../api";

// Live camera view on the Weighing screen. capture() returns the frame to keep with a weighing
// (webcam, JPEG data URL); an IP camera's picture is taken by the app itself, so it returns null.
// A webcam is found by its saved id, else by its name (ids differ between PCs).
async function openWebcam(cam) {
  const pick = async () => {
    if (cam.deviceId) return cam.deviceId;
    if (!cam.deviceLabel) return "";
    const list = await navigator.mediaDevices.enumerateDevices();
    return list.find((d) => d.kind === "videoinput" && d.label === cam.deviceLabel)?.deviceId || "";
  };
  const id = await pick();
  try {
    return await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : true, audio: false });
  } catch (e) {
    if (!id) throw e;
    // saved id gone (camera moved to another port): try by name, then any camera
    const byName = (await navigator.mediaDevices.enumerateDevices()).find((d) => d.kind === "videoinput" && d.label === cam.deviceLabel);
    return navigator.mediaDevices.getUserMedia({ video: byName ? { deviceId: { exact: byName.deviceId } } : true, audio: false });
  }
}

export function grabFrame(video, maxWidth = 960, quality = 0.75) {
  if (!video || !video.videoWidth) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

const CameraPanel = forwardRef(function CameraPanel({ camera, active, title = "Camera" }, ref) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [snap, setSnap] = useState(null);
  const source = camera?.source || "none";

  useImperativeHandle(ref, () => ({ capture: () => (source === "webcam" ? grabFrame(videoRef.current) : null) }), [source]);

  // webcam: keep the stream open while the screen is showing
  useEffect(() => {
    if (source !== "webcam" || !active) return undefined;
    let stream = null;
    let gone = false;
    setError("");
    openWebcam(camera).then((s) => {
      if (gone) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch((e) => setError(e.message || "Camera not available"));
    return () => { gone = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [source, active, camera?.deviceId, camera?.deviceLabel]);

  // IP camera: a fresh picture every 1.5 s
  useEffect(() => {
    if (source !== "url" || !active) return undefined;
    let stop = false;
    let timer = null;
    const tick = async () => {
      try {
        const r = await wb("cameraSnapshot", { url: camera?.url });
        if (!stop) { setSnap(r.dataUrl); setError(""); }
      } catch (e) {
        if (!stop) setError(e.message);
      }
      if (!stop) timer = setTimeout(tick, 1500);
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
  }, [source, active, camera?.url]);

  if (source === "none") return null;
  return (
    <Card size="small" title={title} style={{ marginBottom: 12 }}
      extra={error ? <Tag color="red">No picture</Tag> : <Tag color="green">Photo taken on save</Tag>}
      styles={{ body: { padding: 6, background: "#111", textAlign: "center" } }}>
      {source === "webcam"
        ? <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", maxHeight: 260, objectFit: "contain", display: error ? "none" : "block" }} />
        : snap && !error && <img src={snap} alt="camera" style={{ width: "100%", maxHeight: 260, objectFit: "contain" }} />}
      {error && <div style={{ color: "#ff8a80", padding: 24 }}>{error}</div>}
    </Card>
  );
});

export default CameraPanel;
