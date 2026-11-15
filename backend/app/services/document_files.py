"""Checks for uploaded and downloaded case documents (owner: Asif; API_SPEC §6.5, plan §5 item 6).

- The file type comes from the file's **first bytes**, never from its name or the
  browser's Content-Type, so a renamed executable can't pass as a PDF.
- At most 10 MB (``413 FILE_TOO_LARGE``); anything else unacceptable is ``400 BAD_REQUEST``.
- Downloads are always ``attachment`` with ``nosniff`` and a header-safe filename,
  so a browser never renders an uploaded file inside our origin.
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Final, Literal
from urllib.parse import quote

MAX_UPLOAD_BYTES: Final = 10 * 1024 * 1024
MAX_FILENAME: Final = 255
TEXT_SAMPLE: Final = 8192

MimeType = Literal["application/pdf", "image/png", "image/jpeg", "text/plain"]
_EXTENSION: Final[dict[str, str]] = {
    "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "text/plain": ".txt",
}


class UploadRejected(ValueError):
    """Maps to the contract's errors: ``code`` is BAD_REQUEST (400) or FILE_TOO_LARGE (413)."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class CheckedFile:
    filename: str
    mime_type: MimeType
    size_bytes: int
    sha256: str


def _looks_like_text(data: bytes) -> bool:
    sample = data[:TEXT_SAMPLE]
    if b"\x00" in sample:
        return False
    try:
        decoded = sample.decode("utf-8")
    except UnicodeDecodeError as exc:
        if exc.start < len(sample) - 4:  # a cut multi-byte character at the very end is fine
            return False
        decoded = sample[: exc.start].decode("utf-8")
    printable = sum(ch.isprintable() or ch in "\n\r\t" for ch in decoded)
    return bool(decoded) and printable / len(decoded) > 0.95


def sniff_mime(data: bytes) -> MimeType | None:
    """The real type of ``data`` from its signature, or None if it isn't an allowed type."""
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if _looks_like_text(data):
        return "text/plain"
    return None


def safe_filename(name: str | None, mime_type: MimeType) -> str:
    """Keep only the base name, drop control and path characters, cap the length."""
    base = re.split(r"[\\/]", name or "")[-1]
    base = unicodedata.normalize("NFC", base)
    base = "".join(ch for ch in base if ch.isprintable() and ch not in '<>:"|?*')
    base = base.strip(" .")
    if not base:
        base = "document" + _EXTENSION[mime_type]
    if len(base) > MAX_FILENAME:
        stem, dot, ext = base.rpartition(".")
        keep = ("." + ext) if dot and len(ext) <= 10 else ""
        base = base[: MAX_FILENAME - len(keep)] + keep
    return base


def check_upload(data: bytes, filename: str | None) -> CheckedFile:
    """Validate an upload. Raises UploadRejected with the contract's status and code."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadRejected(413, "FILE_TOO_LARGE", "The file is larger than 10 MB")
    if not data:
        raise UploadRejected(400, "BAD_REQUEST", "The file is empty")
    mime_type = sniff_mime(data)
    if mime_type is None:
        raise UploadRejected(400, "BAD_REQUEST", "Only PDF, PNG, JPG or TXT files are accepted")
    return CheckedFile(
        filename=safe_filename(filename, mime_type),
        mime_type=mime_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
    )


def download_headers(filename: str, mime_type: str) -> dict[str, str]:
    """Headers for ``GET /api/documents/{id}/file``: always a download, never rendered inline."""
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 and ch not in '"\\' else "_" for ch in filename) or "document"
    return {
        "Content-Type": mime_type,
        "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(filename, safe='')}",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    }
