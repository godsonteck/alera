import sys
import os
from pathlib import Path

# Setup path
_root = Path(__file__).parent
sys.path.insert(0, str(_root))

from database import SessionLocal, init_db
from app.models import (
    User, UserRole, Appointment, AppointmentStatus, Prescription,
    LabTest, LabTestStatus, ImagingScan, ImagingScanStatus,
    AmbulanceRequest, AmbulanceRequestStatus, EmergencyPriority
)
from datetime import datetime, time
from app.utils.time import utcnow

def test_stats():
    # Initialize DB to create tables
    print("Initializing database...")
    init_db()
    
    db = SessionLocal()
    try:
        print("--- Starting Stats Test ---")
        
        # 1. User counts
        user_counts = {}
        for role in UserRole:
            print(f"Counting role: {role.value}")
            count = db.query(User).filter(User.role == role.value).count()
            user_counts[role.value] = count
        print(f"User counts: {user_counts}")

        # 2. Today's Activity
        today = utcnow().date()
        start_of_today = datetime.combine(today, time.min)
        end_of_today = datetime.combine(today, time.max)
        
        print(f"Appointment range: {start_of_today} to {end_of_today}")
        today_appointments = db.query(Appointment).filter(
            Appointment.scheduled_time >= start_of_today,
            Appointment.scheduled_time <= end_of_today
        ).count()
        print(f"Today's appointments: {today_appointments}")

        # 3. Lab/Imaging
        pending_labs = db.query(LabTest).filter(
            LabTest.status != LabTestStatus.COMPLETED.value
        ).count()
        print(f"Pending labs: {pending_labs}")

        # 4. Emergencies
        active_emergencies = db.query(AmbulanceRequest).filter(
            AmbulanceRequest.status != AmbulanceRequestStatus.COMPLETED.value,
            AmbulanceRequest.status != AmbulanceRequestStatus.CANCELLED.value,
            AmbulanceRequest.priority == EmergencyPriority.CRITICAL.value
        ).count()
        print(f"Active emergencies: {active_emergencies}")
        
        print("\n--- Verifying Logic Fixes ---")
        
        # 5. Test Verifications query specifically (Standardized filters)
        try:
            pending_providers = db.query(User).filter(
                User.role.in_([
                    UserRole.PROVIDER.value, 
                    UserRole.LABORATORY.value, 
                    UserRole.IMAGING.value, 
                    UserRole.AMBULANCE.value
                ]),
                User.is_verified.is_(False),
                User.license_number.is_not(None)
            ).count()
            print(f"✓ Verifications query successful: {pending_providers} found")
        except Exception as e:
            print(f"✗ Verifications query failed: {e}")

        # 6. Test Activity Feed field compatibility
        try:
            # Check LabTest ordered_at
            lt_count = db.query(LabTest).count()
            print(f"✓ LabTest table accessible (count: {lt_count})")
            
            # Check Prescription medication_name
            p_count = db.query(Prescription).count()
            print(f"✓ Prescription table accessible (count: {p_count})")
            
            # Verify specific field existence via query building
            db.query(LabTest).order_by(LabTest.ordered_at.desc()).first()
            print("✓ LabTest.ordered_at field verified")
            
            db.query(Prescription).filter(Prescription.medication_name != None).first()
            print("✓ Prescription.medication_name field verified")
            
        except Exception as e:
            print(f"✗ Activity feed field check failed: {e}")
            raise e
            
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_stats()
