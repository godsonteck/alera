"""
Notification utilities for respecting user preferences.
"""

import logging

from app.models.user import User
from app.services.email_service import EmailService
from app.services.sms_service import SMSService

logger = logging.getLogger(__name__)


class NotificationManager:
    """Manages sending notifications based on user preferences."""

    @staticmethod
    async def send_appointment_reminder(
        user: User,
        appointment_title: str,
        appointment_time: str,
        provider_name: str,
    ) -> dict:
        """
        Send appointment reminder respecting user notification preferences.

        Returns dict with 'email_sent' and 'sms_sent' boolean flags.
        """
        results = {"email_sent": False, "sms_sent": False}

        # Send email if user has email notifications enabled
        if user.notification_email is True and user.email is not None:
            try:
                await EmailService.send_appointment_reminder(
                    recipient_email=str(user.email),
                    recipient_name=f"{str(user.first_name)} {str(user.last_name)}",
                    appointment_title=appointment_title,
                    appointment_time=appointment_time,
                    provider_name=provider_name,
                )
                results["email_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send appointment reminder email to %s",
                    user.email,
                    exc_info=e,
                )

        # Send SMS if user has SMS notifications enabled and has phone
        if user.notification_sms is True and user.phone is not None:
            try:
                await SMSService.send_appointment_reminder(
                    phone_number=str(user.phone),
                    appointment_title=appointment_title,
                    appointment_time=appointment_time,
                )
                results["sms_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send appointment reminder SMS to %s",
                    user.phone,
                    exc_info=e,
                )

        return results

    @staticmethod
    async def send_prescription_notification(
        user: User,
        medication_name: str,
        provider_name: str,
    ) -> dict:
        """
        Send prescription notification respecting user preferences.

        Returns dict with 'email_sent' and 'sms_sent' boolean flags.
        """
        results = {"email_sent": False, "sms_sent": False}

        # Send email if user has email notifications enabled
        if user.notification_email is True and user.email is not None:
            try:
                await EmailService.send_prescription_notification(
                    recipient_email=str(user.email),
                    recipient_name=f"{str(user.first_name)} {str(user.last_name)}",
                    medication_name=medication_name,
                    provider_name=provider_name,
                )
                results["email_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send prescription notification email to %s",
                    user.email,
                    exc_info=e,
                )

        # Send SMS if user has SMS notifications enabled and has phone
        if user.notification_sms is True and user.phone is not None:
            try:
                await SMSService.send_prescription_ready(
                    phone_number=str(user.phone),
                    medication_name=medication_name,
                    pharmacy_name="your pharmacy",  # TODO: Make this configurable
                )
                results["sms_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send prescription notification SMS to %s",
                    user.phone,
                    exc_info=e,
                )

        return results

    @staticmethod
    async def send_allergy_alert(
        user: User,
        allergen: str,
        severity: str,
    ) -> dict:
        """
        Send allergy alert respecting user preferences.

        Returns dict with 'email_sent' and 'sms_sent' boolean flags.
        """
        results = {"email_sent": False, "sms_sent": False}

        # Send email if user has email notifications enabled
        if user.notification_email is True and user.email is not None:
            try:
                await EmailService.send_allergy_alert(
                    recipient_email=str(user.email),
                    recipient_name=f"{str(user.first_name)} {str(user.last_name)}",
                    allergen=allergen,
                    severity=severity,
                )
                results["email_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send allergy alert email to %s",
                    user.email,
                    exc_info=e,
                )

        # Send SMS if user has SMS notifications enabled and has phone
        if user.notification_sms is True and user.phone is not None:
            try:
                await SMSService.send_urgent_alert(
                    phone_number=str(user.phone),
                    alert_message=f"New allergy recorded: {allergen} (Severity: {severity})",
                )
                results["sms_sent"] = True
            except Exception as e:
                logger.warning(
                    "Failed to send allergy alert SMS to %s",
                    user.phone,
                    exc_info=e,
                )

        return results

    @staticmethod
    async def send_verification_email(
        user: User,
        verification_link: str,
    ) -> bool:
        """
        Send email verification. This is always sent regardless of preferences
        as it's required for account activation.

        Returns True if sent successfully.
        """
        if user.email is None:
            return False

        try:
            await EmailService.send_verification_email(
                recipient_email=str(user.email),
                recipient_name=f"{str(user.first_name)} {str(user.last_name)}",
                verification_link=verification_link,
            )
            return True
        except Exception as e:
            logger.warning(
                "Failed to send verification email to %s",
                user.email,
                exc_info=e,
            )
            return False

    @staticmethod
    async def send_password_reset_email(
        user: User,
        reset_link: str,
    ) -> bool:
        """
        Send password reset email. This is always sent regardless of preferences
        as it's required for account recovery.

        Returns True if sent successfully.
        """
        if user.email is None:
            return False

        try:
            await EmailService.send_password_reset(
                recipient_email=str(user.email),
                recipient_name=f"{str(user.first_name)} {str(user.last_name)}",
                reset_link=reset_link,
            )
            return True
        except Exception as e:
            logger.warning(
                "Failed to send password reset email to %s",
                user.email,
                exc_info=e,
            )
            return False
