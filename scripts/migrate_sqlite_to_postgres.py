"""把现有 SQLite 业务数据一次性搬迁到已执行 Alembic 的 PostgreSQL 空库。

示例：
  python scripts/migrate_sqlite_to_postgres.py \
    --destination postgresql+psycopg://user:password@127.0.0.1:5433/en_teach

脚本不会删除源数据，也不会覆盖非空目标库。刷新会话不会迁移，用户需重新登录。
"""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import sqlalchemy as sa


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = f"sqlite:///{(ROOT / 'server' / 'data' / 'app.db').as_posix()}"
TABLE_ORDER = (
    "users",
    "units",
    "sentences",
    "unit_progress",
    "sentence_attempts",
)


class MigrationError(RuntimeError):
    pass


def _business_counts(connection: sa.Connection, metadata: sa.MetaData) -> dict[str, int]:
    return {
        name: connection.scalar(sa.select(sa.func.count()).select_from(metadata.tables[name])) or 0
        for name in TABLE_ORDER
    }


def migrate(source_url: str, destination_url: str, *, dry_run: bool = False) -> dict[str, int]:
    if source_url == destination_url:
        raise MigrationError("源数据库和目标数据库不能相同")

    source_engine = sa.create_engine(source_url)
    destination_engine = sa.create_engine(destination_url, pool_pre_ping=True)
    source_metadata = sa.MetaData()
    destination_metadata = sa.MetaData()
    source_metadata.reflect(bind=source_engine)
    destination_metadata.reflect(bind=destination_engine)

    missing_source = [name for name in TABLE_ORDER if name not in source_metadata.tables]
    missing_destination = [name for name in TABLE_ORDER if name not in destination_metadata.tables]
    if missing_source:
        raise MigrationError(f"源数据库缺少表：{', '.join(missing_source)}")
    if missing_destination:
        raise MigrationError("目标数据库尚未完成 Alembic 迁移：" + ", ".join(missing_destination))

    with source_engine.connect() as source, destination_engine.begin() as destination:
        destination_counts = _business_counts(destination, destination_metadata)
        nonempty = {name: count for name, count in destination_counts.items() if count}
        if nonempty:
            detail = ", ".join(f"{name}={count}" for name, count in nonempty.items())
            raise MigrationError(f"目标数据库不是空库，已中止：{detail}")

        copied: dict[str, int] = {}
        for table_name in TABLE_ORDER:
            source_table = source_metadata.tables[table_name]
            destination_table = destination_metadata.tables[table_name]
            common_columns = [column.name for column in destination_table.columns if column.name in source_table.c]
            statement = sa.select(*(source_table.c[name] for name in common_columns))
            if "id" in source_table.c:
                statement = statement.order_by(source_table.c.id)
            rows: list[dict[str, Any]] = [dict(row._mapping) for row in source.execute(statement)]
            copied[table_name] = len(rows)
            if rows and not dry_run:
                destination.execute(destination_table.insert(), rows)

        if not dry_run and destination.dialect.name == "postgresql":
            for table_name in TABLE_ORDER:
                table = destination_metadata.tables[table_name]
                if (
                    "id" not in table.c
                    or not isinstance(table.c.id.type, sa.Integer)
                    or table.c.id.autoincrement is False
                ):
                    continue
                destination.execute(
                    sa.text(
                        "SELECT setval(pg_get_serial_sequence(:table_name, 'id'), "
                        "COALESCE((SELECT MAX(id) FROM " + table_name + "), 1), "
                        "EXISTS (SELECT 1 FROM " + table_name + "))"
                    ),
                    {"table_name": table_name},
                )

        return copied


def main() -> None:
    parser = argparse.ArgumentParser(description="安全迁移 EN-teach SQLite 数据到 PostgreSQL 空库")
    parser.add_argument("--source", default=DEFAULT_SOURCE, help="SQLite SQLAlchemy URL")
    parser.add_argument("--destination", required=True, help="PostgreSQL SQLAlchemy URL")
    parser.add_argument("--dry-run", action="store_true", help="只校验并统计，不写入")
    args = parser.parse_args()

    try:
        copied = migrate(args.source, args.destination, dry_run=args.dry_run)
    except MigrationError as error:
        raise SystemExit(f"迁移失败：{error}") from error

    mode = "校验" if args.dry_run else "迁移"
    print(f"{mode}完成（刷新会话未迁移）：")
    for table_name, count in copied.items():
        print(f"  {table_name}: {count}")


if __name__ == "__main__":
    main()
