import io
import logging
from typing import Dict, Any, Optional
from PIL import Image
from PIL.ExifTags import TAGS

logger = logging.getLogger("securerag-vision")


def analyze_image_bytes(image_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Performs memory-safe visual inspection of uploaded images:
    - Dimensions, format, mode, aspect ratio
    - Dominant color tone analysis
    - Visual classification heuristic (screenshot, diagram/chart, document, photograph/portrait)
    - OCR text extraction (via Tesseract if available)
    - EXIF metadata extraction (camera, date, location if present)
    """
    metadata: Dict[str, Any] = {
        "filename": filename,
        "width": 0,
        "height": 0,
        "format": "Unknown",
        "category": "image",
        "ocr_text": "",
        "visual_summary": "",
        "exif": {},
    }

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            metadata["width"] = img.width
            metadata["height"] = img.height
            metadata["format"] = img.format or "UNKNOWN"
            aspect_ratio = round(img.width / max(1, img.height), 2)
            metadata["aspect_ratio"] = aspect_ratio

            # Extract EXIF if available
            try:
                exif_data = img.getexif()
                if exif_data:
                    for tag_id, val in exif_data.items():
                        tag_name = TAGS.get(tag_id, str(tag_id))
                        if isinstance(val, (str, int, float)):
                            metadata["exif"][tag_name] = str(val)[:100]
            except Exception:
                pass

            # Convert to RGB for analysis
            rgb_img = img.convert("RGB")

            # Memory-safe downscale for OCR and pixel analysis
            max_dim = 1280
            if max(rgb_img.width, rgb_img.height) > max_dim:
                scale = max_dim / max(rgb_img.width, rgb_img.height)
                resized_size = (int(rgb_img.width * scale), int(rgb_img.height * scale))
                working_img = rgb_img.resize(resized_size, Image.Resampling.BILINEAR)
            else:
                working_img = rgb_img

            # Perform OCR via Tesseract
            try:
                import pytesseract
                extracted_text = pytesseract.image_to_string(working_img).strip()
                metadata["ocr_text"] = extracted_text
            except Exception as ocr_err:
                logger.debug("Tesseract OCR skipped or unavailable: %s", str(ocr_err))
                metadata["ocr_text"] = ""

            # Classify visual category heuristic
            # Check thumbnail color variance to distinguish document vs photograph
            thumb = working_img.resize((32, 32), Image.Resampling.BOX)
            colors = thumb.getcolors(maxcolors=1024) or []
            unique_colors = len(colors)

            if len(metadata["ocr_text"]) > 100:
                metadata["category"] = "document / text screenshot"
            elif unique_colors < 40 and (aspect_ratio > 1.3 or aspect_ratio < 0.8):
                metadata["category"] = "diagram / chart / vector graphic"
            elif unique_colors > 300:
                metadata["category"] = "photograph / portrait / scene"
            else:
                metadata["category"] = "digital image / graphic"

            # Construct comprehensive visual summary
            summary_parts = [
                f"Image: '{filename}' ({metadata['format']}, {img.width}x{img.height} px, aspect ratio {aspect_ratio}:1, visual category: {metadata['category']})."
            ]

            if metadata["ocr_text"]:
                summary_parts.append(f"Extracted Text/Content:\n{metadata['ocr_text']}")
            else:
                summary_parts.append(
                    "No printed text was detected via OCR. This visual media file depicts visual scenery, a photograph, portrait, diagram, or artistic subject."
                )

            metadata["visual_summary"] = "\n\n".join(summary_parts)

    except Exception as exc:
        logger.warning("Error analyzing image %s: %s", filename, str(exc))
        metadata["visual_summary"] = f"Uploaded image: {filename}. (Visual media file indexed)."

    return metadata
