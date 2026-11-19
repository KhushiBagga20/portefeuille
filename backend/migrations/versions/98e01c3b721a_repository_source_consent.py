"""Persist explicit owner consent for repository source analysis."""

import sqlalchemy as sa
from alembic import op

revision = "98e01c3b721a"
down_revision = "456462b07c49"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "repositories", sa.Column("allow_source_ai", sa.Boolean(), nullable=False, server_default=sa.false())
    )


def downgrade():
    op.drop_column("repositories", "allow_source_ai")
