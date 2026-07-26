from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.schemas.canonical_records import OrganizationCreate, OrganizationListResponse, OrganizationResponse
from app.utils.access import current_user_organization
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        rows = db.query(Organization).order_by(Organization.name.asc()).all()
    else:
        current_org = current_user_organization(db, current_user)
        rows = [current_org] if current_org else []

    return OrganizationListResponse(total=len([row for row in rows if row]), items=[OrganizationResponse(**row.to_dict()) for row in rows if row])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    body: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create organizations")

    existing = db.query(Organization).filter(Organization.slug == body.slug).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An organization with that slug already exists")

    organization = Organization(
        name=body.name,
        slug=body.slug,
        organization_type=body.organization_type,
        description=body.description,
        created_by=current_user.id,
    )
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return OrganizationResponse(**organization.to_dict())
