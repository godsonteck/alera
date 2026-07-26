from config import settings
from typing import Optional


class SMSService:
    """SMS service using Twilio"""
    
    @staticmethod
    async def send_appointment_reminder(
        phone_number: str,
        appointment_title: str,
        appointment_time: str
    ):
        """Send appointment reminder SMS"""
        
        message = f"ALERA: Reminder for your {appointment_title} appointment at {appointment_time}. Reply CONFIRM or call us."
        await SMSService._send_sms(phone_number, message)
    
    
    @staticmethod
    async def send_prescription_ready(
        phone_number: str,
        medication_name: str,
        pharmacy_name: str
    ):
        """Send notification when prescription is ready"""
        
        message = f"ALERA: Your prescription for {medication_name} is ready for pickup at {pharmacy_name}."
        await SMSService._send_sms(phone_number, message)
    
    
    @staticmethod
    async def send_verification_code(
        phone_number: str,
        code: str
    ):
        """Send 2FA verification code"""
        
        message = f"ALERA: Your verification code is {code}. Do not share this code with anyone."
        await SMSService._send_sms(phone_number, message)
    
    
    @staticmethod
    async def send_urgent_alert(
        phone_number: str,
        alert_message: str
    ):
        """Send urgent health alert"""
        
        message = f"ALERA ALERT: {alert_message}"
        await SMSService._send_sms(phone_number, message)
    
    
    @staticmethod
    async def _send_sms(phone_number: str, message: str):
        """Internal method to send SMS via Twilio"""
        
        try:
            if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
                from twilio.rest import Client
                
                client = Client(
                    settings.TWILIO_ACCOUNT_SID,
                    settings.TWILIO_AUTH_TOKEN
                )
                
                message_obj = client.messages.create(
                    body=message,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=phone_number
                )
                
                return {
                    "success": True,
                    "message_id": message_obj.sid
                }
            else:
                # Development mode - just log
                if settings.DEBUG:
                    print(f"[DEV] SMS to {phone_number}: {message}")
                return {
                    "success": True,
                    "message": "SMS logged (development mode)"
                }
        except Exception as e:
            print(f"Error sending SMS: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
