# EN-teach Server

FastAPI 后端。架构: `api → services → repositories → db`。

```
server/
├── app/
│   ├── main.py                # FastAPI 入口 (uvicorn app.main:app)
│   ├── core/
│   │   └── config.py          # 环境变量 (pydantic-settings)
│   ├── db/
│   │   ├── database.py        # SQLAlchemy engine + session
│   │   └── models.py          # User / Unit / Sentence / UnitProgress / SentenceAttempt
│   ├── schemas/               # (Pydantic 请求/响应模型, 后续加)
│   ├── repositories/          # SQL 层, 不写业务
│   │   ├── units.py
│   │   └── attempts.py
│   ├── services/              # 业务逻辑
│   │   ├── speech_service.py  # TTS (阿里云 NLS)
│   │   ├── ssecp_client.py    # SSECP 鉴权 + WebSocket
│   │   └── evaluation_service.py  # 评测抽象 (Mock + 真实 SSECP)
│   └── api/                   # 路由层, 只做参数校验和 HTTP 编码
│       ├── units.py
│       ├── attempts.py
│       └── tts.py
├── data/                      # SQLite DB (运行时生成, 不入库)
├── audio/                     # 录音文件 (运行时生成, 不入库)
├── tests/                      # 单元测试
├── requirements.txt
├── .env.example               # 环境变量模板
└── README.md
```

## 快速开始

```bash
# 1. 装依赖
pip install -r requirements.txt

# 2. 配环境 (抄 .env.example, 填 NLS / SSECP 的 5 个 key)
cp .env.example .env
# 编辑 .env, 填入真实的 NLS_APPKEY / NLS_TOKEN / SSECP_APP_ID / SSECP_APP_SECRET

# 3. 灌数据 (在 EN-teach 项目根目录跑)
python scripts/seed_db.py

# 4. 起服务
cd server
uvicorn app.main:app --reload --port 8000

# 5. 试
curl http://127.0.0.1:8000/health
# {"status":"ok"}

curl http://127.0.0.1:8000/api/v1/units
# [{"id":"unit-1-hello",...},{"id":"unit-fruit",...}]
```

## API (7 个 endpoint)

| Method | Path | 用途 |
|--------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/v1/units` | 单元列表 (含进度) |
| GET | `/api/v1/units/{unit_id}/sentences` | 句子列表 |
| GET | `/api/v1/tts/sentence/{sentence_id}` | 单句 TTS (mp3/wav/pcm) |
| GET | `/api/v1/tts/sentences?ids=...&pause_ms=...` | 多句连读, 带句间静音 |
| GET | `/api/v1/tts/unit/{unit_id}?pause_ms=...` | 整 unit 连读 |
| POST | `/api/v1/tts/synthesize?text=...` | 任意文本合成 |
| POST | `/api/v1/attempts` | 提交跟读 (form: user_id, sentence_id, audio) |
| GET | `/api/v1/attempts/by-speech/{sentence_id}?user_id=...` | 跟读历史 |

Swagger: `http://127.0.0.1:8000/docs`

## 已验证

- `GET /health` → 200
- `GET /api/v1/units` → 2 units (Unit 1 + unit-fruit)
- `GET /api/v1/tts/sentence/apple` → 200, 2880 bytes MP3
- `GET /api/v1/tts/sentences?ids=apple,banana&pause_ms=600` → 200, 61478 bytes WAV (有停顿)
- `POST /api/v1/attempts` (hello.wav) → 200, overall=39

## 测试 / 验证语音能力

```bash
# 单元测试 (内容适配器 + 评测逻辑, 纯本地)
cd server
python -m pytest tests/ -q

# 端到端语音验证: 鉴权 / TTS 念英语 / SSECP 听+打分 / attempts 提交
cd ..   # EN-teach 根目录, 需已配好 .env 且灌过数据
python scripts/seed_db.py
python scripts/verify_speech.py
# 4 步全 [OK] = 语音能力端到端通
```

## 外部服务

| 服务 | 用途 | 关键 env |
|------|------|---------|
| 阿里云 NLS | TTS 文本合成 | `NLS_APPKEY`, `NLS_TOKEN`, `NLS_VOICE` |
| 阿里云 SSECP | 儿童英文句子/单词评测 | `SSECP_APP_ID`, `SSECP_APP_SECRET`, `SSECP_USER_CLIENT_IP` |
