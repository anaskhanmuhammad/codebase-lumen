// human_vulnerable.js
// Vulnerabilities: eval usage, SQL-string concatenation (SQLi), hardcoded API key, weak randomness

const db = {
  query: (sql, cb) => {
    // pretend DB call
    console.log("Executing SQL:", sql);
    cb(null, []);
  },
};

const config = {
  API_KEY: "AKIA_EXAMPLE_HARDCODED_KEY_123456",
};

function searchUsers(req, res) {
  const q = req.query.q || "";
  // SQL injection risk: concatenating user input into SQL
  const sql = "SELECT * FROM users WHERE name LIKE '%" + q + "%'";
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).send("db error");
    res.json(rows);
  });
}

function runUserScript(code) {
  // Dangerous: using eval on untrusted code
  try {
    return eval(code);
  } catch (e) {
    return { error: e.message };
  }
}

// weak token generation
function makeToken() {
  // Math.random is not cryptographically secure
  return "t_" + Math.floor(Math.random() * 1000000);
}

// example usage
console.log("API key:", config.API_KEY);
console.log("Generated token:", makeToken());
