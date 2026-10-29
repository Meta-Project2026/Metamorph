"""Read pinned public tar bytes as data only. Never extract or execute source."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

COMMIT = "d272170d0aecbd28eb5b13e272d9dd11d545b66c"
ARCHIVE = "32ef29fd0a13c4184785d74228bd8e300ae507cb8a4a60adfa48215c2e43eae4"
LICENSE = "46ef5fb6b330816e097c9e7e16e5a4e6ba8f03c2113a4d97fe8c358f64d629a9"
sha = lambda b: hashlib.sha256(b).hexdigest()


def inspect(data):
    if len(data) > 4 * 1024 * 1024 or sha(data) != ARCHIVE:
        raise ValueError("SOURCE_DIGEST")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for entry in archive:
            parts = entry.name.split("/")
            if parts[0] != "car-workshop-" + COMMIT or any(p in (".", "..") for p in parts):
                raise ValueError("SOURCE_PATH")
            if entry.isdir():
                continue
            path = "/".join(parts[1:])
            if not entry.isfile() or path in files or len(files) >= 64 or entry.size > 2 * 1024 * 1024:
                raise ValueError("SOURCE_ENTRY")
            files[path] = archive.extractfile(entry).read(entry.size + 1)
    if sha(files["LICENSE"]) != LICENSE:
        raise ValueError("LICENSE_DIGEST")
    units = []
    metrics = []
    class_count = 0
    for path, content in sorted(files.items()):
        if not path.endswith(".php") or path.startswith(("vendor/", "tests/")):
            continue
        text = content.decode("utf-8")
        class_count += len(re.findall(r"^\s*(?:(?:abstract|final)\s+)?class\s+\w+", text, re.M))
        regions = re.findall(r"<\?php(.*?)(?:\?>|\Z)", text, re.S)
        php_lines = [line for region in regions for line in region.splitlines() if line.strip()]
        metrics.append({"path": path, "physicalFileLines": len(text.splitlines()),
                        "nonblankPhpRegionLinesIncludingComments": len(php_lines)})
        for match in re.finditer(r"^function\s+(\w+)\s*\(", text, re.M):
            units.append({"path": path, "function": match[1], "line": text[:match.start()].count("\n") + 1})
    api = files["api.php"].decode("utf-8")
    actions = re.findall(r"^\s+case '([a-z_]+)':", api, re.M)
    context = {"format": "mmp061-public-source-v1", "sourceCommit": COMMIT,
               "archiveSha256": ARCHIVE, "license": files["LICENSE"].decode("utf-8"),
               "files": [{"path": p, "content": files[p].decode("utf-8")} for p in ["api.php", "config.php"]]}
    inventory = {"format": "mmp061-source-inventory-v1", "repository": "tanjilaafsarirubina/car-workshop",
                 "commit": COMMIT, "archiveSha256": ARCHIVE, "archiveBytes": len(data), "licenseSha256": LICENSE,
                 "files": [{"path": p, "bytes": len(b), "sha256": sha(b)} for p, b in sorted(files.items())],
                 "phpMetrics": metrics, "phpFunctionUnits": units, "classCount": class_count,
                 "apiActions": actions, "apiActionCount": len(actions),
                 "modelFiles": ["api.php", "config.php"], "composerManifestPresent": "composer.json" in files,
                 "scope": "Public API slice only; HTML/JS UI, MySQL, concurrency and unrestricted queries excluded",
                 "sizing": "5 actions, below a 10-15 route benchmark; not whole-product qualification"}
    return inventory, context, files["LICENSE"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    with args.archive.open("rb") as stream:
        inventory, context, notice = inspect(stream.read(4 * 1024 * 1024 + 1))
    args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name, value in [("inventory.json", inventory), ("context.local.json", context)]:
        with (args.output / name).open("x", encoding="utf-8", newline="\n") as stream:
            import os
            os.chmod(stream.name, 0o600)
            json.dump(value, stream, ensure_ascii=True, indent=2)
            stream.write("\n")
    (args.output / "LICENSE.upstream").write_bytes(notice)
    print(json.dumps({"archiveSha256": ARCHIVE, "phpFiles": len(inventory["phpMetrics"]),
                      "functions": len(inventory["phpFunctionUnits"]), "actions": len(inventory["apiActions"])}))
