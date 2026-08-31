"""语音服务共用的轻量音频格式工具。"""
import struct


def pcm16_to_wav(
    pcm_data: bytes,
    sample_rate: int = 16000,
    channels: int = 1,
) -> bytes:
    """给 16-bit little-endian PCM 添加标准 44 字节 WAV 头。"""
    sample_width = 2
    byte_rate = sample_rate * channels * sample_width
    block_align = channels * sample_width
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm_data)) + b"WAVE"
    header += b"fmt " + struct.pack("<I", 16)
    header += struct.pack("<H", 1)
    header += struct.pack("<H", channels)
    header += struct.pack("<I", sample_rate)
    header += struct.pack("<I", byte_rate)
    header += struct.pack("<H", block_align)
    header += struct.pack("<H", 16)
    header += b"data" + struct.pack("<I", len(pcm_data))
    return header + pcm_data
