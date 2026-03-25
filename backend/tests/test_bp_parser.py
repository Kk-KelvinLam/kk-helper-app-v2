"""Tests for the BP text parser service."""

import pytest

from backend.services.bp_parser import (
    detect_irregular_heartbeat,
    normalize_bp_text,
    parse_bp_text,
    strip_datetime_patterns,
)


# ---------------------------------------------------------------------------
# normalize_bp_text
# ---------------------------------------------------------------------------


class TestNormalizeBPText:
    def test_empty_string(self):
        assert normalize_bp_text("") == ""

    def test_fullwidth_digits(self):
        assert normalize_bp_text("１２３") == "123"

    def test_pipe_to_one(self):
        assert normalize_bp_text("1|2") == "112"

    def test_uppercase_o_to_zero(self):
        assert normalize_bp_text("1O2") == "102"

    def test_brace_to_one(self):
        assert normalize_bp_text("1}2") == "112"

    def test_b_to_six(self):
        assert normalize_bp_text("1b2") == "162"

    def test_z_to_two(self):
        assert normalize_bp_text("1z3") == "123"
        assert normalize_bp_text("1Z3") == "123"

    def test_g_to_nine(self):
        assert normalize_bp_text("1g2") == "192"

    def test_q_to_nine(self):
        assert normalize_bp_text("1q2") == "192"

    def test_exclamation_to_one(self):
        assert normalize_bp_text("1!2") == "112"

    def test_bracket_to_one(self):
        assert normalize_bp_text("1[2") == "112"
        assert normalize_bp_text("1]2") == "112"

    def test_sandwiched_s_to_five(self):
        assert normalize_bp_text("1S2") == "152"

    def test_sandwiched_b_to_eight(self):
        assert normalize_bp_text("1B2") == "182"

    def test_sandwiched_d_to_zero(self):
        assert normalize_bp_text("1D2") == "102"

    def test_remove_decimal_between_digits(self):
        assert normalize_bp_text("1.1.4") == "114"

    def test_collapse_whitespace(self):
        result = normalize_bp_text("SYS   120")
        assert "  " not in result


# ---------------------------------------------------------------------------
# detect_irregular_heartbeat
# ---------------------------------------------------------------------------


class TestDetectIrregularHeartbeat:
    def test_english_ihb(self):
        assert detect_irregular_heartbeat("SYS 120 IHB DIA 80") is True

    def test_traditional_chinese(self):
        assert detect_irregular_heartbeat("不規則 120") is True

    def test_simplified_chinese(self):
        assert detect_irregular_heartbeat("不规则") is True

    def test_no_ihb(self):
        assert detect_irregular_heartbeat("SYS 120 DIA 80 PUL 72") is False


# ---------------------------------------------------------------------------
# strip_datetime_patterns
# ---------------------------------------------------------------------------


class TestStripDateTimePatterns:
    def test_iso_date(self):
        result = strip_datetime_patterns("2024/01/15 120 80")
        assert "2024" not in result
        assert "120" in result

    def test_time_pattern(self):
        result = strip_datetime_patterns("12:30 120 80")
        assert "12:30" not in result

    def test_year_only(self):
        result = strip_datetime_patterns("2024 120 80")
        assert "2024" not in result


# ---------------------------------------------------------------------------
# parse_bp_text — Strategy 1 (Labeled)
# ---------------------------------------------------------------------------


class TestParseBPTextStrategy1:
    def test_english_labels(self):
        result = parse_bp_text("SYS 120 DIA 80 PUL 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 1

    def test_english_with_dots(self):
        result = parse_bp_text("SYS. 135 DIA. 85 PUL. 68")
        assert result["systolic"] == "135"
        assert result["diastolic"] == "85"
        assert result["heart_rate"] == "68"
        assert result["strategy"] == 1

    def test_traditional_chinese(self):
        result = parse_bp_text("收縮壓 120 舒張壓 80 脈搏 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 1

    def test_simplified_chinese(self):
        result = parse_bp_text("收缩压 120 舒张压 80 脉搏 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 1

    def test_reversed_order(self):
        result = parse_bp_text("114 高壓\n75 低壓\n72 心跳")
        assert result["systolic"] == "114"
        assert result["diastolic"] == "75"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 1

    def test_with_units(self):
        result = parse_bp_text("SYS mmHg 120 DIA mmHg 80 PUL 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["strategy"] == 1

    def test_with_ihb(self):
        result = parse_bp_text("SYS 120 DIA 80 PUL 72 IHB")
        assert result["systolic"] == "120"
        assert result["irregular_heartbeat"] is True


# ---------------------------------------------------------------------------
# parse_bp_text — Strategy 2 (Slash)
# ---------------------------------------------------------------------------


class TestParseBPTextStrategy2:
    def test_simple_slash(self):
        result = parse_bp_text("120/80")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["strategy"] == 2

    def test_slash_with_hr(self):
        result = parse_bp_text("120/80 72BPM")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 2

    def test_invalid_range_ignored(self):
        # sys < dia should not match
        result = parse_bp_text("80/120")
        assert result["strategy"] != 2 or not result["systolic"]


# ---------------------------------------------------------------------------
# parse_bp_text — Strategy 3 (Numbers only)
# ---------------------------------------------------------------------------


class TestParseBPTextStrategy3:
    def test_three_numbers(self):
        result = parse_bp_text("120\n80\n72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 3

    def test_with_digit_only_text(self):
        result = parse_bp_text("noisy text", "120 80 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
        assert result["heart_rate"] == "72"
        assert result["strategy"] == 3

    def test_two_numbers(self):
        result = parse_bp_text("130 85")
        assert result["systolic"] == "130"
        assert result["diastolic"] == "85"
        assert result["strategy"] == 3

    def test_empty_text(self):
        result = parse_bp_text("")
        assert result["systolic"] == ""
        assert result["diastolic"] == ""
        assert result["heart_rate"] == ""
        assert result["strategy"] is None

    def test_date_stripped(self):
        result = parse_bp_text("2024/01/15 120 80 72")
        assert result["systolic"] == "120"
        assert result["diastolic"] == "80"
