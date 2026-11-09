---
inclusion: auto
name: cobol-primer
description: Quick COBOL and GnuCOBOL reference. Use when writing, debugging or explaining COBOL programs, PIC clauses, fixed-format columns, or GnuCOBOL compiler errors.
---

# COBOL primer for this repo

- **Fixed format columns:** 1–6 sequence number area, 7 indicator (`*` comment, `-` continuation), 8–11 Area A (division, section, paragraph names, `01`/`77` levels), 12–72 Area B (statements), 73–80 ignored.
- **Divisions:** IDENTIFICATION (name), ENVIRONMENT (machine/files), DATA (every variable declared with size up front), PROCEDURE (the code).
- **PIC clauses:** `9` digit, `X` any char, `V` implied decimal point (not stored), `S` sign, `Z` zero-suppressed digit in edited output, `.` printed decimal point. `PIC S9(7)V99` = signed, 7 integer digits, 2 decimals.
- **Common verbs:** `ACCEPT` (read stdin), `DISPLAY` (print), `MOVE`, `ADD … TO`, `COMPUTE`, `PERFORM … UNTIL` / `PERFORM VARYING`, `UNSTRING … DELIMITED BY "," INTO …`, `INSPECT`, `IF … END-IF`, `EVALUATE` (switch).
- **Numbers from text:** `FUNCTION NUMVAL(WS-TEXT)` converts "1520.25" to a number.
- **GnuCOBOL compile:** `cobc -x prog.cob` builds an executable. In free-format mode, put `>>SOURCE FORMAT IS FIXED` first to compile fixed-format source.
- **Python equivalents to name in narration:** UNSTRING → `str.split`; PIC V99 → `Decimal` with 2 places; PERFORM UNTIL → `while`; PERFORM VARYING → `for`; EVALUATE → `match`/`if-elif`; 01 group item → `dataclass`.
