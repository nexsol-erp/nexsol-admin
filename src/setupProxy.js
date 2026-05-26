// src/setupProxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://localhost:8084",
      changeOrigin: true,
    })
  );
  app.use(
    "/ai-service",
    createProxyMiddleware({
      target: "http://localhost:8001",
      changeOrigin: true,
      pathRewrite: { "^/ai-service": "" },
    })
  );
};
