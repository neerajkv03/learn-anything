# 07. Maps
Version: Go 1.27.4
Prerequisites: 06-arrays-slices

## Learning goals
- learner can create maps with literals and make
- learner can tell "missing" from "zero" with comma-ok
- learner can add, update and delete entries
- learner can iterate a map and print it in sorted key order
- learner can build a set with map[T]struct{}

## Sub-topics
### Creating maps
- Concept: map = key → value lookup; `map[string]int{"ann": 31, "bob": 25}`; `make(map[string]int)`; keys must be comparable; nil map (`var m map[string]int`) reads fine but writing panics.
- Analogy: phone contacts — look up a name (key), get a number (value).
- Code example: mk.go — `ages := map[string]int{"ann": 31, "bob": 25}; fmt.Println(ages["ann"], len(ages))` → `31 2`
- Production use: caches, counting, lookup by ID.
- Common mistakes: writing to a nil map → `panic: assignment to entry in nil map`; slice as key → compile error.
- Sources: https://go.dev/ref/spec#Map_types ; https://go.dev/blog/maps

### Reading with comma-ok
- Concept: missing key returns the zero value; `v, ok := m[k]` tells if it was present.
- Analogy: asking a librarian — "here's the book" vs "we don't have it"; an empty box alone can't tell you which.
- Code example: commaok.go — `ages := map[string]int{"ann": 31, "baby": 0}`; `v, ok := ages["zoe"]` → `0 false`; `v, ok = ages["baby"]` → `0 true`
- Production use: cache hit/miss, config key present?
- Common mistakes: treating 0/"" as "missing".
- Sources: https://go.dev/ref/spec#Index_expressions ; https://go.dev/blog/maps

### Adding, updating and delete
- Concept: `m[k] = v` adds or replaces; `m[k]++` works on missing keys (starts at 0); `delete(m, k)` (no error if missing); `clear(m)` empties.
- Analogy: editing your contact list — add, change number, remove a contact.
- Code example: edit.go — start `{"ann": 31, "bob": 25}`; `ages["cy"] = 40; ages["ann"]++; delete(ages, "bob"); fmt.Println(ages, len(ages))` → `map[ann:32 cy:40] 2` (gloss: fmt prints maps with keys sorted)
- Production use: word counting `counts[w]++`.
- Common mistakes: modifying a struct field inside a map value directly (`m[k].X = 1` compile error) — reassign the whole value.
- Sources: https://go.dev/ref/spec#Deletion_of_map_elements ; https://pkg.go.dev/builtin#clear

### Iteration order is random
- Concept: `for k, v := range m` order is unspecified and varies between runs; for stable order: `keys := slices.Sorted(maps.Keys(m))` (maps.Keys returns an iterator — gloss: something that hands out values one by one; slices.Sorted collects and sorts them).
- Analogy: bag of name tags — shake it and they come out in a new order every time; to read alphabetically you sort them first.
- Code example: order.go — `ages := map[string]int{"cy": 40, "ann": 32}`; `for _, k := range slices.Sorted(maps.Keys(ages)) { fmt.Println(k, ages[k]) }` → `ann 32`,`cy 40`
- Production use: deterministic output in reports, tests, JSON-like dumps.
- Common mistakes: tests that depend on map order (flaky).
- Sources: https://go.dev/ref/spec#For_range ; https://pkg.go.dev/maps#Keys ; https://pkg.go.dev/slices#Sorted

### maps package and sets with map[T]struct{}
- Concept: `maps.Clone`, `maps.Copy`, `maps.Equal`; maps are references — assigning shares data; set = `map[string]struct{}` (empty struct uses no memory; gloss struct, topic 08) or `map[string]bool`.
- Analogy: guest list — only the names matter, nothing written next to them.
- Code example: sets.go — `seen := map[string]struct{}{}; seen["go"] = struct{}{}; _, ok := seen["go"]; fmt.Println(ok, len(seen))` → `true 1`; `c := maps.Clone(ages); c["ann"] = 1` leaves `ages["ann"]` unchanged
- Production use: dedupe IDs, "already processed" tracking.
- Common mistakes: `b := a` then changing b changes a; concurrent writes from goroutines → fatal error (topic 16).
- Sources: https://pkg.go.dev/maps ; https://go.dev/ref/spec#Struct_types

## Quiz
1. Writing to a nil map does what? — tests nil map panic
2. How to tell missing key from zero value — tests comma-ok
3. Result of delete on a missing key — tests delete
4. Why sort keys before printing? — tests random order
5. Why struct{} as a set value? — tests sets
