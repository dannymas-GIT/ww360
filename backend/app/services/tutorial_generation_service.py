"""Generate step-by-step markdown from tutorial recording interaction logs."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _shot_name(index: int) -> str:
    return f"step-{index:02d}.png"


def _strip_json(content: str) -> str:
    match = _JSON_FENCE.search(content or "")
    return match.group(1) if match else (content or "").strip()


class TutorialGenerationService:
    """Events-only fallback always works; optional OpenAI-compatible LLM when configured."""

    def transcribe_narration(self, audio: bytes, filename: str = "narration.webm") -> str:
        if not audio or not settings.WW360_OPENAI_API_KEY:
            return ""
        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.WW360_OPENAI_API_KEY,
                base_url=settings.WW360_OPENAI_BASE_URL or None,
            )
            result = client.audio.transcriptions.create(
                model=settings.WW360_OPENAI_TRANSCRIBE_MODEL,
                file=(filename, audio, "audio/webm"),
            )
            return (getattr(result, "text", "") or "").strip()
        except Exception as exc:
            logger.warning("Narration transcription failed: %s", exc)
            return ""

    async def generate_guide(
        self,
        *,
        base_title: str,
        task_title: str,
        steps: list[dict[str, Any]],
        transcript: str = "",
    ) -> dict[str, Any]:
        ordered = [s for s in steps if s.get("label")]
        ai_result = await self._ai_structure(base_title, task_title, ordered, transcript)

        if ai_result is not None:
            title = (ai_result.get("title") or task_title or f"{base_title} tutorial").strip()
            intro = (ai_result.get("intro") or "").strip()
            ai_steps = {int(s["index"]): s for s in ai_result.get("steps", []) if "index" in s}
            used_ai = True
        else:
            title = (task_title or f"{base_title} tutorial").strip()
            intro = (
                f"This guide walks through **{title}** in Water Workforce 360, step by step, "
                "with screenshots captured from the live application."
            )
            ai_steps = {}
            used_ai = False

        markdown = self._assemble_markdown(title, intro, ordered, ai_steps)
        return {
            "title": title,
            "markdown": markdown,
            "stepCount": len(ordered),
            "usedAi": used_ai,
            "usedTranscript": bool(transcript),
        }

    async def _ai_structure(
        self,
        base_title: str,
        task_title: str,
        steps: list[dict[str, Any]],
        transcript: str,
    ) -> dict[str, Any] | None:
        if not settings.WW360_OPENAI_API_KEY:
            return None
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(
                api_key=settings.WW360_OPENAI_API_KEY,
                base_url=settings.WW360_OPENAI_BASE_URL or None,
            )
        except Exception as exc:
            logger.warning("OpenAI client unavailable: %s", exc)
            return None

        step_lines = [
            f'{s["index"]}. [{s.get("type", "click")}] {s.get("label")} '
            f'(screen: {s.get("route", "")})'
            for s in steps
        ]
        transcript_block = (
            f"\n\nNarration transcript:\n{transcript}" if transcript else ""
        )
        system = (
            "You are a technical writer creating concise step-by-step software documentation "
            "for Water Workforce 360 (One Water Workforce program). Write clear imperative "
            "instructions. Do not invent actions not in the log. Respond with only JSON."
        )
        prompt = (
            f"Documentation area: '{base_title}'. Task: '{task_title or 'walkthrough'}'.\n\n"
            "Return JSON: "
            '{"title": str, "intro": str, "steps": [{"index": int, "title": str, "text": str}]}\n'
            "Keep one entry per logged step.\n\n"
            f"Interaction log:\n" + "\n".join(step_lines) + transcript_block
        )
        try:
            response = await client.chat.completions.create(
                model=settings.WW360_OPENAI_CHAT_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=min(8000, 2000 + len(steps) * 300),
            )
            content = response.choices[0].message.content if response.choices else None
            if not content:
                return None
            data = json.loads(_strip_json(content))
            if isinstance(data, dict) and "steps" in data:
                return data
        except Exception as exc:
            logger.warning("AI tutorial structuring failed: %s", exc)
        return None

    @staticmethod
    def _assemble_markdown(
        title: str,
        intro: str,
        steps: list[dict[str, Any]],
        ai_steps: dict[int, dict[str, Any]],
    ) -> str:
        lines: list[str] = [f"# {title}", "", intro, "", "## Steps", ""]
        for step in steps:
            idx = int(step["index"])
            ai = ai_steps.get(idx, {})
            heading = (ai.get("title") or step.get("label") or f"Step {idx}").strip()
            text = (ai.get("text") or step.get("label") or "").strip()
            lines.append(f"### Step {idx} — {heading}")
            lines.append("")
            if text:
                lines.append(text)
                lines.append("")
            if step.get("hasShot"):
                lines.append(f"![Step {idx}]({_shot_name(idx)})")
                lines.append("")
        return "\n".join(lines).rstrip() + "\n"


_service: TutorialGenerationService | None = None


def get_tutorial_generation_service() -> TutorialGenerationService:
    global _service
    if _service is None:
        _service = TutorialGenerationService()
    return _service
