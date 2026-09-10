from typing import List, Optional

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    district_code: Optional[str] = None
    roles: Optional[List[str]] = None
    districts: Optional[List[str]] = None
    assigned_districts: Optional[List[str]] = None
    iss: Optional[str] = None
