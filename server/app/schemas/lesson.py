"""教学组件服务端契约；字段与 docs/lesson-components.md 保持一致。"""
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field


class StrictComponent(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WordComponent(StrictComponent):
    type: Literal["word"]
    word: str = Field(min_length=1, max_length=120)
    meaning: str = Field(min_length=1, max_length=240)
    example: str = Field(min_length=1, max_length=500)
    exampleMeaning: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=500)


class SentenceComponent(StrictComponent):
    type: Literal["sentence"]
    sentence: str = Field(min_length=1, max_length=500)
    meaning: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=500)


class RecallComponent(StrictComponent):
    type: Literal["recall"]
    mode: Literal["zh_to_en", "en_to_zh", "audio_to_text", "fill_blank"]
    prompt: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=500)


class PronunciationComponent(StrictComponent):
    type: Literal["pronunciation"]
    content: str = Field(min_length=1, max_length=500)
    meaning: str = Field(min_length=1, max_length=500)
    message: str = Field(min_length=1, max_length=500)


class DialogComponent(StrictComponent):
    type: Literal["dialog"]
    scene: str = Field(min_length=1, max_length=200)
    goal: str = Field(min_length=1, max_length=800)
    opening: str = Field(min_length=1, max_length=500)


LessonComponent = Annotated[
    Union[WordComponent, SentenceComponent, RecallComponent, PronunciationComponent, DialogComponent],
    Field(discriminator="type"),
]


class LessonSection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=96, pattern=r"^[A-Za-z0-9_.-]+$")
    title: str = Field(min_length=1, max_length=255)
    activities: list[LessonComponent] = Field(min_length=1, max_length=500)


class CourseContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    intro: str = Field(default="", max_length=2000)
    sections: list[LessonSection] = Field(min_length=1, max_length=100)
