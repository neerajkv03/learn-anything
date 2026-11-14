window.TOPICS = window.TOPICS || [];
window.TOPICS.push({
  "id": "06-arrays-slices",
  "order": 6,
  "title": "Arrays & Slices",
  "version": "Go 1.27.4 + pgx v5.11.0 + PostgreSQL 18.7 + Gin v1.12.0 + golang-jwt/jwt v5.3.1 + gin-contrib/cors v1.7.11",
  "summary": "Go stores ordered collections in arrays (fixed length) and slices (growable views onto an array). You will learn how slicing shares memory, how append, len and cap work, how to loop over a slice, and how to sort and search with the standard slices package.",
  "prerequisites": [
    "05-strings-formatting"
  ],
  "subtopics": [
    {
      "id": "arrays",
      "title": "Arrays",
      "explanation": "An array is a numbered row of values that all have the same type, with a length fixed when you write the code. You write the length in square brackets before the element type: `[3]int{1, 2, 3}` is an array of exactly three `int` values. Each position has an index (its number), and counting starts at 0, so the first element is `a[0]` and the last of three is `a[2]`. The built-in `len(a)` gives the number of elements.\n\nThe length is part of the type. `[3]int` and `[4]int` are two different types, and you cannot assign one to the other or compare them. If you declare an array without values, such as `var hash [4]byte`, every slot holds the zero value of the element type (here `0`).\n\nAssigning an array to another variable copies every element. After `b := a`, the two arrays are independent, so changing `b[0]` does not touch `a`. This is the same copy-on-assignment behaviour you saw for plain numbers and strings.\n\nIn day-to-day Go you rarely use arrays directly, because the length cannot change. Their main value is that slices (next sub-topic) are built on top of them, and that they suit data whose size never varies.",
      "analogy": "An array is an egg carton with exactly N slots: you cannot add a slot or remove one, and a `[6]` carton is a different product from a `[12]` carton. Assigning an array is like photocopying the whole carton with its eggs: you get a second, separate carton, and cracking an egg in the copy leaves the original untouched.",
      "code": [
        {
          "language": "go",
          "filename": "arrays.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\ta := [3]int{1, 2, 3}\n\tb := a // copies all three elements\n\tb[0] = 99\n\tfmt.Println(a, b)\n\tfmt.Println(len(a))\n\n\tvar hash [4]byte // zero value: every slot is 0\n\tfmt.Println(hash)\n\n\tfmt.Printf(\"%T %T\\n\", [3]int{}, [4]int{})\n}\n",
          "output": "[1 2 3] [99 2 3]\n3\n[0 0 0 0]\n[3]int [4]int\n",
          "explanation": "`b := a` makes a full copy, so changing `b[0]` leaves `a` as `[1 2 3]`. `var hash [4]byte` starts as four zeros. The `%T` verb (print the type) shows that `[3]int` and `[4]int` are different types because the length is part of the type. To run it, save the code as arrays.go in your module folder (the one with go.mod) and run `go run arrays.go` in a terminal opened in that folder."
        }
      ],
      "productionNote": "Arrays appear in production for values with a fixed size that should be values copied in full, such as a SHA-256 hash (a fixed 32-byte fingerprint of data) stored as `[32]byte` or an IPv4 address (the four-number address such as 192.168.0.1) as `[4]byte`. Because the size is in the type, the compiler rejects mixing up a 16-byte value with a 32-byte one. For anything whose length varies, use a slice.",
      "commonMistakes": [
        "Reading or writing past the end: with `a := [3]int{1, 2, 3}`, using a variable index like `a[i]` where `i` is 3 makes the program panic (crash at run time) with `index out of range [3] with length 3`. Valid indexes are 0 to len-1. If you write a constant such as `a[3]`, the compiler rejects it before the program even runs.",
        "Expecting `[3]int` and `[4]int` to be the same type. The length is part of the type, so passing a `[4]int` to a function that takes `[3]int` is a compile error.",
        "Expecting an array assigned to another variable to share data. It is copied, so changes to one do not show in the other."
      ],
      "sources": [
        {
          "title": "The Go Specification: Array types",
          "url": "https://go.dev/ref/spec#Array_types"
        },
        {
          "title": "Go Slices: usage and internals",
          "url": "https://go.dev/blog/slices-intro"
        }
      ]
    },
    {
      "id": "slices-and-slicing",
      "title": "Slices and slicing",
      "explanation": "A slice is a growable, flexible view onto an underlying array. You write its type as `[]int` (no length in the brackets) and create one with a literal: `s := []int{10, 20, 30, 40, 50}`. Most Go code uses slices rather than arrays. The array hidden behind a slice is called its backing array.\n\nA slice expression takes a part of a slice: `s[1:3]` means \"from index 1 up to, but not including, index 3\", so it holds elements 1 and 2. The start defaults to 0 and the end defaults to the length, so `s[:2]` is the first two elements and `s[3:]` is everything from index 3 onwards.\n\nA new slice made this way does not copy anything. It points at the same backing array, so both slices see the same elements. Writing through one slice changes what the other shows. This is fast and saves memory, but it can surprise you.\n\nWhen you need an independent copy, call `slices.Clone(s)`. The `slices` package is part of the standard library; you load it with `import \"slices\"`. Changing the clone does not affect the original.",
      "analogy": "A slice is a window onto a shelf of books. The window shows only part of the shelf, and you can have several windows onto the same shelf. If you swap a book through one window, the book is changed on the real shelf, so every other window sees it too. `slices.Clone` is buying a second shelf with copies of the books.",
      "code": [
        {
          "language": "go",
          "filename": "slicing.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"slices\"\n)\n\nfunc main() {\n\ts := []int{10, 20, 30, 40, 50}\n\tt := s[1:3] // elements 1 and 2; end is excluded\n\tfmt.Println(t)\n\n\tt[0] = 99 // writes into the shared backing array\n\tfmt.Println(s)\n\tfmt.Println(s[:2], s[3:])\n\n\tc := slices.Clone(s) // independent copy\n\tc[0] = 0\n\tfmt.Println(s[0], c[0])\n}\n",
          "output": "[20 30]\n[10 99 30 40 50]\n[10 99] [40 50]\n10 0\n",
          "explanation": "`t` is a window onto `s`, so `t[0] = 99` changes `s[1]` as well. `s[:2]` and `s[3:]` show the default start and end. The clone `c` has its own memory, so setting `c[0] = 0` leaves `s[0]` at 10."
        }
      ],
      "productionNote": "Slicing is how Go code does pagination (`items[start:end]`) and how it passes part of a large byte buffer (a block of memory holding data) to a function without copying it. The sharing is a common source of bugs when a function keeps a sub-slice of a big slice (it keeps the whole backing array in memory) or modifies data the caller still uses. When you store or return data that must be independent, clone it with `slices.Clone`.",
      "commonMistakes": [
        "Forgetting that the end index is excluded: `s[1:3]` has 2 elements, not 3.",
        "Being surprised that changing a sub-slice changes the original slice. Both share one backing array; use `slices.Clone` when you need a separate copy.",
        "Using an end index larger than the slice allows (for example `s[1:9]` on a 5-element slice), which panics at run time with a `slice bounds out of range` message."
      ],
      "sources": [
        {
          "title": "The Go Specification: Slice expressions",
          "url": "https://go.dev/ref/spec#Slice_expressions"
        },
        {
          "title": "Go Slices: usage and internals",
          "url": "https://go.dev/blog/slices-intro"
        },
        {
          "title": "Package slices",
          "url": "https://pkg.go.dev/slices"
        }
      ]
    },
    {
      "id": "append-len-cap",
      "title": "append, len and cap",
      "explanation": "A slice has two sizes. Its length (`len`) is how many elements it currently holds. Its capacity (`cap`) is how many elements fit in the backing array, counting from the slice's start, before Go must allocate (reserve) a bigger array.\n\nThe built-in `append` adds elements to the end: `s = append(s, 1, 2, 3)`. It returns a slice, and you must assign the result back. If there was spare capacity, the new elements go into the existing array. If not, Go allocates a larger array, copies the old elements across, and returns a slice pointing at the new one. Because you cannot know which will happen, always write `s = append(s, ...)`.\n\nTo append all elements of another slice, add `...` after it (the spread form from the functions topic): `append(s, other...)`.\n\nA slice declared with `var s []int` is a nil slice: it has no backing array, `len(s)` is 0, and `s == nil` is true. A nil slice is still safe to use with `append`, `len` and `range`, so you rarely need to create an empty slice first.\n\n`make([]int, 0, 10)` creates a slice with length 0 and capacity 10. The capacity is reserved up front so that later appends need no re-allocation. Be careful with `make([]int, 10)`: that makes a slice of length 10 filled with ten zeros, and a following `append` adds after those zeros.\n\nThe exact capacity Go picks when it grows a slice can change between Go versions, so never print or depend on it after growth. Only rely on capacity you set yourself with `make`.",
      "analogy": "A slice is an expanding suitcase. `len` is how many items are packed; `cap` is how many fit. When it is full, Go buys a bigger suitcase and moves everything into it, so you must carry the new suitcase from then on (assign the result of `append`). `make([]int, 0, 10)` is buying a big suitcase up front, so you do not need to switch while packing.",
      "code": [
        {
          "language": "go",
          "filename": "grow.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar s []int // nil slice\n\tfmt.Println(len(s), s == nil)\n\n\ts = append(s, 1, 2, 3)\n\tfmt.Println(s, len(s))\n\n\tother := []int{8, 9}\n\ts = append(s, other...)\n\tfmt.Println(s)\n\n\tm := make([]int, 0, 10) // length 0, room for 10\n\tfmt.Println(len(m), cap(m))\n\tm = append(m, 7)\n\tfmt.Println(m, len(m), cap(m))\n\n\tz := make([]int, 3) // three zeros already present\n\tz = append(z, 5)\n\tfmt.Println(z)\n}\n",
          "output": "0 true\n[1 2 3] 3\n[1 2 3 8 9]\n0 10\n[7] 1 10\n[0 0 0 5]\n",
          "explanation": "The nil slice has length 0 and still accepts `append`. `append(s, other...)` adds every element of `other`. `m` was given capacity 10, so appending one item keeps the capacity at 10. `make([]int, 3)` starts with three zeros, so `append` puts 5 after them."
        }
      ],
      "productionNote": "Building result lists with `append` is everyday Go. When you know roughly how many items you will add (for example one result per input row), use `make([]T, 0, n)` to avoid repeated re-allocation and copying. Do not preallocate by guesswork when the size is unknown; a nil slice and `append` are fine.",
      "commonMistakes": [
        "Calling `append(s, x)` without assigning the result. The compiler rejects it with an error like `append(s, x) (value of type []int) is not used`.",
        "Writing `make([]int, 10)` and then appending, expecting an empty slice. You get ten zeros first; use `make([]int, 0, 10)` for an empty slice with spare room.",
        "Printing or relying on `cap` after growth. The growth amount is an implementation detail and may differ between Go versions."
      ],
      "sources": [
        {
          "title": "The Go Specification: Appending to and copying slices",
          "url": "https://go.dev/ref/spec#Appending_and_copying_slices"
        },
        {
          "title": "builtin.append",
          "url": "https://pkg.go.dev/builtin#append"
        }
      ]
    },
    {
      "id": "ranging-over-slices",
      "title": "Ranging over slices",
      "explanation": "`for i, v := range s` visits every element of a slice in order. On each turn `i` is the index and `v` is the value at that index. You saw `range` over a string and over an integer earlier; the slice form works the same way.\n\nIf you do not need the index, replace it with the blank identifier: `for _, v := range s`. If you only need the index, write `for i := range s`.\n\nThe variable `v` is a copy of the element, not the element itself. Assigning to `v` changes only that copy. To change the slice, assign through the index: `s[i] = ...`.\n\nThe loop works on the slice as it was when the loop started, so appending to the slice inside the loop does not make the loop run longer. That is usually a sign of confusing code; build a separate result slice instead.",
      "analogy": "Ranging is a conveyor belt that hands you each item with a tag showing its position. The item in your hand is a photocopy: scribbling on it does nothing to the original still on the belt. To change the real item, use the position tag to walk to that spot and edit it there.",
      "code": [
        {
          "language": "go",
          "filename": "rangeit.go",
          "source": "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tnames := []string{\"ann\", \"bob\"}\n\tfor i, n := range names {\n\t\tfmt.Println(i, n)\n\t}\n\n\tnums := []int{1, 2, 3}\n\tfor _, v := range nums {\n\t\tv = v * 10 // changes only the copy\n\t\tfmt.Println(\"copy is\", v)\n\t}\n\tfmt.Println(nums)\n\n\tfor i := range nums {\n\t\tnums[i] = nums[i] * 10 // changes the slice\n\t}\n\tfmt.Println(nums)\n}\n",
          "output": "0 ann\n1 bob\ncopy is 10\ncopy is 20\ncopy is 30\n[1 2 3]\n[10 20 30]\n",
          "explanation": "The first loop prints each index and name. In the second loop, `v` is multiplied but `nums` is still `[1 2 3]` afterwards. The third loop writes through `nums[i]`, so the slice really changes."
        }
      ],
      "productionNote": "Ranging is how you process records, transform one slice into another and build outputs. Pair it with `append` into a preallocated result slice. When elements are large values, remember `v` is a copy of each one; index into the slice if you need to modify it.",
      "commonMistakes": [
        "Modifying `v` and expecting the slice to change. Assign to `s[i]` instead.",
        "Appending to the slice you are ranging over. The loop still uses the original length, so the new items are not visited, which is rarely what you meant.",
        "Declaring `i` or `v` and not using it, which gives a `declared and not used` compile error. Use `_` for values you do not need."
      ],
      "sources": [
        {
          "title": "The Go Specification: For statements with range clause",
          "url": "https://go.dev/ref/spec#For_range"
        }
      ]
    },
    {
      "id": "slices-package",
      "title": "The slices package (Sort, Contains, Index)",
      "explanation": "The standard `slices` package holds ready-made helpers for slices, so you do not write the same loops by hand. Load it with `import \"slices\"`. Its functions are generic, which means one function works for slices of many element types (such as `[]int` or `[]string`). You will learn how generics work in a later topic; for now just call them.\n\n`slices.Sort(s)` sorts the slice in place, smallest first (numbers ascending, strings in alphabetical byte order). It returns nothing; the slice you passed is now ordered.\n\n`slices.Contains(s, x)` reports whether `x` is in the slice (true or false). `slices.Index(s, x)` returns the position of the first match, or -1 if it is not there.\n\n`slices.Max(s)` returns the largest element (it panics on an empty slice). `slices.Equal(a, b)` reports whether two slices have the same length and the same elements in the same order. Note that `==` cannot compare two slices, which is why `Equal` exists.",
      "analogy": "The `slices` package is a toolbox for lists: a sorter, a finder, a measuring tape and a comparer. Instead of hand-making each tool with a loop every time, you pick the right one off the wall.",
      "code": [
        {
          "language": "go",
          "filename": "slicespkg.go",
          "source": "package main\n\nimport (\n\t\"fmt\"\n\t\"slices\"\n)\n\nfunc main() {\n\tn := []int{3, 1, 2}\n\tslices.Sort(n) // in place, returns nothing\n\tfmt.Println(n)\n\tfmt.Println(slices.Max(n))\n\tfmt.Println(slices.Equal(n, []int{1, 2, 3}))\n\n\tnames := []string{\"ann\", \"bob\"}\n\tfmt.Println(slices.Contains(names, \"bob\"))\n\tfmt.Println(slices.Index(names, \"bob\"))\n\tfmt.Println(slices.Index(names, \"zed\"))\n}\n",
          "output": "[1 2 3]\n3\ntrue\ntrue\n1\n-1\n",
          "explanation": "`slices.Sort` reorders `n` itself. `Max` returns 3 and `Equal` is true because both slices hold 1, 2, 3. `Contains` finds \"bob\", `Index` gives its position 1, and `Index` returns -1 for \"zed\", which is not present."
        }
      ],
      "productionNote": "Use `slices.Sort` and `slices.Contains` for tidying ID lists and quick membership checks on small slices. For very large collections that you search often, a map (the next topic) is faster than scanning with `Contains`. Prefer `slices` in new code over the older `sort.Ints` and `sort.Strings`; those still work, but `slices` is the modern API.",
      "commonMistakes": [
        "Writing `sorted := slices.Sort(n)`. `Sort` sorts in place and returns nothing, so this does not compile.",
        "Treating the result of `slices.Index` as a true/false answer. A match at position 0 returns 0, and a miss returns -1; check `!= -1` or use `Contains`.",
        "Using the older `sort.Ints` in new code. It works, but `slices.Sort` is preferred."
      ],
      "sources": [
        {
          "title": "Package slices",
          "url": "https://pkg.go.dev/slices"
        },
        {
          "title": "slices.Sort",
          "url": "https://pkg.go.dev/slices#Sort"
        }
      ]
    }
  ],
  "quiz": [
    {
      "question": "With `a := [3]int{1, 2, 3}` and `b := a`, you then run `b[0] = 99`. What is `a` afterwards?",
      "options": [
        "[99 2 3]",
        "[1 2 3]",
        "[99 99 99]",
        "The program does not compile"
      ],
      "answerIndex": 1,
      "explanation": "Assigning an array copies all its elements, so `b` is independent and `a` stays `[1 2 3]`."
    },
    {
      "question": "What does `s[1:3]` contain when `s` is `[]int{10, 20, 30, 40, 50}`?",
      "options": [
        "[10 20 30]",
        "[20 30 40]",
        "[20 30]",
        "[10 20]"
      ],
      "answerIndex": 2,
      "explanation": "The slice starts at index 1 and stops before index 3, so it holds the elements at indexes 1 and 2: 20 and 30."
    },
    {
      "question": "Why must you write `s = append(s, x)` instead of just `append(s, x)`?",
      "options": [
        "append may return a new slice (when a bigger backing array is needed), so you must keep the result",
        "append always empties the original slice first",
        "append only works on arrays, so the assignment converts it",
        "Go requires every function call to be assigned to a variable"
      ],
      "answerIndex": 0,
      "explanation": "If there is no spare capacity, append allocates a new, larger array and returns a slice pointing at it. Ignoring the result loses that slice, and the compiler reports the unused value."
    },
    {
      "question": "What does `slices.Index(names, \"zed\")` return when \"zed\" is not in `names`?",
      "options": [
        "0",
        "false",
        "-1",
        "It panics"
      ],
      "answerIndex": 2,
      "explanation": "`slices.Index` returns the position of the first match, or -1 when the value is not found. (A match at the first position returns 0, so 0 does not mean missing.)"
    },
    {
      "question": "Inside `for _, v := range nums { v = v * 10 }`, what happens to `nums`?",
      "options": [
        "Every element of nums is multiplied by 10",
        "Only the last element is multiplied by 10",
        "nums is unchanged, because v is a copy of each element",
        "The code does not compile because v is assigned"
      ],
      "answerIndex": 2,
      "explanation": "`v` is a copy of the element, so changing it does not change the slice. To modify the slice, assign to `nums[i]` using the index."
    }
  ]
});
