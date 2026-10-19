from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, Session
from app.core.security import create_token
from app.schemas import OtpRequest, OtpVerify, ProfileUpdate, TokenOut, UserOut
from app.services.email import send_otp_email
from app.services.otp import OtpError, issue_code, verify_code

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/otp/request", status_code=status.HTTP_202_ACCEPTED)
async def request_code(body: OtpRequest, session: Session) -> dict:
    try:
        code = await issue_code(session, body.email)
    except OtpError as e:
        raise HTTPException(e.status, str(e))
    try:
        await send_otp_email(body.email.strip().lower(), code)
    except Exception:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Couldn't send the email. Try again in a minute.")
    return {"sent": True}


@router.post("/otp/verify")
async def verify(body: OtpVerify, session: Session) -> TokenOut:
    try:
        user = await verify_code(session, body.email, body.code)
    except OtpError as e:
        raise HTTPException(e.status, str(e))
    return TokenOut(access_token=create_token(user.id), user=UserOut.model_validate(user))


@router.get("/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me")
async def update_me(body: ProfileUpdate, user: CurrentUser, session: Session) -> UserOut:
    user.display_name = body.display_name
    await session.commit()
    return UserOut.model_validate(user)
