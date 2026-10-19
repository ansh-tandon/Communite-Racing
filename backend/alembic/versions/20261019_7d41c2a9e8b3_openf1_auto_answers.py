"""openf1 auto answers: race session key, question auto rule

Revision ID: 7d41c2a9e8b3
Revises: 2c20c14f9507
Create Date: 2026-10-19 07:30:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '7d41c2a9e8b3'
down_revision: str | None = '2c20c14f9507'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('races', sa.Column('openf1_session_key', sa.Integer(), nullable=True))
    op.add_column('questions', sa.Column('auto', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('questions', 'auto')
    op.drop_column('races', 'openf1_session_key')
