# 教学组件契约（唯一契约源）

> **本文件是前后端数据结构的唯一权威定义。**
> 任何字段改动必须同一 PR 内同步：本文件 + `app/src/types/lesson.ts` + `server/app/schemas/lesson.py`。
> 一节课程 = 以下组件对象组成的数组，顺序即展示顺序。

## 1. Word - 单词学习

向学生展示和教授一个新单词。

```json
{
  "type": "word",
  "word": "apple",
  "meaning": "苹果",
  "example": "I like apples.",
  "exampleMeaning": "我喜欢苹果。",
  "message": "Apple 就是苹果，跟着我一起记住它吧！"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `word` |
| `word` | string | 要学习的英文单词 |
| `meaning` | string | 单词中文含义 |
| `example` | string | 使用该单词的示例句子 |
| `exampleMeaning` | string | 示例句子的中文含义 |
| `message` | string | 吉祥物对学生说的教学内容 |

## 2. Sentence - 句子学习

教授一个完整英语句子或句型。

```json
{
  "type": "sentence",
  "sentence": "I like apples.",
  "meaning": "我喜欢苹果。",
  "message": "I like ... 可以用来告诉别人你喜欢什么。"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `sentence` |
| `sentence` | string | 要学习的英文句子 |
| `meaning` | string | 句子的中文含义 |
| `message` | string | 吉祥物的讲解内容 |

## 3. Recall - 回忆练习

主要练习组件，同时覆盖单词与句子：

- 中译英（`zh_to_en`）
- 英译中（`en_to_zh`）
- 单词/句子听写（`audio_to_text`，前端用 TTS 播放 `prompt`，不显示文字）
- 填空（`fill_blank`，`prompt` 中以 `____` 标记空位）

```json
{
  "type": "recall",
  "mode": "zh_to_en",
  "prompt": "",
  "answer": "",
  "message": ""
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `recall` |
| `mode` | string | 见下表 |
| `prompt` | string | 给学生展示或播放的题目内容 |
| `answer` | string | 标准答案，用于判定 |
| `message` | string | 吉祥物给出的题目说明或提示 |

各 mode 示例：

```json
{ "type": "recall", "mode": "zh_to_en", "prompt": "苹果", "answer": "apple", "message": "苹果用英语怎么说？" }
{ "type": "recall", "mode": "zh_to_en", "prompt": "我喜欢苹果。", "answer": "I like apples.", "message": "试着把这句话写成英文吧！" }
{ "type": "recall", "mode": "en_to_zh", "prompt": "apple", "answer": "苹果", "message": "apple 是什么意思呢？" }
{ "type": "recall", "mode": "audio_to_text", "prompt": "apple", "answer": "apple", "message": "听一听，把你听到的单词写下来。" }
{ "type": "recall", "mode": "fill_blank", "prompt": "I like ____.", "answer": "apples", "message": "把缺少的单词填进去吧！" }
```

## 4. Pronunciation - 跟读练习

前端播放标准发音，学生跟读，由发音评测服务判定结果。

```json
{
  "type": "pronunciation",
  "content": "apple",
  "meaning": "苹果",
  "message": "跟着我读一遍：apple！"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `pronunciation` |
| `content` | string | 学生需要跟读的单词或句子 |
| `meaning` | string | 中文含义 |
| `message` | string | 吉祥物给出的跟读提示 |

## 5. Dialog - 场景对话

运行时 AI 组件。课程生成阶段只规定场景、目标、开场白；
之后的对话由运行时大模型根据学生回答动态生成，完成 `goal` 后结束。

```json
{
  "type": "dialog",
  "scene": "水果店",
  "goal": "让学生使用 I like ... 表达自己喜欢的水果，并练习 apple 和 banana",
  "opening": "Hello! What fruit do you like?"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | string | 固定为 `dialog` |
| `scene` | string | 对话场景 |
| `goal` | string | 本次对话需要完成的学习目标 |
| `opening` | string | AI 的第一句话 |

对话示例：

> AI: Hello! What fruit do you like?
> 学生: I like apples.
> AI: Great! I like apples too. Do you like bananas?

## 职责总览

| 类型 | 核心职责 |
| --- | --- |
| `word` | 学习新的单词知识 |
| `sentence` | 学习新的句子和句型 |
| `recall` | 主动回忆、翻译、听写、填空 |
| `pronunciation` | 听标准发音并进行跟读 |
| `dialog` | 将已学知识用于真实对话 |

## 完整课程示例

```json
[
  { "type": "word", "word": "apple", "meaning": "苹果", "example": "I like apples.",
    "exampleMeaning": "我喜欢苹果。", "message": "今天我们认识 apple！" },
  { "type": "recall", "mode": "en_to_zh", "prompt": "apple", "answer": "苹果", "message": "apple 是什么意思？" },
  { "type": "recall", "mode": "zh_to_en", "prompt": "苹果", "answer": "apple", "message": "苹果用英语怎么说？" },
  { "type": "pronunciation", "content": "apple", "meaning": "苹果", "message": "跟着我读：apple！" },
  { "type": "sentence", "sentence": "I like apples.", "meaning": "我喜欢苹果。", "message": "我们再来学习一个句子。" },
  { "type": "recall", "mode": "fill_blank", "prompt": "I like ____.", "answer": "apples", "message": "把缺少的单词补上吧！" },
  { "type": "recall", "mode": "zh_to_en", "prompt": "我喜欢苹果。", "answer": "I like apples.", "message": "现在试着写出完整句子。" },
  { "type": "pronunciation", "content": "I like apples.", "meaning": "我喜欢苹果。", "message": "最后把整句话读出来！" },
  { "type": "dialog", "scene": "水果店", "goal": "让学生使用 I like ... 表达喜欢的水果", "opening": "Hello! What fruit do you like?" }
]
```

> 注意：以上是组件自身的 JSON。**接口传输时**额外包一层信封
> `{ "id": <资源id>, "component": <上面的对象> }`，资源 id 即数据库自增主键。
