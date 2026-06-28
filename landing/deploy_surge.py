import sys
import time
from pexpect.popen_spawn import PopenSpawn
import pexpect

def deploy_to_surge():
    print("Starting Surge deployment via PopenSpawn...")
    
    # We will use PopenSpawn for Windows
    child = PopenSpawn('surge.cmd ./dist law-assist-official.surge.sh', encoding='utf-8')
    
    try:
        # Surge asks for email
        child.expect('email:', timeout=15)
        print("Got email prompt, sending email...")
        child.sendline('law.assist.ai.dev@gmail.com')
        
        # Surge asks for password
        child.expect('password:', timeout=15)
        print("Got password prompt, sending password...")
        child.sendline('LawAssist2026!')
        
        # Wait for deployment to finish
        child.expect(pexpect.EOF, timeout=120)
        print(child.before)
        print("\nDeployment successful! Link: https://law-assist-official.surge.sh")
    except pexpect.exceptions.TIMEOUT:
        print("Timeout waiting for surge prompt.")
        print("Current output:", child.before)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    deploy_to_surge()
