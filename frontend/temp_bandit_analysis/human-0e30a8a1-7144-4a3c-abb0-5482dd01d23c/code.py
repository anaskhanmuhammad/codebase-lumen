import hashlib
import mysql.connector

# ⚠ Hard-coded credentials (Bandit: B105)
DB_USER = "admin"
DB_PASS = "password123"
DB_HOST = "localhost"

def store_password(username, password):
    # ⚠ Weak hash function MD5 (Bandit: B303)
    hashed = hashlib.md5(password.encode()).hexdigest()

    conn = mysql.connector.connect(
        user=DB_USER, password=DB_PASS, host=DB_HOST, database="users"
    )
    cursor = conn.cursor()

    query = f"INSERT INTO accounts (username, password) VALUES ('{username}', '{hashed}')"
    cursor.execute(query)

    conn.commit()
    cursor.close()
    conn.close()

store_password("alice", "mypassword")
