from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional


class VideoCallBase(BaseModel):
    reason_for_call: Optional[str] = None
    appointment_id: Optional[int] = None


class VideoCallCreate(VideoCallBase):
    provider_id: int


class VideoCallUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    call_quality: Optional[str] = None


class VideoCallResponse(VideoCallBase):
    id: int
    patient_id: int
    provider_id: int
    call_token: str
    status: str
    channel_name: str
    initiated_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    recording_url: Optional[str]
    
    model_config = ConfigDict(from_attributes=True)


class MessageBase(BaseModel):
    content: str
    subject: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None


class MessageCreate(MessageBase):
    recipient_id: int


class MessageUpdate(BaseModel):
    content: Optional[str] = None
    is_read: Optional[str] = None
    is_archived: Optional[str] = None


class MessageResponse(MessageBase):
    id: int
    sender_id: int
    recipient_id: int
    is_read: str
    is_archived: str
    created_at: datetime
    read_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)
