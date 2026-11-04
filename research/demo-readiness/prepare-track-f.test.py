"""Offline stdlib tests: retained public ZIP, deterministic bytes, privacy and linkage."""
import copy
import hashlib
import importlib.util
import json
import tempfile
import sys
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("track_f", ROOT / "prepare-track-f.py")
f = importlib.util.module_from_spec(spec)
sys.dont_write_bytecode = True
spec.loader.exec_module(f)
ARCHIVE = ROOT / "provenance/track-f/public-receipts.zip"
PROJECTED = ROOT / "evidence/real-ai-41726833705/mmp162-track-f-v1.json"

class PublicProjection(unittest.TestCase):
    def test_original_and_all_24_members_and_reproduction(self):
        raw = (json.dumps(f.prepare(ARCHIVE), indent=2, ensure_ascii=False) + "\n").encode("utf8")
        self.assertEqual(raw, PROJECTED.read_bytes())
        self.assertEqual(raw, (json.dumps(f.prepare(ARCHIVE), indent=2, ensure_ascii=False) + "\n").encode("utf8"))
        self.assertEqual(len(f.MEMBERS), 24)

    def test_substituted_zip(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad.zip"
            raw = bytearray(ARCHIVE.read_bytes()); raw[100] ^= 1; path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "PUBLIC_ZIP_PIN_MISMATCH"):
                f.prepare(path)

    def test_member_pin_is_independent(self):
        for index in range(24):
            with self.subTest(member=index):
                members = copy.deepcopy(f.MEMBERS); members[index]["sha256"] = "0" * 64
                with patch.object(f, "MEMBERS", members), self.assertRaisesRegex(ValueError, "PUBLIC_MEMBER_PIN_MISMATCH"):
                    f.prepare(ARCHIVE)

    def test_member_set_and_order(self):
        for members in [f.MEMBERS[:-1], list(reversed(f.MEMBERS))]:
            with patch.object(f, "MEMBERS", members), self.assertRaisesRegex(ValueError, "PUBLIC_MEMBER_SET_MISMATCH"):
                f.prepare(ARCHIVE)

    def test_private_fields_rejected_before_projection(self):
        with zipfile.ZipFile(ARCHIVE) as z:
            original = json.loads(z.read("meta-paid-public/generation.json"))
        for key in ["secret", "candidateSource", "rawResponse", "observations", "privateDiagnostics"]:
            with self.subTest(key=key):
                value = copy.deepcopy(original); value[key] = "CANARY"
                with self.assertRaisesRegex(ValueError, "NON_PUBLIC_FIELD_SET"):
                    f.audit_public(value, "generation")
        original["modelId"] = "<script>CANARY</script>"
        with self.assertRaisesRegex(ValueError, "UNSAFE_PUBLIC_VALUE"):
            f.audit_public(original, "generation")

    def test_duplicate_and_prototype_keys(self):
        for raw in ['{"a":1,"a":2}', '{"__proto__":{}}', '{"constructor":{}}']:
            with self.assertRaisesRegex(ValueError, "UNSAFE_JSON_KEYS"):
                json.loads(raw, object_pairs_hook=f.pairs)

    def test_broken_generation_trial_links(self):
        with zipfile.ZipFile(ARCHIVE) as z:
            g = json.loads(z.read("meta-paid-public/generation-repair.json"))
            t = json.loads(z.read("meta-paid-public/trial-repair.json"))
        for mutate in [lambda v: v.update(candidateSha="0" * 64), lambda v: v.update(trialRunId="1"), lambda v: v["attempts"][0]["gates"][2].update(verdict="PASS"), lambda v: v["attempts"][0]["pairs"][2]["gates"][1].update(verdict="FAIL"), lambda v: v["attempts"][0]["pairs"][0]["compilerDiagnostics"].update(candidateSha="0" * 64)]:
            value = copy.deepcopy(t); mutate(value)
            with self.assertRaises(ValueError):
                f.validate_trial(g, value)

if __name__ == "__main__":
    unittest.main()
