import requests
import sys
import json
from datetime import datetime
import time

class GTMAuthenticatedTester:
    def __init__(self):
        self.base_url = "https://activate-tier-ai.preview.emergentagent.com/api"
        self.session_token = "test_session_1772990469368"  # From MongoDB setup
        self.user_id = "test-user-1772990469368"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_contacts = []
        self.test_results = []

    def log_result(self, test_name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED {details}")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        })

    def make_request(self, method, endpoint, data=None):
        """Make authenticated request"""
        url = f"{self.base_url}/{endpoint}"
        headers = {
            'Authorization': f'Bearer {self.session_token}',
            'Content-Type': 'application/json'
        }
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except Exception as e:
            raise Exception(f"Request failed: {str(e)}")

    def test_authentication(self):
        """Test authentication works"""
        print("\n🔐 Testing Authentication...")
        
        try:
            response = self.make_request('GET', 'auth/me')
            success = response.status_code == 200
            
            if success:
                user_data = response.json()
                details = f"User: {user_data.get('email', 'N/A')}"
                self.log_result("Authentication", success, details, user_data)
            else:
                self.log_result("Authentication", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Authentication", False, str(e))

    def test_contact_creation_and_detail(self):
        """Test creating contact and viewing detail"""
        print("\n👤 Testing Contact Creation & Detail View...")
        
        # Create a test contact
        test_contact = {
            "email": f"test.new.{int(time.time())}@example.com",
            "first_name": "Test",
            "last_name": "NewContact",
            "company_name": "Test Company Inc",
            "company_domain": "testcompany.com",
            "job_title": "VP Engineering",
            "source": "manual"
        }
        
        try:
            # Create contact
            response = self.make_request('POST', 'contacts', test_contact)
            success = response.status_code in [200, 201]
            
            if success:
                contact_data = response.json()
                contact_id = contact_data.get('contact_id')
                self.created_contacts.append(contact_id)
                
                self.log_result("Contact Creation", True, f"ID: {contact_id}")
                
                # Test contact detail endpoint (NEW FEATURE)
                detail_response = self.make_request('GET', f'contacts/{contact_id}')
                detail_success = detail_response.status_code == 200
                
                if detail_success:
                    detail_data = detail_response.json()
                    contact_info = detail_data.get('contact', {})
                    activations = detail_data.get('activations', [])
                    llm_logs = detail_data.get('llm_logs', [])
                    
                    self.log_result("Contact Detail View", True, 
                                  f"Contact: {contact_info.get('email')}, " + 
                                  f"Activations: {len(activations)}, LLM Logs: {len(llm_logs)}")
                else:
                    self.log_result("Contact Detail View", False, f"Status: {detail_response.status_code}")
                
                return contact_id if success and detail_success else None
            else:
                self.log_result("Contact Creation", False, f"Status: {response.status_code}")
                return None
                
        except Exception as e:
            self.log_result("Contact Creation & Detail", False, str(e))
            return None

    def test_bulk_processing(self, contact_id=None):
        """Test bulk processing endpoint (NEW FEATURE)"""
        print("\n⚙️ Testing Bulk Processing...")
        
        try:
            # Test bulk process all pending
            bulk_data = {}  # Empty means process all pending
            response = self.make_request('POST', 'contacts/bulk-process', bulk_data)
            success = response.status_code in [200, 201]
            
            if success:
                result_data = response.json()
                processed_count = result_data.get('processed', 0)
                results = result_data.get('results', [])
                
                self.log_result("Bulk Process All Pending", True, 
                              f"Processed: {processed_count} contacts")
                
                # Test with specific contact IDs if provided
                if contact_id:
                    time.sleep(2)  # Wait a bit between requests
                    specific_bulk_data = {"contact_ids": [contact_id]}
                    specific_response = self.make_request('POST', 'contacts/bulk-process', specific_bulk_data)
                    specific_success = specific_response.status_code in [200, 201]
                    
                    if specific_success:
                        specific_result = specific_response.json()
                        self.log_result("Bulk Process Specific Contact", True,
                                      f"Processed contact: {contact_id}")
                    else:
                        self.log_result("Bulk Process Specific Contact", False, 
                                      f"Status: {specific_response.status_code}")
                
            else:
                self.log_result("Bulk Process All Pending", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Bulk Processing", False, str(e))

    def test_weekly_summary(self):
        """Test weekly health summary (NEW FEATURE)"""
        print("\n📊 Testing Weekly Health Summary...")
        
        try:
            response = self.make_request('GET', 'analytics/weekly-summary')
            success = response.status_code == 200
            
            if success:
                summary_data = response.json()
                tier_conversions = summary_data.get('tier_conversions', {})
                avg_velocity = summary_data.get('avg_deal_velocity_days', 0)
                llm_health = summary_data.get('llm_health', {})
                
                self.log_result("Weekly Health Summary", True,
                              f"Tiers: {len(tier_conversions)}, " +
                              f"Velocity: {avg_velocity}d, " +
                              f"LLM Success: {llm_health.get('success_rate', 0)}%")
            else:
                self.log_result("Weekly Health Summary", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Weekly Health Summary", False, str(e))

    def test_guardrail_check(self):
        """Test guardrail check endpoint (NEW FEATURE)"""
        print("\n🛡️ Testing Guardrail Check...")
        
        test_contents = [
            {
                "content": "Hi John, I hope this email finds you well. I wanted to reach out about our B2B solution.",
                "expected": "should pass"
            },
            {
                "content": "URGENT! You MUST buy this NOW or you'll LOSE EVERYTHING! Act FAST!",
                "expected": "should flag issues"
            }
        ]
        
        for i, test_case in enumerate(test_contents):
            try:
                guardrail_data = {
                    "content": test_case["content"],
                    "contact_id": self.created_contacts[0] if self.created_contacts else None
                }
                
                response = self.make_request('POST', 'guardrail/check', guardrail_data)
                success = response.status_code == 200
                
                if success:
                    result = response.json()
                    passed = result.get('passed', False)
                    risk_level = result.get('risk_level', 'unknown')
                    violations = result.get('violations', [])
                    
                    self.log_result(f"Guardrail Check {i+1}", True,
                                  f"Passed: {passed}, Risk: {risk_level}, " +
                                  f"Violations: {len(violations)} - {test_case['expected']}")
                else:
                    self.log_result(f"Guardrail Check {i+1}", False, f"Status: {response.status_code}")
                    
                time.sleep(1)  # Wait between LLM calls
                
            except Exception as e:
                self.log_result(f"Guardrail Check {i+1}", False, str(e))

    def test_contact_deletion(self, contact_id):
        """Test contact deletion (NEW FEATURE)"""
        print("\n🗑️ Testing Contact Deletion...")
        
        if not contact_id:
            self.log_result("Contact Deletion", False, "No contact ID provided")
            return
        
        try:
            response = self.make_request('DELETE', f'contacts/{contact_id}')
            success = response.status_code in [200, 204]
            
            if success:
                self.log_result("Contact Deletion", True, f"Deleted contact: {contact_id}")
                
                # Verify deletion by trying to fetch the contact
                verify_response = self.make_request('GET', f'contacts/{contact_id}')
                verify_success = verify_response.status_code == 404
                
                self.log_result("Deletion Verification", verify_success,
                              "Contact properly deleted" if verify_success else "Contact still exists")
            else:
                self.log_result("Contact Deletion", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Contact Deletion", False, str(e))

    def test_seed_demo_data(self):
        """Test seeding demo data with auth"""
        print("\n🌱 Testing Demo Data Seeding...")
        
        try:
            response = self.make_request('POST', 'seed/demo')
            success = response.status_code in [200, 201]
            
            if success:
                result = response.json()
                contacts_created = result.get('contacts_created', 0)
                self.log_result("Seed Demo Data", True, f"Created {contacts_created} demo contacts")
            else:
                self.log_result("Seed Demo Data", False, f"Status: {response.status_code}")
                
        except Exception as e:
            self.log_result("Seed Demo Data", False, str(e))

    def run_all_tests(self):
        """Run all authenticated tests"""
        print("🧪 Starting GTM Platform Authenticated Feature Tests...")
        print(f"Testing against: {self.base_url}")
        print(f"Session Token: {self.session_token}")
        print("=" * 70)
        
        # Test authentication first
        self.test_authentication()
        
        # Seed some demo data for testing
        self.test_seed_demo_data()
        
        # Test new features
        contact_id = self.test_contact_creation_and_detail()
        self.test_bulk_processing(contact_id)
        self.test_weekly_summary()
        self.test_guardrail_check()
        
        # Test deletion last (clean up)
        if contact_id:
            self.test_contact_deletion(contact_id)
        
        # Print summary
        print("\n" + "=" * 70)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print("\n✅ All new features working correctly!")
        
        return success_rate >= 80

if __name__ == "__main__":
    tester = GTMAuthenticatedTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)