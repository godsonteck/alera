from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from database import get_db
from app.models.user import User, UserRole
from app.schemas import UserResponse, UserUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import normalized_enum_text, provider_panel_patient_ids, workforce_patient_ids, is_workforce_role, require_verified_workforce_member

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""

    update_data = user_update.model_dump(exclude_unset=True)
    full_name = update_data.pop("full_name", None)
    specialization = update_data.pop("specialization", None)

    if isinstance(full_name, str):
        name_parts = [part for part in full_name.strip().split() if part]
        if name_parts:
            update_data["first_name"] = name_parts[0]
            update_data["last_name"] = " ".join(name_parts[1:]) or current_user.last_name

    if specialization is not None:
        update_data["specialty"] = specialization

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/doctors", response_model=list[UserResponse])
async def list_doctors(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    List registered doctors (backend stores doctors as `provider`).
    Requires authentication but is not admin-only.
    """
    role_text = normalized_enum_text(User.role)
    doctors = db.query(User).filter(
        role_text.in_([UserRole.PROVIDER.value, UserRole.PHYSIOTHERAPIST.value]),
        User.is_active.is_(True),
        User.is_verified.is_(True),
    ).all()
    return doctors


@router.get("/accessible", response_model=list[UserResponse])
async def list_accessible_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """Return the users relevant to the authenticated session."""

    skip = max(skip, 0)
    limit = min(max(limit, 1), 200)
    role_text = normalized_enum_text(User.role)

    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        return (
            db.query(User)
            .filter(User.is_active.is_(True))
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    if current_user.role.value == "patient":
        return (
            db.query(User)
            .filter(
                User.is_active.is_(True),
                User.is_verified.is_(True),
                role_text.in_(
                    [
                        UserRole.PROVIDER.value,
                        UserRole.PHARMACIST.value,
                        UserRole.HOSPITAL.value,
                        UserRole.LABORATORY.value,
                        UserRole.IMAGING.value,
                        UserRole.AMBULANCE.value,
                        UserRole.PHYSIOTHERAPIST.value,
                    ]
                ),
            )
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view patient directory")
        patient_ids = provider_panel_patient_ids(db, current_user.id)
        query = db.query(User).filter(User.is_active.is_(True))
        patient_filter = User.id.in_(patient_ids) if patient_ids else User.id == current_user.id
        referral_destinations_filter = and_(
            User.is_verified.is_(True),
            role_text.in_(
                [
                    UserRole.HOSPITAL.value,
                    UserRole.LABORATORY.value,
                    UserRole.IMAGING.value,
                    UserRole.PHARMACIST.value,
                ]
            ),
        )
        query = query.filter(
            or_(
                patient_filter,
                User.id == current_user.id,
                referral_destinations_filter,
            )
        )
        return query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    if is_workforce_role(current_user.role):
        require_verified_workforce_member(current_user, "view patient directory")
        patient_ids = workforce_patient_ids(db, current_user.id)
        patient_filter = User.id.in_(patient_ids) if patient_ids else User.id == current_user.id
        return (
            db.query(User)
            .filter(
                User.is_active.is_(True),
                or_(
                    patient_filter,
                    and_(
                        User.is_verified.is_(True),
                        role_text == UserRole.PROVIDER.value,
                    ),
                ),
            )
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    return []


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get user information by ID"""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if current_user.id != user_id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user",
        )
    
    return user


@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""

    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can list all users"
        )

    limit = min(max(limit, 1), 200)
    users = db.query(User).offset(max(skip, 0)).limit(limit).all()
    return users
