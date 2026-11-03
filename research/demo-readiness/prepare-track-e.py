"""Offline projection of the one explicitly reviewed PUBLIC artifact. No network/execution."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ZIP_SHA = "2aab13dd092d20a864b347fbeb2efea0caae10f22b28a4a24c39e78581862ee8"
MEMBERS = [
    ("meta-paid-public/generation.json", 2151, "c17667ff67b1289884b3beacb11e5d86f4cdab9d31498b48df323469e1411201", "meta-generation-v1"),
    ("meta-paid-public/trial.json", 20930, "0250d5d06ab36362434fb20d92f85e355a6d254b33f9fc7cfe785cdb10bae5e0", "mmp078-public-paid-trial-v1"),
    ("meta-paid-public/finalizer.json", 165, "348746249e45b15da0972fdf88843807d03619d7795fef067095d54351a6cdb8", None),
    ("meta-paid-public/preservation.json", 1020, "c7a19894f48dccaad484516289124bff3a57764a9666227c20749a03c8de796c", "mmp097-preservation-v1"),
    ("meta-paid-public/custody-capture.json", 655, "ff5a1b5f24b4fe0fda2c2383184ab39c8d1b8a9c257350e101476ce023f2d5a7", "mmp115-custody-v1"),
    ("meta-paid-public/custody-finalizer.json", 406, "3679a278825d83e008036d9405b71a4ed723f37d5c98dfe04a2dc223240f22e6", "mmp115-pre-oracle-finalizer-v1"),
    ("meta-paid-public/custody-checkpoint.json", 663, "9e3d7bef11eaa7bbb31971fcb447498e3e7fbdce9fec6563d1f4bb0de95408f2", "mmp115-custody-v1"),
    ("meta-paid-public/custody-stored.json", 660, "d7b4589e2d63ad41a5968a2899c1c9f3b7493b8c8b2be23bff1e49a3512ed8d3", "mmp115-custody-v1"),
    ("mmp078-41505679809-attempt.json", 765, "7d02aee55a7501e22aa188796813a728f21903b8035be4d3ee98596f6a532b7a", None),
]

def require(condition, code):
    if not condition:
        raise ValueError(code)

def pairs(items):
    value = {}
    for key, item in items:
        require(key not in value and key not in ["__proto__", "prototype", "constructor"], "UNSAFE_JSON_KEYS")
        value[key] = item
    return value

def inspect(value):
    if isinstance(value, dict):
        for key, item in value.items():
            require(not re.search(r"(?i)(password|api.?key|secret|rawresponse|rawbody|candidate(?:source|files|plaintext)|observations)", key), "UNSAFE_PUBLIC_FIELDS")
            inspect(item)
    elif isinstance(value, list):
        for item in value:
            inspect(item)
    elif isinstance(value, str):
        require(not re.search(r"(?i)(AGE-SECRET-KEY|-----BEGIN|[a-z]:\\|/(?:home|tmp|Users)/|<script|<\?php)", value), "UNSAFE_PUBLIC_VALUE")

def prepare(archive):
    raw_zip = Path(archive).read_bytes()
    require(len(raw_zip) == 8733 and hashlib.sha256(raw_zip).hexdigest() == ZIP_SHA, "PUBLIC_ZIP_PIN_MISMATCH")
    docs = {}
    with zipfile.ZipFile(archive) as source:
        require(source.namelist() == [item[0] for item in MEMBERS], "PUBLIC_MEMBER_SET_MISMATCH")
        for name, length, digest, format_name in MEMBERS:
            raw = source.read(name)
            require(len(raw) == length and hashlib.sha256(raw).hexdigest() == digest, "PUBLIC_MEMBER_PIN_MISMATCH")
            item = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs)
            require(item.get("format") == format_name, "PUBLIC_FORMAT_MISMATCH")
            inspect(item)
            docs[name.split("/")[-1]] = item
    g, t, f = [docs[name] for name in ["generation.json", "trial.json", "finalizer.json"]]
    auth = g["authorization"]
    attempt = docs["mmp078-41505679809-attempt.json"]
    require(t["budgetAuth"] == auth and t["modelReceipts"] == [g], "PUBLIC_RECEIPT_LINK_MISMATCH")
    require(all(attempt[k] == v for k, v in auth.items()), "PUBLIC_ATTEMPT_LINK_MISMATCH")
    require(auth["runId"] == t["trialRunId"] == "41505679809" and auth["headSha"] == t["headSha"] == f["headSha"] == "a01bb65f8bb58c02c7a59e06ffedc9662576478e", "PUBLIC_RUN_MISMATCH")
    require(g["candidateSha"] == t["candidateSha"] == t["attempts"][0]["candidateSha"] == "6140dbed4afb0d2068db17facb0e14ff9c2ffb61aaaf2b64207b9a8aa2125d38", "PUBLIC_CANDIDATE_MISMATCH")
    for key in ["sourceSha", "contextSha256", "manifestSha256"]:
        require(g[key] == t[key] == auth[key] == attempt[key], "PUBLIC_SOURCE_MISMATCH")
    require(g["inputSha256"] == auth["bodySha256"] and len(t["attempts"]) == 1, "PUBLIC_REQUEST_MISMATCH")
    a = t["attempts"][0]
    require([item["verdict"] for item in a["gates"]] == ["INCONCLUSIVE", "PASS", "FAIL", "FAIL", "INCONCLUSIVE"], "PUBLIC_GATE_MISMATCH")
    require(a["coverage"] == dict(http=17, sqlite=20, requiredHttp=17, requiredSqlite=20), "PUBLIC_COVERAGE_MISMATCH")
    require([item["compilerDiagnostics"]["g1Verdict"] for item in a["pairs"]] == ["PASS"] * 3, "PUBLIC_BUILD_MISMATCH")
    require(all(item["findingCodes"] == ["HTTP_JSON_TYPE"] for pair in a["pairs"] for item in pair["gates"] if item["gate"] in ["G2", "G3"]), "PUBLIC_FINDING_MISMATCH")
    generation_fields = "status generationKind provider modelId attemptedRequests confirmedResponseCount httpStatus networkSend tlsPeerVerified inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd usageStatus".split()
    return {
        "format": "mmp148-public-parity-v1",
        "scope": "RECORDED_PUBLIC_MANIFEST",
        "provenance": {
            "runId": auth["runId"], "runAttempt": 1, "headSha": t["headSha"],
            "sourceRepository": "tanjilaafsarirubina/car-workshop", "sourceSha": t["sourceSha"],
            "sourceArchiveSha256": t["sourceArchiveSha256"], "contextSha256": t["contextSha256"],
            "manifestSha256": t["manifestSha256"], "requestSha256": g["inputSha256"], "candidateSha256": t["candidateSha"],
            "artifactId": "13169804253", "artifactName": "meta-paid-public-41505679809", "zipBytes": len(raw_zip), "zipSha256": ZIP_SHA,
            "members": [dict(name=name, bytes=length, sha256=digest, format=format_name) for name, length, digest, format_name in MEMBERS],
        },
        "generation": {key: g[key] for key in generation_fields},
        "gates": a["gates"], "coverage": a["coverage"],
        "scenarios": [dict(scenarioId=pair["scenarioId"], g1Verdict=pair["compilerDiagnostics"]["g1Verdict"], gates=pair["gates"], cleanup=pair["cleanup"]) for pair in a["pairs"]],
        "cleanup": t["cleanup"],
        "finalizer": dict(status=f["status"], containers=f["inventory"]["containers"], volumes=f["inventory"]["volumes"], emergencyRemoved=f["emergencyRemoved"]),
        "sqliteConclusion": "MATCH_WITHIN_COMPARED_MANIFEST",
        "rootCause": "UNCONFIRMED", "heldOut": "NOT_RUN", "product": t["product"],
    }

if __name__ == "__main__":
    require(len(sys.argv) == 3, "USAGE_PUBLIC_ZIP_AND_OUTPUT_PATH_REQUIRED")
    result = (json.dumps(prepare(sys.argv[1]), indent=2, ensure_ascii=False) + "\n").encode("utf8")
    Path(sys.argv[2]).write_bytes(result)
    print(json.dumps(dict(status="GO_PUBLIC_SNAPSHOT", bytes=len(result), sha256=hashlib.sha256(result).hexdigest(), originalMembers=9, scope="public snapshot identity; no independent Oracle rerun")))
