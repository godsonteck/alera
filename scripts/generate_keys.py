#!/usr/bin/env python3
"""
ALERA - Generate Secure Keys for Production Deployment

This script generates cryptographically secure keys needed for production deployment on Vercel.

Usage:
    python generate_keys.py

Do NOT commit the output to version control. Add these keys to Vercel Environment Variables.
"""

import secrets
import sys


def generate_secret_key(length: int = 32) -> str:
    """Generate a URL-safe secret key for JWT tokens."""
    return secrets.token_urlsafe(length)


def generate_encryption_key(length: int = 32) -> str:
    """Generate an encryption key for sensitive data."""
    return secrets.token_hex(length)


def generate_api_key(prefix: str = "key") -> str:
    """Generate an API key with prefix."""
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def main():
    """Generate and display production keys."""
    print("=" * 80)
    print("ALERA - Production Key Generator")
    print("=" * 80)
    print("\n⚠️  IMPORTANT: DO NOT COMMIT THESE KEYS")
    print("    Add them to Vercel Environment Variables only\n")

    # Generate keys
    secret_key = generate_secret_key()
    encryption_key = generate_encryption_key()
    jwt_secret = generate_secret_key()

    print("=" * 80)
    print("GENERATED KEYS - Copy to Vercel Dashboard Environment Variables")
    print("=" * 80)

    print("\n1️⃣  SECRET_KEY (for JWT tokens):")
    print(f"   {secret_key}\n")

    print("2️⃣  ENCRYPTION_KEY (for sensitive data):")
    print(f"   {encryption_key}\n")

    print("=" * 80)
    print("OPTIONAL: API Keys (if not already configured)")
    print("=" * 80)
    print("\nGenerate additional keys with:")
    print("  - SendGrid: https://app.sendgrid.com/settings/api_keys")
    print("  - Twilio: https://www.twilio.com/console")
    print("  - Agora: https://console.agora.io")

    print("\n" + "=" * 80)
    print("FINAL CHECKLIST:")
    print("=" * 80)
    print("✅ Copy both keys above")
    print("✅ Go to Vercel Dashboard: https://vercel.com/dashboard")
    print("✅ Select your project: alera-typescript")
    print("✅ Go to Settings → Environment Variables")
    print("✅ Add SECRET_KEY = <key from step 1>")
    print("✅ Add ENCRYPTION_KEY = <key from step 2>")
    print("✅ Redeploy the project")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
