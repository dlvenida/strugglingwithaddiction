"""Minimal single-page text PDF (no third-party PDF dependency)."""

from __future__ import annotations


def _escape(text: str) -> str:
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def build_simple_pdf(title: str, lines: list[str]) -> bytes:
    """Build a basic Helvetica PDF with a title and body lines."""
    content_lines = [f"BT /F1 16 Tf 50 780 Td ({_escape(title)}) Tj ET"]
    y = 750
    for raw in lines:
        if y < 50:
            break
        # Wrap long lines roughly
        text = str(raw)
        while text:
            chunk, text = text[:95], text[95:]
            content_lines.append(f"BT /F1 10 Tf 50 {y} Td ({_escape(chunk)}) Tj ET")
            y -= 14

    stream = "\n".join(content_lines).encode("latin-1", errors="replace")
    objects: list[bytes] = []

    def add(obj: bytes) -> int:
        objects.append(obj)
        return len(objects)

    add(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    add(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n")
    add(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    )
    add(f"4 0 obj<< /Length {len(stream)} >>stream\n".encode() + stream + b"\nendstream\nendobj\n")
    add(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)

    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)
