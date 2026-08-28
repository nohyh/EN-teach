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

# 2. 配环境（不接云服务时可以全部留空）
cp .env.example .env
# 真实转写需 NLS；真实评分需 SSECP；AI 对话需 DeepSeek。

# 3. 灌数据 (在 EN-teach 项目根目录跑)
python scripts/seed_db.py

# 4. 起服务
cd server
# --host 0.0.0.0 让同一 Wi-Fi 下的手机可以访问
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 5. 试
curl http://127.0.0.1:8000/health
# {"status":"ok"}

curl http://127.0.0.1:8000/api/v1/units
# [{"id":"unit-1-hello",...},{"id":"unit-fruit",...}]
```

## 主要 API

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
| POST | `/api/v1/speech/transcribe` | 16kHz PCM 短语音转文字 |
| POST | `/api/v1/speech/evaluate` | 无需 sentence_id 的跟读评分 |
| POST | `/api/v1/ai/chat` | Lumi AI 对话 |
| POST | `/api/v1/ai/dialog-check` | 情景对话判定 |

Swagger: `http://127.0.0.1:8000/docs`

## 手机端联调

手机和电脑需在同一局域网。后端按上面的 `0.0.0.0` 方式启动，Expo 开发模式会从 Metro 地址自动推导后端 IP。若自动推导不可用，在 `app/.env` 设置：

```text
EXPO_PUBLIC_API_BASE_URL=http://电脑局域网IP:8000
```

生产包必须改成手机可访问的 HTTPS 地址，不能使用 `127.0.0.1`。

## 测试 / 验证语音能力

```bash
# 单元测试（内容适配器、评分逻辑、语音 API，纯本地）
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
| 阿里云 NLS | 短语音转文字 | `NLS_APPKEY`, `NLS_TOKEN` |
| 阿里云 SSECP | 儿童英文句子/单词评测 | `SSECP_APP_ID`, `SSECP_APP_SECRET`, `SSECP_USER_CLIENT_IP` |
| DeepSeek | AI 伙伴与情景对话判断 | `DEEPSEEK_API_KEY` |
