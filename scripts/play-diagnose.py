#!/usr/bin/env python3
"""
Explain why Google Play refused a release, read-only.

r0adkll/upload-google-play reports only Google's short status text
("Precondition check failed"), never the error body that says what the
precondition was. This script asks the Play Developer API directly:

  1. opens a temporary edit,
  2. prints every track and its releases (status, version codes, rollout),
  3. stages the requested release on the requested track inside that edit
     and asks Google to VALIDATE it, printing Google's full answer,
  4. deletes the edit.

Nothing is ever committed, so running this cannot publish or change a release.

Usage (CI): PLAY_SA_JSON=<service account json> \
  python3 scripts/play-diagnose.py <package> <track> <status> [userFraction]
"""

import json
import os
import sys

import google.auth.transport.requests
from google.oauth2 import service_account

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"


def main() -> int:
    package, track, status = sys.argv[1], sys.argv[2], sys.argv[3]
    fraction = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else None

    creds = service_account.Credentials.from_service_account_info(
        json.loads(os.environ["PLAY_SA_JSON"]),
        scopes=["https://www.googleapis.com/auth/androidpublisher"],
    )
    session = google.auth.transport.requests.AuthorizedSession(creds)

    def call(method: str, path: str, body=None):
        res = session.request(method, f"{API}/{package}{path}", json=body)
        try:
            payload = res.json()
        except ValueError:
            payload = res.text
        return res.status_code, payload

    code, edit = call("POST", "/edits")
    if code != 200:
        print(f"::error::Could not open an edit ({code}): {json.dumps(edit, indent=2)}")
        return 1
    edit_id = edit["id"]

    try:
        code, tracks = call("GET", f"/edits/{edit_id}/tracks")
        print(f"== Tracks ({code}) ==")
        latest = 0
        for t in tracks.get("tracks", []) if isinstance(tracks, dict) else []:
            print(f"- {t['track']}")
            for r in t.get("releases", []):
                codes = [int(c) for c in r.get("versionCodes", [])]
                latest = max([latest, *codes])
                print(
                    f"    {r.get('status')}  versionCodes={codes}"
                    f"  userFraction={r.get('userFraction', '-')}  name={r.get('name', '-')}"
                )
        if not isinstance(tracks, dict) or "tracks" not in tracks:
            print(json.dumps(tracks, indent=2))

        if latest == 0:
            print("::warning::No uploaded version code found on any track; skipping validation.")
            return 0

        release = {"versionCodes": [str(latest)], "status": status}
        if fraction is not None and status == "inProgress":
            release["userFraction"] = fraction
        print(f"\n== Staging {release} on '{track}' (not committed) ==")
        code, res = call("PUT", f"/edits/{edit_id}/tracks/{track}", {"track": track, "releases": [release]})
        print(f"tracks.update -> {code}: {json.dumps(res, indent=2)}")
        if code == 200:
            code, res = call("POST", f"/edits/{edit_id}:validate")
            print(f"edits.validate -> {code}: {json.dumps(res, indent=2)}")
        if code != 200:
            print(f"::error::Google Play rejects this release: {json.dumps(res)}")

        # One machine-readable verdict line. FAILED_PRECONDITION on the track
        # is how Play answers while it withholds a track from the account
        # (seen on production, 14-15 Oct 2026); anything else is reported as
        # unknown rather than guessed at.
        error_status = res.get("error", {}).get("status") if isinstance(res, dict) else None
        if code == 200:
            access = "unlocked"
        elif error_status == "FAILED_PRECONDITION":
            access = "locked"
        else:
            access = "unknown"
        verdict = f"{track.upper()}_ACCESS={access}"
        print(f"\n{verdict}")
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as f:
                f.write(f"**{verdict}** (latest version code {latest}; nothing was committed)\n")
    finally:
        call("DELETE", f"/edits/{edit_id}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
