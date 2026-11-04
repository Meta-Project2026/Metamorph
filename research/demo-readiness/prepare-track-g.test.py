import copy
import hashlib
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("prepare_g", HERE / "prepare-track-g.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


class PublicSource(unittest.TestCase):
    def setUp(self):
        self.archive = HERE / "provenance/track-g/public-receipts.zip"
        self.policy = json.loads((HERE / "provenance/track-g/source-pins.json").read_bytes())
        self.synthetic = json.loads((HERE.parent / "mmp-183/linux-docker-result.json").read_bytes())
        with zipfile.ZipFile(self.archive) as z:
            self.docs = {n: json.loads(z.read(n)) for n in z.namelist()}

    def test_exact_projection(self):
        raw = (json.dumps(g.prepare(self.archive), indent=2) + "\n").encode()
        self.assertEqual(raw, (HERE / "evidence/real-ai-41856569137/mmp194-track-g-v1.json").read_bytes())
        self.assertEqual(hashlib.sha256(raw).hexdigest(), "91631e07609bf344b3919eff61fc385a011e5c1a80e504ce1e548d1ed5dd83f5")

    def test_wrong_original_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wrong.zip"
            path.write_bytes(self.archive.read_bytes() + b"x")
            with self.assertRaisesRegex(ValueError, "PUBLIC_ZIP_PIN_MISMATCH"):
                g.prepare(path)

    def test_source_semantics_independent_of_pins(self):
        cases = [
            ("meta-paid-public/trial.json", lambda t: t.update(trialRunId="wrong")),
            ("meta-paid-public/trial.json", lambda t: t.update(candidateSha="0" * 64)),
            ("meta-paid-public/trial.json", lambda t: t.update(product="PASS")),
            ("meta-paid-public/trial.json", lambda t: t.update(G4="PASS")),
            ("meta-paid-public/trial.json", lambda t: t["attempts"][0]["gates"][2].update(verdict="FAIL")),
            ("meta-paid-public/trial.json", lambda t: t["attempts"][0]["gates"][3].update(verdict="INCONCLUSIVE")),
            ("meta-paid-public/trial.json", lambda t: t["attempts"][0]["gates"][2]["executedTestIds"].pop()),
            ("meta-paid-public/trial.json", lambda t: t["attempts"][0]["pairs"][0]["gates"][0].update(verdict="FAIL")),
            ("meta-paid-public/trial.json", lambda t: t["attempts"][0]["pairs"][0]["failureTelemetry"]["binding"].update(headSha="wrong")),
            ("meta-paid-public/scorecard.json", lambda t: t.update(publicG3="FAIL")),
            ("meta-paid-public/scorecard.json", lambda t: t.update(repairs=1)),
            ("meta-paid-public/finalizer.json", lambda t: t["inventory"].update(containers=1)),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                docs = copy.deepcopy(self.docs)
                mutate(docs[name])
                with self.assertRaises(ValueError):
                    g.project(docs, self.policy, self.synthetic)

    def test_no_synthetic_candidate_fusion(self):
        self.synthetic["observations"][-1]["candidateSha"] = g.CANDIDATE
        with self.assertRaisesRegex(ValueError, "SYNTHETIC_MIXING_FORBIDDEN"):
            g.project(self.docs, self.policy, self.synthetic)


if __name__ == "__main__":
    unittest.main()
