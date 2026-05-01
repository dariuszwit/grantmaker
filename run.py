#!/usr/bin/env python3
"""
Local launcher for Grant Relationship CRM.

Default action:
    python run.py

Useful actions:
    python run.py start        # start PostgreSQL + app with Docker Compose
    python run.py stop         # stop containers, keep PostgreSQL data volume
    python run.py restart      # restart the stack
    python run.py status       # show container status
    python run.py logs         # follow logs
    python run.py reset-db     # stop and delete PostgreSQL volume, then start again
    python run.py backup       # create PostgreSQL dump in ./backups
    python run.py seed         # rerun migrations and seed script inside app container
    python run.py open         # open http://localhost:8080 in browser

Requirements:
    - Python 3.9+
    - Docker Desktop / Docker Engine
    - Docker Compose plugin: docker compose
      or legacy binary: docker-compose
"""

from __future__ import annotations

import argparse
import datetime as _dt
import os
import shutil
import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from typing import List
from urllib.request import urlopen
from urllib.error import URLError

PROJECT_DIR = Path(__file__).resolve().parent
APP_URL = "http://localhost:8080"
POSTGRES_CONTAINER = "grantcrm_postgres"
APP_CONTAINER = "grantcrm_app"
DB_NAME = "grantcrm"
DB_USER = "grantcrm"


def print_header() -> None:
    print("\nGrant Relationship CRM - local PostgreSQL launcher")
    print(f"Project: {PROJECT_DIR}")
    print(f"App URL: {APP_URL}\n")


def run(cmd: List[str], check: bool = True, capture: bool = False) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )


def require_docker() -> None:
    if not shutil.which("docker") and not shutil.which("docker.exe"):
        raise SystemExit(
            "Docker not found. Install Docker Desktop or Docker Engine first.\n"
            "Then run: python run.py start"
        )
    try:
        run(["docker", "version"], capture=True)
    except subprocess.CalledProcessError as exc:
        output = exc.stdout or ""
        raise SystemExit(
            "Docker is installed, but it is not running or not accessible.\n"
            "Start Docker Desktop and try again.\n\n" + output
        )


def compose_cmd() -> List[str]:
    require_docker()
    try:
        run(["docker", "compose", "version"], capture=True)
        return ["docker", "compose"]
    except subprocess.CalledProcessError:
        legacy = shutil.which("docker-compose") or shutil.which("docker-compose.exe")
        if legacy:
            return [legacy]
    raise SystemExit(
        "Docker Compose not found. Install the Docker Compose plugin, then run again.\n"
        "Expected command: docker compose version"
    )


def wait_for_app(timeout_seconds: int = 90) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(APP_URL, timeout=2) as response:  # nosec - local URL only
                if response.status < 500:
                    return True
        except URLError:
            pass
        except Exception:
            pass
        time.sleep(2)
    return False


def start(open_browser: bool = True, detach: bool = False) -> None:
    cmd = compose_cmd()
    print_header()
    if detach:
        run(cmd + ["up", "--build", "-d"])
        print("Starting services in the background...")
        if wait_for_app():
            print(f"Ready: {APP_URL}")
            if open_browser:
                webbrowser.open(APP_URL)
        else:
            print("Services started, but the web app did not answer yet.")
            print("Check logs with: python run.py logs")
    else:
        print("Starting services. Press Ctrl+C to stop logs; containers use restart policy and data stays in PostgreSQL volume.")
        if open_browser:
            print(f"Open in browser: {APP_URL}")
        run(cmd + ["up", "--build"])


def stop() -> None:
    cmd = compose_cmd()
    print_header()
    run(cmd + ["down"])
    print("Stopped. PostgreSQL data volume was kept.")


def restart(open_browser: bool = True) -> None:
    stop()
    start(open_browser=open_browser, detach=True)


def status() -> None:
    cmd = compose_cmd()
    print_header()
    run(cmd + ["ps"], check=False)


def logs() -> None:
    cmd = compose_cmd()
    print_header()
    run(cmd + ["logs", "-f", "--tail", "200"], check=False)


def reset_db(open_browser: bool = True) -> None:
    cmd = compose_cmd()
    print_header()
    print("WARNING: this deletes the local PostgreSQL Docker volume and CRM data.")
    confirm = input("Type RESET to continue: ").strip()
    if confirm != "RESET":
        print("Cancelled.")
        return
    run(cmd + ["down", "-v"])
    print("Database volume removed. Rebuilding and seeding database...")
    start(open_browser=open_browser, detach=True)


def backup() -> None:
    require_docker()
    print_header()
    backups_dir = PROJECT_DIR / "backups"
    backups_dir.mkdir(exist_ok=True)
    timestamp = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = backups_dir / f"grantcrm_backup_{timestamp}.sql"
    print(f"Creating backup: {out_file}")
    with out_file.open("wb") as fh:
        proc = subprocess.run(
            ["docker", "exec", "-t", POSTGRES_CONTAINER, "pg_dump", "-U", DB_USER, DB_NAME],
            cwd=PROJECT_DIR,
            stdout=fh,
            stderr=subprocess.PIPE,
        )
    if proc.returncode != 0:
        msg = proc.stderr.decode("utf-8", errors="replace") if proc.stderr else ""
        raise SystemExit("Backup failed. Is the stack running?\n" + msg)
    print(f"Backup created: {out_file}")


def seed() -> None:
    require_docker()
    print_header()
    print("Running migrations and seed inside the app container...")
    run(["docker", "exec", "-it", APP_CONTAINER, "npm", "run", "setup"], check=False)


def open_app() -> None:
    print_header()
    webbrowser.open(APP_URL)
    print(f"Opened: {APP_URL}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run local Grant Relationship CRM with PostgreSQL.")
    parser.add_argument(
        "command",
        nargs="?",
        default="start",
        choices=["start", "stop", "restart", "status", "logs", "reset-db", "backup", "seed", "open"],
        help="Command to run. Default: start.",
    )
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically.")
    parser.add_argument("--detach", action="store_true", help="Run Docker Compose in background mode.")
    args = parser.parse_args()

    os.chdir(PROJECT_DIR)
    if args.command == "start":
        start(open_browser=not args.no_open, detach=args.detach)
    elif args.command == "stop":
        stop()
    elif args.command == "restart":
        restart(open_browser=not args.no_open)
    elif args.command == "status":
        status()
    elif args.command == "logs":
        logs()
    elif args.command == "reset-db":
        reset_db(open_browser=not args.no_open)
    elif args.command == "backup":
        backup()
    elif args.command == "seed":
        seed()
    elif args.command == "open":
        open_app()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
