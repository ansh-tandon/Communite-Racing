"""google sign-in: users.google_sub

Revision ID: b3e9f0c4d215
Revises: 7d41c2a9e8b3
Create Date: 2026-10-19 12:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = 'b3e9f0c4d215'
down_revision: str | None = '7d41c2a9e8b3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.create_unique_constraint('users_google_sub_key', 'users', ['google_sub'])


def downgrade() -> None:
    op.drop_constraint('users_google_sub_key', 'users', type_='unique')
    op.drop_column('users', 'google_sub')
