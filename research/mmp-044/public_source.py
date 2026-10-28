"""Read only three named public archive members into memory; execute none of them."""
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[2]
pins = json.loads((root / "specs/014-public-validation-triage/pins.json").read_text())
source = pins["php"]
url = f'https://codeload.github.com/{source["repository"]}/tar.gz/{source["commit"]}'
with urllib.request.urlopen(url, timeout=45) as response:
    blob = response.read(10 * 1024 * 1024 + 1)
if len(blob) > 10 * 1024 * 1024:
    raise RuntimeError("SOURCE_LIMIT")
if hashlib.sha256(blob).hexdigest() != source["archiveSha256"]:
    raise RuntimeError("SOURCE_DIGEST")
result = {"scope": "STATIC_PUBLIC_SOURCE_ONLY", "archiveSha256": source["archiveSha256"], "members": {}}
with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as archive:
    for name, digest in source["members"].items():
        members = [m for m in archive.getmembers() if m.name.split("/", 1)[-1] == name]
        if len(members) != 1 or not members[0].isfile() or members[0].size > 128 * 1024:
            raise RuntimeError("MEMBER_ADMISSION")
        data = archive.extractfile(members[0]).read()
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError("MEMBER_DIGEST")
        result["members"][name] = {"sha256": digest, "lines": len(data.decode("utf-8-sig").splitlines())}
print(json.dumps(result, indent=2))
