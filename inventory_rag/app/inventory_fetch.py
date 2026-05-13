"""Fetch live data from the Node API for RAG indexing (bulk snapshot + legacy fallback)."""

from __future__ import annotations

import json
import re
from typing import Any

import httpx


def _oem_search_hints(asset: dict) -> str:
    """
    Extra phrases for embedding + LLM: DB fields are often wrong (typos, asset_type).
    Map well-known model lines / serials to OEMs so questions like 'HP laptop' still match.
    """
    brand = str(asset.get("brand") or "").lower()
    model = str(asset.get("model") or "").lower()
    serial = str(asset.get("serial_number") or "").upper()

    hints: list[str] = []

    def add(s: str) -> None:
        if s not in hints:
            hints.append(s)

    if any(
        x in model
        for x in (
            "elitebook",
            "pavilion",
            "probook",
            "envy",
            "spectre",
            "omen",
            "zbook",
            "folio",
            "dragonfly",
            "victus",
        )
    ):
        add("Likely HP (HP laptop/workstation model line in model name)")
    if re.match(r"^HP[\d_-]", serial) or serial.startswith("HP"):
        add("Likely HP (serial prefix or pattern)")

    if any(x in model for x in ("latitude", "xps", "inspiron", "precision", "alienware", "vostro", "g15", "g series")):
        add("Likely Dell")
    if "DELL" in serial or serial.startswith("DL"):
        add("Likely Dell (serial)")

    if any(x in model for x in ("thinkpad", "ideapad", "legion", "yoga", "loq")):
        add("Likely Lenovo")
    if any(x in model for x in ("macbook", "imac", "mac mini", "mac studio")):
        add("Likely Apple")
    if any(x in model for x in ("swift", "aspire", "predator", "nitro", "travelmate")):
        add("Likely Acer")
    if any(x in model for x in ("zenbook", "vivobook", "rog ", "rog-", "tuf ")):
        add("Likely ASUS")
    if "galaxy book" in model or "chromebook" in model:
        add("Likely Samsung")
    if "surface" in model:
        add("Likely Microsoft")

    if "samamsung" in brand or "samsng" in brand:
        add("Brand field may be typo for Samsung")

    if not hints:
        return ""

    return " " + " ".join(hints) + "."


def _jsonish_row(kind: str, row: dict[str, Any]) -> str:
    """Single-line text for embedding; drop huge/binary-ish fields."""
    skip = {"password", "password_hash", "repair_bill"}
    slim = {k: v for k, v in row.items() if k not in skip and v is not None}
    try:
        return f"{kind} {json.dumps(slim, default=str, ensure_ascii=False)}"
    except (TypeError, ValueError):
        return f"{kind} {row}"


async def fetch_live_snapshot(base_url: str, rag_internal_key: str) -> dict[str, Any]:
    """
    Prefer secured bulk snapshot (users, auth logins, assignments, repairs, disposals, …).
    Falls back to inventories + assets only if snapshot is unavailable.
    """
    base = base_url.rstrip("/")
    key = (rag_internal_key or "").strip()
    headers = {"X-Internal-Key": key} if key else {}

    async with httpx.AsyncClient(timeout=120.0) as client:
        snap_url = f"{base}/rag-export/snapshot"
        try:
            snap = await client.get(snap_url, headers=headers)
        except httpx.RequestError:
            snap = None

        if snap is not None and snap.status_code == 200:
            data = snap.json()
            if isinstance(data, dict) and "inventories" in data:
                return data
        if snap is not None and key:
            if snap.status_code == 404:
                raise ValueError(
                    "GET /api/rag-export/snapshot returned 404 — deploy latest Inventory_backend and restart Node."
                ) from None
            if snap.status_code not in (200,):
                raise ValueError(
                    f"RAG snapshot HTTP {snap.status_code}: {snap.text[:400]}. "
                    "Check Node logs; RAG_INTERNAL_KEY must match on Node and Python."
                ) from None

        inv_res = await client.get(f"{base}/inventories")
        inv_res.raise_for_status()
        inventories = inv_res.json()
        if not isinstance(inventories, list):
            inventories = []

        ast_res = await client.get(f"{base}/assets")
        ast_res.raise_for_status()
        assets = ast_res.json()
        if not isinstance(assets, list):
            assets = []

        return {
            "generated_at": None,
            "inventories": inventories,
            "assets": assets,
            "users": [],
            "auth_users_public": [],
            "assignments": [],
            "repairs": [],
            "disposed_items": [],
            "assignment_requests": [],
            "assignment_request_items": [],
            "active_assignments": [],
            "sessions": [],
        }


def fetch_live_summary_sync(base_url: str, rag_internal_key: str) -> str:
    """
    GET /api/rag-export/summary — same internal key as snapshot; lightweight counts for chat grounding.
    Returns a short multi-line string, or empty if unavailable.
    """
    base = base_url.rstrip("/")
    key = (rag_internal_key or "").strip()
    if not key:
        return ""
    url = f"{base}/rag-export/summary"
    try:
        with httpx.Client(timeout=12.0) as client:
            res = client.get(url, headers={"X-Internal-Key": key})
    except httpx.RequestError:
        return ""
    if res.status_code != 200:
        return ""
    try:
        data = res.json()
    except (json.JSONDecodeError, ValueError):
        return ""
    if not isinstance(data, dict):
        return ""
    gen = data.get("generated_at") or ""
    counts = data.get("counts")
    if not isinstance(counts, dict):
        return ""
    order = [
        "inventories",
        "assets",
        "users",
        "auth_users",
        "assignments",
        "active_assignments",
        "repairs",
        "disposed_items",
        "assignment_requests",
        "assignment_request_items",
    ]
    lines = [
        "Live database summary (aggregate counts only; for scale and freshness — pair with retrieved rows for facts).",
        f"generated_at: {gen}",
    ]
    for k in order:
        if k in counts:
            lines.append(f"  {k}: {counts[k]}")
    for k, v in sorted(counts.items()):
        if k not in order:
            lines.append(f"  {k}: {v}")
    return "\n".join(lines)


def _asset_by_id(data: dict[str, Any]) -> dict[Any, dict[str, Any]]:
    out: dict[Any, dict[str, Any]] = {}
    for a in data.get("assets") or []:
        if isinstance(a, dict) and a.get("id") is not None:
            out[a["id"]] = a
    return out


def _user_by_id(data: dict[str, Any]) -> dict[Any, dict[str, Any]]:
    out: dict[Any, dict[str, Any]] = {}
    for u in data.get("users") or []:
        if isinstance(u, dict) and u.get("id") is not None:
            out[u["id"]] = u
    return out


def _assignment_resolved_line(
    user_by_id: dict[Any, dict[str, Any]],
    asset_by_id: dict[Any, dict[str, Any]],
    asn: dict[str, Any],
) -> str:
    """assignments table only has user_id/asset_id; add names for RAG + readability."""
    uid = asn.get("user_id")
    ast_id = asn.get("asset_id")
    u = user_by_id.get(uid) if uid is not None else None
    a = asset_by_id.get(ast_id) if ast_id is not None else None
    if not isinstance(u, dict):
        emp = f"user_id={uid} (user row not in snapshot slice)"
    else:
        nm = str(u.get("name") or "").strip()
        eid = str(u.get("employee_id") or "").strip()
        dept = str(u.get("department") or "").strip()
        bits = [f'employee_name="{nm}"' if nm else "", f"employee_id={eid}" if eid else "", f"department={dept}" if dept else ""]
        emp = " ".join(b for b in bits if b) or f"user_id={uid}"
    if not isinstance(a, dict):
        dev = f"asset_id={ast_id} (asset row not in snapshot slice)"
    else:
        brand = str(a.get("brand") or "").strip()
        model = str(a.get("model") or "").strip()
        serial = str(a.get("serial_number") or "").strip()
        atype = str(a.get("asset_type") or "").strip()
        label = " ".join(x for x in (brand, model) if x).strip() or f"asset id {a.get('id')}"
        dev = (
            f'system_name="{label}"'
            + (f" asset_type={atype}" if atype else "")
            + (f" serial={serial}" if serial else "")
            + f" linked_asset_id={a.get('id')}"
        )
    return (
        "Resolved from users/assets tables: "
        + emp
        + "; device: "
        + dev
        + ". When answering, use employee_name and system_name, not only numeric ids."
    )


def _repair_system_line(asset_by_id: dict[Any, dict[str, Any]], asset_id: Any) -> str:
    """Human-readable device identity for RAG (repairs only store asset_id)."""
    if asset_id is None:
        return "Linked device: unknown (repair row has no asset_id)."
    a = asset_by_id.get(asset_id)
    if not isinstance(a, dict):
        return (
            f"Linked device: not in this snapshot slice for asset_id={asset_id} "
            "(re-index or widen asset export if needed)."
        )
    brand = str(a.get("brand") or "").strip()
    model = str(a.get("model") or "").strip()
    serial = str(a.get("serial_number") or "").strip()
    atype = str(a.get("asset_type") or "").strip()
    aid = a.get("id")
    label = " ".join(x for x in (brand, model) if x).strip() or f"asset id {aid}"
    parts = [
        f'system_name="{label}"',
        f"asset_type={atype}" if atype else "",
        f"serial={serial}" if serial else "",
        f"linked_asset_id={aid}",
    ]
    tail = " ".join(p for p in parts if p)
    return (
        "Device this repair is for (from assets table): "
        + tail
        + ". When asked which system or machine, answer with system_name (brand + model) and serial, not only 'asset'."
    )


def documents_from_snapshot(data: dict[str, Any]) -> list[tuple[str, dict[str, str]]]:
    """Build (page_content, metadata) rows for Pinecone from a snapshot dict."""
    rows: list[tuple[str, dict[str, str]]] = []
    asset_by_id = _asset_by_id(data)
    user_by_id = _user_by_id(data)

    for inv in data.get("inventories") or []:
        if not isinstance(inv, dict):
            continue
        iid = inv.get("id")
        name = inv.get("name") or ""
        details = inv.get("details") or ""
        ac = inv.get("asset_count")
        an = inv.get("asset_names")
        extra = ""
        if ac is not None or an:
            extra = (
                f" Linked assets in this list: count={ac if ac is not None else '?'}. "
                f'Names: {an or "(none)"}.'
            )
        text = (
            f"Inventory list id={iid} name={name}\n"
            f"Details: {details}\n"
            + extra
            + " Use for questions about inventory lists, locations, or buckets."
        )
        rows.append((text, {"kind": "inventory", "source_id": str(iid) if iid is not None else ""}))

    for a in data.get("assets") or []:
        if not isinstance(a, dict):
            continue
        aid = a.get("id")
        parts = [
            f"Asset id={aid}",
            f"type={a.get('asset_type')}",
            f"brand={a.get('brand')}",
            f"model={a.get('model')}",
            f"serial={a.get('serial_number')}",
            f"status={a.get('status')}",
            f"cpu={a.get('cpu')}",
            f"ram={a.get('ram')}",
            f"storage={a.get('storage')}",
            f"inventory_id={a.get('inventory_id')}",
        ]
        base = " | ".join(str(p) for p in parts if p is not None)
        hints = _oem_search_hints(a)
        narrative = (
            " Note: asset_type/brand fields may be wrong in the database. "
            "For brand or laptop-count questions, also use model name and serial patterns in this row."
        )
        text = base + hints + narrative
        rows.append((text, {"kind": "asset", "source_id": str(aid) if aid is not None else ""}))

    for u in data.get("users") or []:
        if not isinstance(u, dict):
            continue
        uid = u.get("id")
        text = (
            "Employee (users table) "
            + _jsonish_row("record", u)
            + " Use for headcount, department, employee_id, or who is linked to which login."
        )
        rows.append((text, {"kind": "user", "source_id": str(uid) if uid is not None else ""}))

    for au in data.get("auth_users_public") or []:
        if not isinstance(au, dict):
            continue
        aid = au.get("id")
        text = (
            "Login account (auth_users, no password stored here) "
            + _jsonish_row("record", au)
            + " Use for roles (admin, user, repair_authority), usernames, emails."
        )
        rows.append((text, {"kind": "auth_user", "source_id": str(aid) if aid is not None else ""}))

    for asn in data.get("assignments") or []:
        if not isinstance(asn, dict):
            continue
        resolved = _assignment_resolved_line(user_by_id, asset_by_id, asn)
        text = "Asset assignment history row. " + resolved + " Raw fields: " + _jsonish_row("assignment", asn)
        rows.append(
            (text, {"kind": "assignment", "source_id": str(asn.get("id")) if asn.get("id") is not None else ""})
        )

    for row in data.get("active_assignments") or []:
        if not isinstance(row, dict):
            continue
        text = "Currently active checkout / assignment (joined user + asset) " + _jsonish_row(
            "active_assignment", row
        )
        rows.append(
            (
                text,
                {"kind": "active_assignment", "source_id": str(row.get("assignment_id") or "")},
            )
        )

    for row in data.get("sessions") or []:
        if not isinstance(row, dict):
            continue
        text = (
            "Checkout session (same data family as GET /api/sessions/all — assignment checkout history) "
            + _jsonish_row("session", row)
            + " Use for who had which device, start/end time, working_minutes, Active vs Completed, condition before/after."
        )
        rows.append(
            (
                text,
                {"kind": "session", "source_id": str(row.get("assignment_id") or "")},
            )
        )

    for r in data.get("repairs") or []:
        if not isinstance(r, dict):
            continue
        sys_line = _repair_system_line(asset_by_id, r.get("asset_id"))
        text = "Repair ticket. " + sys_line + " Raw fields: " + _jsonish_row("repair", r)
        rows.append((text, {"kind": "repair", "source_id": str(r.get("id")) if r.get("id") is not None else ""}))

    for d in data.get("disposed_items") or []:
        if not isinstance(d, dict):
            continue
        text = (
            "Disposed asset (device removed from active assets; audit trail). "
            "Use for who disposed what, when, condition_after, former_asset_id, serial, inventory. "
            + _jsonish_row("disposed", d)
        )
        rows.append((text, {"kind": "disposed", "source_id": str(d.get("id")) if d.get("id") is not None else ""}))

    for ar in data.get("assignment_requests") or []:
        if not isinstance(ar, dict):
            continue
        text = (
            "Assignment request (user asked admin for gear; not the same as an active checkout assignment). "
            "Statuses often pending/approved/rejected. "
            + _jsonish_row("assignment_request", ar)
        )
        rows.append(
            (text, {"kind": "assignment_request", "source_id": str(ar.get("id")) if ar.get("id") is not None else ""})
        )

    for ari in data.get("assignment_request_items") or []:
        if not isinstance(ari, dict):
            continue
        text = "Assignment request line item (requested asset) " + _jsonish_row("request_item", ari)
        rows.append(
            (
                text,
                {"kind": "assignment_request_item", "source_id": str(ari.get("id")) if ari.get("id") is not None else ""},
            )
        )

    return rows
