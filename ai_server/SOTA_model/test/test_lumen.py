import os
import requests
import json
import time
import random
from dotenv import load_dotenv

# Path to the .env file in ai_server
dotenv_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path)

# ==========================================================
# ⚙️ CONFIGURATION
# ==========================================================
# LOAD from Ngrok URL in .env
API_URL = os.getenv("NGROK_API_URL")+"/analyze"

OUTPUT_FILE = "lumen_10k_response.json"

# ==========================================================
# 🏗️ MASSIVE PAYLOAD GENERATOR (Target: ~10k Tokens)
# ==========================================================
def generate_heavy_payload():
    print("🏗️ Generating massive ~3,000 line codebase...")
    
    header = """
# Enterprise Resource Planning System (Legacy Core)
# Author: Unknown
# Last Modified: 2018-04-12
# Standards: None

import os
import sys
import json
import sqlite3
import base64
import subprocess
from flask import Flask, request, jsonify

app = Flask(__name__)

# [QUALITY VIOLATION] Global variables, Magic numbers
MAX_RETRIES = 5
TIMEOUT = 300
DB_PATH = "/var/lib/legacy/db.sqlite"

# [SECURITY VIOLATION] Hardcoded Credentials (CWE-798)
AWS_ACCESS_KEY = "AKIA_TEST_1234567890"
AWS_SECRET = "very_secret_key_that_should_not_be_here"

"""

    # 1. Generate "Spaghetti Code" Classes (Quality Issues)
    # We generate 50 classes, each with 5 methods, to create massive context.
    classes_code = ""
    for i in range(50):
        classes_code += f"""
class OrderProcessorModule_{i}:
    def __init__(self, data, context, user, flags, config, db_conn, logger, cache):
        # [QUALITY VIOLATION] Too many arguments (Code Smell)
        self.data = data
        self.id = {i}
    
    def process_logic_step_A(self):
        # Simulating complex logic
        temp = []
        for x in range(100):
            temp.append(x * {i})
        return temp

    def validate_step_B(self, user_input):
        # [SECURITY VIOLATION] Potential ReDoS or weak validation in module {i}
        if "admin" in user_input:
            return True
        return False
        
    def legacy_calculation_C(self):
        # [QUALITY VIOLATION] Cognitive Complexity
        if self.id > 10:
            if self.id < 40:
                if self.data:
                    for k in self.data:
                        if k == 'active':
                            return True
        return False
"""

    # 2. Inject specific vulnerabilities in the middle
    middle_vulnerability = """
# ==========================================================
# MIDDLEWARE SECTION
# ==========================================================
def auth_middleware(token):
    # [SECURITY VIOLATION] Broken Cryptography (CWE-327)
    # Using MD5 for signature verification
    import hashlib
    signature = hashlib.md5(token.encode()).hexdigest()
    if signature == "expected_hash":
        return True
    return False

def get_user_data(user_id):
    # [SECURITY VIOLATION] SQL Injection (CWE-89)
    # Concatenating strings to build queries
    query = "SELECT * FROM users WHERE id = " + str(user_id)
    conn = sqlite3.connect(DB_PATH)
    return conn.execute(query).fetchall()
"""

    # 3. Generate more boilerplate (Logging System)
    logging_code = ""
    for j in range(20):
        logging_code += f"""
def log_event_shard_{j}(msg):
    # [SECURITY VIOLATION] Logging Sensitive Data (GDPR/CWE-532)
    # Potentially logging PII or Credits Cards
    with open(f"/var/log/shard_{j}.log", "a") as f:
        f.write(f"USER_PAYLOAD: {{msg}}\\n")
"""

    # 4. Final Vulnerability at the very end (The "Attention" Test)
    end_vulnerability = """
# ==========================================================
# API ENDPOINTS
# ==========================================================
@app.route('/admin/diagnostics')
def run_diagnostics():
    cmd = request.args.get('tool')
    
    # [SECURITY VIOLATION] Command Injection (CWE-78)
    # Passing user input directly to shell
    # Context: This is at the very end of a 3000 line file.
    output = subprocess.check_output(f"diagnostic_tool {cmd}", shell=True)
    return output
"""

    # Combine everything
    full_code = header + classes_code + middle_vulnerability + logging_code + end_vulnerability
    return full_code

# ==========================================================
# 🚀 EXECUTE TEST
# ==========================================================
if __name__ == "__main__":
    payload_code = generate_heavy_payload()
    
    # Estimate Tokens (Roughly 1 token = 4 chars)
    est_tokens = len(payload_code) / 4
    line_count = len(payload_code.split('\n'))
    
    print(f"\n📦 Payload Statistics:")
    print(f"   - Lines: {line_count}")
    print(f"   - Characters: {len(payload_code)}")
    print(f"   - Est. Tokens: ~{int(est_tokens)} (Targeting 10k context)")
    
    print(f"\n📡 Sending to Lumen AI ({API_URL})...")
    print("⏳ This requires processing ~10k tokens. It might take 60-120 seconds on a T4 GPU.\n")

    start_time = time.time()
    
    try:
        response = requests.post(
            API_URL, 
            json={"code": payload_code, "language": "python", "framework": "Flask"},
            headers={"Content-Type": "application/json"},
            timeout=300 # 5 Minute Timeout for deep thinking
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            
            print("="*60)
            print(f"✅ SUCCESS! (Time taken: {duration:.2f}s)")
            print("="*60)
            
            # Save Raw Output
            with open(OUTPUT_FILE, "w") as f:
                json.dump(result, f, indent=2)
            print(f"💾 Raw JSON response saved to: {OUTPUT_FILE}")

            # Display Summary
            analysis = result.get("analysis", {})
            sec_issues = analysis.get("security_issues", [])
            qual_issues = analysis.get("quality_issues", [])
            
            print(f"\n🛡️ Security Issues Found: {len(sec_issues)}")
            for i, issue in enumerate(sec_issues):
                print(f"  {i+1}. [{issue.get('severity')}] {issue.get('title')} ({issue.get('cwe_id', 'No CWE')})")
                print(f"     Standards: {', '.join(issue.get('standards_violated', []))}")

            print(f"\n🎨 Quality Issues Found: {len(qual_issues)}")
            for i, issue in enumerate(qual_issues[:5]): # Show top 5 only
                print(f"  {i+1}. [{issue.get('severity')}] {issue.get('title')}")

        else:
            print(f"❌ Error {response.status_code}: {response.text}")

    except Exception as e:
        print(f"❌ Connection Failed: {e}")
