#!/usr/bin/env python3
"""
backup_db.py - local PostgreSQL backup helper for Grant CRM.

Run from the project folder:

    py .\backup_db.py
    py .\backup_db.py --keep-days 30
    py .\backup_db.py --container grantcrm_postgres --db grantcrm --user grantcrm

The script:
- checks whether Docker is available,
- checks whether the PostgreSQL container is running,
- creates ./backups if missing,
- runs pg_dump inside the PostgreSQL container,
- saves a timestamped .sql backup locally,
- optionally removes old backups.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import subprocess
import sys
from pathlib import Path


DEFAULT_CONTAINER = "grantcrm_postgres"
DEFAULT_DB = "grantcrm"
DEFAULT_USER = "grantcrm"
DEFAULT_BACKUP_DIR = "backups"


def run_command(command: list[str], *, capture: bool = True, check: bool = True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            command,
            text=True,
            capture_output=capture,
            check=check,
        )
    except FileNotFoundError:
        print("ERROR: Docker was not found. Install Docker Desktop or make sure docker is in PATH.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        if exc.stdout:
            print(exc.stdout)
        if exc.stderr:
            print(exc.stderr, file=sys.stderr)
        if check:
            sys.exit(exc.returncode)
        return exc


def docker_available() -> None:
    result = run_command(["docker", "info"], check=False)
    if result.returncode != 0:
        print("ERROR: Docker is installed but the Docker engine is not running or not accessible.", file=sys.stderr)
        print("Start Docker Desktop and try again.", file=sys.stderr)
        sys.exit(1)


def container_running(container: str) -> None:
    result = run_command(
        ["docker", "inspect", "-f", "{{.State.Running}}", container],
        check=False,
    )
    if result.returncode != 0 or result.stdout.strip().lower() != "true":
        print(f"ERROR: Container '{container}' is not running.", file=sys.stderr)
        print("Start the project first, for example:", file=sys.stderr)
        print("  py .\\run.py --detach", file=sys.stderr)
        sys.exit(1)


def make_backup(container: str, db: str, user: str, backup_dir: Path, prefix: str) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)

    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = backup_dir / f"{prefix}_{db}_{timestamp}.sql"

    print(f"Creating backup: {output_path}")

    # pg_dump runs inside the Postgres container. Output is streamed to the local file.
    command = [
        "docker",
        "exec",
        "-i",
        container,
        "pg_dump",
        "-U",
        user,
        "-d",
        db,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
    ]

    with output_path.open("w", encoding="utf-8", newline="\n") as f:
        process = subprocess.run(command, text=True, stdout=f, stderr=subprocess.PIPE)

    if process.returncode != 0:
        print(process.stderr, file=sys.stderr)
        try:
            output_path.unlink(missing_ok=True)
        except Exception:
            pass
        print("ERROR: Backup failed.", file=sys.stderr)
        sys.exit(process.returncode)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Backup complete: {output_path} ({size_mb:.2f} MB)")
    return output_path


def cleanup_old_backups(backup_dir: Path, prefix: str, keep_days: int) -> None:
    if keep_days <= 0:
        return

    cutoff = dt.datetime.now().timestamp() - keep_days * 24 * 60 * 60
    removed = 0

    for path in backup_dir.glob(f"{prefix}_*.sql"):
        if path.stat().st_mtime < cutoff:
            print(f"Removing old backup: {path}")
            path.unlink()
            removed += 1

    if removed:
        print(f"Removed {removed} old backup file(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a PostgreSQL backup from a Docker container.")
    parser.add_argument("--container", default=DEFAULT_CONTAINER, help=f"Postgres container name. Default: {DEFAULT_CONTAINER}")
    parser.add_argument("--db", default=DEFAULT_DB, help=f"Database name. Default: {DEFAULT_DB}")
    parser.add_argument("--user", default=DEFAULT_USER, help=f"Database user. Default: {DEFAULT_USER}")
    parser.add_argument("--backup-dir", default=DEFAULT_BACKUP_DIR, help=f"Backup directory. Default: {DEFAULT_BACKUP_DIR}")
    parser.add_argument("--prefix", default="grantcrm_backup", help="Backup file prefix. Default: grantcrm_backup")
    parser.add_argument("--keep-days", type=int, default=0, help="Delete backups older than N days. Default: 0 means keep all.")
    args = parser.parse_args()

    backup_dir = Path(args.backup_dir).resolve()

    docker_available()
    container_running(args.container)

    backup_path = make_backup(
        container=args.container,
        db=args.db,
        user=args.user,
        backup_dir=backup_dir,
        prefix=args.prefix,
    )

    cleanup_old_backups(
        backup_dir=backup_dir,
        prefix=args.prefix,
        keep_days=args.keep_days,
    )

    print("")
    print("Done.")
    print(f"Backup file: {backup_path}")


if __name__ == "__main__":
    main()
