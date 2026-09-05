"""
Email Service for AquaSafe

Handles sending email notifications for alerts, new detects, and time-based alerts.
Uses SMTP configuration from environment variables.
Supports both basic SMTP and OAuth 2.0 authentication.
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
import os

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via SMTP"""

    def __init__(self):
        # Support both SMTP_HOST and EMAIL_SMTP_HOST for backward compatibility
        self.smtp_host = os.getenv("SMTP_HOST") or os.getenv(
            "EMAIL_SMTP_HOST", "localhost"
        )
        self.smtp_port = int(
            os.getenv("SMTP_PORT") or os.getenv("EMAIL_SMTP_PORT", "587")
        )

        # Support both SMTP_USER and SMTP_USERNAME for backward compatibility
        self.smtp_user = os.getenv("SMTP_USER") or os.getenv("SMTP_USERNAME", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

        # Support both SMTP_FROM_EMAIL and EMAIL_FROM_ADDRESS for backward compatibility
        self.from_email = os.getenv("SMTP_FROM_EMAIL") or os.getenv(
            "EMAIL_FROM_ADDRESS", "noreply@aquasafe.com"
        )
        self.from_name = os.getenv("SMTP_FROM_NAME") or os.getenv(
            "EMAIL_FROM_NAME", "AquaSafe System"
        )

        # Check if email is enabled
        self.enabled = os.getenv("EMAIL_ENABLED", "false").lower() == "true"

        # Check if OAuth is enabled
        self.use_oauth = os.getenv("EMAIL_USE_OAUTH", "false").lower() == "true"

        # OAuth configuration (if using OAuth)
        if self.use_oauth:
            self.oauth_tenant_id = os.getenv("EMAIL_TENANT_ID")
            self.oauth_client_id = os.getenv("EMAIL_CLIENT_ID")
            self.oauth_client_secret = os.getenv("EMAIL_CLIENT_SECRET")
            logger.info(
                f"Email service enabled with OAuth 2.0 - SMTP: {self.smtp_host}:{self.smtp_port}, From: {self.from_email}"
            )
        else:
            # Log configuration status for basic SMTP
            if self.enabled:
                if self.smtp_user and self.smtp_password:
                    logger.info(
                        f"Email service enabled - SMTP: {self.smtp_host}:{self.smtp_port}, From: {self.from_email}"
                    )
                else:
                    logger.warning(
                        "Email service enabled but SMTP credentials not configured (SMTP_USER/SMTP_PASSWORD missing)"
                    )
            else:
                logger.info("Email service is disabled (EMAIL_ENABLED=false)")

    def send_email(
        self,
        to_emails: List[str],
        subject: str,
        body_html: Optional[str] = None,
        body_text: Optional[str] = None,
        cc_emails: Optional[List[str]] = None,
    ) -> bool:
        """
        Send an email via SMTP.

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body_html: HTML email body (optional)
            body_text: Plain text email body (optional, required if body_html not provided)
            cc_emails: Optional list of CC email addresses

        Returns:
            True if email sent successfully, False otherwise
        """
        if not self.enabled:
            logger.info(f"Email disabled - would send to {to_emails}: {subject}")
            return False

        if not to_emails:
            logger.warning("No recipient emails provided")
            return False

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = ", ".join(to_emails)
            msg["Subject"] = subject

            if cc_emails:
                msg["Cc"] = ", ".join(cc_emails)

            # Add body
            if body_html:
                msg.attach(MIMEText(body_html, "html"))
            if body_text:
                msg.attach(MIMEText(body_text, "plain"))
            elif not body_html:
                # Default plain text if nothing provided
                msg.attach(MIMEText(subject, "plain"))

            # Use OAuth if configured, otherwise use basic SMTP
            if self.use_oauth:
                return self._send_email_oauth(
                    to_emails, subject, body_html, body_text, cc_emails
                )
            else:
                return self._send_email_smtp(
                    to_emails, subject, body_html, body_text, cc_emails, msg
                )

        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {str(e)}")
            logger.error("Check SMTP_USER and SMTP_PASSWORD environment variables")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"SMTP recipients refused: {str(e)}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {str(e)}")
            return False
        except Exception as e:
            logger.error(
                f"Failed to send email to {to_emails}: {str(e)}", exc_info=True
            )
            return False

    def _send_email_smtp(
        self,
        to_emails: List[str],
        subject: str,
        body_html: Optional[str],
        body_text: Optional[str],
        cc_emails: Optional[List[str]],
        msg: MIMEMultipart,
    ) -> bool:
        """Send email using basic SMTP authentication"""
        try:
            # Connect to SMTP server
            if self.smtp_use_tls:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.starttls()
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)

            # Authenticate if credentials provided
            if self.smtp_user and self.smtp_password:
                server.login(self.smtp_user, self.smtp_password)

            # Send email
            all_recipients = to_emails + (cc_emails or [])
            server.send_message(msg, from_addr=self.from_email, to_addrs=all_recipients)
            server.quit()

            logger.info(f"Email sent successfully to {to_emails}: {subject}")
            return True
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {str(e)}")
            logger.error("Check SMTP_USER and SMTP_PASSWORD environment variables")
            return False
        except smtplib.SMTPRecipientsRefused as e:
            logger.error(f"SMTP recipients refused: {str(e)}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email via SMTP: {str(e)}", exc_info=True)
            return False

    def _send_email_oauth(
        self,
        to_emails: List[str],
        subject: str,
        body_html: Optional[str],
        body_text: Optional[str],
        cc_emails: Optional[List[str]],
    ) -> bool:
        """Send email using OAuth 2.0 authentication"""
        try:
            # Import OAuth provider
            from app.services.office365_email_service import (
                create_office365_oauth_provider,
            )

            # Create OAuth provider
            provider = create_office365_oauth_provider()

            # Prepare message content
            message_text = body_text or (
                body_html.replace("<[^>]+>", "") if body_html else subject
            )
            html_message = body_html

            # Send email via OAuth provider
            all_recipients = to_emails + (cc_emails or [])
            result = provider.send_notification(
                to_addresses=all_recipients,
                subject=subject,
                message=message_text,
                html_message=html_message,
            )

            if result.status.value == "delivered":
                logger.info(
                    f"Email sent successfully via OAuth to {to_emails}: {subject}"
                )
                return True
            else:
                logger.error(f"OAuth email failed: {result.error_message}")
                return False

        except ImportError as e:
            logger.error(f"OAuth provider not available: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email via OAuth: {str(e)}", exc_info=True)
            return False

    def send_new_detect_alert(
        self, to_emails: List[str], detect_info: Dict[str, Any]
    ) -> bool:
        """
        Send email alert for new detect.

        Args:
            to_emails: List of recipient email addresses
            detect_info: Dictionary with detect information:
                - well_number: Well identifier
                - well_name: Well name (optional)
                - contaminant_name: Contaminant name
                - value: Detection value
                - unit: Unit of measurement
                - sample_date: Sample date
                - district_name: District name (optional)
        """
        subject = f"New Detect Alert: {detect_info.get('contaminant_name')} in {detect_info.get('well_number', 'Unknown Well')}"

        # HTML body
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #2563eb;">New Contaminant Detect Alert</h2>
            <p>A new contaminant has been detected in your water system.</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Well:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{detect_info.get("well_number", "Unknown")} {detect_info.get("well_name", "")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Contaminant:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{detect_info.get("contaminant_name", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Value:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{detect_info.get("value", "N/A")} {detect_info.get("unit", "")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Sample Date:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{detect_info.get("sample_date", "Unknown")}</td>
                </tr>
                {f'<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">District:</td><td style="padding: 8px; border: 1px solid #ddd;">{detect_info.get("district_name", "")}</td></tr>' if detect_info.get("district_name") else ""}
            </table>
            <p style="margin-top: 20px; color: #666;">This is an automated alert from AquaSafe.</p>
        </body>
        </html>
        """

        # Plain text body
        body_text = f"""
New Contaminant Detect Alert

A new contaminant has been detected in your water system.

Well: {detect_info.get("well_number", "Unknown")} {detect_info.get("well_name", "")}
Contaminant: {detect_info.get("contaminant_name", "Unknown")}
Value: {detect_info.get("value", "N/A")} {detect_info.get("unit", "")}
Sample Date: {detect_info.get("sample_date", "Unknown")}
{f"District: {detect_info.get('district_name', '')}" if detect_info.get("district_name") else ""}

This is an automated alert from AquaSafe.
        """

        return self.send_email(to_emails, subject, body_html, body_text)

    def send_time_based_alert(
        self, to_emails: List[str], alert_info: Dict[str, Any]
    ) -> bool:
        """
        Send email alert for time-based schedule alerts.

        Args:
            to_emails: List of recipient email addresses
            alert_info: Dictionary with alert information:
                - schedule_name: Schedule name
                - well_number: Well identifier
                - contaminant_name: Contaminant name
                - frequency: Schedule frequency
                - due_date: Next due date
                - days_until_due: Days until due (negative if overdue)
                - district_name: District name (optional)
        """
        days_until = alert_info.get("days_until_due", 0)
        if days_until < 0:
            subject = f"OVERDUE: Sample Due for {alert_info.get('contaminant_name')} - {alert_info.get('well_number', 'Unknown Well')}"
            status = "OVERDUE"
            status_color = "#dc2626"
        else:
            subject = f"Sample Due Soon: {alert_info.get('contaminant_name')} - {alert_info.get('well_number', 'Unknown Well')}"
            status = "Due Soon"
            status_color = "#f59e0b"

        # HTML body
        body_html = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: {status_color};">{status}</h2>
            <p>A scheduled sample is approaching its due date.</p>
            <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Schedule:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("schedule_name", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Well:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("well_number", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Contaminant:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("contaminant_name", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Frequency:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("frequency", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Due Date:</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("due_date", "Unknown")}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Status:</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: {status_color}; font-weight: bold;">
                        {abs(days_until)} days {"overdue" if days_until < 0 else "until due"}
                    </td>
                </tr>
                {f'<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">District:</td><td style="padding: 8px; border: 1px solid #ddd;">{alert_info.get("district_name", "")}</td></tr>' if alert_info.get("district_name") else ""}
            </table>
            <p style="margin-top: 20px; color: #666;">This is an automated alert from AquaSafe.</p>
        </body>
        </html>
        """

        # Plain text body
        body_text = f"""
{status}

A scheduled sample is approaching its due date.

Schedule: {alert_info.get("schedule_name", "Unknown")}
Well: {alert_info.get("well_number", "Unknown")}
Contaminant: {alert_info.get("contaminant_name", "Unknown")}
Frequency: {alert_info.get("frequency", "Unknown")}
Due Date: {alert_info.get("due_date", "Unknown")}
Status: {abs(days_until)} days {"overdue" if days_until < 0 else "until due"}
{f"District: {alert_info.get('district_name', '')}" if alert_info.get("district_name") else ""}

This is an automated alert from AquaSafe.
        """

        return self.send_email(to_emails, subject, body_html, body_text)


# Global instance
_email_service = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance"""
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service
