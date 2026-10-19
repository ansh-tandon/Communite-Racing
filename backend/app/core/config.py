from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    db_nullpool: bool = False  # tests: no pooled connections shared across event loops

    jwt_secret: str
    jwt_expire_days: int = 7

    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_requests_per_hour: int = 5

    resend_api_key: str = ""
    email_from: str = "Communitie Racing <quiz@mail.communitieracing.in>"
    # Public URL of the white logo for the email header. Empty = the name in text instead.
    email_logo_url: str = ""

    # OAuth web client ID from Google Cloud. Empty = "Continue with Google" is switched off.
    google_client_id: str = ""

    frontend_origin: str = "http://localhost:5173"
    admin_emails: str = ""
    sentry_dsn: str = ""

    # Admin panel shows and accepts times in this zone; the database stores UTC.
    app_timezone: str = "Asia/Kolkata"
    scheduler_enabled: bool = True
    scheduler_interval_seconds: int = 30

    # OpenF1 auto-answers. Free without an account (after each session); live needs a paid account.
    openf1_enabled: bool = True
    openf1_base_url: str = "https://api.openf1.org/v1"
    openf1_token_url: str = "https://api.openf1.org/token"
    openf1_username: str = ""
    openf1_password: str = ""
    openf1_live_interval_seconds: int = 20  # during the race, with a paid account
    openf1_final_interval_seconds: int = 120  # waiting for the official classification
    openf1_followup_hours: int = 6  # keep re-checking after the flag (post-race penalties)

    @property
    def frontend_origin_list(self) -> list[str]:
        # Comma-separated, e.g. the onrender.com URL plus a custom domain.
        return [o.strip().rstrip("/") for o in self.frontend_origin.split(",") if o.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
