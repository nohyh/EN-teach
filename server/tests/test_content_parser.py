"""教材解析器与唯一课程契约测试。"""
import json

from app.services.content_parser import parse_source, validate_course_content


def test_flat_json_is_grouped_and_validated():
    source = {
        "title": "Fruit English",
        "intro": "水果英语",
        "activities": [
            {
                "sectionId": "lesson-1",
                "sectionTitle": "Apple",
                "type": "word",
                "word": "apple",
                "meaning": "苹果",
                "example": "I like apples.",
                "exampleMeaning": "我喜欢苹果。",
                "message": "一起学习 apple。",
            }
        ],
    }
    parsed, _text = parse_source("course.json", json.dumps(source, ensure_ascii=False).encode())
    canonical, errors = validate_course_content(parsed)
    assert not errors
    assert canonical["sections"][0]["id"] == "lesson-1"
    assert canonical["sections"][0]["activities"][0]["type"] == "word"


def test_markdown_generates_all_five_activity_types():
    markdown = """# Fruit Shop
apple - 苹果
I like apples. | 我喜欢苹果。
"""
    parsed, extracted = parse_source("fruit.md", markdown.encode())
    canonical, errors = validate_course_content(parsed)
    assert extracted == markdown
    assert not errors
    activity_types = {item["type"] for item in canonical["sections"][0]["activities"]}
    assert activity_types == {"word", "sentence", "recall", "pronunciation", "dialog"}


def test_chinese_markdown_headings_create_distinct_sections():
    parsed, _ = parse_source(
        "course.md",
        "# 水果集市\napple - 苹果\n# 礼貌购物\nThank you. | 谢谢。".encode(),
    )
    assert [section["id"] for section in parsed["sections"]] == ["section-1", "section-2"]
    assert [section["title"] for section in parsed["sections"]] == ["水果集市", "礼貌购物"]


def test_fill_blank_requires_visible_blank_marker():
    invalid = {
        "title": "Invalid",
        "intro": "",
        "sections": [{
            "id": "lesson-1",
            "title": "One",
            "activities": [{
                "type": "recall",
                "mode": "fill_blank",
                "prompt": "I like apples.",
                "answer": "apples",
                "message": "Fill it.",
            }],
        }],
    }
    canonical, errors = validate_course_content(invalid)
    assert canonical is None
    assert errors[0]["type"] == "missing_blank"
