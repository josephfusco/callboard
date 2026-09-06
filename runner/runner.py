#!/usr/bin/env python3
"""Callboard runner: drains the site's fetch queue. Fetches YouTube audio with yt-dlp, builds the set folder,
uploads it to WordPress over REST, and triggers the import.

    python3 runner.py --site https://example.com --user admin [--watch]

Auth is an application password (Users → Profile → Application Passwords), passed with --password,
the CALLBOARD_PASSWORD environment variable, or a prompt.
"""
import argparse, getpass, json, os, subprocess, sys, time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

HERE = Path(__file__).resolve().parent
UPLOAD_NAMES = {"manifest.json", "cover.png", "share.png", "lyrics.json", "lyrics.approved"}
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".ogg", ".opus", ".wav", ".flac"}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", required=True, help="Site URL, e.g. https://example.com")
    ap.add_argument("--user", required=True, help="WordPress username")
    ap.add_argument("--password", default=os.environ.get("CALLBOARD_PASSWORD"), help="Application password")
    ap.add_argument("--workdir", default=os.environ.get("CALLBOARD_OUT", "./audio"), help="Where set folders are built")
    ap.add_argument("--watch", action="store_true", help="Keep polling for new requests")
    ap.add_argument("--interval", type=int, default=60, help="Seconds between polls with --watch")
    a = ap.parse_args()
    password = a.password or getpass.getpass("Application password: ")
    api = Api(a.site.rstrip("/"), a.user, password)

    while True:
        queued = api.get("requests", status="queued")
        if not queued:
            print("nothing queued", flush=True)
        for req in queued:
            handle(api, req, Path(a.workdir))
        if not a.watch:
            return 0
        time.sleep(a.interval)


class Api:
    def __init__(self, site: str, user: str, password: str):
        self.base = f"{site}/wp-json/callboard/v1/"
        self.s = requests.Session()
        self.s.auth = (user, password)
        self.s.headers["User-Agent"] = "callboard-runner/1.0"

    def get(self, path: str, **params):
        r = self.s.get(self.base + path, params=params, timeout=60)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, data=None, files=None):
        r = self.s.post(self.base + path, data=data, files=files, timeout=600)
        if not r.ok:
            raise RuntimeError(f"{path}: HTTP {r.status_code} {r.text[:300]}")
        return r.json()


def handle(api: Api, req: dict, workdir: Path) -> None:
    rid, slug, name, url = req["id"], req["slug"], req["name"], req["url"]
    print(f"→ {name} ({slug}) {url}", flush=True)
    api.post(f"requests/{rid}/status", {"status": "running", "log": "runner: fetching audio"})
    try:
        env = dict(os.environ, CALLBOARD_OUT=str(workdir))
        subprocess.run([str(HERE / "fetch.sh"), slug, url, name], check=True, env=env)
        folder = workdir / slug
        files = sorted(p for p in folder.iterdir() if p.is_file() and (p.suffix.lower() in AUDIO_EXT or p.name in UPLOAD_NAMES))
        for n, f in enumerate(files, 1):
            api.post(f"requests/{rid}/files", files={"file": (f.name, f.open("rb"))})
            print(f"  ↑ {f.name} ({n}/{len(files)})", flush=True)
        done = api.post(f"requests/{rid}/complete")
        print(f"✓ {done.get('result')} {done.get('set') or ''}", flush=True)
    except Exception as e:  # report, then keep draining the queue
        msg = str(e)[:500]
        print(f"✗ {msg}", file=sys.stderr, flush=True)
        try:
            api.post(f"requests/{rid}/status", {"status": "failed", "log": msg})
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
