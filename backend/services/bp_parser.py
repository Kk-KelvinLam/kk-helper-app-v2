"""Blood pressure text parser.

Ports the key parsing logic from the TypeScript ocrParser.ts to Python.
Supports three extraction strategies:
  1. Labeled patterns (SYS/DIA/PUL with English and Chinese labels)
  2. Slash format (120/80)
  3. Numbers-only positional extraction
"""

import re


def normalize_bp_text(raw: str) -> str:
    """Normalize OCR text for BP value extraction.

    Converts full-width digits, fixes common LCD segment misreads,
    and cleans up formatting artefacts.
    """
    if not raw:
        return ""

    t = raw

    # Full-width digits → ASCII (U+FF10–U+FF19)
    for i in range(10):
        t = t.replace(chr(0xFF10 + i), str(i))

    # Common OCR character misreads for digits adjacent to other digits
    # |, I, l → 1
    t = re.sub(r"([0-9])[|Il](?=[0-9\s])", r"\g<1>1", t)
    t = re.sub(r"[|Il](?=[0-9])", "1", t)
    # O → 0
    t = re.sub(r"([0-9])O", r"\g<1>0", t)
    t = re.sub(r"O(?=[0-9])", "0", t)

    # } → 1
    t = re.sub(r"([0-9])[}](?=[0-9\s])", r"\g<1>1", t)
    t = re.sub(r"[}](?=[0-9])", "1", t)

    # Seven-segment display misreads
    # b → 6
    t = re.sub(r"([0-9])b(?=[0-9\s])", r"\g<1>6", t)
    t = re.sub(r"b(?=[0-9])", "6", t)
    # Z/z → 2
    t = re.sub(r"([0-9])[Zz](?=[0-9\s])", r"\g<1>2", t)
    t = re.sub(r"[Zz](?=[0-9])", "2", t)
    # g → 9
    t = re.sub(r"([0-9])g(?=[0-9\s])", r"\g<1>9", t)
    t = re.sub(r"g(?=[0-9])", "9", t)
    # q → 9
    t = re.sub(r"([0-9])q(?=[0-9\s])", r"\g<1>9", t)
    t = re.sub(r"q(?=[0-9])", "9", t)
    # ! → 1
    t = re.sub(r"([0-9])!(?=[0-9\s])", r"\g<1>1", t)
    t = re.sub(r"!(?=[0-9])", "1", t)
    # [ and ] → 1
    t = re.sub(r"([0-9])[\[\]](?=[0-9\s])", r"\g<1>1", t)
    t = re.sub(r"[\[\]](?=[0-9])", "1", t)

    # Sandwiched-only substitutions (between two digits)
    # S/s → 5
    t = re.sub(r"([0-9])[Ss](?=[0-9])", r"\g<1>5", t)
    # B → 8
    t = re.sub(r"([0-9])B(?=[0-9])", r"\g<1>8", t)
    # D → 0
    t = re.sub(r"([0-9])D(?=[0-9])", r"\g<1>0", t)

    # Remove periods/commas between consecutive digits (LCD artefacts)
    prev = None
    while prev != t:
        prev = t
        t = re.sub(r"(\d)[.,](\d)", r"\1\2", t)

    # Collapse whitespace
    t = re.sub(r"[ \t]+", " ", t)

    return t.strip()


def detect_irregular_heartbeat(text: str) -> bool:
    """Detect IHB (Irregular Heartbeat) indicator in OCR text."""
    patterns = [
        re.compile(r"\bIHB\b", re.IGNORECASE),
        re.compile(r"不規則"),  # Traditional Chinese
        re.compile(r"不规则"),  # Simplified Chinese
    ]
    return any(p.search(text) for p in patterns)


def strip_datetime_patterns(text: str) -> str:
    """Remove date/time strings to prevent false BP value matches."""
    t = text
    # ISO-style dates: 2024/01/15, 2024-01-15
    t = re.sub(
        r"\b\d{4}[/\-.](?:0?[1-9]|1[0-2])[/\-.](?:0?[1-9]|[12]\d|3[01])\b",
        " ",
        t,
    )
    # Reversed dates: 15/01/2024
    t = re.sub(
        r"\b(?:0?[1-9]|[12]\d|3[01])[/\-.](?:0?[1-9]|1[0-2])[/\-.]\d{4}\b",
        " ",
        t,
    )
    # Time patterns: 12:30
    t = re.sub(r"\b(?:[01]?\d|2[0-3]):[0-5]\d\b", " ", t)
    # Standalone 4-digit year
    t = re.sub(r"\b(?:19|20)\d{2}\b", " ", t)
    return t


def parse_bp_text(text: str, digit_only_text: str | None = None) -> dict:
    """Parse OCR text from a blood pressure monitor display.

    Supports:
    - Labeled formats (English: SYS/DIA/PUL, Chinese: 收縮壓/舒張壓/脈搏)
    - Slash format (120/80)
    - Numbers-only extraction (positional or sorted)

    Returns a dict with systolic, diastolic, heart_rate, strategy,
    and irregular_heartbeat fields.
    """
    result = {
        "systolic": "",
        "diastolic": "",
        "heart_rate": "",
        "strategy": None,
        "irregular_heartbeat": None,
    }

    normalized = normalize_bp_text(text)
    if not normalized:
        return result

    # Detect IHB
    if detect_irregular_heartbeat(text) or detect_irregular_heartbeat(normalized):
        result["irregular_heartbeat"] = True

    # --- Strategy 1: Labeled patterns ---
    SYS_LABEL = r"(?:SYS(?:TOLIC)?|上壓|上压|收縮壓?|收缩压?|收縮|收缩|高压|高壓)"
    DIA_LABEL = r"(?:DIA(?:STOLIC)?|下壓|下压|舒張壓?|舒张压?|舒張|舒张|低压|低壓)"
    PUL_LABEL = r"(?:PUL(?:SE)?|HR|HEART[ \t]*RATE|PR|脈搏|脉搏|脉博|脈博|心跳|脈率|脉率|心率)"
    BP_UNIT = r"(?:mm[ \t]*Hg|kPa)"
    PUL_UNIT = r"(?:/min|bpm|搏[ \t]*[/／][ \t]*分|次[ \t]*[/／][ \t]*分)"
    SP = r"[ \t]"

    # Forward: label [unit] number
    sys_match = re.search(
        rf"{SYS_LABEL}[.:{SP}]*{BP_UNIT}?{SP}*(\d{{2,3}})", normalized, re.IGNORECASE
    )
    dia_match = re.search(
        rf"{DIA_LABEL}[.:{SP}]*{BP_UNIT}?{SP}*(\d{{2,3}})", normalized, re.IGNORECASE
    )
    pul_match = re.search(
        rf"{PUL_LABEL}[.:{SP}]*{PUL_UNIT}?{SP}*(\d{{2,3}})", normalized, re.IGNORECASE
    )

    # Reverse: number [unit] label
    sys_match_rev = (
        re.search(
            rf"(\d{{2,3}}){SP}*{BP_UNIT}?{SP}*{SYS_LABEL}", normalized, re.IGNORECASE
        )
        if not sys_match
        else None
    )
    dia_match_rev = (
        re.search(
            rf"(\d{{2,3}}){SP}*{BP_UNIT}?{SP}*{DIA_LABEL}", normalized, re.IGNORECASE
        )
        if not dia_match
        else None
    )
    pul_match_rev = (
        re.search(
            rf"(\d{{2,3}}){SP}*{PUL_UNIT}?{SP}*{PUL_LABEL}", normalized, re.IGNORECASE
        )
        if not pul_match
        else None
    )

    if sys_match or sys_match_rev:
        result["systolic"] = (sys_match or sys_match_rev).group(1)
    if dia_match or dia_match_rev:
        result["diastolic"] = (dia_match or dia_match_rev).group(1)
    if pul_match or pul_match_rev:
        result["heart_rate"] = (pul_match or pul_match_rev).group(1)

    if result["systolic"] and result["diastolic"]:
        if not result["heart_rate"]:
            bpm_match = re.search(r"(\d{2,3})\s*BPM", normalized, re.IGNORECASE)
            if bpm_match:
                result["heart_rate"] = bpm_match.group(1)
        result["strategy"] = 1
        return result

    # --- Strategy 2: Slash format "120/80" ---
    slash_match = re.search(r"(\d{2,3})\s*[/／]\s*(\d{2,3})", normalized)
    if slash_match:
        sys_val = int(slash_match.group(1))
        dia_val = int(slash_match.group(2))
        if 70 <= sys_val <= 250 and 40 <= dia_val <= 150 and sys_val > dia_val:
            result["systolic"] = slash_match.group(1)
            result["diastolic"] = slash_match.group(2)

            if not result["heart_rate"]:
                bpm_match = re.search(r"(\d{2,3})\s*BPM", normalized, re.IGNORECASE)
                if (
                    bpm_match
                    and bpm_match.group(1) != result["systolic"]
                    and bpm_match.group(1) != result["diastolic"]
                ):
                    result["heart_rate"] = bpm_match.group(1)
            if not result["heart_rate"]:
                pul_match2 = re.search(
                    rf"{PUL_LABEL}[.:{SP}]*{PUL_UNIT}?{SP}*(\d{{2,3}})",
                    normalized,
                    re.IGNORECASE,
                )
                if pul_match2:
                    result["heart_rate"] = pul_match2.group(1)
            result["strategy"] = 2
            return result

    # --- Strategy 3: Number extraction ---
    bpm_match = re.search(r"(\d{2,3})\s*BPM", normalized, re.IGNORECASE)
    if bpm_match:
        result["heart_rate"] = bpm_match.group(1)

    # Use digit-only text when available
    raw_num_text = normalize_bp_text(digit_only_text) if digit_only_text else normalized
    num_text = strip_datetime_patterns(raw_num_text)

    # Extract all 2-3 digit numbers in valid physiological ranges
    all_numbers = []
    for m in re.finditer(r"(?:^|[^\d])(\d{2,3})(?!\d)", num_text):
        n = int(m.group(1))
        if 30 <= n <= 250:
            all_numbers.append(n)

    # Remove HR from pool if already identified
    pool = list(all_numbers)
    if result["heart_rate"]:
        hr_val = int(result["heart_rate"])
        if hr_val in pool:
            pool.remove(hr_val)

    # Positional order: sys (top), dia (middle), HR (bottom)
    if len(pool) >= 2:
        first, second = pool[0], pool[1]
        if 70 <= first <= 250 and 40 <= second <= 150 and first > second:
            result["systolic"] = str(first)
            result["diastolic"] = str(second)
            if not result["heart_rate"] and len(pool) >= 3 and 30 <= pool[2] <= 200:
                result["heart_rate"] = str(pool[2])
            result["strategy"] = 3
            return result

    # Fallback: sort by value
    unique = list(dict.fromkeys(pool))
    if len(unique) >= 2:
        sorted_vals = sorted(unique, reverse=True)
        if (
            70 <= sorted_vals[0] <= 250
            and 40 <= sorted_vals[1] <= 150
            and sorted_vals[0] > sorted_vals[1]
        ):
            result["systolic"] = str(sorted_vals[0])
            result["diastolic"] = str(sorted_vals[1])
            if (
                not result["heart_rate"]
                and len(sorted_vals) >= 3
                and 30 <= sorted_vals[2] <= 200
            ):
                result["heart_rate"] = str(sorted_vals[2])

    if result["systolic"] or result["diastolic"]:
        result["strategy"] = 3

    return result
