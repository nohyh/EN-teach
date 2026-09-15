"""SQLite 到目标数据库的数据搬迁保护测试。"""
import sqlalchemy as sa

from app.db.database import Base
from scripts.migrate_sqlite_to_postgres import MigrationError, migrate


def _url(path) -> str:
    return f"sqlite:///{path.as_posix()}"


def test_migration_copies_business_data_and_refuses_overwrite(tmp_path):
    source_url = _url(tmp_path / "source.db")
    destination_url = _url(tmp_path / "destination.db")
    source_engine = sa.create_engine(source_url)
    destination_engine = sa.create_engine(destination_url)
    Base.metadata.create_all(source_engine)
    Base.metadata.create_all(destination_engine)

    with source_engine.begin() as connection:
        connection.execute(
            Base.metadata.tables["users"].insert(),
            {
                "id": 1,
                "username": "migration-user",
                "password_hash": "!reset-required",
                "role": "student",
                "name": "迁移测试",
                "is_active": True,
            },
        )
        connection.execute(
            Base.metadata.tables["units"].insert(),
            {"id": "unit-test", "name": "Test", "description": "", "order": 1},
        )
        connection.execute(
            Base.metadata.tables["sentences"].insert(),
            {
                "id": "sentence-test",
                "unit_id": "unit-test",
                "text": "Hello.",
                "translation": "你好。",
                "order": 1,
                "source": "test",
            },
        )

    copied = migrate(source_url, destination_url)
    assert copied["users"] == 1
    assert copied["units"] == 1
    assert copied["sentences"] == 1

    with destination_engine.connect() as connection:
        assert connection.scalar(sa.select(sa.func.count()).select_from(Base.metadata.tables["users"])) == 1

    try:
        migrate(source_url, destination_url)
    except MigrationError as error:
        assert "不是空库" in str(error)
    else:
        raise AssertionError("迁移工具必须拒绝覆盖非空目标库")
