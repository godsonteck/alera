from __future__ import annotations

import asyncio
import html
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

import httpx
from fastapi import HTTPException, status

from config import settings


logger = logging.getLogger(__name__)


class EmailService:
    """Transactional email service with real provider backends."""

    @staticmethod
    def _escape(value: str | None) -> str:
        return html.escape(value or "", quote=True)

    @staticmethod
    def _sender_name() -> str:
        return (settings.EMAIL_FROM_NAME or "ALERA Healthcare").strip() or "ALERA Healthcare"

    @staticmethod
    def _sender_email(provider: str) -> str:
        if provider == "resend":
            sender = (
                getattr(settings, "RESEND_FROM_EMAIL", "")
                or getattr(settings, "EMAIL_FROM_EMAIL", "")
                or settings.SENDGRID_FROM_EMAIL
            )
        elif provider == "sendgrid":
            sender = (
                settings.SENDGRID_FROM_EMAIL
                or getattr(settings, "EMAIL_FROM_EMAIL", "")
                or getattr(settings, "RESEND_FROM_EMAIL", "")
            )
        else:
            sender = (
                getattr(settings, "EMAIL_FROM_EMAIL", "")
                or settings.SENDGRID_FROM_EMAIL
                or getattr(settings, "RESEND_FROM_EMAIL", "")
            )
        return sender.strip()

    @staticmethod
    def _provider() -> str:
        configured = (getattr(settings, "EMAIL_PROVIDER", "auto") or "auto").strip().lower()
        if configured != "auto":
            if configured not in {"console", "resend", "sendgrid", "smtp"}:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid email provider configuration",
                )
            if configured == "resend" and not settings.RESEND_API_KEY:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Resend is not configured",
                )
            if configured == "sendgrid" and not settings.SENDGRID_API_KEY:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="SendGrid is not configured",
                )
            if configured == "smtp" and not settings.SMTP_HOST:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="SMTP is not configured",
                )
            return configured

        if settings.RESEND_API_KEY:
            return "resend"
        if settings.SENDGRID_API_KEY:
            return "sendgrid"
        if settings.SMTP_HOST:
            return "smtp"
        # Fall back to console for development or when no providers configured
        return "console"

    @staticmethod
    async def send_appointment_reminder(
        recipient_email: str,
        recipient_name: str,
        appointment_title: str,
        appointment_time: str,
        provider_name: str,
    ) -> None:
        """Send appointment reminder email."""

        subject = f"Appointment Reminder: {appointment_title}"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>Appointment Reminder</h2>
                <p>Hi {EmailService._escape(recipient_name)},</p>
                <p>This is a reminder about your upcoming appointment:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Title:</strong> {EmailService._escape(appointment_title)}</p>
                    <p><strong>Time:</strong> {EmailService._escape(appointment_time)}</p>
                    <p><strong>Provider:</strong> {EmailService._escape(provider_name)}</p>
                </div>
                <p>Please log in to ALERA to confirm or reschedule if needed.</p>
                <p>If you have any questions, contact our support team.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">ALERA Healthcare Platform</p>
            </body>
        </html>
        """

        await EmailService._send_email(recipient_email, subject, html_body)

    @staticmethod
    async def send_prescription_notification(
        recipient_email: str,
        recipient_name: str,
        medication_name: str,
        provider_name: str,
    ) -> None:
        """Send prescription created notification."""

        subject = f"New Prescription: {medication_name}"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>New Prescription</h2>
                <p>Hi {EmailService._escape(recipient_name)},</p>
                <p>You have received a new prescription from {EmailService._escape(provider_name)}:</p>
                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Medication:</strong> {EmailService._escape(medication_name)}</p>
                    <p><strong>Prescribed by:</strong> {EmailService._escape(provider_name)}</p>
                </div>
                <p>Log in to ALERA to view full prescription details and arrange pickup at your pharmacy.</p>
                <p>Questions? Contact {EmailService._escape(provider_name)} or our support team.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">ALERA Healthcare Platform</p>
            </body>
        </html>
        """

        await EmailService._send_email(recipient_email, subject, html_body)

    @staticmethod
    async def send_allergy_alert(
        recipient_email: str,
        recipient_name: str,
        allergen: str,
        severity: str,
    ) -> None:
        """Send allergy alert notification."""

        subject = f"Alert: Allergy Recorded - {allergen}"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>Allergy Alert</h2>
                <p>Hi {EmailService._escape(recipient_name)},</p>
                <p>A new allergy has been recorded in your ALERA profile:</p>
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                    <p><strong>Allergen:</strong> {EmailService._escape(allergen).upper()}</p>
                    <p><strong>Severity:</strong> {EmailService._escape(severity)}</p>
                </div>
                <p><strong>Important:</strong> Please verify this information is correct. Allergies are critical for your safety.</p>
                <p>Log in to ALERA to review or edit this allergy record.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">ALERA Healthcare Platform</p>
            </body>
        </html>
        """

        await EmailService._send_email(recipient_email, subject, html_body)

    @staticmethod
    async def send_password_reset(
        recipient_email: str,
        recipient_name: str,
        reset_link: str,
    ) -> None:
        """Send password reset email."""

        subject = "ALERA - Reset Your Password"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>Password Reset Request</h2>
                <p>Hi {EmailService._escape(recipient_name)},</p>
                <p>We received a request to reset your password. Click the button below to create a new password:</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="{EmailService._escape(reset_link)}" style="background-color: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                </div>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #0ea5e9;">{EmailService._escape(reset_link)}</p>
                <p><strong>Note:</strong> This link expires in 24 hours.</p>
                <p>If you didn't request a password reset, please ignore this email or contact support.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">ALERA Healthcare Platform</p>
            </body>
        </html>
        """

        await EmailService._send_email(recipient_email, subject, html_body)

    @staticmethod
    async def send_verification_email(
        recipient_email: str,
        recipient_name: str,
        verification_link: str,
    ) -> None:
        """Send email verification link."""

        subject = "ALERA - Verify Your Email"
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <h2>Welcome to ALERA!</h2>
                <p>Hi {EmailService._escape(recipient_name)},</p>
                <p>Thank you for signing up. Please verify your email address to complete your registration:</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="{EmailService._escape(verification_link)}" style="background-color: #0ea5e9; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
                </div>
                <p>Or copy and paste this link:</p>
                <p style="word-break: break-all; color: #0ea5e9;">{EmailService._escape(verification_link)}</p>
                <p>Welcome to the ALERA healthcare platform. Your health, our priority.</p>
                <hr>
                <p style="font-size: 12px; color: #999;">ALERA Healthcare Platform</p>
            </body>
        </html>
        """

        await EmailService._send_email(recipient_email, subject, html_body)

    @staticmethod
    async def _send_email(recipient_email: str, subject: str, html_body: str) -> None:
        """Send email via a real provider backend or a development console backend."""

        provider = EmailService._provider()

        try:
            if provider == "console":
                logger.info("[DEV EMAIL] to=%s subject=%s", recipient_email, subject)
                print(f"[DEV EMAIL] to={recipient_email} subject={subject}")
                return

            if provider == "resend":
                await EmailService._send_via_resend(recipient_email, subject, html_body)
                return

            if provider == "sendgrid":
                await EmailService._send_via_sendgrid(recipient_email, subject, html_body)
                return

            if provider == "smtp":
                await EmailService._send_via_smtp(recipient_email, subject, html_body)
                return

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unsupported email provider",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Error sending email via %s", provider)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email delivery is temporarily unavailable",
            ) from exc

    @staticmethod
    async def _send_via_resend(recipient_email: str, subject: str, html_body: str) -> None:
        sender_email = EmailService._sender_email("resend")
        sender_name = EmailService._sender_name()

        async with httpx.AsyncClient(timeout=settings.EMAIL_TIMEOUT_SECONDS) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": formataddr((sender_name, sender_email)),
                    "to": [recipient_email],
                    "subject": subject,
                    "html": html_body,
                },
            )
            response.raise_for_status()

    @staticmethod
    async def _send_via_sendgrid(recipient_email: str, subject: str, html_body: str) -> None:
        sender_email = EmailService._sender_email("sendgrid")
        sender_name = EmailService._sender_name()

        async with httpx.AsyncClient(timeout=settings.EMAIL_TIMEOUT_SECONDS) as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [
                        {
                            "to": [{"email": recipient_email}],
                        }
                    ],
                    "from": {
                        "email": sender_email,
                        "name": sender_name,
                    },
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html_body}],
                },
            )
            response.raise_for_status()

    @staticmethod
    async def _send_via_smtp(recipient_email: str, subject: str, html_body: str) -> None:
        await asyncio.to_thread(EmailService._send_via_smtp_sync, recipient_email, subject, html_body)

    @staticmethod
    def _send_via_smtp_sync(recipient_email: str, subject: str, html_body: str) -> None:
        sender_email = EmailService._sender_email("smtp")
        sender_name = EmailService._sender_name()

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((sender_name, sender_email))
        message["To"] = recipient_email
        message.set_content("Please view this email in an HTML-capable client.")
        message.add_alternative(html_body, subtype="html")

        smtp_timeout = settings.EMAIL_TIMEOUT_SECONDS
        if settings.SMTP_USE_SSL:
            server: smtplib.SMTP = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=smtp_timeout)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=smtp_timeout)

        try:
            server.ehlo()
            if settings.SMTP_USE_TLS and not settings.SMTP_USE_SSL:
                server.starttls()
                server.ehlo()

            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            server.send_message(message)
        finally:
            try:
                server.quit()
            except Exception:
                server.close()
