"""Project only reviewed PUBLIC metadata. Offline, stdlib only; never execute source.

ZIP identity is checked before opening; member identities before JSON parsing.
The output is an allowlist projection, not a new Oracle run or source admission.
"""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUN = "41856569137"
HEAD = "95397bbff94f3e0121ebdc9fa375880762bcbac7"
CANDIDATE = "4207053ada23f8e94ecf6301452ee4ea8228a3717c0a478d3e550443cec130e6"
ZIP_SHA = "38fd34d24eca33630c79c9f4120194f623d7cfec4be5826355150a31089e4b1e"
SYNTHETIC_SHA = "d4d56c7735805987e7b8688005db152d36902f2a7f57f44179429a4e45bd147d"
SCENARIOS = [("workshop-business", 6), ("workshop-rejected", 5), ("workshop-capacity", 6)]
CONTROLS = "http-positive http-key-order http-status-mutant http-type-mutant http-missing-mutant http-order-mutant db-positive db-row-mutant db-sequence-mutant".split()


def require(condition, code):
    if not condition:
        raise ValueError(code)


def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result and key not in ["__proto__", "constructor", "prototype"], "UNSAFE_JSON_KEY")
        result[key] = value
    return result


def read_json(raw):
    return json.loads(raw, object_pairs_hook=unique, parse_constant=lambda _: require(False, "UNSAFE_JSON_NUMBER"))


def gate(identifier, verdict, ids, codes=None):
    return dict(gate=identifier, verdict=verdict, executedTestIds=ids, findingCodes=codes or [])


def steps(sid, count):
    return [f"{sid}:step-{i}" for i in range(count)]


def project(docs, provenance, synthetic):
    """Semantic checks also tested without byte pins, guarding reviewed pin changes."""
    g, t, s, pre, final = [docs["meta-paid-public/" + n + ".json"] for n in ["generation", "trial", "scorecard", "preflight", "finalizer"]]
    auth = g["authorization"]
    require(g["status"] == "PASS" and g["generationKind"] == "REAL_INFERENCE" and g["attempt"] == 1 and g["action"] == "generate", "GENERATION_MISMATCH")
    require(auth["runId"] == t["trialRunId"] == s["runId"] == RUN, "RUN_MISMATCH")
    require(auth["headSha"] == t["headSha"] == s["headSha"] == pre["headSha"] == HEAD, "HEAD_MISMATCH")
    require(g["candidateSha"] == t["candidateSha"] == s["candidateSha"] == CANDIDATE, "CANDIDATE_MISMATCH")
    for key in ["sourceSha", "contextSha256", "manifestSha256"]:
        require(g[key] == auth[key] == t[key] == pre[key] == provenance[key], "SOURCE_MISMATCH")
    require(t["sourceArchiveSha256"] == pre["sourceArchiveSha256"] == provenance["sourceArchiveSha256"], "SOURCE_ARCHIVE_MISMATCH")
    require(pre["sha256"] == auth["preflightSha256"] == s["preflightSha256"] and pre["workflowSha256"] == auth["workflowSha256"] == s["workflowSha256"] == provenance["workflowSha256"], "PREFLIGHT_MISMATCH")
    require(g["inputSha256"] == auth["bodySha256"] == pre["requestBodySha256"] == s["requestBodySha256"] and g["responseSha256"] == s["responseSha256"], "REQUEST_MISMATCH")
    require(t["budgetAuth"] == auth and t["modelReceipts"] == [g] and t["generatedRequests"] == 1, "GENERATION_LINK_MISMATCH")
    require(docs["meta-paid-public/send-receipts/2.json"] == g, "SEND_RECEIPT_MISMATCH")
    first = docs["meta-paid-public/send-receipts/1.json"]
    require(first["authorization"] == auth and first["status"] == "ERROR" and first["networkSend"] == "UNKNOWN" and first["confirmedResponseCount"] == 0, "PRELIMINARY_RECEIPT_MISMATCH")
    ledger = docs[f"mmp078-{RUN}-attempt.json"]
    require(all(ledger[k] == v for k, v in auth.items()), "LEDGER_MISMATCH")
    require(len(t["attempts"]) == 1, "ATTEMPT_COUNT_MISMATCH")
    a = t["attempts"][0]
    require(a["candidateSha"] == CANDIDATE and t["custodyLink"]["verifierAttemptIds"] == [a["attemptId"]], "ORACLE_IDENTITY_MISMATCH")
    expected_gates = [gate("G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"]),
                      gate("G1", "PASS", [f"{sid}:{kind}" for sid, _ in SCENARIOS for kind in ["typecheck", "build"]]),
                      gate("G2", "PASS", [v for sid, n in SCENARIOS for v in steps(sid, n)]),
                      gate("G3", "PASS", [v for sid, n in SCENARIOS for v in [f"{sid}:initial", *steps(sid, n)]]),
                      gate("G4", "INCONCLUSIVE", [f"{sid}:{c}" for sid, _ in SCENARIOS for c in CONTROLS], ["HELD_OUT_NOT_RUN"])]
    require(a["gates"] == expected_gates, "GATE_OR_COVERAGE_MISMATCH")
    for report in [t, s]:
        require([report[k] for k in ["G0", "publicG1", "publicG2", "publicG3", "G4", "product"]] == ["INCONCLUSIVE", "PASS", "PASS", "PASS", "INCONCLUSIVE", "NOT_ESTABLISHED"], "GATE_OR_PRODUCT_MISMATCH")
    require(a["coverage"] == dict(http=17, sqlite=20, requiredHttp=17, requiredSqlite=20), "COVERAGE_MISMATCH")
    require(s["coverage"] == dict(http=17, requiredHttp=17, sqlite=20, requiredSqlite=20, gateCounts=dict(G1=6, G2=17, G3=20, G4=27)), "SCORECARD_COVERAGE_MISMATCH")
    require(len(a["pairs"]) == 3, "PAIR_COUNT_MISMATCH")
    scenarios = []
    for p, (sid, n) in zip(a["pairs"], SCENARIOS):
        d, b = p["compilerDiagnostics"], p["failureTelemetry"]["binding"]
        require(p["scenarioId"] == sid and d["g1Verdict"] == "PASS", "PAIR_BUILD_MISMATCH")
        for key, value in dict(sourceSha=t["sourceSha"], candidateSha=CANDIDATE, attemptId=a["attemptId"], pairId=p["pairId"]).items():
            require(d[key] == b[key] == value, "PAIR_IDENTITY_MISMATCH")
        require(b["runId"] == RUN and b["headSha"] == HEAD, "PAIR_EPOCH_MISMATCH")
        require(p["gates"] == [gate("G2", "PASS", steps(sid, n)), gate("G3", "PASS", [f"{sid}:initial", *steps(sid, n)]), gate("G4", "INCONCLUSIVE", CONTROLS, ["HELD_OUT_NOT_RUN"])], "PAIR_GATE_MISMATCH")
        require(p["cleanup"] == "VERIFIED_ZERO_RESOURCES" and p["targetLifetimePolicyMs"] == 180000, "PAIR_LIMIT_MISMATCH")
        scenarios.append(dict(scenarioId=sid, pairId=p["pairId"], g1Verdict=d["g1Verdict"], gates=p["gates"], cleanup=p["cleanup"]))
    require(t["cleanup"] == dict(status="VERIFIED_ZERO_RESOURCES", containers=0, volumes=0, emergencyRemoved=0), "CLEANUP_MISMATCH")
    require(final == dict(headSha=HEAD, inventory=dict(containers=0, volumes=0), emergencyRemoved=0, status="PASS"), "FINALIZER_MISMATCH")
    require(s["outcome"] == t["validationOutcome"] and s["outcome"] == dict(status="COMPLETE_PUBLIC_PASS", publicVerdict="PASS", complete=True, feedbackCodes=[], repair="NOT_AUTHORIZED_BY_THIS_REPORT", code=None), "OUTCOME_MISMATCH")
    require(s["stopReason"] == "FIRST_PUBLIC_PASS_STOP" and s["repairs"] == 0, "REPAIR_MISMATCH")
    require(g["provider"] == t["provider"] == "meta-model-api" and g["modelId"] == t["modelId"] == s["model"] == "muse-spark-1.3", "PROVIDER_MISMATCH")
    for key in ["inputTokens", "outputTokens", "cachedInputTokens", "chargedCostUsd", "usageStatus"]:
        require(g[key] == s[key], "USAGE_MISMATCH")
    require(g["estimatedCostUsd"] == s["observedEstimatedCostUsd"] == t["estimatedCostUsd"] and g["chargedCostUsd"] is None and t["chargedCostUsd"] is None, "COST_MISMATCH")
    require([pre[k] for k in ["maximumPosts", "maximumRepairs", "automaticRetries", "maxOutputTokens", "monetaryCap"]] == [2, 1, 0, 16384, "NO_PROVIDER_HARD_CAP"], "LIMIT_MISMATCH")
    observations = synthetic["observations"]
    require(len(observations) == 12 and all(o["actual"] == o["expected"] and o["candidateSha"] != CANDIDATE for o in observations), "SYNTHETIC_MIXING_FORBIDDEN")
    positive = observations[-1]
    require(positive["id"] == "qualified-positive" and positive["actual"] == "PASS" and synthetic["g0RealCandidate"] == "NOT_RUN" and synthetic["g4"] == "INCONCLUSIVE" and synthetic["product"] == "NOT_ESTABLISHED", "SYNTHETIC_SCOPE_MISMATCH")
    generation_fields = "status generationKind provider modelId modelVersion inputSha256 responseSha256 attemptedRequests confirmedResponseCount httpStatus networkSend tlsPeerVerified inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd usageStatus".split()
    return dict(format="mmp194-public-success-v1", scope="RECORDED_PUBLIC_MANIFEST", provenance=provenance,
                candidateSha256=CANDIDATE, oracleAttemptId=a["attemptId"], generation={k:g[k] for k in generation_fields},
                gates=a["gates"], coverage=a["coverage"], scenarios=scenarios, cleanup=t["cleanup"],
                finalizer=dict(status=final["status"], **final["inventory"], emergencyRemoved=final["emergencyRemoved"]),
                limits=dict(maximumPosts=pre["maximumPosts"], maximumRepairs=pre["maximumRepairs"], automaticRetries=pre["automaticRetries"], maxOutputTokens=pre["maxOutputTokens"], targetLifetimePolicyMs=180000, monetaryCap=pre["monetaryCap"]),
                stopReason=s["stopReason"], repairs=s["repairs"], preliminarySendStatus="ERROR_UNKNOWN_BEFORE_FINAL_RESPONSE",
                syntheticG0=dict(basis="OWNER_RECORDED_PUBLIC_SYNTHETIC_SUMMARY", sourcePath="research/mmp-183/linux-docker-result.json", sourceSha256=SYNTHETIC_SHA,
                                 sourceCommit="14a54665a94394ca9fdb68a7c27f0c596428cbea", controls=11, qualifiedPositive=1,
                                 candidateSha256=positive["candidateSha"], verdict=positive["actual"], independentEngineAttestation="NOT_ESTABLISHED",
                                 earlierAttemptVerdicts=[v["verdict"] for v in synthetic["earlierAttempts"].values()], faultControls="NOT_RUN"),
                g0RealCandidate="NOT_RUN", heldOut="NOT_RUN", g4="INCONCLUSIVE", product="NOT_ESTABLISHED", privateCustody="NOT_INDEPENDENTLY_VERIFIED")


def prepare(archive):
    raw = Path(archive).read_bytes()
    require(len(raw) == 14807 and hashlib.sha256(raw).hexdigest() == ZIP_SHA, "PUBLIC_ZIP_PIN_MISMATCH")
    policy = read_json((HERE / "provenance/track-g/source-pins.json").read_bytes())
    docs = {}
    with zipfile.ZipFile(archive) as z:
        require(z.namelist() == [p["name"] for p in policy["members"]], "PUBLIC_MEMBER_SET_MISMATCH")
        for pin in policy["members"]:
            data = z.read(pin["name"])
            require(len(data) == pin["bytes"] and hashlib.sha256(data).hexdigest() == pin["sha256"], "PUBLIC_MEMBER_PIN_MISMATCH")
            docs[pin["name"]] = read_json(data)
    raw = (HERE.parent / "mmp-183/linux-docker-result.json").read_bytes()
    require(hashlib.sha256(raw).hexdigest() == SYNTHETIC_SHA, "SYNTHETIC_PIN_MISMATCH")
    api_bytes = (HERE / "provenance/track-g/source-api.json").read_bytes()
    require(hashlib.sha256(api_bytes).hexdigest() == policy["apiSnapshotSha256"], "SOURCE_API_PIN_MISMATCH")
    api = read_json(api_bytes)
    require(api["run"]["head_sha"] == HEAD and api["run"]["id"] == int(RUN) and api["run"]["run_attempt"] == 1, "SOURCE_API_RUN_MISMATCH")
    require(api["artifact"]["id"] == 13338052015 and api["artifact"]["digest"] == "sha256:" + ZIP_SHA, "SOURCE_API_ARCHIVE_MISMATCH")
    require(all(j["head_sha"] == HEAD and j["conclusion"] == "success" and j["labels"] == ["ubuntu-24.04"] for j in api["jobs"]), "SOURCE_API_JOB_MISMATCH")
    return project(docs, policy, read_json(raw))


if __name__ == "__main__":
    require(len(sys.argv) == 3, "USAGE_PUBLIC_ZIP_OUTPUT_REQUIRED")
    raw = (json.dumps(prepare(sys.argv[1]), indent=2) + "\n").encode()
    Path(sys.argv[2]).write_bytes(raw)
    print(json.dumps(dict(status="GO_PUBLIC_SNAPSHOT", bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), originalMembers=13)))
