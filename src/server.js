const http = require("http");
const dotenv = require("dotenv");

dotenv.config();

const { createApp } = require("./app");

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

const app = createApp();
const server = http.createServer(app);

server.listen(port, host, () => {
  process.stdout.write(`BBSBackend listening on http://${host}:${port}\n`);
});

