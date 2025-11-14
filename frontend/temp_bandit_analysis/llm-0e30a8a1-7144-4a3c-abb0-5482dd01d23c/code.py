import subprocess
import os

def list_files(user_input):
    # ⚠ Dangerous: user input being passed directly into shell command
    command = "ls -l " + user_input
    
    # ⚠ Bandit: Using shell=True with untrusted input (B602/B603)
    result = subprocess.check_output(command, shell=True)
    return result.decode()

# Example of unsafe call
filename = input("Enter filename: ")  # e.g. ; rm -rf /
print(list_files(filename))
