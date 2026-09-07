"""External document library providers — Microsoft Graph and Google Drive."""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy.orm import Session

from app.models.doc_document import DocDocument, DocExternalRef, DocLibraryConnection
from app.schemas.doc_studio import ExternalBrowseItem
from app.services.doc_studio_export_service import file_to_markdown
from app.services.doc_studio_library_constants import (
    CUSTODY_DESTINATION_FOLDERS,
    REMOTE_STUDIO_ROOT_NAME,
)
from app.utils import token_encryption

logger = logging.getLogger(__name__)


def _path_leaf(path: Optional[str]) -> str:
    if not path or path in ("/", ""):
        return ""
    return path.rstrip("/").split("/")[-1]


def is_remote_studio_root_name(name: Optional[str]) -> bool:
    """True when a folder is the canonical Doc Studio remote root (case-insensitive)."""
    if not name:
        return False
    return name.strip().casefold() == REMOTE_STUDIO_ROOT_NAME.casefold()


def _get_encryptor():
    return token_encryption


class ExternalLibraryProvider(ABC):
    provider_id: str

    @abstractmethod
    def get_auth_url(self, district_code: str, redirect_uri: str) -> str:
        ...

    @abstractmethod
    async def exchange_code(
        self, code: str, redirect_uri: str
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def list_items(
        self,
        connection: DocLibraryConnection,
        folder_id: Optional[str] = None,
        drive_id: Optional[str] = None,
    ) -> List[ExternalBrowseItem]:
        ...

    @abstractmethod
    async def download_item(
        self, connection: DocLibraryConnection, item_id: str, drive_id: Optional[str] = None
    ) -> tuple[bytes, str, str]:
        ...

    @abstractmethod
    async def upload_item(
        self,
        connection: DocLibraryConnection,
        folder_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        ...

    @abstractmethod
    async def ensure_child_folder(
        self,
        connection: DocLibraryConnection,
        parent_folder_id: Optional[str],
        name: str,
    ) -> Dict[str, Any]:
        """Create or return an existing child folder. Returns id/name/path keys."""
        ...


class MicrosoftGraphProvider(ExternalLibraryProvider):
    provider_id = "microsoft_graph"

    def _tenant(self) -> str:
        return (
            os.getenv("DOC_STUDIO_MS_TENANT_ID")
            or os.getenv("EMAIL_TENANT_ID")
            or "common"
        )

    def get_auth_url(self, district_code: str, redirect_uri: str) -> str:
        import urllib.parse

        client_id = os.getenv("DOC_STUDIO_MS_CLIENT_ID") or os.getenv("EMAIL_CLIENT_ID", "")
        if not client_id.strip():
            raise ValueError(
                "Microsoft OAuth is not configured. Set DOC_STUDIO_MS_CLIENT_ID and "
                "DOC_STUDIO_MS_CLIENT_SECRET (and register redirect URI /studio)."
            )
        tenant = self._tenant()
        # Include User.Read so Studio connect tokens match SSO-seeded connections.
        scopes = "openid profile email offline_access User.Read Files.ReadWrite.All Sites.Read.All"
        return (
            f"https://login.microsoftonline.com/{urllib.parse.quote(tenant)}/oauth2/v2.0/authorize"
            f"?client_id={urllib.parse.quote(client_id)}"
            f"&response_type=code"
            f"&redirect_uri={urllib.parse.quote(redirect_uri, safe='')}"
            f"&scope={urllib.parse.quote(scopes)}"
            f"&state={urllib.parse.quote(district_code, safe='')}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        client_id = os.getenv("DOC_STUDIO_MS_CLIENT_ID") or os.getenv("EMAIL_CLIENT_ID", "")
        client_secret = os.getenv("DOC_STUDIO_MS_CLIENT_SECRET") or os.getenv("EMAIL_CLIENT_SECRET", "")
        tenant = self._tenant()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _access_token(self, connection: DocLibraryConnection) -> str:
        enc = _get_encryptor()
        if connection.encrypted_access_token:
            expires = connection.token_expires_at
            if expires and expires > datetime.utcnow():
                return enc.decrypt_value(connection.encrypted_access_token)
        if not connection.encrypted_refresh_token:
            raise RuntimeError("Microsoft connection missing refresh token")
        refresh = enc.decrypt_value(connection.encrypted_refresh_token)
        client_id = os.getenv("DOC_STUDIO_MS_CLIENT_ID") or os.getenv("EMAIL_CLIENT_ID", "")
        client_secret = os.getenv("DOC_STUDIO_MS_CLIENT_SECRET") or os.getenv("EMAIL_CLIENT_SECRET", "")
        tenant = self._tenant()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["access_token"]

    async def list_items(
        self,
        connection: DocLibraryConnection,
        folder_id: Optional[str] = None,
        drive_id: Optional[str] = None,
    ) -> List[ExternalBrowseItem]:
        token = await self._access_token(connection)
        if folder_id:
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}/children"
        else:
            url = "https://graph.microsoft.com/v1.0/me/drive/root/children"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            resp.raise_for_status()
            payload = resp.json()
        items: List[ExternalBrowseItem] = []
        for entry in payload.get("value", []):
            items.append(
                ExternalBrowseItem(
                    id=entry["id"],
                    name=entry["name"],
                    is_folder="folder" in entry,
                    mime_type=entry.get("file", {}).get("mimeType"),
                    web_url=entry.get("webUrl"),
                    size_bytes=entry.get("size"),
                    modified_at=entry.get("lastModifiedDateTime"),
                )
            )
        return items

    async def download_item(
        self, connection: DocLibraryConnection, item_id: str, drive_id: Optional[str] = None
    ) -> tuple[bytes, str, str]:
        token = await self._access_token(connection)
        meta_url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}"
        async with httpx.AsyncClient() as client:
            meta = await client.get(meta_url, headers={"Authorization": f"Bearer {token}"})
            meta.raise_for_status()
            info = meta.json()
            content_url = f"https://graph.microsoft.com/v1.0/me/drive/items/{item_id}/content"
            content = await client.get(content_url, headers={"Authorization": f"Bearer {token}"})
            content.raise_for_status()
            mime = info.get("file", {}).get("mimeType") or "application/octet-stream"
            return content.content, info["name"], mime

    async def upload_item(
        self,
        connection: DocLibraryConnection,
        folder_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        token = await self._access_token(connection)
        # Graph accepts /root:/path for drive root; item ids for nested folders.
        if not folder_id or folder_id in ("root", "/"):
            url = f"https://graph.microsoft.com/v1.0/me/drive/root:/{filename}:/content"
        else:
            url = (
                f"https://graph.microsoft.com/v1.0/me/drive/items/{folder_id}"
                f":/{filename}:/content"
            )
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                url,
                headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
                content=data,
            )
            resp.raise_for_status()
            return resp.json()

    async def ensure_child_folder(
        self,
        connection: DocLibraryConnection,
        parent_folder_id: Optional[str],
        name: str,
    ) -> Dict[str, Any]:
        existing = await self.list_items(connection, folder_id=parent_folder_id or None)
        for item in existing:
            if item.is_folder and item.name == name:
                return {"id": item.id, "name": item.name, "path": name}
        token = await self._access_token(connection)
        if not parent_folder_id or parent_folder_id in ("root", "/"):
            url = "https://graph.microsoft.com/v1.0/me/drive/root/children"
        else:
            url = f"https://graph.microsoft.com/v1.0/me/drive/items/{parent_folder_id}/children"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "name": name,
                    "folder": {},
                    "@microsoft.graph.conflictBehavior": "fail",
                },
            )
            if resp.status_code in (409, 405):
                existing = await self.list_items(connection, folder_id=parent_folder_id or None)
                for item in existing:
                    if item.is_folder and item.name == name:
                        return {"id": item.id, "name": item.name, "path": name}
            resp.raise_for_status()
            data = resp.json()
            return {"id": data["id"], "name": data["name"], "path": name}


class GoogleDriveProvider(ExternalLibraryProvider):
    provider_id = "google_drive"

    def get_auth_url(self, district_code: str, redirect_uri: str) -> str:
        import urllib.parse

        client_id = os.getenv("DOC_STUDIO_GOOGLE_CLIENT_ID", "")
        if not client_id.strip():
            raise ValueError(
                "Google OAuth is not configured. Set DOC_STUDIO_GOOGLE_CLIENT_ID and "
                "DOC_STUDIO_GOOGLE_CLIENT_SECRET (and register redirect URI /studio)."
            )
        scopes = (
            "openid email profile "
            "https://www.googleapis.com/auth/drive.readonly "
            "https://www.googleapis.com/auth/drive.file"
        )
        return (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={urllib.parse.quote(client_id)}"
            f"&response_type=code"
            f"&redirect_uri={urllib.parse.quote(redirect_uri, safe='')}"
            f"&scope={urllib.parse.quote(scopes)}"
            f"&access_type=offline&prompt=consent"
            f"&state={urllib.parse.quote(district_code, safe='')}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        client_id = os.getenv("DOC_STUDIO_GOOGLE_CLIENT_ID", "")
        client_secret = os.getenv("DOC_STUDIO_GOOGLE_CLIENT_SECRET", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _access_token(self, connection: DocLibraryConnection) -> str:
        enc = _get_encryptor()
        if connection.encrypted_access_token:
            expires = connection.token_expires_at
            if expires and expires > datetime.utcnow():
                return enc.decrypt_value(connection.encrypted_access_token)
        if not connection.encrypted_refresh_token:
            raise RuntimeError("Google connection missing refresh token")
        refresh = enc.decrypt_value(connection.encrypted_refresh_token)
        client_id = os.getenv("DOC_STUDIO_GOOGLE_CLIENT_ID", "")
        client_secret = os.getenv("DOC_STUDIO_GOOGLE_CLIENT_SECRET", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def list_items(
        self,
        connection: DocLibraryConnection,
        folder_id: Optional[str] = None,
        drive_id: Optional[str] = None,
    ) -> List[ExternalBrowseItem]:
        token = await self._access_token(connection)
        q = f"'{folder_id or 'root'}' in parents and trashed=false"
        url = "https://www.googleapis.com/drive/v3/files"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                params={"q": q, "fields": "files(id,name,mimeType,webViewLink,size,modifiedTime)"},
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            payload = resp.json()
        items: List[ExternalBrowseItem] = []
        for entry in payload.get("files", []):
            items.append(
                ExternalBrowseItem(
                    id=entry["id"],
                    name=entry["name"],
                    is_folder=entry.get("mimeType") == "application/vnd.google-apps.folder",
                    mime_type=entry.get("mimeType"),
                    web_url=entry.get("webViewLink"),
                    size_bytes=int(entry["size"]) if entry.get("size") else None,
                    modified_at=entry.get("modifiedTime"),
                )
            )
        return items

    async def download_item(
        self, connection: DocLibraryConnection, item_id: str, drive_id: Optional[str] = None
    ) -> tuple[bytes, str, str]:
        token = await self._access_token(connection)
        async with httpx.AsyncClient() as client:
            meta = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{item_id}",
                params={"fields": "name,mimeType"},
                headers={"Authorization": f"Bearer {token}"},
            )
            meta.raise_for_status()
            info = meta.json()
            content = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{item_id}?alt=media",
                headers={"Authorization": f"Bearer {token}"},
            )
            content.raise_for_status()
            return content.content, info["name"], info.get("mimeType") or "application/octet-stream"

    async def upload_item(
        self,
        connection: DocLibraryConnection,
        folder_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        token = await self._access_token(connection)
        metadata = {"name": filename, "parents": [folder_id]}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                headers={"Authorization": f"Bearer {token}"},
                files={
                    "metadata": ("metadata", str(metadata), "application/json"),
                    "file": (filename, data, content_type),
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def ensure_child_folder(
        self,
        connection: DocLibraryConnection,
        parent_folder_id: Optional[str],
        name: str,
    ) -> Dict[str, Any]:
        parent = parent_folder_id or "root"
        existing = await self.list_items(connection, folder_id=None if parent == "root" else parent)
        for item in existing:
            if item.is_folder and item.name == name:
                return {"id": item.id, "name": item.name, "path": name}
        token = await self._access_token(connection)
        metadata = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
            "parents": [parent],
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://www.googleapis.com/drive/v3/files",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=metadata,
                params={"fields": "id,name"},
            )
            resp.raise_for_status()
            data = resp.json()
            return {"id": data["id"], "name": data["name"], "path": name}


class DropboxProvider(ExternalLibraryProvider):
    """Dropbox App Folder connector — sandboxed to the app folder only."""

    provider_id = "dropbox"

    def get_auth_url(self, district_code: str, redirect_uri: str) -> str:
        import urllib.parse

        client_id = os.getenv("DOC_STUDIO_DROPBOX_APP_KEY", "")
        if not client_id.strip():
            raise ValueError(
                "Dropbox OAuth is not configured. Set DOC_STUDIO_DROPBOX_APP_KEY and "
                "DOC_STUDIO_DROPBOX_APP_SECRET (and register redirect URI /studio)."
            )
        # App folder access is configured in the Dropbox developer console.
        scopes = "account_info.read files.content.read files.content.write"
        return (
            "https://www.dropbox.com/oauth2/authorize"
            f"?client_id={urllib.parse.quote(client_id)}"
            f"&response_type=code"
            f"&redirect_uri={urllib.parse.quote(redirect_uri, safe='')}"
            f"&token_access_type=offline"
            f"&scope={urllib.parse.quote(scopes)}"
            f"&state={urllib.parse.quote(district_code, safe='')}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> Dict[str, Any]:
        client_id = os.getenv("DOC_STUDIO_DROPBOX_APP_KEY", "")
        client_secret = os.getenv("DOC_STUDIO_DROPBOX_APP_SECRET", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.dropboxapi.com/oauth2/token",
                data={
                    "code": code,
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def _access_token(self, connection: DocLibraryConnection) -> str:
        enc = _get_encryptor()
        if connection.encrypted_access_token:
            expires = connection.token_expires_at
            if expires and expires > datetime.utcnow():
                return enc.decrypt_value(connection.encrypted_access_token)
        if not connection.encrypted_refresh_token:
            raise RuntimeError("Dropbox connection missing refresh token")
        refresh = enc.decrypt_value(connection.encrypted_refresh_token)
        client_id = os.getenv("DOC_STUDIO_DROPBOX_APP_KEY", "")
        client_secret = os.getenv("DOC_STUDIO_DROPBOX_APP_SECRET", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.dropboxapi.com/oauth2/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    def _dropbox_path(self, folder_id: Optional[str]) -> str:
        if not folder_id or folder_id in ("root", ""):
            return ""
        return folder_id if folder_id.startswith("/") else f"/{folder_id}"

    async def list_items(
        self,
        connection: DocLibraryConnection,
        folder_id: Optional[str] = None,
        drive_id: Optional[str] = None,
    ) -> List[ExternalBrowseItem]:
        token = await self._access_token(connection)
        path = self._dropbox_path(folder_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.dropboxapi.com/2/files/list_folder",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"path": path, "recursive": False},
            )
            resp.raise_for_status()
            payload = resp.json()
        items: List[ExternalBrowseItem] = []
        for entry in payload.get("entries", []):
            tag = entry.get(".tag")
            items.append(
                ExternalBrowseItem(
                    id=entry.get("path_display") or entry.get("id", ""),
                    name=entry.get("name", ""),
                    is_folder=tag == "folder",
                    mime_type=None,
                    web_url=None,
                    size_bytes=entry.get("size"),
                    modified_at=entry.get("client_modified"),
                )
            )
        return items

    async def download_item(
        self, connection: DocLibraryConnection, item_id: str, drive_id: Optional[str] = None
    ) -> tuple[bytes, str, str]:
        import json

        token = await self._access_token(connection)
        path = self._dropbox_path(item_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://content.dropboxapi.com/2/files/download",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Dropbox-API-Arg": json.dumps({"path": path}),
                },
            )
            resp.raise_for_status()
            name = path.rsplit("/", 1)[-1] if path else "download"
            return resp.content, name, "application/octet-stream"

    async def upload_item(
        self,
        connection: DocLibraryConnection,
        folder_id: str,
        filename: str,
        data: bytes,
        content_type: str,
    ) -> Dict[str, Any]:
        import json

        token = await self._access_token(connection)
        folder_path = self._dropbox_path(folder_id)
        dest = f"{folder_path}/{filename}" if folder_path else f"/{filename}"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://content.dropboxapi.com/2/files/upload",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/octet-stream",
                    "Dropbox-API-Arg": json.dumps(
                        {"path": dest, "mode": "add", "autorename": True}
                    ),
                },
                content=data,
            )
            resp.raise_for_status()
            return resp.json()

    async def ensure_child_folder(
        self,
        connection: DocLibraryConnection,
        parent_folder_id: Optional[str],
        name: str,
    ) -> Dict[str, Any]:
        parent_path = self._dropbox_path(parent_folder_id)
        new_path = f"{parent_path}/{name}" if parent_path else f"/{name}"
        token = await self._access_token(connection)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.dropboxapi.com/2/files/create_folder_v2",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={"path": new_path, "autorename": False},
            )
            if resp.status_code == 409:
                meta = await client.post(
                    "https://api.dropboxapi.com/2/files/get_metadata",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                    },
                    json={"path": new_path},
                )
                meta.raise_for_status()
                data = meta.json()
                return {
                    "id": data.get("path_display") or new_path,
                    "name": data.get("name") or name,
                    "path": data.get("path_display") or new_path,
                }
            resp.raise_for_status()
            meta = resp.json().get("metadata") or {}
            return {
                "id": meta.get("path_display") or new_path,
                "name": meta.get("name") or name,
                "path": meta.get("path_display") or new_path,
            }


PROVIDERS: Dict[str, ExternalLibraryProvider] = {
    "microsoft_graph": MicrosoftGraphProvider(),
    "google_drive": GoogleDriveProvider(),
    "dropbox": DropboxProvider(),
}


def get_provider(provider_id: str) -> ExternalLibraryProvider:
    provider = PROVIDERS.get(provider_id)
    if not provider:
        raise ValueError(f"Unknown provider: {provider_id}")
    return provider


class ExternalLibraryService:
    def __init__(self, db: Session):
        self.db = db

    def save_connection(
        self,
        owner_type: str,
        owner_code: str,
        provider: str,
        token_payload: Dict[str, Any],
        connected_by: Optional[int],
        account_email: Optional[str] = None,
    ) -> DocLibraryConnection:
        enc = _get_encryptor()
        conn = (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
                DocLibraryConnection.provider == provider,
            )
            .first()
        )
        if not conn:
            conn = DocLibraryConnection(
                owner_type=owner_type,
                owner_code=owner_code,
                provider=provider,
                connected_by=connected_by,
            )
            self.db.add(conn)
        if token_payload.get("refresh_token"):
            conn.encrypted_refresh_token = enc.encrypt_value(token_payload["refresh_token"])
        if token_payload.get("access_token"):
            conn.encrypted_access_token = enc.encrypt_value(token_payload["access_token"])
        expires_in = token_payload.get("expires_in")
        if expires_in:
            from datetime import timedelta

            conn.token_expires_at = datetime.utcnow() + timedelta(seconds=int(expires_in))
        conn.account_email = account_email
        conn.is_active = True
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def update_default_folder(
        self,
        connection_id: str,
        owner_type: str,
        owner_code: str,
        folder_id: Optional[str],
        folder_path: Optional[str],
    ) -> DocLibraryConnection:
        conn = (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.id == connection_id,
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
            )
            .first()
        )
        if not conn:
            raise ValueError("Library connection not found")
        conn.default_folder_id = folder_id or "root"
        conn.default_folder_path = folder_path or "/"
        self.db.commit()
        self.db.refresh(conn)
        return conn

    def disconnect_connection(
        self,
        connection_id: str,
        owner_type: str,
        owner_code: str,
    ) -> None:
        conn = (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.id == connection_id,
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
            )
            .first()
        )
        if not conn:
            raise ValueError("Library connection not found")
        conn.is_active = False
        conn.encrypted_access_token = None
        conn.encrypted_refresh_token = None
        conn.token_expires_at = None
        conn.default_folder_id = None
        conn.default_folder_path = None
        self.db.commit()

    async def ensure_remote_structure(
        self,
        connection: DocLibraryConnection,
        parent_folder_id: Optional[str] = None,
        parent_folder_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Ensure AquaSafe Document Studio + default folders under parent (no nested roots)."""
        provider = get_provider(connection.provider)
        parent_id = parent_folder_id if parent_folder_id not in (None, "") else "root"
        parent_path = parent_folder_path or ("/" if parent_id in ("root", "/") else parent_id)
        parent_leaf = _path_leaf(parent_path)

        # If the user is already inside the studio root (or re-selects the saved
        # destination), reuse it — do not create AquaSafe Document Studio / … / AquaSafe…
        reuse_parent = False
        if parent_id not in ("root", "/"):
            if is_remote_studio_root_name(parent_leaf):
                reuse_parent = True
            elif (
                connection.default_folder_id
                and parent_id == connection.default_folder_id
                and is_remote_studio_root_name(_path_leaf(connection.default_folder_path))
            ):
                reuse_parent = True

        if reuse_parent:
            root_id = parent_id
            if parent_path.startswith("/"):
                root_path = parent_path.rstrip("/") or f"/{REMOTE_STUDIO_ROOT_NAME}"
            elif parent_path and parent_path not in ("root", "/"):
                root_path = f"/{parent_path.strip('/')}"
            else:
                root_path = (
                    connection.default_folder_path
                    if connection.default_folder_path
                    and str(connection.default_folder_path).startswith("/")
                    else f"/{REMOTE_STUDIO_ROOT_NAME}"
                )
        else:
            root = await provider.ensure_child_folder(
                connection,
                None if parent_id in ("root", "/") else parent_id,
                REMOTE_STUDIO_ROOT_NAME,
            )
            root_id = root["id"]
            root_path = (
                f"{parent_path.rstrip('/')}/{REMOTE_STUDIO_ROOT_NAME}"
                if parent_path not in ("/", "")
                else f"/{REMOTE_STUDIO_ROOT_NAME}"
            )
            provider_path = root.get("path")
            if isinstance(provider_path, str) and provider_path.startswith("/"):
                root_path = provider_path

        children = []
        for name in CUSTODY_DESTINATION_FOLDERS:
            child = await provider.ensure_child_folder(connection, root_id, name)
            children.append(child)

        connection.default_folder_id = root_id
        connection.default_folder_path = root_path
        self.db.commit()
        self.db.refresh(connection)
        return {
            "root": {
                "id": root_id,
                "path": connection.default_folder_path,
                "name": REMOTE_STUDIO_ROOT_NAME,
            },
            "children": children,
            "connection": connection,
        }

    def list_connections(
        self,
        owner_type: str,
        owner_code: str,
    ) -> List[DocLibraryConnection]:
        return (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
                DocLibraryConnection.is_active.is_(True),
            )
            .all()
        )

    async def import_or_link(
        self,
        scope: str,
        owner_type: str,
        owner_code: str,
        connection_id: str,
        item_id: str,
        mode: str,
        folder_id: Optional[str],
        created_by: Optional[int],
        drive_id: Optional[str] = None,
    ) -> DocDocument:
        conn = self._get_connection(owner_type, owner_code, connection_id)
        provider = get_provider(conn.provider)
        if mode == "link":
            items = await provider.list_items(conn, folder_id=drive_id)
            item = next((i for i in items if i.id == item_id), None)
            if not item:
                meta_name = item_id
                web_url = None
                mime = None
            else:
                meta_name = item.name
                web_url = item.web_url
                mime = item.mime_type
            doc = DocDocument(
                scope=scope,
                folder_id=folder_id,
                title=meta_name,
                doc_type="document",
                status="published",
                summary="Linked from external library",
                created_by=created_by,
                updated_by=created_by,
            )
            self.db.add(doc)
            self.db.flush()
            ref = DocExternalRef(
                document_id=doc.id,
                connection_id=conn.id,
                provider=conn.provider,
                external_item_id=item_id,
                external_drive_id=drive_id,
                external_web_url=web_url,
                external_mime_type=mime,
            )
            self.db.add(ref)
            self.db.commit()
            self.db.refresh(doc)
            return doc

        data, name, mime = await provider.download_item(conn, item_id, drive_id)
        try:
            markdown = file_to_markdown(name, mime, data)
        except Exception:
            markdown = f"*[Imported file: {name}]*"
        doc = DocDocument(
            scope=scope,
            folder_id=folder_id,
            title=name,
            doc_type="imported_file",
            status="draft",
            source_filename=name,
            content_markdown=markdown,
            word_count=len(markdown.split()),
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(doc)
        self.db.flush()
        ref = DocExternalRef(
            document_id=doc.id,
            connection_id=conn.id,
            provider=conn.provider,
            external_item_id=item_id,
            external_drive_id=drive_id,
            external_mime_type=mime,
        )
        self.db.add(ref)
        self.db.commit()
        self.db.refresh(doc)
        return doc

    def _get_connection(self, owner_type: str, owner_code: str, connection_id: str) -> DocLibraryConnection:
        conn = (
            self.db.query(DocLibraryConnection)
            .filter(
                DocLibraryConnection.id == connection_id,
                DocLibraryConnection.owner_type == owner_type,
                DocLibraryConnection.owner_code == owner_code,
            )
            .first()
        )
        if not conn:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Library connection not found")
        return conn
