# 06. Arrays & Slices
Version: Go 1.27.4
Prerequisites: 05-strings-formatting

## Learning goals
- learner can tell arrays (fixed) from slices (growable)
- learner can slice and predict shared-memory effects
- learner can grow slices with append and reason about len and cap
- learner can range over slices
- learner can sort and search with the slices package

## Sub-topics
### Arrays
- Concept: `[3]int{1, 2, 3}`; length is part of the type; assignment copies all elements; rarely used directly — slices are built on them.
- Analogy: egg carton with exactly N slots; photocopying the carton gives a separate carton.
- Code example: arrays.go — `a := [3]int{1, 2, 3}; b := a; b[0] = 99; fmt.Println(a, b)` → `[1 2 3] [99 2 3]`
- Production use: fixed-size data like hashes (`[32]byte`).
- Common mistakes: index out of range → panic (gloss: crash) `index out of range [3] with length 3`; expecting `[3]int` and `[4]int` to be the same type.
- Sources: https://go.dev/ref/spec#Array_types ; https://go.dev/blog/slices-intro

### Slices and slicing
- Concept: slice = window onto an underlying array: `[]int{...}`; `s[1:3]` = elements 1 and 2 (end excluded); slices share memory; `slices.Clone` for an independent copy.
- Analogy: window onto a shelf — the window shows part of the shelf; moving a book through the window moves it on the real shelf.
- Code example: slicing.go — `s := []int{10, 20, 30, 40, 50}; t := s[1:3]; fmt.Println(t)` → `[20 30]`; `t[0] = 99; fmt.Println(s)` → `[10 99 30 40 50]`
- Production use: pagination `items[start:end]`, passing parts of buffers without copying.
- Common mistakes: forgetting the end index is excluded; unexpected changes through a shared slice.
- Sources: https://go.dev/ref/spec#Slice_expressions ; https://go.dev/blog/slices-intro

### append, len and cap
- Concept: `s = append(s, 1, 2, 3)` returns a (maybe new) slice; `len` = items in use, `cap` = room before re-allocation; `make([]int, 0, 10)` preallocates; nil slice (`var s []int`) works with append and len.
- Analogy: expanding suitcase — when full, Go buys a bigger suitcase and moves everything in; you must take the new suitcase (assign the result).
- Code example: grow.go — `var s []int; fmt.Println(len(s), s == nil)` → `0 true`; `s = append(s, 1, 2, 3); fmt.Println(s, len(s))` → `[1 2 3] 3`; `m := make([]int, 0, 10); fmt.Println(len(m), cap(m))` → `0 10` (don't print cap after append — growth is implementation-defined)
- Production use: building result lists; preallocate when the size is known.
- Common mistakes: `append(s, x)` without assigning → vet/compile error `append(s, x) (value of type []int) is not used`; `make([]int, 10)` then append → 10 zeros first.
- Sources: https://go.dev/ref/spec#Appending_and_copying_slices ; https://pkg.go.dev/builtin#append

### Ranging over slices
- Concept: `for i, v := range s`; `for _, v := range s`; `v` is a copy — change `s[i]` to modify.
- Analogy: conveyor belt handing you each item with its position tag; the item in your hand is a copy.
- Code example: rangeit.go — `names := []string{"ann", "bob"}; for i, n := range names { fmt.Println(i, n) }` → `0 ann`,`1 bob`
- Production use: processing records, building outputs.
- Common mistakes: modifying `v` expecting the slice to change; appending to the slice being ranged.
- Sources: https://go.dev/ref/spec#For_range

### slices package (Sort, Contains, Index)
- Concept: `slices.Sort`, `slices.Contains`, `slices.Index` (-1 if missing), `slices.Max`, `slices.Equal`; generic (works for any element type — topic 14).
- Analogy: toolbox for lists — sorter, finder, comparer — instead of writing loops by hand.
- Code example: slicespkg.go — `n := []int{3, 1, 2}; slices.Sort(n); fmt.Println(n)` → `[1 2 3]`; `names := []string{"ann", "bob"}`; `slices.Contains(names, "bob")` → `true`; `slices.Index(names, "zed")` → `-1`
- Production use: dedupe/sort IDs, membership checks.
- Common mistakes: using the old `sort.Ints` in new code (works, but slices is the modern API); `slices.Sort` sorts in place (returns nothing).
- Sources: https://pkg.go.dev/slices ; https://pkg.go.dev/slices#Sort

## Quiz
1. b := a for arrays: does changing b change a? — tests array copy
2. s[1:3] of [10 20 30 40 50] — tests slicing
3. Why assign append's result? — tests append
4. What does slices.Index return when missing? — tests -1
5. Changing v inside range — tests copy semantics
