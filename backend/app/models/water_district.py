"""Water district compatibility table for workforce FKs."""

from app.db.base_class import Base
from sqlalchemy import Boolean, Column, Integer, String


class WaterDistrict(Base):
    __tablename__ = "water_districts"

    # Local surrogate PK — never copy AquaSafe integer ids into this column.
    id = Column(Integer, primary_key=True, autoincrement=True)
    district_code = Column(String(50), nullable=False, unique=True, index=True)
    district_name = Column(String(255), nullable=False)
    state_code = Column(String(2), nullable=True)
    mailing_address_line1 = Column(String(255), nullable=True)
    mailing_address_line2 = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    # AquaSafe mirror link + canonical facility identifiers for OWW/AquaSafe dedup.
    aquasafe_district_id = Column(Integer, nullable=True, unique=True, index=True)
    pwsid = Column(String(32), nullable=True, index=True)
    npdes_id = Column(String(64), nullable=True, index=True)
    spdes_id = Column(String(64), nullable=True, index=True)


def ensure_water_district_schema(engine) -> None:
    from sqlalchemy import text

    statements = [
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS mailing_address_line1 VARCHAR(255)",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS mailing_address_line2 VARCHAR(255)",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS aquasafe_district_id INTEGER",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS pwsid VARCHAR(32)",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS npdes_id VARCHAR(64)",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS spdes_id VARCHAR(64)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_water_districts_aquasafe_district_id "
        "ON water_districts (aquasafe_district_id) WHERE aquasafe_district_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_water_districts_pwsid_state "
        "ON water_districts (pwsid, state_code) WHERE pwsid IS NOT NULL AND state_code IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_water_districts_npdes_state "
        "ON water_districts (npdes_id, state_code) WHERE npdes_id IS NOT NULL AND state_code IS NOT NULL",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
