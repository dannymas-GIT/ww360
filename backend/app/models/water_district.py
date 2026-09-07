"""Water district compatibility table for workforce FKs."""

from sqlalchemy import Boolean, Column, Integer, String

from app.db.base_class import Base


class WaterDistrict(Base):
    __tablename__ = "water_districts"

    id = Column(Integer, primary_key=True)
    district_code = Column(String(50), nullable=False, unique=True, index=True)
    district_name = Column(String(255), nullable=False)
    state_code = Column(String(2), nullable=True)
    mailing_address_line1 = Column(String(255), nullable=True)
    mailing_address_line2 = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)


def ensure_water_district_schema(engine) -> None:
    from sqlalchemy import text

    statements = [
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS mailing_address_line1 VARCHAR(255)",
        "ALTER TABLE water_districts ADD COLUMN IF NOT EXISTS mailing_address_line2 VARCHAR(255)",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))
