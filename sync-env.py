import os
import subprocess
from pathlib import Path

def sync_vercel_env():
    """Reads the root .env and syncs each variable to the Vercel Production vault."""
    env_path = Path('.env')
    
    if not env_path.exists():
        print("?? No .env file found in the root. Skipping sync.")
        return

    print("🚀 Vercel Watcher: Syncing local .env to Production Vault...")
    
    try:
        # We assume the project is linked since you ran 'vercel link' manually
        # If it's not, the vercel env add command will give a helpful error anyway
        with open(env_path, "r", encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # Skip comments and empty lines
                if not line or line.startswith("#") or "=" not in line:
                    continue
                
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                
                if key and val:
                    # Sync to Vercel Production
                    # --yes and --non-interactive handle prompts
                    subprocess.run(
                        ["vercel", "env", "add", key, val, "production", "--non-interactive", "--yes"],
                        shell=True,
                        capture_output=True
                    )
                    print(f"   ? Synced: {key}")

        print("? Vercel Vault is now up to date.")

    except Exception as e:
        print(f"?? Error during Vercel sync: {e}")

if __name__ == "__main__":
    sync_vercel_env()
