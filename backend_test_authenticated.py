import requests
import sys
import json
from datetime import datetime
import time

class AuthenticatedGTMTester:
    def __init__(self, base_url="https://activate-tier-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_token = "test_session_1772989519546"  # From MongoDB setup
        self.user_id = "test-user-1772989519546"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_contacts = []

    def log_test(self, name, success, message=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {message}")
        else:
            print(f"❌ {name}: FAILED {message}")
        return success

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=default_headers, timeout=30)
            else:
                return self.log_test(name, False, f"Unsupported method: {method}")

            success = response.status_code == expected_status
            message = f"Status: {response.status_code}"
            if not success:
                message += f" (Expected: {expected_status})"
                try:
                    error_detail = response.json()
                    message += f" - {error_detail.get('detail', '')}"
                except:
                    message += f" - {response.text[:100]}"

            result = self.log_test(name, success, message)
            return result, response.json() if success and response.content else {}

        except Exception as e:
            return self.log_test(name, False, f"Error: {str(e)}"), {}

    def test_auth(self):
        """Test authenticated endpoints"""
        print(f"\n🔍 Testing Authentication...")
        
        success, user_data = self.run_test("Get current user", "GET", "auth/me", 200)
        if success and user_data:
            print(f"   📝 Authenticated as: {user_data.get('name')} ({user_data.get('email')})")
        
        return success

    def test_contacts_crud(self):
        """Test full contacts CRUD operations"""
        print(f"\n🔍 Testing Contacts CRUD...")
        
        # Get existing contacts
        success, contacts = self.run_test("Get contacts", "GET", "contacts", 200)
        if success:
            print(f"   📝 Found {len(contacts)} existing contacts")
        
        # Create a new contact
        test_contact = {
            "email": f"test{int(time.time())}@example.com",
            "first_name": "Test",
            "last_name": "Contact",
            "company_name": "Test Corp",
            "company_domain": "testcorp.com",
            "job_title": "VP Engineering",
            "source": "manual"
        }
        
        success, create_response = self.run_test("Create contact", "POST", "contacts", 200, test_contact)
        if success and 'contact_id' in create_response:
            contact_id = create_response['contact_id']
            self.created_contacts.append(contact_id)
            print(f"   📝 Created contact: {contact_id}")
            return contact_id
        
        return None

    def test_contact_enrichment(self, contact_id):
        """Test contact enrichment with LLM"""
        print(f"\n🔍 Testing Contact Enrichment...")
        
        success, enrich_response = self.run_test(
            "Enrich contact", "POST", f"contacts/{contact_id}/enrich", 200
        )
        
        if success and 'enrichment_data' in enrich_response:
            enrichment = enrich_response['enrichment_data']
            print(f"   📝 Enrichment result:")
            print(f"      - Company Size: {enrichment.get('company_size', 'N/A')}")
            print(f"      - Industry: {enrichment.get('industry', 'N/A')}")
            print(f"      - ICP Signal: {enrichment.get('icp_signal', 'N/A')}")
            print(f"      - Decision Level: {enrichment.get('decision_maker_level', 'N/A')}")
            
            # Wait a moment for the enrichment to be processed
            time.sleep(2)
        
        return success

    def test_contact_scoring(self, contact_id):
        """Test contact scoring with LLM"""
        print(f"\n🔍 Testing Contact Scoring...")
        
        success, score_response = self.run_test(
            "Score contact", "POST", f"contacts/{contact_id}/score", 200
        )
        
        if success and 'score' in score_response:
            print(f"   📝 Scoring result:")
            print(f"      - Score: {score_response.get('score')}")
            print(f"      - Tier: {score_response.get('tier')}")
            print(f"      - Reasoning: {score_response.get('reasoning', 'N/A')[:100]}...")
            
            # Wait for processing
            time.sleep(2)
        
        return success

    def test_full_pipeline(self, contact_id):
        """Test full pipeline processing (enrich + score + activate)"""
        print(f"\n🔍 Testing Full Pipeline Processing...")
        
        success, pipeline_response = self.run_test(
            "Process full pipeline", "POST", f"contacts/{contact_id}/process", 200
        )
        
        if success:
            print(f"   📝 Pipeline result:")
            print(f"      - Final Score: {pipeline_response.get('score')}")
            print(f"      - Tier: {pipeline_response.get('tier')}")
            print(f"      - Status: {pipeline_response.get('status')}")
            if pipeline_response.get('email_variants'):
                print(f"      - Email variants generated: {len(pipeline_response['email_variants'])}")
            
            # Wait for processing to complete
            time.sleep(3)
        
        return success

    def test_analytics(self):
        """Test analytics endpoints"""
        print(f"\n🔍 Testing Analytics...")
        
        analytics_endpoints = [
            ("Dashboard analytics", "analytics/dashboard"),
            ("Funnel analytics", "analytics/funnel"),
            ("Scoring analytics", "analytics/scoring"), 
            ("LLM analytics", "analytics/llm"),
            ("Attribution analytics", "analytics/attribution")
        ]
        
        all_success = True
        for name, endpoint in analytics_endpoints:
            success, data = self.run_test(name, "GET", endpoint, 200)
            if success:
                # Print some key metrics
                if 'contacts' in data:
                    print(f"      - Total contacts: {data['contacts'].get('total', 0)}")
                if 'llm' in data:
                    print(f"      - LLM calls today: {data['llm'].get('calls_today', 0)}")
            if not success:
                all_success = False
        
        return all_success

    def test_seed_demo_data(self):
        """Test seeding demo data"""
        print(f"\n🔍 Testing Seed Demo Data...")
        
        success, seed_response = self.run_test("Seed demo data", "POST", "seed/demo", 200)
        if success and 'contacts_created' in seed_response:
            print(f"   📝 Created {seed_response['contacts_created']} demo contacts")
        
        return success

    def test_activation_logs(self):
        """Test activation logs"""
        print(f"\n🔍 Testing Activation Logs...")
        
        success, logs = self.run_test("Get activation logs", "GET", "activations", 200)
        if success:
            print(f"   📝 Found {len(logs)} activation logs")
        
        return success

    def run_comprehensive_test(self):
        """Run comprehensive authenticated test suite"""
        print(f"🚀 Starting Authenticated GTM Platform Tests...")
        print(f"🌐 Testing URL: {self.base_url}")
        print(f"🔑 Session Token: {self.session_token}")
        print("=" * 60)
        
        # Test authentication first
        if not self.test_auth():
            print("❌ Authentication failed - stopping tests")
            return False
        
        # Create a test contact for pipeline testing
        contact_id = self.test_contacts_crud()
        if not contact_id:
            print("❌ Contact creation failed - limited testing")
        
        # Test pipeline flow if we have a contact
        if contact_id:
            print(f"\n🔄 Testing Complete Pipeline Flow with Contact: {contact_id}")
            self.test_contact_enrichment(contact_id)
            self.test_contact_scoring(contact_id)
            
            # Test full pipeline on another contact
            another_contact_id = self.test_contacts_crud()
            if another_contact_id:
                self.test_full_pipeline(another_contact_id)
        
        # Test other functionality
        self.test_seed_demo_data()
        self.test_analytics()
        self.test_activation_logs()
        
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} tests passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if success_rate >= 80:
            print("✅ Backend comprehensive testing successful!")
        else:
            print("❌ Multiple issues found in backend testing")
            
        return success_rate >= 80

def main():
    tester = AuthenticatedGTMTester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())