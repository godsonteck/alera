from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from app.models import AccountLink
from app.models.user import User, UserRole
from app.schemas import AccountLinkCreateRequest, AccountLinkListResponse, LinkedAccountSummary
from app.services.audit_service import log_action
from app.utils.auth import verify_password
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/account-links", tags=["account-links"])


def _role_value(role) -> str:
    return role.value if hasattr(role, "value") else str(role)


def _find_existing_link(db: Session, first_user_id: int, second_user_id: int) -> AccountLink | None:
    primary_user_id, linked_user_id = sorted((first_user_id, second_user_id))
    return db.query(AccountLink).filter(
        AccountLink.primary_user_id == primary_user_id,
        AccountLink.linked_user_id == linked_user_id,
    ).first()


def _account_has_any_link(db: Session, user_id: int) -> bool:
    existing = db.query(AccountLink).filter(
        or_(AccountLink.primary_user_id == user_id, AccountLink.linked_user_id == user_id)
    ).first()
    return existing is not None


def _user_link_summaries(current_user: User) -> list[LinkedAccountSummary]:
    return [LinkedAccountSummary(**summary) for summary in current_user.linked_accounts]


@router.get("/me", response_model=AccountLinkListResponse)
async def get_my_linked_accounts(current_user: User = Depends(get_current_user)):
    return AccountLinkListResponse(
        has_linked_account=current_user.has_linked_account,
        linked_accounts=_user_link_summaries(current_user),
    )


@router.post("", response_model=AccountLinkListResponse, status_code=status.HTTP_201_CREATED)
async def create_account_link(
    payload: AccountLinkCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )

    linked_user = db.query(User).filter(User.email == payload.linked_email).first()
    if linked_user is None or not verify_password(payload.linked_password, linked_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Linked account credentials are invalid",
        )

    if current_user.id == linked_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot link an account to itself",
        )

    if current_user.email.lower() == linked_user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Linked accounts must use different email addresses",
        )

    if current_user.role == linked_user.role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Linked accounts must use different roles",
        )

    if _account_has_any_link(db, current_user.id) or _account_has_any_link(db, linked_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One of these accounts is already linked to another account",
        )

    if _find_existing_link(db, current_user.id, linked_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="These accounts are already linked",
        )

    await log_action(
        db=db,
        user_id=current_user.id,
        action="account_link.requested",
        resource_type="account_link",
        resource_id=f"{current_user.id}:{linked_user.id}",
        description=f"Requested link to account {linked_user.email}",
        status="pending",
        metadata={
            "current_role": _role_value(current_user.role),
            "linked_role": _role_value(linked_user.role),
        },
    )

    primary_user_id, linked_user_id = sorted((current_user.id, linked_user.id))
    account_link = AccountLink(
        primary_user_id=primary_user_id,
        linked_user_id=linked_user_id,
        link_type="same_person",
    )
    db.add(account_link)
    db.commit()
    db.refresh(account_link)
    db.refresh(current_user)
    db.refresh(linked_user)

    await log_action(
        db=db,
        user_id=current_user.id,
        action="account_link.completed",
        resource_type="account_link",
        resource_id=account_link.id,
        description=f"Linked {_role_value(current_user.role)} account with {_role_value(linked_user.role)} account",
        status="success",
        metadata={
            "linked_account_id": linked_user.id,
            "linked_account_role": _role_value(linked_user.role),
            "link_type": account_link.link_type,
        },
    )

    return AccountLinkListResponse(
        has_linked_account=current_user.has_linked_account,
        linked_accounts=_user_link_summaries(current_user),
    )
