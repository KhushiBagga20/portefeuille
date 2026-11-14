import base64
import hashlib
import secrets
from datetime import UTC, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import OwnerSession, now

router = APIRouter(prefix="/auth", tags=["owner login"])
COOKIE = "portfolio_session"


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def require_owner(request: Request, db: Session = Depends(get_db)):
    cfg = settings()
    session = db.get(OwnerSession, token_hash(request.cookies.get(COOKIE, "")))
    if not session or session.owner_id != str(cfg.owner_github_id) or cfg.owner_github_id <= 0:
        raise HTTPException(401, "Owner login required")
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=UTC)
    if expires <= now():
        raise HTTPException(401, "Session expired")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        if request.headers.get("origin") not in (cfg.frontend_origin, cfg.backend_origin):
            raise HTTPException(403, "Untrusted origin")
        if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf):
            raise HTTPException(403, "CSRF token required")
    return session


def signer():
    cfg = settings()
    if len(cfg.session_secret) < 32 or not cfg.github_client_id or not cfg.github_client_secret:
        raise HTTPException(503, "Configure GitHub OAuth and SESSION_SECRET first")
    return URLSafeTimedSerializer(cfg.session_secret, salt="portfolio-oauth")


@router.get("/github")
def github_login():
    cfg = settings()
    signing = signer()
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    params = dict(
        client_id=cfg.github_client_id,
        redirect_uri=f"{cfg.backend_origin}/auth/github/callback",
        state=state,
        code_challenge=challenge,
        code_challenge_method="S256",
    )
    response = RedirectResponse("https://github.com/login/oauth/authorize?" + urlencode(params))
    response.set_cookie(
        "portfolio_oauth",
        signing.dumps({"state": state, "verifier": verifier}),
        max_age=600,
        httponly=True,
        secure=cfg.environment == "production",
        samesite="lax",
        path="/auth",
    )
    return response


@router.get("/github/callback")
def github_callback(request: Request, code: str, state: str, db: Session = Depends(get_db)):
    cfg = settings()
    try:
        stored = signer().loads(request.cookies.get("portfolio_oauth", ""), max_age=600)
        if not secrets.compare_digest(state, stored["state"]):
            raise BadSignature("State mismatch")
    except BadSignature:
        raise HTTPException(400, "Invalid or expired login request") from None
    try:
        with httpx.Client(timeout=15) as client:
            result = client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data=dict(
                    client_id=cfg.github_client_id,
                    client_secret=cfg.github_client_secret,
                    code=code,
                    code_verifier=stored["verifier"],
                    redirect_uri=f"{cfg.backend_origin}/auth/github/callback",
                ),
            )
            result.raise_for_status()
            access_token = result.json()["access_token"]
            user = client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
            )
            user.raise_for_status()
            owner_id = str(user.json()["id"])
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(502, "GitHub sign-in failed; please try again") from None
    if cfg.owner_github_id <= 0 or owner_id != str(cfg.owner_github_id):
        raise HTTPException(403, "This account is not the portfolio owner")
    old = db.get(OwnerSession, token_hash(request.cookies.get(COOKIE, "")))
    if old:
        db.delete(old)
    token = secrets.token_urlsafe(48)
    db.add(
        OwnerSession(
            token_hash=token_hash(token),
            owner_id=owner_id,
            csrf=secrets.token_urlsafe(32),
            expires_at=now() + timedelta(hours=12),
        )
    )
    db.commit()
    response = RedirectResponse(f"{cfg.frontend_origin}/studio/")
    response.delete_cookie("portfolio_oauth", path="/auth")
    response.set_cookie(
        COOKIE, token, max_age=43200, httponly=True, secure=cfg.environment == "production", samesite="lax"
    )
    return response


@router.get("/session")
def session_info(owner: OwnerSession = Depends(require_owner)):
    return {"owner_id": owner.owner_id, "csrf_token": owner.csrf, "expires_at": owner.expires_at}


@router.post("/logout")
def logout(owner: OwnerSession = Depends(require_owner), db: Session = Depends(get_db)):
    db.delete(owner)
    db.commit()
    response = RedirectResponse("/health", status_code=303)
    response.delete_cookie(COOKIE)
    return response
