"""
District role definitions service — system roles, custom roles, and permission catalog.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.tenant_auth import ADMIN_ROLES, Roles, TenantContext

# Roles district admins may assign (excludes elevated global roles unless caller is global admin)
DISTRICT_ASSIGNABLE_ROLES = [
    Roles.DISTRICT_ADMIN,
    Roles.DISTRICT_MANAGER,
    Roles.DISTRICT_OPERATOR,
    Roles.FIELD_ENGINEER,
    Roles.SAMPLE_COLLECTOR,
    Roles.DISTRICT_VIEWER,
    Roles.LEAD_ENGINEER,
    Roles.CONTRACTOR,
    Roles.REGIONAL_ANALYST,
    Roles.REGULATORY_VIEWER,
    Roles.CEU_ADMIN,
    Roles.CEU_MANAGER,
    Roles.CEU_USER,
    "lms_learner",
    "lms_instructor",
    "lms_admin",
]

GLOBAL_ONLY_ASSIGNABLE = [
    Roles.GLOBAL_ADMIN,
    Roles.SYSTEM_ADMIN,
    Roles.PLATFORM_ADMIN,
    Roles.OWW_PARTNER,
]

# Roles a ceu_admin (workforce-module tenant admin) may assign within their district
CEU_ADMIN_ASSIGNABLE_ROLES = [
    Roles.CEU_MANAGER,
    Roles.CEU_USER,
]

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,48}$")

MANAGE_EQUIPMENT_TAGGING = "manage_equipment_tagging"
LMS_VIEW_COURSES = "lms_view_courses"
LMS_MANAGE_COURSES = "lms_manage_courses"
LMS_ADMIN_PLATFORM = "lms_admin_platform"
LMS_MANAGE_DISTRICT_LEARNING = "lms_manage_district_learning"
LMS_GRADE_ATTEMPTS = "lms_grade_attempts"

_LEGACY_ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    Roles.GLOBAL_ADMIN: {
        MANAGE_EQUIPMENT_TAGGING,
        LMS_VIEW_COURSES,
        LMS_MANAGE_COURSES,
        LMS_ADMIN_PLATFORM,
        LMS_MANAGE_DISTRICT_LEARNING,
        LMS_GRADE_ATTEMPTS,
        "read_wells",
        "write_wells",
        "manage_users",
        "system_admin",
    },
    Roles.SYSTEM_ADMIN: {
        MANAGE_EQUIPMENT_TAGGING,
        LMS_VIEW_COURSES,
        LMS_MANAGE_COURSES,
        LMS_ADMIN_PLATFORM,
        LMS_MANAGE_DISTRICT_LEARNING,
        LMS_GRADE_ATTEMPTS,
        "read_wells",
        "write_wells",
        "manage_users",
        "system_admin",
    },
    Roles.PLATFORM_ADMIN: {
        MANAGE_EQUIPMENT_TAGGING,
        LMS_VIEW_COURSES,
        LMS_MANAGE_COURSES,
        LMS_ADMIN_PLATFORM,
        LMS_MANAGE_DISTRICT_LEARNING,
        LMS_GRADE_ATTEMPTS,
        "read_wells",
        "write_wells",
    },
    Roles.DISTRICT_ADMIN: {
        MANAGE_EQUIPMENT_TAGGING,
        LMS_VIEW_COURSES,
        LMS_MANAGE_COURSES,
        LMS_MANAGE_DISTRICT_LEARNING,
        LMS_GRADE_ATTEMPTS,
        "read_wells",
        "write_wells",
        "manage_users",
        "assign_roles",
    },
    Roles.DISTRICT_MANAGER: {"read_wells", "write_wells", "manage_schedules"},
}


def _slugify(value: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", value.lower().strip())
    return s.strip("_")[:50] or "role"


def _tables_exist(db: Session) -> bool:
    try:
        bind = db.get_bind()
        if bind.dialect.name == "sqlite":
            row = db.execute(
                text(
                    """
                    SELECT 1 FROM sqlite_master
                    WHERE type = 'table' AND name = 'role_definitions'
                    LIMIT 1
                    """
                )
            ).fetchone()
        else:
            row = db.execute(
                text(
                    """
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = 'role_definitions'
                    LIMIT 1
                    """
                )
            ).fetchone()
        return row is not None
    except Exception:
        return False


def resolve_user_permission_keys(db: Session, context: TenantContext) -> Set[str]:
    """Union of permission keys granted by the user's active roles."""
    if context.is_global_admin or context.is_system_admin:
        return set(_LEGACY_ROLE_PERMISSIONS.get(Roles.GLOBAL_ADMIN, set()))

    if not _tables_exist(db):
        keys: Set[str] = set()
        for role in context.roles or []:
            keys |= _LEGACY_ROLE_PERMISSIONS.get(role, set())
        return keys

    if not context.user_id:
        return set()

    rows = db.execute(
        text(
            """
            SELECT DISTINCT rp.permission_key
            FROM user_roles ur
            JOIN role_definitions rd
              ON rd.role_name = ur.role_name
             AND rd.is_active = true
             AND (rd.district_code IS NULL OR rd.district_code = ur.district_code)
            JOIN role_permissions rp ON rp.role_definition_id = rd.id
            WHERE ur.user_id = :user_id
              AND ur.is_active = true
              AND (
                ur.district_code IS NULL
                OR ur.district_code = :district_code
                OR :district_code IS NULL
              )
            """
        ),
        {
            "user_id": context.user_id,
            "district_code": context.district_code,
        },
    ).fetchall()
    return {str(r[0]) for r in rows}


def user_has_permission(
    db: Session, context: TenantContext, permission_key: str
) -> bool:
    return permission_key in resolve_user_permission_keys(db, context)


def require_permission(
    db: Session, context: TenantContext, permission_key: str
) -> None:
    if not user_has_permission(db, context, permission_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission required: {permission_key}",
        )


def is_ceu_admin_only(context: TenantContext) -> bool:
    """True when the caller administers only the workforce/CEU module (no broader admin role)."""
    if context.is_global_admin or context.is_system_admin:
        return False
    roles = context.roles or []
    if Roles.CEU_ADMIN not in roles:
        return False
    return not any(r in ADMIN_ROLES or r == Roles.DISTRICT_MANAGER for r in roles)


def get_assignable_role_names(context: TenantContext) -> List[str]:
    if is_ceu_admin_only(context):
        return list(CEU_ADMIN_ASSIGNABLE_ROLES)
    names = list(DISTRICT_ASSIGNABLE_ROLES)
    if context.is_global_admin or context.has_any_role(
        [Roles.GLOBAL_ADMIN, Roles.SYSTEM_ADMIN, Roles.PLATFORM_ADMIN]
    ):
        names.extend(GLOBAL_ONLY_ASSIGNABLE)
    return names


def resolve_role_id_to_name(db: Session, role_ids: List[int], district_code: str) -> Dict[int, str]:
    """Map role_definition ids to role_name for user assignment."""
    if not role_ids:
        return {}
    if not _tables_exist(db):
        return _legacy_role_id_map(role_ids)

    placeholders = ", ".join(f":id{i}" for i in range(len(role_ids)))
    params: Dict[str, Any] = {f"id{i}": rid for i, rid in enumerate(role_ids)}
    params["district_code"] = district_code

    rows = db.execute(
        text(
            f"""
            SELECT id, role_name FROM role_definitions
            WHERE id IN ({placeholders})
              AND is_active = true
              AND (
                district_code IS NULL
                OR district_code = :district_code
              )
            """
        ),
        params,
    ).fetchall()
    return {int(r[0]): str(r[1]) for r in rows}


def _legacy_role_id_map(role_ids: List[int]) -> Dict[int, str]:
    legacy = {
        1: Roles.DISTRICT_ADMIN,
        2: Roles.DISTRICT_MANAGER,
        3: Roles.DISTRICT_OPERATOR,
        4: Roles.FIELD_ENGINEER,
        5: Roles.SAMPLE_COLLECTOR,
        6: Roles.DISTRICT_VIEWER,
        7: Roles.LEAD_ENGINEER,
        8: Roles.GLOBAL_ADMIN,
        9: Roles.SYSTEM_ADMIN,
        10: Roles.CEU_ADMIN,
        11: Roles.CEU_MANAGER,
        12: Roles.CEU_USER,
    }
    return {rid: legacy[rid] for rid in role_ids if rid in legacy}


def list_roles_for_assignment(
    db: Session, context: TenantContext
) -> List[Dict[str, Any]]:
    """Legacy shape for DistrictUserManagement role picker."""
    if not _tables_exist(db):
        return _legacy_assignment_roles(context)

    assignable = set(get_assignable_role_names(context))
    district_code = context.district_code or ""

    assignable_list = list(assignable)
    in_clause = ", ".join(f":a{i}" for i in range(len(assignable_list))) or "''"
    params: Dict[str, Any] = {f"a{i}": n for i, n in enumerate(assignable_list)}
    params["district_code"] = district_code

    rows = db.execute(
        text(
            f"""
            SELECT id, role_name, display_name, description, district_code, is_system_role,
                   parent_role_name
            FROM role_definitions
            WHERE is_active = true
              AND (
                (district_code IS NULL AND role_name IN ({in_clause}))
                OR district_code = :district_code
              )
            ORDER BY is_system_role DESC, display_name
            """
        ),
        params,
    ).fetchall()

    return [
        {
            "id": int(r[0]),
            "role_name": str(r[1]),
            "role_description": str(r[2]),
            "display_name": str(r[2]),
            "description": r[3] or "",
            "is_system_role": bool(r[5]),
            "parent_role_name": r[6],
        }
        for r in rows
    ]


def _legacy_assignment_roles(context: TenantContext) -> List[Dict[str, Any]]:
    if is_ceu_admin_only(context):
        roles = [
            (11, Roles.CEU_MANAGER, "CEU Manager"),
            (12, Roles.CEU_USER, "CEU User"),
        ]
    elif context.is_global_admin or context.has_any_role(
        [Roles.GLOBAL_ADMIN, Roles.SYSTEM_ADMIN]
    ):
        roles = [
            (1, Roles.DISTRICT_ADMIN, "District Administrator"),
            (2, Roles.DISTRICT_MANAGER, "District Manager"),
            (3, Roles.DISTRICT_OPERATOR, "District Operator"),
            (4, Roles.FIELD_ENGINEER, "Field Engineer"),
            (5, Roles.SAMPLE_COLLECTOR, "Sample Collector"),
            (6, Roles.DISTRICT_VIEWER, "District Viewer"),
            (7, Roles.LEAD_ENGINEER, "Lead Engineer"),
            (8, Roles.GLOBAL_ADMIN, "Global Administrator"),
            (9, Roles.SYSTEM_ADMIN, "System Administrator"),
            (10, Roles.CEU_ADMIN, "CEU Administrator"),
            (11, Roles.CEU_MANAGER, "CEU Manager"),
            (12, Roles.CEU_USER, "CEU User"),
        ]
    else:
        roles = [
            (1, Roles.DISTRICT_ADMIN, "District Administrator"),
            (2, Roles.DISTRICT_MANAGER, "District Manager"),
            (3, Roles.DISTRICT_OPERATOR, "District Operator"),
            (4, Roles.FIELD_ENGINEER, "Field Engineer"),
            (5, Roles.SAMPLE_COLLECTOR, "Sample Collector"),
            (6, Roles.DISTRICT_VIEWER, "District Viewer"),
            (7, Roles.LEAD_ENGINEER, "Lead Engineer"),
            (10, Roles.CEU_ADMIN, "CEU Administrator"),
            (11, Roles.CEU_MANAGER, "CEU Manager"),
            (12, Roles.CEU_USER, "CEU User"),
        ]
    return [
        {
            "id": rid,
            "role_name": name,
            "role_description": label,
            "display_name": label,
            "description": label,
            "is_system_role": True,
            "parent_role_name": None,
        }
        for rid, name, label in roles
    ]


def _user_counts_by_role(db: Session, district_code: str) -> Dict[str, int]:
    rows = db.execute(
        text(
            """
            SELECT ur.role_name, COUNT(DISTINCT ur.user_id) AS cnt
            FROM user_roles ur
            WHERE ur.is_active = true
              AND (ur.district_code = :district_code OR ur.district_code IS NULL)
            GROUP BY ur.role_name
            """
        ),
        {"district_code": district_code},
    ).fetchall()
    return {str(r[0]): int(r[1]) for r in rows}


def _permissions_for_role(db: Session, role_id: int) -> List[str]:
    rows = db.execute(
        text(
            """
            SELECT rp.permission_key
            FROM role_permissions rp
            WHERE rp.role_definition_id = :role_id
            ORDER BY rp.permission_key
            """
        ),
        {"role_id": role_id},
    ).fetchall()
    return [str(r[0]) for r in rows]


def list_roles_matrix(db: Session, context: TenantContext) -> List[Dict[str, Any]]:
    if not _tables_exist(db):
        return list_roles_for_assignment(db, context)

    district_code = context.district_code or ""
    counts = _user_counts_by_role(db, district_code)

    rows = db.execute(
        text(
            """
            SELECT id, role_name, display_name, description, district_code,
                   parent_role_name, scope, is_system_role, is_active
            FROM role_definitions
            WHERE is_active = true
              AND (district_code IS NULL OR district_code = :district_code)
            ORDER BY is_system_role DESC, display_name
            """
        ),
        {"district_code": district_code},
    ).fetchall()

    result = []
    for r in rows:
        rid = int(r[0])
        role_name = str(r[1])
        perms = _permissions_for_role(db, rid)
        result.append(
            {
                "id": rid,
                "role_name": role_name,
                "display_name": str(r[2]),
                "description": r[3] or "",
                "district_code": r[4],
                "parent_role_name": r[5],
                "scope": r[6] or "district",
                "is_system_role": bool(r[7]),
                "is_active": bool(r[8]),
                "permissions": perms,
                "user_count": counts.get(role_name, 0),
            }
        )
    return result


def list_permission_catalog(db: Session) -> List[Dict[str, Any]]:
    if not _tables_exist(db):
        return _fallback_permission_catalog()

    rows = db.execute(
        text(
            """
            SELECT permission_key, category, description
            FROM permissions
            ORDER BY category, permission_key
            """
        )
    ).fetchall()

    by_cat: Dict[str, List[Dict[str, str]]] = {}
    for key, cat, desc in rows:
        by_cat.setdefault(str(cat), []).append(
            {"key": str(key), "description": desc or str(key)}
        )

    category_labels = {
        "data_access": "Data Access",
        "alerts": "Alerts",
        "reports": "Reports",
        "user_management": "User Management",
        "cross_district": "Cross-District",
        "system": "System",
        "sampling": "Sampling",
        "facilities": "Facilities",
    }
    return [
        {
            "name": category_labels.get(cat, cat.replace("_", " ").title()),
            "category_key": cat,
            "permissions": perms,
        }
        for cat, perms in by_cat.items()
    ]


def _fallback_permission_catalog() -> List[Dict[str, Any]]:
    keys = [
        "read_wells",
        "write_wells",
        "read_readings",
        "write_readings",
        "read_alerts",
        "manage_alerts",
        "read_reports",
        "create_reports",
        "manage_users",
        "field_collection",
        MANAGE_EQUIPMENT_TAGGING,
    ]
    return [
        {
            "name": "Data Access",
            "category_key": "data_access",
            "permissions": [{"key": k, "description": k} for k in keys],
        },
        {
            "name": "Facilities",
            "category_key": "facilities",
            "permissions": [
                {
                    "key": MANAGE_EQUIPMENT_TAGGING,
                    "description": "Edit equipment display names and types",
                }
            ],
        },
    ]


def _get_system_role(db: Session, role_name: str) -> Optional[Any]:
    return db.execute(
        text(
            """
            SELECT id FROM role_definitions
            WHERE role_name = :role_name AND district_code IS NULL AND is_system_role = true
            """
        ),
        {"role_name": role_name},
    ).fetchone()


def create_custom_role(
    db: Session,
    context: TenantContext,
    *,
    display_name: str,
    slug: str,
    description: str,
    parent_role_name: str,
    permissions: List[str],
) -> Dict[str, Any]:
    if not _tables_exist(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Role definitions not migrated. Run migration 004_role_definitions.sql",
        )

    district_code = context.district_code
    if not district_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="District context required",
        )

    if not context.has_any_role([Roles.DISTRICT_ADMIN, Roles.GLOBAL_ADMIN, Roles.SYSTEM_ADMIN]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="District admin required")

    parent = _get_system_role(db, parent_role_name)
    if not parent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid parent role: {parent_role_name}",
        )

    clean_slug = _slugify(slug or display_name)
    if not SLUG_RE.match(clean_slug):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Slug must be lowercase alphanumeric with underscores",
        )

    role_name = f"{district_code}__{clean_slug}"

    existing = db.execute(
        text(
            """
            SELECT id FROM role_definitions
            WHERE role_name = :role_name AND district_code = :district_code
            """
        ),
        {"role_name": role_name, "district_code": district_code},
    ).fetchone()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A role with this slug already exists for your district",
        )

    _validate_permissions(db, permissions)

    row = db.execute(
        text(
            """
            INSERT INTO role_definitions (
                role_name, display_name, description, district_code,
                parent_role_name, scope, is_system_role, is_active, created_by
            )
            VALUES (
                :role_name, :display_name, :description, :district_code,
                :parent_role_name, 'district', false, true, :created_by
            )
            RETURNING id
            """
        ),
        {
            "role_name": role_name,
            "display_name": display_name.strip(),
            "description": description.strip() if description else None,
            "district_code": district_code,
            "parent_role_name": parent_role_name,
            "created_by": context.user_id,
        },
    ).fetchone()
    role_id = int(row[0])

    for perm in permissions:
        db.execute(
            text(
                """
                INSERT INTO role_permissions (role_definition_id, permission_key)
                VALUES (:role_id, :perm)
                ON CONFLICT DO NOTHING
                """
            ),
            {"role_id": role_id, "perm": perm},
        )
    db.commit()

    return get_role_by_id(db, role_id, district_code)


def _validate_permissions(db: Session, permissions: List[str]) -> None:
    if not permissions:
        return
    placeholders = ", ".join(f":p{i}" for i in range(len(permissions)))
    params = {f"p{i}": p for i, p in enumerate(permissions)}
    rows = db.execute(
        text(f"SELECT permission_key FROM permissions WHERE permission_key IN ({placeholders})"),
        params,
    ).fetchall()
    valid = {str(r[0]) for r in rows}
    invalid = [p for p in permissions if p not in valid]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid permissions: {invalid}",
        )


def get_role_by_id(db: Session, role_id: int, district_code: str) -> Dict[str, Any]:
    row = db.execute(
        text(
            """
            SELECT id, role_name, display_name, description, district_code,
                   parent_role_name, scope, is_system_role, is_active
            FROM role_definitions WHERE id = :id
            """
        ),
        {"id": role_id},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    rd_district = row[4]
    if rd_district is not None and str(rd_district) != district_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")

    rid = int(row[0])
    role_name = str(row[1])
    counts = _user_counts_by_role(db, district_code)
    return {
        "id": rid,
        "role_name": role_name,
        "display_name": str(row[2]),
        "description": row[3] or "",
        "district_code": rd_district,
        "parent_role_name": row[5],
        "scope": row[6] or "district",
        "is_system_role": bool(row[7]),
        "is_active": bool(row[8]),
        "permissions": _permissions_for_role(db, rid),
        "user_count": counts.get(role_name, 0),
    }


def update_custom_role(
    db: Session,
    context: TenantContext,
    role_id: int,
    *,
    display_name: Optional[str] = None,
    description: Optional[str] = None,
    parent_role_name: Optional[str] = None,
    permissions: Optional[List[str]] = None,
) -> Dict[str, Any]:
    district_code = context.district_code or ""
    role = get_role_by_id(db, role_id, district_code)
    if role["is_system_role"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System roles cannot be edited",
        )

    if parent_role_name:
        if not _get_system_role(db, parent_role_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid parent role: {parent_role_name}",
            )

    if permissions is not None:
        _validate_permissions(db, permissions)

    updates = []
    params: Dict[str, Any] = {"id": role_id}
    if display_name is not None:
        updates.append("display_name = :display_name")
        params["display_name"] = display_name.strip()
    if description is not None:
        updates.append("description = :description")
        params["description"] = description.strip() if description else None
    if parent_role_name is not None:
        updates.append("parent_role_name = :parent_role_name")
        params["parent_role_name"] = parent_role_name

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        db.execute(
            text(f"UPDATE role_definitions SET {', '.join(updates)} WHERE id = :id"),
            params,
        )

    if permissions is not None:
        db.execute(
            text("DELETE FROM role_permissions WHERE role_definition_id = :id"),
            {"id": role_id},
        )
        for perm in permissions:
            db.execute(
                text(
                    """
                    INSERT INTO role_permissions (role_definition_id, permission_key)
                    VALUES (:role_id, :perm)
                    """
                ),
                {"role_id": role_id, "perm": perm},
            )

    db.commit()
    return get_role_by_id(db, role_id, district_code)


def delete_custom_role(db: Session, context: TenantContext, role_id: int) -> None:
    district_code = context.district_code or ""
    role = get_role_by_id(db, role_id, district_code)
    if role["is_system_role"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="System roles cannot be deleted",
        )
    if role["user_count"] > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a role that is assigned to users",
        )

    db.execute(
        text("UPDATE role_definitions SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
        {"id": role_id},
    )
    db.commit()


def duplicate_role(
    db: Session,
    context: TenantContext,
    role_id: int,
    *,
    display_name: str,
    slug: str,
) -> Dict[str, Any]:
    district_code = context.district_code or ""
    source = get_role_by_id(db, role_id, district_code)
    parent_name = source["role_name"] if source["is_system_role"] else (source["parent_role_name"] or source["role_name"])
    return create_custom_role(
        db,
        context,
        display_name=display_name,
        slug=slug,
        description=source.get("description") or "",
        parent_role_name=parent_name,
        permissions=list(source.get("permissions") or []),
    )


def expand_roles_with_parents(db: Session, role_names: List[str], district_code: str) -> List[str]:
    """Append parent_role_name for custom roles so require_tenant_roles keeps working."""
    if not role_names or not _tables_exist(db):
        return list(dict.fromkeys(role_names))

    expanded: Set[str] = set(role_names)
    names = list(role_names)
    if not names:
        return list(role_names)
    in_clause = ", ".join(f":n{i}" for i in range(len(names)))
    params = {f"n{i}": n for i, n in enumerate(names)}
    params["district_code"] = district_code
    rows = db.execute(
        text(
            f"""
            SELECT role_name, parent_role_name, district_code
            FROM role_definitions
            WHERE is_active = true
              AND role_name IN ({in_clause})
              AND (district_code IS NULL OR district_code = :district_code)
            """
        ),
        params,
    ).fetchall()

    for role_name, parent, rd_district in rows:
        expanded.add(str(role_name))
        if parent:
            expanded.add(str(parent))

    return list(expanded)
