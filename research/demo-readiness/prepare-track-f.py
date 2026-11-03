"""Offline, stdlib-only projection of one reviewed PUBLIC archive. No network/code execution.

Whole ZIP and every member are pinned before JSON parsing. The reviewed object-field
allowlist is an additional privacy boundary, not a general receipt schema or admission.
"""
import hashlib
import json
import math
import re
import sys
import zipfile
from pathlib import Path
from decimal import Decimal

ZIP_SHA = "c860c609444d1d591d68dde6531e85b5c95e9f4cc33af1956500315d5f0b4e5d"
RUN = "41726833705"
HEAD = "f034d4dfcc30dcc82300e93002b5a55206c7dc04"
CANDIDATES = ["329cdcca096461c2357b157f162daec3a4bf2eaaf5b1036a8d62026545b76fa3", "572c6db97f279ac34224e847e8790516fb20bbf50fd6d131aa8ee44b9c68cd03"]
SCENARIOS = ["workshop-business", "workshop-rejected", "workshop-capacity"]
CONTROLS = "http-positive http-key-order http-status-mutant http-type-mutant http-missing-mutant http-order-mutant db-positive db-row-mutant db-sequence-mutant".split()
MEMBERS = [{'name': 'meta-paid-public/generation.json',
  'bytes': 2380,
  'sha256': '0296373d787ea1bb95b5db8e81b61c478a22d33d6ea42b2b63cfd7e9eeb3502b',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/scorecard.json',
  'bytes': 2469,
  'sha256': 'd8a0ad3bae8c413a232c3be1016b2d0860769fa026b9dfd7cd2addb076ce9ea1',
  'format': 'mmp154-generation-scorecard-v1'},
 {'name': 'meta-paid-public/preflight.json',
  'bytes': 2402,
  'sha256': '4bbf47a7d319208f8863cfb268421a9ba78a758618c474c7d42bd0917762cb8e',
  'format': 'mmp154-generation-preflight-v1'},
 {'name': 'meta-paid-public/send-receipts/1.json',
  'bytes': 2158,
  'sha256': 'f4014b263d9d7c4269c31e7026e468adcc70bb759028eb26247a3a1d189c4fce',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/send-receipts/2.json',
  'bytes': 2380,
  'sha256': '0296373d787ea1bb95b5db8e81b61c478a22d33d6ea42b2b63cfd7e9eeb3502b',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/trial.json',
  'bytes': 21549,
  'sha256': 'cd79258c0fd5b2d6f0dddd2fedfb2cd7ef6ba53938f330fe10bf7f03300d73aa',
  'format': 'mmp078-public-paid-trial-v1'},
 {'name': 'meta-paid-public/finalizer.json',
  'bytes': 165,
  'sha256': 'e0c05f52968ef1c67906c282be0b1d622d8bfe4becdab4b17d6838aa6aab43eb',
  'format': None},
 {'name': 'meta-paid-public/preservation.json',
  'bytes': 1020,
  'sha256': '6bd1d91917c8a3339eff13647ce0049a596ce9dd200cdd353cc5ad299dec4658',
  'format': 'mmp097-preservation-v1'},
 {'name': 'meta-paid-public/custody-capture.json',
  'bytes': 655,
  'sha256': '2cf99eeb39b5025822338849d5f9848d86760e8d9e58002a715f5ae7bf686ddf',
  'format': 'mmp115-custody-v1'},
 {'name': 'meta-paid-public/custody-finalizer.json',
  'bytes': 406,
  'sha256': '1669a5e311f7eceb2231ba532ede8b300030483c2e0a14a0de26fd5d64170888',
  'format': 'mmp115-pre-oracle-finalizer-v1'},
 {'name': 'meta-paid-public/custody-checkpoint.json',
  'bytes': 663,
  'sha256': 'da46931ce7eaa93b1e56cb60cfe55cd4c3e2d6df21a954b56b270d75d9180b58',
  'format': 'mmp115-custody-v1'},
 {'name': 'meta-paid-public/custody-stored.json',
  'bytes': 660,
  'sha256': '2343e41ee2f50b84da13cf6731a3c9d332c3df5fd8f813132a55db6b12351250',
  'format': 'mmp115-custody-v1'},
 {'name': 'meta-paid-public/preflight-repair.json',
  'bytes': 2368,
  'sha256': '939ebd5726441e2a698d4d9540a6fbc1c06c4365a1efe5e9f5a6f78d56ee5e09',
  'format': 'mmp154-repair-preflight-v1'},
 {'name': 'meta-paid-public/generation-repair.json',
  'bytes': 2480,
  'sha256': '506501c373697b4cf51c365b14cd09f893ea9aecb21eeb0290a0392bb15a7704',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/trial-repair.json',
  'bytes': 21756,
  'sha256': '9149785b34eace5bba5bb03b753f82545aa47a9c588756344583c27d0b998055',
  'format': 'mmp078-public-repair-trial-v1'},
 {'name': 'meta-paid-public/repair-send-receipts/1.json',
  'bytes': 2256,
  'sha256': 'adc51a1d497d6002143e7137c87ecfe2be2c4454c83aede8b9edd1cbd82892b9',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/scorecard-repair.json',
  'bytes': 2513,
  'sha256': 'd7c9e37f932e670058e2ab10cad1f2ca20fbdce8ae8ab854a81977d52555733c',
  'format': 'mmp154-repair-scorecard-v1'},
 {'name': 'meta-paid-public/repair-send-receipts/2.json',
  'bytes': 2480,
  'sha256': '506501c373697b4cf51c365b14cd09f893ea9aecb21eeb0290a0392bb15a7704',
  'format': 'meta-generation-v1'},
 {'name': 'meta-paid-public/custody-repair-capture.json',
  'bytes': 655,
  'sha256': '468cd72588a435c1749e40e7a2a821310a397ddf57931520d012bbbde5c980fb',
  'format': 'mmp115-custody-v1'},
 {'name': 'meta-paid-public/custody-repair-finalizer.json',
  'bytes': 406,
  'sha256': '0b3d8a8f21f81ab40040f9caee6d47dd0cd74fd374bebe4dc7084d79adfa4517',
  'format': 'mmp115-pre-oracle-finalizer-v1'},
 {'name': 'meta-paid-public/custody-repair-checkpoint.json',
  'bytes': 663,
  'sha256': '0b54f79292013bc9a5f748d0bc61d7ead92c565dcd342cc9902dd7ce789c494c',
  'format': 'mmp115-custody-v1'},
 {'name': 'meta-paid-public/custody-repair-stored.json',
  'bytes': 660,
  'sha256': '37a3a0cf06990c64f3bf5cd2424712720372a06bdd9bd118c4de7a58a7a9b0f0',
  'format': 'mmp115-custody-v1'},
 {'name': 'mmp078-41726833705-attempt.json',
  'bytes': 976,
  'sha256': '35d97fa725dc6d6d8932d0b55209952a1621849c5620ef86e3ee3bce746924a9',
  'format': None},
 {'name': 'mmp078-41726833705-attempt-2.json',
  'bytes': 1070,
  'sha256': 'f6ef99c7a61250997a9fe7bf5ab1204beffcceeb11ab078b2d629e0fb240031b',
  'format': None}]
PUBLIC_FIELDS = {'attempt': ['kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 model tariff '
             'workflowSha256 preflightSha256 maxEstimatedUsd attempt plan firstAttemptCandidateSha method '
             'inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd monetaryCap status '
             'attemptedRequests chargedCostUsd',
             'kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 model tariff '
             'workflowSha256 preflightSha256 maxEstimatedUsd attempt plan method inputTokensUpperEstimate '
             'maxOutputTokens worstCaseEstimatedUsd monetaryCap status attemptedRequests chargedCostUsd'],
 'custody': ['format state verification identity recipientFingerprint ciphertextSha256 ciphertextBytes '
             'collectorCleanup storage'],
 'custody-finalizer': ['format phase identity containers volumes emergencyRemoved'],
 'custody-finalizer.identity': ['runId runAttempt headSha sourceSha candidateSha attemptId'],
 'custody.identity': ['runId runAttempt headSha sourceSha candidateSha attemptId'],
 'finalizer': ['headSha inventory emergencyRemoved status'],
 'finalizer.inventory': ['containers volumes'],
 'generation': ['format sourceSha contextSha256 manifestSha256 policy generationKind operation status code '
                'attempt action modelId modelVersion requestId inputSha256 responseSha256 candidateSha '
                'inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd reportedCostUsd '
                'priceVersion usageStatus durationMs monetaryCap attemptedRequests networkSend '
                'confirmedResponseCount tlsPeerVerified httpStatus authorization',
                'format sourceSha contextSha256 manifestSha256 policy generationKind operation status code '
                'attempt action modelId modelVersion requestId inputSha256 responseSha256 candidateSha '
                'inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd reportedCostUsd '
                'priceVersion usageStatus durationMs monetaryCap attemptedRequests networkSend '
                'confirmedResponseCount tlsPeerVerified httpStatus authorization provider'],
 'generation.authorization': ['kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 '
                              'model tariff workflowSha256 preflightSha256 maxEstimatedUsd attempt plan '
                              'firstAttemptCandidateSha method inputTokensUpperEstimate maxOutputTokens '
                              'worstCaseEstimatedUsd monetaryCap',
                              'kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 '
                              'model tariff workflowSha256 preflightSha256 maxEstimatedUsd attempt plan '
                              'method inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd '
                              'monetaryCap'],
 'preflight': ['format repository headSha workflowPath workflowSha256 actor actorId sourceSha '
               'sourceArchiveSha256 contextSha256 manifestSha256 model mode tariff requestBodySha256 '
               'requestBytes method inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd '
               'maxEstimatedUsd attempt action repairFeedbackCodes firstAttemptEstimatedUsd '
               'firstAttemptCandidateSha aggregateWorstCaseEstimatedUsd maximumPosts maximumRepairs '
               'automaticRetries monetaryCap providerBilling accountCreditTerms accountBalanceUsd '
               'availableCreditUsd chargedCostUsd timeoutExposure confirmation initiator admission sha256',
               'format repository headSha workflowPath workflowSha256 actor actorId sourceSha '
               'sourceArchiveSha256 contextSha256 manifestSha256 model mode tariff requestBodySha256 '
               'requestBytes method inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd '
               'maxEstimatedUsd maximumPosts maximumRepairs plan repairWireBytes repairProjection '
               'aggregateWorstCaseEstimatedUsd automaticRetries monetaryCap providerBilling '
               'accountCreditTerms accountBalanceUsd availableCreditUsd chargedCostUsd timeoutExposure '
               'confirmation initiator admission sha256'],
 'preflight.repairProjection': ['method inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd'],
 'preflight.tariff': ['version verifiedOn expires documentationUrl billingUrl capUrl model mode '
                      'inputPerMillion cachedPerMillion outputPerMillion'],
 'preservation': ['format status identity recipientFingerprint ageVersion ageSha256 ciphertextSha256 '
                  'ciphertextBytes plaintextStaging collectorCleanup upload'],
 'preservation.identity': ['runId runAttempt headSha sourceSha candidateSha attemptId pairId case '
                           'bindingsSha256'],
 'scorecard': ['format evidenceBasis execution repository runId headSha workflowSha256 preflightSha256 '
               'sourceSha model providerModel attempt action repairFeedbackCodes generationStatus '
               'generationCode mode maximumPosts attemptedRequests requestBodySha256 responseSha256 '
               'candidateSha firstAttempt inputTokens outputTokens cachedInputTokens '
               'projectedUpperEstimateUsd firstAttemptEstimatedUsd aggregateWorstCaseEstimatedUsd '
               'observedEstimatedCostUsd chargedCostUsd monetaryCap accountBalanceUsd usageStatus publicG1 '
               'publicG2 publicG3 coverage custody cleanup outcome stopReason repairs G0 G4 product',
               'format evidenceBasis execution repository runId headSha workflowSha256 preflightSha256 '
               'sourceSha model providerModel generationStatus generationCode mode tariff maximumPosts '
               'attemptedRequests confirmedResponses networkSend requestBodySha256 responseSha256 '
               'candidateSha inputTokens outputTokens cachedInputTokens projectedUpperEstimateUsd '
               'observedEstimatedCostUsd chargedCostUsd monetaryCap accountBalanceUsd usageStatus publicG1 '
               'publicG2 publicG3 coverage custody cleanup outcome stopReason publicFindingCodes repairs G0 '
               'G4 product'],
 'scorecard.cleanup': ['normal independent'],
 'scorecard.coverage': ['http requiredHttp sqlite requiredSqlite',
                        'http requiredHttp sqlite requiredSqlite gateCounts'],
 'scorecard.coverage.gateCounts': ['G1 G2 G3 G4'],
 'scorecard.custody': ['status artifactId archiveSha256 ciphertextSha256'],
 'scorecard.firstAttempt': ['candidateSha bound estimatedCostUsd'],
 'scorecard.outcome': ['status publicVerdict complete feedbackCodes repair code'],
 'trial': ['format headSha sourceSha sourceArchiveSha256 contextSha256 manifestSha256 provider modelId '
           'budgetAuth admittedMaxRequestCostUsd modelGeneration aiGeneration publicG1 publicG2 publicG3 G0 '
           'G4 product trialRunId candidateSha totalCostUsd generatedRequests attempts cleanup blockers '
           'admittedMaxEstimatedRequestCostUsd custody modelReceipts estimatedCostUsd chargedCostUsd '
           'custodyLink validationOutcome'],
 'trial.attempts[]': ['attemptId candidateSha gates coverage pairs'],
 'trial.attempts[].coverage': ['http sqlite requiredHttp requiredSqlite'],
 'trial.attempts[].gates[]': ['gate verdict executedTestIds findingCodes'],
 'trial.attempts[].pairs[]': ['scenarioId pairId packs cleanup targetLifetimePolicyMs compilerDiagnostics '
                              'failureTelemetry gates'],
 'trial.attempts[].pairs[].compilerDiagnostics': ['format sourceSha candidateSha attemptId pairId g1Verdict '
                                                  'status entries errorCount truncated'],
 'trial.attempts[].pairs[].failureTelemetry': ['format scope status unavailableReason binding scenarioIndex '
                                               'stepIndex firstFailureStage failureCategory '
                                               'lastCompletedStage cleanupFailures truncated'],
 'trial.attempts[].pairs[].failureTelemetry.binding': ['runId headSha sourceSha candidateSha attemptId '
                                                       'pairId'],
 'trial.attempts[].pairs[].gates[]': ['gate verdict executedTestIds findingCodes'],
 'trial.attempts[].pairs[].packs[]': ['id sha256'],
 'trial.budgetAuth': ['kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 model '
                      'tariff workflowSha256 preflightSha256 maxEstimatedUsd attempt plan '
                      'firstAttemptCandidateSha method inputTokensUpperEstimate maxOutputTokens '
                      'worstCaseEstimatedUsd monetaryCap',
                      'kind actor runId headSha sourceSha contextSha256 manifestSha256 bodySha256 model '
                      'tariff workflowSha256 preflightSha256 maxEstimatedUsd attempt plan method '
                      'inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd monetaryCap'],
 'trial.cleanup': ['status containers volumes emergencyRemoved'],
 'trial.custody': ['format state verification identity recipientFingerprint ciphertextSha256 ciphertextBytes '
                   'collectorCleanup storage'],
 'trial.custody.identity': ['runId runAttempt headSha sourceSha candidateSha attemptId'],
 'trial.custodyLink': ['format verification identity verifierAttemptIds'],
 'trial.custodyLink.identity': ['runId runAttempt headSha sourceSha candidateSha attemptId'],
 'trial.modelReceipts[]': ['format sourceSha contextSha256 manifestSha256 policy generationKind operation '
                           'status code attempt action modelId modelVersion requestId inputSha256 '
                           'responseSha256 candidateSha inputTokens outputTokens cachedInputTokens '
                           'estimatedCostUsd chargedCostUsd reportedCostUsd priceVersion usageStatus '
                           'durationMs monetaryCap attemptedRequests networkSend confirmedResponseCount '
                           'tlsPeerVerified httpStatus authorization provider'],
 'trial.modelReceipts[].authorization': ['kind actor runId headSha sourceSha contextSha256 manifestSha256 '
                                         'bodySha256 model tariff workflowSha256 preflightSha256 '
                                         'maxEstimatedUsd attempt plan firstAttemptCandidateSha method '
                                         'inputTokensUpperEstimate maxOutputTokens worstCaseEstimatedUsd '
                                         'monetaryCap',
                                         'kind actor runId headSha sourceSha contextSha256 manifestSha256 '
                                         'bodySha256 model tariff workflowSha256 preflightSha256 '
                                         'maxEstimatedUsd attempt plan method inputTokensUpperEstimate '
                                         'maxOutputTokens worstCaseEstimatedUsd monetaryCap'],
 'trial.validationOutcome': ['status publicVerdict complete feedbackCodes repair code']}

def require(condition, code):
    if not condition:
        raise ValueError(code)

def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result and key not in ["__proto__", "prototype", "constructor"], "UNSAFE_JSON_KEYS")
        result[key] = value
    return result

def audit_public(value, path):
    if isinstance(value, dict):
        require(path in PUBLIC_FIELDS and frozenset(value) in [frozenset(s.split()) for s in PUBLIC_FIELDS[path]], "NON_PUBLIC_FIELD_SET")
        for key, item in value.items():
            audit_public(item, path + "." + key)
    elif isinstance(value, list):
        require(len(value) <= 100, "PUBLIC_ARRAY_LIMIT")
        for item in value:
            audit_public(item, path + "[]")
    elif isinstance(value, str):
        require(len(value) <= 512 and re.fullmatch(r"[A-Za-z0-9_.:/ -]+", value), "UNSAFE_PUBLIC_VALUE")
        require(not re.search(r"(?i)(AGE-SECRET-KEY|BEGIN PRIVATE|bearer |[a-z]:\\|/(?:home|tmp|Users)/)", value), "UNSAFE_PUBLIC_VALUE")
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        require(math.isfinite(value) and 0 <= value <= 2**53 - 1, "UNSAFE_PUBLIC_NUMBER")
    else:
        require(value is None or isinstance(value, bool), "UNSAFE_PUBLIC_TYPE")

def family(name):
    base = name.rsplit("/", 1)[-1]
    if "generation" in base or "/send-receipts/" in name or "/repair-send-receipts/" in name:
        return "generation"
    for word in ["trial", "preflight", "scorecard"]:
        if word in base:
            return word
    if "custody" in base:
        return "custody-finalizer" if "finalizer" in base else "custody"
    for word in ["preservation", "finalizer"]:
        if word in base:
            return word
    return "attempt"

def gate(identifier, verdict, executed, findings):
    return dict(gate=identifier, verdict=verdict, executedTestIds=executed, findingCodes=findings)

def validate_trial(g, t):
    auth = g["authorization"]
    require(t["budgetAuth"] == auth and t["modelReceipts"] == [g], "GENERATION_TRIAL_LINK_MISMATCH")
    require(auth["runId"] == t["trialRunId"] == RUN and auth["headSha"] == t["headSha"] == HEAD, "RUN_HEAD_MISMATCH")
    for key in ["sourceSha", "contextSha256", "manifestSha256"]:
        require(g[key] == t[key] == auth[key], "SOURCE_LINK_MISMATCH")
    require(g["candidateSha"] == t["candidateSha"] == CANDIDATES[g["attempt"] - 1], "CANDIDATE_LINK_MISMATCH")
    require(g["inputSha256"] == auth["bodySha256"] and len(t["attempts"]) == 1, "REQUEST_LINK_MISMATCH")
    a = t["attempts"][0]
    require(a["candidateSha"] == g["candidateSha"] and t["custodyLink"]["verifierAttemptIds"] == [a["attemptId"]], "ORACLE_LINK_MISMATCH")
    require(t["product"] == "NOT_ESTABLISHED" and t["chargedCostUsd"] is None, "PRODUCT_OR_COST_MISMATCH")
    require(t["estimatedCostUsd"] == g["estimatedCostUsd"] and t["generatedRequests"] == 1, "USAGE_LINK_MISMATCH")
    require([t[k] for k in ["G0", "publicG1", "publicG2", "publicG3", "G4"]] == ["INCONCLUSIVE", "PASS", "FAIL", "FAIL", "INCONCLUSIVE"], "TOP_LEVEL_GATE_MISMATCH")
    require(a["coverage"] == dict(http=17, sqlite=20, requiredHttp=17, requiredSqlite=20), "COVERAGE_MISMATCH")
    steps = lambda sid, n: [f"{sid}:step-{i}" for i in range(n)]
    builds = [f"{sid}:{kind}" for sid in SCENARIOS for kind in ["typecheck", "build"]]
    http = [s for sid, n in zip(SCENARIOS, [6, 5, 6]) for s in steps(sid, n)]
    sqlite = [s for sid, n in zip(SCENARIOS, [6, 5, 6]) for s in [f"{sid}:initial", *steps(sid, n)]]
    controls = [f"{sid}:{c}" for sid in SCENARIOS for c in CONTROLS]
    expected = [gate("G0", "INCONCLUSIVE", [], ["G0_NOT_ESTABLISHED"]), gate("G1", "PASS", builds, []), gate("G2", "FAIL", http, ["HTTP_JSON_TYPE"]), gate("G3", "FAIL", sqlite, ["HTTP_JSON_TYPE"]), gate("G4", "INCONCLUSIVE", controls, ["HELD_OUT_NOT_RUN"])]
    require(a["gates"] == expected, "AGGREGATE_GATE_MISMATCH")
    require([p["scenarioId"] for p in a["pairs"]] == SCENARIOS, "SCENARIO_ORDER_MISMATCH")
    for index, (p, n) in enumerate(zip(a["pairs"], [6, 5, 6])):
        sid = SCENARIOS[index]
        d, b = p["compilerDiagnostics"], p["failureTelemetry"]["binding"]
        for key, expected_value in dict(sourceSha=t["sourceSha"], candidateSha=g["candidateSha"], attemptId=a["attemptId"], pairId=p["pairId"]).items():
            require(d[key] == b[key] == expected_value, "PAIR_LINK_MISMATCH")
        require(b["runId"] == RUN and b["headSha"] == HEAD and d["g1Verdict"] == "PASS", "PAIR_BUILD_MISMATCH")
        verdict, codes = ("PASS", []) if index == 2 else ("FAIL", ["HTTP_JSON_TYPE"])
        require(p["gates"] == [gate("G2", verdict, steps(sid, n), codes), gate("G3", verdict, [f"{sid}:initial", *steps(sid, n)], codes), gate("G4", "INCONCLUSIVE", CONTROLS, ["HELD_OUT_NOT_RUN"])], "SCENARIO_GATE_MISMATCH")
        require(p["cleanup"] == "VERIFIED_ZERO_RESOURCES", "CLEANUP_MISMATCH")
    require(t["cleanup"] == dict(status="VERIFIED_ZERO_RESOURCES", containers=0, volumes=0, emergencyRemoved=0), "CLEANUP_MISMATCH")
    return a

def prepare(archive):
    raw_zip = Path(archive).read_bytes()
    require(len(raw_zip) == 28147 and hashlib.sha256(raw_zip).hexdigest() == ZIP_SHA, "PUBLIC_ZIP_PIN_MISMATCH")
    docs = {}
    with zipfile.ZipFile(archive) as source:
        require(source.namelist() == [m["name"] for m in MEMBERS], "PUBLIC_MEMBER_SET_MISMATCH")
        for pin in MEMBERS:
            raw = source.read(pin["name"])
            require(len(raw) == pin["bytes"] and hashlib.sha256(raw).hexdigest() == pin["sha256"], "PUBLIC_MEMBER_PIN_MISMATCH")
            item = json.loads(raw.decode("utf8"), object_pairs_hook=pairs, parse_constant=lambda _: require(False, "NONFINITE_JSON"))
            require(item.get("format") == pin["format"], "PUBLIC_FORMAT_MISMATCH")
            audit_public(item, family(pin["name"]))
            docs[pin["name"]] = item
    get = lambda name: docs["meta-paid-public/" + name]
    attempts = []
    fields = "status generationKind provider modelId attemptedRequests confirmedResponseCount httpStatus networkSend tlsPeerVerified inputTokens outputTokens cachedInputTokens estimatedCostUsd chargedCostUsd usageStatus".split()
    for number, suffix, action in [(1, "", "generate"), (2, "-repair", "repair")]:
        g, t, pre = [get(name + suffix + ".json") for name in ["generation", "trial", "preflight"]]
        require(g["attempt"] == number and g["action"] == action, "ATTEMPT_ORDER_MISMATCH")
        a = validate_trial(g, t)
        for key in ["headSha", "sourceSha", "sourceArchiveSha256", "contextSha256", "manifestSha256"]:
            require(pre[key] == t[key] == get("trial.json")[key], "PREFLIGHT_SOURCE_MISMATCH")
        prefix = "custody-repair" if number == 2 else "custody"
        capture = get(prefix + "-capture.json")
        identity = capture["identity"]
        require(t["custody"] == capture and t["custodyLink"]["identity"] == identity, "CUSTODY_TRIAL_LINK_MISMATCH")
        require(all(identity[k] == v for k, v in dict(runId=RUN, runAttempt="1", headSha=HEAD, sourceSha=t["sourceSha"], candidateSha=g["candidateSha"]).items()), "CUSTODY_IDENTITY_MISMATCH")
        for stage, state, storage in [("capture", "CAPTURED_UNVERIFIED", "NOT_ESTABLISHED"), ("checkpoint", "CHECKPOINT_READY_UNVERIFIED", "NOT_ESTABLISHED"), ("stored", "STORED_UNVERIFIED", "ACKNOWLEDGED_RETRIEVED")]:
            c = get(prefix + "-" + stage + ".json")
            require(c["identity"] == identity and c["state"] == state and c["verification"] == "UNVERIFIED" and c["storage"] == storage and c["ciphertextSha256"] == capture["ciphertextSha256"] and c["collectorCleanup"] == "VERIFIED_ZERO_RESOURCES", "CUSTODY_STAGE_MISMATCH")
        c = get(prefix + "-finalizer.json")
        require(c["identity"] == identity and c["phase"] == "PRE_ORACLE" and all(c[k] == 0 for k in ["containers", "volumes", "emergencyRemoved"]), "PRE_ORACLE_FINALIZER_MISMATCH")
        card = get("scorecard" + suffix + ".json")
        require(all(card[k] == g[v] for k, v in dict(candidateSha="candidateSha", requestBodySha256="inputSha256", responseSha256="responseSha256").items()), "SCORECARD_IDENTITY_MISMATCH")
        ledger = docs[f"mmp078-{RUN}-attempt{'-2' if number == 2 else ''}.json"]
        require(all(ledger[k] == v for k, v in g["authorization"].items()), "LEDGER_LINK_MISMATCH")
        require(pre["requestBodySha256"] == g["inputSha256"] and pre["sha256"] == g["authorization"]["preflightSha256"], "PREFLIGHT_LINK_MISMATCH")
        send = "repair-send-receipts" if number == 2 else "send-receipts"
        require(get(send + "/2.json") == g, "FINAL_SEND_RECEIPT_MISMATCH")
        preliminary = get(send + "/1.json")
        require(preliminary["authorization"] == g["authorization"] and preliminary["confirmedResponseCount"] == 0 and preliminary["networkSend"] == "UNKNOWN", "PRELIMINARY_RECEIPT_MISMATCH")
        attempts.append(dict(
            attempt=number, action=action,
            candidateSha256=g["candidateSha"], requestSha256=g["inputSha256"],
            responseSha256=g["responseSha256"], oracleAttemptId=a["attemptId"],
            generation={k:g[k] for k in fields}, gates=a["gates"], coverage=a["coverage"],
            scenarios=[dict(scenarioId=p["scenarioId"],
                            g1Verdict=p["compilerDiagnostics"]["g1Verdict"],
                            gates=p["gates"], cleanup=p["cleanup"]) for p in a["pairs"]],
            cleanup=t["cleanup"],
        ))
    repair = get("preflight-repair.json")
    require(repair["firstAttemptCandidateSha"] == get("generation-repair.json")["authorization"]["firstAttemptCandidateSha"] == CANDIDATES[0], "REPAIR_PRIOR_CANDIDATE_MISMATCH")
    require(repair["repairFeedbackCodes"] == "HTTP_JSON_TYPE", "REPAIR_FEEDBACK_MISMATCH")
    require(get("scorecard.json")["maximumPosts"] == 1 and get("scorecard.json")["stopReason"] == "PUBLIC_FAIL_SIGNED_REPAIR_NOT_IMPLEMENTED" and get("preflight.json")["maximumPosts"] == 2, "HISTORICAL_REPORTING_MISMATCH")
    final = get("scorecard-repair.json")
    require(final["stopReason"] == "COMPLETE_PUBLIC_FAIL_AFTER_SIGNED_REPAIR" and final["candidateSha"] == CANDIDATES[1] and final["firstAttempt"]["candidateSha"] == CANDIDATES[0], "FINAL_REPORT_LINK_MISMATCH")
    f = get("finalizer.json")
    require(f == dict(headSha=HEAD, inventory=dict(containers=0, volumes=0), emergencyRemoved=0, status="PASS"), "FINALIZER_MISMATCH")
    t = get("trial.json")
    return dict(
        format="mmp162-public-repair-v1", scope="RECORDED_PUBLIC_MANIFEST",
        provenance=dict(
            runId=RUN, runAttempt=1, runStartedAt="2026-11-03T22:00:07Z",
            workflowConclusion="success", headSha=HEAD,
            sourceRepository="tanjilaafsarirubina/car-workshop", sourceSha=t["sourceSha"],
            sourceArchiveSha256=t["sourceArchiveSha256"], contextSha256=t["contextSha256"],
            manifestSha256=t["manifestSha256"], artifactId="13274647279",
            artifactName="meta-paid-public-41726833705", zipBytes=len(raw_zip),
            zipSha256=ZIP_SHA, members=MEMBERS,
        ),
        attempts=attempts,
        repairLink=dict(previousCandidateSha256=repair["firstAttemptCandidateSha"],
                        feedbackCodes=[repair["repairFeedbackCodes"]]),
        reporting=dict(basis="PER_ATTEMPT_GENERATION_TRIAL",
                       intermediateScorecard="NONFINAL_INCONSISTENT_EXCLUDED",
                       finalStopReason=final["stopReason"]),
        usage=dict(confirmedResponses=2,
                   estimatedCostUsd=float(sum(Decimal(str(a["generation"]["estimatedCostUsd"])) for a in attempts)),
                   chargedCostUsd=None, usageStatus="ESTIMATE_ONLY"),
        finalizer=dict(status=f["status"], **f["inventory"], emergencyRemoved=f["emergencyRemoved"]),
        aggregateOutcome="UNCHANGED_PUBLIC_VERDICT_PATTERN", perStepImprovements="UNKNOWN",
        rootCause="UNCONFIRMED", heldOut="NOT_RUN", product="NOT_ESTABLISHED",
    )


if __name__ == "__main__":
    require(len(sys.argv) == 3, "USAGE_PUBLIC_ZIP_OUTPUT_REQUIRED")
    raw = (json.dumps(prepare(sys.argv[1]), indent=2, ensure_ascii=False) + "\n").encode("utf8")
    Path(sys.argv[2]).write_bytes(raw)
    print(json.dumps(dict(status="GO_PUBLIC_SNAPSHOT", bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(), originalMembers=24, scope="snapshot identity; no Oracle rerun")))
