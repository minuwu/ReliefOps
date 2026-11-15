"""app/services/document_files.py: uploads are judged by their bytes; downloads never render inline."""

from __future__ import annotations

import hashlib

import pytest

from app.services import document_files as files

PDF = b"%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 16
TEXT = "Transfer amount: ¥250,000\nDate: 2026/10/28\n".encode()


@pytest.mark.parametrize(
    ("data", "mime"),
    [(PDF, "application/pdf"), (PNG, "image/png"), (JPEG, "image/jpeg"), (TEXT, "text/plain")],
)
def test_allowed_types_are_recognised_by_their_bytes(data: bytes, mime: str) -> None:
    checked = files.check_upload(data, "upload.bin")
    assert checked.mime_type == mime
    assert checked.size_bytes == len(data)
    assert checked.sha256 == hashlib.sha256(data).hexdigest()


@pytest.mark.parametrize(
    "data",
    [
        b"MZ\x90\x00\x03\x00\x00\x00",           # Windows executable
        b"PK\x03\x04" + b"\x00" * 20,            # zip / docx
        b"GIF89a" + b"\x00" * 10,                # gif (not allowed)
        b"\x00\x01\x02\x03binary\x00",           # binary with NUL bytes
        "plain text".encode("utf-16"),           # not UTF-8
    ],
)
def test_other_types_are_rejected_with_400(data: bytes) -> None:
    with pytest.raises(files.UploadRejected) as caught:
        files.check_upload(data, "receipt.pdf")  # the name lies; the bytes decide
    assert (caught.value.status, caught.value.code) == (400, "BAD_REQUEST")


def test_empty_file_is_rejected() -> None:
    with pytest.raises(files.UploadRejected, match="empty"):
        files.check_upload(b"", "x.txt")


def test_more_than_10_mb_is_413() -> None:
    with pytest.raises(files.UploadRejected) as caught:
        files.check_upload(b"%PDF-" + b"0" * files.MAX_UPLOAD_BYTES, "big.pdf")
    assert (caught.value.status, caught.value.code) == (413, "FILE_TOO_LARGE")


def test_exactly_10_mb_is_accepted() -> None:
    data = b"%PDF-" + b"0" * (files.MAX_UPLOAD_BYTES - 5)
    assert files.check_upload(data, "edge.pdf").size_bytes == files.MAX_UPLOAD_BYTES


def test_text_cut_in_the_middle_of_a_character_is_still_text() -> None:
    data = ("a" * (files.TEXT_SAMPLE - 1) + "¥").encode()  # the sample ends inside the 2-byte ¥
    assert files.sniff_mime(data) == "text/plain"


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("receipt.pdf", "receipt.pdf"),
        ("C:\\Users\\victim\\Desktop\\receipt.pdf", "receipt.pdf"),
        ("../../etc/passwd", "passwd"),
        ('re"ceipt<script>.pdf', "receiptscript.pdf"),
        ("line\nbreak\r.pdf", "linebreak.pdf"),
        ("", "document.pdf"),
        (None, "document.pdf"),
        ("...", "document.pdf"),
        ("振込明細.pdf", "振込明細.pdf"),
    ],
)
def test_filenames_are_made_safe(given: str | None, expected: str) -> None:
    assert files.safe_filename(given, "application/pdf") == expected


def test_long_filenames_keep_their_extension() -> None:
    name = files.safe_filename("x" * 400 + ".pdf", "application/pdf")
    assert len(name) == files.MAX_FILENAME and name.endswith(".pdf")


def test_download_headers_force_an_attachment() -> None:
    headers = files.download_headers('振込 "明細".pdf', "application/pdf")
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["Cache-Control"] == "no-store"
    disposition = headers["Content-Disposition"]
    assert disposition.startswith("attachment; ")
    assert 'filename="__ ____.pdf"' in disposition  # ASCII fallback: quotes can't break out of the header
    assert "filename*=UTF-8''%E6%8C%AF%E8%BE%BC%20%22%E6%98%8E%E7%B4%B0%22.pdf" in disposition
    assert "\n" not in disposition and "\r" not in disposition


def test_download_headers_ascii_fallback_has_no_quotes() -> None:
    disposition = files.download_headers('a"b\\c.txt', "text/plain")["Content-Disposition"]
    assert 'filename="a_b_c.txt"' in disposition
