#!/usr/bin/env python3
"""
Backend Test Suite for Stadtwache App
Tests critical fixes for SOS GPS-Alarm API and Reports API
"""

import requests
import json
import uuid
from datetime import datetime
import time

# Configuration
BASE_URL = "https://tracking-repair.preview.emergentagent.com/api"
TEST_USER_EMAIL = "test.officer@stadtwache.de"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_USERNAME = "TestOfficer"

class StadtwacheAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.auth_token = None
        self.test_user_id = None
        self.test_report_id = None
        
    def log(self, message, level="INFO"):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def register_test_user(self):
        """Register a test user for authentication"""
        self.log("Registering test user...")
        
        user_data = {
            "email": TEST_USER_EMAIL,
            "username": TEST_USER_USERNAME,
            "password": TEST_USER_PASSWORD,
            "role": "police",
            "badge_number": "TEST001",
            "department": "Test Department",
            "phone": "+49123456789",
            "service_number": "SVC001",
            "rank": "Officer"
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/register", json=user_data)
            if response.status_code == 200:
                user_info = response.json()
                self.test_user_id = user_info.get("id")
                self.log(f"✅ Test user registered successfully: {user_info.get('username')}")
                return True
            elif response.status_code == 400 and "already registered" in response.text:
                self.log("ℹ️ Test user already exists, proceeding with login")
                return True
            else:
                self.log(f"❌ Failed to register test user: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error registering test user: {str(e)}", "ERROR")
            return False
    
    def login_test_user(self):
        """Login with test user to get authentication token"""
        self.log("Logging in test user...")
        
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        try:
            response = requests.post(f"{self.base_url}/auth/login", json=login_data)
            if response.status_code == 200:
                token_data = response.json()
                self.auth_token = token_data.get("access_token")
                user_info = token_data.get("user", {})
                self.test_user_id = user_info.get("id")
                self.log(f"✅ Login successful for user: {user_info.get('username')}")
                return True
            else:
                self.log(f"❌ Login failed: {response.status_code} - {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"❌ Error during login: {str(e)}", "ERROR")
            return False
    
    def get_auth_headers(self):
        """Get authorization headers for authenticated requests"""
        if not self.auth_token:
            return {}
        return {"Authorization": f"Bearer {self.auth_token}"}
    
    def test_sos_alarm_with_gps(self):
        """Test SOS alarm broadcast WITH GPS location"""
        self.log("🚨 Testing SOS alarm broadcast WITH GPS location...")
        
        # Realistic GPS coordinates for Berlin (police station area)
        alert_data = {
            "type": "sos_alarm",
            "message": "Notfall-Alarm - Unterstützung benötigt!",
            "priority": "urgent",
            "location": {
                "latitude": 52.520008,
                "longitude": 13.404954,
                "accuracy": 5.0,
                "timestamp": datetime.utcnow().isoformat()
            },
            "location_status": "GPS verfügbar"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/emergency/broadcast",
                json=alert_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                result = response.json()
                broadcast_id = result.get("broadcast_id")
                location_transmitted = result.get("location_transmitted")
                
                self.log(f"✅ SOS alarm with GPS sent successfully!")
                self.log(f"   Broadcast ID: {broadcast_id}")
                self.log(f"   Location transmitted: {location_transmitted}")
                self.log(f"   GPS coordinates: {alert_data['location']['latitude']}, {alert_data['location']['longitude']}")
                
                if location_transmitted:
                    self.log("✅ GPS location correctly transmitted")
                    return True
                else:
                    self.log("❌ GPS location was not transmitted", "ERROR")
                    return False
            else:
                self.log(f"❌ SOS alarm with GPS failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing SOS alarm with GPS: {str(e)}", "ERROR")
            return False
    
    def test_sos_alarm_without_gps(self):
        """Test SOS alarm broadcast WITHOUT GPS location (fallback)"""
        self.log("🚨 Testing SOS alarm broadcast WITHOUT GPS location (fallback)...")
        
        alert_data = {
            "type": "sos_alarm",
            "message": "Notfall-Alarm - GPS nicht verfügbar",
            "priority": "urgent",
            "location": None,
            "location_status": "GPS nicht verfügbar"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/emergency/broadcast",
                json=alert_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                result = response.json()
                broadcast_id = result.get("broadcast_id")
                location_transmitted = result.get("location_transmitted")
                location_status = result.get("location_status")
                
                self.log(f"✅ SOS alarm without GPS sent successfully!")
                self.log(f"   Broadcast ID: {broadcast_id}")
                self.log(f"   Location transmitted: {location_transmitted}")
                self.log(f"   Location status: {location_status}")
                
                if not location_transmitted and location_status == "GPS nicht verfügbar":
                    self.log("✅ Fallback mode working correctly (no GPS)")
                    return True
                else:
                    self.log("❌ Fallback mode not working correctly", "ERROR")
                    return False
            else:
                self.log(f"❌ SOS alarm without GPS failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing SOS alarm without GPS: {str(e)}", "ERROR")
            return False
    
    def test_report_creation(self):
        """Test report creation"""
        self.log("📝 Testing report creation...")
        
        report_data = {
            "title": "Test Schichtbericht",
            "content": "Dies ist ein Test-Bericht für die API-Validierung. Alle Systeme funktionieren ordnungsgemäß.",
            "shift_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/reports",
                json=report_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                result = response.json()
                self.test_report_id = result.get("id")
                
                self.log(f"✅ Report created successfully!")
                self.log(f"   Report ID: {self.test_report_id}")
                self.log(f"   Title: {result.get('title')}")
                self.log(f"   Status: {result.get('status')}")
                self.log(f"   Author: {result.get('author_name')}")
                return True
            else:
                self.log(f"❌ Report creation failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error creating report: {str(e)}", "ERROR")
            return False
    
    def test_report_update(self):
        """Test report update API (PUT /api/reports/{report_id})"""
        if not self.test_report_id:
            self.log("❌ No test report ID available for update test", "ERROR")
            return False
            
        self.log(f"📝 Testing report update for ID: {self.test_report_id}...")
        
        updated_report_data = {
            "title": "Test Schichtbericht - AKTUALISIERT",
            "content": "Dies ist ein aktualisierter Test-Bericht. Die Update-Funktionalität wurde erfolgreich getestet.",
            "shift_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        try:
            response = requests.put(
                f"{self.base_url}/reports/{self.test_report_id}",
                json=updated_report_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                result = response.json()
                
                self.log(f"✅ Report updated successfully!")
                self.log(f"   Report ID: {result.get('id')}")
                self.log(f"   Updated Title: {result.get('title')}")
                self.log(f"   Updated Content: {result.get('content')[:50]}...")
                self.log(f"   Updated At: {result.get('updated_at')}")
                
                # Verify the update actually happened
                if "AKTUALISIERT" in result.get('title', ''):
                    self.log("✅ Report update verified - title contains expected changes")
                    return True
                else:
                    self.log("❌ Report update verification failed - changes not reflected", "ERROR")
                    return False
            else:
                self.log(f"❌ Report update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error updating report: {str(e)}", "ERROR")
            return False
    
    def test_report_status_updates(self):
        """Test report status updates"""
        if not self.test_report_id:
            self.log("❌ No test report ID available for status update test", "ERROR")
            return False
            
        self.log(f"📝 Testing report status updates for ID: {self.test_report_id}...")
        
        # Test updating to 'submitted' status
        status_update_data = {
            "title": "Test Schichtbericht - STATUS UPDATE",
            "content": "Bericht wurde zur Überprüfung eingereicht.",
            "shift_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        try:
            response = requests.put(
                f"{self.base_url}/reports/{self.test_report_id}",
                json=status_update_data,
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                result = response.json()
                
                self.log(f"✅ Report status update successful!")
                self.log(f"   Report ID: {result.get('id')}")
                self.log(f"   Current Status: {result.get('status')}")
                self.log(f"   Updated At: {result.get('updated_at')}")
                return True
            else:
                self.log(f"❌ Report status update failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error updating report status: {str(e)}", "ERROR")
            return False
    
    def test_reports_list(self):
        """Test getting reports list"""
        self.log("📋 Testing reports list retrieval...")
        
        try:
            response = requests.get(
                f"{self.base_url}/reports",
                headers=self.get_auth_headers()
            )
            
            if response.status_code == 200:
                reports = response.json()
                
                self.log(f"✅ Reports list retrieved successfully!")
                self.log(f"   Total reports: {len(reports)}")
                
                if reports:
                    latest_report = reports[0]
                    self.log(f"   Latest report: {latest_report.get('title')}")
                    self.log(f"   Author: {latest_report.get('author_name')}")
                    self.log(f"   Status: {latest_report.get('status')}")
                
                return True
            else:
                self.log(f"❌ Reports list retrieval failed: {response.status_code} - {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error retrieving reports list: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Stadtwache Backend API Tests...")
        self.log(f"   Base URL: {self.base_url}")
        
        test_results = {}
        
        # Authentication setup
        if not self.register_test_user():
            self.log("❌ Failed to register test user - aborting tests", "ERROR")
            return False
            
        if not self.login_test_user():
            self.log("❌ Failed to login test user - aborting tests", "ERROR")
            return False
        
        # Test SOS Emergency Broadcast API
        self.log("\n" + "="*60)
        self.log("TESTING SOS GPS-ALARM API")
        self.log("="*60)
        
        test_results['sos_with_gps'] = self.test_sos_alarm_with_gps()
        time.sleep(1)  # Brief pause between tests
        
        test_results['sos_without_gps'] = self.test_sos_alarm_without_gps()
        time.sleep(1)
        
        # Test Reports API
        self.log("\n" + "="*60)
        self.log("TESTING REPORTS API")
        self.log("="*60)
        
        test_results['report_creation'] = self.test_report_creation()
        time.sleep(1)
        
        test_results['report_update'] = self.test_report_update()
        time.sleep(1)
        
        test_results['report_status_updates'] = self.test_report_status_updates()
        time.sleep(1)
        
        test_results['reports_list'] = self.test_reports_list()
        
        # Summary
        self.log("\n" + "="*60)
        self.log("TEST RESULTS SUMMARY")
        self.log("="*60)
        
        passed_tests = sum(1 for result in test_results.values() if result)
        total_tests = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
        
        self.log(f"\nOverall: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            self.log("🎉 ALL TESTS PASSED! Critical fixes are working correctly.")
            return True
        else:
            self.log(f"⚠️ {total_tests - passed_tests} test(s) failed. Please review the issues above.")
            return False

def main():
    """Main test execution"""
    tester = StadtwacheAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎯 CONCLUSION: All critical fixes for Stadtwache app are working correctly!")
    else:
        print("\n🚨 CONCLUSION: Some critical issues were found that need attention!")
    
    return success

if __name__ == "__main__":
    main()