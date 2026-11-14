# 05. Strings, Runes & Formatting
Version: Go 1.27.4
Prerequisites: 04-functions

## Learning goals
- learner can explain that a string is read-only bytes and that len counts bytes
- learner can loop over characters (runes) correctly
- learner can use common strings functions and strings.Builder
- learner can convert between strings and numbers with strconv
- learner can format output with fmt verbs and Sprintf

## Sub-topics
### Strings as immutable bytes
- Concept: string = read-only sequence of bytes (gloss byte = 8-bit number 0–255); `len` counts bytes; `s[i]` is a byte; can't change `s[0]`; `+` builds a new string; raw strings with backticks.
- Analogy: printed sentence on paper — you can read any letter, but to change one you print a new sheet.
- Code example: bytes.go — `s := "héllo"`; `fmt.Println(len(s), s[0])` → `6 104` (é takes 2 bytes; 104 = 'h')
- Production use: building messages, comparing IDs, raw strings for regex/SQL.
- Common mistakes: `s[0] = 'H'` → compile error; assuming len = number of characters.
- Sources: https://go.dev/blog/strings ; https://go.dev/ref/spec#String_types

### Runes and UTF-8
- Concept: rune = one Unicode character (alias int32); UTF-8 stores a character in 1–4 bytes; `for i, r := range s` walks characters with byte index; `utf8.RuneCountInString`; `'a'` rune literal vs `"a"` string.
- Analogy: Lego — every character is built from 1 to 4 bricks (bytes); `range` hands you whole models, not loose bricks.
- Code example: runes.go — `for i, r := range "héllo" { fmt.Println(i, string(r)) }` → `0 h`,`1 é`,`3 l`,`4 l`,`5 o`; `utf8.RuneCountInString("héllo")` → `5`
- Production use: user names in any language, truncating text safely.
- Common mistakes: slicing in the middle of a multi-byte char; looping `for i := 0; i < len(s)` and treating bytes as characters.
- Sources: https://go.dev/blog/strings ; https://pkg.go.dev/unicode/utf8#RuneCountInString ; https://go.dev/ref/spec#For_range

### strings package (Contains, Split, Cut, Builder)
- Concept: `strings.Contains`, `HasPrefix`, `ToUpper`, `TrimSpace`, `Split` (returns a list — gloss slice, topic 06), `Join`, `Cut` (split once into before/after/found), `strings.Builder` for efficient building in loops.
- Analogy: Swiss army knife for text — one handle, many blades.
- Code example: strs.go — `strings.Contains("seafood", "foo")` → `true`; `fmt.Println(strings.Split("a,b,c", ","))` → `[a b c]`; `k, v, ok := strings.Cut("port=8080", "=")` → `port 8080 true`; Builder writing `"go"` 3 times with `-` between → `go-go-go`
- Production use: parsing headers/key=value config, building output.
- Common mistakes: `+=` in a big loop (slow, use Builder); `Split` on empty string returns `[""]` (one element).
- Sources: https://pkg.go.dev/strings ; https://pkg.go.dev/strings#Cut ; https://pkg.go.dev/strings#Builder

### strconv conversions
- Concept: `strconv.Itoa(42)` → "42"; `strconv.Atoi("123")` → 123 and an error value (gloss; full topic 11); `ParseFloat`, `ParseBool`, `FormatFloat`; `if err != nil` check preview.
- Analogy: translator between "number language" and "text language" — and it tells you when the text isn't a number.
- Code example: conv.go — `strconv.Itoa(42) + "!"` → `42!`; `n, err := strconv.Atoi("123")` → `123 <nil>`; `_, err = strconv.Atoi("12a")`; `fmt.Println(err)` → `strconv.Atoi: parsing "12a": invalid syntax`
- Production use: query params, env vars, CSV fields are all text.
- Common mistakes: `string(42)` instead of Itoa; ignoring the error from Atoi.
- Sources: https://pkg.go.dev/strconv#Atoi ; https://pkg.go.dev/strconv#Itoa

### fmt verbs and Sprintf
- Concept: `%v` default, `%+v` with field names (topic 08), `%d`, `%s`, `%q`, `%f`/`%.2f`, `%t`, `%T`, `%%`; width `%5.2f`, `%-6s` left-align; `Printf` prints, `Sprintf` returns a string, `Println` adds spaces + newline.
- Analogy: mail-merge letter template — blanks (verbs) filled in order by the values you pass.
- Code example: fmtx.go — `s := fmt.Sprintf("%-6s|%5.2f|%q", "tea", 3.14159, "hi")`; `fmt.Println(s)` → `tea   | 3.14|"hi"`
- Production use: log/error messages, aligned CLI tables.
- Common mistakes: forgetting `\n` with Printf; verb/argument count mismatch → output like `%!d(MISSING)`; wrong verb type → caught by go vet.
- Sources: https://pkg.go.dev/fmt#hdr-Printing ; https://pkg.go.dev/fmt#Sprintf

## Quiz
1. len("héllo")? — tests bytes vs characters
2. What does range over a string yield? — tests runes
3. Return values of strings.Cut — tests Cut
4. Convert "123" to int — tests Atoi + error
5. Output of %5.2f for 3.14159 — tests width/precision
