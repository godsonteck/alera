from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Cookie
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from app.models.telemedicine import VideoCall, Message
from app.models.user import User, UserRole
from app.schemas.telemedicine import VideoCallResponse, VideoCallCreate, VideoCallUpdate, MessageResponse, MessageCreate, MessageUpdate
from app.utils.dependencies import get_current_user
from app.utils.access import require_verified_workforce_member
from app.utils.time import utcnow
from app.utils.auth import get_user_id_from_token
from app.utils.websocket_manager import manager
import uuid

router = APIRouter(prefix="/api/telemedicine", tags=["telemedicine"])


def _user_role_value(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def _ensure_telemedicine_participant(user: User, action: str) -> None:
    if user.role == UserRole.PATIENT:
        return
    require_verified_workforce_member(user, action)


def _is_call_pair_allowed(user: User, recipient: User) -> bool:
    roles = {_user_role_value(user), _user_role_value(recipient)}
    return roles == {"patient", "provider"}


# ============ VIDEO CALLS ============

@router.post("/video-calls/", response_model=VideoCallResponse, status_code=status.HTTP_201_CREATED)
async def initiate_video_call(
    call_data: VideoCallCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate a video call with a provider"""
    if current_user.role.value != "patient":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can initiate video calls"
        )

    # Verify provider exists
    provider = db.query(User).filter(User.id == call_data.provider_id).first()
    if not provider or provider.role.value != "provider" or not provider.is_active or not provider.is_verified:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found"
        )
    
    # Generate unique call token and channel
    call_token = str(uuid.uuid4())
    channel_name = f"alera_{current_user.id}_{call_data.provider_id}_{utcnow().timestamp()}"
    
    db_call = VideoCall(
        patient_id=current_user.id,
        provider_id=call_data.provider_id,
        appointment_id=call_data.appointment_id,
        call_token=call_token,
        channel_name=channel_name,
        reason_for_call=call_data.reason_for_call,
        status="initiated"
    )
    
    db.add(db_call)
    db.commit()
    db.refresh(db_call)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="telemedicine.video_call.initiate",
        resource_type="video_call",
        resource_id=db_call.id,
        description=f"Initiated video call with provider {provider.id}",
        status="created",
    )
    
    return db_call


@router.get("/video-calls/", response_model=list[VideoCallResponse])
async def list_video_calls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """List video calls for current user"""
    
    if current_user.role.value == "patient":
        calls = db.query(VideoCall).filter(
            VideoCall.patient_id == current_user.id
        ).order_by(VideoCall.initiated_at.desc()).offset(skip).limit(limit).all()
    elif current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view telemedicine calls")
        calls = db.query(VideoCall).filter(
            VideoCall.provider_id == current_user.id
        ).order_by(VideoCall.initiated_at.desc()).offset(skip).limit(limit).all()
    elif current_user.is_admin_or_super():
        calls = db.query(VideoCall).order_by(VideoCall.initiated_at.desc()).offset(skip).limit(limit).all()
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    return calls


@router.get("/video-calls/{call_id}", response_model=VideoCallResponse)
async def get_video_call(
    call_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get video call details"""
    
    call = db.query(VideoCall).filter(VideoCall.id == call_id).first()
    
    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video call not found"
        )
    
    # Verify access
    if call.patient_id != current_user.id and call.provider_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "view telemedicine calls")
    
    return call


@router.put("/video-calls/{call_id}", response_model=VideoCallResponse)
async def update_video_call(
    call_id: int,
    call_update: VideoCallUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update video call status"""
    
    call = db.query(VideoCall).filter(VideoCall.id == call_id).first()
    
    if not call:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video call not found"
        )
    
    # Verify access
    if call.patient_id != current_user.id and call.provider_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )

    if current_user.role.value == "provider":
        require_verified_workforce_member(current_user, "update telemedicine calls")
    
    # Update fields
    update_data = call_update.dict(exclude_unset=True)
    
    # Special handling for status change
    if "status" in update_data:
        if update_data["status"] == "connected" and call.started_at is None:
            call.started_at = utcnow()
        elif update_data["status"] == "ended" and call.ended_at is None:
            call.ended_at = utcnow()
            if call.started_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())
    
    for field, value in update_data.items():
        setattr(call, field, value)
    
    db.commit()
    db.refresh(call)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="telemedicine.video_call.update",
        resource_type="video_call",
        resource_id=call.id,
        description=f"Updated call status to {call.status}",
        status="updated",
    )
    
    return call


# ============ MESSAGING ============

@router.post("/messages/", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send message to another user"""
    if current_user.role.value != "patient":
        require_verified_workforce_member(current_user, "send telemedicine messages")

    # Verify recipient exists
    recipient = db.query(User).filter(User.id == message_data.recipient_id).first()
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found"
        )
    
    db_message = Message(
        sender_id=current_user.id,
        recipient_id=message_data.recipient_id,
        content=message_data.content,
        subject=message_data.subject,
        attachment_url=message_data.attachment_url,
        attachment_type=message_data.attachment_type
    )
    
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    from app.routes.audit import log_action

    await log_action(
        db=db,
        user_id=current_user.id,
        action="telemedicine.message.send",
        resource_type="message",
        resource_id=db_message.id,
        description=f"Sent message to user {recipient.id}",
        status="created",
    )
    
    return db_message


@router.get("/messages/", response_model=list[MessageResponse])
async def list_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    conversation_with_id: int = None,
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50
):
    """List messages for current user"""

    if current_user.role != UserRole.PATIENT and not current_user.is_admin_or_super():
        require_verified_workforce_member(current_user, "view telemedicine messages")
    
    query = db.query(Message).filter(
        (Message.recipient_id == current_user.id) | (Message.sender_id == current_user.id)
    )
    
    if conversation_with_id:
        query = query.filter(
            ((Message.sender_id == current_user.id) & (Message.recipient_id == conversation_with_id)) |
            ((Message.sender_id == conversation_with_id) & (Message.recipient_id == current_user.id))
        )
    
    if unread_only:
        query = query.filter(
            (Message.recipient_id == current_user.id) & (Message.is_read == "N")
        )
    
    messages = query.order_by(Message.created_at.desc()).offset(skip).limit(limit).all()
    
    return messages


@router.get("/messages/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get message details"""

    if current_user.role != UserRole.PATIENT and not current_user.is_admin_or_super():
        require_verified_workforce_member(current_user, "view telemedicine messages")
    
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Verify access
    if message.sender_id != current_user.id and message.recipient_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
    
    # Mark as read if recipient
    if message.recipient_id == current_user.id and message.is_read == "N":
        message.is_read = "Y"
        message.read_at = utcnow()
        db.commit()
    
    return message


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: int,
    message_update: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update message (archive, etc.)"""

    if current_user.role != UserRole.PATIENT and not current_user.is_admin_or_super():
        require_verified_workforce_member(current_user, "update telemedicine messages")
    
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Verify access
    if message.sender_id != current_user.id and message.recipient_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
    
    update_data = message_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(message, field, value)
    
    db.commit()
    db.refresh(message)
    
    return message


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete message"""

    if current_user.role != UserRole.PATIENT and not current_user.is_admin_or_super():
        require_verified_workforce_member(current_user, "delete telemedicine messages")
    
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )
    
    # Verify access - only sender can delete
    if message.sender_id != current_user.id:
        if not current_user.is_admin_or_super():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized"
            )
    
    db.delete(message)
    db.commit()
    
    return {"message": "Message deleted"}


@router.websocket("/ws")
async def telemedicine_websocket(
    websocket: WebSocket,
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if not access_token:
        await websocket.close(code=4001)
        return

    try:
        user_id = get_user_id_from_token(access_token)
    except HTTPException:
        await websocket.close(code=4003)
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        await websocket.close(code=4003)
        return

    await manager.connect_user(websocket, user.id)

    try:
        await websocket.send_json({
            "type": "telemedicine.ready",
            "user_id": user.id,
            "role": _user_role_value(user),
        })

        while True:
            payload = await websocket.receive_json()
            message_type = payload.get("type")

            if message_type == "chat_message":
                _ensure_telemedicine_participant(user, "send telemedicine messages")

                recipient_id = payload.get("recipient_id")
                content = str(payload.get("content") or "").strip()
                if not recipient_id or not content:
                    await websocket.send_json({"type": "error", "detail": "recipient_id and content are required"})
                    continue

                recipient = db.query(User).filter(User.id == int(recipient_id)).first()
                if not recipient or not recipient.is_active:
                    await websocket.send_json({"type": "error", "detail": "Recipient not found"})
                    continue

                db_message = Message(
                    sender_id=user.id,
                    recipient_id=recipient.id,
                    content=content,
                    subject=payload.get("subject"),
                    attachment_url=payload.get("attachment_url"),
                    attachment_type=payload.get("attachment_type"),
                )
                db.add(db_message)
                db.commit()
                db.refresh(db_message)

                event = {
                    "type": "chat_message",
                    "message": {
                        "id": db_message.id,
                        "sender_id": db_message.sender_id,
                        "recipient_id": db_message.recipient_id,
                        "content": db_message.content,
                        "subject": db_message.subject,
                        "is_read": db_message.is_read,
                        "is_archived": db_message.is_archived,
                        "created_at": db_message.created_at.isoformat(),
                    },
                }
                await manager.send_to_user(user.id, event)
                await manager.send_to_user(recipient.id, event)

            elif message_type == "call_invite":
                _ensure_telemedicine_participant(user, "start telemedicine calls")

                recipient_id = payload.get("recipient_id")
                if not recipient_id:
                    await websocket.send_json({"type": "error", "detail": "recipient_id is required"})
                    continue

                recipient = db.query(User).filter(User.id == int(recipient_id)).first()
                if not recipient or not recipient.is_active:
                    await websocket.send_json({"type": "error", "detail": "Recipient not found"})
                    continue

                if not _is_call_pair_allowed(user, recipient):
                    await websocket.send_json({"type": "error", "detail": "Video calls are limited to patient/provider sessions"})
                    continue

                patient_id = user.id if user.role == UserRole.PATIENT else recipient.id
                provider_id = user.id if user.role == UserRole.PROVIDER else recipient.id
                db_call = VideoCall(
                    patient_id=patient_id,
                    provider_id=provider_id,
                    appointment_id=payload.get("appointment_id"),
                    call_token=str(uuid.uuid4()),
                    channel_name=f"alera_{patient_id}_{provider_id}_{utcnow().timestamp()}",
                    reason_for_call=payload.get("reason_for_call"),
                    status="ringing",
                )
                db.add(db_call)
                db.commit()
                db.refresh(db_call)

                sender_event = {
                    "type": "call_invite_sent",
                    "call": {
                        "id": db_call.id,
                        "participant_id": recipient.id,
                        "participant_name": f"{recipient.first_name} {recipient.last_name}".strip() or recipient.email,
                        "participant_role": "doctor" if recipient.role == UserRole.PROVIDER else _user_role_value(recipient),
                        "status": "ringing",
                    },
                }
                recipient_event = {
                    "type": "incoming_call",
                    "call": {
                        "id": db_call.id,
                        "participant_id": user.id,
                        "participant_name": f"{user.first_name} {user.last_name}".strip() or user.email,
                        "participant_role": "doctor" if user.role == UserRole.PROVIDER else _user_role_value(user),
                        "status": "ringing",
                    },
                }
                await manager.send_to_user(user.id, sender_event)
                await manager.send_to_user(recipient.id, recipient_event)

            elif message_type == "call_response":
                call_id = payload.get("call_id")
                response = payload.get("response")
                if not call_id or response not in {"accepted", "declined"}:
                    await websocket.send_json({"type": "error", "detail": "call_id and valid response are required"})
                    continue

                db_call = db.query(VideoCall).filter(VideoCall.id == int(call_id)).first()
                if not db_call or user.id not in {db_call.patient_id, db_call.provider_id}:
                    await websocket.send_json({"type": "error", "detail": "Call not found"})
                    continue

                other_user_id = db_call.provider_id if db_call.patient_id == user.id else db_call.patient_id
                db_call.status = "connected" if response == "accepted" else "ended"
                if response == "accepted" and db_call.started_at is None:
                    db_call.started_at = utcnow()
                if response == "declined":
                    db_call.ended_at = utcnow()
                db.commit()

                event_type = "call_accepted" if response == "accepted" else "call_declined"
                event = {
                    "type": event_type,
                    "call_id": db_call.id,
                    "sender_id": user.id,
                }
                await manager.send_to_user(other_user_id, event)
                await manager.send_to_user(user.id, event)

            elif message_type == "webrtc_signal":
                call_id = payload.get("call_id")
                recipient_id = payload.get("recipient_id")
                signal_type = payload.get("signal_type")
                signal_payload = payload.get("payload")
                if not call_id or not recipient_id or signal_type not in {"offer", "answer", "ice-candidate"}:
                    await websocket.send_json({"type": "error", "detail": "Invalid signaling payload"})
                    continue

                db_call = db.query(VideoCall).filter(VideoCall.id == int(call_id)).first()
                if not db_call or user.id not in {db_call.patient_id, db_call.provider_id}:
                    await websocket.send_json({"type": "error", "detail": "Call not found"})
                    continue

                await manager.send_to_user(int(recipient_id), {
                    "type": "webrtc_signal",
                    "call_id": db_call.id,
                    "sender_id": user.id,
                    "signal_type": signal_type,
                    "payload": signal_payload,
                })

            elif message_type == "call_end":
                call_id = payload.get("call_id")
                if not call_id:
                    await websocket.send_json({"type": "error", "detail": "call_id is required"})
                    continue

                db_call = db.query(VideoCall).filter(VideoCall.id == int(call_id)).first()
                if not db_call or user.id not in {db_call.patient_id, db_call.provider_id}:
                    await websocket.send_json({"type": "error", "detail": "Call not found"})
                    continue

                other_user_id = db_call.provider_id if db_call.patient_id == user.id else db_call.patient_id
                db_call.status = "ended"
                if db_call.started_at and db_call.ended_at is None:
                    db_call.ended_at = utcnow()
                    db_call.duration_seconds = int((db_call.ended_at - db_call.started_at).total_seconds())
                elif db_call.ended_at is None:
                    db_call.ended_at = utcnow()
                db.commit()

                event = {
                    "type": "call_ended",
                    "call_id": db_call.id,
                    "sender_id": user.id,
                }
                await manager.send_to_user(other_user_id, event)
                await manager.send_to_user(user.id, event)

            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect_user(websocket, user.id)
    except Exception:
        manager.disconnect_user(websocket, user.id)
        await websocket.close(code=4000)
