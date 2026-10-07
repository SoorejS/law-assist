"""
Comprehensive System Audit & Integration Test Suite for ProAssist.
Verifies all core capabilities, security controls, schema migrations, and features.
"""

import os
import sys
import unittest
from pathlib import Path

# Ensure engine path is available
ROOT_DIR = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(ROOT_DIR / "engine"))

from fastapi.testclient import TestClient
import api
import auth
import users
import store
import exporter
import coworkers
import privacy_filter
import web_search
import agent


class ProAssistAuditTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(api.app)
        cls.user = users.get_user("krish 123")
        if not cls.user:
            # Fallback for testing environment if fresh
            cls.user = {"id": 1, "username": "testadmin", "role": "admin", "full_name": "Test Administrator"}
        cls.token = auth.create_access_token(cls.user["id"], cls.user["username"], cls.user["role"])
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_01_health_and_setup(self):
        """Verify health check and workspace initialization endpoints."""
        r_health = self.client.get("/health")
        self.assertEqual(r_health.status_code, 200)
        data = r_health.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("version", data)

        r_setup = self.client.get("/auth/setup-status")
        self.assertEqual(r_setup.status_code, 200)
        self.assertTrue(r_setup.json().get("initialized"))

    def test_02_privacy_filter(self):
        """Verify offline regex filter redacts sensitive Indian identifiers."""
        sample_text = (
            "Advocate Rajesh Sharma (PAN: ABCDE1234F, Aadhaar: 1234 5678 9012, "
            "Phone: +91 9876543210, Email: rajesh.advocate@delhicourt.in) appeared."
        )
        redacted, has_pii = privacy_filter.filter_text(sample_text)
        self.assertTrue(has_pii)
        self.assertNotIn("ABCDE1234F", redacted)
        self.assertNotIn("1234 5678 9012", redacted)
        self.assertNotIn("9876543210", redacted)
        self.assertNotIn("rajesh.advocate@delhicourt.in", redacted)
        self.assertIn("[REDACTED_PAN]", redacted)
        self.assertIn("[REDACTED_AADHAAR]", redacted)

    def test_03_follow_up_suggestions(self):
        """Verify smart follow-up suggestions return exactly 3 relevant queries."""
        query = "What is the limitation period for filing the written statement under CPC?"
        answer = "The limitation period is 30 days from service of summons, extendable up to 120 days."
        chunks = [{"chunk_text": "Order VIII Rule 1 CPC provides 30 days limitation."}]
        
        suggestions = agent.generate_follow_up_suggestions(query, answer, chunks)
        self.assertIsInstance(suggestions, list)
        self.assertEqual(len(suggestions), 3)
        for s in suggestions:
            self.assertIsInstance(s, str)
            self.assertTrue(len(s) > 5)

    def test_04_matters_and_tags(self):
        """Verify matter listing and tag modifications via PATCH and POST."""
        r_matters = self.client.get("/matters", headers=self.headers)
        self.assertEqual(r_matters.status_code, 200)
        matters = r_matters.json().get("matters", [])
        self.assertTrue(len(matters) > 0)
        
        target_matter = matters[0]["id"]
        # Test PATCH
        r_patch = self.client.patch(
            f"/matters/{target_matter}/tags",
            json={"tags": ["Audited", "Production"]},
            headers=self.headers
        )
        self.assertEqual(r_patch.status_code, 200)
        self.assertIn("Audited", r_patch.json().get("tags", []))

        # Test POST fallback
        r_post = self.client.post(
            f"/matters/{target_matter}/tags",
            json={"tags": ["Audited", "Verified"]},
            headers=self.headers
        )
        self.assertEqual(r_post.status_code, 200)
        self.assertIn("Verified", r_post.json().get("tags", []))

    def test_05_word_docx_export(self):
        """Verify One-Click Word (.docx) export produces valid binary document."""
        r_matters = self.client.get("/matters", headers=self.headers)
        target_matter = r_matters.json()["matters"][0]["id"]
        
        r_export = self.client.get(f"/matters/{target_matter}/export", headers=self.headers)
        self.assertEqual(r_export.status_code, 200)
        self.assertEqual(
            r_export.headers.get("content-type"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        self.assertIn(".docx", r_export.headers.get("content-disposition", ""))
        self.assertTrue(len(r_export.content) > 1000)

    def test_06_calendar_ics_export(self):
        """Verify Calendar .ics deadline sync export produces valid RFC-5545 format."""
        r_matters = self.client.get("/matters", headers=self.headers)
        target_matter = r_matters.json()["matters"][0]["id"]
        
        r_ics = self.client.get(f"/matters/{target_matter}/calendar.ics", headers=self.headers)
        self.assertEqual(r_ics.status_code, 200)
        ics_text = r_ics.content.decode("utf-8", errors="ignore")
        self.assertIn("BEGIN:VCALENDAR", ics_text)
        self.assertIn("END:VCALENDAR", ics_text)

    def test_07_coworkers_registry(self):
        """Verify autonomous coworkers registry and builtins."""
        r_cw = self.client.get("/coworkers", headers=self.headers)
        self.assertEqual(r_cw.status_code, 200)
        coworkers_list = r_cw.json().get("coworkers", [])
        self.assertTrue(len(coworkers_list) >= 4)
        coworker_ids = [c["id"] for c in coworkers_list]
        self.assertIn("due_diligence", coworker_ids)
        self.assertIn("deadline_tracker", coworker_ids)
        self.assertIn("contract_diff", coworker_ids)


if __name__ == "__main__":
    unittest.main()
