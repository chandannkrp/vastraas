"""Provider-agnostic fabric image generation / studio upscaling.

Two entry points on every provider:
- `generate(prompt, aspect)`      — create a new studio image from text.
- `edit(image, prompt, aspect)`   — upscale/restage an uploaded raw photo,
                                     preserving the real fabric.

Providers:
- Gemini 2.5 Flash Image ("nano banana") — fast, cheap, photoreal, native
  reference-image editing. Default.
- gpt-image-1 (OpenAI) — fallback / alternative.

`get_image_service()` returns the one configured by `IMAGE_PROVIDER`.
`DRY_RUN_IMAGES=true` short-circuits to a local placeholder so the whole flow
can be exercised without spending on any API.
"""

import base64
import io

from app.config import get_settings

settings = get_settings()

# --------------------------------------------------------------------------- #
# Prompt rules — fabric commerce lives and dies on fidelity to the real cloth
# and on looking like a real photoshoot, so these are non-negotiable.
# --------------------------------------------------------------------------- #
FABRIC_FIDELITY_RULE = (
    "CRITICAL: the fabric shown is a real, physical textile photographed by the seller. "
    "Reproduce its exact true colour, hue, saturation, weave, grain, slubs, print and every "
    "texture detail with photographic accuracy. Do NOT clean up, smooth over, airbrush, "
    "repaint, recolour or stylise the cloth itself — its real weave and small irregularities "
    "are what make it authentic and must survive intact. Only elevate the photography around "
    "it: professional studio lighting, correct white balance, crisp focus and a tasteful "
    "backdrop, as if a real product photographer upscaled the original shot."
)

PHOTOREAL_STUDIO_RULE = (
    "Shoot it like a real, high-end fashion e-commerce photograph: full, well-composed framing "
    "(not an extreme close-up unless asked), soft diffused studio lighting, a clean neutral "
    "backdrop with tasteful minimal props, natural shadows and true-to-life colour. Photorealistic, "
    "shot on a full-frame DSLR with a 50mm lens, shallow but natural depth of field. "
    "Never illustrated, painted, plastic, over-processed, HDR, CGI or obviously AI-generated."
)

PHOTOREAL_MODEL_RULE = (
    "If a human model appears, they must look like a real person in a real photoshoot: a natural "
    "South-Asian fashion model, realistic skin with visible pores and subtle imperfections, "
    "realistic anatomy and hands, natural hair, relaxed confident full-body posture, soft "
    "true-to-life lighting. Absolutely no waxy, airbrushed, plastic, doll-like, surreal or "
    "uncanny-valley appearance."
)

_RULES = f"{FABRIC_FIDELITY_RULE}\n\n{PHOTOREAL_STUDIO_RULE}\n\n{PHOTOREAL_MODEL_RULE}"

# Scene per shot type. Framing is full/e-commerce-led (the seller's reference
# look), with close-ups reserved for the explicit macro/texture shots.
SHOT_PROMPTS: dict[str, str] = {
    "on_model": (
        "a full-length, head-to-toe editorial e-commerce photograph of a real fashion model "
        "wearing a beautifully tailored garment made from this exact fabric, standing in a "
        "natural confident pose in a bright minimal studio with a soft neutral backdrop"
    ),
    "draped": (
        "the fabric elegantly draped full-length over a studio stand or mannequin so its real "
        "fall, weight and sheen are fully visible, softly lit on a clean backdrop"
    ),
    "flatlay": (
        "a clean overhead flat-lay of the fabric, neatly smoothed and squared to the frame, "
        "styled like a premium e-commerce catalogue photo on a soft neutral surface with a "
        "small tasteful prop"
    ),
    "flat_fold": (
        "the fabric neatly folded into a premium stack, three-quarter angle, showing the folded "
        "edge, selvage and natural drape on a clean surface"
    ),
    "lifestyle": (
        "a full-scene aspirational lifestyle/editorial photograph of a garment made from this "
        "fabric worn by a real model in a softly-lit interior with natural daylight and tasteful props"
    ),
    "macro": "an extreme macro close-up of the real weave, individual threads and surface texture, razor-sharp and true to colour",
    "closeup_texture": "a macro close-up highlighting the exact real weave, sheen and texture of the cloth, every fibre in focus",
}

# Shots that read best as portrait (full-body / drape) vs square (detail/flat).
_PORTRAIT_SHOTS = {"on_model", "draped", "lifestyle"}


def scene_for(shot: str) -> str:
    return SHOT_PROMPTS.get(shot) or f"styled as: {shot}"


def aspect_for(shot: str) -> str:
    return "3:4" if shot in _PORTRAIT_SHOTS else "1:1"


def build_prompt(descriptor: str, shot: str, custom_prompt: str = "", has_reference: bool = True) -> str:
    """Central prompt builder shared by the pipeline and the regenerate endpoint."""
    scene = scene_for(shot)
    extra = f" Additional direction from the seller: {custom_prompt.strip()}." if custom_prompt.strip() else ""
    if has_reference:
        return (
            f"The attached image is a real photo of {descriptor}. Keep this exact fabric — its "
            f"real colour, weave, print and texture — completely unchanged, and upgrade the "
            f"photograph into {scene}. Treat the cloth in the photo as ground truth to preserve, "
            f"not to redraw or clean up.{extra}"
        )
    return f"A professional studio photograph of {descriptor}, shown as {scene}.{extra}"


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #
class GeminiImageService:
    """Google Gemini 2.5 Flash Image — cheap, fast, photoreal, edits by reference."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from google import genai

            key = settings.gemini_api_key or settings.google_api_key
            if not key:
                raise RuntimeError("GEMINI_API_KEY not configured")
            self._client = genai.Client(api_key=key)
        return self._client

    def _run(self, contents: list, aspect: str) -> bytes:
        from google.genai import types

        resp = self.client.models.generate_content(
            model=settings.gemini_image_model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(aspect_ratio=aspect),
            ),
        )
        for cand in resp.candidates or []:
            for part in (cand.content.parts if cand.content else []) or []:
                inline = getattr(part, "inline_data", None)
                if inline and inline.data:
                    return _normalize_png(inline.data)
        raise RuntimeError("Gemini returned no image (possibly blocked or empty response)")

    def generate(self, prompt: str, aspect: str = "1:1", quality: str | None = None) -> bytes:
        full = f"{prompt}\n\n{_RULES}"
        if settings.dry_run_images:
            return _placeholder_png(prompt)
        return self._run([full], aspect)

    def edit(
        self, image_bytes: bytes, prompt: str, aspect: str = "3:4", quality: str | None = None, filename: str = "input.png"
    ) -> bytes:
        from google.genai import types

        full = f"{prompt}\n\n{_RULES}"
        if settings.dry_run_images:
            return _placeholder_png(prompt)
        img_part = types.Part.from_bytes(data=image_bytes, mime_type="image/png")
        return self._run([full, img_part], aspect)


class OpenAIImageService:
    """OpenAI gpt-image-1 — alternative provider."""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI

            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY not configured")
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    def generate(self, prompt: str, aspect: str = "1:1", quality: str | None = None) -> bytes:
        full = f"{prompt}\n\n{_RULES}"
        if settings.dry_run_images:
            return _placeholder_png(prompt)
        result = self.client.images.generate(
            model=settings.openai_image_model,
            prompt=full,
            size=_openai_size(aspect),
            quality=quality or settings.openai_image_quality,
            n=1,
        )
        return base64.b64decode(result.data[0].b64_json)

    def edit(
        self, image_bytes: bytes, prompt: str, aspect: str = "3:4", quality: str | None = None, filename: str = "input.png"
    ) -> bytes:
        full = f"{prompt}\n\n{_RULES}"
        if settings.dry_run_images:
            return _placeholder_png(prompt)
        buf = io.BytesIO(image_bytes)
        buf.name = filename
        result = self.client.images.edit(
            model=settings.openai_image_model,
            image=buf,
            prompt=full,
            size=_openai_size(aspect),
            quality=quality or settings.openai_image_quality,
            n=1,
        )
        return base64.b64decode(result.data[0].b64_json)


def get_image_service():
    """The active image provider (runtime override, else IMAGE_PROVIDER env)."""
    from app.services import runtime_config

    provider = (runtime_config.get("image_provider") or settings.image_provider or "gemini").lower()
    if provider == "openai":
        return OpenAIImageService()
    return GeminiImageService()


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _openai_size(aspect: str) -> str:
    return {"3:4": "1024x1536", "4:3": "1536x1024", "1:1": "1024x1024"}.get(aspect, settings.openai_image_size)


def _normalize_png(data: bytes) -> bytes:
    """Ensure PNG RGB bytes regardless of what the provider returned."""
    from PIL import Image as PILImage

    im = PILImage.open(io.BytesIO(data)).convert("RGB")
    out = io.BytesIO()
    im.save(out, format="PNG")
    return out.getvalue()


def _placeholder_png(label: str) -> bytes:
    """A cheap local placeholder image so dev flows never hit a paid API."""
    from PIL import Image, ImageDraw

    img = Image.new("RGB", (1024, 1024), (244, 241, 234))
    draw = ImageDraw.Draw(img)
    draw.rectangle([32, 32, 992, 992], outline=(180, 120, 90), width=6)
    text = f"[dry-run image]\n{label[:80]}"
    draw.multiline_text((64, 480), text, fill=(120, 90, 70), spacing=8)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
