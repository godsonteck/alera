from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Cookie
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db
from app.utils.websocket_manager import manager
from app.utils.auth import get_user_id_from_token
from app.models.ambulance import AmbulanceRequest
from app.models.user import User, UserRole
from app.utils.access import require_verified_workforce_member
from app.utils.time import utcnow
import json
import logging

router = APIRouter(prefix="/api/ws/location", tags=["websocket"])

logger = logging.getLogger(__name__)


def _can_track_request(user: User, db_request: AmbulanceRequest) -> bool:
    if user.role == UserRole.PATIENT:
        return db_request.patient_id == user.id
    if user.role == UserRole.AMBULANCE:
        require_verified_workforce_member(user, "track emergency locations")
        return db_request.assigned_ambulance_id in (None, user.id)
    if user.role in [UserRole.HOSPITAL, UserRole.PROVIDER]:
        require_verified_workforce_member(user, "track emergency locations")
        return True
    return user.is_admin_or_super()

@router.websocket("/{request_id}")
async def location_websocket(
    websocket: WebSocket,
    request_id: str,
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint for live location tracking.
    access_token: JWT access token passed as a cookie.
    request_id: The ID of the ambulance request being tracked.
    """
    try:
        # 1. Authenticate user
        if not access_token:
            logger.warning("WebSocket connection attempt without cookie auth")
            await websocket.close(code=4001) # Missing token
            return

        user_id = get_user_id_from_token(access_token)
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            await websocket.close(code=4003) # Forbidden
            return

        try:
            db_request_id = int(request_id)
        except ValueError:
            await websocket.close(code=4004)
            return

        db_request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == db_request_id).first()
        if not db_request:
            await websocket.close(code=4004)
            return

        if not _can_track_request(user, db_request):
            await websocket.close(code=4003)
            return

        # 3. Connect to room
        await manager.connect(websocket, request_id)
        logger.info(f"User {user_id} connected to tracking room {request_id}")

        if db_request.patient_id:
            patient = db.query(User).filter(User.id == db_request.patient_id).first()
            if patient and patient.live_location_sharing_enabled and patient.live_latitude and patient.live_longitude:
                await websocket.send_json({
                    "type": "location_snapshot",
                    "user_id": patient.id,
                    "role": patient.role.value if hasattr(patient.role, "value") else str(patient.role),
                    "lat": float(patient.live_latitude),
                    "lng": float(patient.live_longitude),
                    "timestamp": patient.live_location_updated_at.isoformat() if patient.live_location_updated_at else None,
                })

        if db_request.assigned_ambulance_id:
            ambulance = db.query(User).filter(User.id == db_request.assigned_ambulance_id).first()
            if ambulance and ambulance.live_location_sharing_enabled and ambulance.live_latitude and ambulance.live_longitude:
                await websocket.send_json({
                    "type": "location_snapshot",
                    "user_id": ambulance.id,
                    "role": ambulance.role.value if hasattr(ambulance.role, "value") else str(ambulance.role),
                    "lat": float(ambulance.live_latitude),
                    "lng": float(ambulance.live_longitude),
                    "timestamp": ambulance.live_location_updated_at.isoformat() if ambulance.live_location_updated_at else None,
                })

        # 4. Handle messages
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Expected message format: {"type": "location_update", "lat": float, "lng": float, "heading": float, "speed": float}
                if message.get("type") == "location_update":
                    lat = message.get("lat")
                    lng = message.get("lng")
                    if lat is None or lng is None:
                        continue

                    # Update user object in memory for broadcasting
                    user.live_location_sharing_enabled = True
                    user.live_latitude = float(lat)
                    user.live_longitude = float(lng)
                    user.live_location_updated_at = utcnow()

                    # Throttled Database Persistence
                    from app.utils.redis import redis_get, redis_set
                    throttle_key = f"location_throttle:{user.id}"
                    
                    if not redis_get(throttle_key):
                        # Not throttled, update DB
                        db.add(user)
                        db.commit()
                        # Set throttle for 10 seconds
                        redis_set(throttle_key, "1", ex=10)
                    else:
                        # Throttled, just update Redis for fast recovery/snapshotting
                        redis_set(f"user:location:{user.id}", json.dumps({
                            "lat": user.live_latitude,
                            "lng": user.live_longitude,
                            "ts": user.live_location_updated_at.isoformat()
                        }), ex=60)

                    # Add sender info
                    message["user_id"] = user.id
                    message["role"] = user.role.value if hasattr(user.role, 'value') else str(user.role)
                    message["timestamp"] = user.live_location_updated_at.isoformat()
                    
                    # Broadcast to everyone else in the room
                    await manager.broadcast_to_room(message, request_id, sender_websocket=websocket)
                
                elif message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})

        except WebSocketDisconnect:
            # Final persistence on disconnect
            try:
                db.add(user)
                db.commit()
            except Exception:
                pass
            
            manager.disconnect(websocket, request_id)
            logger.info(f"User {user_id} disconnected from tracking room {request_id}")
            
    except Exception as e:
        logger.error(f"Error in location websocket: {e}")
        await websocket.close(code=4000)
