// llm_vulnerable.js
// Vulnerabilities: child_process exec with user input (command injection), XSS via innerHTML, insecure file access

const { exec } = require("child_process");
const fs = require("fs");

function deleteFile(req, res) {
  const filename = req.query.file || "default.txt";
  // Command injection risk: unvalidated user input interpolated into shell command
  exec(`rm -rf ${filename}`, (err, stdout, stderr) => {
    if (err) return res.status(500).send("failed to delete");
    res.send("deleted");
  });
}

function serveHtml(res, userContent) {
  // XSS risk: inserting unescaped user content into HTML
  const html = `<html><body><div id="content">${userContent}</div></body></html>`;
  res.setHeader("Content-Type", "text/html");
  res.end(html);
}

function readSecret() {
  // Insecure file read from a fixed path (may expose secrets)
  try {
    const s = fs.readFileSync("/etc/secrets/api_secret", "utf8");
    return s;
  } catch (e) {
    return null;
  }
}

// example call shapes
// deleteFile({ query: { file: 'somefile' } }, res);
// serveHtml(res, '<img src=x onerror=alert(1)>');
