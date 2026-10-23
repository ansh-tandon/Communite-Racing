"""Questions answered by hand: store "no auto-answer rule" as SQL NULL, not JSON null

Revision ID: e41a7c9d0b52
Revises: b3e9f0c4d215
Create Date: 2026-10-23
"""

from collections.abc import Sequence

from alembic import op

revision: str = 'e41a7c9d0b52'
down_revision: str | None = 'b3e9f0c4d215'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("UPDATE questions SET auto = NULL WHERE auto = 'null'::jsonb")


def downgrade() -> None:
    pass
